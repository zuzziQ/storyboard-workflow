import React from 'react';
import { Database, User, MapPin, X, PlusCircle, Sparkles, Loader2, Upload, Wand2 } from 'lucide-react';
import type { AssetItem } from '../types';

interface AssetOrchestratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasCharacters: AssetItem[];
  canvasLocations: AssetItem[];
  canvasProps: AssetItem[];
  updateCanvasCharacters: (chars: AssetItem[]) => void;
  updateCanvasLocations: (locs: AssetItem[]) => void;
  updateCanvasProps: (props: AssetItem[]) => void;
  worldAssetChars: any[];
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  projects: any[];
  projectData: any;
  isSyncingAll: boolean;
  onSyncAll: () => void;
  assetActiveTab: 'character' | 'location' | 'prop';
  setAssetActiveTab: (tab: 'character' | 'location' | 'prop') => void;
  syncingStates: Record<string, boolean>;
  generatingStates: Record<string, boolean>;
  generatingPrompts: Record<string, boolean>;
  onAddNewChar: () => void;
  onAddNewLoc: () => void;
  onAddNewProp: () => void;
  onRemoveChar: (idx: number) => void;
  onRemoveLoc: (idx: number) => void;
  onRemoveProp: (idx: number) => void;
  onUploadFileChar: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onUploadFileLoc: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onUploadFileProp: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onLinkChar: (idx: number, val: string) => void;
  onLinkLoc: (idx: number, val: string) => void;
  onLinkProp: (idx: number, val: string) => void;
  onGenPromptChar: (idx: number) => void;
  onGenPromptLoc: (idx: number) => void;
  onGenPromptProp: (idx: number) => void;
  onGenImgChar: (idx: number) => void;
  onGenImgLoc: (idx: number) => void;
  onGenImgProp: (idx: number) => void;
  onSyncSingle: (type: 'character' | 'location' | 'prop', idx: number) => void;
  onZoomImage: (url: string) => void;
}

export function AssetOrchestratorModal({
  isOpen,
  onClose,
  canvasCharacters,
  canvasLocations,
  canvasProps,
  updateCanvasCharacters,
  updateCanvasLocations,
  updateCanvasProps,
  worldAssetChars,
  selectedProjectId,
  setSelectedProjectId,
  projects,
  projectData,
  isSyncingAll,
  onSyncAll,
  assetActiveTab,
  setAssetActiveTab,
  syncingStates,
  generatingStates,
  generatingPrompts,
  onAddNewChar,
  onAddNewLoc,
  onAddNewProp,
  onRemoveChar,
  onRemoveLoc,
  onRemoveProp,
  onUploadFileChar,
  onUploadFileLoc,
  onUploadFileProp,
  onLinkChar,
  onLinkLoc,
  onLinkProp,
  onGenPromptChar,
  onGenPromptLoc,
  onGenPromptProp,
  onGenImgChar,
  onGenImgLoc,
  onGenImgProp,
  onSyncSingle,
  onZoomImage
}: AssetOrchestratorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-2xl flex flex-col p-6 animate-fade-in text-white overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-600/30">
            <Database size={24} className="animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-black bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent uppercase tracking-wider">
              Bảng Điều Phối World Asset Master
            </h2>
            <p className="text-xs text-indigo-400 font-bold uppercase tracking-widest mt-0.5 font-sans">
              Universal Characters, Locations & Props Central Command
            </p>
          </div>
        </div>

        {/* Quick Universe Configurator inside Master Board */}
        <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800 rounded-2xl px-4 py-2">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-sans">Active Universe (Project)</span>
            <select 
              className="bg-transparent text-xs text-white outline-none font-bold cursor-pointer"
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              {projects.map((proj: any) => (
                <option key={proj.id} value={proj.id} className="bg-slate-950 text-white">{proj.name}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-6 bg-slate-800" />

          <div className="flex flex-col">
            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-sans">Labs ID (GFlow)</span>
            <span className="text-xs font-mono font-bold text-indigo-400">
              {projectData.id && projectData.id !== 'new' ? projectData.id.substring(0, 12) + '...' : 'Chưa Khởi Tạo'}
            </span>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onSyncAll}
            disabled={isSyncingAll}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 via-pink-600 to-amber-600 hover:from-violet-500 hover:to-amber-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(219,39,119,0.3)] shrink-0 active:scale-95 duration-200 border border-pink-500/20 cursor-pointer"
          >
            {isSyncingAll ? (
              <><Loader2 size={14} className="animate-spin" /> Đang đồng bộ...</>
            ) : (
              <><Sparkles size={14} fill="currentColor" /> ✨ Đồng Bộ Tất Cả</>
            )}
          </button>

          <button
            onClick={() => {
              if (assetActiveTab === 'character') onAddNewChar();
              else if (assetActiveTab === 'location') onAddNewLoc();
              else if (assetActiveTab === 'prop') onAddNewProp();
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 duration-200 cursor-pointer"
          >
            <PlusCircle size={14} /> Thêm Mới
          </button>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Sub Tabs Bar */}
      <div className="flex items-center gap-2 mb-6 bg-slate-900/40 p-1 border border-slate-800/80 rounded-2xl w-fit">
        <button 
          onClick={() => setAssetActiveTab('character')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${assetActiveTab === 'character' ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <User size={14} /> Nhân Vật ({canvasCharacters.length})
        </button>
        <button 
          onClick={() => setAssetActiveTab('location')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${assetActiveTab === 'location' ? 'bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <MapPin size={14} /> Bối Cảnh ({canvasLocations.length})
        </button>
        <button 
          onClick={() => setAssetActiveTab('prop')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${assetActiveTab === 'prop' ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}
        >
          <Database size={14} /> Đạo Cụ ({canvasProps.length})
        </button>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-6">
        
        {assetActiveTab === 'character' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="pb-3 pl-4 w-[100px]">Ảnh Ref</th>
                <th className="pb-3 w-[200px]">Tên Nhân Vật</th>
                <th className="pb-3">Mô tả DNA / Chi tiết Nhân vật</th>
                <th className="pb-3 w-[260px]">Liên kết DB & Labs</th>
                <th className="pb-3 w-[260px] text-right pr-4">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {canvasCharacters.map((char, idx) => {
                const isSyncing = syncingStates[`character-sync-${idx}`];
                const isGenPrompt = generatingPrompts[`char-prompt-${idx}`];
                const isGenImg = generatingStates[`char-gen-${idx}`];
                
                return (
                  <tr key={idx} className="hover:bg-slate-900/30 transition-colors group">
                    <td className="py-4 pl-4">
                      <div className="relative w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 group/thumb cursor-pointer shadow-inner">
                        {char.imageUrl ? (
                          <img 
                            src={char.imageUrl} 
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110" 
                            alt={char.name}
                            onClick={() => onZoomImage(char.imageUrl!)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-950">
                            <User size={24} className="text-slate-600" />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 flex flex-col items-center justify-center text-[8px] font-black text-white uppercase transition-opacity cursor-pointer">
                          <Upload size={14} className="mb-1 text-emerald-400" />
                          Tải Lên
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => onUploadFileChar(e, idx)} 
                          />
                        </label>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="text" 
                        value={char.name}
                        onChange={(e) => {
                          const updated = [...canvasCharacters];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          updateCanvasCharacters(updated);
                        }}
                        className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-emerald-500/50 w-full focus:bg-slate-950 font-sans"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <textarea 
                        value={char.description || ''}
                        onChange={(e) => {
                          const updated = [...canvasCharacters];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          updateCanvasCharacters(updated);
                        }}
                        className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500/50 w-full focus:bg-slate-950 h-16 resize-none custom-scrollbar font-mono leading-relaxed"
                        placeholder="Mô tả DNA ngoại hình, trang phục, giới tính của nhân vật..."
                      />
                    </td>
                    <td className="py-4 pr-4 space-y-2">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-wider font-sans">World Asset DB Entity</span>
                        <select
                          value={char.worldAssetCharId || ''}
                          onChange={(e) => onLinkChar(idx, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 text-xs text-emerald-400 font-bold outline-none focus:border-emerald-500/50 cursor-pointer"
                        >
                          <option value="">-- Chưa liên kết DB --</option>
                          {worldAssetChars.filter(c => c.entityType === 'character' || !c.entityType).map(db => (
                            <option key={db.id} value={db.id} className="bg-slate-950 text-white">{db.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-wider font-sans">Labs Media ID Reference</span>
                        <div className="px-2 py-1 bg-slate-950/90 rounded border border-slate-900 font-mono text-[9px] text-slate-400 select-all truncate">
                          {char.mediaId ? (
                            <span className="text-emerald-400 font-bold">{char.mediaId}</span>
                          ) : (
                            <span className="text-amber-500 font-semibold italic font-sans">Chưa đồng bộ Labs</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button
                          onClick={() => onGenPromptChar(idx)}
                          disabled={isGenPrompt}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 transition-all shrink-0 cursor-pointer"
                          title="Tự động tạo prompt mô tả DNA chi tiết cho nhân vật từ AI"
                        >
                          {isGenPrompt ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                          <span className="font-sans">AI Prompt</span>
                        </button>
                        <button
                          onClick={() => onGenImgChar(idx)}
                          disabled={isGenImg}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/20 transition-all shrink-0 cursor-pointer"
                          title="Dựng ảnh vẽ đại diện nhân vật bằng AI"
                        >
                          {isGenImg ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span className="font-sans">Vẽ ảnh</span>
                        </button>
                        <button
                          onClick={() => onSyncSingle('character', idx)}
                          disabled={isSyncing}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                          <span className="font-sans">Đồng bộ DB</span>
                        </button>
                        <button
                          onClick={() => onRemoveChar(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 transition-all shrink-0 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {assetActiveTab === 'location' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="pb-3 pl-4 w-[100px]">Ảnh Ref</th>
                <th className="pb-3 w-[200px]">Tên Bối Cảnh</th>
                <th className="pb-3">Mô tả Chi tiết Bối cảnh</th>
                <th className="pb-3 w-[260px]">Liên kết DB & Labs</th>
                <th className="pb-3 w-[260px] text-right pr-4">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {canvasLocations.map((loc, idx) => {
                const isSyncing = syncingStates[`location-sync-${idx}`];
                const isGenPrompt = generatingPrompts[`loc-prompt-${idx}`];
                const isGenImg = generatingStates[`loc-gen-${idx}`];
                
                return (
                  <tr key={idx} className="hover:bg-slate-900/30 transition-colors group">
                    <td className="py-4 pl-4">
                      <div className="relative w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 group/thumb cursor-pointer shadow-inner">
                        {loc.imageUrl ? (
                          <img 
                            src={loc.imageUrl} 
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110" 
                            alt={loc.name}
                            onClick={() => onZoomImage(loc.imageUrl!)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-950">
                            <MapPin size={24} className="text-slate-600" />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 flex flex-col items-center justify-center text-[8px] font-black text-white uppercase transition-opacity cursor-pointer">
                          <Upload size={14} className="mb-1 text-emerald-400" />
                          Tải Lên
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => onUploadFileLoc(e, idx)} 
                          />
                        </label>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="text" 
                        value={loc.name}
                        onChange={(e) => {
                          const updated = [...canvasLocations];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          updateCanvasLocations(updated);
                        }}
                        className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-orange-500/50 w-full focus:bg-slate-950 font-sans"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <textarea 
                        value={loc.description || ''}
                        onChange={(e) => {
                          const updated = [...canvasLocations];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          updateCanvasLocations(updated);
                        }}
                        className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-orange-500/50 w-full focus:bg-slate-950 h-16 resize-none custom-scrollbar font-mono leading-relaxed"
                        placeholder="Mô tả bối cảnh, ánh sáng, địa điểm, thời tiết..."
                      />
                    </td>
                    <td className="py-4 pr-4 space-y-2">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-wider font-sans">World Asset DB Entity</span>
                        <select
                          value={loc.worldAssetCharId || ''}
                          onChange={(e) => onLinkLoc(idx, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 text-xs text-orange-400 font-bold outline-none focus:border-orange-500/50 cursor-pointer"
                        >
                          <option value="">-- Chưa liên kết DB --</option>
                          {worldAssetChars.filter(c => c.entityType === 'location').map(db => (
                            <option key={db.id} value={db.id} className="bg-slate-950 text-white">{db.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-wider font-sans">Labs Media ID Reference</span>
                        <div className="px-2 py-1 bg-slate-950/90 rounded border border-slate-900 font-mono text-[9px] text-slate-400 select-all truncate">
                          {loc.mediaId ? (
                            <span className="text-emerald-400 font-bold">{loc.mediaId}</span>
                          ) : (
                            <span className="text-amber-500 font-semibold italic font-sans">Chưa đồng bộ Labs</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button
                          onClick={() => onGenPromptLoc(idx)}
                          disabled={isGenPrompt}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 transition-all shrink-0 cursor-pointer"
                        >
                          {isGenPrompt ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                          <span className="font-sans">AI Prompt</span>
                        </button>
                        <button
                          onClick={() => onGenImgLoc(idx)}
                          disabled={isGenImg}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/20 transition-all shrink-0 cursor-pointer"
                        >
                          {isGenImg ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span className="font-sans">Vẽ ảnh</span>
                        </button>
                        <button
                          onClick={() => onSyncSingle('location', idx)}
                          disabled={isSyncing}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                          <span className="font-sans">Đồng bộ DB</span>
                        </button>
                        <button
                          onClick={() => onRemoveLoc(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 transition-all shrink-0 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {assetActiveTab === 'prop' && (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800/60 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                <th className="pb-3 pl-4 w-[100px]">Ảnh Ref</th>
                <th className="pb-3 w-[200px]">Tên Đạo Cụ</th>
                <th className="pb-3">Mô tả Đạo Cụ / Chi tiết</th>
                <th className="pb-3 w-[260px]">Liên kết DB & Labs</th>
                <th className="pb-3 w-[260px] text-right pr-4">Hành Động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {canvasProps.map((prop, idx) => {
                const isSyncing = syncingStates[`prop-sync-${idx}`];
                const isGenPrompt = generatingPrompts[`prop-prompt-${idx}`];
                const isGenImg = generatingStates[`prop-gen-${idx}`];
                
                return (
                  <tr key={idx} className="hover:bg-slate-900/30 transition-colors group">
                    <td className="py-4 pl-4">
                      <div className="relative w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 group/thumb cursor-pointer shadow-inner">
                        {prop.imageUrl ? (
                          <img 
                            src={prop.imageUrl} 
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-110" 
                            alt={prop.name}
                            onClick={() => onZoomImage(prop.imageUrl!)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-950">
                            <Database size={24} className="text-slate-600" />
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/70 opacity-0 group-hover/thumb:opacity-100 flex flex-col items-center justify-center text-[8px] font-black text-white uppercase transition-opacity cursor-pointer">
                          <Upload size={14} className="mb-1 text-emerald-400" />
                          Tải Lên
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => onUploadFileProp(e, idx)} 
                          />
                        </label>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <input 
                        type="text" 
                        value={prop.name}
                        onChange={(e) => {
                          const updated = [...canvasProps];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          updateCanvasProps(updated);
                        }}
                        className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-amber-500/50 w-full focus:bg-slate-950 font-sans"
                      />
                    </td>
                    <td className="py-4 pr-4">
                      <textarea 
                        value={prop.description || ''}
                        onChange={(e) => {
                          const updated = [...canvasProps];
                          updated[idx] = { ...updated[idx], description: e.target.value };
                          updateCanvasProps(updated);
                        }}
                        className="bg-slate-950/80 border border-slate-900 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-amber-500/50 w-full focus:bg-slate-950 h-16 resize-none custom-scrollbar font-mono leading-relaxed"
                        placeholder="Mô tả công dụng, màu sắc, hình dáng đặc trưng của đạo cụ..."
                      />
                    </td>
                    <td className="py-4 pr-4 space-y-2">
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-wider font-sans">World Asset DB Entity</span>
                        <select
                          value={prop.worldAssetCharId || ''}
                          onChange={(e) => onLinkProp(idx, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-900 rounded-xl px-3 py-1.5 text-xs text-amber-400 font-bold outline-none focus:border-amber-500/50 cursor-pointer"
                        >
                          <option value="">-- Chưa liên kết DB --</option>
                          {worldAssetChars.filter(c => c.entityType === 'prop').map(db => (
                            <option key={db.id} value={db.id} className="bg-slate-950 text-white">{db.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold block mb-1 uppercase tracking-wider font-sans">Labs Media ID Reference</span>
                        <div className="px-2 py-1 bg-slate-950/90 rounded border border-slate-900 font-mono text-[9px] text-slate-400 select-all truncate">
                          {prop.mediaId ? (
                            <span className="text-emerald-400 font-bold">{prop.mediaId}</span>
                          ) : (
                            <span className="text-amber-500 font-semibold italic font-sans">Chưa đồng bộ Labs</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <button
                          onClick={() => onGenPromptProp(idx)}
                          disabled={isGenPrompt}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-[10px] font-bold border border-indigo-500/20 transition-all shrink-0 cursor-pointer"
                        >
                          {isGenPrompt ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                          <span className="font-sans">AI Prompt</span>
                        </button>
                        <button
                          onClick={() => onGenImgProp(idx)}
                          disabled={isGenImg}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 text-[10px] font-bold border border-sky-500/20 transition-all shrink-0 cursor-pointer"
                        >
                          {isGenImg ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                          <span className="font-sans">Vẽ ảnh</span>
                        </button>
                        <button
                          onClick={() => onSyncSingle('prop', idx)}
                          disabled={isSyncing}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                        >
                          {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                          <span className="font-sans">Đồng bộ DB</span>
                        </button>
                        <button
                          onClick={() => onRemoveProp(idx)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/10 transition-all shrink-0 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

      </div>
    </div>
  );
}
