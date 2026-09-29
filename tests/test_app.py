"""采收追溯表核心逻辑测试：批次登记、箱号唯一、分装不超量、溯源与导出。"""

import csv
import io

import pytest
from fastapi.testclient import TestClient

from app import create_app


@pytest.fixture()
def client(tmp_path):
    app = create_app(str(tmp_path / "test.db"))
    with TestClient(app) as c:
        yield c


def make_batch(client, **overrides):
    payload = {
        "plot": "东坡3号地",
        "variety": "红富士",
        "harvest_date": "2026-09-20",
        "weight_kg": 100.0,
    }
    payload.update(overrides)
    resp = client.post("/api/batches", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_create_and_list_batch(client):
    batch = make_batch(client)
    assert batch["packed_kg"] == 0
    assert batch["remaining_kg"] == 100.0

    batches = client.get("/api/batches").json()
    assert len(batches) == 1
    assert batches[0]["plot"] == "东坡3号地"


def test_batch_validation(client):
    resp = client.post(
        "/api/batches",
        json={"plot": "", "variety": "红富士",
              "harvest_date": "2026-09-20", "weight_kg": 100},
    )
    assert resp.status_code == 422
    resp = client.post(
        "/api/batches",
        json={"plot": "A", "variety": "红富士",
              "harvest_date": "2026-09-20", "weight_kg": -1},
    )
    assert resp.status_code == 422


def test_box_no_unique_across_batches(client):
    b1 = make_batch(client)
    b2 = make_batch(client, plot="西坡1号地")
    resp = client.post(f"/api/batches/{b1['id']}/boxes",
                       json={"box_no": "BOX-001", "weight_kg": 10})
    assert resp.status_code == 201
    # 同一箱号不能归属两个批次
    resp = client.post(f"/api/batches/{b2['id']}/boxes",
                       json={"box_no": "BOX-001", "weight_kg": 5})
    assert resp.status_code == 409
    assert "已存在" in resp.json()["detail"]


def test_packed_weight_cannot_exceed_harvest(client):
    b = make_batch(client, weight_kg=50.0)
    resp = client.post(f"/api/batches/{b['id']}/boxes",
                       json={"box_no": "A-1", "weight_kg": 30})
    assert resp.status_code == 201
    resp = client.post(f"/api/batches/{b['id']}/boxes",
                       json={"box_no": "A-2", "weight_kg": 25})
    assert resp.status_code == 409
    assert "超过采收量" in resp.json()["detail"]
    # 恰好装满允许
    resp = client.post(f"/api/batches/{b['id']}/boxes",
                       json={"box_no": "A-2", "weight_kg": 20})
    assert resp.status_code == 201
    batch = client.get("/api/batches").json()[0]
    assert batch["remaining_kg"] == 0


def test_trace_box(client):
    b = make_batch(client)
    client.post(f"/api/batches/{b['id']}/boxes",
                json={"box_no": "BOX-9", "weight_kg": 12.5})
    resp = client.get("/api/boxes/BOX-9")
    assert resp.status_code == 200
    data = resp.json()
    assert data["box_weight_kg"] == 12.5
    assert data["batch"]["plot"] == "东坡3号地"
    assert data["batch"]["variety"] == "红富士"
    assert data["remaining_kg"] == 87.5

    resp = client.get("/api/boxes/NO-SUCH-BOX")
    assert resp.status_code == 404


def test_box_on_missing_batch(client):
    resp = client.post("/api/batches/999/boxes",
                       json={"box_no": "X-1", "weight_kg": 1})
    assert resp.status_code == 404


def test_export_csv(client):
    b = make_batch(client)
    client.post(f"/api/batches/{b['id']}/boxes",
                json={"box_no": "BOX-001", "weight_kg": 10})
    client.post(f"/api/batches/{b['id']}/boxes",
                json={"box_no": "BOX-002", "weight_kg": 15})
    resp = client.get("/api/export.csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]

    text = resp.content.decode("utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    assert rows[0] == ["箱号", "箱重(kg)", "批次号", "地块", "品种",
                       "采收日期", "批次采收量(kg)"]
    assert len(rows) == 3
    assert rows[1][0] == "BOX-001"
    assert rows[1][3] == "东坡3号地"
    assert rows[2][0] == "BOX-002"
