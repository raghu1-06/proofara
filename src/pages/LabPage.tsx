import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { EmpireApi } from '../services/empireApi';
import type { TestCase, ModelProfile, SingleTestResult } from '../types/empire';
import { 
  Plus, 
  Trash2, 
  Save, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Zap, 
  Sparkles, 
  Cpu, 
  Clock, 
  X,
  FileCode2
} from 'lucide-react';
import { ProviderSettingsModal } from '../components/ProviderSettingsModal';

export const LabPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Settings modal
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  // Single test execution state per index
  const [singleTestLoading, setSingleTestLoading] = useState<Record<number, boolean>>({});
  const [singleTestResults, setSingleTestResults] = useState<Record<number, SingleTestResult | null>>({});

  // Auto-generation modal state
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateTopic, setGenerateTopic] = useState('');
  const [generating, setGenerating] = useState(false);

  // Form State
  const [experimentId, setExperimentId] = useState<string | null>(editId);
  const [name, setName] = useState('Reasoning & Instruction Trial');
  const [description, setDescription] = useState('Tests whether the model adheres to strict formatting and multi-step deduction.');
  const [category, setCategory] = useState('Reasoning');
  const [targetModelId, setTargetModelId] = useState('nova-7b');
  const [evaluationCriteria, setEvaluationCriteria] = useState('Exact match');
  const [passThreshold, setPassThreshold] = useState<number>(80);
  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      name: 'Case 01 · Single word assertion',
      input_prompt: 'Is 97 a prime number? Answer with YES or NO only.',
      expected_output: 'YES',
      evaluation_method: 'Exact match'
    },
    {
      name: 'Case 02 · Math deduction',
      input_prompt: 'Subtract 37 from 100, then divide the result by 9. Respond with the number only.',
      expected_output: '7',
      evaluation_method: 'Exact match'
    }
  ]);

  const loadModels = useCallback(async () => {
    try {
      const data = await EmpireApi.getModels();
      setModels(data);
      if (data.length > 0) {
        setTargetModelId((prev) => prev || data[0].id);
      }
    } catch {
      // Backend may be loading
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    EmpireApi.getExperiment(editId)
      .then((exp) => {
        setExperimentId(exp.id);
        setName(exp.name);
        setDescription(exp.description || '');
        setCategory(exp.category);
        setTargetModelId(exp.target_model);
        setEvaluationCriteria(exp.evaluation_criteria);
        setPassThreshold(exp.pass_threshold);
        if (exp.test_cases && exp.test_cases.length > 0) {
          setTestCases(exp.test_cases);
        }
      })
      .catch((err) => {
        setErrorMsg(`Failed to load experiment: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, [editId]);

  const handleAddCase = () => {
    setTestCases([
      ...testCases,
      {
        name: `Case ${String(testCases.length + 1).padStart(2, '0')} · Custom test`,
        input_prompt: '',
        expected_output: '',
        evaluation_method: evaluationCriteria
      }
    ]);
  };

  const handleRemoveCase = (index: number) => {
    if (testCases.length <= 1) {
      setErrorMsg('An experiment requires at least one test case.');
      return;
    }
    setTestCases(testCases.filter((_, i) => i !== index));
    const nextResults = { ...singleTestResults };
    delete nextResults[index];
    setSingleTestResults(nextResults);
  };

  const handleUpdateCase = (index: number, field: keyof TestCase, value: string) => {
    const updated = [...testCases];
    updated[index] = { ...updated[index], [field]: value };
    setTestCases(updated);
  };

  // Run single test prompt against currently selected model
  const handleRunSingleTest = async (index: number) => {
    const tc = testCases[index];
    if (!tc.input_prompt.trim() || !tc.expected_output.trim()) {
      setErrorMsg('Please provide both an input prompt and expected output before probing model.');
      return;
    }

    setSingleTestLoading((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await EmpireApi.testSingle({
        model_id: targetModelId,
        input_prompt: tc.input_prompt,
        expected_output: tc.expected_output,
        evaluation_method: tc.evaluation_method || evaluationCriteria
      });
      setSingleTestResults((prev) => ({ ...prev, [index]: res }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      setSingleTestResults((prev) => ({
        ...prev,
        [index]: {
          passed: false,
          actual_output: `[Error: ${msg}]`,
          latency_ms: 0,
          tokens: 0,
          evaluation_method: tc.evaluation_method || evaluationCriteria,
          error_details: msg,
          is_mock: false
        }
      }));
    } finally {
      setSingleTestLoading((prev) => ({ ...prev, [index]: false }));
    }
  };

  // Auto-generate test cases via API
  const handleAutoGenerate = async () => {
    setGenerating(true);
    setErrorMsg(null);
    try {
      const res = await EmpireApi.generateCases({
        topic: generateTopic.trim() || name,
        category,
        count: 3
      });
      if (res.test_cases && res.test_cases.length > 0) {
        setTestCases((prev) => [...prev, ...res.test_cases]);
        setNotice(`Generated and added ${res.test_cases.length} new test cases to the suite.`);
        setGenerateModalOpen(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setErrorMsg(`Failed to auto-generate test cases: ${msg}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async (): Promise<string | null> => {
    if (!name.trim()) {
      setErrorMsg('Experiment name is required.');
      return null;
    }
    if (testCases.some(tc => !tc.input_prompt.trim() || !tc.expected_output.trim())) {
      setErrorMsg('All test cases must have both an input prompt and an expected output.');
      return null;
    }

    setSaving(true);
    setErrorMsg(null);
    setNotice(null);

    const payload = {
      name: name.trim(),
      description: description.trim(),
      category,
      target_model: targetModelId,
      evaluation_criteria: evaluationCriteria,
      pass_threshold: passThreshold,
      test_cases: testCases.map(tc => ({
        name: tc.name.trim(),
        input_prompt: tc.input_prompt.trim(),
        expected_output: tc.expected_output.trim(),
        evaluation_method: tc.evaluation_method || evaluationCriteria
      }))
    };

    try {
      let activeId = experimentId;
      if (experimentId) {
        const updated = await EmpireApi.updateExperiment(experimentId, payload);
        setNotice(`Experiment "${updated.name}" saved to database. All cases preserved.`);
        activeId = updated.id;
      } else {
        const created = await EmpireApi.createExperiment(payload);
        setExperimentId(created.id);
        navigate(`/lab?id=${created.id}`, { replace: true });
        setNotice(`Experiment "${created.name}" created and saved to SQLite.`);
        activeId = created.id;
      }
      return activeId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving experiment';
      setErrorMsg(msg);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleRunTrial = async () => {
    const savedId = await handleSave();
    if (!savedId) return;

    setRunning(true);
    setNotice(null);
    setErrorMsg(null);

    try {
      const run = await EmpireApi.runExperiment(savedId, targetModelId, 'Trial execution from The Lab');
      setNotice(`Evaluation complete! Pass rate: ${run.pass_rate}% (${run.passed_tests}/${run.total_tests} passed). Routing to Arena...`);
      setTimeout(() => {
        navigate(`/arena?id=${savedId}`);
      }, 1000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      setErrorMsg(msg);
      setRunning(false);
    }
  };

  const simulatorModels = models.filter((m) => m.execution_tier === 'simulation' || (!m.is_real && !m.execution_tier));
  const localModels = models.filter((m) => m.execution_tier === 'local' || m.provider === 'ollama');
  const cloudModels = models.filter((m) => m.execution_tier === 'cloud' || (m.is_real && m.provider !== 'ollama' && m.execution_tier !== 'local'));

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-8 h-8 text-[#d7b46a] animate-spin" />
        <p className="text-sm text-[#b8ad9b] font-serif">Opening Experiment Chamber...</p>
      </div>
    );
  }

  return (
    <div className="pb-28">
      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden py-16 border-b border-white/6 bg-[radial-gradient(ellipse_at_85%_25%,rgba(147,99,36,0.18),transparent_35%),linear-gradient(115deg,#171413,#0b0b0d_75%)]">
        <div className="max-w-[1160px] mx-auto px-5">
          <div className="flex items-center gap-2 text-xs text-[#82796e] mb-4">
            <Link to="/" className="hover:text-[#f2d99b]">Empire</Link>
            <span>›</span>
            <span className="text-[#f3ead8]">The Lab</span>
          </div>

          <div className="eyebrow mb-2">Realm 01 · Experiment Chamber</div>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.05em] font-normal text-[#f3ead8] mb-4">
            Every discovery<br />begins in <span className="gold-text font-serif">the Lab.</span>
          </h1>
          <p className="max-w-[650px] text-[1.02rem] text-[#b8ad9b] leading-relaxed">
            Prepare a clear experiment, define what success looks like, and run live single-case tests before putting your models to the trial.
          </p>
          <div className="flex flex-wrap gap-5 mt-6 text-xs text-[#9c9182]">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9ac59b]" />
              <span>Persistent SQLite Storage</span>
            </span>
            <span>◇ Live Prompt Probing</span>
            <span>✦ Deterministic & Real Frontier LLM Evaluators</span>
          </div>
        </div>
      </section>

      {/* ── WORKSPACE ── */}
      <main className="max-w-[1160px] mx-auto px-5 pt-10">
        {notice && (
          <div className="mb-6 p-4 rounded-lg border border-[rgba(154,197,155,0.3)] bg-[rgba(154,197,155,0.08)] text-[#c2e0c2] text-sm flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#9ac59b] shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg border border-[rgba(217,141,130,0.3)] bg-[rgba(217,141,130,0.08)] text-[#e8a69a] text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#d98d82] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.8fr)] gap-6 items-start">
          {/* Main Form Panel */}
          <div className="empire-panel">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/7">
              <div>
                <h2 className="font-serif text-xl font-normal text-[#f3ead8]">Experiment Definition</h2>
                <p className="text-xs text-[#82796e] mt-1">Configure parameters, threshold, and test cases.</p>
              </div>
              <span className="px-2.5 py-1 rounded-full border border-[rgba(215,180,106,0.22)] text-[#f2d99b] text-[11px] font-mono">
                {experimentId ? 'SAVED EXPERIMENT' : 'NEW DRAFT'}
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-6">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                  Experiment Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Strict Output Schema Trial"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                  Objective & Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What failure mode or capability are you testing?"
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
                />
              </div>

              {/* Two-Col Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                    Evaluation Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none cursor-pointer"
                  >
                    <option>Reasoning</option>
                    <option>Instruction following</option>
                    <option>Factual accuracy</option>
                    <option>Safety checks</option>
                    <option>Code generation</option>
                    <option>Robustness</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-[#e0d4bf] uppercase tracking-wider">
                      Target Contender Model
                    </label>
                    <button
                      type="button"
                      onClick={() => setProviderModalOpen(true)}
                      className="text-[11px] text-[#D7B46A] hover:underline flex items-center gap-1"
                    >
                      <Cpu className="w-3 h-3" /> Connect Providers
                    </button>
                  </div>
                  <select
                    value={targetModelId}
                    onChange={(e) => setTargetModelId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none cursor-pointer font-mono text-xs"
                  >
                    <optgroup label="🏛️ Imperial Simulators (Deterministic)">
                      {simulatorModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          🏛️ {m.name}
                        </option>
                      ))}
                    </optgroup>
                    {localModels.length > 0 && (
                      <optgroup label="💻 Local LLM (Ollama Engine)">
                        {localModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            💻 {m.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {cloudModels.length > 0 && (
                      <optgroup label="⚡ Cloud Frontier AI Models">
                        {cloudModels.map((m) => (
                          <option key={m.id} value={m.id}>
                            ⚡ {m.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              {/* Two-Col Evaluator & Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                    Evaluation Criteria
                  </label>
                  <select
                    value={evaluationCriteria}
                    onChange={(e) => setEvaluationCriteria(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none cursor-pointer"
                  >
                    <option>Exact match</option>
                    <option>Normalized match</option>
                    <option>Required substring</option>
                    <option>JSON format</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                    Pass Threshold ({passThreshold}%)
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={passThreshold}
                    onChange={(e) => setPassThreshold(Number(e.target.value))}
                    className="w-full accent-[#d7b46a] cursor-pointer mt-2"
                  />
                  <div className="flex justify-between text-[11px] text-[#82796e] mt-1">
                    <span>Lenient (50%)</span>
                    <span>Standard (80%)</span>
                    <span>Flawless (100%)</span>
                  </div>
                </div>
              </div>

              {/* Test Cases Section */}
              <div className="pt-4 border-t border-white/7">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-serif text-lg font-normal text-[#f3ead8]">Test Cases ({testCases.length})</h3>
                    <p className="text-xs text-[#82796e]">Define inputs, expected outputs, or probe model live.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setGenerateTopic(name);
                        setGenerateModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D7B46A]/40 bg-[#D7B46A]/10 text-xs text-[#f2d99b] hover:bg-[#D7B46A]/20 cursor-pointer font-medium"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#D7B46A]" />
                      <span>Auto-Generate Cases</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleAddCase}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-[rgba(215,180,106,0.38)] text-xs text-[#f2d99b] hover:bg-[rgba(215,180,106,0.06)] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Case</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {testCases.map((tc, idx) => {
                    const testRes = singleTestResults[idx];
                    const isTestingThis = singleTestLoading[idx];

                    return (
                      <div key={idx} className="p-4 rounded-xl border border-white/9 bg-black/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#e8d7b7]">
                            Case {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleRunSingleTest(idx)}
                              disabled={isTestingThis}
                              className="text-xs text-[#D7B46A] hover:text-[#f3ead8] inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#24211A] border border-[#3E3524] cursor-pointer disabled:opacity-50"
                              title="Test this prompt against the target model now"
                            >
                              {isTestingThis ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              <span>{isTestingThis ? 'Probing...' : 'Run Single Test'}</span>
                            </button>

                            {testCases.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCase(idx)}
                                className="text-[#82796e] hover:text-[#d98d82] text-xs inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-[#b8ad9b] mb-1">Input Prompt *</label>
                          <textarea
                            rows={2}
                            value={tc.input_prompt}
                            onChange={(e) => handleUpdateCase(idx, 'input_prompt', e.target.value)}
                            placeholder="e.g. Is 97 prime? Answer YES or NO."
                            className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#0e0e10] text-xs text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-[#b8ad9b] mb-1">Expected Output *</label>
                            <input
                              type="text"
                              value={tc.expected_output}
                              onChange={(e) => handleUpdateCase(idx, 'expected_output', e.target.value)}
                              placeholder="e.g. YES"
                              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#0e0e10] text-xs text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-[#b8ad9b] mb-1">Evaluator Method</label>
                            <select
                              value={tc.evaluation_method || evaluationCriteria}
                              onChange={(e) => handleUpdateCase(idx, 'evaluation_method', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-[#0e0e10] text-xs text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none cursor-pointer"
                            >
                              <option>Exact match</option>
                              <option>Normalized match</option>
                              <option>Required substring</option>
                              <option>JSON format</option>
                            </select>
                          </div>
                        </div>

                        {/* Live Single Test Execution Feedback */}
                        {testRes && (
                          <div
                            className={`p-3 rounded-lg border text-xs space-y-1.5 transition-all ${
                              testRes.passed
                                ? 'bg-[#152518]/70 border-[#2D5A32] text-[#BEE3C0]'
                                : 'bg-[#2A1515]/70 border-[#662828] text-[#F0B8B2]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1.5 font-bold">
                                {testRes.passed ? (
                                  <CheckCircle2 className="w-4 h-4 text-[#9AC59B]" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-[#D98D82]" />
                                )}
                                {testRes.passed ? 'PASSED ASSERTION' : 'FAILED ASSERTION'}
                              </span>
                              <div className="flex items-center gap-3 text-[11px] opacity-80">
                                <span className="flex items-center gap-1 font-mono">
                                  <Clock className="w-3 h-3" /> {testRes.latency_ms} ms
                                </span>
                                <span>{testRes.tokens} tokens</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    testRes.execution_tier === 'local' || testRes.provider_type === 'ollama'
                                      ? 'bg-[#1C2C38] text-[#8AC0E2] border border-[#2B4B63]'
                                      : !testRes.is_simulation
                                      ? 'bg-[#1E3A24] text-[#9AC59B] border border-[#2D5A32]'
                                      : 'bg-[#3A3225] text-[#D7B46A]'
                                  }`}
                                >
                                  {testRes.execution_tier === 'local' || testRes.provider_type === 'ollama'
                                    ? '💻 LOCAL (OLLAMA)'
                                    : !testRes.is_simulation
                                    ? `⚡ CLOUD (${testRes.provider_type?.toUpperCase() || 'FRONTIER'})`
                                    : '🏛️ SIMULATOR'}
                                </span>
                              </div>
                            </div>

                            <div className="bg-black/50 p-2 rounded text-[11px] font-mono break-all text-[#F5EFE6]">
                              <span className="text-[#9E9789] block text-[10px] uppercase font-sans mb-0.5">
                                Actual Model Output:
                              </span>
                              {testRes.actual_output || '<empty output>'}
                            </div>

                            {!testRes.passed && testRes.error_details && (
                              <div className="text-[11px] text-[#F0A8A0] pt-0.5">
                                Diagnostic: {testRes.error_details}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-white/7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary min-h-[44px] px-5 rounded-lg inline-flex items-center gap-2 text-xs cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Experiment to SQLite'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleRunTrial}
                  disabled={running || saving}
                  className="btn-secondary min-h-[44px] px-5 rounded-lg inline-flex items-center gap-2 text-xs cursor-pointer"
                >
                  <Play className="w-4 h-4 text-[#d7b46a]" />
                  <span>{running ? 'Executing Suite...' : 'Execute Trial in Arena'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Side Stack: Live Experiment Summary */}
          <div className="space-y-4">
            <div className="empire-panel p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-lg font-normal text-[#f3ead8]">Trial Summary</h3>
                <span className="px-2 py-0.5 rounded-full border border-[rgba(215,180,106,0.22)] text-[10px] text-[#f2d99b]">
                  SPECIFICATION
                </span>
              </div>

              <div className="mb-4">
                <span className="text-[11px] text-[#82796e] uppercase tracking-wider block mb-1">Experiment</span>
                <strong className="font-serif text-xl text-[#f3ead8] block">{name || 'Untitled Trial'}</strong>
                <p className="text-xs text-[#b8ad9b] mt-1 line-clamp-2">{description || 'No description provided'}</p>
              </div>

              <div className="p-3 mb-4 rounded-lg bg-[#141418] border border-white/8 text-xs space-y-1.5">
                <div className="flex justify-between text-[#8E877A]">
                  <span>Active Target:</span>
                  <span className="text-[#F3ECE1] font-mono font-semibold">{targetModelId}</span>
                </div>
                <div className="flex justify-between text-[#8E877A]">
                  <span>Criteria:</span>
                  <span className="text-[#D7B46A]">{evaluationCriteria}</span>
                </div>
                <div className="flex justify-between text-[#8E877A]">
                  <span>Connected AI:</span>
                  <span className="text-[#9AC59B]">{localModels.length + cloudModels.length} active</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-3 rounded-lg border border-white/7 bg-black/20">
                  <span className="block text-[10px] text-[#82796e] uppercase">Total Test Cases</span>
                  <strong className="block text-2xl font-serif text-[#f2d99b]">{testCases.length}</strong>
                </div>
                <div className="p-3 rounded-lg border border-white/7 bg-black/20">
                  <span className="block text-[10px] text-[#82796e] uppercase">Threshold</span>
                  <strong className="block text-2xl font-serif text-[#f2d99b]">{passThreshold}%</strong>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[rgba(215,180,106,0.2)] bg-[rgba(215,180,106,0.045)] text-xs text-[#b8ad9b]">
                <strong className="block text-[#f2d99b] font-bold mb-1">Deterministic Proof Rule</strong>
                <p>
                  Experiments are saved directly into the backend SQLite database. Use &quot;Run Single Test&quot; above to probe real prompt latency before running full suites.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Auto-Generate Test Cases Modal */}
      {generateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-[#0F0F13] border border-[#3A3225] rounded-xl p-6 space-y-4 text-[#E4DFD5]">
            <div className="flex items-center justify-between pb-3 border-b border-[#23201A]">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#D7B46A]" />
                <h3 className="font-serif text-lg text-[#F5EFE6]">Auto-Generate Evaluation Suite</h3>
              </div>
              <button
                onClick={() => setGenerateModalOpen(false)}
                className="text-[#847E72] hover:text-[#E0D8CB]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#9E9789] leading-relaxed">
              Synthesize 3 realistic edge-case tests with deterministic expectations tailored to category <strong className="text-[#D7B46A]">{category}</strong>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#C8C2B6]">Domain Topic or Feature</label>
              <input
                type="text"
                value={generateTopic}
                onChange={(e) => setGenerateTopic(e.target.value)}
                placeholder="e.g. Multi-tier invoice tax calculation"
                className="w-full px-3 py-2 text-xs bg-[#16161D] border border-[#2D2922] rounded-lg text-[#F5EFE6] focus:outline-none focus:border-[#D7B46A]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setGenerateModalOpen(false)}
                className="px-3 py-1.5 text-xs text-[#9E9789] hover:text-[#F3ECE1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={generating}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D7B46A] text-[#121217] hover:bg-[#E5C782] flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <FileCode2 className="w-3.5 h-3.5" />}
                {generating ? 'Synthesizing...' : 'Generate 3 Test Cases'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        onProvidersUpdated={loadModels}
      />
    </div>
  );
};
