import os
import uuid
import uvicorn
from pathlib import Path
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
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
    title="AI Software Engineering Assistant - Capstone Final",
    description="Multi-agent executive engineering platform built with OpenAI Agents SDK & Groq",
    version="1.0.0"
)

# Initialize Session Manager & Tools
session_mgr = SessionManager()
editor_tool = FileEditorTool(root_dir=WORKSPACE_DIR)
memory_tool = MemoryTool()
auth_mgr = AuthManager()

# Mount Static Files for Dashboard UI
STATIC_DIR = Path(__file__).resolve().parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

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
        session_mgr.add_log(task_id, "System", f"Pipeline error: {str(e)}", level="ERROR")
        session = session_mgr.get_session(task_id)
        if session:
            session["status"] = "FAILED"
            session_mgr.save_session(task_id, session)

@app.get("/")
def serve_dashboard():
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return JSONResponse({"message": "AI Software Engineering Assistant API is active."})

@app.get("/calculator")
def serve_calculator():
    calc_file = STATIC_DIR / "calculator.html"
    if not calc_file.exists():
        calc_file = STATIC_DIR / "scientific_calculator.html"
    if calc_file.exists():
        return FileResponse(calc_file)
    return JSONResponse({"message": "Calculator web page not found."}, status_code=404)

@app.get("/snake")
def serve_snake():
    snake_file = STATIC_DIR / "game_snake.html"
    if snake_file.exists():
        return FileResponse(snake_file)
    return JSONResponse({"message": "Snake game web page not found."}, status_code=404)

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/api/calculate")
def perform_calculation(req: CalcRequest):
    op = req.operation.lower()
    try:
        if op == "add":
            res = add(req.a, req.b)
        elif op == "subtract":
            res = subtract(req.a, req.b)
        elif op == "multiply":
            res = multiply(req.a, req.b)
        elif op == "divide":
            res = divide(req.a, req.b)
        elif op == "power":
            res = power(req.a, req.b)
        elif op in ("square_root", "sqrt"):
            res = square_root(req.a)
        elif op == "factorial":
            res = factorial(int(req.a))
        elif op == "percentage":
            res = percentage(req.a, req.b)
        elif op == "modulus":
            res = modulus(int(req.a), int(req.b))
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported operation '{op}'")
        return {"operation": op, "a": req.a, "b": req.b, "result": res}
    except ZeroDivisionError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tasks")
def create_task(req: TaskRequest, background_tasks: BackgroundTasks):
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="Task prompt cannot be empty.")
    
    task_id = f"task-{uuid.uuid4().hex[:8]}"
    session_mgr.create_session(task_id, req.prompt)
    
    # Run agent pipeline asynchronously in background task
    background_tasks.add_task(run_agent_pipeline, task_id, req.prompt)
    
    return {"task_id": task_id, "status": "PIPELINE_STARTED"}

@app.get("/api/tasks/{task_id}")
def get_task_status(task_id: str):
    session = session_mgr.get_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task session not found.")
    return session

@app.post("/api/tasks/{task_id}/approve")
def approve_task(task_id: str):
    session = session_mgr.get_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task session not found.")
    
    if session.get("status") != "WAITING_HUMAN_APPROVAL":
        raise HTTPException(status_code=400, detail=f"Task is in status '{session.get('status')}', not WAITING_HUMAN_APPROVAL.")

    # 1. Apply file diffs to disk
    code_diff = session.get("code_diff")
    if code_diff and "file_diffs" in code_diff:
        for fd in code_diff["file_diffs"]:
            file_p = Path(fd["file_path"])
            if not file_p.is_absolute():
                file_p = WORKSPACE_DIR / file_p
            editor_tool.write_file(str(file_p), fd["new_code"])
            session_mgr.add_log(task_id, "FileEditorTool", f"Applied file patch to '{fd['file_path']}'")

    # 2. Trigger Documentation & Release Agent
    from schemas.code_diff import CodeModification
    from schemas.review_result import ReviewResult
    from schemas.test_result import TestExecutionResult

    doc_writer = DocWriterAgent(session_mgr)
    pr_res = doc_writer.finalize_release(
        task_id,
        session["prompt"],
        CodeModification(**session["code_diff"]),
        ReviewResult(**session["review_result"]),
        TestExecutionResult(**session["test_result"])
    )

    session["status"] = "COMPLETED"
    session_mgr.save_session(task_id, session)

    return {"status": "APPROVED_AND_RELEASED", "pr_result": pr_res}

@app.post("/api/tasks/{task_id}/reject")
def reject_task(task_id: str):
    session = session_mgr.get_session(task_id)
    if not session:
        raise HTTPException(status_code=404, detail="Task session not found.")

    session["status"] = "REJECTED"
    session_mgr.add_log(task_id, "HumanApprovalGate", "User rejected proposed code diffs.", level="WARNING")
    session_mgr.save_session(task_id, session)

    return {"status": "REJECTED"}

@app.post("/api/auth/token")
def create_auth_token(req: AuthTokenRequest):
    try:
        token = auth_mgr.generate_token(req.username, req.role)
        return {"status": "SUCCESS", "token": token, "username": req.username, "role": req.role}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/auth/validate")
def validate_auth_token(req: AuthValidateRequest):
    data = auth_mgr.validate_token(req.token)
    if not data:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return {"status": "VALID", "token_data": data}

@app.get("/api/memory")
def get_memory_store():
    return memory_tool.load_knowledge()

@app.get("/api/stats")
def get_stats():
    kb = memory_tool.load_knowledge()
    notes_count = len(kb.get("notes", []))
    sessions_dir = session_mgr.storage_dir
    session_files = list(sessions_dir.glob("*.json")) if sessions_dir.exists() else []
    active_tasks = 0
    for sfile in session_files:
        sess = session_mgr.get_session(sfile.stem)
        if sess and sess.get("status") in ("INITIALIZED", "RUNNING", "WAITING_HUMAN_APPROVAL"):
            active_tasks += 1
            
    return JSONResponse(
        content={
            "active_tasks": active_tasks,
            "memory_notes_count": notes_count,
            "server_status": "online"
        },
        media_type="application/json"
    )

@app.get("/api/models/list")
def list_models_and_hardware():
    import config
    hardware = get_hardware_device_info()
    return {
        "current_model": config.MODEL_NAME,
        "available_models": VERIFIED_MODELS,
        "hardware": hardware
    }

@app.post("/api/models/switch")
def switch_model(req: ModelSwitchRequest):
    import config
    if req.model_name not in VERIFIED_MODELS:
        raise HTTPException(status_code=400, detail=f"Model '{req.model_name}' is not in verified list: {VERIFIED_MODELS}")
    config.MODEL_NAME = req.model_name
    os.environ["MODEL_NAME"] = req.model_name
    return {"status": "SUCCESS", "active_model": config.MODEL_NAME}

@app.post("/api/models/train")
def train_model(req: ModelTrainRequest):
    trainer = ModelTrainerService()
    try:
        if req.framework.lower() == "pytorch":
            res = trainer.train_pytorch_model(
                epochs=req.epochs,
                batch_size=req.batch_size,
                learning_rate=req.learning_rate,
                num_samples=req.num_samples
            )
        else:
            res = trainer.train_sklearn_model(
                num_samples=req.num_samples
            )
        
        acc_val = res.get('best_val_accuracy', res.get('test_accuracy'))
        memory_tool.add_note(
            tag="TRAINING",
            note=f"Trained {res.get('framework')} model on {res.get('device_used')} ({res.get('device_name')}) with accuracy {acc_val}%"
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    should_reload = os.getenv("UVICORN_RELOAD", "false").lower() in ("true", "1")
    uvicorn.run(
        "main:app",
        host=HOST,
        port=PORT,
        reload=should_reload,
        reload_excludes=["memory/*", "memory/sessions/*", "memory/store/*", "tests/*", ".pytest_cache/*", "*.json", "*.log"] if should_reload else None
    )