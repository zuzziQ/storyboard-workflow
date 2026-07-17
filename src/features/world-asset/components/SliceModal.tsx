import { X, Sparkles } from 'lucide-react';
import { createPortal } from 'react-dom';

interface SliceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeAsset: {
    name: string;
    imageUrl: string;
    gridFormat: string;
    [key: string]: any;
  } | null;
  slicingStates: Record<number, string>;
  onSaveSlice: (idx: number, row: number, col: number, totalRows: number, totalCols: number, setAsRoot?: boolean) => Promise<void>;
}

export function SliceModal({
  isOpen,
  onClose,
  activeAsset,
  slicingStates,
  onSaveSlice
}: SliceModalProps) {
  if (!isOpen || !activeAsset) return null;

  const totalSlices = activeAsset.gridFormat === '2x3' ? 6 : activeAsset.gridFormat === '2x1' ? 2 : 4;
  const cols = activeAsset.gridFormat === '2x3' ? 3 : 2;
  const rows = activeAsset.gridFormat === '2x1' ? 1 : 2;

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1a1a20] border border-indigo-500/30 rounded-3xl w-full max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(99,102,241,0.25)] text-white">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#202027]">
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" /> Công Cụ Cắt Panel Góc Máy ({activeAsset.name})
            </h4>
            <p className="text-[10px] text-slate-400 mt-1 font-sans">
              Cắt ảnh Grid {activeAsset.gridFormat} thành các góc máy tham chiếu lưu trực tiếp vào thư viện.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center gap-6 custom-scrollbar bg-[#111115]">
          {/* Preview Image with grid overlay */}
          <div className="relative border border-slate-800 rounded-2xl overflow-hidden max-w-[650px] shadow-2xl">
            <img
              src={activeAsset.imageUrl}
              className="w-full object-contain max-h-[50vh]"
              alt="Grid panel source"
            />
            {/* Grid Lines Overlay */}
            <div className="absolute inset-0 flex flex-col pointer-events-none">
              {/* Rows */}
              {activeAsset.gridFormat !== '2x1' && (
                <div className="border-b-2 border-dashed border-indigo-500/60 w-full absolute top-[50%] left-0" />
              )}
            </div>
            <div className="absolute inset-0 flex pointer-events-none">
              {/* Cols */}
              {activeAsset.gridFormat === '2x3' ? (
                <>
                  <div className="border-r-2 border-dashed border-indigo-500/60 h-full absolute left-[33.33%] top-0" />
                  <div className="border-r-2 border-dashed border-indigo-500/60 h-full absolute left-[66.66%] top-0" />
                </>
              ) : (
                <div className="border-r-2 border-dashed border-indigo-500/60 h-full absolute left-[50%] top-0" />
              )}
            </div>
          </div>

          {/* Slices selector & action items */}
          <div className="w-full space-y-4 text-left">
            <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">
              Danh sách ô cắt ({totalSlices} góc máy)
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from({ length: totalSlices }).map((_, idx) => {
                const row = Math.floor(idx / cols);
                const col = idx % cols;

                const status = slicingStates[idx] || 'Sẵn sàng';
                const isSaving = status === 'Đang cắt...' || status === 'Đang lưu...';
                const isDone = status === 'Đã lưu Ref!' || status === 'Đã lưu & Đặt làm ảnh chính!';

                return (
                  <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden">
                    <div>
                      <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-950/30 border border-indigo-900/30 px-2 py-0.5 rounded">
                        Góc máy {idx + 1} (Hàng {row + 1}, Cột {col + 1})
                      </span>
                      <div className="text-[10px] text-slate-400 mt-2 font-sans">
                        Trạng thái: <span className={`font-bold ${isDone ? 'text-emerald-400' : isSaving ? 'text-amber-400' : 'text-slate-500'}`}>{status}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 w-full">
                      <button
                        type="button"
                        onClick={() => onSaveSlice(idx, row, col, rows, cols, false)}
                        disabled={isSaving || isDone}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer active:scale-95 ${
                          isDone
                            ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40 cursor-default font-extrabold'
                            : isSaving
                            ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-wait'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 hover:text-white font-bold'
                        }`}
                      >
                        {isDone ? 'Đã lưu Ref!' : isSaving ? 'Đang lưu...' : 'Lưu Ref'}
                      </button>

                      {!isDone && (
                        <button
                          type="button"
                          onClick={() => onSaveSlice(idx, row, col, rows, cols, true)}
                          disabled={isSaving}
                          className="flex-1 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition cursor-pointer active:scale-95 bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-500/20 font-black"
                        >
                          {isSaving ? 'Đang lưu...' : 'Lưu & Làm ảnh chính'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 flex justify-end bg-[#1e1e24]">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-slate-855 hover:bg-slate-800 text-xs font-black uppercase text-slate-300 hover:text-white transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
