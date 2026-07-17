import React from 'react';
import { Loader2, Wand2, Maximize2, ImageIcon, Lock } from 'lucide-react';

interface PacoPipelineEngineProps {
  sh: any;
  activeDetailTab: 'image' | 'video';
  setActiveDetailTab: (val: 'image' | 'video') => void;
  videoUrl: string | null;
  storyboardUrl: string | null;
  isExtractingFrame: boolean;
  handleExtractLastFrame: () => void;
  isAutoDrawing: boolean;
  handleAutoLayout: () => void;
  setSelectedZoomImage: (url: string) => void;
  imageProvider: string;
  localStoryboardModel: string;
  setLocalStoryboardModel: (val: string) => void;
  runImageGenWithLocal: () => void;
  renderingStates: Record<string, string>;
  autoLayoutPreview: string | null;
}

export default function PacoPipelineEngine({
  sh, activeDetailTab, setActiveDetailTab,
  videoUrl, storyboardUrl,
  isExtractingFrame, handleExtractLastFrame,
  isAutoDrawing, handleAutoLayout,
  setSelectedZoomImage,
  imageProvider, localStoryboardModel, setLocalStoryboardModel,
  runImageGenWithLocal, renderingStates, autoLayoutPreview
}: PacoPipelineEngineProps) {
  
  // Kiểm tra xem shot đã có layout (getBoundingBox) chưa
  const hasLayout = sh.layout?.characters?.length > 0 || autoLayoutPreview;
  const isStateActive = (s: string) => ['processing', 'queued', 'pushing_hub'].includes(s);

  return (
    <div className="w-[48%] space-y-3 flex flex-col overflow-y-auto custom-scrollbar pr-1 max-h-full">
      <div className="flex gap-1.5 p-0.5 bg-[#1e160f] border border-amber-900/40 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveDetailTab('image')}
          className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all duration-150 ${activeDetailTab === 'image' ? 'bg-amber-600 text-white shadow shadow-amber-500/20' : 'text-amber-700/60 hover:text-amber-500'}`}
        >
          Storyboard & Khối
        </button>
        <button
          type="button"
          onClick={() => setActiveDetailTab('video')}
          className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all duration-150 ${activeDetailTab === 'video' ? 'bg-amber-600 text-white shadow shadow-amber-500/20' : 'text-amber-700/60 hover:text-amber-500'}`}
        >
          Dựng Video
        </button>
      </div>

      <div className="h-[220px] bg-[#09090c] border border-amber-900/30 rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner group shrink-0">
        {activeDetailTab === 'video' && videoUrl ? (
          <>
            <video src={videoUrl} className="w-full h-full object-contain" controls autoPlay muted loop />
            <button
              type="button"
              onClick={handleExtractLastFrame}
              disabled={isExtractingFrame}
              className="absolute bottom-3 right-3 bg-amber-600/90 hover:bg-amber-650 text-white text-[9px] px-2 py-1 rounded-lg font-black transition-all shadow-md active:scale-95 z-10 flex items-center gap-1 cursor-pointer border border-amber-500/30 disabled:opacity-50"
              title="Trích xuất frame cuối của video"
            >
              {isExtractingFrame ? <Loader2 size={10} className="animate-spin" /> : <span>🪄 Lấy frame raccord</span>}
            </button>
          </>
        ) : (activeDetailTab === 'image' && (autoLayoutPreview || storyboardUrl)) || (!videoUrl && (autoLayoutPreview || storyboardUrl)) ? (
          <>
            <img src={autoLayoutPreview || storyboardUrl || ''} className="w-full h-full object-contain" alt="Preview" />
          </>
        ) : (
          <div className="text-center text-amber-900/40 space-y-1">
            <ImageIcon size={36} className="mx-auto text-amber-900/30" />
            <span className="text-[10px] block">
              {activeDetailTab === 'video' ? 'Chưa dựng Video' : 'Chưa vẽ Khối hoặc Storyboard'}
            </span>
          </div>
        )}

        {(autoLayoutPreview || storyboardUrl) && (
          <button
            type="button"
            onClick={() => setSelectedZoomImage(autoLayoutPreview || storyboardUrl || '')}
            className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            title="Phóng to ảnh"
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {/* PIPELINE ENGINE (2 STEPS) */}
      <div className="p-3 rounded-2xl bg-[#1e160f] border border-amber-500/20 space-y-3 shrink-0">
        <div className="flex items-center justify-between border-b border-amber-900/30 pb-1.5">
          <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Pipeline Engine</span>
        </div>

        {/* STEP 1: LAYOUT */}
        <div className="space-y-1.5 bg-[#0c0906] p-2 rounded-xl border border-amber-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[9.5px] font-black uppercase text-amber-400">Bước 1: Khởi tạo Khối (Layout)</span>
            {hasLayout && <span className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase font-bold tracking-wider">Đã có</span>}
          </div>
          <p className="text-[9px] text-amber-700/80 leading-tight">AI sẽ phân tích prompt để xác định vị trí và kích thước nhân vật (Bounding Box).</p>
          <button
            type="button"
            onClick={handleAutoLayout}
            disabled={isAutoDrawing}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] py-1.5 rounded-lg font-black transition-all active:scale-95 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {isAutoDrawing ? <Loader2 size={12} className="animate-spin" /> : <span>🪄 Generate Auto Layout</span>}
          </button>
        </div>

        {/* STEP 2: STORYBOARD */}
        <div className={`space-y-1.5 bg-[#0c0906] p-2 rounded-xl border transition-all ${hasLayout ? 'border-amber-500/30' : 'border-slate-800/50 opacity-60'}`}>
          <span className="text-[9.5px] font-black uppercase text-pink-400">Bước 2: Vẽ Storyboard</span>
          {!hasLayout && (
            <p className="text-[8px] text-pink-400/70 italic">* Khuyến nghị: Hoàn thành Bước 1 trước để AI vẽ chính xác vị trí.</p>
          )}
          <select 
            value={localStoryboardModel} 
            onChange={e => setLocalStoryboardModel(e.target.value)}
            className="w-full bg-[#1e160f] border border-amber-900/50 rounded-lg py-1 px-2 text-[10px] font-bold text-pink-400 outline-none focus:border-amber-500/40 cursor-pointer"
          >
            <option value="auto">Auto Model (Mặc định)</option>
            <option value="flux_schnell">Flux Schnell</option>
            <option value="imagen-3.0-fast-002">Imagen 3.0 Fast</option>
          </select>
          {sh.isApproved ? (
            <div className="w-full py-1.5 bg-slate-900/60 border border-slate-800/50 text-slate-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 cursor-default">
              <Lock size={11} className="text-slate-500" />
              <span>Đã khóa</span>
            </div>
          ) : (
            <button
              onClick={runImageGenWithLocal}
              disabled={isStateActive(renderingStates[sh.beat || sh.id])}
              className="w-full py-1.5 bg-pink-650 hover:bg-pink-600 text-white font-black text-[10.5px] uppercase rounded-xl transition-all shadow-lg shadow-pink-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
            >
              {isStateActive(renderingStates[sh.beat || sh.id]) ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              <span>{isStateActive(renderingStates[sh.beat || sh.id]) ? renderingStates[sh.beat || sh.id] : "Render Storyboard"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
