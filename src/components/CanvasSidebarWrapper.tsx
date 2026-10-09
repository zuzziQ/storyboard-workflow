import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ErrorBoundary } from './ErrorBoundary';
import { useFlowStore } from '../store/useFlowStore';

interface CanvasSidebarWrapperProps {
  children: React.ReactNode;
}

export default function CanvasSidebarWrapper({ children }: CanvasSidebarWrapperProps) {
  const isRightDrawerCollapsed = useFlowStore((s) => s.isRightDrawerCollapsed);
  const setIsRightDrawerCollapsed = useFlowStore((s) => s.setIsRightDrawerCollapsed);
  const activeSceneId = useFlowStore((s) => s.activeSceneId);
  const setActiveSceneId = useFlowStore((s) => s.setActiveSceneId);

  return (
    <div
      className={`fixed top-16 right-0 bottom-0 z-40 bg-[#0f0f15]/95 shadow-[-10px_0_35px_rgba(0,0,0,0.85)] border-l border-slate-800/80 backdrop-blur-2xl transition-all duration-300 ease-in-out flex flex-col overflow-visible ${
        isRightDrawerCollapsed
          ? 'translate-x-full opacity-100 pointer-events-none w-[55vw] min-w-[650px] max-w-[1050px]'
          : 'translate-x-0 opacity-100 pointer-events-auto w-[55vw] min-w-[650px] max-w-[1050px]'
      }`}
    >
      {/* Collapse/Expand Toggle Tab (Always rendered on left edge of drawer) */}
      <button
        onClick={() => setIsRightDrawerCollapsed(!isRightDrawerCollapsed)}
        className="pointer-events-auto absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 z-50 bg-[#0f0f15]/95 backdrop-blur-md hover:bg-[#181825] text-slate-400 hover:text-white border border-r-0 border-indigo-500/30 rounded-l-2xl px-2 py-6 shadow-[-10px_0_25px_rgba(99,102,241,0.2)] transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group select-none"
        title={isRightDrawerCollapsed ? 'Mở Bảng Shot Plan' : 'Thu gọn Bảng Shot Plan'}
      >
        <div className="absolute inset-y-3 right-0 w-[2px] bg-indigo-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-300" />
        {isRightDrawerCollapsed ? (
          <ChevronLeft size={16} className="text-indigo-400 animate-pulse" />
        ) : (
          <ChevronRight size={16} className="text-slate-400 group-hover:text-slate-200 transition-colors" />
        )}
        <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 group-hover:text-white [writing-mode:vertical-lr] select-none">
          {isRightDrawerCollapsed ? '🎬 SHOT PLAN' : 'THU GỌN'}
        </span>
      </button>

      {/* Drawer Header Close Button */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-slate-800 bg-[#14141c]/90 select-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span className="text-xs font-black text-white uppercase tracking-wider">
            🎬 {activeSceneId === 'all' ? 'Bảng Phân Rã Toàn Bộ Shot (Overview)' : `Chi Tiết Phân Cảnh: ${activeSceneId}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {activeSceneId !== 'all' && (
            <button
              onClick={() => setActiveSceneId('all')}
              className="text-[10px] font-bold text-slate-400 hover:text-indigo-300 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/50 transition-colors cursor-pointer"
            >
              Về Tổng Quan
            </button>
          )}
          <button
            onClick={() => setIsRightDrawerCollapsed(true)}
            className="p-1 px-2 rounded-lg bg-slate-800/80 hover:bg-rose-600/80 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700/50 text-xs font-bold"
            title="Đóng bảng"
          >
            ✕ Đóng
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar flex">
        <ErrorBoundary fallbackTitle="Lỗi Bảng Chi Tiết Phân Cảnh (Shot Plan Panel)">
          {children}
        </ErrorBoundary>
      </div>
    </div>
  );
}
