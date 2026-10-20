import type {
  Experiment,
  ModelProfile,
  EvaluationRun,
  ComparisonResponse,
  OracleConsultResult,
  ProviderSetting,
  TestConnectionResult,
  SingleTestResult,
  GeneratedCase,
  AiSynthesisResult,
  BackupRecord,
  BackupListResult
} from '../types/empire';

const isViteDev = typeof window !== 'undefined' && window.location.port === '5173';
const API_BASE = import.meta.env.VITE_API_URL || (isViteDev ? 'http://localhost:8000/api' : '/api');

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'X-Empire-Client': 'web',
      ...options?.headers
    },
    ...options
  });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(errorBody.detail || `HTTP Error ${res.status}`);
  }
  return res.json();
}

export const EmpireApi = {
  getHealth: () => fetchJson<{ status: string; timestamp: string }>('/health'),

  getModels: () => fetchJson<ModelProfile[]>('/models'),

  getExperiments: (params?: { category?: string; status?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.category && params.category !== 'all') q.set('category', params.category);
    if (params?.status && params.status !== 'all') q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    const qs = q.toString() ? `?${q.toString()}` : '';
    return fetchJson<Experiment[]>(`/experiments${qs}`);
  },

  getExperiment: (id: string) => fetchJson<Experiment>(`/experiments/${id}`),

  createExperiment: (data: Partial<Experiment>) =>
    fetchJson<Experiment>('/experiments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateExperiment: (id: string, data: Partial<Experiment>) =>
    fetchJson<Experiment>(`/experiments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  deleteExperiment: (id: string) =>
    fetchJson<{ message: string; id: string }>(`/experiments/${id}`, {
      method: 'DELETE'
    }),

  runExperiment: (experimentId: string, modelId: string, notes?: string) =>
    fetchJson<EvaluationRun>(`/experiments/${experimentId}/run`, {
      method: 'POST',
      body: JSON.stringify({ model_id: modelId, notes })
    }),

  getRuns: (experimentId?: string) => {
    const qs = experimentId ? `?experiment_id=${experimentId}` : '';
    return fetchJson<EvaluationRun[]>(`/runs${qs}`);
  },

  compareModels: (experimentId: string, modelA = 'nova-7b', modelB = 'aegis-70b') =>
    fetchJson<ComparisonResponse>(`/compare?experiment_id=${experimentId}&model_a=${modelA}&model_b=${modelB}`),

  consultOracle: (payload: { topic: string; model_id?: string; pattern: string; evidence_notes?: string }) =>
    fetchJson<OracleConsultResult>('/oracle/consult', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),

  // AI Providers & Live Execution
  getProviders: () => fetchJson<ProviderSetting[]>('/providers'),

  updateProvider: (
    id: string,
    data: { api_key?: string; base_url?: string; is_enabled?: boolean; models?: string[] }
  ) =>
    fetchJson<ProviderSetting>(`/providers/${id}`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  testProvider: (data: { provider_id: string; api_key?: string; base_url?: string; model_name?: string }) =>
    fetchJson<TestConnectionResult>('/providers/test', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  testSingle: (data: { model_id: string; input_prompt: string; expected_output: string; evaluation_method?: string }) =>
    fetchJson<SingleTestResult>('/eval/test-single', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  generateCases: (data: { topic: string; category?: string; count?: number }) =>
    fetchJson<{ test_cases: GeneratedCase[] }>('/eval/generate-cases', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  aiOracleSynthesis: (data: { pattern?: string; focus_model?: string; notes?: string }) =>
    fetchJson<AiSynthesisResult>('/oracle/ai-synthesis', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Disaster Recovery & System Maintenance
  getBackups: () => fetchJson<BackupListResult>('/system/backups'),

  createBackup: () =>
    fetchJson<BackupRecord>('/system/backup', {
      method: 'POST'
    }),

  restoreBackup: (backupFilename: string) =>
    fetchJson<{ success: boolean; message: string; stats: Record<string, unknown> }>('/system/restore', {
      method: 'POST',
      body: JSON.stringify({ backup_filename: backupFilename })
    }),

  // Operator Authentication (Backend-Managed HttpOnly Session)
  login: (key: string) =>
    fetchJson<{ authenticated: boolean; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ key })
    }),

  logout: () =>
    fetchJson<{ authenticated: boolean; message: string }>('/auth/logout', {
      method: 'POST'
    }),

  getAuthStatus: () =>
    fetchJson<{ auth_required: boolean; authenticated: boolean }>('/auth/status')
};
