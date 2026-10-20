import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { EmpireApi } from '../services/empireApi';
import type { Experiment, EvaluationRun } from '../types/empire';
import { 
  Search, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  Download, 
  X, 
  Clock, 
  Calendar,
  AlertCircle
} from 'lucide-react';

export const ArchivesPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter] = useState('all');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Run inspection modal state
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [selectedExperiment, setSelectedExperiment] = useState<Experiment | null>(null);
  const [runs, setRuns] = useState<EvaluationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<EvaluationRun | null>(null);

  const fetchArchives = useCallback(() => {
    setLoading(true);
    EmpireApi.getExperiments({
      search: search || undefined,
      status: statusFilter,
      category: categoryFilter
    })
      .then(setExperiments)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    fetchArchives();
  }, [fetchArchives]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchArchives();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete "${name}" and all its recorded evaluation runs from the SQLite database?`)) {
      return;
    }
    setErrorMsg(null);
    try {
      await EmpireApi.deleteExperiment(id);
      setNotice(`Experiment "${name}" deleted from database.`);
      fetchArchives();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Deletion error';
      setErrorMsg(`Deletion error: ${msg}`);
    }
  };

  const handleInspect = async (exp: Experiment) => {
    setSelectedExperiment(exp);
    setInspectModalOpen(true);
    setInspectLoading(true);
    try {
      const runList = await EmpireApi.getRuns(exp.id);
      setRuns(runList);
      setSelectedRun(runList.length > 0 ? runList[0] : null);
    } catch (err) {
      console.error('Failed to load runs:', err);
    } finally {
      setInspectLoading(false);
    }
  };

  const handleExportJson = () => {
    if (!selectedExperiment) return;
    const exportData = {
      experiment: selectedExperiment,
      runs: runs
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `empire-arena-${selectedExperiment.id}-evidence.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalCount = experiments.length;
  const completeCount = experiments.filter(e => e.status === 'Complete').length;
  const draftCount = experiments.filter(e => e.status === 'Draft').length;
  const reviewCount = experiments.filter(e => e.status === 'Needs review').length;

  return (
    <div className="pb-28">
      {/* ── HERO BANNER ── */}
      <section className="relative overflow-hidden py-16 border-b border-white/6 bg-[radial-gradient(ellipse_at_83%_25%,rgba(147,99,36,0.18),transparent_35%),linear-gradient(115deg,#171413,#0b0b0d_75%)]">
        <div className="max-w-[1160px] mx-auto px-5">
          <div className="flex items-center gap-2 text-xs text-[#82796e] mb-4">
            <Link to="/" className="hover:text-[#f2d99b]">Empire</Link>
            <span>›</span>
            <span className="text-[#f3ead8]">The Archives</span>
          </div>

          <div className="eyebrow mb-2">Realm 03 · The Record Hall</div>
          <h1 className="font-serif text-[clamp(2.5rem,6vw,4.8rem)] leading-[0.98] tracking-[-0.05em] font-normal text-[#f3ead8] mb-4">
            What is tested<br />must be <span className="gold-text font-serif">remembered.</span>
          </h1>
          <p className="max-w-[650px] text-[1.02rem] text-[#b8ad9b] leading-relaxed">
            Keep your experiments, preserve the evidence, and return to earlier evaluation runs whenever you need to understand how an AI model behaved.
          </p>
          <div className="flex flex-wrap gap-5 mt-6 text-xs text-[#9c9182]">
            <span>◇ Experiment History</span>
            <span>✦ Complete Prompt &amp; Latency Evidence</span>
            <span>⌕ Searchable SQLite Records</span>
          </div>
        </div>
      </section>

      {/* ── MAIN ARCHIVES SECTION ── */}
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

        {/* Toolbar: Search, Filters, New Experiment */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-5 rounded-xl border border-white/9 bg-[#151416] mb-8">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex items-center gap-2">
            <div className="relative w-full max-w-[340px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#82796e]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search records by name or objective..."
                className="w-full pl-9 pr-3.5 py-2 rounded-lg border border-white/12 bg-[#0e0e10] text-xs text-[#f3ead8] focus:border-[#d7b46a] focus:outline-none"
              />
            </div>
            <button type="submit" className="btn-secondary px-3 py-2 rounded-lg text-xs cursor-pointer">
              Search
            </button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-white/12 bg-[#0e0e10] text-xs text-[#f3ead8] focus:border-[#d7b46a] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="Complete">Complete</option>
              <option value="Draft">Draft</option>
              <option value="Needs review">Needs review</option>
            </select>

            <Link
              to="/lab"
              className="btn-primary min-h-[38px] px-4 rounded-lg inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer"
            >
              <span>+ New Experiment</span>
            </Link>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <div className="empire-panel p-4">
            <span className="text-[10px] text-[#82796e] uppercase tracking-wider block">ALL RECORDS</span>
            <strong className="font-serif text-3xl text-[#f0dfbd] block mt-1">
              {String(totalCount).padStart(2, '0')}
            </strong>
            <small className="text-[#8f8578] text-[11px]">Saved in database</small>
          </div>

          <div className="empire-panel p-4">
            <span className="text-[10px] text-[#82796e] uppercase tracking-wider block">COMPLETE</span>
            <strong className="font-serif text-3xl text-[#9ac59b] block mt-1">
              {String(completeCount).padStart(2, '0')}
            </strong>
            <small className="text-[#8f8578] text-[11px]">Pass criteria met</small>
          </div>

          <div className="empire-panel p-4">
            <span className="text-[10px] text-[#82796e] uppercase tracking-wider block">DRAFTS</span>
            <strong className="font-serif text-3xl text-[#f2d99b] block mt-1">
              {String(draftCount).padStart(2, '0')}
            </strong>
            <small className="text-[#8f8578] text-[11px]">Awaiting trial run</small>
          </div>

          <div className="empire-panel p-4">
            <span className="text-[10px] text-[#82796e] uppercase tracking-wider block">NEEDS REVIEW</span>
            <strong className="font-serif text-3xl text-[#d98d82] block mt-1">
              {String(reviewCount).padStart(2, '0')}
            </strong>
            <small className="text-[#8f8578] text-[11px]">Failures identified</small>
          </div>
        </div>

        {/* Records Listing & Archive Protocols */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)] gap-6 items-start">
          {/* Main List */}
          <div className="empire-panel">
            <div className="flex items-center justify-between p-5 border-b border-white/7">
              <div>
                <h2 className="font-serif text-xl text-[#f3ead8]">Experiment Records</h2>
                <p className="text-xs text-[#82796e] mt-0.5">Click any record to inspect test cases or launch Arena trials.</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full border border-[rgba(215,180,106,0.22)] text-[#f2d99b] text-[10px] font-mono">
                ARCHIVE INDEX
              </span>
            </div>

            <div className="divide-y divide-white/6">
              {loading ? (
                <div className="p-12 text-center text-xs text-[#82796e] flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-[#d7b46a]" />
                  <span>Loading records from database...</span>
                </div>
              ) : experiments.length > 0 ? (
                experiments.map((exp) => (
                  <div key={exp.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/2 transition-colors">
                    <div>
                      <h3 className="font-serif text-lg text-[#f3ead8] mb-1">
                        {exp.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#82796e]">
                        <span className="text-[#d7b46a]">{exp.category}</span>
                        <span>·</span>
                        <span>{exp.target_model}</span>
                        <span>·</span>
                        <span>{exp.test_cases?.length || 0} cases</span>
                        <span>·</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          exp.status === 'Complete' ? 'bg-[#9ac59b]/15 text-[#9ac59b]' :
                          exp.status === 'Draft' ? 'bg-[#f2d99b]/15 text-[#f2d99b]' :
                          'bg-[#d98d82]/15 text-[#d98d82]'
                        }`}>
                          {exp.status}
                        </span>
                      </div>
                      {exp.description && (
                        <p className="text-xs text-[#b8ad9b] mt-1.5 line-clamp-1">
                          {exp.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleInspect(exp)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#21201B] hover:bg-[#2B2922] border border-[#3E382A] text-[#D7B46A] flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Inspect historical runs and prompt evidence"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Evidence</span>
                      </button>

                      <Link
                        to={`/arena?id=${exp.id}`}
                        className="btn-primary px-3 py-1.5 rounded-lg text-xs font-bold"
                      >
                        Run Arena
                      </Link>
                      <Link
                        to={`/lab?id=${exp.id}`}
                        className="btn-secondary px-3 py-1.5 rounded-lg text-xs"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(exp.id, exp.name)}
                        className="p-2 rounded-lg text-[#82796e] hover:text-[#d98d82] hover:bg-white/4 transition-colors cursor-pointer"
                        title="Delete from database"
                        aria-label={`Delete ${exp.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-xs text-[#82796e]">
                  No records match your query. Create a new experiment in The Lab.
                </div>
              )}
            </div>
          </div>

          {/* Right Aside: Archive Protocol */}
          <div className="space-y-4">
            <div className="empire-panel p-5">
              <h3 className="font-serif text-base text-[#f3ead8] mb-1">Archive Protocol</h3>
              <p className="text-xs text-[#82796e] mb-4">Required constituents of an inspectable evidence record.</p>

              <div className="space-y-3">
                <div className="flex gap-3 items-start text-xs text-[#c9beac]">
                  <span className="w-6 h-6 rounded-md bg-[rgba(215,180,106,0.1)] text-[#f2d99b] flex items-center justify-center font-serif shrink-0">
                    01
                  </span>
                  <div>
                    <strong className="block text-[#e0d4bf]">Experiment Definition</strong>
                    <span className="text-[#82796e]">Clear objective, category, and pass criteria.</span>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-xs text-[#c9beac]">
                  <span className="w-6 h-6 rounded-md bg-[rgba(215,180,106,0.1)] text-[#f2d99b] flex items-center justify-center font-serif shrink-0">
                    02
                  </span>
                  <div>
                    <strong className="block text-[#e0d4bf]">Test Inputs &amp; Outputs</strong>
                    <span className="text-[#82796e]">Exact prompt, expected output, and actual response.</span>
                  </div>
                </div>

                <div className="flex gap-3 items-start text-xs text-[#c9beac]">
                  <span className="w-6 h-6 rounded-md bg-[rgba(215,180,106,0.1)] text-[#f2d99b] flex items-center justify-center font-serif shrink-0">
                    03
                  </span>
                  <div>
                    <strong className="block text-[#e0d4bf]">Scoring Evidence</strong>
                    <span className="text-[#82796e]">Pass/fail reasoning and evaluator method diff.</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-lg border border-[rgba(215,180,106,0.18)] bg-[rgba(215,180,106,0.04)] text-[11px] text-[#cdbd9d]">
                All records survive browser refresh and server restarts. Backed by persistent SQLite storage.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── HISTORICAL RUN EVIDENCE INSPECTION MODAL ── */}
      {inspectModalOpen && selectedExperiment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div 
            role="dialog" 
            aria-modal="true" 
            aria-label="Run Audit Inspection Chamber"
            className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-[#0F0F13] border border-[#3A3225] rounded-xl shadow-2xl overflow-hidden text-[#E4DFD5]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#28241D] bg-[#14141A]">
              <div>
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-[#D7B46A]" />
                  <h3 className="font-serif text-lg text-[#F5EFE6]">{selectedExperiment.name}</h3>
                </div>
                <p className="text-xs text-[#9E9789] mt-0.5">
                  Inspection Chamber · {runs.length} recorded evaluation trial(s) in SQLite
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="px-3 py-1.5 text-xs bg-[#24211A] hover:bg-[#342D21] border border-[#443825] text-[#D7B46A] rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Export complete trial evidence as JSON"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export Evidence</span>
                </button>
                <button
                  onClick={() => setInspectModalOpen(false)}
                  className="p-1.5 text-[#8E877A] hover:text-[#F3ECE1] hover:bg-[#201F26] rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Runs Selector Sidebar */}
              <div className="w-72 border-r border-[#28241D] bg-[#121217] p-3 overflow-y-auto space-y-1.5">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[#7A7468] font-semibold">
                  Trial Execution Runs
                </div>

                {inspectLoading ? (
                  <div className="p-4 text-xs text-[#9E9789] flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D7B46A]" /> Querying Archives...
                  </div>
                ) : runs.length > 0 ? (
                  runs.map((r) => {
                    const isSelected = selectedRun?.id === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedRun(r)}
                        className={`w-full text-left p-3 rounded-lg text-xs transition-all border ${
                          isSelected
                            ? 'bg-[#22201C] text-[#F3ECE1] border-[#D7B46A]/50 shadow-sm'
                            : 'bg-transparent border-transparent text-[#B4ADA2] hover:bg-[#18181F] hover:text-[#ECE7DC]'
                        }`}
                      >
                        <div className="flex items-center justify-between font-serif font-bold text-sm text-[#F5EFE6]">
                          <span className="flex items-center gap-1.5">
                            <span className="text-xs">
                              {r.execution_tier === 'local' || r.provider_type === 'ollama' ? '💻' : !r.is_simulation ? '⚡' : '🏛️'}
                            </span>
                            <span>{r.model_name}</span>
                          </span>
                          <span className={r.pass_rate >= 80 ? 'text-[#9AC59B]' : 'text-[#D98D82]'}>
                            {r.pass_rate}%
                          </span>
                        </div>
                        <div className="text-[11px] text-[#868072] mt-1 flex items-center justify-between">
                          <span>{r.passed_tests}/{r.total_tests} passed</span>
                          <span className="flex items-center gap-1 font-mono text-[10px]">
                            <Calendar className="w-3 h-3" />
                            {new Date(r.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="p-4 text-xs text-[#7A7468] italic">
                    No runs recorded yet for this experiment.
                  </div>
                )}
              </div>

              {/* Run Results Detail Table */}
              <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-[#0F0F13]">
                {selectedRun ? (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[#151419] border border-[#2B2720]">
                      <div>
                        <div className="text-xs font-serif text-[#F5EFE6]">
                          Run ID: <span className="font-mono text-[#D7B46A]">{selectedRun.id}</span>
                        </div>
                        <div className="text-[11px] text-[#8C8578] mt-0.5">
                          Notes: {selectedRun.notes || 'None recorded'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {selectedRun.execution_tier === 'local' || selectedRun.provider_type === 'ollama' ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#8AC0E2]/15 text-[#8AC0E2] border border-[#8AC0E2]/30 font-bold">
                              💻 Local LLM (Ollama)
                            </span>
                          ) : !selectedRun.is_simulation ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#9AC59B]/15 text-[#9AC59B] border border-[#9AC59B]/30 font-bold">
                              ⚡ Cloud Frontier ({selectedRun.provider_type?.toUpperCase()})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-[#D7B46A]/15 text-[#D7B46A] border border-[#D7B46A]/30">
                              🏛️ Imperial Simulator
                            </span>
                          )}
                          {selectedRun.snapshot_json && selectedRun.snapshot_json !== '{}' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono tracking-wider bg-white/5 text-[#B8AD9B] border border-white/10">
                              🔒 Immutable Audit Snapshot
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2.5 py-1 rounded text-xs font-bold ${
                          selectedRun.pass_rate >= 80 ? 'bg-[#9AC59B]/20 text-[#9AC59B]' : 'bg-[#D98D82]/20 text-[#D98D82]'
                        }`}>
                          {selectedRun.status} ({selectedRun.pass_rate}%)
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {selectedRun.results && selectedRun.results.length > 0 ? (
                        selectedRun.results.map((res, i) => (
                          <div
                            key={res.id || i}
                            className="p-3.5 rounded-lg border border-[#25221B] bg-[#141419] space-y-2 text-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-[#E5DDD0]">
                                Assertion #{i + 1}
                              </span>
                              <div className="flex items-center gap-2">
                                {res.latency_ms !== undefined && res.latency_ms > 0 && (
                                  <span className="text-[10px] text-[#868072] flex items-center gap-0.5 font-mono">
                                    <Clock className="w-3 h-3" /> {res.latency_ms} ms
                                  </span>
                                )}
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                                  res.passed ? 'bg-[#9AC59B]/15 text-[#9AC59B]' : 'bg-[#D98D82]/15 text-[#D98D82]'
                                }`}>
                                  {res.passed ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  <span>{res.passed ? 'PASS' : 'FAIL'}</span>
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase text-[#7A7468]">Prompt Input</span>
                                <div className="p-2 rounded bg-black/40 font-mono text-[11px] text-[#DDD6C9]">
                                  {res.input_prompt}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase text-[#7A7468]">Expected Baseline</span>
                                <div className="p-2 rounded bg-black/40 font-mono text-[11px] text-[#D7B46A]">
                                  {res.expected_output}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] uppercase text-[#7A7468]">Actual Model Output</span>
                              <div className={`p-2 rounded font-mono text-[11px] ${
                                res.passed ? 'bg-[#152518]/50 text-[#C2E0C2]' : 'bg-[#2A1515]/50 text-[#F0B8B2]'
                              }`}>
                                {res.actual_output || '<no output produced>'}
                              </div>
                            </div>

                            {res.error_details && (
                              <div className="text-[11px] text-[#D98D82] pt-1">
                                Evaluator: {res.error_details}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-6 text-center text-xs text-[#7A7468]">
                          No individual assertion logs recorded for this run.
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center text-xs text-[#7A7468]">
                    Select a trial execution run from the left to inspect its assertion evidence.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
