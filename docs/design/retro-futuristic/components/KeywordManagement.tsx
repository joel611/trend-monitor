
import React, { useState } from 'react';
import { Plus, Edit2, Archive, Trash2, Search, Filter, Hash } from 'lucide-react';
import { MOCK_KEYWORDS } from '../constants';
import { KeywordStatus, Keyword } from '../types';

const KeywordManagement: React.FC = () => {
  const [keywords, setKeywords] = useState<Keyword[]>(MOCK_KEYWORDS);
  const [search, setSearch] = useState('');

  const filtered = keywords.filter(k => 
    k.name.toLowerCase().includes(search.toLowerCase()) || 
    k.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-900/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 terminal-glow uppercase">Signal Library</h1>
          <p className="text-xs text-emerald-800 font-bold">REGISTRY: MONITOR_LIST_V02</p>
        </div>
        <button className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-black px-4 py-2 font-bold transition-all text-xs uppercase">
          <Plus className="w-4 h-4" />
          <span>Add New vector</span>
        </button>
      </div>

      <div className="bg-[#0d1117] border border-emerald-900/40 overflow-hidden">
        <div className="p-4 border-b border-emerald-900/40 bg-emerald-950/10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-700" />
            <input
              type="text"
              placeholder="SEARCH_REGISTRY..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-black/40 border border-emerald-900/50 py-2 pl-10 pr-4 focus:border-emerald-500 outline-none text-xs text-emerald-200 uppercase placeholder:text-emerald-900"
            />
          </div>
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 text-emerald-700 text-[10px] font-bold border border-emerald-900/50 px-3 py-1.5 hover:text-emerald-500 transition-colors uppercase">
              <Filter className="w-3 h-3" />
              <span>Filter_Type</span>
            </button>
            <p className="text-[10px] text-emerald-900 font-bold uppercase tracking-widest">Found {filtered.length} entries</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-emerald-950/20 text-emerald-500 uppercase tracking-widest font-bold border-b border-emerald-900/40">
                <th className="px-6 py-4">Hex_ID</th>
                <th className="px-6 py-4">Descriptor</th>
                <th className="px-6 py-4">Classification</th>
                <th className="px-6 py-4">State</th>
                <th className="px-6 py-4">Vol_7d</th>
                <th className="px-6 py-4">Delta</th>
                <th className="px-6 py-4 text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/20">
              {filtered.map((kw) => (
                <tr key={kw.id} className="hover:bg-emerald-950/10 transition-colors group">
                  <td className="px-6 py-4 font-mono text-emerald-900">0x{kw.id.padStart(2, '0')}</td>
                  <td className="px-6 py-4">
                    <span className="font-bold text-emerald-200">{kw.name}</span>
                    <span className="text-[9px] text-emerald-900 ml-2">[{kw.aliases.join(',')}]</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {kw.tags.map(tag => (
                        <span key={tag} className="text-[9px] border border-emerald-900/50 text-emerald-800 px-1.5 py-0.5 font-bold uppercase">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${kw.status === KeywordStatus.ACTIVE ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></div>
                      <span className={`text-[10px] font-bold uppercase ${
                        kw.status === KeywordStatus.ACTIVE ? 'text-emerald-500' : 'text-slate-600'
                      }`}>
                        {kw.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-emerald-400">{kw.mentionsCount7d}</td>
                  <td className="px-6 py-4">
                    <span className={`font-bold ${kw.growthRate >= 0 ? 'text-emerald-500' : 'text-rose-600'}`}>
                      {kw.growthRate > 0 ? '+' : ''}{kw.growthRate}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-3 opacity-30 group-hover:opacity-100 transition-opacity">
                      <button className="text-emerald-700 hover:text-emerald-400"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button className="text-emerald-700 hover:text-amber-500"><Archive className="w-3.5 h-3.5" /></button>
                      <button className="text-emerald-700 hover:text-rose-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="p-4 border border-dashed border-emerald-900/30 text-[10px] text-emerald-900 text-center font-bold">
        -- END OF DATA PACKET --
      </div>
    </div>
  );
};

export default KeywordManagement;
