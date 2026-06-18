import pytest

def test_health_check(client):
    response = client.get("/api/health")
    # Health check should return 200 or 503 depending on local Redis/DB availability in the test env
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
    assert "database" in data
    assert "redis" in data
