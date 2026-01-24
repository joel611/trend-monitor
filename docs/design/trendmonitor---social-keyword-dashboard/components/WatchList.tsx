
import React, { useState } from 'react';
import { 
  Plus, 
  Youtube, 
  Twitter, 
  Trash2, 
  RefreshCw, 
  Pause, 
  Play, 
  ExternalLink,
  Target,
  Scan,
  AlertTriangle
} from 'lucide-react';
import { MOCK_WATCH_LIST } from '../constants';
import { WatchItem, WatchType } from '../types';

const WatchList: React.FC = () => {
  const [items, setItems] = useState<WatchItem[]>(MOCK_WATCH_LIST);
  const [newUrl, setNewUrl] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [error, setError] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newUrl || !newLabel) {
      setError('ERROR: MISSING_REQUIRED_FIELDS');
      return;
    }

    const isYoutube = newUrl.includes('youtube.com') || newUrl.includes('youtu.be');
    const isX = newUrl.includes('x.com') || newUrl.includes('twitter.com');

    if (!isYoutube && !isX) {
      setError('ERROR: INVALID_VECTOR_TYPE');
      return;
    }

    const newItem: WatchItem = {
      id: `w${Date.now()}`,
      type: isYoutube ? WatchType.YOUTUBE_CHANNEL : WatchType.X_PROFILE,
      label: newLabel,
      url: newUrl,
      status: 'monitoring',
      lastSync: new Date().toISOString()
    };

    setItems([newItem, ...items]);
    setNewUrl('');
    setNewLabel('');
  };

  const removeEntry = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const toggleStatus = (id: string) => {
    setItems(items.map(i => i.id === id ? { ...i, status: i.status === 'monitoring' ? 'paused' : 'monitoring' } : i));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-emerald-900/30 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-emerald-400 terminal-glow uppercase">Target Acquisition</h1>
          <p className="text-xs text-emerald-800 font-bold">MODULE: VECTOR_WATCH_REGISTRY</p>
        </div>
      </div>

      {/* Entry Form */}
      <div className="bg-[#0d1117] border border-emerald-900/40 p-6">
        <h2 className="text-xs font-bold text-emerald-500 mb-4 flex items-center">
          <Scan className="w-4 h-4 mr-2" />
          <span>REGISTER_NEW_VECTOR</span>
        </h2>
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] text-emerald-800 font-bold uppercase block px-1">Descriptor</label>
            <input 
              type="text" 
              placeholder="e.g. PRIMAGEN_X"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full bg-black border border-emerald-900/50 p-2 text-xs text-emerald-200 outline-none focus:border-emerald-500 uppercase font-mono"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="text-[9px] text-emerald-800 font-bold uppercase block px-1">Target URL (X or YouTube)</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="https://x.com/username ..."
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                className="flex-1 bg-black border border-emerald-900/50 p-2 text-xs text-emerald-200 outline-none focus:border-emerald-500 font-mono"
              />
              <button 
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-black px-4 font-bold transition-all text-[10px] uppercase flex items-center space-x-2"
              >
                <Plus className="w-3 h-3" />
                <span>Inject</span>
              </button>
            </div>
          </div>
        </form>
        {error && (
          <div className="mt-4 flex items-center space-x-2 text-rose-500 text-[10px] font-bold animate-pulse">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Registry Table */}
      <div className="bg-[#0d1117] border border-emerald-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-emerald-950/20 text-emerald-500 uppercase tracking-widest font-bold border-b border-emerald-900/40">
                <th className="px-6 py-4">Hex_ID</th>
                <th className="px-6 py-4">Source_Type</th>
                <th className="px-6 py-4">Descriptor</th>
                <th className="px-6 py-4">Operational_Status</th>
                <th className="px-6 py-4">Last_Sync</th>
                <th className="px-6 py-4 text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/20">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-emerald-950/10 transition-colors group">
                  <td className="px-6 py-4 font-mono text-emerald-900">0x{item.id.replace('w', '').padStart(2, '0')}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      {item.type === WatchType.X_PROFILE ? (
                        <Twitter className="w-3.5 h-3.5 text-blue-500" />
                      ) : (
                        <Youtube className="w-3.5 h-3.5 text-rose-600" />
                      )}
                      <span className="text-[10px] font-bold text-emerald-700 uppercase">{item.type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-emerald-200">{item.label}</span>
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-900 hover:text-emerald-500 flex items-center">
                        <ExternalLink className="w-2 h-2 mr-1" />
                        LINK_REFR
                      </a>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <div className={`w-1.5 h-1.5 rounded-full ${item.status === 'monitoring' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-600'}`}></div>
                      <span className={`text-[10px] font-bold uppercase ${item.status === 'monitoring' ? 'text-emerald-500' : 'text-amber-600'}`}>
                        {item.status === 'monitoring' ? 'SCN_ACTIVE' : 'SCN_SUSPEND'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-emerald-900 font-bold uppercase text-[9px]">
                      {new Date(item.lastSync).toLocaleTimeString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-3 opacity-30 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => toggleStatus(item.id)}
                        className="text-emerald-700 hover:text-emerald-400"
                        title={item.status === 'monitoring' ? 'Pause Sync' : 'Resume Sync'}
                      >
                        {item.status === 'monitoring' ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                      <button className="text-emerald-700 hover:text-emerald-400"><RefreshCw className="w-3.5 h-3.5" /></button>
                      <button 
                        onClick={() => removeEntry(item.id)}
                        className="text-emerald-700 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && (
            <div className="p-12 text-center text-emerald-900 uppercase font-bold text-xs border-t border-emerald-900/20 italic">
              -- NO_TARGET_VECTORS_REGISTERED --
            </div>
          )}
        </div>
      </div>

      <div className="bg-[#0a0b10] border border-emerald-900 p-4 border-dashed">
        <p className="text-[9px] text-emerald-900 font-bold leading-tight">
          NOTICE: Vectors injected into the Acquisition Registry will be polled at regular intervals of 300s. 
          Excessive polling may trigger source-side rate limiting. Sync logs are stored in volatility memory only for POC.
        </p>
      </div>
    </div>
  );
};

export default WatchList;
