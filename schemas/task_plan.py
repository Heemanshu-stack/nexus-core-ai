from typing import List, Optional
from pydantic import BaseModel, Field

class TaskStep(BaseModel):
    step_number: int = Field(description="Sequential step index")
    assigned_agent: str = Field(description="Name of the sub-agent responsible for this step")
    action_summary: str = Field(description="Description of what action should be performed")
    target_files: List[str] = Field(default_factory=list, description="Files relevant to this step")

class TaskPlan(BaseModel):
    task_id: str = Field(description="Unique task identifier")
    original_prompt: str = Field(description="User prompt or GitHub issue description")
    summary: str = Field(description="High level summary of the engineering plan")
    steps: List[TaskStep] = Field(description="Breakdown of execution steps")
    estimated_complexity: str = Field(description="Low, Medium, or High")
