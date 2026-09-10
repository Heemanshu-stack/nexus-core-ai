import sys
import subprocess
from pathlib import Path
from typing import Dict, Any

class TestRunnerTool:
    __test__ = False
    """Tool for executing unit tests via pytest and running linters inside subprocess sandbox."""

    def __init__(self, root_dir: Path = None):
        self.root_dir = root_dir or Path.cwd()

    def run_pytest(self, test_path: str = "tests") -> Dict[str, Any]:
        """Executes pytest on the specified test target and returns structured execution metrics."""
        target = str(self.root_dir / test_path)
        
        # If specific test file target does not exist yet, search for tests dir
        if not Path(target).exists():
            target = str(self.root_dir)

        cmd = [sys.executable, "-m", "pytest", target, "-v", "--tb=short", "-p", "no:cacheprovider"]
        
        try:
            res = subprocess.run(
                cmd,
                cwd=str(self.root_dir),
                capture_output=True,
                text=True,
                timeout=30
            )
            stdout = res.stdout
            stderr = res.stderr
            all_passed = (res.returncode == 0)

            # Basic parsing of pytest output summary
            lines = stdout.splitlines()
            summary_line = lines[-1] if lines else ""

            return {
                "success": all_passed,
                "exit_code": res.returncode,
                "stdout": stdout[:3000],
                "stderr": stderr[:1000],
                "summary": summary_line
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": "Test execution timed out after 30 seconds.",
                "summary": "Timeout error"
            }
        except Exception as e:
            return {
                "success": False,
                "exit_code": -1,
                "stdout": "",
                "stderr": str(e),
                "summary": f"Failed to launch pytest: {str(e)}"
            }
