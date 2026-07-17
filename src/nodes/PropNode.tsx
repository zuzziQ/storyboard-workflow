import { Handle, Position } from 'reactflow';
import { Box, ToggleLeft, ToggleRight, Settings2, Wand2, Loader2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { useFlowStore } from '../store/useFlowStore';

export default function PropNode({ id, data }: any) {
  const [active, setActive] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;
  const setHoveredAssetId = useFlowStore(state => state.setHoveredAssetId);
  const hoveredAssetId = useFlowStore(state => state.hoveredAssetId);

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleAutoGen = () => {
    setIsGenerating(true);
    setTimeout(() => {
      const mockImages = [
        "https://images.unsplash.com/photo-1546868871-7041f2a55e12",
        "https://images.unsplash.com/photo-1512499616215-a7b21cc3ec61",
        "https://images.unsplash.com/photo-1618365908648-e71bd5716cba"
      ];
      const randomImg = mockImages[Math.floor(Math.random() * mockImages.length)] + "?w=200&q=80";
      
      setNodes((nds) => nds.map(n => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, imageUrl: randomImg } };
        }
        return n;
      }));
      setIsGenerating(false);
    }, 1500);
  };

  const isHovered = hoveredAssetId === id;

  return (
    <div 
      className={`bg-[#121216] rounded-xl border-2 ${active ? 'border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]' : 'border-slate-700'} w-[280px] overflow-hidden transition-all group ${isHovered ? 'ring-4 ring-pink-500 shadow-[0_0_30px_rgba(236,72,153,0.6)] scale-[1.02]' : ''}`}
      onMouseEnter={() => setHoveredAssetId(id)}
      onMouseLeave={() => setHoveredAssetId(null)}
    >
      {/* Header */}
      <div className="bg-[#2a2a32] p-2 flex items-center justify-between border-b border-slate-700/50 react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <Box size={14} className={active ? 'text-pink-400' : 'text-slate-500'} />
          <span className="text-xs font-bold text-white tracking-wide">Prop Ref</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleAutoGen} disabled={isGenerating} className="text-slate-400 hover:text-pink-400 transition-colors" title="Auto Gen Image">
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          </button>
          <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 transition-colors" title="Delete Node">
            <Trash2 size={14} />
          </button>
          <Settings2 size={14} className="text-slate-400 hover:text-white cursor-pointer" />
          <div onClick={() => setActive(!active)} className="cursor-pointer">
            {active ? <ToggleRight size={18} className="text-pink-400" /> : <ToggleLeft size={18} className="text-slate-500" />}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className={`p-3 ${active ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
        <div className="flex gap-3 mb-3">
          <div className="w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 relative group/img">
             {data.imageUrl ? (
               <img src={data.imageUrl} className="w-full h-full object-cover" />
             ) : (
               <Box size={24} className="text-slate-600" />
             )}
             <div onClick={handleAutoGen} className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
               <span className="text-[10px] text-white font-bold">GENERATE</span>
             </div>
          </div>
          <div className="flex-1">
             <input type="text" defaultValue={data.name} className="w-full bg-transparent text-sm font-bold text-white mb-1 border-b border-transparent hover:border-slate-600 focus:border-pink-500 outline-none" placeholder="Prop Name" />
             <textarea className="w-full bg-slate-900/50 rounded p-1.5 text-[10px] text-slate-300 resize-none h-10 outline-none border border-slate-700 focus:border-pink-500" defaultValue={data.description} placeholder="Prop details (e.g., Magic sword...)"></textarea>
          </div>
        </div>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="in" className="w-3 h-3 bg-slate-500 border-2 border-[#121216]" />
      <Handle type="source" position={Position.Right} id="out" className="w-3 h-3 bg-pink-500 border-2 border-[#121216]" />
    </div>
  );
}
