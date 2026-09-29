from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("HARVEST_DB_PATH", str(tmp_path / "harvest-test.db"))
    from harvest_app.main import app

    with TestClient(app) as test_client:
        yield test_client


def make_batch(code_prefix: str = "A", weight: str = "10") -> dict:
    return {
        "parcel": "东坡 3 号地",
        "variety": "红富士",
        "harvest_date": "2026-09-30",
        "weight_kg": weight,
        "boxes": [
            {"code": f"{code_prefix}-001", "weight_kg": "3"},
            {"code": f"{code_prefix}-002", "weight_kg": "2"},
        ],
    }


def test_health_returns_json(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_register_batch_calculates_packed_weight_and_remaining_stock(client: TestClient) -> None:
    response = client.post("/api/batches", json=make_batch())

    assert response.status_code == 201
    data = response.json()
    assert data["parcel"] == "东坡 3 号地"
    assert data["packed_weight_kg"] == "5"
    assert data["remaining_kg"] == "5"
    assert [box["code"] for box in data["boxes"]] == ["A-001", "A-002"]


def test_box_code_cannot_belong_to_two_batches(client: TestClient) -> None:
    first = client.post("/api/batches", json=make_batch())
    assert first.status_code == 201

    second_payload = make_batch("B", "8")
    second_payload["boxes"][0]["code"] = "A-001"
    response = client.post("/api/batches", json=second_payload)

    assert response.status_code == 409
    assert "A-001" in response.json()["detail"]


def test_packed_weight_cannot_exceed_harvest_weight(client: TestClient) -> None:
    payload = make_batch(weight="4.5")
    response = client.post("/api/batches", json=payload)

    assert response.status_code == 400
    assert "超过采收重量" in response.json()["detail"]


def test_duplicate_box_code_within_one_request_is_rejected(client: TestClient) -> None:
    payload = make_batch()
    payload["boxes"][1]["code"] = "A-001"

    response = client.post("/api/batches", json=payload)

    assert response.status_code == 422


def test_box_query_returns_source_and_remaining_stock(client: TestClient) -> None:
    client.post("/api/batches", json=make_batch())

    response = client.get("/api/boxes", params={"code": "A-002"})

    assert response.status_code == 200
    data = response.json()
    assert data["code"] == "A-002"
    assert data["parcel"] == "东坡 3 号地"
    assert data["variety"] == "红富士"
    assert data["weight_kg"] == "2"
    assert data["packed_weight_kg"] == "5"
    assert data["remaining_kg"] == "5"


def test_csv_export_contains_box_rows_and_can_be_filtered(client: TestClient) -> None:
    client.post("/api/batches", json=make_batch())

    all_csv = client.get("/api/export.csv")
    assert all_csv.status_code == 200
    all_text = all_csv.content.decode("utf-8-sig")
    assert "箱号" in all_text
    assert "A-001" in all_text
    assert "A-002" in all_text
    assert all_text.count("东坡 3 号地") == 2

    one_box_csv = client.get("/api/export.csv", params={"box_code": "A-001"})
    one_box_text = one_box_csv.content.decode("utf-8-sig")
    assert "A-001" in one_box_text
    assert "A-002" not in one_box_text
