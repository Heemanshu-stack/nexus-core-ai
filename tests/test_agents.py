import pytest
from memory.session_manager import SessionManager
from agents.orchestrator import OrchestratorAgent
from agents.repo_searcher import RepoSearcherAgent
from agents.reviewer import ReviewerAgent
from agents.tester import TesterAgent
from agents.doc_writer import DocWriterAgent
from schemas.code_diff import CodeModification, FileDiff
from schemas.review_result import ReviewResult
from schemas.test_result import TestExecutionResult

def test_orchestrator_agent(tmp_path):
    sm = SessionManager(storage_dir=tmp_path)
    task_id = "test-agent-task-1"
    sm.create_session(task_id, "Build a helper module")
    
    orchestrator = OrchestratorAgent(sm)
    plan = orchestrator.plan_task(task_id, "Build a helper module")
    assert plan.task_id == task_id
    assert len(plan.steps) > 0
    assert plan.steps[0].assigned_agent == "RepoSearcherAgent"

def test_repo_searcher_agent(tmp_path):
    sm = SessionManager(storage_dir=tmp_path)
    task_id = "test-agent-task-2"
    sm.create_session(task_id, "Analyze repository")
    
    searcher = RepoSearcherAgent(sm)
    context = searcher.analyze_workspace(task_id, "Analyze repository")
    assert "file_count" in context
    assert "files" in context
    assert context["file_count"] > 0

def test_reviewer_agent_fallback(tmp_path):
    sm = SessionManager(storage_dir=tmp_path)
    task_id = "test-agent-task-3"
    sm.create_session(task_id, "Review code diff")
    
    reviewer = ReviewerAgent(sm)
    code_mod = CodeModification(
        task_id=task_id,
        explanation="Test code modification",
        file_diffs=[
            FileDiff(
                file_path="utils/calculator.py",
                action="MODIFY",
                original_code="",
                new_code="def add(a, b): return a + b",
                unified_diff=""
            )
        ]
    )
    result = reviewer.review_code(task_id, code_mod)
    assert result.quality_score >= 0
    assert isinstance(result.is_approved, bool)

def test_tester_agent(tmp_path):
    sm = SessionManager(storage_dir=tmp_path)
    task_id = "test-agent-task-4"
    sm.create_session(task_id, "Run tests")
    
    tester = TesterAgent(sm)
    code_mod = CodeModification(
        task_id=task_id,
        explanation="Test verification",
        file_diffs=[]
    )
    test_res = tester.run_validation(task_id, code_mod)
    assert test_res.total_tests >= 1
    assert test_res.passed_count >= 0

def test_doc_writer_agent(tmp_path):
    sm = SessionManager(storage_dir=tmp_path)
    task_id = "test-agent-task-5"
    sm.create_session(task_id, "Write release documentation")
    
    doc_writer = DocWriterAgent(sm)
    code_mod = CodeModification(task_id=task_id, explanation="Added feature", file_diffs=[])
    review_res = ReviewResult(is_approved=True, quality_score=98, summary="Passed audit", issues=[])
    test_res = TestExecutionResult(all_passed=True, total_tests=2, passed_count=2, failed_count=0, error_summary="", generated_test_code="", test_file_path="")
    
    pr_res = doc_writer.finalize_release(task_id, "Write release documentation", code_mod, review_res, test_res)
    assert pr_res["success"] is True
    assert "pr_url" in pr_res
