
import React, { useEffect, useState } from 'react';
// Corrected import for react-router-dom
import { Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Zap, 
  Cpu, 
  TrendingUp, 
  Target, 
  Scan, 
  Database,
  Terminal as TerminalIcon
} from 'lucide-react';
import { MOCK_KEYWORDS, generateMockTimeSeries } from '../constants';
import { getTrendSummary } from '../services/geminiService';

const StatBox = ({ label, value, change, up, icon: Icon }: any) => (
  <div className="bg-[#0d1117] border border-emerald-900/40 p-5 relative overflow-hidden group hover:border-emerald-500 transition-colors">
    <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-30 transition-opacity">
       <Icon className="w-16 h-16" />
    </div>
    <div className="flex justify-between items-start mb-2">
      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest">{label}</span>
      <span className={`text-[10px] font-bold ${up ? 'text-emerald-400' : 'text-rose-500'}`}>
        {up ? '▲' : '▼'} {change}
      </span>
    </div>
    <div className="text-2xl font-bold text-emerald-200 tracking-tighter">
      {value}
    </div>
    <div className="mt-2 h-0.5 w-full bg-emerald-950 overflow-hidden">
      <div className={`h-full ${up ? 'bg-emerald-500' : 'bg-rose-500'} w-2/3`}></div>
    </div>
  </div>
);

const DashboardOverview: React.FC = () => {
  const [trendInsights, setTrendInsights] = useState<string>("INITIALIZING SYSTEM SCAN...");
  const [loadingInsights, setLoadingInsights] = useState(true);
  const timeData = generateMockTimeSeries(14);
  const topKeywords = [...MOCK_KEYWORDS].sort((a, b) => b.mentionsCount7d - a.mentionsCount7d).slice(0, 5);

  useEffect(() => {
    const fetchInsights = async () => {
      setLoadingInsights(true);
      const summary = await getTrendSummary(MOCK_KEYWORDS);
      setTrendInsights(summary);
      setLoadingInsights(false);
    };
    fetchInsights();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex justify-between items-end border-b border-emerald-900/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 terminal-glow uppercase">Dashboard Core</h1>
          <p className="text-xs text-emerald-800">Operational node: US-EAST-INGEST-01</p>
        </div>
        <div className="text-[10px] text-right font-bold text-emerald-900 uppercase">
          Latency: 24ms<br/>Uptime: 99.99%
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Mentions Total" value="4,892" change="12.5%" up={true} icon={TrendingUp} />
        <StatBox label="Active Nodes" value="48" change="3" up={true} icon={Database} />
        <StatBox label="Engagement Rate" value="0.82" change="4.2%" up={false} icon={Target} />
        <StatBox label="Proc Units" value="12" change="2" up={true} icon={Cpu} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Retro Chart */}
        <div className="lg:col-span-2 bg-[#0d1117] border border-emerald-900/40 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">Network Traffic Mentions</h2>
              <p className="text-[10px] text-emerald-800 uppercase">Data stream: Global_Agg_7d</p>
            </div>
            <div className="flex space-x-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[10px] text-emerald-600 font-bold uppercase">Live Input</span>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#064e3b" />
                <XAxis 
                  dataKey="date" 
                  axisLine={{ stroke: '#064e3b' }} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#064e3b', fontWeight: 'bold' }}
                  tickFormatter={(val) => val.split('-').slice(2).join('')}
                />
                <YAxis 
                  axisLine={{ stroke: '#064e3b' }} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: '#064e3b', fontWeight: 'bold' }} 
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0d1117', border: '1px solid #10b981', color: '#10b981', fontSize: '10px' }}
                  itemStyle={{ color: '#10b981' }}
                />
                <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} fillOpacity={0.1} fill="#10b981" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Analysis Console */}
        <div className="bg-[#0a0b10] border border-emerald-900 p-6 relative">
          <div className="absolute top-0 right-0 bg-emerald-900 text-black text-[9px] px-2 py-0.5 font-bold uppercase">
            System AI
          </div>
          <h2 className="text-xs font-bold text-emerald-500 mb-4 flex items-center">
            <Scan className="w-4 h-4 mr-2" />
            <span>NEURAL_NET_ANALYSIS.LOG</span>
          </h2>
          <div className="font-mono text-[11px] leading-relaxed text-emerald-200/90 h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            {loadingInsights ? (
              <div className="space-y-2">
                <p className="animate-pulse">_ EXEC_PROCESS: TREND_SCAN</p>
                <p className="animate-pulse delay-75">_ DATA_RETRIEVAL: COMPLETE</p>
                <p className="animate-pulse delay-150">_ ANALYZING_PATTERNS...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-emerald-500 font-bold underline mb-1">> EXECUTIVE_SUMMARY</p>
                <p>{trendInsights}</p>
                <div className="pt-4 border-t border-emerald-900/40">
                  <p className="text-[9px] text-emerald-800 font-bold mb-2 uppercase tracking-tighter">Significant Signal Clusters:</p>
                  <div className="flex flex-wrap gap-2">
                    {MOCK_KEYWORDS.filter(k => k.isEmerging).map(k => (
                      <span key={k.id} className="border border-emerald-900 px-2 py-0.5 text-[10px] bg-emerald-950/20">
                        {k.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center text-emerald-900 text-[9px] font-bold">
            <span className="mr-2 underline">VERSION 4.2.0-F</span>
            <span>MODEL: GEMINI_3_FLASH</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hot Topics List */}
        <div className="bg-[#0d1117] border border-emerald-900/40 p-6">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest flex items-center">
               <Zap className="w-4 h-4 mr-2" />
               RISING_SIGNALS
             </h2>
             <Link to="/keywords" className="text-[10px] text-emerald-700 hover:text-emerald-500 font-bold border-b border-emerald-900">EXTRACT_ALL</Link>
          </div>
          <div className="divide-y divide-emerald-900/20">
            {topKeywords.map((kw) => (
              <Link to={`/keyword/${kw.id}`} key={kw.id} className="flex items-center justify-between py-3 hover:bg-emerald-950/10 group transition-colors px-2 -mx-2">
                <div className="flex items-center space-x-4">
                  <span className="text-[10px] text-emerald-900 font-mono">0x{kw.id.padStart(2, '0')}</span>
                  <div>
                    <h4 className="font-bold text-emerald-200 group-hover:text-emerald-400 transition-colors">{kw.name}</h4>
                    <p className="text-[9px] text-emerald-800 font-bold">{kw.tags.join(' // ').toUpperCase()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-400">{kw.mentionsCount7d} MNT</p>
                  <p className={`text-[10px] font-bold ${kw.growthRate > 0 ? 'text-emerald-500' : 'text-rose-600'}`}>
                    {kw.growthRate > 0 ? '+' : ''}{kw.growthRate}%
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Source Breakdown (Mini-Console) */}
        <div className="bg-[#0d1117] border border-emerald-900/40 p-6 flex flex-col">
          <h2 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-6">Vector Distribution</h2>
          <div className="flex-1 flex flex-col justify-center space-y-8">
            <div className="grid grid-cols-3 gap-4">
               {[
                 { label: 'REDDIT', val: '42%', color: 'bg-orange-600' },
                 { label: 'X_CORP', val: '35%', color: 'bg-blue-600' },
                 { label: 'FEED_B', val: '23%', color: 'bg-emerald-600' }
               ].map(s => (
                 <div key={s.label} className="text-center">
                   <p className="text-xl font-bold text-emerald-100">{s.val}</p>
                   <p className="text-[10px] text-emerald-800 font-bold mt-1">{s.label}</p>
                   <div className={`h-1 w-full ${s.color} mt-2 opacity-50`}></div>
                 </div>
               ))}
            </div>
            <div className="h-4 w-full bg-emerald-950/30 flex overflow-hidden border border-emerald-900/50">
              <div className="h-full bg-orange-600/60 border-r border-emerald-900/50" style={{ width: '42%' }}></div>
              <div className="h-full bg-blue-600/60 border-r border-emerald-900/50" style={{ width: '35%' }}></div>
              <div className="h-full bg-emerald-600/60" style={{ width: '23%' }}></div>
            </div>
            <div className="text-[9px] text-emerald-900 font-bold italic text-center">
              // DATA_INTEGRITY_INDEX: 0.988 // LOAD_BALANCER: OPTIMAL
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;
