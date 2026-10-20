import React, { useState } from 'react';
import { Shield, KeyRound, Lock, Unlock, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { EmpireApi } from '../services/empireApi';

interface OperatorGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated?: () => void;
}

export const OperatorGateModal: React.FC<OperatorGateModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) {
      setErrorMsg('Operator key is required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await EmpireApi.login(keyInput.trim());
      setSuccessMsg(res.message || 'Operator session unlocked.');
      setKeyInput('');
      setTimeout(() => {
        if (onAuthenticated) onAuthenticated();
        onClose();
        setSuccessMsg(null);
      }, 700);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid operator key';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-2xl border border-[rgba(215,180,106,0.3)] bg-[#121216] shadow-2xl p-6 overflow-hidden">
        {/* Decorative corner accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-radial from-[#d7b46a]/15 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#241E14] border border-[#D7B46A]/40 flex items-center justify-center text-[#D7B46A]">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-lg text-[#F5EFE6] font-bold">Citadel Access Gate</h3>
              <p className="text-[11px] text-[#A69E90]">Operator Authentication & Session Verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8C8477] hover:text-[#F3ECE1] transition-colors p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#B8AD9B] leading-relaxed mb-5">
          This Empire Arena instance enforces a single-tenant access boundary. Enter your operator deployment key to unlock experiment creation, evaluation execution, provider settings, and system maintenance.
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-[#2A1515] border border-[#662828] text-xs text-[#F0B8B2] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#D98D82]" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-[#152518] border border-[#2D5A32] text-xs text-[#BEE3C0] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#9AC59B]" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#E5DDD0] mb-1.5 uppercase tracking-wider">
              Operator Deployment Key
            </label>
            <div className="relative">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="empire_sec_..."
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-lg border border-white/12 bg-[#0a0a0c] text-sm text-[#F5EFE6] placeholder-[#6A6458] font-mono focus:border-[#D7B46A] focus:outline-none"
              />
              <KeyRound className="w-4 h-4 text-[#8C8477] absolute right-3 top-3 pointer-events-none" />
            </div>
            <p className="text-[10px] text-[#868072] mt-1.5 flex items-center gap-1">
              <Lock className="w-3 h-3 text-[#D7B46A]" />
              Authenticates via secure, HttpOnly signed session cookies. The raw secret is never stored in browser localStorage or frontend bundles.
            </p>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs border border-white/10 text-[#B8AD9B] hover:text-[#F3ECE1] hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-lg text-xs font-bold bg-[#D7B46A] hover:bg-[#F2D99B] text-[#14120D] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>{loading ? 'Verifying...' : 'Unlock Operator Access'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
