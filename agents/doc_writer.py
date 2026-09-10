from typing import Dict, Any
from schemas.code_diff import CodeModification
from schemas.review_result import ReviewResult
from schemas.test_result import TestExecutionResult
from tools.github_tool import GitHubTool
from tools.memory_tool import MemoryTool
from memory.session_manager import SessionManager

class DocWriterAgent:
    """Agent #6: Documentation & Release Agent.
    Generates technical documentation, crafts GitHub PR summaries, and updates long-term memory.
    """

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager
        self.github_tool = GitHubTool()
        self.memory_tool = MemoryTool()

    def finalize_release(
        self,
        task_id: str,
        prompt: str,
        code_mod: CodeModification,
        review_result: ReviewResult,
        test_result: TestExecutionResult
    ) -> Dict[str, Any]:
        self.session_mgr.record_handoff(
            task_id,
            from_agent="HumanApprovalGate",
            to_agent="DocWriterAgent",
            reason="Generate release documentation, record session memory, and open Pull Request"
        )
        self.session_mgr.add_log(task_id, "DocWriterAgent", "Generating PR description and release notes...")

        pr_title = f"feat(capstone): {prompt[:60]}"
        pr_body = (
            f"## Multi-Agent Execution Summary\n\n"
            f"**Original Task**: {prompt}\n\n"
            f"### 🛠️ Changes Implemented\n"
            f"{code_mod.explanation}\n\n"
            f"### 🔍 Code Audit & Quality Review\n"
            f"- **Quality Score**: `{review_result.quality_score}/100`\n"
            f"- **Status**: `Approved`\n"
            f"- **Summary**: {review_result.summary}\n\n"
            f"### 🧪 Test Suite Results\n"
            f"- **Total Tests**: `{test_result.total_tests}`\n"
            f"- **Passed**: `{test_result.passed_count}`\n"
            f"- **Failed**: `{test_result.failed_count}`\n\n"
            f"*Generated automatically by AI Software Engineering Assistant (Capstone Final)*"
        )

        # Submit PR (real API if GITHUB_TOKEN set, or realistic mock)
        pr_result = self.github_tool.create_pull_request(
            repo="local-workspace/capstone",
            title=pr_title,
            body=pr_body,
            head_branch=f"feature/{task_id}"
        )

        # Save to memory store
        self.memory_tool.add_note(
            tag="RELEASE",
            note=f"Task {task_id}: {prompt} | PR: {pr_result.get('pr_url')}"
        )

        self.session_mgr.add_log(
            task_id,
            "DocWriterAgent",
            f"Pull Request created successfully! URL: {pr_result.get('pr_url')}"
        )

        session = self.session_mgr.get_session(task_id)
        if session:
            session["pr_result"] = pr_result
            session["status"] = "COMPLETED"
            self.session_mgr.save_session(task_id, session)

        return pr_result
