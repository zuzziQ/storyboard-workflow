import { Handle, Position } from 'reactflow';
import { Sparkles, ToggleLeft, ToggleRight, Trash2, Settings, Video, Image as ImageIcon } from 'lucide-react';
import { useState, memo } from 'react';

import { useFlowStore } from '../store/useFlowStore';

function OmniNode({ id, data }: any) {
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };
  const [active, setActive] = useState(true);
  const [ratio, setRatio] = useState('16:9');
  const [batch, setBatch] = useState('1x');
  const [duration, setDuration] = useState('10s');
  const [configType, setConfigType] = useState('video');

  return (
    <div className={`bg-gradient-to-br from-[#2a1744] to-[#1a1025] rounded-xl border-2 ${active ? 'border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]' : 'border-slate-700'} w-[380px] overflow-hidden transition-all group`}>
      {/* Handles In */}
      <Handle type="target" position={Position.Left} id="in" className="w-3 h-3 bg-purple-500 border-2 border-[#22123d]" />
      
      {/* Header */}
      <div className="bg-[#2d1b4e]/80 p-2 flex items-center justify-between border-b border-purple-500/30 react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className={active ? 'text-purple-400' : 'text-slate-500'} />
          <span className="text-xs font-bold text-white tracking-wide">Google Omni Flash</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 transition-colors" title="Delete Node">
            <Trash2 size={14} />
          </button>
          <div onClick={() => setActive(!active)} className="cursor-pointer">
            {active ? <ToggleRight size={18} className="text-purple-400" /> : <ToggleLeft size={18} className="text-slate-500" />}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className={`p-4 ${active ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
        
        {/* Output Preview */}
        <div className="aspect-video bg-black/50 rounded-lg border border-purple-500/30 flex flex-col items-center justify-center relative overflow-hidden mb-3 group">
          {data.status === 'success' && data.videoUrl ? (
             data.mediaType === 'image' || data.videoUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) || data.videoUrl.includes('googleusercontent.com') ? (
               <img src={data.videoUrl} className="w-full h-full object-cover" alt="Generated Output" />
             ) : (
               <video src={data.videoUrl} className="w-full h-full object-cover" controls loop />
             )
          ) : data.status === 'generating' ? (
            <div className="flex flex-col items-center text-purple-400">
               <span className="flex h-6 w-6 mb-2 relative">
                 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                 <span className="relative inline-flex rounded-full h-6 w-6 bg-purple-500"></span>
               </span>
               <span className="text-xs font-bold animate-pulse">Processing...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-slate-500">
               <Sparkles size={24} className="mb-2 opacity-50" />
               <span className="text-[10px] uppercase font-bold tracking-wider">Awaiting Input</span>
            </div>
          )}
          
          {/* Progress Bar (if generating) */}
          {data.status === 'generating' && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
              <div className="h-full bg-gradient-to-r from-purple-600 to-fuchsia-500 w-1/2 animate-[pulse_2s_ease-in-out_infinite]" style={{ width: `${data.progress || 50}%` }}></div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded Horizontal Generation Config (Toby Flow Style) */}
      <div className="p-2 bg-[#141418] border-t border-purple-900/50 flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
             <select 
               className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
               value={batch} onChange={e => setBatch(e.target.value)}
             >
                <option>1x</option><option>2x</option><option>3x</option><option>4x</option>
             </select>

             <button 
               onClick={() => setConfigType(configType === 'image' ? 'video' : 'image')} 
               className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors flex items-center gap-1"
             >
                {configType === 'image' ? <><ImageIcon size={12}/> Image</> : <><Video size={12}/> Video</>}
             </button>

             {configType === 'video' && (
               <select 
                 className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
                 value={duration} onChange={e => setDuration(e.target.value)}
               >
                  <option>5s</option><option>10s</option>
               </select>
             )}

             <select 
               className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
               value={ratio} onChange={e => setRatio(e.target.value)}
             >
                <option>16:9</option><option>4:3</option><option>1:1</option><option>3:4</option><option>9:16</option>
             </select>

             <select 
               className="bg-[#2a2a32] text-xs font-bold text-purple-400 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none"
             >
                <option>Omni Flash</option><option>Veo 3.1 Pro</option>
             </select>
          </div>
          
          <button className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition-colors">
            <Settings size={14} />
          </button>
      </div>

      {/* Handles Out */}
      <Handle type="source" position={Position.Right} id="out" className="w-3 h-3 bg-purple-500 border-2 border-[#1a1025]" />
    </div>
  );
}

export default memo(OmniNode);
