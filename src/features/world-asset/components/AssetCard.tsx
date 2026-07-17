import React from 'react';
import { User, MapPin, Database, X, Upload, Sparkles, Wand2, Loader2 } from 'lucide-react';
import type { AssetItem, AssetType } from '../types';

interface AssetCardProps {
  type: AssetType;
  item: AssetItem;
  idx: number;
  worldAssetChars: any[];
  charVariants: Record<string, any[]>;
  syncingStates: Record<string, boolean>;
  generatingStates: Record<string, boolean>;
  generatingPrompts: Record<string, boolean>;
  onUpdateAsset: (item: AssetItem) => void;
  onRemove: () => void;
  onOpenSlice: () => void;
  onUploadFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onLink: (val: string) => void;
  onGenPrompt: () => void;
  onGenImg: () => void;
  onSync: () => void;
  onZoom: () => void;
  onViewDetail: () => void;
  onSelectVariant?: (variantUrl: string, variantId: string) => void;
}

export function AssetCard({
  type,
  item,
  idx,
  worldAssetChars,
  charVariants,
  syncingStates,
  generatingStates,
  generatingPrompts,
  onUpdateAsset,
  onRemove,
  onOpenSlice,
  onUploadFile,
  onLink,
  onGenPrompt,
  onGenImg,
  onSync,
  onZoom,
  onViewDetail,
  onSelectVariant
}: AssetCardProps) {
  const isChar = type === 'character';
  const isLoc = type === 'location';
  const isProp = type === 'prop';

  const syncKey = `${type}-sync-${idx}`;
  const isSyncing = syncingStates[syncKey];
  const isGenPrompt = generatingPrompts[`${isChar ? 'char' : isLoc ? 'loc' : 'prop'}-prompt-${idx}`];
  const isGenImg = generatingStates[`${isChar ? 'char' : isLoc ? 'loc' : 'prop'}-gen-${idx}`];

  // Theme styling configurations
  const theme = {
    borderHover: isChar ? 'hover:border-emerald-500/50' : isLoc ? 'hover:border-orange-500/50' : 'hover:border-amber-500/50',
    focusBorder: isChar ? 'focus:border-emerald-500/50' : isLoc ? 'focus:border-orange-500/50' : 'focus:border-amber-500/50',
    inputTextColor: isChar ? 'text-emerald-400' : isLoc ? 'text-orange-400' : 'text-amber-400',
    badgeColor: isChar ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : isLoc ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    btnColor: isChar ? 'bg-emerald-950/40 border-emerald-800/50 hover:bg-emerald-600 hover:text-white hover:border-emerald-500 text-emerald-400' : isLoc ? 'bg-orange-950/40 border-orange-850/50 hover:bg-orange-600 hover:text-white hover:border-orange-500 text-orange-400' : 'bg-amber-950/40 border-amber-850/50 hover:bg-amber-600 hover:text-white hover:border-amber-500 text-amber-400',
    ringColor: isChar ? 'border-emerald-500 ring-emerald-500/30' : isLoc ? 'border-orange-500 ring-orange-500/30' : 'border-amber-500 ring-amber-500/30',
    icon: isChar ? <User size={24} className="text-slate-700 mb-1" /> : isLoc ? <MapPin size={24} className="text-slate-700 mb-1" /> : <Database size={24} className="text-slate-700 mb-1" />,
    placeholderText: isChar ? 'Chưa có ảnh portrait' : isLoc ? 'Chưa có ảnh concept' : 'Chưa có ảnh đạo cụ',
    btnDrawLabel: isChar ? 'Vẽ Portrait' : isLoc ? 'Vẽ Concept' : 'Vẽ Concept'
  };

  // Filter linked assets list
  const filteredDbAssets = worldAssetChars.filter(c => {
    if (isChar) return c.entityType === 'character' || !c.entityType;
    if (isLoc) return c.entityType === 'location';
    return c.entityType === 'prop';
  });

  return (
    <div className={`bg-[#171720] rounded-xl p-3 border border-slate-800 space-y-2.5 w-[240px] shrink-0 ${theme.borderHover} transition-all flex flex-col justify-between`}>
      <div className="space-y-2.5">
        {/* Header: Input name + X delete */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5">
          <input
            type="text"
            value={item.name}
            onChange={(e) => onUpdateAsset({ ...item, name: e.target.value })}
            className={`text-xs font-black text-white bg-transparent outline-none border-b border-transparent ${theme.focusBorder} w-full font-sans`}
          />
          <button
            onClick={onRemove}
            className="p-1 rounded bg-slate-900 hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-all shrink-0"
            title="Xóa tài sản"
          >
            <X size={10} />
          </button>
        </div>

        {/* Thumbnail Image Uploader */}
        <div className="relative w-full h-[120px] rounded-lg bg-slate-900 border border-slate-800 overflow-hidden shrink-0 group/thumb cursor-pointer">
          {item.imageUrl ? (
            <>
              <img
                src={item.imageUrl}
                className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                alt={item.name}
                onClick={onZoom}
              />
              {(item.gridFormat === '2x2' || item.gridFormat === '2x3') && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenSlice();
                  }}
                  className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-slate-950/80 border border-slate-800 hover:border-indigo-500 rounded text-indigo-400 hover:text-white text-[8px] font-black uppercase flex items-center gap-0.5 transition-all z-10"
                  title="Cắt góc Ref từ ảnh Grid"
                >
                  <Sparkles size={8} /> Cắt Ref
                </button>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950/60">
              {theme.icon}
              <span className="text-[8px] text-slate-500 font-bold uppercase">{theme.placeholderText}</span>
            </div>
          )}
          <label className="absolute inset-0 bg-black/65 opacity-0 group-hover/thumb:opacity-100 flex flex-col items-center justify-center text-[8px] font-bold text-white uppercase transition-opacity cursor-pointer">
            <Upload size={12} className="mb-0.5" />
            Tải lên
            <input type="file" accept="image/*" className="hidden" onChange={onUploadFile} />
          </label>
        </div>

        {/* Link DB dropdown */}
        <div className="space-y-1">
          <select
            value={item.worldAssetCharId || ""}
            onChange={(e) => onLink(e.target.value)}
            className={`w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-1 text-[9px] font-medium ${theme.inputTextColor} outline-none ${theme.focusBorder} transition-all cursor-pointer`}
          >
            <option value="" className="text-slate-500 font-bold">🔗 Liên kết World Asset...</option>
            {filteredDbAssets.map((db: any) => (
              <option key={db.id} value={db.id} className="text-slate-300 font-medium">
                {db.name}
              </option>
            ))}
          </select>
        </div>

        {/* Render Mode & Grid Format Selectors */}
        <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1.5 rounded border border-slate-900 text-[8.5px]">
          <div>
            <label className="text-slate-500 font-bold block mb-0.5 uppercase tracking-wide">Render Mode</label>
            <select
              value={item.renderMode || (isProp ? "combined" : isLoc ? "location_only" : "character_only")}
              onChange={(e) => onUpdateAsset({ ...item, renderMode: e.target.value })}
              className={`w-full bg-transparent ${theme.inputTextColor} font-bold outline-none cursor-pointer`}
            >
              <option value="combined" className="bg-slate-950 text-white">Combined</option>
              <option value="character_only" className="bg-slate-950 text-white">Char Only</option>
              <option value="location_only" className="bg-slate-950 text-white">Loc Only</option>
            </select>
          </div>
          <div>
            <label className="text-slate-500 font-bold block mb-0.5 uppercase tracking-wide">Grid Format</label>
            <select
              value={item.gridFormat || (isChar ? "2x2" : "1x1")}
              onChange={(e) => onUpdateAsset({ ...item, gridFormat: e.target.value })}
              className="w-full bg-transparent text-indigo-400 font-bold outline-none cursor-pointer"
            >
              <option value="1x1" className="bg-slate-950 text-white">1x1 (Single)</option>
              <option value="2x1" className="bg-slate-950 text-white">2x1 Grid (Horizontal)</option>
              <option value="2x2" className="bg-slate-950 text-white">2x2 Grid</option>
              <option value="2x3" className="bg-slate-950 text-white">2x3 Grid</option>
            </select>
          </div>
        </div>

        {/* Variant Strip */}
        <div className="h-[46px] flex flex-col justify-center shrink-0">
          {item.worldAssetCharId && charVariants[item.worldAssetCharId] && charVariants[item.worldAssetCharId].length > 0 ? (
            <div className="flex gap-1 overflow-x-auto py-0.5 bg-slate-950/50 p-1 rounded border border-slate-800/80 h-full no-scrollbar scrollbar-thin">
              {charVariants[item.worldAssetCharId].map((v: any) => {
                const isCurrentRef = item.imageUrl === v.driveUrl || item.mediaId === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => {
                      onUpdateAsset({ ...item, imageUrl: v.driveUrl, mediaId: v.id || v.driveUrl });
                      if (onSelectVariant) {
                        onSelectVariant(v.driveUrl, v.id || v.driveUrl);
                      }
                    }}
                    className={`relative w-6 h-6 rounded bg-slate-950 border overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-all ${isCurrentRef ? `${theme.ringColor} border-2` : 'border-slate-850 hover:border-slate-755'}`}
                  >
                    <img src={v.driveUrl} className="w-full h-full object-cover" alt="variant" />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full bg-transparent" />
          )}
        </div>

        {/* Descriptor status & gen prompt */}
        <div className="flex justify-between items-center text-[9px] bg-slate-950 px-2 py-1 rounded border border-slate-900 shrink-0">
          <span className="text-slate-500 font-bold uppercase">Descriptor</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onViewDetail}
              className={`text-[9px] hover:text-white transition-colors font-bold px-1.5 py-0.5 rounded border shrink-0 ${theme.badgeColor}`}
              title="Xem chi tiết & Chỉnh sửa prompt"
            >
              🔍 Xem
            </button>
            {item.mediaId ? (
              <span className={`text-[8px] px-1 py-0.5 rounded font-bold uppercase border truncate max-w-[55px] ${theme.badgeColor}`} title={item.mediaId}>
                Ref ID: {item.mediaId.substring(0, 6)}
              </span>
            ) : (
              <span className="text-[8px] bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded font-bold uppercase border border-amber-500/15 shrink-0">
                Chưa Upload
              </span>
            )}
            <button
              onClick={onGenPrompt}
              disabled={isGenPrompt}
              className="text-[9px] text-indigo-400 hover:text-white transition-colors shrink-0"
            >
              {isGenPrompt ? '...' : '✨ Gen'}
            </button>
          </div>
        </div>

        {/* Description compact text container */}
        <div
          onClick={onViewDetail}
          className="w-full bg-slate-950 rounded p-2 text-[10px] text-slate-400 hover:text-slate-200 transition-colors border border-slate-800 cursor-pointer min-h-[64px] max-h-[64px] overflow-hidden line-clamp-3 select-none leading-relaxed font-sans"
          title="Click để xem & chỉnh sửa prompt chi tiết"
        >
          {item.description || <span className="text-slate-650 italic">Chưa có mô tả. Click để soạn thảo...</span>}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 pt-2 border-t border-slate-800/80 mt-2">
        <button
          onClick={onGenImg}
          disabled={isGenImg}
          className={`flex-1 py-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all ${theme.btnColor}`}
        >
          {isGenImg ? (
            <><Loader2 size={10} className="animate-spin" /> ...</>
          ) : (
            <><Wand2 size={10} /> {theme.btnDrawLabel}</>
          )}
        </button>

        <button
          onClick={onSync}
          disabled={isSyncing}
          className="px-2 py-1 rounded bg-indigo-950/40 border border-indigo-800/50 hover:bg-indigo-650 hover:text-white hover:border-indigo-500 text-[10px] font-bold text-indigo-400 flex items-center justify-center gap-1 transition-all shrink-0"
          title="Đồng bộ thông tin và ảnh Ref hiện tại về thư viện World Asset DB"
        >
          {isSyncing ? (
            <Loader2 size={10} className="animate-spin" />
          ) : (
            <><Sparkles size={10} /> Đồng bộ DB</>
          )}
        </button>
      </div>
    </div>
  );
}
