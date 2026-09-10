import json
from pathlib import Path
from typing import Dict, Any, List, Optional

class MemoryTool:
    """Tool for session state management and codebase knowledge storage."""

    def __init__(self, storage_dir: Path = None):
        self.storage_dir = storage_dir or Path.cwd() / "memory" / "store"
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.kb_file = self.storage_dir / "knowledge_base.json"
        if not self.kb_file.exists():
            self.save_knowledge({"version": "1.0", "notes": [], "sessions": []})

    def load_knowledge(self) -> Dict[str, Any]:
        try:
            with open(self.kb_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {"version": "1.0", "notes": [], "sessions": []}

    def save_knowledge(self, data: Dict[str, Any]):
        try:
            with open(self.kb_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception:
            pass

    def add_note(self, tag: str, note: str):
        kb = self.load_knowledge()
        kb["notes"].append({"tag": tag, "content": note})
        self.save_knowledge(kb)

    def get_notes(self, tag: Optional[str] = None) -> List[Dict[str, Any]]:
        kb = self.load_knowledge()
        notes = kb.get("notes", [])
        if tag:
            return [n for n in notes if n.get("tag") == tag]
        return notes
