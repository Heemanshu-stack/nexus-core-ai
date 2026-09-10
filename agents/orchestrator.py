import json
from config import get_ai_client, MODEL_NAME, VERIFIED_MODELS
from schemas.task_plan import TaskPlan, TaskStep
from memory.session_manager import SessionManager

class OrchestratorAgent:
    """Agent #1: Requirements & Orchestrator Agent.
    Ingests task prompt / issue, analyzes goals, and generates structured execution plan.
    """

    def __init__(self, session_manager: SessionManager):
        self.session_mgr = session_manager

    def plan_task(self, task_id: str, prompt: str) -> TaskPlan:
        self.session_mgr.add_log(task_id, "OrchestratorAgent", f"Analyzing task requirements: '{prompt}'")
        
        system_prompt = (
            "You are the Lead Engineering Orchestrator Agent. "
            "Analyze the given software request or GitHub issue. "
            "Decompose it into sequential steps assigned to specialised sub-agents:\n"
            "- RepoSearcherAgent (Workspace search & AST parsing)\n"
            "- CoderAgent (Synthesizing code modifications)\n"
            "- ReviewerAgent (Security & quality audit)\n"
            "- TesterAgent (Writing & executing pytest tests)\n"
            "- DocWriterAgent (Generating documentation & PR summaries)\n\n"
            "Respond ONLY with a valid JSON matching this schema:\n"
            "{\n"
            '  "task_id": "...",\n'
            '  "original_prompt": "...",\n'
            '  "summary": "High level plan summary",\n'
            '  "estimated_complexity": "Low|Medium|High",\n'
            '  "steps": [\n'
            '    {"step_number": 1, "assigned_agent": "RepoSearcherAgent", "action_summary": "...", "target_files": ["..."]}\n'
            '  ]\n'
            "}"
        )

        user_content = f"Task ID: {task_id}\nPrompt: {prompt}"

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
                self.session_mgr.add_log(task_id, "OrchestratorAgent", f"Model '{m}' warning: {str(req_err)}", level="WARNING")

        try:
            if not response or not response.choices:
                raise RuntimeError("All LLM models in orchestrator chain failed.")
            raw_json = response.choices[0].message.content
            plan_data = json.loads(raw_json)
            plan = TaskPlan(**plan_data)
        except Exception as e:
            # Fallback structured plan if JSON parsing fails
            plan = TaskPlan(
                task_id=task_id,
                original_prompt=prompt,
                summary=f"Automated engineering task for: {prompt}",
                estimated_complexity="Medium",
                steps=[
                    TaskStep(step_number=1, assigned_agent="RepoSearcherAgent", action_summary="Scan workspace for target files", target_files=["main.py"]),
                    TaskStep(step_number=2, assigned_agent="CoderAgent", action_summary="Synthesize code fixes and tests", target_files=["main.py"]),
                    TaskStep(step_number=3, assigned_agent="ReviewerAgent", action_summary="Review synthesized diff", target_files=["main.py"]),
                    TaskStep(step_number=4, assigned_agent="TesterAgent", action_summary="Execute pytest validation suite", target_files=["tests/test_main.py"]),
                    TaskStep(step_number=5, assigned_agent="DocWriterAgent", action_summary="Write documentation & PR summary", target_files=["README.md"])
                ]
            )

        self.session_mgr.add_log(task_id, "OrchestratorAgent", f"Plan generated with {len(plan.steps)} steps.")
        session = self.session_mgr.get_session(task_id)
        if session:
            session["task_plan"] = plan.model_dump()
            self.session_mgr.save_session(task_id, session)

        return plan
