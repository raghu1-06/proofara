import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { EmpireApi } from '../services/empireApi';
import type { Experiment, ComparisonResponse, ModelProfile } from '../types/empire';
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Swords, 
  Clock, 
  Cpu, 
  RefreshCw,
  AlertCircle 
} from 'lucide-react';
import { ProviderSettingsModal } from '../components/ProviderSettingsModal';

export const ArenaPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const initialExpId = searchParams.get('id');

  const [loading, setLoading] = useState(false);
  const [runningModelA, setRunningModelA] = useState(false);
  const [runningModelB, setRunningModelB] = useState(false);
  const [runningBoth, setRunningBoth] = useState(false);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>(initialExpId || '');
  const [modelA, setModelA] = useState('nova-7b');
  const [modelB, setModelB] = useState('aegis-70b');
  const [models, setModels] = useState<ModelProfile[]>([]);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  // Load Experiments & Models
  const fetchModelsAndExps = useCallback(async () => {
    try {
      const [modelData, exps] = await Promise.all([
        EmpireApi.getModels(),
        EmpireApi.getExperiments()
      ]);
      setModels(modelData);
      setExperiments(exps);
      const qId = searchParams.get('id');
      if (qId && exps.some(e => e.id === qId)) {
        setSelectedExpId(qId);
      } else {
        setSelectedExpId((prev) => prev || (exps.length > 0 ? exps[0].id : ''));
      }
    } catch {
      // Backend may be loading
    }
  }, [searchParams]);

  useEffect(() => {
    fetchModelsAndExps();
  }, [fetchModelsAndExps]);

  useEffect(() => {
    const qId = searchParams.get('id');
    if (qId && qId !== selectedExpId) {
      setSelectedExpId(qId);
    }
  }, [searchParams, selectedExpId]);

  // Fetch comparison when experiment or models change
  useEffect(() => {
    if (selectedExpId) {
      setLoading(true);
      EmpireApi.compareModels(selectedExpId, modelA, modelB)
        .then(setComparison)
        .catch(() => setComparison(null))
        .finally(() => setLoading(false));
    }
  }, [selectedExpId, modelA, modelB]);

  const handleRunEvaluation = async (modelId: string, isA: boolean) => {
    if (!selectedExpId) return;
    if (isA) setRunningModelA(true);
    else setRunningModelB(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      const run = await EmpireApi.runExperiment(selectedExpId, modelId, 'Arena trial trigger');
      setNotice(`Executed ${run.model_name}! Pass rate: ${run.pass_rate}% (${run.passed_tests}/${run.total_tests}).`);
      const comp = await EmpireApi.compareModels(selectedExpId, modelA, modelB);
      setComparison(comp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      setErrorMsg(`Contender execution failed: ${msg}`);
    } finally {
      if (isA) setRunningModelA(false);
      else setRunningModelB(false);
    }
  };

  const handleRunBoth = async () => {
    if (!selectedExpId) return;
    setRunningBoth(true);
    setNotice(null);
    setErrorMsg(null);
    try {
      await EmpireApi.runExperiment(selectedExpId, modelA, 'Arena dual-contender trial (A)');
      await EmpireApi.runExperiment(selectedExpId, modelB, 'Arena dual-contender trial (B)');
      setNotice(`Both contenders evaluated under identical conditions!`);
      const comp = await EmpireApi.compareModels(selectedExpId, modelA, modelB);
      setComparison(comp);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Execution error';
      setErrorMsg(`Dual contender duel failed: ${msg}`);
    } finally {
      setRunningBoth(false);
    }
  };

  // Group models by execution tier (Simulator vs Local vs Cloud Frontier)
  const simulatorModels = models.filter((m) => m.execution_tier === 'simulation' || (!m.is_real && !m.execution_tier));
  const localModels = models.filter((m) => m.execution_tier === 'local' || m.provider === 'ollama');
  const cloudModels = models.filter((m) => m.execution_tier === 'cloud' || (m.is_real && m.provider !== 'ollama' && m.execution_tier !== 'local'));

  // Pair up results by test case prompt
  const resultsA = comparison?.results_a || [];
  const resultsB = comparison?.results_b || [];
  const activeExp = experiments.find((e) => e.id === selectedExpId);
  const expTestCases = activeExp?.test_cases || [];

  // Create unified rows using all test cases from the experiment + results
  const allPrompts = Array.from(
    new Set([
      ...expTestCases.map((tc) => tc.input_prompt),
      ...resultsA.map((r) => r.input_prompt),
      ...resultsB.map((r) => r.input_prompt)
    ])
  );

  const pairedRows = allPrompts.map((prompt) => {
    const resA = resultsA.find((r) => r.input_prompt === prompt);
    const resB = resultsB.find((r) => r.input_prompt === prompt);
    const tcMatch = expTestCases.find((tc) => tc.input_prompt === prompt);
    const expected = resA?.expected_output || resB?.expected_output || tcMatch?.expected_output || '';
    const method = resA?.evaluation_method || resB?.evaluation_method || tcMatch?.evaluation_method || 'Exact match';
    return {
      prompt,
      expected,
      method,
      resA,
      resB
    };
  });

  const filteredPairedRows = pairedRows.filter((row) => {
    if (statusFilter === 'pass') {
      return (row.resA?.passed ?? false) && (row.resB?.passed ?? false);
    }
    if (statusFilter === 'fail') {
      return !(row.resA?.passed ?? true) || !(row.resB?.passed ?? true);
    }
    return true;
  });

  const isBusy = runningModelA || runningModelB || runningBoth;

  return (
    <div className="pb-28">
      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden py-16 border-b border-white/6 bg-[radial-gradient(ellipse_at_83%_35%,rgba(155,55,35,0.18),transparent_34%),linear-gradient(115deg,#171311,#0b0b0d_76%)]">
        <div className="max-w-[1160px] mx-auto px-5">
          <div className="flex items-center gap-2 text-xs text-[#82796e] mb-4">
            <Link to="/" className="hover:text-[#f2d99b]">Empire</Link>
            <span>›</span>
            <span className="text-[#f3ead8]">The Arena</span>
          </div>

          <div className="eyebrow mb-2">Realm 02 · The Colosseum of Proof</div>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.05em] font-normal text-[#f3ead8] mb-4">
            Where contenders<br />face <span className="gold-text font-serif">the trial.</span>
          </h1>
          <p className="max-w-[660px] text-[1.02rem] text-[#b8ad9b] leading-relaxed">
            Compare models under uniform test conditions. Inspect side-by-side outputs, real latency deltas, individual failure diffs, and verified pass rates.
          </p>
          <div className="flex flex-wrap gap-5 mt-6 text-xs text-[#9c9182]">
            <span className="inline-flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#9ac59b]" />
              <span>Real &amp; Simulated Models Supported</span>
            </span>
            <span>◇ Side-by-Side Prompt Diffs</span>
            <span>✦ Millisecond Latency &amp; Token Metrics</span>
          </div>
        </div>
      </section>

      {/* ── ARENA WORKSPACE ── */}
      <main className="max-w-[1160px] mx-auto px-5 pt-10">
        {notice && (
          <div className="mb-6 p-4 rounded-lg border border-[rgba(154,197,155,0.3)] bg-[rgba(154,197,155,0.08)] text-[#c2e0c2] text-sm flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#9ac59b] shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice(null)}
              className="text-xs text-[#a8a29e] hover:text-[#f3ead8] underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg border border-[rgba(217,141,130,0.3)] bg-[rgba(217,141,130,0.08)] text-[#e8a69a] text-sm flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-[#d98d82] shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-xs text-[#a8a29e] hover:text-[#f3ead8] underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Toolbar: Experiment Selector & Dual Execution */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 rounded-xl border border-white/9 bg-[#151416] mb-8">
          <div>
            <span className="text-[11px] text-[#d7b46a] font-bold uppercase tracking-wider block mb-1">
              Select Active Evaluation Suite
            </span>
            <select
              value={selectedExpId}
              onChange={(e) => setSelectedExpId(e.target.value)}
              className="px-3.5 py-2 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none min-w-[280px] cursor-pointer"
            >
              {experiments.map(exp => (
                <option key={exp.id} value={exp.id}>
                  {exp.name} ({exp.test_cases?.length || 0} cases)
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleRunEvaluation(modelA, true)}
              disabled={isBusy}
              className="btn-secondary min-h-[40px] px-3.5 rounded-lg inline-flex items-center gap-2 text-xs cursor-pointer disabled:opacity-50"
            >
              {runningModelA ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              <span>Run Contender A</span>
            </button>
            <button
              onClick={() => handleRunEvaluation(modelB, false)}
              disabled={isBusy}
              className="btn-secondary min-h-[40px] px-3.5 rounded-lg inline-flex items-center gap-2 text-xs cursor-pointer disabled:opacity-50"
            >
              {runningModelB ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-[#d7b46a]" />}
              <span>Run Contender B</span>
            </button>
            <button
              onClick={handleRunBoth}
              disabled={isBusy}
              className="btn-primary min-h-[40px] px-4 rounded-lg inline-flex items-center gap-2 text-xs font-bold cursor-pointer disabled:opacity-50 shadow-md"
            >
              {runningBoth ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />}
              <span>Duel Both in Arena</span>
            </button>
          </div>
        </div>

        {/* Comparison Header Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Model A Card */}
          <div className="empire-panel p-6 border-l-4 border-l-[#D7B46A]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-[#82796e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#D7B46A]" />
                CONTENDER A
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={modelA}
                  onChange={(e) => setModelA(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border border-white/12 bg-[#0e0e10] text-[#f2d99b] focus:border-[#d7b46a] cursor-pointer font-mono"
                >
                  <optgroup label="🏛️ Imperial Simulators">
                    {simulatorModels.map(m => <option key={m.id} value={m.id}>🏛️ {m.name}</option>)}
                  </optgroup>
                  {localModels.length > 0 && (
                    <optgroup label="💻 Local LLM (Ollama Engine)">
                      {localModels.map(m => <option key={m.id} value={m.id}>💻 {m.name}</option>)}
                    </optgroup>
                  )}
                  {cloudModels.length > 0 && (
                    <optgroup label="⚡ Cloud Frontier AI">
                      {cloudModels.map(m => <option key={m.id} value={m.id}>⚡ {m.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <h3 className="font-serif text-2xl text-[#f3ead8]">
                  {comparison?.model_a ? comparison.model_a.model_name : 'No run recorded'}
                </h3>
                {comparison?.model_a && (
                  <div className="mt-1">
                    {comparison.model_a.execution_tier === 'local' || comparison.model_a.provider_type === 'ollama' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#8AC0E2]/15 text-[#8AC0E2] border border-[#8AC0E2]/30 font-bold">
                        💻 LOCAL LLM (OLLAMA)
                      </span>
                    ) : !comparison.model_a.is_simulation ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#9AC59B]/15 text-[#9AC59B] border border-[#9AC59B]/30 font-bold">
                        ⚡ CLOUD FRONTIER ({comparison.model_a.provider_type?.toUpperCase()})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#D7B46A]/15 text-[#D7B46A] border border-[#D7B46A]/30 font-bold">
                        🏛️ IMPERIAL SIMULATOR
                      </span>
                    )}
                  </div>
                )}
              </div>
              {comparison?.model_a && (
                <div className="font-serif text-4xl text-[#f2d99b]">
                  {comparison.model_a.pass_rate}%
                </div>
              )}
            </div>

            {comparison?.model_a ? (
              <div>
                <div className="w-full bg-[#2a2725] h-2 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-[#9a7333] to-[#eed28b] transition-all duration-500"
                    style={{ width: `${comparison.model_a.pass_rate}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[#82796e]">
                  <span>Passed: {comparison.model_a.passed_tests} / {comparison.model_a.total_tests} cases</span>
                  <span className={comparison.model_a.pass_rate >= 80 ? 'text-[#9ac59b] font-bold' : 'text-[#d98d82] font-bold'}>
                    {comparison.model_a.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#82796e] mt-4">
                Click &quot;Run Contender A&quot; above to execute this suite against {modelA}.
              </p>
            )}
          </div>

          {/* Model B Card */}
          <div className="empire-panel p-6 border-l-4 border-l-[#9AC59B]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-bold text-[#82796e] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#9AC59B]" />
                CONTENDER B
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={modelB}
                  onChange={(e) => setModelB(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded border border-white/12 bg-[#0e0e10] text-[#f2d99b] focus:border-[#d7b46a] cursor-pointer font-mono"
                >
                  <optgroup label="🏛️ Imperial Simulators">
                    {simulatorModels.map(m => <option key={m.id} value={m.id}>🏛️ {m.name}</option>)}
                  </optgroup>
                  {localModels.length > 0 && (
                    <optgroup label="💻 Local LLM (Ollama Engine)">
                      {localModels.map(m => <option key={m.id} value={m.id}>💻 {m.name}</option>)}
                    </optgroup>
                  )}
                  {cloudModels.length > 0 && (
                    <optgroup label="⚡ Cloud Frontier AI">
                      {cloudModels.map(m => <option key={m.id} value={m.id}>⚡ {m.name}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <div className="flex items-baseline justify-between mb-2">
              <div>
                <h3 className="font-serif text-2xl text-[#f3ead8]">
                  {comparison?.model_b ? comparison.model_b.model_name : 'No run recorded'}
                </h3>
                {comparison?.model_b && (
                  <div className="mt-1">
                    {comparison.model_b.execution_tier === 'local' || comparison.model_b.provider_type === 'ollama' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#8AC0E2]/15 text-[#8AC0E2] border border-[#8AC0E2]/30 font-bold">
                        💻 LOCAL LLM (OLLAMA)
                      </span>
                    ) : !comparison.model_b.is_simulation ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#9AC59B]/15 text-[#9AC59B] border border-[#9AC59B]/30 font-bold">
                        ⚡ CLOUD FRONTIER ({comparison.model_b.provider_type?.toUpperCase()})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#D7B46A]/15 text-[#D7B46A] border border-[#D7B46A]/30 font-bold">
                        🏛️ IMPERIAL SIMULATOR
                      </span>
                    )}
                  </div>
                )}
              </div>
              {comparison?.model_b && (
                <div className="font-serif text-4xl text-[#9AC59B]">
                  {comparison.model_b.pass_rate}%
                </div>
              )}
            </div>

            {comparison?.model_b ? (
              <div>
                <div className="w-full bg-[#2a2725] h-2 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-[#3e7243] to-[#9ac59b] transition-all duration-500"
                    style={{ width: `${comparison.model_b.pass_rate}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-[#82796e]">
                  <span>Passed: {comparison.model_b.passed_tests} / {comparison.model_b.total_tests} cases</span>
                  <span className={comparison.model_b.pass_rate >= 80 ? 'text-[#9ac59b] font-bold' : 'text-[#d98d82] font-bold'}>
                    {comparison.model_b.status}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[#82796e] mt-4">
                Click &quot;Run Contender B&quot; above to execute this suite against {modelB}.
              </p>
            )}
          </div>
        </div>

        {/* Detailed Side-by-Side Test Case Results Table */}
        <div className="empire-panel">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 sm:p-6 border-b border-white/7">
            <div>
              <h3 className="font-serif text-xl text-[#f3ead8]">Colosseum Duel: Head-to-Head Assertion Grid</h3>
              <p className="text-xs text-[#82796e] mt-0.5">
                Observe exact outputs, latency (ms), and evaluation verdicts side-by-side.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setProviderModalOpen(true)}
                className="text-[11px] text-[#D7B46A] hover:underline flex items-center gap-1 mr-2"
              >
                <Cpu className="w-3.5 h-3.5" /> Providers
              </button>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#82796e]">Filter:</span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${statusFilter === 'all' ? 'bg-[#d7b46a] text-black font-bold' : 'text-[#b8ad9b] hover:text-white'}`}
                >
                  All ({pairedRows.length})
                </button>
                <button
                  onClick={() => setStatusFilter('fail')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${statusFilter === 'fail' ? 'bg-[#d98d82] text-black font-bold' : 'text-[#b8ad9b] hover:text-white'}`}
                >
                  Divergence / Fails
                </button>
                <button
                  onClick={() => setStatusFilter('pass')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${statusFilter === 'pass' ? 'bg-[#9ac59b] text-black font-bold' : 'text-[#b8ad9b] hover:text-white'}`}
                >
                  Both Passed
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="p-8 text-center text-[#82796e] text-xs">
                Retrieving comparison records...
              </div>
            ) : filteredPairedRows.length > 0 ? (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-white/8 bg-black/20 text-[#82796e] uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4 w-[24%]">Test Prompt</th>
                    <th className="py-3 px-4 w-[16%]">Expected Output</th>
                    <th className="py-3 px-4 w-[30%] text-[#D7B46A]">Contender A ({modelA})</th>
                    <th className="py-3 px-4 w-[30%] text-[#9AC59B]">Contender B ({modelB})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6 text-[#d4cabb]">
                  {filteredPairedRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/2 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[11px] break-words" title={row.prompt}>
                        <div className="font-semibold text-[#EBE3D5]">{row.prompt}</div>
                        <div className="text-[10px] text-[#7E776C] mt-1 font-sans">Method: {row.method}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#f2d99b] break-words">
                        {row.expected}
                      </td>
                      {/* Contender A Output */}
                      <td className="py-3.5 px-4 font-mono text-[11px] bg-black/10">
                        {row.resA ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                row.resA.passed ? 'bg-[#9ac59b]/20 text-[#9ac59b]' : 'bg-[#d98d82]/20 text-[#d98d82]'
                              }`}>
                                {row.resA.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                <span>{row.resA.passed ? 'PASS' : 'FAIL'}</span>
                              </span>
                              {row.resA.latency_ms !== undefined && row.resA.latency_ms > 0 && (
                                <span className="text-[10px] text-[#7A7468] flex items-center gap-0.5 font-sans">
                                  <Clock className="w-2.5 h-2.5" /> {row.resA.latency_ms}ms
                                </span>
                              )}
                            </div>
                            <div className={row.resA.passed ? 'text-[#c2e0c2]' : 'text-[#e8a69a]'}>
                              {row.resA.actual_output || '<no output>'}
                            </div>
                            {row.resA.error_details && (
                              <div className="text-[10px] text-[#D98D82] font-sans">
                                {row.resA.error_details}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#6B655A] italic">Not executed</span>
                        )}
                      </td>

                      {/* Contender B Output */}
                      <td className="py-3.5 px-4 font-mono text-[11px] bg-black/20">
                        {row.resB ? (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                row.resB.passed ? 'bg-[#9ac59b]/20 text-[#9ac59b]' : 'bg-[#d98d82]/20 text-[#d98d82]'
                              }`}>
                                {row.resB.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                <span>{row.resB.passed ? 'PASS' : 'FAIL'}</span>
                              </span>
                              {row.resB.latency_ms !== undefined && row.resB.latency_ms > 0 && (
                                <span className="text-[10px] text-[#7A7468] flex items-center gap-0.5 font-sans">
                                  <Clock className="w-2.5 h-2.5" /> {row.resB.latency_ms}ms
                                </span>
                              )}
                            </div>
                            <div className={row.resB.passed ? 'text-[#c2e0c2]' : 'text-[#e8a69a]'}>
                              {row.resB.actual_output || '<no output>'}
                            </div>
                            {row.resB.error_details && (
                              <div className="text-[10px] text-[#D98D82] font-sans">
                                {row.resB.error_details}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#6B655A] italic">Not executed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-[#82796e] text-xs">
                No evaluation run recorded for this suite yet. Click &quot;Duel Both in Arena&quot; above to execute the tests.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Callout to The Oracle */}
        <div className="mt-8 p-5 rounded-xl border border-[rgba(215,180,106,0.2)] bg-[#171515] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="font-serif text-lg text-[#f3ead8]">Discover Recurring Failure Patterns</h4>
            <p className="text-xs text-[#b8ad9b] mt-0.5">
              Consult the Oracle to analyze observed instruction drift, formatting anomalies, and synthesize root causes.
            </p>
          </div>
          <Link
            to="/oracle"
            className="btn-primary min-h-[38px] px-4 rounded-lg inline-flex items-center gap-2 text-xs font-bold cursor-pointer"
          >
            <span>Consult The Oracle</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        onProvidersUpdated={fetchModelsAndExps}
      />
    </div>
  );
};
