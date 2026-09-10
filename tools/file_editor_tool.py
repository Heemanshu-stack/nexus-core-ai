import difflib
from pathlib import Path
from typing import Dict, Any, Optional

class FileEditorTool:
    """Tool for reading files, generating unified diffs, and applying file edits safely within workspace."""

    def __init__(self, root_dir: Path = None):
        self.root_dir = (root_dir or Path.cwd()).resolve()

    def _resolve_path(self, rel_path: str) -> Path:
        """Resolves relative file path safely to prevent C:\\ root path jumps."""
        clean = rel_path.strip().lstrip("/").lstrip("\\")
        target = (self.root_dir / clean).resolve()
        
        # Check if target resolves inside root_dir
        if str(target).startswith(str(self.root_dir)):
            return target
        
        # If rel_path is an absolute path already inside root_dir
        abs_p = Path(rel_path).resolve()
        if str(abs_p).startswith(str(self.root_dir)):
            return abs_p
            
        return target

    def read_file(self, rel_path: str) -> Optional[str]:
        """Reads file contents from disk."""
        full_path = self._resolve_path(rel_path)
        if not full_path.exists() or full_path.is_dir():
            return None
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                return f.read()
        except Exception:
            return None

    def generate_unified_diff(self, rel_path: str, new_content: str) -> str:
        """Generates a colorable unified git-style diff string between current disk content and proposed code."""
        old_content = self.read_file(rel_path) or ""
        new_content = new_content or ""
        old_lines = old_content.splitlines(keepends=True)
        new_lines = new_content.splitlines(keepends=True)

        diff = difflib.unified_diff(
            old_lines,
            new_lines,
            fromfile=f"a/{rel_path}",
            tofile=f"b/{rel_path}",
            lineterm="\n"
        )
        return "".join(diff)

    def write_file(self, rel_path: str, content: str) -> Dict[str, Any]:
        """Writes new content to file on disk, creating parent directories if necessary."""
        full_path = self._resolve_path(rel_path)
        try:
            full_path.parent.mkdir(parents=True, exist_ok=True)
            with open(full_path, "w", encoding="utf-8") as f:
                f.write(content)
            return {
                "success": True,
                "file": str(full_path),
                "message": f"Successfully wrote to {rel_path}"
            }
        except Exception as e:
            return {
                "success": False,
                "file": rel_path,
                "error": str(e)
            }
