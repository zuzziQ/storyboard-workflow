import { Cpu, ImageIcon, Film } from 'lucide-react';

interface ProviderSettingsProps {
  llmProvider: 'hub' | 'sdk' | 'google-native';
  setLlmProvider: (prov: 'hub' | 'sdk' | 'google-native') => void;
  imageProvider: 'hub' | 'sdk' | 'google-native' | 'dreamina';
  setImageProvider: (prov: 'hub' | 'sdk' | 'google-native' | 'dreamina') => void;
  videoProvider: 'hub' | 'sdk' | 'google-native' | 'dreamina';
  setVideoProvider: (prov: 'hub' | 'sdk' | 'google-native' | 'dreamina') => void;
}

export function ProviderSettings({
  llmProvider, setLlmProvider,
  imageProvider, setImageProvider,
  videoProvider, setVideoProvider
}: ProviderSettingsProps) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-4">
      <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5" /> 3. Intelligent Providers
      </h4>

      <div className="space-y-3.5">
        {/* LLM Routing */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <Cpu className="w-3 h-3 text-purple-400" /> LLM Generator
            </label>
            <span className="text-[9px] text-slate-500">Parsing & Scriptwriting</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 bg-[#090d16] p-1 rounded-xl border border-slate-800">
            {(['hub', 'sdk', 'google-native'] as const).map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => setLlmProvider(prov)}
                className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider ${
                  llmProvider === prov 
                    ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                {prov === 'hub' ? 'Hub Gateway' : prov === 'sdk' ? 'Vidtory SDK' : 'Google Native'}
              </button>
            ))}
          </div>
        </div>

        {/* Image Routing */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <ImageIcon className="w-3 h-3 text-blue-400" /> Image Generator
            </label>
            <span className="text-[9px] text-slate-500">Character & Scenes Storyboard</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 bg-[#090d16] p-1 rounded-xl border border-slate-800">
            {(['hub', 'sdk', 'google-native', 'dreamina'] as const).map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => setImageProvider(prov)}
                className={`py-1.5 px-1 rounded-lg text-[9px] font-bold transition-all uppercase tracking-wider ${
                  imageProvider === prov 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                {prov === 'hub' ? 'Hub Gateway' : prov === 'sdk' ? 'Vidtory SDK' : prov === 'google-native' ? 'Google Native' : 'Dreamina'}
              </button>
            ))}
          </div>
        </div>

        {/* Video Routing */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block flex items-center gap-1">
              <Film className="w-3 h-3 text-pink-400" /> Video Generator
            </label>
            <span className="text-[9px] text-slate-500">Cinematic Motion Clips</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5 bg-[#090d16] p-1 rounded-xl border border-slate-800">
            {(['hub', 'sdk', 'google-native', 'dreamina'] as const).map((prov) => (
              <button
                key={prov}
                type="button"
                onClick={() => setVideoProvider(prov)}
                className={`py-1.5 px-1 rounded-lg text-[9px] font-bold transition-all uppercase tracking-wider ${
                  videoProvider === prov 
                    ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                }`}
              >
                {prov === 'hub' ? 'Hub Gateway' : prov === 'sdk' ? 'Vidtory SDK' : prov === 'google-native' ? 'Google Native' : 'Dreamina'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
