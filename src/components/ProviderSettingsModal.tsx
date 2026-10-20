import React, { useState, useEffect } from 'react';
import { 
  X, 
  Key, 
  Globe, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Zap, 
  Eye, 
  EyeOff, 
  Cpu, 
  ShieldCheck, 
  Layers, 
  RefreshCw,
  Plus,
  Trash2
} from 'lucide-react';
import { EmpireApi } from '../services/empireApi';
import type { ProviderSetting, TestConnectionResult } from '../types/empire';

interface ProviderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProvidersUpdated?: () => void;
}

const PROVIDER_ICONS: Record<string, string> = {
  openai: '🌐',
  gemini: '💎',
  groq: '⚡',
  anthropic: '🏛️',
  ollama: '🦙',
  custom: '⚙️'
};

export const ProviderSettingsModal: React.FC<ProviderSettingsModalProps> = ({
  isOpen,
  onClose,
  onProvidersUpdated
}) => {
  const [providers, setProviders] = useState<ProviderSetting[]>([]);
  const [selectedId, setSelectedId] = useState<string>('openai');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResult | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

  // Form edit state for currently selected provider
  const [currentKey, setCurrentKey] = useState<string>('');
  const [currentBaseUrl, setCurrentBaseUrl] = useState<string>('');
  const [currentEnabled, setCurrentEnabled] = useState<boolean>(false);
  const [currentModels, setCurrentModels] = useState<string[]>([]);
  const [newModelInput, setNewModelInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);

  const selectProvider = (p: ProviderSetting) => {
    setSelectedId(p.id);
    setCurrentKey(p.api_key_masked || '');
    setCurrentBaseUrl(p.base_url || '');
    setCurrentEnabled(p.is_enabled);
    setCurrentModels([...(p.models || [])]);
    setTestResult(null);
    setSaveSuccess(null);
    setSaveError(null);
    setShowKey(false);
  };

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    EmpireApi.getProviders()
      .then((data) => {
        if (!isMounted) return;
        setProviders(data);
        if (data.length > 0) {
          setSelectedId((prev) => {
            const initial = data.find((p) => p.id === prev) || data[0];
            setCurrentKey(initial.api_key_masked || '');
            setCurrentBaseUrl(initial.base_url || '');
            setCurrentEnabled(initial.is_enabled);
            setCurrentModels([...(initial.models || [])]);
            return initial.id;
          });
          setTestResult(null);
          setSaveSuccess(null);
          setSaveError(null);
          setShowKey(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load providers:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const activeProvider = providers.find((p) => p.id === selectedId);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!activeProvider) return;
    try {
      setSaving(true);
      setSaveSuccess(null);
      setSaveError(null);
      const payload: {
        api_key?: string;
        base_url?: string;
        is_enabled?: boolean;
        models?: string[];
      } = {
        base_url: currentBaseUrl,
        is_enabled: currentEnabled,
        models: currentModels
      };

      // Only send api_key if the user altered it away from the masked bullet string
      if (currentKey && !currentKey.includes('•')) {
        payload.api_key = currentKey;
      }

      const updated = await EmpireApi.updateProvider(activeProvider.id, payload);
      setProviders((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setCurrentKey(updated.api_key_masked || '');
      setCurrentBaseUrl(updated.base_url || '');
      setCurrentEnabled(updated.is_enabled);
      setCurrentModels([...(updated.models || [])]);
      setSaveSuccess(`Settings for ${updated.name} preserved in Imperial Vault.`);
      if (onProvidersUpdated) onProvidersUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration';
      setSaveError(`Error saving provider: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!activeProvider) return;
    try {
      setTesting(true);
      setTestResult(null);
      const res = await EmpireApi.testProvider({
        provider_id: activeProvider.id,
        api_key: currentKey.includes('•') ? undefined : currentKey,
        base_url: currentBaseUrl,
        model_name: currentModels[0] || undefined
      });
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed';
      setTestResult({
        success: false,
        message: msg
      });
    } finally {
      setTesting(false);
    }
  };

  const handleAddModel = () => {
    const trimmed = newModelInput.trim();
    if (trimmed && !currentModels.includes(trimmed)) {
      setCurrentModels([...currentModels, trimmed]);
      setNewModelInput('');
    }
  };

  const handleRemoveModel = (modelToRemove: string) => {
    setCurrentModels(currentModels.filter((m) => m !== modelToRemove));
  };

  const totalEnabled = providers.filter((p) => p.is_enabled).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div 
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-[#0F0F13] border border-[#3A3225] rounded-xl shadow-2xl overflow-hidden text-[#E4DFD5]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#28241D] bg-[#14141A]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#D7B46A]/10 border border-[#D7B46A]/30 flex items-center justify-center text-[#D7B46A]">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-serif tracking-wide text-[#F3ECE1]">
                Imperial AI Engine & Provider Citadel
              </h2>
              <p className="text-xs text-[#9E9789]">
                Configure real frontier models (OpenAI, Gemini, Groq, Anthropic, Ollama) alongside imperial simulators
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-[#9E9789] hover:text-[#F3ECE1] hover:bg-[#201F26] transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Layout */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Provider Sidebar Tabs */}
          <div className="w-64 border-r border-[#28241D] bg-[#121217] p-3 overflow-y-auto space-y-1">
            <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-[#7A7468] font-semibold">
              External AI Providers
            </div>
            {loading ? (
              <div className="p-4 text-xs text-[#9E9789] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#D7B46A]" /> Querying Vault...
              </div>
            ) : (
              providers.map((p) => {
                const isSelected = p.id === selectedId;
                const icon = PROVIDER_ICONS[p.provider_type] || '🌐';
                return (
                  <button
                    key={p.id}
                    onClick={() => selectProvider(p)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#22201C] text-[#F3ECE1] border border-[#D7B46A]/40 shadow-sm'
                        : 'text-[#B4ADA2] hover:bg-[#18181F] hover:text-[#ECE7DC]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="text-base">{icon}</span>
                      <span className="truncate">{p.name}</span>
                    </div>
                    {p.is_enabled ? (
                      <span className="w-2 h-2 rounded-full bg-[#9AC59B] shadow-[0_0_6px_#9AC59B]" title="Active Provider" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#3F3C36]" title="Inactive" />
                    )}
                  </button>
                );
              })
            )}

            <div className="pt-4 px-3 border-t border-[#201E19] mt-3">
              <div className="text-[11px] text-[#868072] leading-relaxed">
                <span className="text-[#D7B46A] font-semibold">Built-in Imperial Simulators</span> (Nova-7B, Meridian-13B, Aegis-70B) are always active for zero-setup offline evaluation.
              </div>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="flex-1 p-6 overflow-y-auto space-y-5 bg-[#0F0F13]">
            {activeProvider ? (
              <>
                {/* Active Provider Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#23201A]">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{PROVIDER_ICONS[activeProvider.provider_type] || '🌐'}</span>
                      <h3 className="text-base font-serif text-[#F5EFE6]">{activeProvider.name}</h3>
                      <span className="px-2 py-0.5 text-[10px] rounded border border-[#3A3428] text-[#D7B46A] bg-[#221F17]">
                        {activeProvider.provider_type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-[#9E9789] mt-1">
                      Enabling this provider exposes its frontier models across The Lab, The Arena, and The Oracle.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <span className="text-xs font-medium text-[#C8C2B6]">
                      {currentEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={currentEnabled}
                        onChange={(e) => setCurrentEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-[#26242B] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#ECE6D8] after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#9AC59B]" />
                    </div>
                  </label>
                </div>

                {/* API Key */}
                <div className="space-y-1.5">
                  <label className="flex items-center justify-between text-xs font-medium text-[#C8C2B6]">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-[#D7B46A]" />
                      API Key {activeProvider.provider_type === 'ollama' ? '(Optional for local)' : ''}
                    </span>
                    {activeProvider.has_api_key && (
                      <span className="text-[10px] text-[#9AC59B] flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Key saved in vault
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      value={currentKey}
                      onChange={(e) => setCurrentKey(e.target.value)}
                      placeholder={activeProvider.has_api_key ? '••••••••••••••••' : 'Enter API Key (sk-...)'}
                      className="w-full px-3 py-2 pr-10 text-xs bg-[#16161D] border border-[#2D2922] rounded-lg text-[#F5EFE6] focus:outline-none focus:border-[#D7B46A] placeholder-[#5A554A] font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-2.5 top-2 text-[#7C7669] hover:text-[#D7B46A]"
                      aria-label={showKey ? 'Mask API key' : 'Show API key'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-[#7A7468]">
                    API keys are stored securely in local SQLite and never transmitted outside your direct model requests.
                  </p>
                </div>

                {/* Base URL */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-[#C8C2B6]">
                    <Globe className="w-3.5 h-3.5 text-[#D7B46A]" />
                    Base Endpoint URL
                  </label>
                  <input
                    type="text"
                    value={currentBaseUrl}
                    onChange={(e) => setCurrentBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 text-xs bg-[#16161D] border border-[#2D2922] rounded-lg text-[#F5EFE6] focus:outline-none focus:border-[#D7B46A] placeholder-[#5A554A] font-mono"
                  />
                  <p className="text-[11px] text-[#7A7468]">
                    Default: <code className="text-[#B5AA96]">{activeProvider.base_url || 'Default SDK URL'}</code>
                  </p>
                </div>

                {/* Configured Models */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-[#C8C2B6]">
                    <Layers className="w-3.5 h-3.5 text-[#D7B46A]" />
                    Available Models for this Provider
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {currentModels.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-[#1B1B22] border border-[#343026] text-[#E0D8CB]"
                      >
                        <span className="font-mono">{m}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveModel(m)}
                          className="text-[#847E72] hover:text-[#D98D82] transition-colors"
                          aria-label={`Remove model ${m}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={newModelInput}
                      onChange={(e) => setNewModelInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddModel();
                        }
                      }}
                      placeholder="Add model name (e.g. gpt-4o, llama-3.3-70b-versatile)..."
                      className="flex-1 px-3 py-1.5 text-xs bg-[#16161D] border border-[#2D2922] rounded-lg text-[#F5EFE6] focus:outline-none focus:border-[#D7B46A] placeholder-[#5A554A] font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleAddModel}
                      className="px-3 py-1.5 text-xs bg-[#24221C] hover:bg-[#322E25] border border-[#443C2E] text-[#D7B46A] rounded-lg flex items-center gap-1 font-medium transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add
                    </button>
                  </div>
                </div>

                {/* Connection Test Output */}
                {testResult && (
                  <div
                    className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                      testResult.success
                        ? 'bg-[#152518]/60 border-[#2D5A32] text-[#BEE3C0]'
                        : 'bg-[#2A1515]/60 border-[#662828] text-[#F0B8B2]'
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-[#9AC59B] shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-[#D98D82] shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="font-semibold">{testResult.message}</div>
                      {testResult.latency_ms !== undefined && (
                        <div className="text-[11px] opacity-80">
                          Round-trip Latency: <span className="font-mono font-bold">{testResult.latency_ms} ms</span>
                        </div>
                      )}
                      {testResult.output_preview && (
                        <div className="mt-1 p-1.5 bg-black/40 rounded font-mono text-[10px] break-all">
                          Preview: {testResult.output_preview}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {saveSuccess && (
                  <div className="p-2.5 rounded-lg bg-[#162719] border border-[#2F6136] text-xs text-[#9AC59B] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>{saveSuccess}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSaveSuccess(null)}
                      className="text-xs text-[#a8a29e] hover:text-[#f3ead8] underline ml-2 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {saveError && (
                  <div className="p-2.5 rounded-lg bg-[#2A1515]/60 border border-[#662828] text-xs text-[#F0B8B2] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#D98D82] shrink-0" />
                      <span>{saveError}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSaveError(null)}
                      className="text-xs text-[#a8a29e] hover:text-[#f3ead8] underline ml-2 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-4 border-t border-[#23201A]">
                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testing}
                    className="px-3.5 py-2 text-xs rounded-lg border border-[#4A4232] bg-[#18171F] hover:bg-[#22202B] text-[#D7B46A] flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {testing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-[#D7B46A]" />
                    )}
                    {testing ? 'Probing Connection...' : 'Test Connection'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-3.5 py-2 text-xs rounded-lg border border-[#343026] text-[#A69F90] hover:text-[#E0D8CB] hover:bg-[#181820] transition-colors"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D7B46A] text-[#121217] hover:bg-[#E5C782] shadow-sm flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5" />
                      )}
                      {saving ? 'Preserving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-xs text-[#7A7468]">
                Select a provider from the citadel sidebar to configure.
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-2.5 border-t border-[#28241D] bg-[#121216] flex items-center justify-between text-[11px] text-[#7E786B]">
          <div>
            Active external providers: <span className="font-semibold text-[#D7B46A]">{totalEnabled}</span> of {providers.length}
          </div>
          <div>
            Empire Arena Real Model Gateway v1.0
          </div>
        </div>
      </div>
    </div>
  );
};
