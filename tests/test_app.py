from datetime import date

import pytest
from fastapi.testclient import TestClient

import app as app_module


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test-appointments.db"
    monkeypatch.setenv("APPOINTMENT_DB_PATH", str(db_path))
    app_module.init_db(db_path)
    with TestClient(app_module.app) as test_client:
        yield test_client


def make_window(client, name="一号窗口", service="社保咨询", duration=60, open_time="09:00", close_time="11:00"):
    response = client.post(
        "/api/windows",
        json={
            "name": name,
            "service_name": service,
            "duration_minutes": duration,
            "open_time": open_time,
            "close_time": close_time,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_health_returns_json(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_window_generation_and_booking_blocks_duplicate_slot(client):
    window = make_window(client)
    assert [slot["start_time"] for slot in client.get(
        "/api/staff/day", params={"date": date.today().isoformat()}
    ).json()["gaps"]] == ["09:00", "10:00"]

    payload = {
        "window_id": window["id"],
        "resident_code": "jm-001",
        "date": date.today().isoformat(),
        "start_time": "09:00",
    }
    first = client.post("/api/appointments", json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["resident_code"] == "JM-001"
    assert first.json()["queue_number"].startswith("H")

    second = client.post("/api/appointments", json=payload)
    assert second.status_code == 409
    assert "已被预约" in second.json()["detail"]

    dashboard = client.get("/api/staff/day", params={"date": date.today().isoformat()}).json()
    assert [gap["start_time"] for gap in dashboard["gaps"]] == ["10:00"]
    assert dashboard["queue"][0]["status"] == "booked"


def test_booking_rejects_time_outside_configured_slots(client):
    window = make_window(client)
    response = client.post("/api/appointments", json={
        "window_id": window["id"],
        "resident_code": "JM-BAD",
        "date": date.today().isoformat(),
        "start_time": "09:30",
    })
    assert response.status_code == 422
    assert "可预约时段" in response.json()["detail"]


def test_reschedule_releases_old_slot_and_cancel_opens_slot(client):
    window = make_window(client)
    day = date.today().isoformat()
    created = client.post("/api/appointments", json={
        "window_id": window["id"],
        "resident_code": "JM-002",
        "date": day,
        "start_time": "09:00",
    }).json()

    moved = client.post(f"/api/appointments/{created['id']}/reschedule", json={
        "window_id": window["id"],
        "date": day,
        "start_time": "10:00",
    })
    assert moved.status_code == 200, moved.text
    gaps = [gap["start_time"] for gap in client.get("/api/staff/day", params={"date": day}).json()["gaps"]]
    assert gaps == ["09:00"]

    cancelled = client.post(f"/api/appointments/{created['id']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"
    gaps = [gap["start_time"] for gap in client.get("/api/staff/day", params={"date": day}).json()["gaps"]]
    assert gaps == ["09:00", "10:00"]
    assert client.get("/api/appointments/mine", params={"resident_code": "JM-002"}).json() == []


def test_late_and_no_show_are_only_status_records(client):
    window = make_window(client)
    day = date.today().isoformat()
    first_id = client.post("/api/appointments", json={
        "window_id": window["id"], "resident_code": "A1", "date": day, "start_time": "09:00"
    }).json()["id"]
    second_id = client.post("/api/appointments", json={
        "window_id": window["id"], "resident_code": "A2", "date": day, "start_time": "10:00"
    }).json()["id"]

    assert client.patch(f"/api/staff/appointments/{first_id}/status", json={"status": "late"}).json()["status"] == "late"
    assert client.patch(f"/api/staff/appointments/{second_id}/status", json={"status": "no_show"}).json()["status"] == "no_show"

    dashboard = client.get("/api/staff/day", params={"date": day}).json()
    assert dashboard["status_counts"] == {"booked": 0, "attended": 0, "late": 1, "no_show": 1}
    assert "penalty" not in dashboard["queue"][0]


def test_window_hours_must_fit_service_duration(client):
    response = client.post("/api/windows", json={
        "name": "异常窗口",
        "service_name": "咨询",
        "duration_minutes": 35,
        "open_time": "09:00",
        "close_time": "10:00",
    })
    assert response.status_code == 422
    assert "整除" in response.json()["detail"]


def test_window_delete_with_history_is_deactivated(client):
    window = make_window(client)
    day = date.today().isoformat()
    client.post("/api/appointments", json={
        "window_id": window["id"], "resident_code": "A3", "date": day, "start_time": "09:00"
    })
    result = client.delete(f"/api/windows/{window['id']}").json()
    assert result == {"deleted": False, "deactivated": True, "detail": "窗口已有预约记录，已停用且保留历史"}
    assert all(item["id"] != window["id"] for item in client.get("/api/windows").json())
