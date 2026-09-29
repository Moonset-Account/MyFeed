from fastapi.testclient import TestClient

from backend.app import app


def doc(schema):
    return {
        "openapi": "3.0.0",
        "paths": {
            "/things": {
                "get": {
                    "responses": {
                        "200": {
                            "description": "ok",
                            "content": {"application/json": {"schema": schema}},
                        }
                    }
                }
            }
        },
    }


def test_health():
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_review_endpoint_reports_directional_break():
    old = doc({"type": "string", "enum": ["a", "b"]})
    new = doc({"type": "string", "enum": ["a", "c"]})
    response = TestClient(app).post("/api/review", json={"old": old, "new": new})
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "breaking"
    assert payload["summary"]["breaking"] >= 1
    finding = payload["findings"][0]
    assert finding["constraint"] == "enum"
    assert finding["sample"]["newResponse"]["body"] == "c"


def test_review_endpoint_rejects_missing_paths():
    response = TestClient(app).post("/api/review", json={"old": {"openapi": "3.0.0"}, "new": {"openapi": "3.0.0"}})
    assert response.status_code == 422 or response.status_code == 400
