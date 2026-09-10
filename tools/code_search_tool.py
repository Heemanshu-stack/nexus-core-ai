import os
import ast
from pathlib import Path
from typing import List, Dict, Any

class CodeSearchTool:
    """Tool for scanning workspace directory, searching files, and parsing AST."""

    def __init__(self, root_dir: Path = None):
        self.root_dir = root_dir or Path.cwd()

    def list_files(self, extension_filter: str = ".py") -> List[str]:
        """Returns relative paths of all relevant source files in the workspace."""
        file_list = []
        ignore_dirs = {".git", "__pycache__", "venv", ".venv", "node_modules", ".pytest_cache", ".gemini"}
        
        for root, dirs, files in os.walk(self.root_dir):
            dirs[:] = [d for d in dirs if d not in ignore_dirs]
            for file in files:
                if extension_filter is None or file.endswith(extension_filter):
                    full_path = Path(root) / file
                    rel_path = str(full_path.relative_to(self.root_dir)).replace("\\", "/")
                    file_list.append(rel_path)
        return file_list

    def search_text(self, query: str) -> List[Dict[str, Any]]:
        """Searches for a text pattern or symbol across all python files in the workspace."""
        results = []
        files = self.list_files()
        
        for rel_path in files:
            full_path = self.root_dir / rel_path
            try:
                with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                    for idx, line in enumerate(lines, 1):
                        if query.lower() in line.lower():
                            results.append({
                                "file": rel_path,
                                "line": idx,
                                "content": line.strip()
                            })
            except Exception:
                continue
        return results[:30]

    def parse_ast_definitions(self, rel_path: str) -> Dict[str, Any]:
        """Parses a Python file AST to extract class, function, and import definitions."""
        full_path = self.root_dir / rel_path
        if not full_path.exists():
            return {"error": f"File {rel_path} does not exist"}
        
        try:
            with open(full_path, "r", encoding="utf-8") as f:
                code = f.read()
            
            tree = ast.parse(code)
            functions = []
            classes = []
            imports = []

            for node in ast.iter_child_nodes(tree):
                if isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
                    functions.append({
                        "name": node.name,
                        "line": node.lineno,
                        "args": [a.arg for a in node.args.args]
                    })
                elif isinstance(node, ast.ClassDef):
                    methods = [n.name for n in node.body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
                    classes.append({
                        "name": node.name,
                        "line": node.lineno,
                        "methods": methods
                    })
                elif isinstance(node, ast.Import):
                    for alias in node.names:
                        imports.append(alias.name)
                elif isinstance(node, ast.ImportFrom):
                    imports.append(f"{node.module}")

            return {
                "file": rel_path,
                "classes": classes,
                "functions": functions,
                "imports": imports
            }
        except Exception as e:
            return {"file": rel_path, "error": str(e)}
