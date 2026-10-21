import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronRight, 
  FlaskConical, 
  Swords, 
  Database, 
  Sparkles, 
  ShieldCheck, 
  Clock, 
  Cpu, 
  ArrowUpRight, 
  Terminal,
  Activity
} from 'lucide-react';
import { EmpireApi } from '../services/empireApi';
import type { Experiment, ModelProfile } from '../types/empire';
import { ProviderSettingsModal } from '../components/ProviderSettingsModal';

export const EmpirePage: React.FC = () => {
  const [stats, setStats] = useState({
    totalExperiments: 3,
    totalTests: 12,
    activeModels: 3,
    frontierConnected: false
  });
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [activeTab, setActiveTab] = useState<'arena' | 'lab' | 'archives' | 'oracle'>('arena');
  const [providerModalOpen, setProviderModalOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      EmpireApi.getExperiments().catch(() => [] as Experiment[]),
      EmpireApi.getModels().catch(() => [] as ModelProfile[]),
      EmpireApi.getProviders().catch(() => [])
    ]).then(([exps, models, providers]) => {
      setExperiments(exps);
      const testsCount = exps.reduce((acc, e) => acc + (e.test_cases?.length || 0), 0);
      const enabledProviders = providers.filter((p: { is_enabled: boolean }) => p.is_enabled);
      setStats({
        totalExperiments: exps.length,
        totalTests: testsCount,
        activeModels: models.length,
        frontierConnected: enabledProviders.length > 0
      });
    });
  }, []);

  const firstExp = experiments[0];
  const firstTestCase = firstExp?.test_cases?.[0];

  return (
    <div className="flex flex-col min-h-screen text-[#E4DFD5]">
      {/* ── CINEMATIC CITADEL HERO BANNER ── */}
      <section className="relative min-h-[min(940px,94svh)] flex items-center overflow-hidden isolation-isolate bg-[#0B0B0D]">
        {/* Cinematic Backdrop Image with Atmospheric Gradient Fades */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden select-none">
          <img
            src="/empire-hero.jpg"
            alt="The Imperial Citadel of Empire Arena at twilight"
            className="w-full h-full object-cover object-[center_35%] opacity-30 filter contrast-[1.02] saturate-[0.7]"
          />
          {/* Multi-layered cinematic obsidian & twilight vignettes */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/70 to-[#0B0B0D]/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0B0B0D] via-[#0B0B0D]/80 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,transparent_40%,#0B0B0D_95%)]" />
        </div>

        <div className="relative max-w-[1160px] mx-auto px-5 w-full py-20 z-10">
          <div className="max-w-[760px] animate-rise">
            {/* Imperial Seal & Identity Pill */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-[#1A1815]/90 border border-[#D7B46A]/35 text-xs text-[#EADBB6] mb-6 backdrop-blur-md shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#9AC59B] shadow-[0_0_8px_#9AC59B]" />
              <span className="font-serif tracking-wider uppercase text-[11px] font-semibold">
                A working record of model behavior
              </span>
              <span className="text-[#8E8678]">|</span>
              <span className="text-[11px] text-[#D7B46A] font-mono">
                {stats.activeModels} Models Armed
              </span>
            </div>

            {/* Hero Main Heading */}
            <h1 className="font-serif text-[clamp(2.8rem,7.2vw,5.8rem)] leading-[0.96] tracking-[-0.04em] font-normal text-[#F5EFE6] mb-6 drop-shadow-sm">
              Where intelligence <br />
              <span className="gold-text font-serif italic pr-2">proves itself.</span>
            </h1>

            {/* Serious, grounded value proposition */}
            <p className="text-[clamp(1rem,1.4vw,1.15rem)] text-[#C9BFB0] leading-relaxed max-w-[580px] mb-8 font-sans">
              Empire Arena is an enterprise AI evaluation citadel. Benchmark models under identical conditions, enforce deterministic assertion proof, measure token latency, and turn failure patterns into permanent empirical evidence.
            </p>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-4 mb-10">
              <Link
                to="/arena"
                className="btn-primary min-h-[50px] px-6 rounded-lg inline-flex items-center gap-2.5 text-xs uppercase tracking-wider font-extrabold cursor-pointer"
              >
                <Swords className="w-4 h-4 text-[#17120A]" />
                <span>Enter The Arena</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/lab"
                className="btn-secondary min-h-[50px] px-6 rounded-lg inline-flex items-center gap-2.5 text-xs uppercase tracking-wider font-bold cursor-pointer"
              >
                <FlaskConical className="w-4 h-4 text-[#D7B46A]" />
                <span>Open The Lab</span>
              </Link>
              <button
                type="button"
                onClick={() => setProviderModalOpen(true)}
                className="min-h-[50px] px-4 rounded-lg inline-flex items-center gap-2 text-xs border border-white/10 hover:border-[#D7B46A]/50 bg-black/40 hover:bg-[#1C1A16] text-[#A69F90] hover:text-[#F3ECE1] transition-colors"
                title="Connect OpenAI, Gemini, Groq, Anthropic, or local Ollama models"
              >
                <Cpu className="w-4 h-4 text-[#D7B46A]" />
                <span>Connect AI Providers</span>
              </button>
            </div>

            {/* Grounding Telemetry Ticker */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10">
              <div>
                <span className="text-[10px] text-[#868072] uppercase font-mono block">Evaluations Stored</span>
                <span className="text-xl font-serif text-[#F3ECE1] font-bold">{stats.totalExperiments} Suites</span>
              </div>
              <div>
                <span className="text-[10px] text-[#868072] uppercase font-mono block">Verifiable Assertions</span>
                <span className="text-xl font-serif text-[#F3ECE1] font-bold">{stats.totalTests} Prompts</span>
              </div>
              <div>
                <span className="text-[10px] text-[#868072] uppercase font-mono block">Evaluation Latency</span>
                <span className="text-xl font-serif text-[#9AC59B] font-bold font-mono">Real ms</span>
              </div>
              <div>
                <span className="text-[10px] text-[#868072] uppercase font-mono block">Storage Architecture</span>
                <span className="text-xl font-serif text-[#D7B46A] font-bold">SQLite Core</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE CITADEL CITATION & PHILOSOPHY STRIP ── */}
      <section className="border-y border-[#342D21] bg-[#121114] py-7">
        <div className="max-w-[1160px] mx-auto px-5 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#282218]">
          <div className="py-3 md:py-0 md:pr-8 space-y-1">
            <span className="text-[10px] font-mono text-[#D7B46A] uppercase tracking-widest block font-bold">01 · Principle of Evidence</span>
            <h3 className="font-serif text-base text-[#F3ECE1] font-normal">Test, Never Assume.</h3>
            <p className="text-xs text-[#9E9789] leading-relaxed">
              No model is credited with capability until submitted to identical deterministic test cases with exact token evaluation.
            </p>
          </div>
          <div className="py-3 md:py-0 md:px-8 space-y-1">
            <span className="text-[10px] font-mono text-[#D7B46A] uppercase tracking-widest block font-bold">02 · Empirical Truth</span>
            <h3 className="font-serif text-base text-[#F3ECE1] font-normal">Verifiable Pass/Fail Proof.</h3>
            <p className="text-xs text-[#9E9789] leading-relaxed">
              Inspect actual model strings, error diffs, latency in milliseconds, and token consumption directly in the Colosseum.
            </p>
          </div>
          <div className="py-3 md:py-0 md:pl-8 space-y-1">
            <span className="text-[10px] font-mono text-[#D7B46A] uppercase tracking-widest block font-bold">03 · Cumulative Audit</span>
            <h3 className="font-serif text-base text-[#F3ECE1] font-normal">Preserve Every Proof.</h3>
            <p className="text-xs text-[#9E9789] leading-relaxed">
              Preserve every trial in the Imperial Archives and consult the Oracle to diagnose systemic instruction drift and formatting errors.
            </p>
          </div>
        </div>
      </section>

      {/* ── THE FOUR REALMS OF THE CITADEL ── */}
      <section className="py-24 max-w-[1160px] mx-auto px-5 w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="eyebrow mb-2">The Four Operational Chambers</div>
            <h2 className="font-serif text-[clamp(2.2rem,4.5vw,3.6rem)] font-normal leading-[1.05] tracking-tight text-[#F3ECE1]">
              Enter the Fortress of Verification.
            </h2>
          </div>
          <p className="max-w-[420px] text-xs sm:text-sm text-[#9E9789] leading-relaxed">
            The ancient citadel provides structure, dignity, and rigor to technical AI testing. Each chamber houses a distinct pillar of the evaluation lifecycle.
          </p>
        </div>

        {/* Four Chamber Navigation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {/* Chamber 1: The Lab */}
          <Link
            to="/lab"
            className="empire-card p-6 min-h-[290px] flex flex-col justify-between group relative overflow-hidden bg-gradient-to-b from-[#181615] to-[#100F12] border border-[#2B2720] hover:border-[#D7B46A]/60"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#D7B46A]/30 text-[#D7B46A] text-xl bg-[#1D1B16] shadow-inner group-hover:scale-110 transition-transform">
                <FlaskConical className="w-6 h-6" />
              </div>
              <span className="font-serif text-lg text-[#D7B46A]/40 font-bold">I</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#D7B46A] block mb-1">
                Experimentation Suite
              </span>
              <h3 className="font-serif text-2xl font-normal mb-2 text-[#F3ECE1] group-hover:text-[#F2D99B] transition-colors">
                The Lab
              </h3>
              <p className="text-xs text-[#9E9789] leading-relaxed mb-4">
                Define test cases, establish pass thresholds, probe live single prompts, and auto-generate edge-case suites.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D7B46A]">
                <span>Launch Test Cases</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          {/* Chamber 2: The Arena */}
          <Link
            to="/arena"
            className="empire-card p-6 min-h-[290px] flex flex-col justify-between group relative overflow-hidden bg-gradient-to-b from-[#181615] to-[#100F12] border border-[#2B2720] hover:border-[#D7B46A]/60"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#D7B46A]/30 text-[#D7B46A] text-xl bg-[#1D1B16] shadow-inner group-hover:scale-110 transition-transform">
                <Swords className="w-6 h-6" />
              </div>
              <span className="font-serif text-lg text-[#D7B46A]/40 font-bold">II</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#D7B46A] block mb-1">
                Head-to-Head Duel
              </span>
              <h3 className="font-serif text-2xl font-normal mb-2 text-[#F3ECE1] group-hover:text-[#F2D99B] transition-colors">
                The Arena
              </h3>
              <p className="text-xs text-[#9E9789] leading-relaxed mb-4">
                Duel contenders side-by-side. Benchmark Nova-7B or Aegis-70B against frontier models under identical constraints.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D7B46A]">
                <span>Execute Colosseum Duel</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          {/* Chamber 3: The Archives */}
          <Link
            to="/archives"
            className="empire-card p-6 min-h-[290px] flex flex-col justify-between group relative overflow-hidden bg-gradient-to-b from-[#181615] to-[#100F12] border border-[#2B2720] hover:border-[#D7B46A]/60"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#D7B46A]/30 text-[#D7B46A] text-xl bg-[#1D1B16] shadow-inner group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6" />
              </div>
              <span className="font-serif text-lg text-[#D7B46A]/40 font-bold">III</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#D7B46A] block mb-1">
                Evidence Preservation
              </span>
              <h3 className="font-serif text-2xl font-normal mb-2 text-[#F3ECE1] group-hover:text-[#F2D99B] transition-colors">
                The Archives
              </h3>
              <p className="text-xs text-[#9E9789] leading-relaxed mb-4">
                Audit every past evaluation run, inspect individual prompt token diffs, and export complete audit trails as JSON.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D7B46A]">
                <span>Inspect Stored Records</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>

          {/* Chamber 4: The Oracle */}
          <Link
            to="/oracle"
            className="empire-card p-6 min-h-[290px] flex flex-col justify-between group relative overflow-hidden bg-gradient-to-b from-[#181615] to-[#100F12] border border-[#2B2720] hover:border-[#D7B46A]/60"
          >
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border border-[#D7B46A]/30 text-[#D7B46A] text-xl bg-[#1D1B16] shadow-inner group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="font-serif text-lg text-[#D7B46A]/40 font-bold">IV</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono tracking-wider text-[#D7B46A] block mb-1">
                Diagnostic Intelligence
              </span>
              <h3 className="font-serif text-2xl font-normal mb-2 text-[#F3ECE1] group-hover:text-[#F2D99B] transition-colors">
                The Oracle
              </h3>
              <p className="text-xs text-[#9E9789] leading-relaxed mb-4">
                Run deep AI synthesis over observed failure records to discover systemic root causes and recommended next tests.
              </p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#D7B46A]">
                <span>Consult The Oracle</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </span>
            </div>
          </Link>
        </div>

        {/* ── INTERACTIVE WORKSPACE PREVIEW CONSOLE ── */}
        <div className="empire-panel border border-[#342D21] overflow-hidden shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-[#282218] bg-[#141318]">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-[#D7B46A]" />
              <h3 className="font-serif text-base text-[#F5EFE6]">
                Interactive Chamber Simulation Preview
              </h3>
            </div>
            <div className="flex items-center gap-1 mt-2 sm:mt-0">
              <button
                type="button"
                onClick={() => setActiveTab('arena')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'arena'
                    ? 'bg-[#D7B46A] text-[#121217] shadow-sm'
                    : 'text-[#9E9789] hover:text-[#F3ECE1] hover:bg-white/5'
                }`}
              >
                Colosseum Duel
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('lab')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'lab'
                    ? 'bg-[#D7B46A] text-[#121217] shadow-sm'
                    : 'text-[#9E9789] hover:text-[#F3ECE1] hover:bg-white/5'
                }`}
              >
                The Lab Probing
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('oracle')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'oracle'
                    ? 'bg-[#D7B46A] text-[#121217] shadow-sm'
                    : 'text-[#9E9789] hover:text-[#F3ECE1] hover:bg-white/5'
                }`}
              >
                Oracle Diagnostic
              </button>
            </div>
          </div>

          <div className="p-6 bg-[#0E0E12]">
            {activeTab === 'arena' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-[#9E9789]">
                  <span>Active Suite: <strong className="text-[#F3ECE1]">{firstExp ? firstExp.name : 'Reasoning & Instruction Trial'}</strong></span>
                  <Link to={firstExp ? `/arena?id=${firstExp.id}` : '/arena'} className="text-[#D7B46A] hover:underline flex items-center gap-1 font-semibold">
                    Launch in Arena <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-[#342D21] bg-[#151419] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-[#D7B46A]">Nova-7B (Imperial Fast)</span>
                      <span className="text-xs font-mono text-[#D98D82] font-bold">50.0% Pass</span>
                    </div>
                    <div className="text-[11px] font-mono p-2.5 rounded bg-black/50 text-[#E8A69A]">
                      Prompt: &quot;{firstTestCase ? firstTestCase.input_prompt : 'Is 97 prime? Answer YES or NO only.'}&quot;<br />
                      Actual: &quot;The answer is {firstTestCase ? firstTestCase.expected_output : 'YES'}.&quot; (Conversational drift)
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#8E877A]">
                      <Clock className="w-3 h-3" /> Latency: 320ms · Evaluator: Exact match
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[#2D5A32] bg-[#121914] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-serif font-bold text-sm text-[#9AC59B]">Aegis-70B (Deep Reasoning)</span>
                      <span className="text-xs font-mono text-[#9AC59B] font-bold">100.0% Pass</span>
                    </div>
                    <div className="text-[11px] font-mono p-2.5 rounded bg-black/50 text-[#C2E0C2]">
                      Prompt: &quot;{firstTestCase ? firstTestCase.input_prompt : 'Is 97 prime? Answer YES or NO only.'}&quot;<br />
                      Actual: &quot;{firstTestCase ? firstTestCase.expected_output : 'YES'}&quot; (Exact match satisfied)
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-[#8E877A]">
                      <Clock className="w-3 h-3" /> Latency: 1109ms · Evaluator: Exact match
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'lab' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-[#9E9789]">
                  <span>Single-Prompt Probing Engine</span>
                  <Link to={firstExp ? `/lab?id=${firstExp.id}` : '/lab'} className="text-[#D7B46A] hover:underline flex items-center gap-1 font-semibold">
                    Edit in The Lab <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="p-4 rounded-xl border border-[#342D21] bg-[#151419] font-mono text-xs space-y-2.5">
                  <div className="flex items-center justify-between text-[#8E877A] text-[11px]">
                    <span>INPUT_PROMPT</span>
                    <span className="text-[#D7B46A]">{firstTestCase?.evaluation_method || 'Exact match criteria'}</span>
                  </div>
                  <div className="p-2.5 rounded bg-black/60 text-[#F5EFE6]">
                    &quot;{firstTestCase ? firstTestCase.input_prompt : 'Subtract 37 from 100, then divide the result by 9. Respond with the number only.'}&quot;
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-[#8E877A]">EXPECTED_OUTPUT: <strong className="text-[#D7B46A]">&quot;{firstTestCase ? firstTestCase.expected_output : '7'}&quot;</strong></span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#9AC59B]/20 text-[#9AC59B]">
                      VERIFIED REASONING
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'oracle' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-[#9E9789]">
                  <span>Empirical Archive Root-Cause Synthesis</span>
                  <Link to="/oracle" className="text-[#D7B46A] hover:underline flex items-center gap-1 font-semibold">
                    Consult Full Oracle <ArrowUpRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="p-4 rounded-xl border border-[#342D21] bg-[#151419] space-y-3 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#D7B46A]" />
                    <span className="font-serif font-bold text-sm text-[#F5EFE6]">
                      Synthesis: Instruction Compliance Decay Under Negative Constraints
                    </span>
                  </div>
                  <p className="text-xs text-[#9E9789] leading-relaxed">
                    Evaluator scans confirm that conversational preambles occur when models encounter negative constraints (&quot;NO commentary&quot;) at the very end of the prompt context.
                  </p>
                  <div className="p-2.5 rounded bg-black/40 border border-white/5 text-[11px] text-[#C2E3C5] font-mono">
                    Remediation: Prepend 2 negative few-shot exemplars and pin temperature to 0.0.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── INSTITUTIONAL TRUST & DATA PRIVACY BANNER ── */}
      <section className="pb-24 max-w-[1160px] mx-auto px-5 w-full">
        <div className="relative p-8 sm:p-14 rounded-2xl border border-[#3A3225] overflow-hidden bg-gradient-to-r from-[#171518] to-[#121114]">
          <div className="relative z-10 max-w-[660px]">
            <div className="eyebrow mb-2">Institutional AI Governance</div>
            <h2 className="font-serif text-3xl sm:text-4xl font-normal leading-[1.08] tracking-tight mb-4 text-[#F5EFE6]">
              Engineered for teams that demand verifiable reliability.
            </h2>
            <p className="text-[#9E9789] text-xs sm:text-sm leading-relaxed mb-8">
              Whether running sovereign local models on Ollama or frontier commercial models from OpenAI and Gemini, Empire Arena unifies evaluation with strict, reproducible evidence.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/lab"
                className="btn-primary min-h-[46px] px-6 rounded-lg inline-flex items-center gap-2 text-xs uppercase tracking-wider font-extrabold cursor-pointer"
              >
                <span>Create an Experiment</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                to="/archives"
                className="btn-secondary min-h-[46px] px-6 rounded-lg inline-flex items-center gap-2 text-xs uppercase tracking-wider font-bold cursor-pointer"
              >
                <span>Browse Archive Records</span>
              </Link>
              <button
                type="button"
                onClick={() => setProviderModalOpen(true)}
                className="min-h-[46px] px-4 rounded-lg inline-flex items-center gap-2 text-xs border border-[#3E382A] text-[#D7B46A] hover:bg-[#1D1B16] transition-colors cursor-pointer"
              >
                <Activity className="w-4 h-4" />
                <span>Configure Live Engine</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        onProvidersUpdated={() => {
          EmpireApi.getModels().then((models) => {
            setStats((prev) => ({ ...prev, activeModels: models.length }));
          });
        }}
      />
    </div>
  );
};
