import React from 'react';
import { Clapperboard, Loader2, Play, Trash2, ToggleRight, ToggleLeft } from 'lucide-react';

interface SceneHeaderControlsProps {
  sceneId: string;
  active: boolean;
  setActive: (active: boolean) => void;
  highestRisk: string;
  badgeColor: string;
  isRendering: boolean;
  handleManualGenerate: (e: React.MouseEvent) => void;
  handleDelete: (e: React.MouseEvent) => void;
  sceneShots: any[];
  totalSceneDuration: number;
  getHeaderRiskColor: (risk: string) => string;
}

export default function SceneHeaderControls({
  sceneId,
  active,
  setActive,
  highestRisk,
  badgeColor,
  isRendering,
  handleManualGenerate,
  handleDelete,
  sceneShots,
  totalSceneDuration,
  getHeaderRiskColor,
}: SceneHeaderControlsProps) {
  return (
    <div className="bg-[#2a2a32] p-2 flex items-center justify-between border-b border-slate-700/50 react-flow__node-draghandle cursor-move">
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={13} className={active ? badgeColor : 'text-slate-500'} />
          <span className="text-xs font-black text-white tracking-wide truncate">
            {sceneId ? sceneId.replace('Scene', 'Cảnh ') : 'Cảnh mới'}
          </span>
          {highestRisk !== 'READY' && (
            <span className={`px-1 py-0.2 rounded text-[7.5px] font-black uppercase tracking-wider border ${getHeaderRiskColor(highestRisk)}`}>
              {highestRisk === 'NEED DIRECTOR DECISION' ? 'DIR REQ' : highestRisk}
            </span>
          )}
        </div>
        {sceneShots.length > 0 && (
          <div className="text-[8.5px] text-slate-400 font-bold flex items-center gap-1">
            <span className="text-indigo-400 font-extrabold">🎬 {sceneShots.length} Shots</span>
            <span className="text-slate-600">•</span>
            <span className="text-amber-400 font-extrabold">⏳ {totalSceneDuration}s</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {isRendering ? (
          <Loader2 size={13} className="text-yellow-400 animate-spin" />
        ) : (
          <button 
            onClick={handleManualGenerate} 
            className="text-slate-400 hover:text-green-400 transition-colors" 
            title="Generate Storyboard"
          >
            <Play size={13} />
          </button>
        )}
        <button 
          onClick={handleDelete} 
          className="text-slate-400 hover:text-red-400 transition-colors" 
          title="Delete Node"
        >
          <Trash2 size={13} />
        </button>
        <div onClick={() => setActive(!active)} className="cursor-pointer">
          {active ? <ToggleRight size={17} className="text-blue-400" /> : <ToggleLeft size={17} className="text-slate-500" />}
        </div>
      </div>
    </div>
  );
}
