import { Handle, Position, useReactFlow } from 'reactflow';
import { Video, ToggleLeft, ToggleRight, Trash2, Play, Loader2 } from 'lucide-react';
import { useState, memo } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { generateMediaViaGateway } from '../../utils/mediaGateway';

function safeMatchName(text: string, name: string, aliases?: string | string[]): boolean {
  const cleanText = text.toLowerCase();
  const cleanName = name.toLowerCase().trim();
  if (!cleanName) return false;
  
  const matchSingle = (word: string) => {
     const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
     const letterClass = 'a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ';
     const regex = new RegExp(`(^|[^${letterClass}])${escaped}([^${letterClass}]|$)`, 'i');
     return regex.test(cleanText);
  };

  if (matchSingle(cleanName)) return true;

  if (aliases) {
     const list = typeof aliases === 'string'
        ? aliases.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
        : aliases.map(x => x.trim().toLowerCase()).filter(Boolean);
     for (const item of list) {
        if (matchSingle(item)) return true;
     }
  }
  return false;
}

const getSceneNum = (item: any, fallbackIdx: number) => {
   if (!item) return fallbackIdx + 1;
   const rawId = item.sceneId || item.sc || item.id || '';
   const num = parseInt(String(rawId).replace(/[^0-9]/g, ''), 10);
   return isNaN(num) ? (item.sceneNumber || item.scene_number || (fallbackIdx + 1)) : num;
};

const getShotSceneNum = (sh: any) => {
   if (!sh) return 1;
   const rawId = sh.sceneId || sh.sc || sh.scene_id || '';
   const num = parseInt(String(rawId).replace(/[^0-9]/g, ''), 10);
   return isNaN(num) ? (sh.sceneNumber || sh.scene_number || 1) : num;
};

function MasterVideoNode({ id, data }: { id: string; data: any }) {
  const { getNodes } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const [modelId, setModelId] = useState('veo_3_1_r2v_lite_low_priority');
  const [duration] = useState('8s');
  
  const [localGenerating, setLocalGenerating] = useState<Record<number, boolean>>({});
  const [localRendering, setLocalRendering] = useState<Record<number, boolean>>({});
  const [localStatus, setLocalStatus] = useState<Record<number, string>>({});

  const scenes = data.scenes || [];

  const updateSceneField = (index: number, field: string, value: any) => {
    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        const updatedScenes = [...(n.data.scenes || [])];
        updatedScenes[index] = {
          ...updatedScenes[index],
          [field]: value
        };
        return {
          ...n,
          data: {
            ...n.data,
            scenes: updatedScenes
          }
        };
      }
      return n;
    }));
  };

  const handleGeneratePrompt = async (index: number) => {
    try {
      setLocalGenerating(prev => ({ ...prev, [index]: true }));
      const allNodes = getNodes();
      
      // Get the corresponding storyboard scene from Master Storyboard Node
      const masterSceneNode = allNodes.find(n => n.id === 'scene-master' && n.type === 'sceneNode');
      const storyboardScene = masterSceneNode?.data?.scenes?.[index];

      if (!storyboardScene || !storyboardScene.storyboardPrompt) {
          alert(`Vui lòng đảm bảo Cảnh ${index + 1} của Master Storyboard đã có Storyboard Prompt.`);
          return;
      }

      const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
      const durationVal = duration ? parseInt(duration.replace('s', '')) : 8;
      const result = await generateVideoScriptPrompt(storyboardScene.storyboardPrompt, durationVal);
      
      updateSceneField(index, 'videoPrompt', result.videoPrompt);
    } catch (err: any) {
      alert("Lỗi khi sinh Prompt: " + err.message);
    } finally {
      setLocalGenerating(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleManualGenerate = async (index: number) => {
    const s = scenes[index];
    if (!s.videoPrompt) {
      alert("⚠️ Node này chưa có Video Prompt. Vui lòng bấm Auto Refine trước.");
      return;
    }

    try {
      setLocalRendering(prev => ({ ...prev, [index]: true }));
      setLocalStatus(prev => ({ ...prev, [index]: "Đang gửi..." }));

      const allNodes = getNodes();
      const masterSceneNode = allNodes.find(n => n.id === 'scene-master' && n.type === 'sceneNode');
      const storyboardScene = masterSceneNode?.data?.scenes?.[index];

      let mediaIds: string[] = [];
      if (storyboardScene) {
         if (storyboardScene.generatedMediaId) {
            mediaIds.push(storyboardScene.generatedMediaId);
         }
         
         const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
         const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
         const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
         const allProps = worldAssetNode ? (worldAssetNode.data.props || []) : [];
         
         const promptText = (storyboardScene.storyboardPrompt || storyboardScene.physicalCharacteristics || "").toLowerCase();
         const charactersInScene: string[] = storyboardScene.charactersInScene || [];
         const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';

         allCharacters.forEach((char: any) => {
            const name = char.name || "";
            const isMatchedChar = charactersInScene.some(cName => {
               return safeMatchName(cName, name, char.aliases) || safeMatchName(name, cName, char.aliases);
            });
            if (isMatchedChar || safeMatchName(promptText, name, char.aliases)) {
                const resolvedMedia = char.mediaId || (useRemote ? (char.imageUrl || char.rootImageUrl) : null);
                if (resolvedMedia) mediaIds.push(resolvedMedia);
                const rawUrl = char.imageUrl || char.rootImageUrl;
                if (rawUrl) mediaIds.push(rawUrl);
            }
         });
         
         const sceneLocName = (storyboardScene.location || "").toLowerCase().trim();
         const matchedLoc = allLocations.find((loc: any) => {
            const name = (loc.name || "").toLowerCase().trim();
            if (!name) return false;
            return name === sceneLocName || 
                   safeMatchName(sceneLocName, name, loc.aliases) || 
                   safeMatchName(name, sceneLocName, loc.aliases) || 
                   safeMatchName(promptText, name, loc.aliases);
         });
         if (matchedLoc) {
             const resolvedMedia = matchedLoc.mediaId || (useRemote ? (matchedLoc.imageUrl || matchedLoc.rootImageUrl) : null);
             if (resolvedMedia) mediaIds.push(resolvedMedia);
             const rawUrl = matchedLoc.imageUrl || matchedLoc.rootImageUrl;
             if (rawUrl) mediaIds.push(rawUrl);
         }

         const propsInScene = storyboardScene.props || [];
         allProps.forEach((prop: any) => {
            const name = prop.name || "";
            const isMatchedProp = propsInScene.some((pName: string) => {
               return safeMatchName(pName, name, prop.aliases) || safeMatchName(name, pName, prop.aliases);
            });
            if (isMatchedProp || safeMatchName(promptText, name, prop.aliases)) {
                const resolvedMedia = prop.mediaId || (useRemote ? (prop.imageUrl || prop.rootImageUrl) : null);
                if (resolvedMedia) mediaIds.push(resolvedMedia);
                const rawUrl = prop.imageUrl || prop.rootImageUrl;
                if (rawUrl) mediaIds.push(rawUrl);
            }
         });
      }

      mediaIds = Array.from(new Set(mediaIds));

      let finalPrompt = s.videoPrompt || "";
      const projectData = useFlowStore.getState().projectData;
      
      const storyboardUrl = storyboardScene?.renderUrl || storyboardScene?.imageUrl;

      setLocalStatus(prev => ({ ...prev, [index]: "Đang tạo..." }));
      const response = await generateMediaViaGateway({
        prompt: finalPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: mediaIds,
        videoModelKey: modelId,
        ratio: '16:9',
        duration: duration,
        mediaType: 'video',
        storyboardFrameUrl: storyboardUrl
      }, (status) => setLocalStatus(prev => ({ ...prev, [index]: status })));

      setLocalRendering(prev => ({ ...prev, [index]: false }));
      if (!response.success) {
         alert("Lỗi tạo video: " + (response.error || "Unknown"));
         setLocalStatus(prev => ({ ...prev, [index]: "Lỗi" }));
         return;
      }

      setLocalStatus(prev => ({ ...prev, [index]: "Xong!" }));
      const vUrl = response.url || (response.images && response.images[0]?.url) || 'https://via.placeholder.com/400x225?text=Video+Rendered';
      
      // Sync videoUrl into Zustand Store pendingShots so Review Board and sync API can capture it
      const targetSceneNum = getSceneNum(s, index);
      const currentPendingShots = useFlowStore.getState().pendingShots || [];
      let foundFirst = false;
      const updatedPending = currentPendingShots.map((sh: any) => {
         const shSceneNum = getShotSceneNum(sh);
         if (targetSceneNum === shSceneNum) {
            if (!foundFirst) {
               foundFirst = true;
               return { ...sh, videoUrl: vUrl };
            }
         }
         return sh;
      });
      useFlowStore.getState().setPendingShots(updatedPending);

      setNodes((nds) => nds.map(n => {
         if (n.id === id) {
            const updatedScenes = [...(n.data.scenes || [])];
            updatedScenes[index] = {
               ...updatedScenes[index],
               videoUrl: vUrl,
               renderUrl: vUrl,
               status: 'success'
            };
            return { 
               ...n, 
               data: { 
                  ...n.data, 
                  scenes: updatedScenes
               } 
            };
         }
         return n;
      }));

    } catch (err: any) {
      alert("❌ Lỗi khi Render Video: " + err.message);
      setLocalRendering(prev => ({ ...prev, [index]: false }));
      setLocalStatus(prev => ({ ...prev, [index]: "Lỗi" }));
    }
  };

  const handleAutoPromptAll = async () => {
     for (let i = 0; i < scenes.length; i++) {
        await handleGeneratePrompt(i);
     }
  };

  const handleRenderAll = async () => {
    for (let i = 0; i < scenes.length; i++) {
       setLocalStatus(prev => ({ ...prev, [i]: "Đang chờ..." }));
    }
    for (let i = 0; i < scenes.length; i++) {
       if (i > 0) {
          const delay = 1500 + Math.random() * 2000;
          await new Promise(resolve => setTimeout(resolve, delay));
       }
       await handleManualGenerate(i);
    }
  };

  return (
     <div className="bg-[#121216] rounded-xl border-2 border-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.25)] group relative text-slate-100 pb-4 w-auto" style={{ minWidth: '700px' }}>
       <Handle type="target" position={Position.Top} id="in" className="w-3 h-3 bg-fuchsia-500 border-2 border-[#121216]" />
       <Handle type="source" position={Position.Bottom} id="out" className="w-3 h-3 bg-red-500 border-2 border-[#121216]" />

       {/* Top Header */}
       <div className="bg-[#2a2a32] p-3 flex items-center justify-between border-b border-slate-700/50 rounded-t-xl node-drag-handle cursor-move">
         <div className="flex items-center gap-2">
           <Video size={16} className="text-indigo-400" />
           <span className="text-sm font-black text-white tracking-wide">MASTER VIDEO BOARD</span>
           <span className="text-xs bg-indigo-600/30 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-full font-black">{scenes.length} Videos</span>
         </div>
         <div className="flex items-center gap-2">
           <button 
             onClick={handleAutoPromptAll}
             className="flex items-center gap-1 text-[10px] bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/20 px-2 py-1 rounded transition-all font-black"
             title="Auto Refine for all video slots sequentially"
           >
             ✨ Refine All
           </button>
           <button 
             onClick={handleRenderAll}
             className="flex items-center gap-1 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded transition-all font-black"
             title="Render all video slots sequentially"
           >
             🎬 Render All
           </button>
         </div>
       </div>

       {/* Scenes vertical stack */}
       <div className="p-4 flex flex-row gap-4 items-start overflow-visible nodrag">
          {scenes.map((s: any, idx: number) => {
             const isGen = localGenerating[idx];
             const isRen = localRendering[idx];
             const status = localStatus[idx];

             return (
                <div key={idx} className="bg-[#17171d] rounded-lg border border-slate-700/50 p-3 space-y-3 relative hover:border-indigo-500/30 transition-all duration-200 w-[280px] shrink-0 flex flex-col">
                   {/* Title bar */}
                   <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-xs font-black text-indigo-400 tracking-wider">🎥 Video Slot {idx + 1}</span>
                      <div className="flex items-center gap-2">
                         {isRen ? (
                            <Loader2 size={13} className="text-yellow-400 animate-spin" />
                         ) : (
                            <button onClick={() => handleManualGenerate(idx)} className="text-slate-400 hover:text-green-400 transition-colors" title="Render Video for this Scene">
                               <Play size={13} />
                            </button>
                         )}
                         <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{status || s.status || 'idle'}</span>
                      </div>
                   </div>

                   {/* Video Player - RIGHT AT THE TOP */}
                    <div className="w-full aspect-video rounded overflow-hidden border border-slate-800 relative bg-slate-900/50 shrink-0 group flex items-center justify-center">
                       {(s.videoUrl || s.renderUrl) ? (
                          <video 
                             src={s.videoUrl || s.renderUrl} 
                             controls 
                             className="w-full h-full object-contain" 
                          />
                       ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-650 text-[10px] uppercase font-black font-mono">
                             Chưa dựng video
                          </div>
                       )}
                    </div>

                   {/* Video Prompt */}
                   <div className="bg-[#0f0f14] p-2 rounded border border-slate-800/80">
                      <div className="flex items-center justify-between mb-1">
                         <span className="text-[8px] text-indigo-300 font-black uppercase">🎬 Video Prompt</span>
                         <button 
                           onClick={() => handleGeneratePrompt(idx)}
                           disabled={isGen}
                           className="text-[8px] bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2 py-0.5 rounded transition-all font-black border border-indigo-500/30"
                         >
                            {isGen ? 'Refining...' : '✨ Auto Refine'}
                         </button>
                      </div>
                      <textarea
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-300 focus:border-indigo-500 outline-none leading-relaxed"
                        rows={Math.max(3, Math.ceil((s.videoPrompt || '').length / 28))}
                        style={{ height: 'auto', overflowY: 'hidden', resize: 'none' }}
                        value={s.videoPrompt || ''}
                        onChange={(e) => updateSceneField(idx, 'videoPrompt', e.target.value)}
                        placeholder="Click ✨ Auto Refine to convert Storyboard to Video Prompt..."
                      />
                   </div>

                   {/* REFINEMENT FEEDBACK Section */}
                    <div className="bg-[#0f0f14] p-2 rounded border border-slate-800/80 space-y-1.5 mt-2">
                       <div className="flex items-center justify-between mb-1">
                          <span className="text-[8px] text-indigo-300 font-black uppercase">💡 Tinh Chỉnh Prompt Video</span>
                          <button
                            onClick={async () => {
                              if (!s.feedback || !s.feedback.trim()) {
                                alert("Vui lòng nhập nhận xét tinh chỉnh!");
                                return;
                              }
                              try {
                                updateSceneField(idx, 'status', 'Refining...');
                                const { refinePromptWithAI } = await import('../../services/api');
                                const projectData = useFlowStore.getState().projectData;
                                const activeProjId = projectData?.id || '';
                                const refined = await refinePromptWithAI(
                                  activeProjId,
                                  s.videoPrompt || '',
                                  s.feedback,
                                  'video'
                                );
                                updateSceneField(idx, 'videoPrompt', refined);
                                updateSceneField(idx, 'feedback', ''); // Clear feedback
                                updateSceneField(idx, 'status', 'Ready');
                                
                                // Trigger re-render video
                                setTimeout(() => {
                                  handleManualGenerate(idx);
                                }, 100);
                              } catch (err: any) {
                                alert("Lỗi tinh chỉnh prompt: " + err.message);
                                updateSceneField(idx, 'status', 'Error');
                              }
                            }}
                            className="text-[8px] bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2 py-0.5 rounded transition-all font-black border border-indigo-500/30 cursor-pointer"
                          >
                            ✨ Refine & Render
                          </button>
                       </div>
                       <textarea
                         className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-300 focus:border-indigo-500 outline-none leading-relaxed resize-none h-[44px]"
                         value={s.feedback || ''}
                         onChange={(e) => updateSceneField(idx, 'feedback', e.target.value)}
                         placeholder="Ví dụ: camera panning nhanh hơn, nhân vật mỉm cười..."
                       />
                    </div>
                </div>
             );
          })}
       </div>

       {/* Generation Config Bar in Master Node */}
       <div className="p-3 bg-[#141418] border-t border-slate-800 rounded-b-xl flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
             <button className="bg-[#2a2a32] text-xs font-black text-slate-300 py-1 px-2 rounded border border-transparent flex items-center gap-1 cursor-default">
                Duration: {duration}
             </button>
             <select 
               value={modelId}
               onChange={(e) => setModelId(e.target.value)}
               className="bg-[#2a2a32] text-xs font-black text-indigo-400 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors"
             >
                <option value="veo_3_1_r2v_lite_low_priority">Veo 3.1 (Low Pri)</option>
                <option value="veo_3_1_r2v_lite">Veo 3.1 (Standard)</option>
                <option value="dreamina">Dreamina</option>
             </select>
          </div>
       </div>
     </div>
  );
}

function VideoNode({ id, data }: any) {
  if (data.scenes && Array.isArray(data.scenes)) {
     return <MasterVideoNode id={id} data={data} />;
  }
  const [active, setActive] = useState(true);
  const [ratio, setRatio] = useState('16:9');
  const [batch, setBatch] = useState('1x');
  const [duration, setDuration] = useState('8s');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  const [useSketchRef, setUseSketchRef] = useState(false);
  
  const [modelId, setModelId] = useState('veo_3_1_r2v_lite_low_priority');
  const [engine, setEngine] = useState('google_flow');
  
  const { getNodes, getEdges } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;
  const hoveredAssetId = useFlowStore(state => state.hoveredAssetId);

  const edges = getEdges();
  const isHoveredLinked = hoveredAssetId && edges.some(e => e.source === hoveredAssetId && e.target === id);

  // Helper: update a data field
  const updateData = (field: string, value: any) =>
    setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  const handleManualGenerate = async () => {
    if (!data.videoPrompt) {
      alert("⚠️ Node này chưa có Video Prompt. Vui lòng bấm Auto Refine trước.");
      return;
    }

    try {
      setIsRendering(true);
      setRenderStatus("Đang gửi lệnh...");

      // Cố gắng lấy ảnh Storyboard từ Node kết nối phía trước để làm Reference ID
      const connectedEdges = getEdges().filter(e => e.target === id);
      const connectedNodes = getNodes().filter(n => connectedEdges.some(e => e.source === n.id));
      const sceneNode = connectedNodes.find(n => n.type === 'sceneNode');
      
      let mediaIds: string[] = [];
      if (sceneNode) {
         if (useSketchRef && sceneNode.data.sketchMediaId) {
            mediaIds.push(sceneNode.data.sketchMediaId);
         } else if (!useSketchRef && sceneNode.data.generatedMediaId) {
            mediaIds.push(sceneNode.data.generatedMediaId);
         }

         // Nạp thêm character & location liên kết để đảm bảo tính nhất quán (Consistency) tối đa
         const allNodes = getNodes();
         const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
         
         const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
         const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
         
         const promptText = (sceneNode.data.storyboardPrompt || sceneNode.data.physicalCharacteristics || "").toLowerCase();
         const charactersInScene: string[] = sceneNode.data.charactersInScene || [];

         allCharacters.forEach((char: any) => {
            const name = char.name || "";
            const isMatchedChar = charactersInScene.some((cName: string) => {
               return safeMatchName(cName, name, char.aliases) || safeMatchName(name, cName, char.aliases);
            });
            if (isMatchedChar || safeMatchName(promptText, name, char.aliases)) {
                const resolvedMedia = char.mediaId || (useRemote ? (char.imageUrl || char.rootImageUrl) : null);
                if (resolvedMedia) {
                   mediaIds.push(resolvedMedia);
                }
            }
         });
         
         const sceneLocName = (sceneNode.data.location || "").toLowerCase().trim();
         const matchedLoc = allLocations.find((loc: any) => {
            const name = (loc.name || "").toLowerCase().trim();
            if (!name) return false;
            return name === sceneLocName || 
                   safeMatchName(sceneLocName, name, loc.aliases) || 
                   safeMatchName(name, sceneLocName, loc.aliases) || 
                   safeMatchName(promptText, name, loc.aliases);
         });
         
         if (matchedLoc) {
             const resolvedMedia = matchedLoc.mediaId || (useRemote ? (matchedLoc.imageUrl || matchedLoc.rootImageUrl) : null);
             if (resolvedMedia) {
                mediaIds.push(resolvedMedia);
             }
         }

         const propsInScene = sceneNode.data.props || [];
         const allProps = worldAssetNode ? (worldAssetNode.data.props || []) : [];
         allProps.forEach((prop: any) => {
            const name = prop.name || "";
             const isMatchedProp = propsInScene.some((pName: string) => {
                return safeMatchName(pName, name, prop.aliases) || safeMatchName(name, pName, prop.aliases);
             });
             if (isMatchedProp || safeMatchName(promptText, name, prop.aliases)) {
                const resolvedMedia = prop.mediaId || (useRemote ? (prop.imageUrl || prop.rootImageUrl) : null);
                if (resolvedMedia) {
                   mediaIds.push(resolvedMedia);
                }
            }
         });
      }

      mediaIds = Array.from(new Set(mediaIds));

      let finalPrompt = data.videoPrompt || "";
      if (sceneNode) {
         const allNodes = getNodes();
         const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
         const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
         const charactersInScene: string[] = sceneNode.data.charactersInScene || [];
         const promptText = (sceneNode.data.storyboardPrompt || sceneNode.data.physicalCharacteristics || "").toLowerCase();

         const missingNames: string[] = [];
         allCharacters.forEach((char: any) => {
            const name = char.name || "";
            
             const isMatchedChar = charactersInScene.some((cName: string) => {
                return safeMatchName(cName, name, char.aliases) || safeMatchName(name, cName, char.aliases);
             });
             
              if (isMatchedChar || safeMatchName(promptText, name, char.aliases)) {
                 const resolvedMedia = char.mediaId || (useRemote ? (char.imageUrl || char.rootImageUrl) : null);
                 if (resolvedMedia && !finalPrompt.toLowerCase().includes(name.toLowerCase())) {
                    missingNames.push(char.name);
                 }
             }
         });

         if (missingNames.length > 0) {
            finalPrompt += `\n**CHARACTER REFERENCES:** Ensure consistent appearance for: ${missingNames.join(', ')}.`;
         }
      }

      const payload = {
        prompt: finalPrompt,
        config: {
          engine: engine,
          model_id: modelId,
          xray: false,
          aspect_ratio: ratio === 'Auto' ? '16:9' : ratio,
          num_outputs: parseInt(batch.replace('x', '')),
          media_ids: mediaIds,
          duration: duration.replace('s', '')
        }
      };

      console.log(`[VideoNode] Sending Job to Extension:`, payload);

      const projectData = useFlowStore.getState().projectData;
      setRenderStatus("Đang khởi tạo...");
      
      const storyboardUrl = sceneNode ? (sceneNode.data.renderUrl || sceneNode.data.imageUrl) : undefined;

      const response = await generateMediaViaGateway({
        prompt: finalPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: payload.config.num_outputs,
        mediaIds: mediaIds,
        videoModelKey: payload.config.model_id,
        ratio: payload.config.aspect_ratio,
        duration: duration,
        mediaType: 'video',
        storyboardFrameUrl: storyboardUrl
      }, (status) => setRenderStatus(status));

      setIsRendering(false);
      
      if (!response.success) {
         console.error("Lỗi gen video:", response.error);
         alert("Lỗi tạo video: " + (response.error || "Unknown"));
         setRenderStatus("Lỗi");
         return;
      }

      setRenderStatus('Hoàn thành!');
      const vUrl = response.url || (response.images && response.images[0]?.url) || 'https://via.placeholder.com/400x225?text=Video+Rendered';
      
      // Sync videoUrl into Zustand Store pendingShots so Review Board and sync API can capture it
      const targetSceneId = data.sceneId || (sceneNode && (sceneNode.data.sceneId || sceneNode.data.sc));
      if (targetSceneId) {
         let targetSceneNum = parseInt(String(targetSceneId).replace(/[^0-9]/g, ''), 10);
         if (isNaN(targetSceneNum)) {
            targetSceneNum = data.sceneNumber || data.scene_number || (sceneNode && (sceneNode.data.sceneNumber || sceneNode.data.scene_number)) || 1;
         }
         const currentPendingShots = useFlowStore.getState().pendingShots || [];
         let foundFirst = false;
         const updatedPending = currentPendingShots.map((sh: any) => {
            const shSceneNum = getShotSceneNum(sh);
            if (targetSceneNum === shSceneNum) {
               if (!foundFirst) {
                  foundFirst = true;
                  return { ...sh, videoUrl: vUrl };
               }
            }
            return sh;
         });
         useFlowStore.getState().setPendingShots(updatedPending);
      }

      setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, renderUrl: vUrl } } : n));

    } catch (err: any) {
      alert("❌ Lỗi khi Render Video: " + err.message);
      setIsRendering(false);
      setRenderStatus("Lỗi kết nối");
    }
  };

  const handleGeneratePrompt = async () => {
    try {
      setIsGenerating(true);
      const edges = getEdges();
      const nodes = getNodes();
      
      const connectedEdges = edges.filter(e => e.target === id);
      const connectedNodeIds = connectedEdges.map(e => e.source);
      const connectedNodes = nodes.filter(n => connectedNodeIds.includes(n.id));
      
      const sceneNode = connectedNodes.find(n => n.type === 'sceneNode');
      
      if (!sceneNode || !sceneNode.data.storyboardPrompt) {
          alert("Vui lòng kết nối với Scene Node đã có Storyboard Prompt để gen Video Script.");
          setIsGenerating(false);
          return;
      }

      const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
      const durationVal = duration ? parseInt(duration.replace('s', '')) : 8;
      const result = await generateVideoScriptPrompt(sceneNode.data.storyboardPrompt, durationVal);
      
      setNodes((nds) => nds.map(n => {
         if (n.id === id) {
            return {
               ...n,
               data: {
                  ...n.data,
                  videoPrompt: result.videoPrompt
               }
            };
         }
         return n;
      }));
    } catch (err: any) {
      alert("Lỗi khi sinh Prompt: " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Compute recognized characters, locations, and storyboard panel for dynamic visual preview
  const allNodes = getNodes();
  const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
  
  const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
  const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
  const allProps = worldAssetNode ? (worldAssetNode.data.props || []) : [];
  
  const connectedEdges = edges.filter(e => e.target === id);
  const connectedNodes = getNodes().filter(n => connectedEdges.some(e => e.source === n.id));
  const sceneNode = connectedNodes.find(n => n.type === 'sceneNode');
  
  const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
  const recognizedRefs: { type: string; name: string; hasMedia: boolean; url?: string }[] = [];
  
  if (sceneNode) {
     // 1. Add Storyboard panel
     const hasPanel = useSketchRef ? !!sceneNode.data.sketchMediaId : !!sceneNode.data.generatedMediaId;
     const panelUrl = useSketchRef ? sceneNode.data.sketchRenderUrl : sceneNode.data.renderUrl;
     recognizedRefs.push({
        type: 'panel',
        name: useSketchRef ? 'Panel (Sketch)' : 'Panel (Color)',
        hasMedia: hasPanel,
        url: panelUrl
     });
     
     // 2. Add matched characters
     const promptText = (sceneNode.data.storyboardPrompt || sceneNode.data.physicalCharacteristics || "").toLowerCase();
     const charactersInScene: string[] = sceneNode.data.charactersInScene || [];
     
     allCharacters.forEach((char: any) => {
        const name = char.name || "";
        const isMatchedChar = charactersInScene.some(cName => {
           return safeMatchName(cName, name, char.aliases) || safeMatchName(name, cName, char.aliases);
        });
        
        if (isMatchedChar || safeMatchName(promptText, name, char.aliases)) {
           recognizedRefs.push({
              type: 'character',
              name: char.name || 'Char',
              hasMedia: !!(char.mediaId || (useRemote && char.imageUrl)),
              url: char.imageUrl
           });
        }
     });
     
     // 3. Add matched location
     const sceneLocName = (sceneNode.data.location || "").toLowerCase().trim();
     allLocations.forEach((loc: any) => {
        const name = (loc.name || "").toLowerCase().trim();
        if (!name) return;
        
        if (name === sceneLocName || 
            safeMatchName(sceneLocName, name, loc.aliases) || 
            safeMatchName(name, sceneLocName, loc.aliases) || 
            safeMatchName(promptText, name, loc.aliases)) {
           recognizedRefs.push({
              type: 'location',
              name: loc.name || 'Location',
              hasMedia: !!(loc.mediaId || (useRemote && loc.imageUrl)),
              url: loc.imageUrl
           });
        }
     });

     // 4. Add matched props
     const propsInScene: string[] = sceneNode.data.props || [];
     allProps.forEach((prop: any) => {
        const name = prop.name || "";
        const isMatchedProp = propsInScene.some(pName => {
           return safeMatchName(pName, name, prop.aliases) || safeMatchName(name, pName, prop.aliases);
        });
        
        if (isMatchedProp || safeMatchName(promptText, name, prop.aliases)) {
           recognizedRefs.push({
              type: 'prop',
              name: prop.name || 'Prop',
              hasMedia: !!(prop.mediaId || (useRemote && prop.imageUrl)),
              url: prop.imageUrl
           });
        }
     });
  }

  let borderClass = 'border-slate-700';
  let badgeColor = 'text-indigo-400';
  
  if (active) {
    if (modelId === 'veo_3_1') {
      borderClass = 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]';
      badgeColor = 'text-indigo-400';
    } else {
      borderClass = 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
    }
  }

  if (isHoveredLinked) {
    borderClass = 'border-indigo-400 ring-4 ring-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.8)] scale-[1.03] z-50 transition-all duration-300';
  }

  return (
    <div className={`bg-[#121216] rounded-xl border-2 ${borderClass} w-[340px] transition-all group relative`}>
      <Handle type="target" position={Position.Top} id="in" className={`w-3 h-3 ${isHoveredLinked ? 'bg-indigo-400' : 'bg-blue-500'} border-2 border-[#121216]`} />
      
      <div className="bg-[#2a2a32] p-2 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex items-center gap-2">
          <Video size={14} className={active ? badgeColor : 'text-slate-500'} />
          <span className="text-xs font-bold text-white tracking-wide">{data.sceneId || 'Video Shot'}</span>
        </div>
        <div className="flex items-center gap-2">
          {isRendering ? (
            <Loader2 size={14} className="text-yellow-400 animate-spin" />
          ) : (
            <button onClick={handleManualGenerate} className="text-slate-400 hover:text-green-400 transition-colors" title="Generate Video">
              <Play size={14} />
            </button>
          )}
          <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">{renderStatus ? renderStatus : 'Ready'}</span>
          <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 transition-colors" title="Delete Node">
            <Trash2 size={14} />
          </button>
          <div onClick={() => setActive(!active)} className="cursor-pointer">
            {active ? <ToggleRight size={18} className="text-indigo-400" /> : <ToggleLeft size={18} className="text-slate-500" />}
          </div>
        </div>
      </div>
      
      <div className={`p-4 space-y-3 ${active ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>

        {/* FROM SCENE: Read-only Action + Dialog Mirror */}
        {(data.action || data.dialogText || (data.dialogs && data.dialogs.length > 0)) && (
          <div className="bg-[#0d0d14] border border-slate-700/30 rounded-lg p-2 space-y-2">
            <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">FROM SCENE — read-only</div>

            {/* Primary chars warning */}
            {data.primaryCharacters && data.primaryCharacters.length > 2 && (
              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded px-2 py-1">
                <span className="text-[9px] text-rose-400 font-bold">⚠️ {data.primaryCharacters.length} nhân vật chính → dialog có thể lẫn lộn</span>
              </div>
            )}

            {data.action && (
              <div>
                <div className="text-[8px] text-amber-400 font-bold mb-0.5 flex items-center gap-1">⚡ Action</div>
                <p className="text-[10px] text-slate-400 leading-relaxed whitespace-pre-line">{data.action}</p>
              </div>
            )}
            {(data.dialogText || (data.dialogs && data.dialogs.length > 0)) && (
              <div>
                <div className="text-[8px] text-sky-400 font-bold mb-0.5 flex items-center gap-1">💬 Dialog</div>
                <p className="text-[10px] text-slate-400 leading-relaxed font-mono whitespace-pre-line">
                  {data.dialogText || (data.dialogs || []).join('\n')}
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-[10px] text-slate-400 uppercase font-bold flex justify-between items-center mb-1">
            <span>Video Script Prompt</span>
            <button 
              onClick={handleGeneratePrompt}
              disabled={isGenerating}
              className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${isGenerating ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white border border-indigo-500/50'}`}
              title="Auto-generate timeline prompt based on connected Scene"
            >
              ✨ {isGenerating ? 'Refining...' : 'Auto Refine'}
            </button>
          </label>
          <textarea 
            className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs text-white resize-none h-20 focus:border-indigo-500 outline-none" 
            value={data.videoPrompt || ''} 
            onChange={(e) => setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, videoPrompt: e.target.value } } : n))}
            placeholder="[00:00-00:02] SHOT 1...&#10;Detailed action and camera movement...">
          </textarea>

          {/* REFINEMENT FEEDBACK Section */}
          <div className="bg-[#0f0f14] p-2 rounded border border-slate-800/80 space-y-1.5 mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-indigo-300 font-black uppercase">💡 Tinh Chỉnh Prompt Video</span>
              <button
                onClick={async () => {
                  if (!data.feedback || !data.feedback.trim()) {
                    alert("Vui lòng nhập nhận xét tinh chỉnh!");
                    return;
                  }
                  try {
                    setRenderStatus('Refining...');
                    const { refinePromptWithAI } = await import('../../services/api');
                    const projectData = useFlowStore.getState().projectData;
                    const activeProjId = projectData?.id || '';
                    const refined = await refinePromptWithAI(
                      activeProjId,
                      data.videoPrompt || '',
                      data.feedback,
                      'video'
                    );
                    updateData('videoPrompt', refined);
                    updateData('feedback', ''); // Clear feedback
                    setRenderStatus('Ready');
                    
                    // Trigger re-render video
                    setTimeout(() => {
                      handleManualGenerate();
                    }, 100);
                  } catch (err: any) {
                    alert("Lỗi tinh chỉnh prompt: " + err.message);
                    setRenderStatus('Error');
                  }
                }}
                className="text-[8px] bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2 py-0.5 rounded transition-all font-black border border-indigo-500/30 cursor-pointer"
              >
                ✨ Refine & Render
              </button>
            </div>
            <textarea
              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[10px] text-slate-300 focus:border-indigo-500 outline-none leading-relaxed resize-none h-[44px]"
              value={data.feedback || ''}
              onChange={(e) => updateData('feedback', e.target.value)}
              placeholder="Ví dụ: camera panning nhanh hơn, bối cảnh sáng hơn..."
            />
          </div>

          {/* Sketch vs Color Selection */}
          {sceneNode?.data?.sketchMediaId && (
            <div className="mt-2 flex items-center justify-between bg-[#141418] rounded p-1.5 border border-slate-700">
              <span className="text-[10px] font-bold text-slate-400">REFERENCE:</span>
              <div className="flex bg-slate-800 rounded overflow-hidden">
                <button 
                  onClick={() => setUseSketchRef(false)}
                  className={`text-[9px] px-2 py-1 font-bold transition-colors ${!useSketchRef ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  COLOR
                </button>
                <button 
                  onClick={() => setUseSketchRef(true)}
                  className={`text-[9px] px-2 py-1 font-bold transition-colors ${useSketchRef ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  SKETCH
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Multimodal Reference Ingestion visual box */}
        <div className="bg-[#17171c] p-2.5 rounded-lg border border-slate-800/80 space-y-2">
          <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider flex justify-between">
            <span>Nạp ảnh Ref Đa Hướng ({recognizedRefs.filter(r => r.hasMedia).length})</span>
            <span className="text-slate-600">Auto-Linked</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {recognizedRefs.map((ref, idx) => (
              <div key={idx} className={`relative aspect-square rounded-md overflow-hidden bg-slate-900 border flex flex-col items-center justify-center p-0.5 ${ref.hasMedia ? 'border-emerald-500/40 shadow-sm' : 'border-slate-800'}`}>
                 {ref.url ? (
                   <img src={ref.url} className="w-full h-full object-cover rounded" alt={ref.name} />
                 ) : (
                   <span className="text-[12px]">{ref.type === 'character' ? '👤' : ref.type === 'location' ? '📍' : ref.type === 'prop' ? '📦' : '🎬'}</span>
                 )}
                 <div className="absolute inset-x-0 bottom-0 bg-black/85 py-0.5 text-[7px] font-bold text-center truncate text-white uppercase px-0.5 leading-none">
                    {ref.name}
                 </div>
                 {ref.hasMedia && (
                    <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-500 rounded-full border border-black shadow-[0_0_4px_#10b981]" title="Sẵn sàng gửi Ref ID" />
                 )}
              </div>
            ))}
            {recognizedRefs.length === 0 && (
              <div className="col-span-4 text-[9px] text-slate-600 italic text-center py-2">
                 Chưa kết nối Storyboard panel nào
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-2 bg-[#141418] border-t border-slate-800 flex items-center justify-start gap-1 flex-wrap">
             <select 
                className="bg-[#2a2a32] text-[10px] font-bold text-slate-300 py-1 px-1.5 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
                value={batch} onChange={e => setBatch(e.target.value)}
             >
                <option>1x</option><option>2x</option><option>3x</option><option>4x</option>
             </select>

             <button className="bg-[#2a2a32] text-[10px] font-bold text-slate-300 py-1 px-1.5 rounded outline-none border border-transparent flex items-center gap-1 cursor-default">
                <Video size={10}/> Video
             </button>

             <select 
                 className="bg-[#2a2a32] text-[10px] font-bold text-slate-300 py-1 px-1.5 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
                 value={duration} onChange={e => setDuration(e.target.value)}
             >
                 <option>4s</option><option>6s</option><option>8s</option><option>10s</option>
             </select>

             <select 
                 className="bg-[#2a2a32] text-[10px] font-bold text-slate-300 py-1 px-1.5 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
                 value={ratio} onChange={e => setRatio(e.target.value)}
             >
                <option>16:9</option><option>4:3</option><option>1:1</option><option>3:4</option><option>9:16</option><option>Auto</option>
             </select>

             <select 
                value={engine}
                onChange={(e) => setEngine(e.target.value)}
                className="bg-[#2a2a32] text-[10px] font-bold text-purple-400 py-1 px-1.5 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
             >
                <option value="google_flow">Google Flow</option>
                <option value="dreamina">Dreamina</option>
             </select>

             <select 
               value={modelId}
               onChange={(e) => setModelId(e.target.value)}
               className={`bg-[#2a2a32] text-[10px] font-bold ${badgeColor} py-1 px-1.5 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none truncate`}
             >
                <option value="veo_3_1_r2v_lite_low_priority">Veo 3.1 Low</option>
                <option value="veo_3_1">Veo 3.1 High</option>
                <option value="dreamina">Dreamina</option>
             </select>
      </div>

      {data.renderUrl && (
        <div className="p-2 border-t border-slate-800 bg-[#141418]">
          <div className="w-full aspect-video rounded overflow-hidden border border-slate-700 bg-black">
            <video src={data.renderUrl} controls className="w-full h-full object-cover" autoPlay loop playsInline />
          </div>
        </div>
      )}

      <Handle type="source" position={Position.Bottom} id="out" className="w-3 h-3 bg-indigo-500 border-2 border-[#121216]" />
    </div>
  );
}

export default memo(VideoNode);
