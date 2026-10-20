export interface TestCase {
  id?: string;
  name: string;
  input_prompt: string;
  expected_output: string;
  evaluation_method: string;
  created_at?: string;
}

export interface TestResult {
  id: string;
  run_id: string;
  test_case_id: string;
  model_id: string;
  input_prompt: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  evaluation_method: string;
  error_details?: string | null;
  latency_ms?: number;
  tokens_used?: number;
  is_simulation?: boolean;
  execution_tier?: 'simulation' | 'local' | 'cloud';
  created_at: string;
}

export interface EvaluationRun {
  id: string;
  experiment_id: string;
  model_id: string;
  model_name: string;
  provider_type?: string;
  is_simulation?: boolean;
  execution_tier?: 'simulation' | 'local' | 'cloud';
  snapshot_json?: string;
  total_tests: number;
  passed_tests: number;
  pass_rate: number;
  status: string;
  notes?: string | null;
  created_at: string;
  results: TestResult[];
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  category: string;
  target_model: string;
  evaluation_criteria: string;
  pass_threshold: number;
  status: 'Draft' | 'Complete' | 'Needs review';
  created_at: string;
  updated_at: string;
  test_cases: TestCase[];
  latest_run?: EvaluationRun | null;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: string;
  provider_type?: string;
  provider_label?: string;
  execution_tier?: 'simulation' | 'local' | 'cloud';
  latency_ms: number;
  is_real?: boolean;
  is_simulation?: boolean;
  description: string;
}

export interface ComparisonResponse {
  experiment_id: string;
  model_a: EvaluationRun | null;
  model_b: EvaluationRun | null;
  results_a: TestResult[];
  results_b: TestResult[];
}

export interface OracleInsight {
  title: string;
  category: string;
  affected_count: number;
  evidence: string;
  hypothesis: string;
  recommendation: string;
}

export interface OracleConsultResult {
  title: string;
  analysis: string;
  recommendation: string;
  empirical_insights: OracleInsight[];
}

export interface ProviderSetting {
  id: string;
  name: string;
  provider_type: string;
  api_key_masked: string;
  has_api_key: boolean;
  base_url: string;
  is_enabled: boolean;
  models: string[];
  updated_at?: string;
}

export interface TestConnectionResult {
  success: boolean;
  message: string;
  latency_ms?: number;
  output_preview?: string;
}

export interface SingleTestResult {
  passed: boolean;
  actual_output: string;
  latency_ms: number;
  tokens: number;
  evaluation_method: string;
  error_details?: string | null;
  is_mock: boolean;
  is_simulation?: boolean;
  execution_tier?: 'simulation' | 'local' | 'cloud';
  provider_type?: string;
}

export interface GeneratedCase {
  name: string;
  input_prompt: string;
  expected_output: string;
  evaluation_method: string;
}

export interface AiSynthesisResult {
  title: string;
  analysis: string;
  recommendation: string;
  root_causes: string[];
  action_steps: string[];
  model_used: string;
}

export interface BackupRecord {
  filename: string;
  path: string;
  size_bytes: number;
  created_at: string;
  is_valid: boolean;
}

export interface BackupListResult {
  backups: BackupRecord[];
  total_count: number;
}
