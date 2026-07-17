import { Handle, Position } from 'reactflow';
import { Settings, Trash2, SlidersHorizontal, Lock, Unlock, Database, RefreshCw, BarChart2, ShieldAlert } from 'lucide-react';
import { useState, memo } from 'react';
import { useFlowStore } from '../store/useFlowStore';
import { generateExpandedShots } from '../utils/generateExpandedShots';
import { useWorldAssetProject } from './hooks/useWorldAssetProject';

function ConfigNode({ id, data }: any) {
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;
  const projectData = useFlowStore((state) => state.projectData);
  const setProjectData = useFlowStore((state) => state.setProjectData);
  const parsedData = useFlowStore((state) => state.parsedData);
  const pendingShots = useFlowStore((state) => state.pendingShots);
  const setPendingShots = useFlowStore((state) => state.setPendingShots);
  const { syncProjectSettingsToDB } = useWorldAssetProject({ projectData, getNodes: () => [] });

  const [model, setModel] = useState(data.model || 'veo_3_1');
  const [ratio, setRatio] = useState(data.ratio || '16:9');
  const [variants, setVariants] = useState(data.variants || 1);
  const [type, setType] = useState(data.type || 'video');
  const [isSyncing, setIsSyncing] = useState(false);

  // Global Lock states
  const [visualStyleLock, setVisualStyleLock] = useState(true);
  const [audioVoiceLock, setAudioVoiceLock] = useState(false);
  const [safetyLock, setSafetyLock] = useState(true);

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // Rebuild Storyboard Action
  const handleRebuild = () => {
    if (parsedData) {
      const charNames = parsedData.characters ? parsedData.characters.map((c: any) => typeof c === 'string' ? c : c.name) : [];
      const totalDur = projectData?.targetRuntime || 180;
      const avgShotDur = 4;
      const initialShots = generateExpandedShots(
        parsedData.scenes || [],
        charNames,
        totalDur,
        avgShotDur,
        parsedData.scriptText
      );
      setPendingShots(initialShots);
      alert("⚡ Đã dựng lại cấu trúc Storyboard thành công!");
    } else {
      alert("Không có kịch bản đã phân tích. Vui lòng phân tích kịch bản trước.");
    }
  };

  // Sync DB Action
  const handleSyncToDB = async () => {
    const universeId = projectData.selectedProjectId || projectData.selectedUniverseId;
    if (!universeId || universeId === 'new') {
      alert("Sếp vui lòng chọn World Asset Project ở Master Center trước.");
      return;
    }

    setIsSyncing(true);
    try {
      const currentShots = parsedData?.shots || [];
      const scenesPayload = currentShots.map((sh: any, idx: number) => ({
        sceneNumber: idx + 1,
        title: sh.location || sh.bối_cảnh || `Shot ${idx + 1}`,
        description: sh.description || sh.diễn_tả || '',
        prompt: sh.visual || sh.hình_ảnh || sh.storyboardPrompt || '',
        imageUrl: sh.renderUrl || sh.imageUrl || null,
        tags: sh.character_refs || sh.characterIds || []
      }));

      const { syncEpisodeToDB } = await import('../services/api');
      await syncEpisodeToDB({
        universeId,
        title: projectData.name,
        scriptText: parsedData?.scriptText || '',
        scenes: scenesPayload,
        gflowProjectId: projectData.id
      });
      alert("🎉 ĐỒNG BỘ THÀNH CÔNG!\n\nKịch bản đã được đồng bộ vào PostgreSQL DB.");
    } catch (e: any) {
      alert(`⚠️ Đồng bộ thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };


  return (
    <div className="bg-[#121216] rounded-2xl border-2 border-slate-800/80 w-[320px] overflow-hidden transition-all shadow-[0_0_30px_rgba(99,102,241,0.08)] group hover:border-indigo-500/30 nodrag">
      {/* Header */}
      <div className="bg-[#141418] p-3 flex items-center justify-between border-b border-slate-800/60 react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <Settings size={14} className="text-indigo-400 animate-spin-slow" />
          <span className="text-xs font-black text-white tracking-wider uppercase">FLOW CONTROLLER</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDelete} className="text-slate-500 hover:text-red-400 transition-colors" title="Delete Node">
            <Trash2 size={13} />
          </button>
          <SlidersHorizontal size={13} className="text-slate-500" />
        </div>
      </div>
      
      {/* Content */}
      <div className="p-4.5 space-y-4">
        {/* Row 1: AI Settings */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <label className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">Output Type</label>
            <select 
              value={type} 
              onChange={(e) => setType(e.target.value)}
              className="w-full bg-slate-950/80 text-slate-350 text-[10px] p-1.5 rounded-lg border border-slate-850 outline-none focus:border-indigo-500/50 cursor-pointer font-bold"
            >
              <option value="video">Cinematic Video</option>
              <option value="image">Reference Image</option>
              <option value="audio">SFX & Voice</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">AI Model</label>
            <select 
              value={model} 
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-950/80 text-slate-350 text-[10px] p-1.5 rounded-lg border border-slate-850 outline-none focus:border-indigo-500/50 cursor-pointer font-bold"
            >
              <option value="veo_3_1">Google Veo 3.1</option>
              <option value="omni_flash">Omni Flash</option>
              <option value="gflow_narwhal">GFlow Narwhal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">Aspect Ratio</label>
            <select 
              value={ratio} 
              onChange={(e) => setRatio(e.target.value)}
              className="w-full bg-slate-950/80 text-slate-350 text-[10px] p-1.5 rounded-lg border border-slate-850 outline-none focus:border-indigo-500/50 cursor-pointer font-bold"
            >
              <option value="16:9">16:9 (Landscape)</option>
              <option value="9:16">9:16 (Vertical)</option>
              <option value="1:1">1:1 (Square)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 col-span-2">
            <label className="text-[7.5px] text-indigo-400 font-black uppercase tracking-wider flex items-center gap-1">
              <span>Shotlist Profile Preset</span>
            </label>
            <select 
              value={projectData.shotlistPreset || 'universal_cinematic'} 
              onChange={async (e) => {
                const newPreset = e.target.value as any;
                const updatedProj = { ...projectData, shotlistPreset: newPreset };
                setProjectData(updatedProj);
                const activeId = projectData.selectedProjectId || projectData.selectedUniverseId;
                if (activeId && activeId !== 'new') {
                  setTimeout(async () => {
                    await syncProjectSettingsToDB(activeId);
                  }, 100);
                }
              }}
              className="w-full bg-[#161622] text-white text-[10px] p-2 rounded-lg border border-indigo-500/35 outline-none focus:border-indigo-500 cursor-pointer font-extrabold"
            >
              <option value="universal_cinematic">🎬 Universal Cinematic (Standard)</option>
              <option value="paco_production">🐥 Paco Show and Tell (Standard)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[7.5px] text-slate-500 font-black uppercase tracking-wider">Batch Size</label>
            <input 
              type="number" 
              value={variants} 
              onChange={(e) => setVariants(parseInt(e.target.value))}
              min="1" max="4"
              className="w-full bg-slate-950/80 text-slate-300 text-[10px] p-1.5 rounded-lg border border-slate-850 outline-none focus:border-indigo-500/50 text-center font-bold"
            />
          </div>
        </div>


        {/* Row 3: Global Production Locks */}
        <div className="bg-[#0b0b0f] border border-slate-900 rounded-xl p-3 space-y-2">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert size={10} className="text-yellow-500" /> Global Production Locks
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {/* Visual Lock */}
            <button 
              onClick={() => setVisualStyleLock(!visualStyleLock)}
              className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition-all ${
                visualStyleLock 
                  ? 'bg-rose-500/10 border-rose-500/35 text-rose-300' 
                  : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800'
              }`}
            >
              {visualStyleLock ? <Lock size={10} className="mb-1 text-rose-400" /> : <Unlock size={10} className="mb-1" />}
              <span className="text-[7.5px] font-bold tracking-tight">Visual Lock</span>
            </button>

            {/* Audio Lock */}
            <button 
              onClick={() => setAudioVoiceLock(!audioVoiceLock)}
              className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition-all ${
                audioVoiceLock 
                  ? 'bg-rose-500/10 border-rose-500/35 text-rose-300' 
                  : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800'
              }`}
            >
              {audioVoiceLock ? <Lock size={10} className="mb-1 text-rose-400" /> : <Unlock size={10} className="mb-1" />}
              <span className="text-[7.5px] font-bold tracking-tight">Audio Lock</span>
            </button>

            {/* Safety Lock */}
            <button 
              onClick={() => setSafetyLock(!safetyLock)}
              className={`flex flex-col items-center justify-between p-1.5 rounded-lg border text-center transition-all ${
                safetyLock 
                  ? 'bg-rose-500/10 border-rose-500/35 text-rose-300' 
                  : 'bg-slate-950/40 border-slate-900 text-slate-500 hover:border-slate-800'
              }`}
            >
              {safetyLock ? <Lock size={10} className="mb-1 text-rose-400" /> : <Unlock size={10} className="mb-1" />}
              <span className="text-[7.5px] font-bold tracking-tight">Safety Lock</span>
            </button>
          </div>
        </div>

        {/* Row 4: Source of Truth Control Panel */}
        <div className="bg-[#0b0b0f] border border-slate-900 rounded-xl p-3 space-y-2">
          <div className="text-[8px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <BarChart2 size={10} className="text-emerald-400" /> Source of Truth Control
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleSyncToDB}
              disabled={isSyncing}
              className="flex-1 py-1.5 bg-emerald-600/15 hover:bg-emerald-600 border border-emerald-500/20 text-emerald-300 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              {isSyncing ? <RefreshCw size={10} className="animate-spin" /> : <Database size={10} />}
              Sync DB
            </button>

            <button 
              onClick={handleRebuild}
              className="flex-1 py-1.5 bg-indigo-600/15 hover:bg-indigo-600 border border-indigo-500/20 text-indigo-300 hover:text-white rounded-lg text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <RefreshCw size={10} />
              Rebuild
            </button>
          </div>
        </div>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Left} id="in" className="w-3 h-3 bg-indigo-500 border-2 border-[#121216]" />
      <Handle type="source" position={Position.Right} id="out" className="w-3 h-3 bg-indigo-500 border-2 border-[#121216]" />
    </div>
  );
}

export default memo(ConfigNode);
