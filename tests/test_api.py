from fastapi.testclient import TestClient

from backend.app import app


def base_document():
    return {
        "openapi": "3.0.3",
        "info": {"title": "x", "version": "1"},
        "paths": {
            "/x": {
                "post": {
                    "requestBody": {
                        "required": True,
                        "content": {"application/json": {"schema": {"type": "object", "properties": {"a": {"type": "string"}}}}},
                    },
                    "responses": {"201": {"description": "ok"}},
                }
            }
        },
    }


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_compare_endpoint_validates_openapi_3_and_returns_report():
    client = TestClient(app)
    old = base_document()
    new = base_document()
    new["paths"]["/x"]["post"]["requestBody"]["content"]["application/json"]["schema"]["required"] = ["a"]
    response = client.post("/api/compare", json={"old": old, "new": new})
    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"]["breaking"] == 1
    assert payload["operations"][0]["findings"][0]["constraint"].startswith("request body a")


def test_compare_endpoint_rejects_non_openapi_3():
    client = TestClient(app)
    response = client.post("/api/compare", json={"old": {"swagger": "2.0"}, "new": {"swagger": "2.0"}})
    assert response.status_code == 200
    payload = response.json()
    assert payload["errors"]
    assert payload["summary"] is None
