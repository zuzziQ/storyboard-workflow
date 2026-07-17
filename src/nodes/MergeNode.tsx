import { Handle, Position } from 'reactflow';
import { Film, Trash2, Settings2, Play, Download } from 'lucide-react';

import { useFlowStore } from '../store/useFlowStore';

export default function MergeNode({ id }: any) {
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return (
    <div className="bg-[#121216] rounded-xl border-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] w-[360px] overflow-hidden transition-all group">
      {/* Handle In */}
      <Handle type="target" position={Position.Left} id="in" className="w-4 h-4 bg-red-500 border-2 border-[#121216]" />
      
      {/* Header */}
      <div className="bg-[#2a2a32] p-3 flex items-center justify-between border-b border-red-500/30 react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <Film size={18} className="text-red-400 group-hover:scale-110 transition-transform" />
          <span className="text-sm font-bold text-white tracking-wide uppercase">Video Composer</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 transition-colors" title="Delete Node">
            <Trash2 size={16} />
          </button>
          <Settings2 size={16} className="text-slate-400 hover:text-white cursor-pointer" />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4 bg-gradient-to-b from-slate-900 to-black relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none"></div>
        
        <div className="w-full aspect-video bg-black rounded-lg border border-slate-800 flex flex-col items-center justify-center mb-4 relative overflow-hidden shadow-inner">
           <Film size={32} className="text-slate-700 mb-2" />
           <span className="text-xs text-slate-500 font-bold tracking-widest uppercase">Awaiting Sequences</span>
        </div>

        <div className="flex gap-2">
            <button className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded flex items-center justify-center gap-2 transition-all shadow-[0_0_10px_rgba(220,38,38,0.5)]">
                <Play size={14} fill="currentColor" /> Merge All
            </button>
            <button className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded flex items-center justify-center transition-all border border-slate-700">
                <Download size={14} />
            </button>
        </div>
      </div>
      
      {/* Handle Out */}
      <Handle type="source" position={Position.Right} id="out" className="w-4 h-4 bg-red-500 border-2 border-[#121216]" />
    </div>
  );
}
