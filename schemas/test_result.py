from typing import List, Optional
from pydantic import BaseModel, Field

class TestExecutionResult(BaseModel):
    __test__ = False
    all_passed: bool = Field(description="True if all unit tests passed")
    total_tests: int = Field(description="Total tests executed")
    passed_count: int = Field(description="Number of passed tests")
    failed_count: int = Field(description="Number of failed tests")
    error_summary: Optional[str] = Field(default="", description="Summary of failures/stack traces if any")
    generated_test_code: Optional[str] = Field(default="", description="Generated pytest code")
    test_file_path: Optional[str] = Field(default="", description="Path of created test file")
