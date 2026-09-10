import os
import requests
from typing import Dict, Any, Optional

class GitHubTool:
    """Tool for fetching GitHub issues, commits, branches, and creating pull requests."""

    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("GITHUB_TOKEN", "")

    def fetch_issue(self, repo: str, issue_number: int) -> Dict[str, Any]:
        """Fetches issue details from GitHub API or returns simulated issue if unauthenticated."""
        if not self.token:
            return {
                "issue_number": issue_number,
                "title": f"Feature Request #{issue_number}: Enhance auth security and add pytest coverage",
                "body": "Please add rate limiting, input validation, and unit tests to the authentication module.",
                "state": "open",
                "author": "dev-lead",
                "mode": "mock_mode"
            }
        
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github.v3+json"}
        url = f"https://api.github.com/repos/{repo}/issues/{issue_number}"
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                return {
                    "issue_number": data.get("number"),
                    "title": data.get("title"),
                    "body": data.get("body"),
                    "state": data.get("state"),
                    "author": data.get("user", {}).get("login"),
                    "mode": "live_api"
                }
        except Exception:
            pass

        return {
            "issue_number": issue_number,
            "title": f"Issue #{issue_number}",
            "body": "Failed to reach GitHub API. Operating in fallback mode.",
            "state": "open"
        }

    def create_pull_request(self, repo: str, title: str, body: str, head_branch: str, base_branch: str = "main") -> Dict[str, Any]:
        """Submits a Pull Request to GitHub or returns simulated PR object."""
        if not self.token:
            return {
                "success": True,
                "pr_url": f"https://github.com/{repo if repo else 'local-repo/capstone'}/pull/42",
                "pr_number": 42,
                "title": title,
                "status": "Created (Mock Mode - GitHub token missing)"
            }
        
        headers = {"Authorization": f"Bearer {self.token}", "Accept": "application/vnd.github.v3+json"}
        url = f"https://api.github.com/repos/{repo}/pulls"
        payload = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch
        }
        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=10)
            if resp.status_code in (200, 201):
                data = resp.json()
                return {
                    "success": True,
                    "pr_url": data.get("html_url"),
                    "pr_number": data.get("number"),
                    "title": title,
                    "status": "Created via Live GitHub API"
                }
            else:
                return {
                    "success": False,
                    "error": resp.json().get("message", "API request failed"),
                    "status_code": resp.status_code
                }
        except Exception as e:
            return {"success": False, "error": str(e)}
