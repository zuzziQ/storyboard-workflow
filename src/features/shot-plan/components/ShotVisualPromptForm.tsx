import React from 'react';
import { Sparkles } from 'lucide-react';
import HighlightedTextarea from '../../../components/HighlightedTextarea';

interface ShotVisualPromptFormProps {
  sh: any;
  localPrompt: string;
  setLocalPrompt: (val: string) => void;
  localCameraHeight: string;
  setLocalCameraHeight: (val: string) => void;
  localPanelGrid: string;
  setLocalPanelGrid: (val: string) => void;
  localBearing: number;
  setLocalBearing: (val: number) => void;
  localSide: 'A' | 'B';
  setLocalSide: (val: 'A' | 'B') => void;
  localCameraMovement: string;
  setLocalCameraMovement: (val: string) => void;
  localRenderMode: string;
  setLocalRenderMode: (val: string) => void;
  localCameraMovementDetail: string;
  setLocalCameraMovementDetail: (val: string) => void;
  handleBlur: () => void;
  wordCount: number;
  isOverBudget: boolean;
  qcResult: any;
  handleAiRegeneratePromptWithLocal: () => Promise<void>;
  normalizeCameraMovement: (val: string) => string;
  isGeneratingPrompt?: boolean;
}

export const ShotVisualPromptForm: React.FC<ShotVisualPromptFormProps> = ({
  sh,
  localPrompt,
  setLocalPrompt,
  localCameraHeight,
  setLocalCameraHeight,
  localPanelGrid,
  setLocalPanelGrid,
  localBearing,
  setLocalBearing,
  localSide,
  setLocalSide,
  localCameraMovement,
  setLocalCameraMovement,
  localRenderMode,
  setLocalRenderMode,
  localCameraMovementDetail,
  setLocalCameraMovementDetail,
  handleBlur,
  wordCount,
  isOverBudget,
  qcResult,
  handleAiRegeneratePromptWithLocal,
  normalizeCameraMovement,
  isGeneratingPrompt
}) => {
  return (
    <div className="space-y-4">
      {/* Visual Prompt Textarea */}
      <div className="space-y-2.5">
        <div className="space-y-0.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-[8.5px] font-black text-indigo-400 uppercase block">MÔ TẢ VẼ ẢNH (PROMPT)</span>
              <button
                type="button"
                onClick={handleAiRegeneratePromptWithLocal}
                disabled={isGeneratingPrompt}
                className="px-1.5 py-0.5 bg-indigo-600/20 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-[8px] font-black text-indigo-300 rounded transition-all flex items-center gap-0.5 active:scale-95 cursor-pointer disabled:opacity-50"
                title="Tự động biên dịch & sinh lại prompt vẽ ảnh & video dựa trên các thiết lập đã sửa"
              >
                <Sparkles size={9} /> {isGeneratingPrompt ? 'Refining...' : 'Auto Refine'}
              </button>
            </div>
            <span className={`text-[8px] font-bold ${isOverBudget ? 'text-rose-455 animate-pulse' : 'text-slate-550'}`}>{wordCount}/180 từ</span>
          </div>
          <HighlightedTextarea
            value={localPrompt}
            onChange={(e: any) => setLocalPrompt(e.target.value)}
            onBlur={handleBlur}
            disabled={sh.isApproved}
            placeholder="Mô tả góc máy, bối cảnh, ánh sáng, chi tiết vẽ ảnh..."
            bannedWords={qcResult.bannedWordsMatched}
            className="h-36 2xl:h-72 min-h-[140px]"
          />
        </div>
      </div>

      {/* Camera Controls Panel */}
      <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
        <h5 className="text-[9.5px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Thông Số Góc Máy &amp; Chuyển Động (Camera Setup)</h5>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Cỡ Cảnh / Camera Height</label>
            <select
              value={localCameraHeight}
              onChange={(e) => setLocalCameraHeight(e.target.value)}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-blue-400 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer"
              style={{ backgroundColor: '#09090c' }}
            >
              <option value="EYE" style={{ backgroundColor: '#09090c', color: '#60a5fa' }}>Eye-Level</option>
              <option value="HIGH" style={{ backgroundColor: '#09090c', color: '#60a5fa' }}>High Angle</option>
              <option value="LOW" style={{ backgroundColor: '#09090c', color: '#60a5fa' }}>Low Angle</option>
              <option value="BIRD" style={{ backgroundColor: '#09090c', color: '#60a5fa' }}>Bird View</option>
            </select>
          </div>
          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Layout Grid</label>
            <select
              value={localPanelGrid}
              onChange={(e) => setLocalPanelGrid(e.target.value)}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-fuchsia-400 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer"
              style={{ backgroundColor: '#09090c' }}
            >
              <option value="1x1" style={{ backgroundColor: '#09090c', color: '#e879f9' }}>1x1 (Single)</option>
              <option value="1x2" style={{ backgroundColor: '#09090c', color: '#e879f9' }}>1x2 Panel</option>
              <option value="2x2" style={{ backgroundColor: '#09090c', color: '#e879f9' }}>2x2 Grid</option>
              <option value="2x3" style={{ backgroundColor: '#09090c', color: '#e879f9' }}>2x3 Grid</option>
            </select>
          </div>

          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Camera Bearing (Xoay °)</label>
            <input
              type="number"
              value={localBearing}
              onChange={(e) => setLocalBearing(Number(e.target.value))}
              onBlur={handleBlur}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-blue-300 font-bold outline-none text-[11px] focus:border-indigo-500/40"
              style={{ backgroundColor: '#09090c', color: '#60a5fa' }}
              placeholder="Ví dụ: 20"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Camera Side (Trục)</label>
            <select
              value={localSide}
              onChange={(e) => setLocalSide(e.target.value as 'A' | 'B')}
              onBlur={handleBlur}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-blue-300 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer"
              style={{ backgroundColor: '#09090c' }}
            >
              <option value="A" style={{ backgroundColor: '#09090c', color: '#60a5fa' }}>Side A</option>
              <option value="B" style={{ backgroundColor: '#09090c', color: '#60a5fa' }}>Side B</option>
            </select>
          </div>

          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Camera Movement</label>
            <select
              value={normalizeCameraMovement(localCameraMovement)}
              onChange={(e) => setLocalCameraMovement(e.target.value)}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-purple-400 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer"
              style={{ backgroundColor: '#09090c' }}
            >
              <option value="STATIC" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Static Tilt</option>
              <option value="PAN_LEFT" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Pan Left</option>
              <option value="PAN_RIGHT" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Pan Right</option>
              <option value="TILT_UP" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Tilt Up</option>
              <option value="TILT_DOWN" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Tilt Down</option>
              <option value="ZOOM_IN" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Zoom In</option>
              <option value="ZOOM_OUT" style={{ backgroundColor: '#09090c', color: '#c084fc' }}>Zoom Out</option>
            </select>
          </div>
          <div className="space-y-0.5">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Render Mode</label>
            <select
              value={localRenderMode}
              onChange={(e) => setLocalRenderMode(e.target.value)}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-pink-400 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer"
              style={{ backgroundColor: '#09090c' }}
            >
              <option value="combined" style={{ backgroundColor: '#09090c', color: '#f472b6' }}>Combined (Ghép Ref)</option>
              <option value="location_only" style={{ backgroundColor: '#09090c', color: '#f472b6' }}>Location Only</option>
              <option value="character_only" style={{ backgroundColor: '#09090c', color: '#f472b6' }}>Character Only</option>
            </select>
          </div>

          <div className="space-y-0.5 col-span-2">
            <label className="text-[8.5px] font-black text-slate-400 uppercase block">Chi Tiết Chuyển Động Camera (Camera Movement Detail)</label>
            <input
              type="text"
              value={localCameraMovementDetail}
              onChange={(e) => setLocalCameraMovementDetail(e.target.value)}
              onBlur={handleBlur}
              className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-purple-300 font-bold outline-none text-[11px] focus:border-indigo-500/40"
              style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
              placeholder="Ví dụ: TRACKING MICRO-DRIFT ALONG SOFA LINE..."
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShotVisualPromptForm;
