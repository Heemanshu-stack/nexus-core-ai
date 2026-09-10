from typing import Dict, Any
from tools.code_search_tool import CodeSearchTool
from memory.session_manager import SessionManager

class RepoSearcherAgent:
    """Agent #2: Repository Intelligence & Code Search Agent.
    Scans workspace directory, computes codebase context, and parses AST definitions.
    """

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager
        self.search_tool = CodeSearchTool()

    def analyze_workspace(self, task_id: str, prompt: str) -> Dict[str, Any]:
        self.session_mgr.record_handoff(
            task_id,
            from_agent="OrchestratorAgent",
            to_agent="RepoSearcherAgent",
            reason="Investigate workspace code structure and AST definitions"
        )
        self.session_mgr.add_log(task_id, "RepoSearcherAgent", "Scanning workspace directory and parsing AST...")

        files = self.search_tool.list_files()
        ast_summary = []
        
        # Analyze AST for top Python files
        for rel_path in files[:5]:
            ast_info = self.search_tool.parse_ast_definitions(rel_path)
            if "error" not in ast_info:
                ast_summary.append(ast_info)

        search_results = self.search_tool.search_text(prompt.split()[0] if prompt else "import")

        context = {
            "file_count": len(files),
            "files": files,
            "ast_summary": ast_summary,
            "search_hits": search_results
        }

        self.session_mgr.add_log(
            task_id,
            "RepoSearcherAgent",
            f"Found {len(files)} source files. Analyzed AST for {len(ast_summary)} modules."
        )

        return context
