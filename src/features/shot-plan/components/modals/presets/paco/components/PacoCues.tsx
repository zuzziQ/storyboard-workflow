import React from 'react';

interface PacoCuesProps {
  localCharacterExpressions: Record<string, string>;
  setLocalCharacterExpressions: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  localTimingPattern: string;
  setLocalTimingPattern: (val: string) => void;
  localFlag: string;
  setLocalFlag: (val: string) => void;
  localTiming: string;
  setLocalTiming: (val: string) => void;
  localLensFeel: string;
  setLocalLensFeel: (val: string) => void;
  localMotion: string;
  setLocalMotion: (val: string) => void;
  localSfx: string;
  setLocalSfx: (val: string) => void;
  localGagFlag: string;
  setLocalGagFlag: (val: string) => void;
  localStoryboardNote: string;
  setLocalStoryboardNote: (val: string) => void;
  localSeedanceNote: string;
  setLocalSeedanceNote: (val: string) => void;
  localCharacterIds: string[];
  parsedData: any;
  handleBlur: () => void;
  handleUpdateShot: (id: string, updates: any) => void;
  shotId: string;
}

export default function PacoCues({
  localCharacterExpressions, setLocalCharacterExpressions,
  localTimingPattern, setLocalTimingPattern,
  localFlag, setLocalFlag,
  localTiming, setLocalTiming,
  localLensFeel, setLocalLensFeel,
  localMotion, setLocalMotion,
  localSfx, setLocalSfx,
  localGagFlag, setLocalGagFlag,
  localStoryboardNote, setLocalStoryboardNote,
  localSeedanceNote, setLocalSeedanceNote,
  localCharacterIds, parsedData,
  handleBlur, handleUpdateShot, shotId
}: PacoCuesProps) {
  
  const charNames = localCharacterIds.map((id: string) => {
    const found = parsedData?.characters?.find((c: any) => c.worldAssetCharId === id || c.id === id);
    return found ? found.name : null;
  }).filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {/* Cues Hành động & Biểu cảm */}
      <div className="p-3 bg-[#1e160f] border border-amber-500/20 rounded-xl space-y-3">
        <h5 className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-amber-500/10 pb-1.5 flex items-center gap-1">
          <span>🎭 Biểu Cảm Động Nhân Vật (Expressions)</span>
        </h5>
        
        {charNames.length === 0 ? (
          <div className="text-[10px] text-amber-500/50 italic">Vui lòng tag nhân vật ở tab Camera để nhập biểu cảm.</div>
        ) : (
          <div className="space-y-2 bg-[#09090c] p-2.5 rounded-lg border border-amber-900/30">
            {charNames.map(name => (
              <div key={name} className="flex items-center gap-2">
                <span className="text-[9px] font-extrabold text-amber-300 uppercase min-w-[70px] border-r border-amber-900/50 pr-1.5 text-right">{name}</span>
                <input
                  type="text"
                  value={localCharacterExpressions[name] || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalCharacterExpressions(prev => {
                      const next = { ...prev, [name]: val };
                      handleUpdateShot(shotId, { characterExpressions: next });
                      return next;
                    });
                  }}
                  onBlur={handleBlur}
                  placeholder={`Biểu cảm của ${name}...`}
                  className="flex-1 bg-[#121217] border border-slate-800 rounded px-2 py-1 text-[11px] text-amber-50 outline-none focus:border-amber-500/40"
                />
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-amber-900/20">
          <div className="space-y-0.5">
            <span className="text-[8.5px] font-black text-amber-400 uppercase block">Timing Pattern</span>
            <input
              type="text"
              value={localTimingPattern}
              onChange={(e) => setLocalTimingPattern(e.target.value)}
              onBlur={handleBlur}
              placeholder="VD: Pattern B..."
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none focus:border-amber-500/40"
            />
          </div>
          <div className="space-y-0.5">
            <span className="text-[8.5px] font-black text-amber-400 uppercase block">Flags / Rules</span>
            <input
              type="text"
              value={localFlag}
              onChange={(e) => setLocalFlag(e.target.value)}
              onBlur={handleBlur}
              placeholder="★ PACO RESET RULE..."
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-yellow-400 outline-none focus:border-amber-500/40"
            />
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[8.5px] font-black text-amber-400 uppercase block">Timing Governing Details</span>
          <textarea
            value={localTiming}
            onChange={(e) => setLocalTiming(e.target.value)}
            onBlur={handleBlur}
            placeholder="Chi tiết timing..."
            className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none h-12 min-h-[45px] resize-y focus:border-amber-500/40"
          />
        </div>
      </div>

      {/* Cues Camera & Render */}
      <div className="p-3 bg-[#1e160f] border border-orange-500/20 rounded-xl space-y-3">
        <h5 className="text-[10px] font-black text-orange-500 uppercase tracking-widest border-b border-orange-500/10 pb-1.5 flex items-center gap-1">
          <span>🎥 Camera & Cues Dựng (Render/Motion)</span>
        </h5>
        
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-0.5">
            <span className="text-[8.5px] font-black text-slate-400 uppercase block">Lens Feel</span>
            <input
              type="text"
              value={localLensFeel}
              onChange={(e) => setLocalLensFeel(e.target.value)}
              onBlur={handleBlur}
              placeholder="VD: 50mm neutral..."
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none focus:border-orange-500/40"
            />
          </div>
          <div className="space-y-0.5">
            <span className="text-[8.5px] font-black text-slate-400 uppercase block">Motion Code</span>
            <input
              type="text"
              value={localMotion}
              onChange={(e) => setLocalMotion(e.target.value)}
              onBlur={handleBlur}
              placeholder="VD: MST-2 / CAM-0..."
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none focus:border-orange-500/40"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 border-t border-orange-900/20 pt-2">
          <div className="space-y-0.5">
            <span className="text-[8.5px] font-black text-orange-400 uppercase block">Storyboard Render Note</span>
            <textarea
              value={localStoryboardNote}
              onChange={(e) => setLocalStoryboardNote(e.target.value)}
              onBlur={handleBlur}
              placeholder="Ghi chú kết xuất ảnh..."
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none h-16 min-h-[50px] resize-y focus:border-orange-500/40"
            />
          </div>
          <div className="space-y-0.5">
            <span className="text-[8.5px] font-black text-orange-400 uppercase block">Seedance Motion Note</span>
            <textarea
              value={localSeedanceNote}
              onChange={(e) => setLocalSeedanceNote(e.target.value)}
              onBlur={handleBlur}
              placeholder="Ghi chú Prompt Video..."
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none h-16 min-h-[50px] resize-y focus:border-orange-500/40"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
