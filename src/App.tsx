import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { EmpirePage } from './pages/EmpirePage';
import { LabPage } from './pages/LabPage';
import { ArenaPage } from './pages/ArenaPage';
import { ArchivesPage } from './pages/ArchivesPage';
import { OraclePage } from './pages/OraclePage';
import { EmpireApi } from './services/empireApi';

export function App() {
  const [apiStatus, setApiStatus] = useState<'connected' | 'offline'>('connected');

  useEffect(() => {
    EmpireApi.getHealth()
      .then(() => setApiStatus('connected'))
      .catch(() => setApiStatus('offline'));
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0b0b0d] text-[#f3ead8] flex flex-col font-sans selection:bg-[#d7b46a]/30 selection:text-white">
        <Navbar apiStatus={apiStatus} />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<EmpirePage />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/arena" element={<ArenaPage />} />
            <Route path="/archives" element={<ArchivesPage />} />
            <Route path="/oracle" element={<OraclePage />} />
            {/* Fallback to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
