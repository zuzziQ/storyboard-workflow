import { Globe } from 'lucide-react';

interface ConnectionSettingsProps {
  hubConnectionMode: 'vps' | 'staging' | 'local';
  setHubConnectionMode: (mode: 'vps' | 'staging' | 'local') => void;
  localIp: string;
  setLocalIp: (ip: string) => void;
  hubUrl: string;
}

export function ConnectionSettings({
  hubConnectionMode,
  setHubConnectionMode,
  localIp,
  setLocalIp,
  hubUrl
}: ConnectionSettingsProps) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-4">
      <h4 className="text-[11px] font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
        <Globe className="w-3.5 h-3.5" /> 1. OMNI Core API Endpoints
      </h4>

      {/* Connection Mode Selection Toggle */}
      <div className="space-y-1.5 border-b border-slate-800/60 pb-3">
        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Connection Mode</label>
        <div className="grid grid-cols-3 gap-2 bg-slate-950 p-1 rounded-xl border border-slate-850">
          <button
            type="button"
            onClick={() => setHubConnectionMode('vps')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer outline-none ${
              hubConnectionMode === 'vps'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            ☁️ VPS Prod
          </button>
          <button
            type="button"
            onClick={() => setHubConnectionMode('staging')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer outline-none ${
              hubConnectionMode === 'staging'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            🚧 Staging
          </button>
          <button
            type="button"
            onClick={() => setHubConnectionMode('local')}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer outline-none ${
              hubConnectionMode === 'local'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            💻 Local
          </button>
        </div>
      </div>

      {/* Local Engine IP Configuration */}
      {hubConnectionMode === 'local' && (
        <div className="space-y-1.5 pt-1 animate-in slide-in-from-top-1 duration-150">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            Local storymee-pc Domain / IP Address
          </label>
          <input
            type="text"
            value={localIp}
            onChange={(e) => setLocalIp(e.target.value)}
            placeholder="storymee-pc.local"
            className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-2.5 outline-none text-xs transition-all font-mono"
          />
          <span className="text-[9px] text-slate-500 block leading-tight">
            Enter the LAN IP address or local mDNS domain (e.g. storymee-pc.local) of your local storymee-pc.
          </span>
        </div>
      )}
      
      <div className="grid grid-cols-1 gap-3">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Core API URL</label>
          <input
            type="text"
            value={hubUrl}
            readOnly
            placeholder="Will be auto-calculated"
            className="w-full bg-[#090d16] border border-[#334155]/20 text-slate-400 rounded-xl p-2.5 outline-none text-xs transition-all font-mono select-all"
          />
          <span className="text-[9px] text-slate-500 block leading-tight">Calculated unified Core API endpoint for both Gateway and Services.</span>
        </div>
      </div>
    </div>
  );
}
