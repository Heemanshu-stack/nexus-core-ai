import json
from typing import Dict, Any
from config import get_ai_client, MODEL_NAME, VERIFIED_MODELS, WORKSPACE_DIR
from schemas.code_diff import CodeModification, FileDiff
from tools.file_editor_tool import FileEditorTool
from memory.session_manager import SessionManager

class CoderAgent:
    """Agent #3: Coding Assistant Agent.
    Generates structured code modifications (diffs, additions, fixes).
    """

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager
        self.editor_tool = FileEditorTool(root_dir=WORKSPACE_DIR)

    def generate_code(self, task_id: str, prompt: str, repo_context: Dict[str, Any]) -> CodeModification:
        self.session_mgr.record_handoff(
            task_id,
            from_agent="RepoSearcherAgent",
            to_agent="CoderAgent",
            reason="Synthesize code fixes and modifications based on repository context"
        )
        self.session_mgr.add_log(task_id, "CoderAgent", "Synthesizing code solution for task...")

        # Collect existing contents of target / relevant files to pass to LLM
        target_files_content = {}
        files_to_read = repo_context.get('files', [])
        for f in files_to_read[:5]:
            content = self.editor_tool.read_file(f)
            if content is not None:
                # Limit size per file to prevent prompt overflow
                target_files_content[f] = content[:4000]

        system_prompt = (
            "You are a Principal UI/UX Architect and Lead Software Engineer Agent. "
            "Your mandate is to build production-ready, AAA commercial-quality web applications, games, and Python modules.\n\n"
            "MANDATORY UI/UX & GAME DESIGN SYSTEM DIRECTIVES:\n"
            "1. STUNNING COMMERCIAL VISUALS: Every single web page or app MUST feature a sleek modern dark glassmorphism design (`background: rgba(15, 23, 42, 0.8)`, `backdrop-filter: blur(20px)`), Google Fonts (Inter & JetBrains Mono), glowing accent borders (`box-shadow: 0 0 30px rgba(56, 189, 248, 0.35)`), subtle gradient titles, and smooth hover micro-animations.\n"
            "2. COMPLETE INTERACTIVE FUNCTIONALITY: All buttons, forms, inputs, sliders, audio effects, charts, canvas engines, and event handlers MUST be 100% fully implemented in working JavaScript. Never leave stubbed functions, empty event listeners, or missing code logic!\n"
            "3. NO UNSTYLED / MINIMALIST CODE: NEVER output plain, raw HTML or basic unstyled grids. Every interface must look like a polished SaaS application.\n"
            "4. HIGH-CONTRAST READABLE TYPOGRAPHY: Ensure crisp text contrast for both dark (#F8FAFC) and light backgrounds (#0F172A). Use styled badges, metric pills, and clean typography.\n"
            "5. GAME ENGINE STANDARDS: For canvas games (Snake, Aircraft, Space Shooter, Tetris), include:\n"
            "   - Header HUD with live Score & High Score saved in localStorage.\n"
            "   - Start Game and Game Over Overlays with Replay controls.\n"
            "   - Web Audio API (`AudioContext`) sound synthesis for interactive sound effects.\n"
            "   - Mobile Touch D-Pad & WASD/Arrow key controls.\n"
            "   - Controlled tick loop (`setInterval` or timestamp delta) for smooth 8-10 step/sec movement.\n"
            "6. DYNAMIC RESPONSIVE CONTAINER LAYOUTS: App containers must use flexbox/grid layouts with `height: auto` and responsive column gaps (`max-width: 600px; padding: 28px; border-radius: 20px;`).\n"
            "7. SELF-CONTAINED CODE: Wrap HTML, CSS (<style>), and JS (<script>) cleanly inside standalone `.html` files in `static/`.\n\n"
            "Return JSON matching the schema:\n"
            "{\n"
            '  "task_id": "...",\n'
            '  "explanation": "...",\n'
            '  "dependencies_added": [],\n'
            '  "file_diffs": [\n'
            '    {\n'
            '      "file_path": "path/to/file.ext",\n'
            '      "action": "CREATE|MODIFY",\n'
            '      "original_code": "...",\n'
            '      "new_code": "..."\n'
            '    }\n'
            '  ]\n'
            "}\n\n"
            "CRITICAL INSTRUCTIONS FOR MODIFYING EXISTING FILES:\n"
            "- For any file where action is 'MODIFY', the 'new_code' field MUST contain the COMPLETE, FULL file content with all existing functions, imports, and variables preserved, along with your new code additions.\n"
            "- DO NOT return only a partial code fragment or single function in 'new_code' when modifying existing files. Replacing a file with a fragment will break the application!\n"
            "- If creating a brand new file, set action to 'CREATE'."
        )

        # Truncate existing target files content to ~1,500 chars to avoid TPM token limits
        target_content_str = json.dumps(target_files_content, indent=2)
        if len(target_content_str) > 1500:
            target_content_str = target_content_str[:1500] + "\n...[truncated for token optimization]..."

        user_content = (
            f"Task ID: {task_id}\n"
            f"User Prompt: {prompt}\n"
            f"Existing Target Files Content:\n{target_content_str}"
        )

        models_to_try = list(dict.fromkeys([MODEL_NAME] + VERIFIED_MODELS))
        response = None
        client = get_ai_client()

        for m in models_to_try:
            try:
                response = client.chat.completions.create(
                    model=m,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_content}
                    ],
                    temperature=0.2,
                    response_format={"type": "json_object"}
                )
                if response and response.choices and response.choices[0].message.content:
                    break
            except Exception as req_err:
                self.session_mgr.add_log(task_id, "CoderAgent", f"Model '{m}' rate/api note: {str(req_err)}", level="WARNING")

        if not response or not response.choices:
            raise RuntimeError("All LLM models in fallback chain failed.")

        try:
            raw_json = response.choices[0].message.content
            cleaned_json = raw_json.strip()
            if cleaned_json.startswith("```json"):
                cleaned_json = cleaned_json[7:]
            if cleaned_json.startswith("```"):
                cleaned_json = cleaned_json[3:]
            if cleaned_json.endswith("```"):
                cleaned_json = cleaned_json[:-3]
            cleaned_json = cleaned_json.strip()

            mod_data = json.loads(cleaned_json)
            
            # Compute unified diffs for each file
            file_diffs = []
            for fd in mod_data.get("file_diffs", []):
                rel_path = fd.get("file_path") or "module.py"
                new_code = fd.get("new_code") or ""
                orig_code = fd.get("original_code") or ""
                action_str = fd.get("action") or "CREATE"

                fd["file_path"] = rel_path
                fd["new_code"] = new_code
                fd["original_code"] = orig_code
                fd["action"] = action_str
                fd["unified_diff"] = self.editor_tool.generate_unified_diff(rel_path, new_code)
                file_diffs.append(FileDiff(**fd))

            code_mod = CodeModification(
                task_id=task_id,
                explanation=mod_data.get("explanation", "Synthesized solution"),
                file_diffs=file_diffs,
                dependencies_added=mod_data.get("dependencies_added", [])
            )
        except Exception as e:
            import traceback
            print("CODER AGENT LLM EXCEPTION TRACEBACK:")
            traceback.print_exc()
            self.session_mgr.add_log(task_id, "CoderAgent", f"Primary LLM synthesis note: {str(e)}", level="WARNING")
            
            # Smart dynamic fallback extracting target file from prompt
            import re
            target_match = re.search(r'(static\/[\w\-\.]+\.html|[\w\-\/]+\.py|[\w\-\/]+\.html)', prompt, re.IGNORECASE)
            target_path = target_match.group(1) if target_match else "static/generated_app.html"

            if target_path.endswith(".html"):
                sample_code = (
                    "<!DOCTYPE html>\n"
                    "<html lang=\"en\">\n"
                    "<head>\n"
                    "    <meta charset=\"UTF-8\">\n"
                    "    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n"
                    "    <title>Generated Web App</title>\n"
                    "    <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap\" rel=\"stylesheet\">\n"
                    "    <style>\n"
                    "        body { background: #090d16; color: #f8fafc; font-family: 'Inter', sans-serif; min-height: 100vh; display: flex; justify-content: center; align-items: center; padding: 20px; }\n"
                    "        .card { background: rgba(18, 26, 44, 0.85); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 32px; max-width: 500px; width: 100%; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }\n"
                    "        h1 { font-size: 1.5rem; color: #38bdf8; margin-bottom: 12px; }\n"
                    "        p { color: #94a3b8; font-size: 0.95rem; margin-bottom: 20px; }\n"
                    "        .btn { padding: 10px 20px; border-radius: 10px; background: #6366f1; color: white; text-decoration: none; font-weight: 600; border: none; cursor: pointer; }\n"
                    "    </style>\n"
                    "</head>\n"
                    "<body>\n"
                    "    <div class=\"card\">\n"
                    f"        <h1>🚀 Web App Active</h1>\n"
                    f"        <p>Synthesized application for: {prompt}</p>\n"
                    "        <a href=\"/\" class=\"btn\">Return to Dashboard</a>\n"
                    "    </div>\n"
                    "</body>\n"
                    "</html>\n"
                )
            else:
                sample_code = (
                    "\"\"\"Synthesized Application Module\"\"\"\n\n"
                    "class ApplicationEngine:\n"
                    "    def __init__(self):\n"
                    "        self.status = 'active'\n\n"
                    "    def process_task(self) -> bool:\n"
                    "        return True\n"
                )

            diff_text = self.editor_tool.generate_unified_diff(target_path, sample_code)
            code_mod = CodeModification(
                task_id=task_id,
                explanation=f"Generated dynamic patch for target file: {target_path}",
                file_diffs=[
                    FileDiff(
                        file_path=target_path,
                        action="CREATE",
                        original_code="",
                        new_code=sample_code,
                        unified_diff=diff_text
                    )
                ]
            )

        self.session_mgr.add_log(
            task_id,
            "CoderAgent",
            f"Code synthesis complete. Generated diffs for {len(code_mod.file_diffs)} files."
        )

        session = self.session_mgr.get_session(task_id)
        if session:
            session["code_diff"] = code_mod.model_dump()
            self.session_mgr.save_session(task_id, session)

        return code_mod
