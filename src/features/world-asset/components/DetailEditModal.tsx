import React from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Sparkles, Wand2, Loader2, User, MapPin, Database } from 'lucide-react';
import type { AssetItem, AssetType } from '../types';

interface DetailEditModalProps {
  editingAsset: { type: AssetType; index: number } | null;
  onClose: () => void;
  canvasCharacters: AssetItem[];
  canvasLocations: AssetItem[];
  canvasProps: AssetItem[];
  updateCanvasCharacters: (chars: AssetItem[]) => void;
  updateCanvasLocations: (locs: AssetItem[]) => void;
  updateCanvasProps: (props: AssetItem[]) => void;
  worldAssetChars: any[];
  syncingStates: Record<string, boolean>;
  generatingStates: Record<string, boolean>;
  generatingPrompts: Record<string, boolean>;
  onUploadFileChar: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onUploadFileLoc: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onUploadFileProp: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  onLinkChar: (idx: number, val: string) => void;
  onLinkLoc: (idx: number, val: string) => void;
  onLinkProp: (idx: number, val: string) => void;
  onGeneratePromptChar: (idx: number) => void;
  onGeneratePromptLoc: (idx: number) => void;
  onGeneratePromptProp: (idx: number) => void;
  onAutoGenChar: (idx: number) => void;
  onAutoGenLoc: (idx: number) => void;
  onAutoGenProp: (idx: number) => void;
  onSyncAssetToLibrary: (type: AssetType, idx: number) => void;
  onOpenSliceModal: (asset: any) => void;
}

export function DetailEditModal({
  editingAsset,
  onClose,
  canvasCharacters,
  canvasLocations,
  canvasProps,
  updateCanvasCharacters,
  updateCanvasLocations,
  updateCanvasProps,
  worldAssetChars,
  syncingStates,
  generatingStates,
  generatingPrompts,
  onUploadFileChar,
  onUploadFileLoc,
  onUploadFileProp,
  onLinkChar,
  onLinkLoc,
  onLinkProp,
  onGeneratePromptChar,
  onGeneratePromptLoc,
  onGeneratePromptProp,
  onAutoGenChar,
  onAutoGenLoc,
  onAutoGenProp,
  onSyncAssetToLibrary,
  onOpenSliceModal
}: DetailEditModalProps) {
  if (!editingAsset) return null;

  const { type, index } = editingAsset;
  const item = type === 'character' 
    ? canvasCharacters[index] 
    : type === 'location' 
      ? canvasLocations[index] 
      : canvasProps[index];
  
  if (!item) return null;

  const isChar = type === 'character';
  const isLoc = type === 'location';
  const isProp = type === 'prop';

  // Check active states
  const isSyncing = syncingStates[`${type}-sync-${index}`];
  const isGenPrompt = generatingPrompts[`${isChar ? 'char' : isLoc ? 'loc' : 'prop'}-prompt-${index}`];
  const isGenImg = generatingStates[`${isChar ? 'char' : isLoc ? 'loc' : 'prop'}-gen-${index}`];

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in text-white">
      <div className="bg-[#1c1c24] w-full max-w-3xl rounded-2xl border border-slate-800 shadow-[0_15px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-[#24242d] p-4 flex items-center justify-between border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${
              isChar ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 
              isLoc ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 
              'bg-amber-500/10 text-amber-400 border border-amber-500/20'
            }`}>
              {isChar ? 'Nhân Vật' : isLoc ? 'Bối Cảnh' : 'Đạo Cụ'}
            </span>
            <h3 className="text-sm font-bold text-slate-100 font-sans">Chi tiết & Biên tập Concept</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-850 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-5 gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          
          {/* Left side: Image & DB Link (2/5 cols) */}
          <div className="md:col-span-2 space-y-4 text-left">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Ảnh Concept / Reference</span>
              <div className="relative aspect-square w-full rounded-xl bg-slate-900 border border-slate-800 overflow-hidden group/modal-thumb cursor-pointer shadow-inner">
                {item.imageUrl ? (
                  <>
                    <img 
                      src={item.imageUrl} 
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105" 
                      alt={item.name} 
                    />
                    <label className="absolute inset-0 bg-black/70 opacity-0 group-hover/modal-thumb:opacity-100 flex flex-col items-center justify-center text-xs font-bold text-white uppercase transition-opacity cursor-pointer">
                      <Upload size={18} className="mb-1 text-emerald-400 animate-bounce" />
                      Tải ảnh mới
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (isChar) onUploadFileChar(e, index);
                          else if (isLoc) onUploadFileLoc(e, index);
                          else if (isProp) onUploadFileProp(e, index);
                        }} 
                      />
                    </label>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center bg-slate-950 hover:bg-slate-900/80 transition-colors cursor-pointer">
                    {isChar ? <User size={48} className="text-slate-700" /> : isLoc ? <MapPin size={48} className="text-slate-700" /> : <Database size={48} className="text-slate-700" />}
                    <span className="text-[10px] text-slate-400 font-bold uppercase mt-3 hover:text-white flex items-center gap-1"><Upload size={12} /> Tải ảnh lên</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        if (isChar) onUploadFileChar(e, index);
                        else if (isLoc) onUploadFileLoc(e, index);
                        else if (isProp) onUploadFileProp(e, index);
                      }} 
                    />
                  </label>
                )}
              </div>
              {item.imageUrl && (item.gridFormat === '2x2' || item.gridFormat === '2x3') && (
                <button
                  type="button"
                  onClick={() => onOpenSliceModal({
                    type,
                    index,
                    name: item.name,
                    imageUrl: item.imageUrl,
                    worldAssetCharId: item.worldAssetCharId,
                    gridFormat: item.gridFormat || '2x2'
                  })}
                  className="w-full py-2 px-3 bg-[#4f46e5]/10 hover:bg-[#4f46e5]/20 text-[#818cf8] border border-[#4f46e5]/20 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all mt-2 active:scale-95 cursor-pointer"
                >
                  <Sparkles size={14} />
                  <span>Cắt Góc Ref (Multi-angle)</span>
                </button>
              )}
            </div>

            {/* DB entity linking */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Liên kết World Asset DB</span>
              <select
                value={item.worldAssetCharId || ""}
                onChange={(e) => {
                  if (isChar) onLinkChar(index, e.target.value);
                  else if (isLoc) onLinkLoc(index, e.target.value);
                  else if (isProp) onLinkProp(index, e.target.value);
                }}
                className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold outline-none transition-all cursor-pointer ${
                  isChar ? 'text-emerald-400 focus:border-emerald-500/50' : 
                  isLoc ? 'text-orange-400 focus:border-orange-500/50' : 
                  'text-amber-400 focus:border-amber-500/50'
                }`}
              >
                <option value="">🔗 Chưa liên kết World Asset...</option>
                {worldAssetChars
                  .filter(c => (isChar && (c.entityType === 'character' || !c.entityType)) || (isLoc && c.entityType === 'location') || (isProp && c.entityType === 'prop'))
                  .map((db: any) => (
                    <option key={db.id} value={db.id} className="text-slate-300 bg-slate-950">
                       {db.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Render Mode & Grid Format selectors in edit modal */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Render Mode</span>
                <select
                  value={item.renderMode || (isChar ? 'character_only' : isLoc ? 'location_only' : 'combined')}
                  onChange={(e) => {
                    const arr = isChar ? canvasCharacters : isLoc ? canvasLocations : canvasProps;
                    const updated = [...arr];
                    updated[index] = { ...updated[index], renderMode: e.target.value };
                    if (isChar) updateCanvasCharacters(updated);
                    else if (isLoc) updateCanvasLocations(updated);
                    else if (isProp) updateCanvasProps(updated);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-indigo-500/50 cursor-pointer text-white"
                >
                  <option value="combined" className="bg-slate-950 text-white">Combined</option>
                  <option value="character_only" className="bg-slate-950 text-white">Character Only</option>
                  <option value="location_only" className="bg-slate-950 text-white">Location Only</option>
                </select>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Grid Format</span>
                <select
                  value={item.gridFormat || (isChar ? '2x2' : isLoc ? '2x2' : '1x1')}
                  onChange={(e) => {
                    const arr = isChar ? canvasCharacters : isLoc ? canvasLocations : canvasProps;
                    const updated = [...arr];
                    updated[index] = { ...updated[index], gridFormat: e.target.value };
                    if (isChar) updateCanvasCharacters(updated);
                    else if (isLoc) updateCanvasLocations(updated);
                    else if (isProp) updateCanvasProps(updated);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-indigo-500/50 cursor-pointer text-white"
                >
                  <option value="1x1" className="bg-slate-950 text-white">1x1 (Single)</option>
                  <option value="2x1" className="bg-slate-950 text-white">2x1 Grid</option>
                  <option value="2x2" className="bg-slate-950 text-white">2x2 Grid</option>
                  <option value="2x3" className="bg-slate-950 text-white">2x3 Grid</option>
                </select>
              </div>
            </div>

            {/* Labs media info */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Labs Media ID</span>
              <div className="bg-slate-950 border border-slate-900 rounded-xl p-2.5 font-mono text-[10px] text-slate-400 select-all truncate">
                {item.mediaId ? (
                  <span className="text-emerald-400 font-bold">{item.mediaId}</span>
                ) : (
                  <span className="text-amber-500 font-semibold italic font-sans">Chưa đồng bộ lên Google Labs</span>
                )}
              </div>
            </div>

            {/* Aliases Input (Biệt danh) - moved to left column under reference image */}
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Biệt danh (Aliases - ngăn cách bằng dấu phẩy)</span>
              <input 
                type="text" 
                value={item.aliases || ''}
                placeholder="Ví dụ: Mom, Mẹ, me"
                onChange={(e) => {
                  if (isChar) {
                    const updated = [...canvasCharacters];
                    updated[index] = { ...updated[index], aliases: e.target.value };
                    updateCanvasCharacters(updated);
                  } else if (isLoc) {
                    const updated = [...canvasLocations];
                    updated[index] = { ...updated[index], aliases: e.target.value };
                    updateCanvasLocations(updated);
                  } else if (isProp) {
                    const updated = [...canvasProps];
                    updated[index] = { ...updated[index], aliases: e.target.value };
                    updateCanvasProps(updated);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-slate-700"
              />
            </div>
          </div>

          {/* Right side: Inputs (3/5 cols) */}
          <div className="md:col-span-3 flex flex-col justify-between space-y-4 text-left">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Tên hiển thị</span>
              <input 
                type="text" 
                value={item.name}
                onChange={(e) => {
                  if (isChar) {
                    const updated = [...canvasCharacters];
                    updated[index] = { ...updated[index], name: e.target.value };
                    updateCanvasCharacters(updated);
                  } else if (isLoc) {
                    const updated = [...canvasLocations];
                    updated[index] = { ...updated[index], name: e.target.value };
                    updateCanvasLocations(updated);
                  } else if (isProp) {
                    const updated = [...canvasProps];
                    updated[index] = { ...updated[index], name: e.target.value };
                    updateCanvasProps(updated);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-slate-700"
              />
            </div>

            <div className="space-y-1 flex-1 flex flex-col">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Mô tả DNA / Prompt</span>
              <textarea 
                value={item.description || ''}
                onChange={(e) => {
                  if (isChar) {
                    const updated = [...canvasCharacters];
                    updated[index] = { ...updated[index], description: e.target.value };
                    updateCanvasCharacters(updated);
                  } else if (isLoc) {
                    const updated = [...canvasLocations];
                    updated[index] = { ...updated[index], description: e.target.value };
                    updateCanvasLocations(updated);
                  } else if (isProp) {
                    const updated = [...canvasProps];
                    updated[index] = { ...updated[index], description: e.target.value };
                    updateCanvasProps(updated);
                  }
                }}
                className="w-full flex-1 min-h-[120px] bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-slate-700 font-mono leading-relaxed"
                placeholder={isChar ? "Mô tả ngoại hình, trang phục, giới tính..." : isLoc ? "Mô tả bối cảnh, ánh sáng, góc máy..." : "Mô tả đạo cụ, chất liệu, hình dáng..."}
              />
            </div>

            {isLoc && (
              <div className="space-y-2 border-t border-slate-800/80 pt-2 text-left">
                <span className="text-[10px] text-orange-400 font-bold uppercase tracking-wider block">Thiết lập Không gian liền kề & DNA</span>
                <div className="grid grid-cols-1 gap-2">
                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Connected Locations (Bối cảnh kề cận)</span>
                    <div className="flex flex-wrap gap-1 bg-slate-950 border border-slate-900 rounded-xl p-2 min-h-[40px]">
                      {worldAssetChars
                        .filter((c: any) => c.entityType === 'location' && c.id !== item.worldAssetCharId)
                        .map((otherLoc: any) => {
                          const isLinked = (item.adjacentLocationIds || []).includes(otherLoc.id);
                          return (
                            <button
                              key={otherLoc.id}
                              type="button"
                              onClick={() => {
                                const current = item.adjacentLocationIds || [];
                                const next = isLinked
                                  ? current.filter((id: string) => id !== otherLoc.id)
                                  : [...current, otherLoc.id];
                                
                                const updated = [...canvasLocations];
                                updated[index] = { ...updated[index], adjacentLocationIds: next };
                                updateCanvasLocations(updated);
                              }}
                              className={`px-2 py-0.5 rounded text-[8px] font-black uppercase transition-all ${
                                isLinked
                                  ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                                  : 'bg-slate-900 border border-slate-800 text-slate-500 hover:text-slate-350'
                              }`}
                            >
                              {otherLoc.name}
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[9px] text-slate-500 font-bold uppercase block">Shared DNA (Sàn gỗ, ánh sáng, chất liệu...)</span>
                    <input
                      type="text"
                      value={item.sharedDna || ''}
                      onChange={(e) => {
                        const updated = [...canvasLocations];
                        updated[index] = { ...updated[index], sharedDna: e.target.value };
                        updateCanvasLocations(updated);
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-orange-500/50"
                      placeholder="VD: warm wooden flooring, warm lighting..."
                    />
                  </div>
                </div>
              </div>
            )}

            {isChar && (
              <div className="space-y-2 border-t border-slate-800/80 pt-2 text-left">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Character Relationships (Mối quan hệ nhân vật)</span>
                
                {/* List existing relationships */}
                <div className="space-y-2 max-h-[150px] overflow-y-auto custom-scrollbar">
                  {(item.relationships || []).map((rel: any, rIdx: number) => (
                    <div key={rIdx} className="flex gap-2 items-center bg-slate-950 p-2 rounded-xl border border-slate-800">
                      <span className="text-xs font-bold text-slate-350 flex-1">
                        {rel.targetCharacterName} ({rel.relationType})
                        {rel.description && <span className="block text-[10px] font-normal text-slate-500">{rel.description}</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = (item.relationships || []).filter((_: any, i: number) => i !== rIdx);
                          const updated = [...canvasCharacters];
                          updated[index] = { ...updated[index], relationships: next };
                          updateCanvasCharacters(updated);
                        }}
                        className="text-red-400 hover:text-red-300 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-950/20 border border-red-500/10 active:scale-95 cursor-pointer"
                      >
                        Xóa
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add new relationship */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 items-end bg-slate-900/50 p-2.5 rounded-xl border border-slate-800">
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block">Nhân vật</span>
                    <select
                      id={`rel-target-${index}`}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                      defaultValue=""
                    >
                      <option value="">Chọn...</option>
                      {worldAssetChars
                        .filter((c: any) => (c.entityType === 'character' || !c.entityType) && c.id !== item.worldAssetCharId)
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block">Quan hệ</span>
                    <select
                      id={`rel-type-${index}`}
                      className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-white outline-none cursor-pointer"
                      defaultValue="Bạn bè"
                    >
                      <option value="Bạn bè">Bạn bè</option>
                      <option value="Đối thủ">Đối thủ</option>
                      <option value="Gia đình">Gia đình</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[8px] text-slate-500 font-bold uppercase block">Mô tả chi tiết</span>
                    <div className="flex gap-1.5">
                      <input
                        id={`rel-desc-${index}`}
                        type="text"
                        placeholder="Vd: Đồng đội cũ..."
                        className="flex-1 bg-slate-950 border border-slate-850 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const targetEl = document.getElementById(`rel-target-${index}`) as HTMLSelectElement;
                          const typeEl = document.getElementById(`rel-type-${index}`) as HTMLSelectElement;
                          const descEl = document.getElementById(`rel-desc-${index}`) as HTMLInputElement;

                          if (!targetEl || !targetEl.value) {
                            alert("⚠️ Sếp hãy chọn nhân vật mục tiêu trước!");
                            return;
                          }

                          const targetId = targetEl.value;
                          const matched = worldAssetChars.find((c: any) => c.id === targetId);
                          const relationship = {
                            targetCharacterId: targetId,
                            targetCharacterName: matched?.name || '',
                            relationType: typeEl.value,
                            description: descEl.value
                          };

                          const next = [...(item.relationships || []), relationship];
                          const updated = [...canvasCharacters];
                          updated[index] = { ...updated[index], relationships: next };
                          updateCanvasCharacters(updated);

                          // Reset inputs
                          targetEl.value = "";
                          descEl.value = "";
                        }}
                        className="px-2.5 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/20 transition-all active:scale-95 shrink-0 cursor-pointer"
                      >
                        Thêm
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="bg-[#24242d] p-4 flex items-center justify-between border-t border-slate-800/80">
          <button
            onClick={() => {
              if (isChar) onGeneratePromptChar(index);
              else if (isLoc) onGeneratePromptLoc(index);
              else if (isProp) onGeneratePromptProp(index);
            }}
            disabled={isGenPrompt}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold border border-indigo-500/20 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isGenPrompt ? (
              <><Loader2 size={13} className="animate-spin" /> Soạn thảo...</>
            ) : (
              <><Wand2 size={13} /> AI Prompt</>
            )}
          </button>

          <div className="flex gap-2.5">
            <button
              onClick={() => {
                if (isChar) onAutoGenChar(index);
                else if (isLoc) onAutoGenLoc(index);
                else if (isProp) onAutoGenProp(index);
              }}
              disabled={isGenImg}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-all disabled:opacity-50 cursor-pointer ${
                isChar ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' : 
                isLoc ? 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border-orange-500/20' : 
                'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20'
              }`}
            >
              {isGenImg ? (
                <><Loader2 size={13} className="animate-spin" /> Đang vẽ...</>
              ) : (
                <>
                  <Sparkles size={13} /> 
                  <span className="font-sans">{isChar ? 'Vẽ Portrait' : 'Vẽ Concept'}</span>
                </>
              )}
            </button>

            <button
              onClick={() => onSyncAssetToLibrary(type, index)}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? (
                <><Loader2 size={13} className="animate-spin text-white animate-pulse" /> Đang đồng bộ...</>
              ) : (
                <><Upload size={13} /> Đồng bộ DB</>
              )}
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer font-sans"
            >
              Đóng
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
