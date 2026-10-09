import { Database, Box, Clapperboard, Film, Settings, Sparkles, FileText, UploadCloud, Video } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';

export default function Sidebar({ onDragStart }: { onDragStart: (event: React.DragEvent, nodeType: string) => void }) {
  const isDrawerOpen = useFlowStore((state) => state.isDrawerOpen);
  const setIsDrawerOpen = useFlowStore((state) => state.setIsDrawerOpen);
  const setIsSettingOpen = useFlowStore((state) => state.setIsSettingOpen);

  return (
    <div className="absolute left-6 top-1/2 -translate-y-1/2 z-30 bg-[#1c1c20]/80 backdrop-blur-xl border border-white/10 rounded-full py-4 px-2.5 flex flex-col items-center gap-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
        <button 
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${isDrawerOpen ? 'bg-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
            title={isDrawerOpen ? "Đóng Bảng Kịch Bản (Script Drawer)" : "Mở Bảng Kịch Bản & Tài Sản (Script Drawer)"}
        >
            <FileText size={16} />
        </button>
        
        <div className="w-5 h-px bg-white/10 my-1"></div>

        <div onDragStart={(e) => onDragStart(e as any, 'worldAssetNode')} draggable className="w-9 h-9 rounded-full text-slate-400 hover:bg-white/10 hover:text-indigo-400 flex items-center justify-center transition-all cursor-grab" title="Drag World Asset Center">
            <Database size={16} />
        </div>


        <div onDragStart={(e) => onDragStart(e as any, 'propNode')} draggable className="w-9 h-9 rounded-full text-slate-400 hover:bg-white/10 hover:text-pink-400 flex items-center justify-center transition-all cursor-grab" title="Drag Prop Node">
            <Box size={16} />
        </div>
        <div onDragStart={(e) => onDragStart(e as any, 'uploadNode')} draggable className="w-9 h-9 rounded-full text-slate-400 hover:bg-white/10 hover:text-teal-400 flex items-center justify-center transition-all cursor-grab" title="Drag Media Upload Node">
            <UploadCloud size={16} />
        </div>
        <div onDragStart={(e) => onDragStart(e as any, 'sceneNode')} draggable className="w-9 h-9 rounded-full text-slate-400 hover:bg-white/10 hover:text-blue-400 flex items-center justify-center transition-all cursor-grab" title="Drag Scene Storyboard Node">
            <Clapperboard size={16} />
        </div>
        <div onDragStart={(e) => onDragStart(e as any, 'videoNode')} draggable className="w-9 h-9 rounded-full text-slate-400 hover:bg-white/10 hover:text-indigo-400 flex items-center justify-center transition-all cursor-grab" title="Drag Video Shot Node">
            <Video size={16} />
        </div>
        
        <div className="w-5 h-px bg-white/10 my-1"></div>
        
        <div onDragStart={(e) => onDragStart(e as any, 'omniNode')} draggable className="w-9 h-9 rounded-full text-purple-400 hover:bg-purple-500/20 hover:text-purple-300 flex items-center justify-center transition-all cursor-grab shadow-[0_0_10px_rgba(168,85,247,0.2)]" title="Drag Omni Engine">
            <Sparkles size={16} />
        </div>
        
        <div className="w-5 h-px bg-white/10 my-1"></div>
        
        <div onDragStart={(e) => onDragStart(e as any, 'configNode')} draggable className="w-9 h-9 rounded-full text-yellow-500 hover:bg-yellow-500/20 hover:text-yellow-400 flex items-center justify-center transition-all cursor-grab shadow-[0_0_10px_rgba(234,179,8,0.2)]" title="Drag Config Node">
            <Settings size={16} />
        </div>
        
        <div onDragStart={(e) => onDragStart(e as any, 'mergeNode')} draggable className="w-9 h-9 rounded-full text-red-400 hover:bg-red-500/20 hover:text-red-300 flex items-center justify-center transition-all cursor-grab shadow-[0_0_10px_rgba(239,68,68,0.2)]" title="Drag Video Composer Node">
            <Film size={16} />
        </div>

        <div className="w-5 h-px bg-white/10 my-1"></div>
        
        <button 
            onClick={() => setIsSettingOpen(true)}
            className="w-9 h-9 rounded-full text-blue-500 hover:bg-blue-500/20 hover:text-blue-400 flex items-center justify-center transition-all cursor-pointer shadow-[0_0_10px_rgba(59,130,246,0.2)] active:scale-90" title="AI Settings"
        >
            <Settings size={16} />
        </button>
    </div>
  );
}
