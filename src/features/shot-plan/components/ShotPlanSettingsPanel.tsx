import React from 'react';
import { Link2 } from 'lucide-react';

interface ShotPlanSettingsPanelProps {
  activeConfig: any;
  activeSceneId: string;
  activeScene: any;
  activeBeat: any;
  prevBeat: any;
  nextBeat: any;
  bridgeFromPrev: any;
  bridgeToNext: any;
  isAtmosphereSynced: boolean;
  updateConfig: (sceneId: string, fields: any) => void;
  handleApplyAtmosphere: () => void;
  justApplied: boolean;
  beats: any[];
  isSameScene: (id1: any, id2: any) => boolean;
  getAutoRows: (text: string, minRows?: number, charsPerLine?: number) => number;
}

// Color palette per arc position 
const ARC_COLORS: Record<string, string> = {
  setup:      '#64748b',
  inciting:   '#f59e0b',
  rising:     '#f97316',
  climax:     '#ef4444',
  falling:    '#8b5cf6',
  resolution: '#10b981',
};

export const ShotPlanSettingsPanel: React.FC<ShotPlanSettingsPanelProps> = ({
  activeConfig,
  activeSceneId,
  activeScene,
  activeBeat,
  prevBeat,
  nextBeat,
  bridgeFromPrev,
  bridgeToNext,
  isAtmosphereSynced,
  updateConfig,
  handleApplyAtmosphere,
  justApplied,
  beats,
  isSameScene,
  getAutoRows
}) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Left Column: Atmosphere */}
      <div className="space-y-3">
        <div className="text-[9px] uppercase tracking-wider text-indigo-400/80 font-black">
          Thiết lập Cảnh trí (Atmosphere & Scene)
        </div>
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-855 text-xs text-white space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Địa điểm (Override)</label>
              <input
                type="text"
                value={activeConfig.location || ''}
                onChange={(e) => updateConfig(activeSceneId, { location: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                placeholder="Địa điểm..."
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Thời điểm</label>
              <select
                value={activeConfig.timeOfDay || 'DAY'}
                onChange={(e) => updateConfig(activeSceneId, { timeOfDay: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
              >
                <option value="DAY">DAY</option>
                <option value="NIGHT">NIGHT</option>
                <option value="SUNRISE">SUNRISE</option>
                <option value="SUNSET">SUNSET</option>
                <option value="DUSK">DUSK</option>
                <option value="DAWN">DAWN</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">💡 Ánh sáng</label>
              <input
                type="text"
                value={activeConfig.lighting || ''}
                onChange={(e) => updateConfig(activeSceneId, { lighting: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] text-white outline-none focus:border-indigo-500/50"
                placeholder="Ánh sáng..."
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">☁️ Thời tiết</label>
              <input
                type="text"
                value={activeConfig.weather || ''}
                onChange={(e) => updateConfig(activeSceneId, { weather: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] text-white outline-none focus:border-indigo-500/50"
                placeholder="Thời tiết..."
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Lưới Grid</label>
              <select
                value={activeConfig.panelGrid || 'auto'}
                onChange={(e) => updateConfig(activeSceneId, { panelGrid: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
              >
                <option value="auto">Auto (Phân tích thông minh)</option>
                <option value="1x1">Grid 1x1</option>
                <option value="1x2">Grid 1x2</option>
                <option value="2x1">Grid 2x1</option>
                <option value="2x2">Grid 2x2</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">🎵 Âm thanh & Tiếng động</label>
              <input
                type="text"
                value={activeConfig.soundCue || ''}
                onChange={(e) => updateConfig(activeSceneId, { soundCue: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                placeholder="Tiếng động/BGM..."
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">👥 Nhân vật tham gia</label>
              <input
                type="text"
                value={(activeConfig.charactersInScene || []).join(', ')}
                onChange={(e) => updateConfig(activeSceneId, { charactersInScene: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                placeholder="Nhân vật..."
              />
            </div>
          </div>

          <div>
            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">📝 Ghi chú Bối cảnh & Mô tả Scene</label>
            <textarea
              rows={getAutoRows(activeConfig.action || '', 2, 40)}
              value={activeConfig.action || ''}
              onChange={(e) => updateConfig(activeSceneId, { action: e.target.value })}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/50 resize-none leading-relaxed custom-scrollbar"
              placeholder="Nhân vật làm gì, diễn biến tổng quan..."
            />
          </div>
        </div>
      </div>

      {/* Right Column: Mood shift & Narrative Bridges */}
      <div className="space-y-3">
        <div className="text-[9px] uppercase tracking-wider text-indigo-400/80 font-black flex items-center justify-between">
          <span>Biến Chuyển Cảm Xúc (Mood Shift)</span>
          {activeBeat && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase" style={{ backgroundColor: `${ARC_COLORS[activeBeat.arcPosition] || '#64748b'}20`, color: ARC_COLORS[activeBeat.arcPosition] || '#64748b', border: `1px solid ${ARC_COLORS[activeBeat.arcPosition] || '#64748b'}30` }}>
              {activeBeat.arcPosition}
            </span>
          )}
        </div>
        <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-855 text-xs text-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="capitalize font-black text-indigo-300 text-[12px]">{activeBeat?.emotion || 'neutral'}</span>
            <span className="text-[10px] font-bold text-indigo-400">Cường độ: {activeConfig.emotionIntensity ?? activeBeat?.intensity ?? 40}%</span>
          </div>
          
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${activeConfig.emotionIntensity ?? activeBeat?.intensity ?? 40}%` }} />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Cảm xúc lối vào (Mood In)</label>
              <input
                type="text"
                value={activeConfig.moodShift || ''}
                onChange={(e) => updateConfig(activeSceneId, { moodShift: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                placeholder="Mood In..."
              />
            </div>
            <div>
              <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Cảm xúc lối ra (Mood Out)</label>
              <input
                type="text"
                value={activeConfig.moodShiftOut || ''}
                onChange={(e) => updateConfig(activeSceneId, { moodShiftOut: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                placeholder="Mood Out..."
              />
            </div>
          </div>
        </div>

        {/* Bridges */}
        <div className="space-y-1.5">
          <div className="text-[8px] uppercase tracking-wider text-indigo-400/80 font-black">Cầu nối Chuyển cảnh (Bridges)</div>
          <div className="grid grid-cols-2 gap-2">
            {prevBeat ? (
              <div className="p-2 rounded bg-slate-950/40 border border-slate-855 text-[10px] space-y-1">
                <div className="flex items-center justify-between text-slate-450 font-bold text-[9px]">
                  <span className="flex items-center gap-0.5">
                    <Link2 size={9} className="text-indigo-400" />
                    Vào từ S{beats.findIndex((b: any) => isSameScene(b.sceneId, prevBeat.sceneId)) + 1} ({prevBeat.emotion})
                  </span>
                </div>
                <p className="text-slate-350 italic text-[10px] leading-tight line-clamp-3">
                  {bridgeFromPrev ? bridgeFromPrev.description : `Mạch cảm xúc đi từ ${prevBeat.emotion} sang ${activeBeat?.emotion || 'neutral'}.`}
                </p>
              </div>
            ) : (
              <div className="p-2 rounded bg-slate-950/20 border border-slate-855 text-[9px] text-slate-500 italic">
                Cảnh mở đầu câu chuyện.
              </div>
            )}

            {nextBeat ? (
              <div className="p-2 rounded bg-slate-950/40 border border-slate-855 text-[10px] space-y-1">
                <div className="flex items-center justify-between text-slate-455 font-bold text-[9px]">
                  <span className="flex items-center gap-0.5">
                    <Link2 size={9} className="text-violet-400" />
                    Ra sang S{beats.findIndex((b: any) => isSameScene(b.sceneId, nextBeat.sceneId)) + 1} ({nextBeat.emotion})
                  </span>
                </div>
                <p className="text-slate-350 italic text-[10px] leading-tight line-clamp-3">
                  {bridgeToNext ? bridgeToNext.description : `Chuyển cảm xúc sang ${nextBeat.emotion}.`}
                </p>
              </div>
            ) : (
              <div className="p-2 rounded bg-slate-950/20 border border-slate-855 text-[9px] text-slate-500 italic">
                Cảnh kết thúc câu chuyện.
              </div>
            )}
          </div>
        </div>

        {/* Sync Atmosphere Button */}
        {!isAtmosphereSynced && activeBeat && (
          <button
            onClick={handleApplyAtmosphere}
            disabled={justApplied}
            className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-black text-white flex items-center justify-center gap-2 border transition-all cursor-pointer ${
              justApplied
                ? 'bg-emerald-600/30 border-emerald-500/30 text-emerald-300'
                : 'bg-indigo-600/20 hover:bg-indigo-600/40 border-indigo-500/30 text-indigo-300'
            }`}
          >
            {justApplied ? 'Đã đồng bộ!' : 'Đồng bộ không khí từ Emotion Arc'}
          </button>
        )}
      </div>
    </div>
  );
};

export default ShotPlanSettingsPanel;
