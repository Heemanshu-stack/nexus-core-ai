import pytest
from fastapi.testclient import TestClient
from main import app
from memory.session_manager import SessionManager

session_mgr = SessionManager()

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

def test_create_task_validation():
    response = client.post("/api/tasks", json={"prompt": ""})
    assert response.status_code == 400

def test_session_manager():
    task_id = "test-session-123"
    session = session_mgr.create_session(task_id, "Test prompt")
    assert session["task_id"] == task_id
    assert session["status"] == "INITIALIZED"
    
    fetched = session_mgr.get_session(task_id)
    assert fetched is not None
    assert fetched["prompt"] == "Test prompt"
