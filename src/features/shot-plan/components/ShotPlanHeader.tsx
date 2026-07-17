import React from 'react';
import { Film, X, ArrowLeft, Loader2, Sparkles } from 'lucide-react';

interface ShotPlanHeaderProps {
  isOverview: boolean;
  activeSceneId: string;
  activeScene: any;
  scenes: any[];
  pendingShots: any[];
  setActiveSceneId: (id: string) => void;
  handleRegenerateSceneShots: (scene: any) => Promise<void>;
  isRegenerating: boolean;
  handleAiAnalyzeShots: () => Promise<void>;
  isAnalyzingAi: boolean;
  runBatchGenForScene: (type: 'image' | 'video') => Promise<void>;
  batchQueueStatus: any;
  handleAddNewShot: (sceneId: string) => void;
  cancelBatchRef: React.MutableRefObject<boolean>;
  totalCount: number;
  hasImageCount: number;
  hasVideoCount: number;
  activeSceneShots: any[];
}

export const ShotPlanHeader: React.FC<ShotPlanHeaderProps> = ({
  isOverview,
  activeSceneId,
  activeScene,
  scenes,
  pendingShots,
  setActiveSceneId,
  handleRegenerateSceneShots,
  isRegenerating,
  handleAiAnalyzeShots,
  isAnalyzingAi,
  runBatchGenForScene,
  batchQueueStatus,
  handleAddNewShot,
  cancelBatchRef,
  totalCount,
  hasImageCount,
  hasVideoCount,
  activeSceneShots
}) => {
  const totalDuration = activeSceneShots.reduce((acc: number, sh: any) => acc + (Number(sh.duration) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Top Header Row */}
      <div className="px-4 py-3 bg-[#1a1a22] border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <Film size={16} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">SHOT PLANNER (Drawer)</div>
            <div className="text-sm font-black text-white">
              {isOverview ? 'Tổng Quan Phân Cảnh' : `Thiết Kế Shot Setup: Cảnh ${activeSceneId}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
            <span>Scenes: {scenes.length}</span>
            <span className="text-slate-650">|</span>
            <span>Shots: {pendingShots.length}</span>
          </div>
          {!isOverview && (
            <button
              onClick={() => setActiveSceneId('all')}
              className="p-1 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-800"
              title="Đóng bảng Shot Setup"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Quick Action Controls & Progress Status Bar for Detailed Mode */}
      {!isOverview && (
        <div className="px-4 py-1 space-y-3">
          {/* Top Line Action Buttons */}
          <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSceneId('all')}
                className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                title="Quay lại tổng quan"
              >
                <ArrowLeft size={14} />
              </button>
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                {activeSceneId}
              </span>
              <span className="text-xs font-bold text-white truncate max-w-[280px]">
                📍 {activeScene?.location || 'Chưa đặt bối cảnh'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleRegenerateSceneShots(activeScene)}
                disabled={isRegenerating}
                className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-655 hover:text-white border border-indigo-500/30 text-[10px] font-black text-indigo-300 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                    Đang chạy LangGraph...
                  </>
                ) : (
                  <>⚡ Sinh lại Storyboard Cảnh Này</>
                )}
              </button>
              <button
                onClick={handleAiAnalyzeShots}
                disabled={isAnalyzingAi}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-355 hover:text-white border border-amber-500/30 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {isAnalyzingAi ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-amber-400" />
                    <span>Đang phân tích...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={11} className="text-amber-400" />
                    <span>🤖 AI PHÂN TÍCH SHOT</span>
                  </>
                )}
              </button>
              <button
                onClick={() => runBatchGenForScene('image')}
                disabled={!!batchQueueStatus}
                className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-655 hover:text-white border border-indigo-500/30 text-[10px] font-black text-indigo-300 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                🎨 TẠO ALL STORYBOARD
              </button>
              <button
                onClick={() => runBatchGenForScene('video')}
                disabled={!!batchQueueStatus}
                className="flex items-center gap-1 px-3 py-1 bg-purple-600/20 hover:bg-purple-655 hover:text-white border border-purple-500/30 text-[10px] font-black text-purple-300 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
              >
                🎬 DỰNG ALL VIDEO
              </button>
              <button
                onClick={() => handleAddNewShot(activeSceneId)}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-600/20 hover:bg-emerald-655 hover:text-white border border-emerald-500/30 text-[10px] font-black text-emerald-300 rounded-lg transition-all active:scale-95 cursor-pointer"
              >
                ➕ Thêm Shot mới
              </button>
            </div>
          </div>

          {/* Batch Status */}
          {batchQueueStatus && (
            <div className="mb-4 p-3 bg-slate-900 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-[11px] shadow-lg animate-pulse">
              <div className="flex items-center gap-2 truncate">
                <Loader2 className="animate-spin text-indigo-400 shrink-0" size={13} />
                <span className="font-bold text-indigo-300 uppercase shrink-0">
                  [Hàng đợi {batchQueueStatus.type === 'image' ? 'Storyboard' : 'Video'}]:
                </span>
                <span className="text-slate-300 font-semibold truncate">{batchQueueStatus.statusText}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[9px] bg-indigo-950/60 px-2 py-0.5 rounded-full text-indigo-300 border border-indigo-800/40 font-black">
                  {batchQueueStatus.current}/{batchQueueStatus.total} Shot
                </span>
                <button
                  onClick={() => { cancelBatchRef.current = true; }}
                  className="px-2 py-0.5 bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-200 hover:text-white rounded-lg text-[9px] font-bold active:scale-95 transition-all cursor-pointer"
                >
                  HỦY
                </button>
              </div>
            </div>
          )}

          {/* Statistics Info Row */}
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-855 rounded-xl p-3 text-xs text-slate-300">
            <div className="flex items-center gap-3 font-semibold text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                Tổng: <strong className="text-white">{totalCount}</strong> shots
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Có ảnh: <strong className="text-white">{hasImageCount}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Có video: <strong className="text-white">{hasVideoCount}</strong>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Tổng lượng: <strong className="text-white">{totalDuration}s</strong>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ShotPlanHeader;
