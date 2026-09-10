import json
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

class SessionManager:
    """Manages multi-agent execution state, logs, and human approval checkpoints."""

    def __init__(self, storage_dir: Path = None):
        self._in_memory: Dict[str, Any] = {}
        try:
            self.storage_dir = storage_dir or Path.cwd() / "memory" / "sessions"
            self.storage_dir.mkdir(parents=True, exist_ok=True)
        except Exception:
            self.storage_dir = None

    def create_session(self, task_id: str, prompt: str) -> Dict[str, Any]:
        session_data = {
            "task_id": task_id,
            "prompt": prompt,
            "created_at": time.time(),
            "status": "INITIALIZED", # INITIALIZED, RUNNING, WAITING_HUMAN_APPROVAL, APPROVED, REJECTED, COMPLETED, FAILED
            "current_agent": "Orchestrator",
            "handoff_history": [],
            "logs": [],
            "task_plan": None,
            "code_diff": None,
            "review_result": None,
            "test_result": None,
            "pr_result": None
        }
        self.save_session(task_id, session_data)
        return session_data

    def get_session(self, task_id: str) -> Optional[Dict[str, Any]]:
        if task_id in self._in_memory:
            return self._in_memory[task_id]
        if not self.storage_dir:
            return None
        file_path = self.storage_dir / f"{task_id}.json"
        if not file_path.exists():
            return None
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._in_memory[task_id] = data
                return data
        except Exception:
            return None

    def save_session(self, task_id: str, session_data: Dict[str, Any]):
        self._in_memory[task_id] = session_data
        if not self.storage_dir:
            return
        file_path = self.storage_dir / f"{task_id}.json"
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(session_data, f, indent=2)
        except Exception:
            pass

    def add_log(self, task_id: str, agent_name: str, message: str, level: str = "INFO"):
        session = self.get_session(task_id)
        if session:
            entry = {
                "timestamp": time.strftime("%H:%M:%S"),
                "agent": agent_name,
                "message": message,
                "level": level
            }
            session["logs"].append(entry)
            session["current_agent"] = agent_name
            self.save_session(task_id, session)

    def record_handoff(self, task_id: str, from_agent: str, to_agent: str, reason: str):
        session = self.get_session(task_id)
        if session:
            handoff = {
                "timestamp": time.strftime("%H:%M:%S"),
                "from": from_agent,
                "to": to_agent,
                "reason": reason
            }
            session["handoff_history"].append(handoff)
            session["current_agent"] = to_agent
            self.save_session(task_id, session)
