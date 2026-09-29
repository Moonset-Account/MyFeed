from datetime import date

import pytest
from fastapi.testclient import TestClient

import app as app_module


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_path = tmp_path / "test-appointments.db"
    monkeypatch.setenv("APPOINTMENT_DB", str(db_path))
    app_module.DB_PATH = db_path
    app_module.init_db(db_path)
    with TestClient(app_module.app) as test_client:
        yield test_client


def make_window(client, name="一号窗口", duration=20):
    response = client.post(
        "/api/windows",
        json={"name": name, "service_name": "社保咨询", "duration_minutes": duration},
    )
    assert response.status_code == 201
    return response.json()["id"]


def make_schedule(client, window_id, day="2026-10-01", opens="09:00", closes="10:00"):
    response = client.post(
        "/api/schedules",
        json={
            "window_id": window_id,
            "schedule_date": day,
            "opens_at": opens,
            "closes_at": closes,
        },
    )
    assert response.status_code == 201
    return response.json()


def book(client, window_id, day="2026-10-01", starts_at="09:00"):
    return client.post(
        "/api/appointments",
        json={"window_id": window_id, "schedule_date": day, "starts_at": starts_at},
    )


def test_health_ready_json(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_book_reschedule_and_cancel_frees_slot(client):
    window_id = make_window(client)
    make_schedule(client, window_id)

    booked = book(client, window_id)
    assert booked.status_code == 201
    appointment = booked.json()
    assert len(appointment["reference"]) == 6
    assert appointment["status"] == "booked"
    assert appointment["ends_at"] == "09:20"

    duplicate = book(client, window_id)
    assert duplicate.status_code == 409

    rescheduled = client.post(
        f"/api/appointments/lookup/{appointment['reference']}/reschedule",
        json={"window_id": window_id, "schedule_date": "2026-10-01", "starts_at": "09:40"},
    )
    assert rescheduled.status_code == 200
    assert rescheduled.json()["starts_at"] == "09:40"

    first_slot_after_move = book(client, window_id, starts_at="09:00")
    assert first_slot_after_move.status_code == 201

    cancelled = client.post(f"/api/appointments/lookup/{appointment['reference']}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    rebook_released = book(client, window_id, starts_at="09:40")
    assert rebook_released.status_code == 201


def test_late_and_no_show_are_manual_status_without_other_changes(client):
    window_id = make_window(client)
    make_schedule(client, window_id)
    appointment = book(client, window_id).json()

    late = client.post(
        f"/api/appointments/{appointment['id']}/status",
        json={"status": "late"},
    )
    assert late.status_code == 200
    assert late.json()["status"] == "late"

    no_show = client.post(
        f"/api/appointments/{appointment['id']}/status",
        json={"status": "no_show"},
    )
    assert no_show.status_code == 200
    assert no_show.json()["status"] == "no_show"

    blocked = book(client, window_id, starts_at="09:00")
    assert blocked.status_code == 409

    lookup = client.get(f"/api/appointments/lookup/{appointment['reference']}")
    assert lookup.json()["status"] == "no_show"
    assert "punishment" not in lookup.json()


def test_dashboard_shows_queue_and_gaps(client):
    window_id = make_window(client, duration=30)
    make_schedule(client, window_id, opens="09:00", closes="10:30")
    first = book(client, window_id, starts_at="09:00").json()
    second = book(client, window_id, starts_at="09:30").json()
    client.post(f"/api/appointments/{second['id']}/status", json={"status": "called"})

    response = client.get("/api/dashboard?schedule_date=2026-10-01")
    assert response.status_code == 200
    data = response.json()
    assert data["schedule_date"] == "2026-10-01"
    assert [item["reference"] for item in data["queue"]] == [first["reference"], second["reference"]]
    window = data["windows"][0]
    assert [slot["starts_at"] for slot in window["slots"] if slot["available"]] == ["10:00"]


def test_empty_schedule_can_be_deleted(client):
    window_id = make_window(client, "临时窗口")
    schedule = make_schedule(client, window_id, day="2026-10-02")

    response = client.delete(f"/api/schedules/{schedule['id']}")
    assert response.status_code == 204
    assert response.content == b""

    schedules = client.get("/api/schedules?schedule_date=2026-10-02").json()
    assert schedules == []


def test_staff_can_configure_separate_windows_without_cross_blocking(client):
    first_window = make_window(client, "一号窗口")
    second_window = make_window(client, "二号窗口")
    make_schedule(client, first_window)
    make_schedule(client, second_window)

    first = book(client, first_window)
    second = book(client, second_window)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["reference"] != second.json()["reference"]
