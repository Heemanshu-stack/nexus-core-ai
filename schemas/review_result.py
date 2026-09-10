from typing import List
from pydantic import BaseModel, Field

class ReviewIssue(BaseModel):
    file_path: str = Field(description="File containing the issue")
    line_number: int = Field(default=0, description="Approximate line number")
    severity: str = Field(description="CRITICAL, WARNING, or INFO")
    category: str = Field(description="SECURITY, BUG, PERFORMANCE, STYLE, or BEST_PRACTICE")
    description: str = Field(description="Explanation of the issue found")
    suggestion: str = Field(description="Recommended fix or code snippet")

class ReviewResult(BaseModel):
    is_approved: bool = Field(description="True if code meets quality standards and can proceed to human approval")
    quality_score: int = Field(description="Quality score from 1 to 100")
    summary: str = Field(description="Overall review summary")
    issues: List[ReviewIssue] = Field(default_factory=list, description="List of identified issues")
