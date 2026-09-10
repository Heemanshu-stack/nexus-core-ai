import os
import uuid
import uvicorn
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel

from config import HOST, PORT, WORKSPACE_DIR, MODEL_NAME, VERIFIED_MODELS, get_hardware_device_info
from memory.session_manager import SessionManager
from agents.orchestrator import OrchestratorAgent
from agents.repo_searcher import RepoSearcherAgent
from agents.coder import CoderAgent
from agents.reviewer import ReviewerAgent
from agents.tester import TesterAgent
from agents.doc_writer import DocWriterAgent
from tools.file_editor_tool import FileEditorTool
from tools.memory_tool import MemoryTool
from services.model_trainer import ModelTrainerService
from services.auth_service import AuthManager

from utils.calculator import add, subtract, multiply, divide, power, square_root, factorial, percentage, modulus

app = FastAPI(
    title="Nexus Core AI - Capstone Executive Platform",
    description="Autonomous Multi-Agent Software Engineering Assistant",
    version="1.0.0"
)

session_mgr = SessionManager()
editor_tool = FileEditorTool(root_dir=WORKSPACE_DIR)
memory_tool = MemoryTool()
auth_mgr = AuthManager()

STATIC_DIR = Path(__file__).resolve().parent / "static"
try:
    STATIC_DIR.mkdir(parents=True, exist_ok=True)
except Exception:
    pass

if STATIC_DIR.exists():
    try:
        app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
    except Exception:
        pass

class TaskRequest(BaseModel):
    prompt: str

class CalcRequest(BaseModel):
    operation: str
    a: float
    b: float = 0.0

class ModelSwitchRequest(BaseModel):
    model_name: str

class ModelTrainRequest(BaseModel):
    framework: str = "pytorch"
    epochs: int = 10
    batch_size: int = 32
    learning_rate: float = 0.001
    num_samples: int = 1000

class AuthTokenRequest(BaseModel):
    username: str
    role: str = "developer"

class AuthValidateRequest(BaseModel):
    token: str

def run_agent_pipeline(task_id: str, prompt: str):
    """Executes the multi-agent handoff pipeline up to Human Approval Gate."""
    try:
        session_mgr.add_log(task_id, "System", "Starting multi-agent engineering workflow...")
        
        # 1. Orchestrator
        orchestrator = OrchestratorAgent(session_mgr)
        plan = orchestrator.plan_task(task_id, prompt)
        
        # 2. Repo Intelligence
        repo_searcher = RepoSearcherAgent(session_mgr)
        repo_context = repo_searcher.analyze_workspace(task_id, prompt)
        
        # 3. Coder Agent
        coder = CoderAgent(session_mgr)
        code_mod = coder.generate_code(task_id, prompt, repo_context)
        
        # 4. Reviewer Agent
        reviewer = ReviewerAgent(session_mgr)
        review_res = reviewer.review_code(task_id, code_mod)
        
        # 5. Tester Agent
        tester = TesterAgent(session_mgr)
        test_res = tester.run_validation(task_id, code_mod)
        
        # Pause at Human Approval Gate
        session = session_mgr.get_session(task_id)
        if session:
            session["status"] = "WAITING_HUMAN_APPROVAL"
            session_mgr.record_handoff(
                task_id,
                from_agent="TesterAgent",
                to_agent="HumanApprovalGate",
                reason="Waiting for developer review and confirmation before applying file diffs"
            )
            session_mgr.add_log(task_id, "HumanApprovalGate", "Code diff ready for human review and approval.")
            session_mgr.save_session(task_id, session)

    except Exception as e:
        session_mgr.add_log(task_id, "System", f"Pipeline note: {str(e)}", level="WARNING")
        session = session_mgr.get_session(task_id)
        if session:
            session["status"] = "WAITING_HUMAN_APPROVAL"
            session_mgr.save_session(task_id, session)

@app.get("/", response_class=HTMLResponse)
def serve_dashboard():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Nexus Core AI Executive Engineering Platform</h1>")

@app.get("/calculator", response_class=HTMLResponse)
def serve_calculator():
    calc_file = STATIC_DIR / "calculator.html"
    if not calc_file.exists():
        calc_file = STATIC_DIR / "scientific_calculator.html"
    if calc_file.exists():
        with open(calc_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Calculator web page not found.</h1>", status_code=404)

@app.get("/snake", response_class=HTMLResponse)
def serve_snake():
    snake_file = STATIC_DIR / "game_snake.html"
    if snake_file.exists():
        with open(snake_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Snake game web page not found.</h1>", status_code=404)

@app.get("/static/{file_path:path}")
def serve_static_file(file_path: str):
    target = STATIC_DIR / file_path
    if target.exists() and target.is_file():
        mime = "text/plain"
        if file_path.endswith(".css"): mime = "text/css"
        elif file_path.endswith(".js"): mime = "application/javascript"
        elif file_path.endswith(".html"): mime = "text/html"
        elif file_path.endswith(".png"): mime = "image/png"
        elif file_path.endswith(".jpg") or file_path.endswith(".jpeg"): mime = "image/jpeg"
        elif file_path.endswith(".svg"): mime = "image/svg+xml"
        
        with open(target, "rb") as f:
            return Response(content=f.read(), media_type=mime)
    raise HTTPException(status_code=404, detail="File not found")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.get("/api/models/list")
def get_model_list():
    import config
    hardware = get_hardware_device_info()
    return {
        "active_model": config.MODEL_NAME,
        "verified_models": VERIFIED_MODELS,
        "hardware": hardware
    }

@app.post("/api/models/switch")
def switch_model(req: ModelSwitchRequest):
    import config
    if req.model_name not in VERIFIED_MODELS:
        raise HTTPException(status_code=400, detail=f"Model '{req.model_name}' not in verified list: {VERIFIED_MODELS}")
    config.MODEL_NAME = req.model_name
    return {
        "success": True,
        "active_model": config.MODEL_NAME,
        "message": f"Successfully switched to {req.model_name}"
    }

@app.post("/api/auth/token")
def generate_auth_token(req: AuthTokenRequest):
    token = auth_mgr.generate_token(username=req.username, role=req.role)
    return {
        "success": True,
        "token": token,
        "username": req.username,
        "role": req.role
    }

@app.post("/api/auth/validate")
def validate_auth_token(req: AuthValidateRequest):
    user_info = auth_mgr.validate_token(req.token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return {
        "success": True,
        "user": user_info
    }

@app.post("/api/tasks")
def create_task(req: TaskRequest):
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    session_mgr.create_session(task_id, req.prompt)
    try:
        run_agent_pipeline(task_id, req.prompt)
    except Exception as e:
        session_mgr.add_log(task_id, "System", f"Pipeline error: {str(e)}")
        session = session_mgr.get_session(task_id)
        if session:
            session["status"] = "WAITING_HUMAN_APPROVAL"
            session_mgr.save_session(task_id, session)
    return {"task_id": task_id, "status": "WAITING_HUMAN_APPROVAL"}

@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str):
    session = session_mgr.get_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task not found")
    return session

@app.post("/api/tasks/{task_id}/approve")
def approve_task(task_id: str):
    session = session_mgr.get_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task not found")
    
    session["status"] = "APPROVED"
    session_mgr.add_log(task_id, "HumanApprovalGate", "Changes approved by human. Proceeding with patch application...")
    session_mgr.save_session(task_id, session)

    try:
        code_mod = session.get("code_diff")
        if code_mod and "file_diffs" in code_mod:
            for fd in code_mod["file_diffs"]:
                if "file_path" in fd and "new_code" in fd:
                    editor_tool.write_file(fd["file_path"], fd["new_code"])
                    session_mgr.add_log(task_id, "FileEditorTool", f"Patched file {fd['file_path']} successfully.")

        doc_writer = DocWriterAgent(session_mgr)
        doc_writer.create_pull_request(task_id, code_mod)

        session = session_mgr.get_session(task_id)
        if session:
            session["status"] = "COMPLETED"
            session_mgr.save_session(task_id, session)
    except Exception as e:
        session_mgr.add_log(task_id, "System", f"Post-approval note: {str(e)}", level="WARNING")
        session = session_mgr.get_session(task_id)
        if session:
            session["status"] = "COMPLETED"
            session_mgr.save_session(task_id, session)

    return {"task_id": task_id, "status": "COMPLETED"}

@app.post("/api/tasks/{task_id}/reject")
def reject_task(task_id: str):
    session = session_mgr.get_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task not found")

    session["status"] = "REJECTED"
    session_mgr.add_log(task_id, "HumanApprovalGate", "Changes rejected by human operator.")
    session_mgr.save_session(task_id, session)
    return {"task_id": task_id, "status": "REJECTED"}

@app.get("/api/memory")
def get_memory_state():
    return memory_tool.load_knowledge()

@app.post("/api/calculator")
def execute_calculator(req: CalcRequest):
    op = req.operation.lower()
    try:
        if op == "add": res = add(req.a, req.b)
        elif op == "subtract": res = subtract(req.a, req.b)
        elif op == "multiply": res = multiply(req.a, req.b)
        elif op == "divide": res = divide(req.a, req.b)
        elif op == "power": res = power(req.a, req.b)
        elif op == "square_root": res = square_root(req.a)
        elif op == "factorial": res = factorial(int(req.a))
        elif op == "percentage": res = percentage(req.a, req.b)
        elif op == "modulus": res = modulus(req.a, req.b)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operation: {op}")
        
        return {"operation": op, "a": req.a, "b": req.b, "result": res}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT, reload=True)


class DeleteResultRequest(BaseModel):
    file_path: str

@app.delete("/api/tasks/{task_id}/delete-result")
def delete_result(task_id: str, req: DeleteResultRequest):
    """Deletes the generated output file when user discards a result."""
    try:
        # Strip leading 'static/' prefix if present
        rel = req.file_path.replace("static/", "").lstrip("/")
        target = (STATIC_DIR / rel).resolve()
        static_resolved = STATIC_DIR.resolve()
        if static_resolved in target.parents and target.exists() and target.is_file():
            target.unlink()
            session = session_mgr.get_session(task_id)
            if session:
                session_mgr.add_log(task_id, "FileEditorTool", f"Deleted result: {req.file_path}")
            return {"deleted": True, "file_path": req.file_path}
        return {"deleted": False, "reason": "File not found or outside static/"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/calculate")
def calculate_alias(req: CalcRequest):
    return execute_calculator(req)
