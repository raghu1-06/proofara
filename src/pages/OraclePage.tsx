import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { EmpireApi } from '../services/empireApi';
import type { OracleConsultResult, AiSynthesisResult, ModelProfile } from '../types/empire';
import { Sparkles, AlertCircle, Cpu, ShieldCheck, CheckCircle2, RefreshCw, Layers } from 'lucide-react';
import { ProviderSettingsModal } from '../components/ProviderSettingsModal';

export const OraclePage: React.FC = () => {
  const [topic, setTopic] = useState('Why does Nova-7B fail single-word exact match tests?');
  const [selectedModel, setSelectedModel] = useState('Nova-7B');
  const [pattern, setPattern] = useState('instructions');
  const [evidenceNotes, setEvidenceNotes] = useState('Nova consistently adds "The answer is..." prior to producing the requested output token.');
  const [models, setModels] = useState<ModelProfile[]>([]);

  const [loading, setLoading] = useState(false);
  const [aiSynthesizing, setAiSynthesizing] = useState(false);
  const [result, setResult] = useState<OracleConsultResult | null>(null);
  const [aiResult, setAiResult] = useState<AiSynthesisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  const loadModels = useCallback(async () => {
    try {
      const data = await EmpireApi.getModels();
      setModels(data);
    } catch {
      // Backend may be loading
    }
  }, []);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const handleConsult = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setAiResult(null);

    try {
      const res = await EmpireApi.consultOracle({
        topic: topic.trim(),
        model_id: selectedModel,
        pattern,
        evidence_notes: evidenceNotes.trim()
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Oracle consultation error';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  // Deep AI Synthesis using real model or empirical reasoning engine
  const handleDeepAiSynthesis = async () => {
    setAiSynthesizing(true);
    setErrorMsg(null);
    try {
      const synth = await EmpireApi.aiOracleSynthesis({
        pattern,
        focus_model: selectedModel,
        notes: `${topic}. ${evidenceNotes}`
      });
      setAiResult(synth);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'AI Synthesis failed';
      setErrorMsg(msg);
    } finally {
      setAiSynthesizing(false);
    }
  };

  const handleClear = () => {
    setEvidenceNotes('');
    setResult(null);
    setAiResult(null);
  };

  return (
    <div className="pb-28">
      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden py-16 border-b border-white/6 bg-[radial-gradient(ellipse_at_80%_28%,rgba(67,99,137,0.18),transparent_34%),linear-gradient(115deg,#141315,#0b0b0d_75%)]">
        <div className="max-w-[1160px] mx-auto px-5">
          <div className="flex items-center gap-2 text-xs text-[#82796e] mb-4">
            <Link to="/" className="hover:text-[#f2d99b]">Empire</Link>
            <span>›</span>
            <span className="text-[#f3ead8]">The Oracle</span>
          </div>

          <div className="eyebrow mb-2">Realm 04 · The Chamber of Insight</div>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.05em] font-normal text-[#f3ead8] mb-4">
            Do not stop at scores.<br />Seek <span className="gold-text font-serif">understanding.</span>
          </h1>
          <p className="max-w-[670px] text-[1.02rem] text-[#b8ad9b] leading-relaxed">
            The Oracle turns evaluation outcomes into diagnostic hypotheses: recurring failure modes, evidence-based explanations, and automated frontier AI failure synthesis.
          </p>
          <div className="flex flex-wrap gap-5 mt-6 text-xs text-[#9c9182]">
            <span>✧ Pattern Discovery</span>
            <span>⌕ Failure Root-Cause Synthesis</span>
            <span>◇ Live Model Diagnostic Core</span>
          </div>
        </div>
      </section>

      {/* ── ORACLE CONSULTATION WORKSPACE ── */}
      <main className="max-w-[1160px] mx-auto px-5 pt-10">
        {errorMsg && (
          <div className="mb-6 p-4 rounded-lg border border-[rgba(217,141,130,0.3)] bg-[rgba(217,141,130,0.08)] text-[#e8a69a] text-sm flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#d98d82] shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] gap-6 items-start mb-12">
          {/* Consultation Form */}
          <div className="empire-panel">
            <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/7">
              <div>
                <h2 className="font-serif text-xl text-[#f3ead8]">Consult the Oracle</h2>
                <p className="text-xs text-[#82796e] mt-0.5">Describe a failure pattern to receive structured diagnostic guidance.</p>
              </div>
              <button
                type="button"
                onClick={() => setProviderModalOpen(true)}
                className="px-2.5 py-1 rounded-full border border-[rgba(215,180,106,0.3)] text-[#f2d99b] hover:bg-[#201F1A] text-[11px] font-mono flex items-center gap-1.5 transition-colors"
              >
                <Cpu className="w-3 h-3 text-[#D7B46A]" />
                <span>AI Providers</span>
              </button>
            </div>

            <form onSubmit={handleConsult} className="p-5 sm:p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                  What are you investigating? *
                </label>
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                    Model or System
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none cursor-pointer"
                  >
                    <option value="Nova-7B">Nova-7B (Imperial Fast)</option>
                    <option value="Meridian-13B">Meridian-13B (Balanced)</option>
                    <option value="Aegis-70B">Aegis-70B (Deep Reasoning)</option>
                    {models.filter(m => m.is_real).map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                    <option value="All models">All models (Cross-Archive Analysis)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                    Observed Failure Mode
                  </label>
                  <select
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none cursor-pointer"
                  >
                    <option value="instructions">Misses exact negative constraints (Instruction drift)</option>
                    <option value="reasoning">Errors in multi-step calculation</option>
                    <option value="facts">Produces unsupported factual claims</option>
                    <option value="format">Breaks output JSON schema or adds markdown code fences</option>
                    <option value="inconsistent">Gives divergent answers across repeated trials</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#e0d4bf] mb-2 uppercase tracking-wider">
                  Evidence or Failure Notes
                </label>
                <textarea
                  rows={3}
                  value={evidenceNotes}
                  onChange={(e) => setEvidenceNotes(e.target.value)}
                  placeholder="Paste an actual failure sample, prompt, and expected vs actual diff..."
                  className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0e0e10] text-sm text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
                />
                <small className="block text-[11px] text-[#82796e] mt-1">
                  Concrete examples produce more accurate diagnostic hypotheses than aggregate pass rates alone.
                </small>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={loading || aiSynthesizing}
                  className="btn-primary min-h-[44px] px-5 rounded-lg inline-flex items-center gap-2 text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{loading ? 'Consulting Oracle...' : 'Analyze Pattern ✧'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeepAiSynthesis}
                  disabled={loading || aiSynthesizing}
                  className="btn-secondary min-h-[44px] px-4 rounded-lg inline-flex items-center gap-2 text-xs font-bold text-[#D7B46A] border-[#D7B46A]/40 hover:bg-[#D7B46A]/10 cursor-pointer disabled:opacity-50"
                  title="Run automated failure root cause synthesis across stored SQLite failures"
                >
                  {aiSynthesizing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                  <span>{aiSynthesizing ? 'Synthesizing...' : 'Run Deep AI Diagnostic'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleClear}
                  className="btn-secondary min-h-[44px] px-4 rounded-lg text-xs cursor-pointer"
                >
                  Clear Notes
                </button>
              </div>

              {/* Consultation Diagnostic Result */}
              {result && (
                <div className="mt-6 p-5 rounded-xl border border-[rgba(142,184,213,0.3)] bg-[rgba(142,184,213,0.05)] animate-rise space-y-3">
                  <h3 className="font-serif text-lg text-[#d5e7f3]">{result.title}</h3>
                  <div className="text-xs text-[#b6c7d2] leading-relaxed">
                    <strong className="block text-[#f2d99b] mb-1 font-bold">Diagnostic Hypothesis:</strong>
                    <p>{result.analysis}</p>
                  </div>
                  <div className="text-xs text-[#b6c7d2] leading-relaxed p-3 rounded-lg bg-black/30 border border-white/5">
                    <strong className="block text-[#9ac59b] mb-1 font-bold">Recommended Follow-up Experiment:</strong>
                    <p>{result.recommendation}</p>
                  </div>

                  {/* Empirical Signals from Stored Test Failures */}
                  {result.empirical_insights.length > 0 && (
                    <div className="pt-3 border-t border-white/8">
                      <strong className="block text-[11px] text-[#d7b46a] uppercase tracking-wider mb-2">
                        Empirical Archive Correlation ({result.empirical_insights[0].affected_count} Stored Failures Analyzed)
                      </strong>
                      <p className="text-xs text-[#c4b9a8] leading-relaxed">
                        {result.empirical_insights[0].evidence}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Deep AI Diagnostic Synthesis Result */}
              {aiResult && (
                <div className="mt-6 p-5 rounded-xl border border-[#D7B46A]/40 bg-[#16151B] animate-rise space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-[#D7B46A]" />
                      <h3 className="font-serif text-lg text-[#F5EFE6]">{aiResult.title}</h3>
                    </div>
                    <span className="text-[10px] font-mono text-[#D7B46A] px-2 py-0.5 rounded bg-black/40 border border-[#D7B46A]/30">
                      Core: {aiResult.model_used}
                    </span>
                  </div>

                  <div className="text-xs text-[#D8D2C6] leading-relaxed">
                    <strong className="block text-[#EAD8B8] mb-1 font-bold">Empirical Analysis:</strong>
                    <p>{aiResult.analysis}</p>
                  </div>

                  {/* Root causes */}
                  {aiResult.root_causes && aiResult.root_causes.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-lg bg-black/30 border border-white/5">
                      <strong className="block text-[11px] text-[#D98D82] uppercase tracking-wider font-bold">
                        Root Causes Identified:
                      </strong>
                      <ul className="list-disc list-inside text-xs text-[#C8C0B4] space-y-1">
                        {aiResult.root_causes.map((rc, idx) => (
                          <li key={idx}>{rc}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Action steps */}
                  {aiResult.action_steps && aiResult.action_steps.length > 0 && (
                    <div className="space-y-1.5 p-3 rounded-lg bg-[#142318]/50 border border-[#2D5A32]">
                      <strong className="block text-[11px] text-[#9AC59B] uppercase tracking-wider font-bold">
                        Immediate Action Steps:
                      </strong>
                      <ul className="text-xs text-[#C2E3C5] space-y-1">
                        {aiResult.action_steps.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#9AC59B] shrink-0 mt-0.5" />
                            <span>{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>

          {/* Right Aside: Oracle Principles */}
          <div className="empire-panel p-6">
            <h3 className="font-serif text-lg text-[#f3ead8] mb-1">Oracle&apos;s Principles</h3>
            <p className="text-xs text-[#82796e] mb-5">How to interpret evaluation evidence responsibly.</p>

            <div className="space-y-4">
              <div className="flex gap-3 items-start text-xs text-[#c9beac]">
                <span className="w-7 h-7 rounded-lg border border-[rgba(215,180,106,0.22)] bg-[rgba(215,180,106,0.06)] text-[#f2d99b] flex items-center justify-center font-serif shrink-0">
                  01
                </span>
                <div>
                  <strong className="block text-[#e3d5bc]">Separate Signal from Guess</strong>
                  <span className="text-[#82796e]">Distinguish observed failure diffs from hypothetical root causes.</span>
                </div>
              </div>

              <div className="flex gap-3 items-start text-xs text-[#c9beac]">
                <span className="w-7 h-7 rounded-lg border border-[rgba(215,180,106,0.22)] bg-[rgba(215,180,106,0.06)] text-[#f2d99b] flex items-center justify-center font-serif shrink-0">
                  02
                </span>
                <div>
                  <strong className="block text-[#e3d5bc]">Find Repeatable Patterns</strong>
                  <span className="text-[#82796e]">Verify that errors persist across multiple prompt variations.</span>
                </div>
              </div>

              <div className="flex gap-3 items-start text-xs text-[#c9beac]">
                <span className="w-7 h-7 rounded-lg border border-[rgba(215,180,106,0.22)] bg-[rgba(215,180,106,0.06)] text-[#f2d99b] flex items-center justify-center font-serif shrink-0">
                  03
                </span>
                <div>
                  <strong className="block text-[#e3d5bc]">Design the Next Test</strong>
                  <span className="text-[#82796e]">Change one variable at a time in The Lab to test the hypothesis.</span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-xl border border-[rgba(215,180,106,0.2)] bg-[rgba(215,180,106,0.04)] text-xs text-[#cdbd9d]">
              <strong>Transparent Methodology Notice:</strong> The Oracle operates on deterministic diagnostic heuristics paired with empirical failure logs from SQLite and live frontier AI synthesis. It does not fabricate arbitrary claims.
            </div>
          </div>
        </div>

        {/* Three Step Framework Cards */}
        <div className="eyebrow mb-2">The Oracle&apos;s Framework</div>
        <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#f3ead8] mb-6">
          Three steps from failure to learning.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="empire-panel p-5">
            <span className="text-[#d7b46a] text-xs font-bold tracking-wider uppercase block mb-1">Step 01</span>
            <h3 className="font-serif text-lg text-[#f3ead8] mb-1.5">Observe</h3>
            <p className="text-xs text-[#b8ad9b] leading-relaxed">
              Record the exact prompt, actual output, expected answer, and evaluator rule. Preserve the raw evidence.
            </p>
          </div>

          <div className="empire-panel p-5">
            <span className="text-[#d7b46a] text-xs font-bold tracking-wider uppercase block mb-1">Step 02</span>
            <h3 className="font-serif text-lg text-[#f3ead8] mb-1.5">Form a Hypothesis</h3>
            <p className="text-xs text-[#b8ad9b] leading-relaxed">
              Propose a plausible mechanism for the failure without assuming certainty until verified against examples.
            </p>
          </div>

          <div className="empire-panel p-5">
            <span className="text-[#d7b46a] text-xs font-bold tracking-wider uppercase block mb-1">Step 03</span>
            <h3 className="font-serif text-lg text-[#f3ead8] mb-1.5">Verify</h3>
            <p className="text-xs text-[#b8ad9b] leading-relaxed">
              Isolate one variable at a time in The Lab and rerun a consistent test suite to see whether the pattern resolves.
            </p>
          </div>
        </div>
      </main>

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        onProvidersUpdated={loadModels}
      />
    </div>
  );
};
