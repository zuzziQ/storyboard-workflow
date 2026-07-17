import React from 'react';

interface ShotAssetLinkerProps {
  allCharacters: any[];
  localCharacterIds: string[];
  setLocalCharacterIds: (ids: string[]) => void;
  isCharacterSpeaking: (name: string, id: string) => boolean;
  allLocations: any[];
  localLocationId: string;
  setLocalLocationId: (id: string) => void;
  mode?: 'all' | 'characters' | 'locations';
}

export const ShotAssetLinker: React.FC<ShotAssetLinkerProps> = ({
  allCharacters,
  localCharacterIds,
  setLocalCharacterIds,
  isCharacterSpeaking,
  allLocations,
  localLocationId,
  setLocalLocationId,
  mode = 'all'
}) => {
  return (
    <div className="space-y-4">
      {/* Character list */}
      {(mode === 'all' || mode === 'characters') && (
        <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
          <h5 className="text-[9.5px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Nhân Vật Tương Tác</h5>
          <div className="flex flex-wrap gap-1 bg-[#09090c] border border-slate-800 rounded-lg p-1 h-[48px] overflow-y-auto custom-scrollbar" style={{ backgroundColor: '#09090c' }}>
            {allCharacters.map((char: any) => {
              const isSel = localCharacterIds.includes(char.worldAssetCharId);
              const isVerified = char.worldAssetCharId && 
                !char.worldAssetCharId.startsWith('custom-') &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(char.worldAssetCharId);
              const isSpeaking = isCharacterSpeaking(char.name, char.worldAssetCharId);

              let btnClass = "bg-slate-900 border border-slate-855 text-slate-505 hover:text-slate-355";
              if (isSel) {
                if (isSpeaking) {
                  btnClass = "bg-amber-600/20 border-amber-500 text-amber-200 shadow-[0_0_10px_rgba(245,158,11,0.4)] animate-pulse";
                } else {
                  btnClass = "bg-indigo-600/30 border border-indigo-500 text-indigo-200";
                }
              }

              return (
                <button
                  key={char.worldAssetCharId}
                  type="button"
                  onClick={() => {
                    const next = isSel
                      ? localCharacterIds.filter((id: any) => id !== char.worldAssetCharId)
                      : [...localCharacterIds, char.worldAssetCharId];
                    setLocalCharacterIds(next);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase transition-all duration-200 flex items-center gap-1 ${btnClass}`}
                  title={isSpeaking ? "Nhân vật phát biểu chính trong shot" : "Click để chọn nhân vật"}
                >
                  {isSpeaking && <span className="text-[9px] text-amber-400">🔊</span>}
                  <span>{char.name}</span>
                  {isVerified && <span className="text-[7.5px] text-emerald-400 font-extrabold" title="Verified Asset">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Location Override */}
      {(mode === 'all' || mode === 'locations') && (
        <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
          <h5 className="text-[9.5px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Bối Cảnh &amp; Địa Điểm (Environment Setup)</h5>
          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Địa Điểm (Location Override)</label>
            {(() => {
              const isLocVerified = localLocationId && 
                !localLocationId.startsWith('custom-') &&
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(localLocationId);

              return (
                <select
                  value={localLocationId}
                  onChange={(e) => setLocalLocationId(e.target.value)}
                  className={`w-full bg-[#09090c] border rounded-lg py-1 px-2 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer transition-all ${
                    isLocVerified ? 'border-emerald-600/50 text-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.15)]' : 'border-slate-800 text-amber-400'
                  }`}
                  style={{ backgroundColor: '#09090c' }}
                >
                  <option value="" style={{ backgroundColor: '#09090c', color: '#f59e0b' }}>-- Tự động --</option>
                  {allLocations.map((loc: any) => {
                    const isOptionVerified = loc.worldAssetCharId && 
                      !loc.worldAssetCharId.startsWith('custom-') &&
                      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(loc.worldAssetCharId);
                    return (
                      <option 
                        key={loc.worldAssetCharId} 
                        value={loc.worldAssetCharId} 
                        style={{ backgroundColor: '#09090c', color: isOptionVerified ? '#34d399' : '#f59e0b' }}
                      >
                        {isOptionVerified ? `✓ ${loc.name}` : loc.name}
                      </option>
                    );
                  })}
                </select>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShotAssetLinker;
