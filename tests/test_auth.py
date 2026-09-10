import pytest
from services.auth_service import AuthManager

def test_auth_validate_user():
    mgr = AuthManager()
    assert mgr.validate_user("alice") is True
    assert mgr.validate_user("ab") is False
    assert mgr.validate_user("") is False

def test_auth_token_generation_and_validation():
    mgr = AuthManager()
    token = mgr.generate_token("dev_user", role="admin")
    assert token.startswith("nexus_sk_")
    
    data = mgr.validate_token(token)
    assert data is not None
    assert data["username"] == "dev_user"
    assert data["role"] == "admin"

def test_auth_invalid_token():
    mgr = AuthManager()
    assert mgr.validate_token("invalid_token_123") is None

def test_auth_rate_limiting():
    mgr = AuthManager(default_rate_limit=3, window_seconds=60)
    client_ip = "192.168.1.100"
    
    res1 = mgr.check_rate_limit(client_ip)
    assert res1["allowed"] is True
    assert res1["remaining"] == 2
    
    res2 = mgr.check_rate_limit(client_ip)
    assert res2["allowed"] is True
    assert res2["remaining"] == 1

    res3 = mgr.check_rate_limit(client_ip)
    assert res3["allowed"] is True
    assert res3["remaining"] == 0

    res4 = mgr.check_rate_limit(client_ip)
    assert res4["allowed"] is False
    assert res4["remaining"] == 0
