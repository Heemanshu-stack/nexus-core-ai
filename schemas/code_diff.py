from typing import List, Optional
from pydantic import BaseModel, Field

class FileDiff(BaseModel):
    file_path: str = Field(description="Relative path of the target file")
    action: str = Field(description="CREATE, MODIFY, or DELETE")
    original_code: Optional[str] = Field(default="", description="Original code block if modifying")
    new_code: str = Field(description="New or modified code block")
    unified_diff: Optional[str] = Field(default="", description="Unified git-style diff text")

class CodeModification(BaseModel):
    task_id: str
    explanation: str = Field(description="Rationale for the code modifications")
    file_diffs: List[FileDiff] = Field(description="List of file changes to apply")
    dependencies_added: List[str] = Field(default_factory=list, description="New package dependencies if required")
