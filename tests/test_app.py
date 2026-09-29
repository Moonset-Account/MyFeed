from datetime import datetime, timedelta, timezone
import sqlite3

import pytest
from fastapi.testclient import TestClient

import app as app_module
from app import app


LOCAL_TZ = timezone(timedelta(hours=8))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test-cleaning.db"
    monkeypatch.setattr(app_module, "DB_PATH", db_path)
    with TestClient(app) as test_client:
        yield test_client


def local_future(hours: int = 1) -> str:
    value = datetime.now(LOCAL_TZ) + timedelta(hours=hours)
    return value.strftime("%Y-%m-%dT%H:%M")



def create_room_and_cleaner(client, room_name="201", cleaner_name="林阿姨"):
    room = client.post("/api/rooms", json={"name": room_name, "floor": "二楼"}).json()
    cleaner = client.post("/api/cleaners", json={"name": cleaner_name}).json()
    return room, cleaner


def full_cleaning(client, task_id: int) -> None:
    task = client.get(f"/api/tasks/{task_id}").json()
    for item in task["items"]:
        response = client.patch(f"/api/tasks/{task_id}/items/{item['id']}", json={"done": True})
        assert response.status_code == 200
    assert client.post(f"/api/tasks/{task_id}/complete", json={"actor": "清扫人员"}).status_code == 200


def test_health_and_home_are_separate(client):
    assert client.get("/health").json() == {"status": "ok"}
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]


def test_due_checkout_generates_waiting_task_and_board_priority(client):
    room, cleaner = create_room_and_cleaner(client)
    past = (datetime.now(LOCAL_TZ) - timedelta(minutes=30)).strftime("%Y-%m-%dT%H:%M")
    task = client.post("/api/tasks", json={
        "room_id": room["id"], "checkout_at": past, "cleaner_id": cleaner["id"]
    }).json()
    assert task["status"] == "assigned"
    board = client.get(f"/api/board?day={datetime.now(LOCAL_TZ).date().isoformat()}").json()
    assert board["tasks"][0]["id"] == task["id"]
    assert board["tasks"][0]["priority"] == "overdue"


def test_future_checkout_stays_scheduled_until_checkout_time(client):
    room, cleaner = create_room_and_cleaner(client, room_name="202", cleaner_name="王姐")
    future = (datetime.now(LOCAL_TZ) + timedelta(days=1)).strftime("%Y-%m-%dT%H:%M")
    task = client.post("/api/tasks", json={
        "room_id": room["id"], "checkout_at": future, "cleaner_id": cleaner["id"]
    }).json()
    assert task["status"] == "scheduled"
    tomorrow = (datetime.now(LOCAL_TZ) + timedelta(days=1)).date().isoformat()
    board = client.get(f"/api/board?day={tomorrow}").json()
    assert [item["id"] for item in board["tasks"]] == [task["id"]]

    past = (datetime.now(timezone.utc) - timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%M:%S+00:00")
    with sqlite3.connect(app_module.DB_PATH) as raw:
        raw.execute("UPDATE tasks SET checkout_at = ? WHERE id = ?", (past, task["id"]))
        raw.commit()
    board = client.get(f"/api/board?day={tomorrow}").json()
    promoted = next(item for item in board["tasks"] if item["id"] == task["id"])
    assert promoted["status"] == "assigned"
    today = datetime.now(LOCAL_TZ).date().isoformat()
    board = client.get(f"/api/board?day={today}").json()
    assert any(item["id"] == task["id"] and item["priority"] == "overdue" for item in board["tasks"])


def test_cannot_complete_until_all_items_checked(client):
    room, cleaner = create_room_and_cleaner(client)
    past = (datetime.now(LOCAL_TZ) - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M")
    task = client.post("/api/tasks", json={
        "room_id": room["id"], "checkout_at": past, "cleaner_id": cleaner["id"]
    }).json()
    client.post(f"/api/tasks/{task['id']}/start", json={"actor": cleaner["name"]})
    response = client.post(f"/api/tasks/{task['id']}/complete", json={"actor": cleaner["name"]})
    assert response.status_code == 409
    assert "检查项" in response.json()["detail"]


def test_rejected_room_cannot_be_ready_then_rework_can_pass_and_approve(client):
    room, cleaner = create_room_and_cleaner(client)
    past = (datetime.now(LOCAL_TZ) - timedelta(minutes=20)).strftime("%Y-%m-%dT%H:%M")
    task = client.post("/api/tasks", json={
        "room_id": room["id"], "checkout_at": past, "cleaner_id": cleaner["id"]
    }).json()
    client.post(f"/api/tasks/{task['id']}/start", json={"actor": cleaner["name"]})
    full_cleaning(client, task["id"])
    rejected = client.post(f"/api/tasks/{task['id']}/inspect", json={
        "passed": False, "note": "枕套有污渍", "inspector": "店长"
    })
    assert rejected.status_code == 200
    blocked = client.post(f"/api/tasks/{task['id']}/ready", json={"actor": "店长"})
    assert blocked.status_code == 409
    room_after_reject = client.get(f"/api/rooms/{room['id']}").json()
    assert room_after_reject["ready"] is False
    assert room_after_reject["status"] == "rejected"

    client.post(f"/api/tasks/{task['id']}/start", json={"actor": cleaner["name"]})
    full_cleaning(client, task["id"])
    client.post(f"/api/tasks/{task['id']}/inspect", json={"passed": True, "note": "整改完成"})
    approved = client.post(f"/api/tasks/{task['id']}/ready", json={"actor": "店长"}).json()
    assert approved["status"] == "approved"
    room_ready = client.get(f"/api/rooms/{room['id']}").json()
    assert room_ready["ready"] is True


def test_supply_record_appears_in_room_history_and_day_board(client):
    room, _ = create_room_and_cleaner(client)
    supply_item = client.get("/api/supply-items").json()[0]
    response = client.post("/api/supplies", json={
        "room_id": room["id"], "supply_item_id": supply_item["id"], "quantity": 4, "note": "补齐浴室"
    })
    assert response.status_code == 201
    history = client.get(f"/api/rooms/{room['id']}/history").json()
    assert history["supplies"][0]["supply_name"] == supply_item["name"]
    board = client.get(f"/api/board?day={datetime.now(LOCAL_TZ).date().isoformat()}").json()
    assert board["supplies"][0]["quantity"] == 4


def test_duplicate_room_name_is_rejected(client):
    create_room_and_cleaner(client)
    response = client.post("/api/rooms", json={"name": "201"})
    assert response.status_code == 409
