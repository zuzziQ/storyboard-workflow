import { Handle, Position, useReactFlow } from 'reactflow';
import { Download, Film, Image as ImageIcon, Play, LayoutGrid, Sparkles, Wand2, Maximize2, Loader2, Save, AlertCircle, RefreshCw, MapPin, User, X, Check, Eye } from 'lucide-react';
import { useState, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import { useFlowStore } from '../../store/useFlowStore';
import { generateMediaViaGateway } from '../../utils/mediaGateway';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { generateSingleScenePrompt, generateVideoScriptPrompt } from '../../utils/scriptParser';

const isSameScene = (id1: any, id2: any): boolean => {
  if (id1 === undefined || id1 === null || id2 === undefined || id2 === null) return false;
  const str1 = String(id1).trim().toLowerCase();
  const str2 = String(id2).trim().toLowerCase();
  if (str1 === str2) return true;
  
  const num1 = str1.replace(/[^0-9]/g, '');
  const num2 = str2.replace(/[^0-9]/g, '');
  if (num1 && num2 && parseInt(num1, 10) === parseInt(num2, 10)) return true;
  
  return false;
};

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

function ReviewBoardNode({ id, data }: any) {
  const { getNodes, getEdges } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const projectData = useFlowStore(state => state.projectData);
  const activeSceneId = useFlowStore(state => state.activeSceneId);
  const setActiveSceneId = useFlowStore(state => state.setActiveSceneId);

  const [selectedZoomMedia, setSelectedZoomMedia] = useState<{ url: string; type: 'image' | 'video'; beat?: string } | null>(null);
  const activeDetailBeat = useFlowStore((state) => state.activeDetailBeat);
  const setActiveDetailBeat = useFlowStore((state) => state.setActiveDetailBeat);
  
  // Single rendering states tracking
  const renderingStates = useFlowStore((state) => state.renderingStates);
  const videoStates = useFlowStore((state) => state.videoStates);
  const [isSyncing, setIsSyncing] = useState(false);

  // Model selection states per shot
  const [storyboardModels, setStoryboardModels] = useState<Record<string, string>>({});
  const [videoModels, setVideoModels] = useState<Record<string, string>>({});

  const edges = getEdges();
  const allNodes = getNodes();

  const parsedData = useFlowStore(state => state.parsedData);
  const shots = parsedData?.shots || [];
  const scenes = parsedData?.scenes || [];
  const customProjectRules = useFlowStore(state => state.customProjectRules || []);
  const customEpisodeRules = useFlowStore(state => state.customEpisodeRules || []);

  const worldAssetNode = useMemo(() => allNodes.find((n) => n.type === 'worldAssetNode'), [allNodes]);
  const allCharacters = useMemo(() => worldAssetNode?.data?.characters || [], [worldAssetNode]);
  const allLocations = useMemo(() => worldAssetNode?.data?.locations || [], [worldAssetNode]);

  const isOverview = activeSceneId === 'all';
  const activeScene = useMemo(() => scenes.find((s: any) => isSameScene(s.id || s.sceneId, activeSceneId)), [scenes, activeSceneId]);

  // Construct sub-nodes for each shot
  const sceneRows = useMemo(() => {
    return shots.map((s: any, idx: number) => {
      const subSceneNode = {
        id: 'review-board-main',
        type: 'sceneNode',
        isSubScene: true,
        subIndex: idx,
        data: s
      };
      const subVideoNode = {
        id: 'review-board-main',
        type: 'videoNode',
        isSubVideo: true,
        subIndex: idx,
        data: s
      };
      return { sceneNode: subSceneNode, videoNode: subVideoNode, index: idx };
    });
  }, [shots]);

  // Filter rows belonging to the active scene
  const activeSceneRows = useMemo(() => {
    return isOverview 
      ? [] 
      : sceneRows.filter(r => isSameScene(r.sceneNode.data?.sceneId || r.sceneNode.data?.sc || r.sceneNode.data?.scene_id, activeSceneId));
  }, [isOverview, sceneRows, activeSceneId]);

  const handleDownloadSingle = async (url: string, name: string) => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.warn("Direct blob download failed, falling back to window.open", e);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleDownloadAllActive = () => {
    activeSceneRows.forEach(({ sceneNode, videoNode }, idx) => {
      const storyUrl = sceneNode?.data?.renderUrl || sceneNode?.data?.imageUrl;
      const videoUrl = videoNode?.data?.renderUrl || videoNode?.data?.videoUrl;
      const label = sceneNode?.data?.beat || `shot-${idx + 1}`;
      if (storyUrl) setTimeout(() => handleDownloadSingle(storyUrl, `${label}-storyboard.png`), idx * 400);
      if (videoUrl) setTimeout(() => handleDownloadSingle(videoUrl, `${label}-video.mp4`), idx * 400 + 200);
    });
  };

  const setParsedData = useFlowStore.getState().setParsedData;

  const updateShotData = (subIndex: number, field: string, value: any) => {
    const currentParsedData = useFlowStore.getState().parsedData;
    if (!currentParsedData || !currentParsedData.shots) return;

    const updatedShots = [...currentParsedData.shots];
    updatedShots[subIndex] = {
      ...updatedShots[subIndex],
      [field]: value
    };

    if (field === 'storyboardPrompt' || field === 'visual' || field === 'hình_ảnh') {
      updatedShots[subIndex].storyboardPrompt = value;
      updatedShots[subIndex].visual = value;
      updatedShots[subIndex].hình_ảnh = value;
    }
    if (field === 'renderUrl' || field === 'imageUrl') {
      updatedShots[subIndex].imageUrl = value;
      updatedShots[subIndex].renderUrl = value;
    }
    if (field === 'videoUrl') {
      updatedShots[subIndex].videoUrl = value;
      updatedShots[subIndex].status = 'success';
    }

    setParsedData({
      ...currentParsedData,
      shots: updatedShots
    });
  };

  const handleUpdateShot = (beatId: string, field: string | Record<string, any>, value?: any) => {
    const currentParsedData = useFlowStore.getState().parsedData;
    const idx = currentParsedData?.shots?.findIndex((s: any) => s.beat === beatId || s.id === beatId);
    if (idx !== undefined && idx !== -1) {
      if (typeof field === 'object') {
        Object.entries(field).forEach(([k, v]) => {
          updateShotData(idx, k, v);
        });
      } else {
        updateShotData(idx, field, value);
      }
    }
  };

  const runImageGenForShot = (shot: any, modelId: string) => {
    const mockSceneNode = {
      id: 'review-board-main',
      isSubScene: true,
      subIndex: parsedData?.shots?.findIndex((s: any) => s.beat === shot.beat || s.id === shot.id) ?? 0,
      data: shot
    };
    runImageGenForScene(mockSceneNode, () => {}, modelId).catch(err => console.error(err));
  };

  const runVideoGenForShot = (shot: any, modelId: string) => {
    const mockVideoNode = {
      id: 'review-board-main',
      isSubVideo: true,
      subIndex: parsedData?.shots?.findIndex((s: any) => s.beat === shot.beat || s.id === shot.id) ?? 0,
      data: shot
    };
    runVideoGenForScene(mockVideoNode, () => {}, modelId).catch(err => console.error(err));
  };

  // Single Scene Image Gen
  const runImageGenForScene = async (sceneNode: any, setStatus: (status: string) => void, modelId: string = 'narwhal') => {
    if (!sceneNode) return;
    const d = sceneNode.data || {};
    const key = `${sceneNode.id}-${sceneNode.subIndex}`;
    
    const currentPrompt = d.visual || d.hình_ảnh || d.storyboardPrompt || d.description || d.diễn_tả || "";
    if (!currentPrompt) {
      alert(`⚠️ Shot "${d.beat || 'này'}" chưa có Prompt.`);
      return;
    }

    setStatus("Đang gửi lệnh...");
    
    const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
    const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
    const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
    
    const promptText = currentPrompt.toLowerCase();
    const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
    let mediaIds: string[] = [];
    const linkedAssetIds: string[] = [];
    const linkedEntities: Array<{ entityId: string; role: string }> = [];
    
    // Match Characters
    allCharacters.forEach((char: any) => {
       const name = (char.name || "").toLowerCase().trim();
       if (!name) return;
       
       if (safeMatchName(promptText, name, char.aliases)) {
          const resolvedMedia = char.mediaId || (useRemote ? char.imageUrl : null);
          if (resolvedMedia) {
             mediaIds.push(resolvedMedia);
          }
          const rawUrl = char.imageUrl || char.rootImageUrl;
          if (rawUrl) {
             mediaIds.push(rawUrl);
          }
          if (char.worldAssetCharId) {
             linkedAssetIds.push(char.worldAssetCharId);
             linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
          }
       }
    });
    
    // Match Location
    const sceneLocName = (d.location || d.bối_cảnh || "").toLowerCase().trim();
    const matchedLoc = allLocations.find((loc: any) => {
       const name = (loc.name || "").toLowerCase().trim();
       if (!name) return false;
       return name === sceneLocName || name.includes(sceneLocName) || sceneLocName.includes(name) || promptText.includes(name);
    });
    
    if (matchedLoc) {
       const resolvedMedia = matchedLoc.mediaId || (useRemote ? matchedLoc.imageUrl : null);
       if (resolvedMedia) {
          mediaIds.push(resolvedMedia);
       }
       const rawUrl = matchedLoc.imageUrl || matchedLoc.rootImageUrl;
       if (rawUrl) {
          mediaIds.push(rawUrl);
       }
       if (matchedLoc.worldAssetCharId) {
          linkedAssetIds.push(matchedLoc.worldAssetCharId);
          linkedEntities.push({ entityId: matchedLoc.worldAssetCharId, role: 'location' });
       }
    }
    
    mediaIds = Array.from(new Set(mediaIds));
    
    let finalPrompt = d.visual || d.hình_ảnh || d.storyboardPrompt || d.description || d.diễn_tả || "";
    const primaryCharacters: string[] = d.primaryCharacters || [];
    const missingNames: string[] = [];
    allCharacters.forEach((char: any) => {
       const name = (char.name || "").toLowerCase().trim();
       if (!name) return;
       
       const isPrimary = primaryCharacters.some(cName => {
          const cn = cName.toLowerCase().trim();
          return cn === name || name.includes(cn) || cn.includes(name);
       });
       
       if (isPrimary) {
          const resolvedMedia = char.mediaId || (useRemote ? char.imageUrl : null);
          if (resolvedMedia && !safeMatchName(finalPrompt, name, char.aliases)) {
             missingNames.push(char.name);
             if (!mediaIds.includes(resolvedMedia)) {
                mediaIds.push(resolvedMedia);
             }
          }
          const rawUrl = char.imageUrl || char.rootImageUrl;
          if (rawUrl && !mediaIds.includes(rawUrl)) {
             mediaIds.push(rawUrl);
          }
       }
    });


    if (missingNames.length > 0) {
       finalPrompt += `\n**CHARACTER REFERENCES:** Ensure consistent appearance for: ${missingNames.join(', ')}.`;
    }

    setStatus("Đang vẽ...");
    
    const response = await generateMediaViaGateway({
      prompt: finalPrompt,
      projectId: projectData?.id === 'new' ? undefined : projectData?.id,
      numOutputs: 1,
      mediaIds: mediaIds,
      ratio: '16:9',
      mediaType: 'image',
      linkedEntities: linkedEntities,
      ipId: id,
      entityType: 'scene',
      modelId: modelId
    }, (status) => setStatus(status));

    if (!response.success || !response.images || response.images.length === 0) {
       console.error("Lỗi gen ảnh scene:", response.error);
       setStatus("Lỗi: " + (response.error || "Unknown"));
       return;
    }

    setStatus("Hoàn thành!");
    const finalUrl = response.images[0].url;
    const finalId = response.images[0].mediaId;
    
    // Sync Variant
    if (linkedAssetIds.length > 0 && finalUrl) {
       const baseUrl = getApiBaseUrl();
       const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
       const headers: any = { 'Content-Type': 'application/json' };
       if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

       linkedAssetIds.forEach(assetId => {
          const tagId = `scene_gen_${id.toLowerCase()}_${Date.now()}`;
          fetch(`${baseUrl}/api/world-asset/orchestrator/sync-variant`, {
             method: 'POST',
             headers,
             body: JSON.stringify({
                characterId: assetId,
                tagId: tagId,
                driveUrl: finalUrl
             })
          }).catch(e => console.error(e));
       });
    }

    if (sceneNode.isSubScene) {
      const currentVariants = sceneNode.data.variants || [];
      const newVariant = {
        url: finalUrl,
        mediaId: finalId,
        prompt: finalPrompt,
        modelId: modelId,
        timestamp: Date.now()
      };
      
      updateShotData(sceneNode.subIndex, 'renderUrl', finalUrl);
      updateShotData(sceneNode.subIndex, 'generatedMediaId', finalId);
      updateShotData(sceneNode.subIndex, 'variants', [...currentVariants, newVariant]);
      
      // Auto suggest video prompt right away
      try {
         const res = await generateVideoScriptPrompt(finalPrompt);
         updateShotData(sceneNode.subIndex, 'videoPrompt', res.videoPrompt);
      } catch (e) {
         console.warn("Lỗi auto video prompt", e);
      }
    }
  };

  // Convert Color Storyboard to Sketch
  const runSketchGenForScene = async (sceneNode: any, setStatus: (status: string) => void) => {
    if (!sceneNode) return;
    const d = sceneNode.data || {};
    if (!d.generatedMediaId) {
      alert("⚠️ Vui lòng vẽ ảnh storyboard màu trước khi tạo Sketch.");
      return;
    }

    setStatus("Đang tạo Sketch...");
    try {
      const prompt = "Clean coloring page, black and white line art, pure white background, thin black outlines, sharp contours, no shading, no grayscale, colorless, perfect for coloring. " + (d.visual || d.hình_ảnh || d.storyboardPrompt || d.description || d.diễn_tả || "");
      const response = await generateMediaViaGateway({
        prompt: prompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: [d.generatedMediaId],
        mediaType: 'image',
        modelId: 'auto',
        generatorMode: 'xray' // Kích hoạt ControlNet trích xuất viền đen trắng
      }, (status) => setStatus(status));

      if (!response.success || !response.images || response.images.length === 0) {
         alert("Lỗi tạo sketch: " + (response.error || "Unknown"));
         setStatus("Lỗi");
         return;
      }
      setStatus("Hoàn thành Sketch!");
      const finalUrl = response.images[0].url;
      const finalId = response.images[0].mediaId || response.images[0].id || finalUrl;

      if (sceneNode.isSubScene) {
        updateShotData(sceneNode.subIndex, 'sketchRenderUrl', finalUrl);
        updateShotData(sceneNode.subIndex, 'sketchMediaId', finalId);
        updateShotData(sceneNode.subIndex, 'renderUrl', finalUrl); // set color preview to sketch
      }
    } catch (e: any) {
      alert("❌ Lỗi: " + e.message);
      setStatus("Lỗi");
    }
  };

  // Single Scene Video Gen
  const runVideoGenForScene = async (videoNode: any, setStatus: (status: string) => void, videoModel: string = 'veo_3_1_r2v_lite_low_priority') => {
    if (!videoNode) return;
    const d = videoNode.data || {};
    
    if (!d.videoPrompt) {
      alert(`⚠️ Video của Shot này chưa có Prompt.`);
      return;
    }

    setStatus("Đang gửi lệnh...");
    
    const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
    const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
    const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
    
    let mediaIds: string[] = [];
    const storyboardUrl = d.renderUrl || d.imageUrl;
    if (storyboardUrl) {
       mediaIds.push(storyboardUrl);
    }
    
    // Auto-upload image to grid if needed or fetch
    const matchedChars: any[] = [];
    const promptText = (d.videoPrompt || "").toLowerCase();
    allCharacters.forEach((char: any) => {
       const name = (char.name || "").toLowerCase().trim();
       if (name && safeMatchName(promptText, name, char.aliases)) {
          matchedChars.push(char);
       }
    });

    const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
    for (const char of matchedChars) {
       const media = char.mediaId || (useRemote ? char.imageUrl : null);
       if (media) mediaIds.push(media);
    }



    mediaIds = Array.from(new Set(mediaIds));

    setStatus("Đang dựng...");
    try {
      const response = await generateMediaViaGateway({
        prompt: d.videoPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: mediaIds,
        storyboardFrameUrl: storyboardUrl, // Bổ sung truyền storyboardFrameUrl!
        ratio: '16:9',
        mediaType: 'video',
        modelId: videoModel,
        duration: `${d.duration || 4}s`
      }, (status) => setStatus(status));

      const videoUrl = response.url || (response.images && response.images[0]?.url);

      if (!response.success || !videoUrl) {
         setStatus("Lỗi: " + (response.error || "Unknown"));
         return;
      }

      setStatus("Hoàn thành!");

      if (videoNode.isSubVideo) {
        updateShotData(videoNode.subIndex, 'videoUrl', videoUrl);
        updateShotData(videoNode.subIndex, 'status', 'success');
      }
    } catch (e: any) {
      console.error(e);
      setStatus("Lỗi");
    }
  };

  const handleSyncToDB = async () => {
    const universeId = projectData.selectedProjectId || projectData.selectedUniverseId;
    if (!universeId || universeId === 'new') {
      alert("Sếp vui lòng chọn hoặc khởi tạo World Asset Project ở Master Center trước.");
      return;
    }

    setIsSyncing(true);
    try {
      const currentParsedData = useFlowStore.getState().parsedData;
      const currentShots = currentParsedData?.shots || [];

      const scenesPayload = currentShots.map((sh: any, idx: number) => {
        return {
          sceneNumber: idx + 1,
          title: sh.location || sh.bối_cảnh || `Shot ${idx + 1}`,
          description: sh.description || sh.diễn_tả || '',
          prompt: sh.visual || sh.hình_ảnh || sh.storyboardPrompt || '',
          imageUrl: sh.renderUrl || sh.imageUrl || null,
          tags: sh.character_refs || sh.characterIds || []
        };
      });

      const { syncEpisodeToDB } = await import('../../services/api');
      await syncEpisodeToDB({
        universeId,
        title: projectData.name,
        scriptText: currentParsedData?.scriptText || '',
        scenes: scenesPayload,
        gflowProjectId: projectData.id
      });

      alert("🎉 ĐỒNG BỘ THÀNH CÔNG!\n\nToàn bộ kịch bản và phân cảnh đã được ghi đè trực tiếp vào PostgreSQL DB chung.");
    } catch (e: any) {
      alert(`⚠️ Đồng bộ thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div
      className={`bg-[#121216] border-2 border-rose-500/40 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.15)] overflow-hidden transition-all duration-300 nodrag ${isOverview ? 'w-[600px]' : 'w-[1000px]'}`}
    >
      <Handle type="target" position={Position.Top} id="in" className="w-3 h-3 bg-rose-500 border-2 border-[#121216]" />

      {/* Header */}
      <div className="bg-[#141418] border-b border-rose-500/20 p-3 flex items-center justify-between react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2">
          <LayoutGrid size={16} className="text-rose-400" />
          <span className="text-sm font-black text-white tracking-wide">
            {isOverview ? 'Đánh Giá: Tổng Quan' : `Đánh Giá: Cảnh ${activeSceneId}`}
          </span>
          {!isOverview && (
            <span className="text-[10px] bg-rose-500/15 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold">
              {activeSceneRows.length} góc quay
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isOverview && (
            <button
              onClick={handleDownloadAllActive}
              className="flex items-center gap-1.5 bg-[#252530] border border-slate-700/50 hover:bg-slate-850 text-slate-200 text-[10px] font-black px-3 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <Download size={11} /> Tải Cảnh Này
            </button>
          )}
          <button
            onClick={handleSyncToDB}
            disabled={isSyncing}
            className="flex items-center gap-1 bg-emerald-650 hover:bg-emerald-600 disabled:opacity-40 text-white text-[10px] font-black px-3 py-1 rounded-lg transition-colors cursor-pointer"
          >
            {isSyncing ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
            Đồng Bộ DB
          </button>
        </div>
      </div>

      {/* Content */}
      {isOverview ? (
        /* OVERVIEW MODE */
        <div className="p-4 space-y-3 text-left nodrag">
          <div className="text-[9.5px] uppercase tracking-wider font-black text-rose-400">
            Tổng quan kịch bản phân cảnh (Chọn Cảnh để xem chi tiết)
          </div>
          
          {sceneRows.length === 0 ? (
            <div className="py-8 text-center text-slate-600 text-xs italic">
              Chưa tạo phân cảnh.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2.5 nodrag">
              {scenes.map((scene: any, idx: number) => {
                const sId = scene.id || scene.sceneId || `Scene ${idx + 1}`;
                const sShots = shots.filter((sh: any) => isSameScene(sh.sceneId || sh.sc || sh.scene_id, sId));
                
                // Find first rendered storyboard in this scene
                const renderedShot = sShots.find((sh: any) => sh.renderUrl || sh.imageUrl);
                const sUrl = renderedShot ? (renderedShot.renderUrl || renderedShot.imageUrl) : null;

                return (
                  <div 
                    key={sId}
                    onClick={() => setActiveSceneId(sId)}
                    className="aspect-video bg-slate-900 border border-slate-800 rounded-lg overflow-hidden relative group cursor-pointer hover:border-rose-500/30 transition-all flex flex-col justify-end"
                  >
                    {sUrl ? (
                      <img src={sUrl} className="w-full h-full object-cover absolute inset-0" alt={sId} />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 absolute inset-0">
                        <ImageIcon size={14} />
                      </div>
                    )}
                    
                    {/* Scene ID label overlay */}
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[8px] font-black text-white text-center truncate select-none font-mono">
                      {sId} ({sShots.length} góc)
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* DETAIL SCENE RENDER MODE */
        <div className="p-4 space-y-4 nodrag">
          {/* Active scene selector summary */}
          <div className="flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-850">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActiveSceneId('all')}
                className="text-[9px] font-black uppercase text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
              >
                ◀ Về Tổng Quan
              </button>
            </div>
            <div className="text-[10px] text-slate-400 font-bold uppercase">
              Xem &amp; Đánh Giá Chi Tiết Phân Cảnh
            </div>
          </div>

          {/* Horizontal Comparison Timeline */}
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 custom-scrollbar nodrag">
            {activeSceneRows.length === 0 ? (
              <div className="py-12 text-center text-slate-550 text-xs italic w-full">
                Chưa có góc quay nào trong cảnh này.
              </div>
            ) : (
              activeSceneRows.map(({ sceneNode, videoNode, index }) => {
                const sData = sceneNode.data || {};
                const vData = videoNode?.data || {};
                
                const sUrl = sData.renderUrl || sData.imageUrl;
                const vUrl = vData.renderUrl || vData.videoUrl;
                const shotKey = `${sceneNode.id}-${index}`;
                
                const variants = sData.variants || [];
                const videoVariants = sData.videoVariants || [];

                const borderClass = sData.is_glue
                  ? "border-2 border-dashed border-purple-500 bg-purple-950/15 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "border border-slate-850 bg-slate-900/40";

                return (
                  <div key={shotKey} className={`w-60 shrink-0 flex flex-col gap-4 p-3 rounded-2xl relative text-left nodrag ${borderClass}`}>
                    {/* Shot Info */}
                    <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5 font-sans">
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-black text-rose-400 tracking-wider">
                          {sData.beat || `Shot ${index + 1}`}
                        </span>
                        {sData.is_glue && (
                          <span className="text-[7.5px] font-bold text-purple-400 uppercase tracking-widest mt-0.5" title="Được chèn tự động để chuyển đổi trục máy mượt mà">
                            [Cảnh Trám / Glue Shot]
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDetailBeat(sData.beat);
                          }}
                          className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-0.5 cursor-pointer"
                          title="Xem chi tiết phân cảnh và các trường điện ảnh"
                        >
                          Chi tiết ➜
                        </button>
                        <span className="text-[8px] text-slate-400 font-bold uppercase bg-[#0c0c0e] px-1.5 py-0.5 rounded border border-slate-800">
                          {sData.kind || 'Action'}
                        </span>
                      </div>
                    </div>

                    {/* Storyboard Block */}
                    <div className="space-y-1.5 font-sans">
                      <div className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">Storyboard</div>
                      <div className="w-full aspect-video bg-slate-955 rounded-xl border border-slate-800 overflow-hidden relative group shadow-md transition-all duration-300">
                        {sUrl ? (
                          <>
                            <img src={sUrl} className="w-full h-full object-cover" alt={sData.beat} />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity duration-200 z-10">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveDetailBeat(sData.beat);
                                }}
                                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[9.5px] font-black cursor-pointer transition-colors"
                              >
                                <Eye size={10} />
                                <span>Chi tiết</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedZoomMedia({ url: sUrl, type: 'image', beat: sData.beat });
                                }}
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
                              >
                                <Maximize2 size={10} />
                                <span>Phóng to</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSingle(sUrl, `${sData.beat || 'shot'}-storyboard.png`);
                                }}
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
                              >
                                <Download size={10} />
                                <span>Tải về</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-slate-900/40">
                            <ImageIcon size={18} className="opacity-50" />
                            <span className="text-[8px] uppercase font-bold mt-1 text-slate-650">Chưa Vẽ</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Storyboard Variants (Direct Thumbnail Grid Selection) */}
                      {variants.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Chọn Biến Thể:</div>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto py-1">
                            {variants.map((v: any, vIdx: number) => {
                              const isSelected = sUrl === v.url;
                              return (
                                <button
                                  key={vIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateShotData(index, 'renderUrl', v.url);
                                    updateShotData(index, 'imageUrl', v.url);
                                    if (v.mediaId) {
                                      updateShotData(index, 'generatedMediaId', v.mediaId);
                                    }
                                  }}
                                  className={`w-[45px] h-[30px] rounded border overflow-hidden relative transition-all duration-200 shrink-0 ${
                                    isSelected 
                                      ? 'border-rose-500 ring-1 ring-rose-500/50 shadow-md' 
                                      : 'border-slate-800 hover:border-slate-600'
                                  }`}
                                  title={`Biến thể #${vIdx + 1} (${v.modelId || 'auto'})`}
                                >
                                  <img src={v.url} className="w-full h-full object-cover" alt="" />
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-rose-500/15 flex items-center justify-center">
                                      <div className="bg-rose-500 text-white rounded-full p-[1px]">
                                        <Check size={5} strokeWidth={4} />
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-[8.5px] text-slate-650 text-center py-1 bg-[#0c0c0e]/30 border border-slate-850/60 rounded italic select-none">Chưa có biến thể</div>
                      )}
                    </div>

                    {/* Video Block */}
                    <div className="space-y-1.5 border-t border-slate-850 pt-3 font-sans">
                      <div className="text-[8.5px] text-slate-500 font-bold uppercase tracking-wider">Video</div>
                      <div className="w-full aspect-video bg-slate-955 rounded-xl border border-slate-800 overflow-hidden relative group shadow-md transition-all duration-300">
                        {vUrl ? (
                          <>
                            <video
                              src={vUrl}
                              className="w-full h-full object-cover animate-in fade-in duration-200"
                              muted
                              loop
                              playsInline
                              onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
                              onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause(); (e.currentTarget as HTMLVideoElement).currentTime = 0; }}
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity duration-200 z-20">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedZoomMedia({ url: vUrl, type: 'video', beat: sData.beat });
                                }}
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
                              >
                                <Maximize2 size={10} />
                                <span>Phóng to</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadSingle(vUrl, `${sData.beat || 'shot'}-video.mp4`);
                                }}
                                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer"
                              >
                                <Download size={10} />
                                <span>Tải về</span>
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-slate-900/40">
                            <Film size={18} className="opacity-50" />
                            <span className="text-[8px] uppercase font-bold mt-1 text-slate-655">Chưa Dựng</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Video Variants Selector (Direct Visual Selection) */}
                      {videoVariants.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">Chọn Biến Thể Video:</div>
                          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto py-1">
                            {videoVariants.map((v: any, vIdx: number) => {
                              const currentUrl = v.url || v.videoUrl;
                              const isSelected = vUrl === currentUrl;
                              return (
                                <button
                                  key={vIdx}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateShotData(index, 'videoUrl', currentUrl);
                                  }}
                                  className={`w-[45px] h-[30px] rounded border overflow-hidden relative transition-all duration-200 shrink-0 ${
                                    isSelected 
                                      ? 'border-purple-500 ring-1 ring-purple-500/50 shadow-md' 
                                      : 'border-slate-800 hover:border-slate-600'
                                  }`}
                                  title={`Video #${vIdx + 1} (${v.modelId || 'tự động'})`}
                                >
                                  <div className="w-full h-full bg-purple-955/40 flex items-center justify-center">
                                    <Play size={10} className="text-purple-400" />
                                  </div>
                                  {isSelected && (
                                    <div className="absolute inset-0 bg-purple-500/15 flex items-center justify-center">
                                      <div className="bg-purple-500 text-white rounded-full p-[0.5px]">
                                        <Check size={6} strokeWidth={4} />
                                      </div>
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : vUrl ? (
                        <div className="text-[8.5px] text-emerald-450 text-center py-0.5 bg-emerald-950/20 border border-emerald-900/30 rounded font-bold uppercase font-mono">Đang Dùng</div>
                      ) : (
                        <div className="text-[8.5px] text-slate-600 text-center py-0.5 bg-[#0c0c0e]/30 border border-slate-850 rounded italic">Chưa dựng</div>
                      )}
                    </div>

                    {/* Advanced Screenplay Info */}
                    {(sData.firstFrameState || sData.plannedLastFrame || sData.visualBridge) && (
                      <div className="bg-[#0b0b0d] border border-slate-800/80 rounded-xl p-2 space-y-1 text-[9px] text-slate-400 font-sans">
                        <div className="text-[8px] text-slate-500 font-bold uppercase tracking-wider border-b border-slate-850 pb-0.5 mb-1">
                          Cinematics & Bridge
                        </div>
                        {sData.firstFrameState && (
                          <div>
                            <span className="font-semibold text-slate-300 font-sans">First Frame:</span>{' '}
                            <span className="text-slate-400 font-sans">{sData.firstFrameState}</span>
                          </div>
                        )}
                        {sData.plannedLastFrame && (
                          <div>
                            <span className="font-semibold text-slate-300 font-sans">Last Frame:</span>{' '}
                            <span className="text-slate-400 font-sans">{sData.plannedLastFrame}</span>
                          </div>
                        )}
                        {sData.visualBridge && (
                          <div className="pt-0.5 border-t border-slate-850/40">
                            <span className="font-semibold text-purple-400 font-sans">Visual Bridge:</span>{' '}
                            <span className="text-slate-400 italic font-sans">{sData.visualBridge}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* View Details Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveDetailBeat(sData.beat);
                      }}
                      className="w-full mt-2 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/25 text-indigo-400 hover:text-white rounded-xl text-[9px] font-black uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye size={10} /> Chi tiết Shot
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Source handle bottom */}
      <Handle type="source" position={Position.Bottom} id="out" className="w-3 h-3 bg-rose-500 border-2 border-[#121216]" />
      
      {/* Zoom Preview Overlay */}
      {selectedZoomMedia && createPortal(
        <div 
          className="fixed inset-0 z-[10050] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setSelectedZoomMedia(null)}
        >
          <button 
            onClick={() => setSelectedZoomMedia(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-slate-900 text-white transition-all shadow-xl z-[10060] cursor-pointer hover:bg-slate-800 border border-slate-700"
          >
            <X size={20} />
          </button>
          
          <div 
            className="relative max-w-5xl max-h-[85vh] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedZoomMedia.type === 'video' ? (
              <video 
                src={selectedZoomMedia.url} 
                className="max-w-full max-h-[75vh] object-contain rounded-t-xl" 
                controls 
                autoPlay 
                loop 
              />
            ) : (
              <img 
                src={selectedZoomMedia.url} 
                className="max-w-full max-h-[75vh] object-contain rounded-t-xl" 
                alt="Preview" 
              />
            )}
            
            <div className="w-full p-4 bg-slate-955 border-t border-slate-850 flex justify-between items-center px-6">
              <span className="text-xs text-slate-400 font-bold font-mono uppercase tracking-wider">
                {selectedZoomMedia.beat || 'Media'} ({selectedZoomMedia.type})
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadSingle(
                    selectedZoomMedia.url, 
                    `${selectedZoomMedia.beat || 'shot'}-${selectedZoomMedia.type === 'video' ? 'video.mp4' : 'storyboard.png'}`
                  );
                }}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-indigo-950"
              >
                <Download size={14} /> Tải Về Máy
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Shot Detail Editor Modal được dời lên Root (App.tsx) */}
    </div>
  );
}

export default memo(ReviewBoardNode);
