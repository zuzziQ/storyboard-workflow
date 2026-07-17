import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { useFlowStore } from '../store/useFlowStore';

interface CanvasSidebarWrapperProps {
  children: React.ReactNode;
}

export default function CanvasSidebarWrapper({ children }: CanvasSidebarWrapperProps) {
  const activeSceneId = useFlowStore((s) => s.activeSceneId);
  const isRightDrawerCollapsed = useFlowStore((s) => s.isRightDrawerCollapsed);
  const setIsRightDrawerCollapsed = useFlowStore((s) => s.setIsRightDrawerCollapsed);

  // Sync drawer collapse logic: reset when activeSceneId is 'all'
  useEffect(() => {
    if (activeSceneId === 'all') {
      setIsRightDrawerCollapsed(false);
    }
  }, [activeSceneId, setIsRightDrawerCollapsed]);

  return (
    <div
      className={`fixed top-16 right-0 bottom-0 z-40 bg-[#0f0f15]/95 shadow-[-10px_0_30px_rgba(0,0,0,0.8)] border-l border-slate-800/80 backdrop-blur-xl transition-all duration-300 ease-in-out flex flex-col overflow-visible ${
        activeSceneId !== 'all'
          ? isRightDrawerCollapsed
            ? 'translate-x-full opacity-100 w-[55vw] min-w-[750px] max-w-[1100px]'
            : 'translate-x-0 opacity-100 w-[55vw] min-w-[750px] max-w-[1100px]'
          : 'translate-x-full opacity-0 pointer-events-none w-0'
      }`}
    >
      {/* Collapse/Expand Toggle Button */}
      {activeSceneId !== 'all' && (
        <button
          onClick={() => setIsRightDrawerCollapsed(!isRightDrawerCollapsed)}
          className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-50 bg-[#0f0f15]/95 backdrop-blur-md hover:bg-[#161622] text-slate-400 hover:text-white border border-r-0 border-slate-800/80 rounded-l-2xl px-2 py-8 shadow-[-10px_0_20px_rgba(0,0,0,0.4)] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group select-none"
          title={isRightDrawerCollapsed ? 'Mở rộng bảng' : 'Thu gọn bảng'}
        >
          <div className="absolute inset-y-4 right-0 w-[2px] bg-indigo-500/50 scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-300" />
          {isRightDrawerCollapsed ? (
            <ChevronLeft size={16} className="text-indigo-400 animate-pulse" />
          ) : (
            <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-200 transition-colors" />
          )}
          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 [writing-mode:vertical-lr] select-none">
            {isRightDrawerCollapsed ? 'EXPAND' : 'COLLAPSE'}
          </span>
        </button>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar flex">
        <ErrorBoundary fallbackTitle="Lỗi Bảng Chi Tiết Phân Cảnh (Shot Plan Panel)">
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}
