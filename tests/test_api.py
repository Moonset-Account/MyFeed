"""接口层测试：健康检查与重复扫码返回 409。"""
from fastapi.testclient import TestClient

from app import app, store

CSV = "货号,名称,类别,货架,账面数量\nA001,可乐,饮料,A架,24\n"


def setup_function():
    store.reset()


def test_health():
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_duplicate_count_returns_409_and_keeps_value():
    client = TestClient(app)
    client.post("/api/products/import", json={"csv_text": CSV})
    assert client.post("/api/count", json={"sku": "A001", "qty": 20}).status_code == 200
    resp = client.post("/api/count", json={"sku": "A001", "qty": 22})
    assert resp.status_code == 409
    assert resp.json()["existing_qty"] == 20
    # 确认覆盖后才生效
    resp = client.post("/api/count", json={"sku": "A001", "qty": 22, "overwrite": True})
    assert resp.status_code == 200
    assert resp.json()["item"]["actual_qty"] == 22


def test_index_page_served():
    client = TestClient(app)
    resp = client.get("/")
    assert resp.status_code == 200
    assert "盘点差异助手" in resp.text
