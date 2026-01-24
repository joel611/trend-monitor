
import React from 'react';
// Corrected import for react-router-dom
import { useParams, Link } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { ArrowLeft, MessageSquare, Twitter, Link as LinkIcon, ExternalLink, Calendar, Filter, Terminal as TerminalIcon } from 'lucide-react';
import { MOCK_KEYWORDS, MOCK_MENTIONS, generateMockTimeSeries } from '../constants';
import { SourceType } from '../types';

const KeywordDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const keyword = MOCK_KEYWORDS.find(k => k.id === id);
  const data = generateMockTimeSeries(30);

  if (!keyword) {
    return <div className="p-20 text-center text-emerald-900 font-bold uppercase">404: SIGNAL_LOST</div>;
  }

  const getSourceIcon = (source: SourceType) => {
    switch (source) {
      case SourceType.REDDIT: return <MessageSquare className="w-3.5 h-3.5 text-orange-600" />;
      case SourceType.X: return <Twitter className="w-3.5 h-3.5 text-blue-500" />;
      case SourceType.FEED: return <LinkIcon className="w-3.5 h-3.5 text-emerald-600" />;
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {/* Header with return command */}
      <div className="flex items-center space-x-4 border-b border-emerald-900/30 pb-4">
        <Link to="/" className="p-2 border border-emerald-900/50 hover:border-emerald-500 text-emerald-700 hover:text-emerald-400 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <div className="flex items-center space-x-3">
             <h1 className="text-2xl font-bold text-emerald-400 terminal-glow uppercase tracking-tight">{keyword.name}</h1>
             <span className="text-[10px] bg-emerald-950 text-emerald-500 px-2 py-0.5 border border-emerald-900">NODE_DETAIL_0x{keyword.id}</span>
          </div>
          <p className="text-[10px] text-emerald-800 font-bold uppercase mt-1">Status: Tracking_Active // Priority: High</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Metric Cards Column */}
        <div className="space-y-4">
           <div className="bg-[#0d1117] border border-emerald-900/40 p-5">
             <h3 className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-4">Signal Intensity</h3>
             <div className="space-y-6">
               <div>
                 <p className="text-2xl font-bold text-emerald-200 tracking-tighter">{keyword.mentionsCount7d}</p>
                 <p className="text-[10px] text-emerald-800 font-bold uppercase">Total Mentions [7d]</p>
               </div>
               <div>
                 <p className={`text-xl font-bold ${keyword.growthRate >= 0 ? 'text-emerald-500' : 'text-rose-600'}`}>
                   {keyword.growthRate > 0 ? '▲' : '▼'} {Math.abs(keyword.growthRate)}%
                 </p>
                 <p className="text-[10px] text-emerald-800 font-bold uppercase">Velocity Delta</p>
               </div>
             </div>
           </div>

           <div className="bg-[#0d1117] border border-emerald-900/40 p-5">
             <h3 className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest mb-4">Classification Tags</h3>
             <div className="flex flex-wrap gap-2">
               {keyword.tags.map(t => (
                 <span key={t} className="text-[9px] font-bold px-2 py-1 border border-emerald-900 text-emerald-600 uppercase">
                    &lt;{t}&gt;
                 </span>
               ))}
             </div>
           </div>
        </div>

        {/* Temporal Analysis Frame */}
        <div className="lg:col-span-3 bg-[#0a0b10] border border-emerald-900 p-6">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">30_DAY_PROPAGATION_LOG</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span>
                <span className="text-[10px] text-emerald-700 font-bold uppercase">Raw Signal</span>
              </div>
            </div>
          </div>
          <div className="h-[280px]">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={data}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="#064e3b" />
                  <XAxis dataKey="date" hide />
                  <YAxis axisLine={{ stroke: '#064e3b' }} tick={{ fill: '#064e3b', fontSize: 10 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0a0b10', border: '1px solid #10b981', color: '#10b981', fontSize: '10px' }}
                  />
                  <Area type="step" dataKey="count" stroke="#10b981" strokeWidth={2} fillOpacity={0.05} fill="#10b981" />
               </AreaChart>
             </ResponsiveContainer>
          </div>
          <div className="mt-4 text-[9px] text-emerald-900 font-bold italic border-t border-emerald-900/30 pt-4">
             // TIME_SERIES_MODE: STEP_FUNCTION // SAMP_RATE: 1.0Hz
          </div>
        </div>
      </div>

      {/* Raw Mention Feed */}
      <div className="bg-[#0d1117] border border-emerald-900/40 overflow-hidden">
        <div className="p-4 border-b border-emerald-900/40 bg-emerald-950/10 flex items-center justify-between">
          <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">Inbound Signal Feed</h2>
          <div className="flex items-center space-x-3">
             <button className="text-[10px] font-bold text-emerald-800 border border-emerald-900/50 px-2 py-1 uppercase hover:text-emerald-500">
               Filter_Src
             </button>
             <button className="text-[10px] font-bold text-emerald-800 border border-emerald-900/50 px-2 py-1 uppercase hover:text-emerald-500">
               Sort_Time
             </button>
          </div>
        </div>

        <div className="divide-y divide-emerald-900/20 bg-black/20">
          {MOCK_MENTIONS.map((mention) => (
            <div key={mention.id} className="p-5 hover:bg-emerald-950/10 transition-colors group relative">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-900 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4">
                  <div className="mt-1 p-1.5 border border-emerald-900/50 bg-black/40">{getSourceIcon(mention.source)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-[11px] font-bold text-emerald-500 tracking-tight">ID: @{mention.author}</span>
                      <span className="text-emerald-900 text-[9px] font-bold uppercase tracking-tighter">[{new Date(mention.createdAt).toLocaleDateString()}]</span>
                    </div>
                    {mention.title && <h4 className="text-xs font-bold text-emerald-100 mb-2 uppercase tracking-wide">{mention.title}</h4>}
                    <p className="text-[11px] text-emerald-400/80 leading-relaxed mb-4 max-w-3xl border-l-2 border-emerald-950 pl-3">
                      {mention.content}
                    </p>
                    <div className="flex flex-wrap gap-2">
                       {mention.matchedKeywords.map(kid => {
                         const kw = MOCK_KEYWORDS.find(k => k.id === kid);
                         return kw ? <span key={kid} className="text-[9px] text-emerald-900 font-bold uppercase border border-emerald-900/30 px-1.5 py-0.5">#{kw.name}</span> : null;
                       })}
                    </div>
                  </div>
                </div>
                <a 
                  href={mention.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-emerald-900 hover:text-emerald-400 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
        
        <div className="p-4 bg-black/40 border-t border-emerald-900/40 text-center">
          <button className="text-[10px] font-bold text-emerald-600 hover:text-emerald-400 uppercase tracking-widest animate-pulse">
            -- READ_NEXT_BLOCK --
          </button>
        </div>
      </div>
    </div>
  );
};

export default KeywordDetail;
