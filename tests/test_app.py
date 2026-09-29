"""盘点差异助手核心逻辑测试：导入、录入防覆盖、差异汇总、原因与导出。"""
import io

import pytest
from fastapi.testclient import TestClient

from app import app, store

CSV = """sku,name,category,shelf,book_qty
A001,矿泉水,饮料,A1,10
A002,可乐,饮料,A2,20
B001,挂面,粮油,A1,5
"""


@pytest.fixture(autouse=True)
def clean_store():
    store.reset()
    yield
    store.reset()


@pytest.fixture()
def client():
    return TestClient(app)


def import_csv(client, text=CSV):
    return client.post("/api/import", files={"file": ("products.csv", text.encode("utf-8"), "text/csv")})


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_index_serves_html(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert "盘点差异助手" in resp.text


def test_import_and_list(client):
    resp = import_csv(client)
    assert resp.status_code == 200
    assert resp.json() == {"imported": 3}
    data = client.get("/api/items").json()
    assert data["summary"]["total"] == 3
    assert data["summary"]["counted"] == 0
    assert data["summary"]["shelves"] == ["A1", "A2"]


def test_import_rejects_bad_csv(client):
    resp = import_csv(client, "sku,name\nA001,缺列\n")
    assert resp.status_code == 400
    assert "缺少列" in resp.json()["detail"]
    resp = import_csv(client, "sku,name,category,shelf,book_qty\nA001,水,饮料,A1,abc\n")
    assert resp.status_code == 400
    resp = import_csv(client, "sku,name,category,shelf,book_qty\nA001,水,饮料,A1,1\nA001,水2,饮料,A1,2\n")
    assert resp.status_code == 400
    assert "重复" in resp.json()["detail"]


def test_count_and_diff(client):
    import_csv(client)
    resp = client.post("/api/count", json={"sku": "A001", "qty": 8})
    assert resp.status_code == 200
    assert resp.json()["diff"] == -2
    resp = client.post("/api/count", json={"sku": "A002", "qty": 22})
    assert resp.json()["diff"] == 2


def test_duplicate_count_does_not_overwrite(client):
    import_csv(client)
    client.post("/api/count", json={"sku": "A001", "qty": 8})
    resp = client.post("/api/count", json={"sku": "A001", "qty": 9})
    assert resp.status_code == 409
    detail = resp.json()["detail"]
    assert detail["existing_qty"] == 8 and detail["new_qty"] == 9
    # 原值未被悄悄覆盖
    item = next(i for i in client.get("/api/items").json()["items"] if i["sku"] == "A001")
    assert item["actual_qty"] == 8
    # 显式确认后才覆盖
    resp = client.post("/api/count", json={"sku": "A001", "qty": 9, "confirm_overwrite": True})
    assert resp.status_code == 200
    assert resp.json()["actual_qty"] == 9
    assert resp.json()["revisions"] == 1


def test_count_unknown_sku(client):
    import_csv(client)
    resp = client.post("/api/count", json={"sku": "NOPE", "qty": 1})
    assert resp.status_code == 404


def test_clear_count(client):
    import_csv(client)
    client.post("/api/count", json={"sku": "A001", "qty": 8})
    resp = client.request("DELETE", "/api/count/A001")
    assert resp.status_code == 200
    assert resp.json()["actual_qty"] is None


def test_differences_grouping_and_filter(client):
    import_csv(client)
    client.post("/api/count", json={"sku": "A001", "qty": 8})
    client.post("/api/count", json={"sku": "A002", "qty": 20})
    client.post("/api/count", json={"sku": "B001", "qty": 7})
    data = client.get("/api/differences").json()
    a1 = next(g for g in data["by_shelf"] if g["name"] == "A1")
    assert a1["diff"] == 0 and a1["diff_items"] == 2 and a1["counted"] == 2
    food = next(g for g in data["by_category"] if g["name"] == "粮油")
    assert food["diff"] == 2
    filtered = client.get("/api/differences?shelf=A2").json()
    assert [i["sku"] for i in filtered["items"]] == ["A002"]


def test_reason_and_review(client):
    import_csv(client)
    client.post("/api/count", json={"sku": "A001", "qty": 8})
    client.post("/api/count", json={"sku": "A002", "qty": 20})
    resp = client.post("/api/reason", json={"sku": "A001", "reason": "破损报废", "note": "挤压漏水"})
    assert resp.status_code == 200
    resp = client.post("/api/reason", json={"sku": "A001", "reason": "胡说八道"})
    assert resp.status_code == 400
    review = client.get("/api/review").json()
    assert len(review["rows"]) == 1
    assert review["rows"][0]["reason"] == "破损报废"
    assert review["missing_reason"] == 0
    assert review["uncounted"] == 1
    assert review["total_diff"] == -2


def test_export_csv(client):
    import_csv(client)
    client.post("/api/count", json={"sku": "A001", "qty": 8})
    client.post("/api/reason", json={"sku": "A001", "reason": "丢失"})
    resp = client.get("/api/export/counts.csv")
    assert resp.status_code == 200
    text = resp.content.decode("utf-8-sig")
    assert "A001,矿泉水,饮料,A1,10,8,-2,丢失" in text
    resp = client.get("/api/export/review.csv")
    text = resp.content.decode("utf-8-sig")
    assert "A001" in text and "A002" not in text


def test_sample_endpoint(client):
    resp = client.post("/api/sample")
    assert resp.status_code == 200
    assert resp.json()["imported"] > 0
    assert client.get("/api/sample.csv").status_code == 200


def test_import_resets_previous_counts(client):
    import_csv(client)
    client.post("/api/count", json={"sku": "A001", "qty": 8})
    import_csv(client)
    item = next(i for i in client.get("/api/items").json()["items"] if i["sku"] == "A001")
    assert item["actual_qty"] is None
