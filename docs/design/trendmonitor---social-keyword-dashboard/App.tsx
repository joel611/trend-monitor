
import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { 
  Terminal as TerminalIcon, 
  Database, 
  Activity, 
  ShieldAlert, 
  Search, 
  Cpu, 
  Wifi, 
  Clock,
  ChevronRight,
  Eye,
  Settings,
  Hash,
  BarChart3
} from 'lucide-react';
import DashboardOverview from './components/DashboardOverview';
import KeywordDetail from './components/KeywordDetail';
import KeywordManagement from './components/KeywordManagement';
import WatchList from './components/WatchList';

const SidebarLink = ({ to, label, active, index }: { to: string, label: string, active: boolean, index: string }) => (
  <Link
    to={to}
    className={`flex items-center space-x-3 px-4 py-2 group transition-all ${
      active ? 'text-emerald-400 bg-emerald-950/30 border-l-2 border-emerald-500' : 'text-emerald-900 hover:text-emerald-500'
    }`}
  >
    <span className="text-[10px] opacity-50">[{index}]</span>
    <span className={`font-bold tracking-widest uppercase text-sm ${active ? 'terminal-glow' : ''}`}>{label}</span>
    {active && <ChevronRight className="w-3 h-3 animate-pulse" />}
  </Link>
);

const AppContent = () => {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div className="flex h-screen bg-[#0a0b10] text-emerald-500 overflow-hidden font-mono selection:bg-emerald-500 selection:text-black">
      {/* Terminal Sidebar */}
      <aside className="w-64 border-r border-emerald-900/30 flex flex-col bg-[#0d1117]/50 backdrop-blur-sm">
        <div className="p-6 border-b border-emerald-900/30">
          <div className="flex items-center space-x-2 text-emerald-400">
            <TerminalIcon className="w-6 h-6 animate-pulse" />
            <span className="text-lg font-bold tracking-tighter terminal-glow">TREND_OS v2.0</span>
          </div>
          <p className="text-[10px] text-emerald-800 mt-2 font-bold uppercase">Root Access: Verified</p>
        </div>

        <nav className="flex-1 py-6 space-y-1 overflow-y-auto">
          <SidebarLink to="/" label="Dashboard" index="01" active={currentPath === '/'} />
          <SidebarLink to="/keywords" label="Keywords" index="02" active={currentPath === '/keywords'} />
          <SidebarLink to="/watchlist" label="Watch List" index="03" active={currentPath === '/watchlist'} />
          <SidebarLink to="/analytics" label="Network" index="04" active={currentPath === '/analytics'} />
          <SidebarLink to="/settings" label="System" index="05" active={currentPath === '/settings'} />
        </nav>

        <div className="p-4 border-t border-emerald-900/30 bg-black/40">
          <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-emerald-900 uppercase font-bold">
              <span>Memory</span>
              <span>42%</span>
            </div>
            <div className="h-1 w-full bg-emerald-950 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 w-[42%]"></div>
            </div>
            <div className="flex justify-between text-[10px] text-emerald-900 uppercase font-bold">
              <span>Signal</span>
              <span className="text-emerald-500">Stable</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Terminal Frame */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Status Bar */}
        <header className="h-12 border-b border-emerald-900/30 px-6 flex items-center justify-between bg-[#0d1117]/80 text-[11px] font-bold uppercase tracking-widest">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 text-emerald-400">
              <Activity className="w-3.5 h-3.5" />
              <span>Telemetry: Active</span>
            </div>
            <div className="flex items-center space-x-2 text-emerald-800">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date().toLocaleTimeString([], { hour12: false })}</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-amber-500">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span className="animate-pulse">3 Alerts</span>
            </div>
            <div className="h-4 w-px bg-emerald-900/30"></div>
            <div className="flex items-center space-x-2">
              <Wifi className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-emerald-400 underline decoration-dotted">127.0.0.1</span>
            </div>
          </div>
        </header>

        {/* Console Content */}
        <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-6">
            <Routes>
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/keywords" element={<KeywordManagement />} />
              <Route path="/watchlist" element={<WatchList />} />
              <Route path="/keyword/:id" element={<KeywordDetail />} />
              <Route path="*" element={
                <div className="flex flex-col items-center justify-center py-20 text-emerald-900 border border-dashed border-emerald-900/30 rounded-lg">
                  <ShieldAlert className="w-12 h-12 mb-4" />
                  <p className="text-xl font-bold">404: SEGMENT_NOT_FOUND</p>
                  <p className="mt-2">The requested data fragment is restricted or missing.</p>
                  <Link to="/" className="mt-6 text-emerald-500 underline uppercase text-sm">Return to Node 01</Link>
                </div>
              } />
            </Routes>
          </div>
        </div>
        
        {/* Footer Prompt */}
        <footer className="h-8 border-t border-emerald-900/30 bg-black/80 flex items-center px-4 text-[10px]">
          <span className="text-emerald-500 mr-2 font-bold">root@trendmonitor:~#</span>
          <span className="text-emerald-200 animate-pulse">_</span>
        </footer>
      </main>
    </div>
  );
};

const App = () => {
  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
