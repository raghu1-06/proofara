from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional

class TestCaseBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    input_prompt: str = Field(..., min_length=1)
    expected_output: str = Field(..., min_length=1)
    evaluation_method: str = Field(default="Exact match")

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseResponse(TestCaseBase):
    id: str
    experiment_id: str
    created_at: str

    model_config = ConfigDict(from_attributes=True)

class ExperimentBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    description: Optional[str] = Field(default="")
    category: str = Field(..., min_length=1)
    target_model: str = Field(default="Nova-7B")
    evaluation_criteria: str = Field(default="Exact match")
    pass_threshold: float = Field(default=80.0, ge=0.0, le=100.0)

class ExperimentCreate(ExperimentBase):
    test_cases: List[TestCaseCreate] = Field(default_factory=list)

class ExperimentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    target_model: Optional[str] = None
    evaluation_criteria: Optional[str] = None
    pass_threshold: Optional[float] = None
    status: Optional[str] = None
    test_cases: Optional[List[TestCaseCreate]] = None

class TestResultResponse(BaseModel):
    id: str
    run_id: str
    test_case_id: str
    model_id: str
    input_prompt: str
    expected_output: str
    actual_output: str
    passed: bool
    evaluation_method: str
    error_details: Optional[str] = None
    latency_ms: Optional[int] = 0
    tokens_used: Optional[int] = 0
    is_simulation: Optional[bool] = True
    execution_tier: Optional[str] = "simulation"
    created_at: str

    model_config = ConfigDict(from_attributes=True)

class EvaluationRunResponse(BaseModel):
    id: str
    experiment_id: str
    model_id: str
    model_name: str
    provider_type: Optional[str] = "builtin"
    is_simulation: Optional[bool] = True
    execution_tier: Optional[str] = "simulation"
    snapshot_json: Optional[str] = "{}"
    total_tests: int
    passed_tests: int
    pass_rate: float
    status: str
    notes: Optional[str] = None
    created_at: str
    results: List[TestResultResponse] = []

    model_config = ConfigDict(from_attributes=True)

class ExperimentResponse(ExperimentBase):
    id: str
    status: str
    created_at: str
    updated_at: str
    test_cases: List[TestCaseResponse] = []
    latest_run: Optional[EvaluationRunResponse] = None

    model_config = ConfigDict(from_attributes=True)

class RunExperimentRequest(BaseModel):
    model_id: str = Field(..., min_length=1)
    notes: Optional[str] = None

class OracleInsightResponse(BaseModel):
    title: str
    category: str
    affected_count: int
    evidence: str
    hypothesis: str
    recommendation: str

class OracleConsultRequest(BaseModel):
    topic: str
    model_id: Optional[str] = "All models"
    pattern: str = "instructions"
    evidence_notes: Optional[str] = ""

class OracleConsultResponse(BaseModel):
    title: str
    analysis: str
    recommendation: str
    empirical_insights: List[OracleInsightResponse] = []

# AI Providers & Live Execution Schemas
class ProviderSettingUpdate(BaseModel):
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    is_enabled: Optional[bool] = None
    models: Optional[List[str]] = None

class ProviderSettingResponse(BaseModel):
    id: str
    name: str
    provider_type: str
    api_key_masked: str
    has_api_key: bool
    base_url: Optional[str] = ""
    is_enabled: bool = False
    models: List[str] = []
    updated_at: Optional[str] = None

class TestConnectionRequest(BaseModel):
    provider_id: str
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model_name: Optional[str] = None

class TestConnectionResponse(BaseModel):
    success: bool
    message: str
    latency_ms: Optional[int] = None
    output_preview: Optional[str] = None

class SingleTestRequest(BaseModel):
    model_id: str
    input_prompt: str
    expected_output: str
    evaluation_method: str = "Exact match"

class SingleTestResponse(BaseModel):
    passed: bool
    actual_output: str
    latency_ms: int
    tokens: int
    evaluation_method: str
    error_details: Optional[str] = None
    is_mock: bool = False
    is_simulation: bool = False
    provider_type: Optional[str] = "builtin"
    execution_tier: Optional[str] = "simulation"

class GeneratedCase(BaseModel):
    name: str
    input_prompt: str
    expected_output: str
    evaluation_method: str

class GenerateCasesRequest(BaseModel):
    topic: str
    category: str = "Instruction following"
    count: int = 3

class GenerateCasesResponse(BaseModel):
    test_cases: List[GeneratedCase]

class AiSynthesisRequest(BaseModel):
    pattern: str = "instructions"
    focus_model: Optional[str] = None
    notes: Optional[str] = ""

class AiSynthesisResponse(BaseModel):
    title: str
    analysis: str
    recommendation: str
    root_causes: List[str]
    action_steps: List[str]
    model_used: str

# System Maintenance & Disaster Recovery Schemas
class BackupResponse(BaseModel):
    filename: str
    path: str
    size_bytes: int
    created_at: str
    is_valid: bool

class BackupListResponse(BaseModel):
    backups: List[BackupResponse]
    total_count: int

class BackupRestoreRequest(BaseModel):
    backup_filename: str

class BackupRestoreResponse(BaseModel):
    success: bool
    message: str
    stats: dict

class KeyRotationRequest(BaseModel):
    old_key: str
    new_key: str

class KeyRotationResponse(BaseModel):
    success: bool
    message: str
    rotated_count: int

# Authentication & Session Schemas
class AuthLoginRequest(BaseModel):
    key: str

class AuthResponse(BaseModel):
    authenticated: bool
    message: str

class AuthStatusResponse(BaseModel):
    auth_required: bool
    authenticated: bool
