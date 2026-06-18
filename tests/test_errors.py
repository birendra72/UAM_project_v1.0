import pytest

def test_validation_error_handler(client):
    # Pass invalid/empty request body to register to trigger a validation error
    response = client.post("/api/auth/register", json={})
    assert response.status_code == 422
    data = response.json()
    assert data["error"] == "ValidationError"
    assert "detail" in data
    assert "issues" in data
