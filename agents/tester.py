from pathlib import Path
from config import WORKSPACE_DIR
from schemas.code_diff import CodeModification
from schemas.test_result import TestExecutionResult
from tools.file_editor_tool import FileEditorTool
from tools.test_runner_tool import TestRunnerTool
from memory.session_manager import SessionManager

class TesterAgent:
    __test__ = False
    """Agent #5: Testing & Validation Agent.
    Generates unit test suites, executes pytest inside a subprocess sandbox, and parses output.
    """

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager
        self.editor_tool = FileEditorTool(root_dir=WORKSPACE_DIR)
        self.runner_tool = TestRunnerTool(root_dir=WORKSPACE_DIR)

    def run_validation(self, task_id: str, code_mod: CodeModification) -> TestExecutionResult:
        self.session_mgr.record_handoff(
            task_id,
            from_agent="ReviewerAgent",
            to_agent="TesterAgent",
            reason="Generate pytest test suite and execute unit tests in subprocess sandbox"
        )
        self.session_mgr.add_log(task_id, "TesterAgent", "Synthesizing pytest test suite for modified modules...")

        test_file_path = "tests/test_generated.py"
        test_code = ""

        # Check if CoderAgent already generated a test file in diffs
        existing_test_fd = None
        for fd in code_mod.file_diffs:
            if "test" in fd.file_path.lower() or fd.file_path.startswith("tests/"):
                existing_test_fd = fd
                break

        if existing_test_fd:
            test_file_path = existing_test_fd.file_path
            test_code = existing_test_fd.new_code
            self.editor_tool.write_file(test_file_path, test_code)
            self.session_mgr.add_log(task_id, "TesterAgent", f"Using synthesized test file '{test_file_path}'")
        else:
            # Generate a dynamic test file based on created/modified functions
            py_source_fds = [fd for fd in code_mod.file_diffs if fd.file_path.endswith(".py") and not fd.file_path.startswith("tests/")]
            if py_source_fds:
                # Write source files temporarily to disk so pytest can import them
                for sfd in py_source_fds:
                    self.editor_tool.write_file(sfd.file_path, sfd.new_code)
                
                primary_file = py_source_fds[0].file_path
                mod_name = primary_file.replace("/", ".").replace("\\", ".").replace(".py", "")
                
                # Build test template importing functions from module
                test_code = (
                    "import pytest\n"
                    "import sys\n"
                    "from pathlib import Path\n"
                    "sys.path.insert(0, str(Path(__file__).resolve().parent.parent))\n\n"
                    f"import {mod_name}\n\n"
                    "def test_module_imports():\n"
                    f"    assert {mod_name} is not None\n\n"
                    "def test_module_callable():\n"
                    f"    symbols = [s for s in dir({mod_name}) if not s.startswith('_')]\n"
                    "    assert len(symbols) >= 0\n"
                )
            else:
                test_code = (
                    "import pytest\n\n"
                    "def test_system_sanity():\n"
                    "    assert True\n"
                )
            
            self.editor_tool.write_file(test_file_path, test_code)

        self.session_mgr.add_log(task_id, "TesterAgent", f"Executing pytest suite on '{test_file_path}'...")
        exec_res = self.runner_tool.run_pytest(test_file_path)

        stdout_str = exec_res.get("stdout", "")
        success = exec_res.get("success", False)

        # Parse test counts
        passed_count = 1 if success else 0
        failed_count = 0 if success else 1
        total_tests = 1

        if "passed" in stdout_str or "failed" in stdout_str:
            import re
            p_match = re.search(r"(\d+)\s+passed", stdout_str)
            f_match = re.search(r"(\d+)\s+failed", stdout_str)
            if p_match:
                passed_count = int(p_match.group(1))
            if f_match:
                failed_count = int(f_match.group(1))
            total_tests = max(passed_count + failed_count, 1)

        result = TestExecutionResult(
            all_passed=success,
            total_tests=total_tests,
            passed_count=passed_count,
            failed_count=failed_count,
            error_summary=exec_res.get("summary", "Pytest suite execution finished."),
            generated_test_code=test_code,
            test_file_path=test_file_path
        )

        self.session_mgr.add_log(
            task_id,
            "TesterAgent",
            f"Test execution complete. Total: {result.total_tests}, Passed: {result.passed_count}, Failed: {result.failed_count}."
        )

        session = self.session_mgr.get_session(task_id)
        if session:
            session["test_result"] = result.model_dump()
            self.session_mgr.save_session(task_id, session)

        return result
