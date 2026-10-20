import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-white/8 py-7 text-xs text-[#8e8476] bg-[#08080a]">
      <div className="max-w-[1160px] mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-black tracking-[0.14em] text-[#d8c49a]">EMPIRE ARENA</span>
          <span>·</span>
          <span>The Kingdom of Proof</span>
        </div>
        <div>
          <span>Test with purpose. Decide with evidence.</span>
        </div>
        <div className="flex items-center gap-4 text-[#a99d89]">
          <Link to="/lab" className="hover:text-[#f2d99b] transition-colors">The Lab</Link>
          <Link to="/arena" className="hover:text-[#f2d99b] transition-colors">The Arena</Link>
          <Link to="/archives" className="hover:text-[#f2d99b] transition-colors">The Archives</Link>
          <Link to="/oracle" className="hover:text-[#f2d99b] transition-colors">The Oracle</Link>
        </div>
      </div>
    </footer>
  );
};
