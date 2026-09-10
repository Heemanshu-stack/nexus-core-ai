"""Authentication & Security Module for Nexus Core AI Capstone Platform"""

import time
import secrets
from typing import Dict, Any, Optional

class AuthManager:
    """Manages API rate limits, user authentication tokens, and access validation."""
    
    def __init__(self, default_rate_limit: int = 60, window_seconds: int = 60):
        self.rate_limits: Dict[str, list] = {}
        self.active_tokens: Dict[str, dict] = {}
        self.default_rate_limit = default_rate_limit
        self.window_seconds = window_seconds

    def validate_user(self, username: str) -> bool:
        """Validates user credentials cleanly."""
        return bool(username and len(username) >= 3)

    def generate_token(self, username: str, role: str = "developer") -> str:
        """Generates a secure API token for authenticated sessions."""
        if not self.validate_user(username):
            raise ValueError("Invalid username. Must be at least 3 characters.")
        
        token = f"nexus_sk_{secrets.token_hex(16)}"
        self.active_tokens[token] = {
            "username": username,
            "role": role,
            "created_at": time.time()
        }
        return token

    def validate_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verifies an active session token."""
        return self.active_tokens.get(token)

    def check_rate_limit(self, client_id: str) -> Dict[str, Any]:
        """Enforces sliding-window rate limiting for incoming API calls."""
        now = time.time()
        timestamps = self.rate_limits.get(client_id, [])
        
        # Filter timestamps outside window
        timestamps = [t for t in timestamps if now - t < self.window_seconds]
        
        if len(timestamps) >= self.default_rate_limit:
            return {
                "allowed": False,
                "remaining": 0,
                "reset_in_seconds": int(self.window_seconds - (now - timestamps[0]))
            }
        
        timestamps.append(now)
        self.rate_limits[client_id] = timestamps
        return {
            "allowed": True,
            "remaining": self.default_rate_limit - len(timestamps),
            "reset_in_seconds": self.window_seconds
        }

