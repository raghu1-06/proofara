import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronRight, Cpu, Lock, Unlock } from 'lucide-react';
import { ProviderSettingsModal } from './ProviderSettingsModal';
import { OperatorGateModal } from './OperatorGateModal';
import { EmpireApi } from '../services/empireApi';

interface NavbarProps {
  apiStatus?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ apiStatus = 'connected' }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [gateModalOpen, setGateModalOpen] = useState(false);
  const [enabledProviderCount, setEnabledProviderCount] = useState<number>(0);
  const [authStatus, setAuthStatus] = useState<{ auth_required: boolean; authenticated: boolean }>({
    auth_required: false,
    authenticated: true
  });
  const location = useLocation();

  const loadProviderCount = async () => {
    try {
      const providers = await EmpireApi.getProviders();
      const active = providers.filter((p) => p.is_enabled).length;
      setEnabledProviderCount(active);
    } catch {
      // Backend may be starting up or requires auth
    }
  };

  const checkAuthStatus = async () => {
    try {
      const status = await EmpireApi.getAuthStatus();
      setAuthStatus(status);
    } catch {
      // Backend offline or error
    }
  };

  useEffect(() => {
    loadProviderCount();
    checkAuthStatus();
  }, []);

  const handleLogout = async () => {
    try {
      await EmpireApi.logout();
      setAuthStatus((prev) => ({ ...prev, authenticated: false }));
    } catch {
      // ignore
    }
  };

  const navLinks = [
    { path: '/', label: 'The Empire' },
    { path: '/lab', label: 'The Lab' },
    { path: '/arena', label: 'The Arena' },
    { path: '/archives', label: 'The Archives' },
    { path: '/oracle', label: 'The Oracle' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <header className="imperial-header sticky top-0 z-40 border-b border-white/10 bg-[#0b0b0d]/92 backdrop-blur-md">
        <div className="imperial-rule" aria-hidden="true" />
        <div className="max-w-[1160px] mx-auto px-5 min-h-[82px] flex items-center justify-between gap-6">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 select-none group" aria-label="Empire Arena homepage">
            <div className="imperial-seal group-hover:scale-105 transition-transform" aria-hidden="true">
              <span>E</span>
            </div>
            <div>
              <span className="block font-serif text-[0.98rem] tracking-[0.18em] text-[#f3ead8]">
                EMPIRE ARENA
              </span>
              <span className="block text-[0.56rem] tracking-[0.24em] text-[#b9ad97] font-semibold uppercase">
                THE KINGDOM OF PROOF
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-[0.88rem] text-[#d4cabb]" aria-label="Main navigation">
            {navLinks.map((link) => {
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative py-1 transition-colors hover:text-[#f2d99b] ${
                    active ? 'text-[#f2d99b] font-bold' : ''
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute left-1/2 -translate-x-1/2 -bottom-[29px] w-8 h-px bg-[#d7b46a] shadow-[0_0_8px_#d7b46a]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* CTA & Controls */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Operator Lock/Unlock Pill */}
            {authStatus.auth_required && (
              <button
                type="button"
                onClick={() => {
                  if (authStatus.authenticated) {
                    handleLogout();
                  } else {
                    setGateModalOpen(true);
                  }
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors cursor-pointer ${
                  authStatus.authenticated
                    ? 'bg-[#152518] hover:bg-[#1E3A24] border-[#2D5A32] text-[#9AC59B]'
                    : 'bg-[#2A1E14] hover:bg-[#3D2C1B] border-[#D7B46A]/40 text-[#D7B46A]'
                }`}
                title={authStatus.authenticated ? 'Operator session active (Click to Lock)' : 'Protected instance locked (Click to Unlock)'}
              >
                {authStatus.authenticated ? (
                  <>
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>Lock Gate</span>
                  </>
                )}
              </button>
            )}

            {/* AI Providers Settings Button */}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-[#171515] hover:bg-[#221F1B] border border-[rgba(215,180,106,0.3)] text-[#E4DFD5] hover:text-[#F3ECE1] transition-colors cursor-pointer group"
              title="Configure AI Models & External Providers"
            >
              <Cpu className="w-3.5 h-3.5 text-[#D7B46A] group-hover:rotate-12 transition-transform" />
              <span>AI Providers</span>
              {enabledProviderCount > 0 ? (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#9AC59B]/20 text-[#9AC59B] border border-[#9AC59B]/30 font-semibold">
                  {enabledProviderCount} live
                </span>
              ) : (
                <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-[#D7B46A]/10 text-[#D7B46A] border border-[#D7B46A]/20">
                  Simulators
                </span>
              )}
            </button>

            {/* Backend connection pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-[#171515] border border-[rgba(215,180,106,0.22)] text-[#b8ad9b]">
              <span className={`w-1.5 h-1.5 rounded-full ${apiStatus === 'connected' ? 'bg-[#9ac59b] shadow-[0_0_6px_#9ac59b]' : 'bg-[#d98d82]'}`} />
              <span>{apiStatus === 'connected' ? 'Engine Live' : 'Connecting'}</span>
            </div>

            <Link
              to="/lab"
              className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-extrabold cursor-pointer"
            >
              <span>Launch Test</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Mobile Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden w-10 h-10 rounded-lg border border-[rgba(215,180,106,0.22)] bg-[#171515] text-[#f2d99b] flex items-center justify-center cursor-pointer"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-white/10 bg-[#0e0e10]/98 px-5 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`py-2 text-sm border-b border-white/5 flex items-center justify-between ${
                  isActive(link.path) ? 'text-[#f2d99b] font-bold' : 'text-[#c7bcaa]'
                }`}
              >
                <span>{link.label}</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              </Link>
            ))}

            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setSettingsOpen(true);
              }}
              className="w-full py-2.5 px-3 rounded-lg text-xs bg-[#171515] border border-[#D7B46A]/30 text-[#D7B46A] flex items-center justify-center gap-2 mt-1"
            >
              <Cpu className="w-4 h-4" /> Configure AI Models ({enabledProviderCount} Live)
            </button>

            <div className="pt-2 flex justify-between items-center text-xs text-[#82796e]">
              <span>Engine status: {apiStatus}</span>
              <Link
                to="/lab"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#d7b46a] font-bold"
              >
                Open Workspace →
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Provider Settings Modal */}
      <ProviderSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onProvidersUpdated={loadProviderCount}
      />

      {/* Operator Citadel Gate Modal */}
      <OperatorGateModal
        isOpen={gateModalOpen}
        onClose={() => setGateModalOpen(false)}
        onAuthenticated={() => {
          checkAuthStatus();
          loadProviderCount();
        }}
      />
    </>
  );
};
