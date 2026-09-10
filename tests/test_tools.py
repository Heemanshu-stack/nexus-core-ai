import pytest
from pathlib import Path
from tools.code_search_tool import CodeSearchTool
from tools.file_editor_tool import FileEditorTool
from tools.github_tool import GitHubTool
from tools.memory_tool import MemoryTool
from tools.test_runner_tool import TestRunnerTool
from tools.web_search_tool import WebSearchTool

def test_code_search_tool():
    tool = CodeSearchTool()
    files = tool.list_files(".py")
    assert len(files) > 0
    assert "main.py" in files or "config.py" in files
    
    hits = tool.search_text("FastAPI")
    assert len(hits) >= 0

    ast_info = tool.parse_ast_definitions("config.py")
    assert "functions" in ast_info
    assert "imports" in ast_info

def test_file_editor_tool(tmp_path):
    editor = FileEditorTool(root_dir=tmp_path)
    res = editor.write_file("test_module.py", "def hello(): pass")
    assert res["success"] is True
    
    content = editor.read_file("test_module.py")
    assert content == "def hello(): pass"
    
    diff = editor.generate_unified_diff("test_module.py", "def hello(): return True")
    assert "-def hello(): pass" in diff
    assert "+def hello(): return True" in diff

def test_github_tool():
    gh = GitHubTool()
    issue = gh.fetch_issue("test/repo", 1)
    assert issue["issue_number"] == 1
    assert "title" in issue
    
    pr = gh.create_pull_request("test/repo", "Fix issue", "PR Body", "feature/1")
    assert pr["success"] is True
    assert "pr_url" in pr

def test_memory_tool(tmp_path):
    mem = MemoryTool(storage_dir=tmp_path)
    mem.add_note(tag="TEST", note="Sample note content")
    notes = mem.get_notes(tag="TEST")
    assert len(notes) == 1
    assert notes[0]["content"] == "Sample note content"

def test_test_runner_tool():
    runner = TestRunnerTool()
    res = runner.run_pytest("tests/test_text_parser.py")
    assert "success" in res
    assert res["exit_code"] == 0

def test_web_search_tool():
    ws = WebSearchTool()
    results = ws.search("Python FastAPI")
    assert len(results) > 0
    assert "title" in results[0]
    assert "url" in results[0]
