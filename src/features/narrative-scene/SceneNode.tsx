import { Handle, Position, useReactFlow } from 'reactflow';
import { Clapperboard, ToggleLeft, ToggleRight, Trash2, Play, Image as ImageIcon, Loader2, ChevronDown, ChevronUp, MessageSquare, Zap, LayoutGrid, Check, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { useState, memo } from 'react';
import { createPortal } from 'react-dom';
import { useFlowStore } from '../../store/useFlowStore';
import { useSceneGeneration } from '../../nodes/hooks/useSceneGeneration';
import { generateMediaViaGateway } from '../../utils/mediaGateway';
import { getApiBaseUrl } from '../../utils/apiConfig';
import SceneHeaderControls from './components/SceneHeaderControls';
import SceneAssetHydrator from './components/SceneAssetHydrator';

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

function safeMatchName(text: string, name: string, aliases?: string | string[]): boolean {
  if (!text || !name) return false;
  const cleanText = String(text).toLowerCase();
  const cleanName = String(name).toLowerCase().trim();
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

function detectCameraTag(promptText: string, angle?: string, framing?: string): string {
  const text = `${promptText} ${angle || ''} ${framing || ''}`.toLowerCase();
  
  if (text.includes('close-up') || text.includes('closeup') || text.includes('close up') || text.includes('portrait')) {
    return 'close_up';
  }
  if (text.includes('medium shot') || text.includes('medium-shot') || text.includes('half body') || text.includes('waist shot')) {
    return 'medium_shot';
  }
  if (text.includes('wide shot') || text.includes('establishing shot') || text.includes('full body') || text.includes('long shot')) {
     return 'wide_shot';
  }
  if (text.includes('high angle') || text.includes('high-angle') || text.includes('top view') || text.includes('aerial')) {
     return 'high_angle';
  }
  if (text.includes('expressive') || text.includes('smile') || text.includes('angry') || text.includes('expression')) {
     return 'expressive';
  }
  return 'close_up';
}

const getBase64Image = async (imgUrl: string): Promise<string> => {
  if (!imgUrl) return '';
  if (imgUrl.startsWith('data:image/')) return imgUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        try {
          const dataURL = canvas.toDataURL('image/png');
          resolve(dataURL);
          return;
        } catch (e) {
          console.warn("Canvas toDataURL failed:", e);
        }
      }
      resolve(imgUrl);
    };
    img.onerror = () => {
      resolve(imgUrl);
    };
    img.src = imgUrl;
  });
};

const uploadImageToGFlow = async (base64Image: string, projectId: string, useRemote: boolean, baseUrl: string): Promise<string | null> => {
  if (!projectId || projectId === 'new') return null;
  const extId = localStorage.getItem('STORYMEE_EXT_ID');
  
  if (useRemote) {
    try {
      const base64ToBlob = (base64: string) => {
        const parts = base64.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
      };

      const blob = base64ToBlob(base64Image);
      const formData = new FormData();
      formData.append('file', blob, 'reference_image.jpg');

      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const res = await fetch(`${baseUrl}/internal/v1/asset/world/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${HUB_API_KEY}`
        },
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        return data.url;
      }
    } catch (err) {
      console.error("Lỗi upload GFlow:", err);
    }
  } else if (extId && (window as any).chrome?.runtime) {
    const result: any = await new Promise((resolve) => {
      (window as any).chrome.runtime.sendMessage(extId, {
        action: "UPLOAD_REFERENCE_IMAGE",
        payload: { projectId, base64Image }
      }, (response: any) => resolve(response));
    });
    return result?.mediaId || null;
  }
  return null;
};

const resolveReferencedAssetMedia = async (
   characterId: string, 
   tagId: string, 
   defaultMediaId: string | null, 
   defaultImageUrl: string | null, 
   useRemote: boolean, 
   projectId: string, 
   baseUrl: string
): Promise<string | null> => {
   const defaultVal = defaultImageUrl || defaultMediaId || null;
   if (!characterId) return defaultVal;
   
   try {
      console.log(`[OrchestratorQuery] Querying DB for character ${characterId} with tag: ${tagId}...`);
      const response = await fetch(`${baseUrl}/internal/v1/asset/world/orchestrator/query`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ characterId, tagId })
      });
      
      if (response.ok) {
         const data = await response.json();
         if (data.status === 'hit' && data.driveUrl) {
            let driveUrl = data.driveUrl;
            if (driveUrl.startsWith('/')) {
               driveUrl = baseUrl + driveUrl;
            }
            console.log(`[OrchestratorQuery] Hit variant! URL: ${driveUrl}, resolvedTag: ${data.resolvedTag}`);
            return driveUrl;
         } else {
            console.log(`[OrchestratorQuery] Miss variant. Falling back to default.`);
         }
      }
   } catch (e) {
      console.warn(`[OrchestratorQuery] Error querying orchestrator:`, e);
   }
   
   return defaultVal;
};

function MasterStoryboardNode({ id, data }: { id: string; data: any }) {
  const { getNodes, getEdges } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const [modelId, setModelId] = useState('narwhal');
  const [ratio] = useState('16:9');
  const [batch, setBatch] = useState('1x');
  const [panelGrid] = useState('1x1');
  
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

  const updateDialogs = (index: number, text: string) => {
    const dialogs = text.split('\n').filter(d => d.trim() !== '');
    updateSceneField(index, 'dialogs', dialogs);
    updateSceneField(index, 'dialogText', text);
  };

  const handleGeneratePrompt = async (index: number) => {
    try {
      setLocalGenerating(prev => ({ ...prev, [index]: true }));
      const allNodes = getNodes();
      
      const s = scenes[index];
      let location = s.location || 'Unknown';
      const action = s.action || s.physicalCharacteristics || '';
      const dialogs: string[] = Array.isArray(s.dialogs) ? s.dialogs : 
        (s.dialogText ? s.dialogText.split('\n').filter((d: string) => d.trim() !== '') : []);
      
      const rawPrompt = `Location: ${location}\nAction: ${action}\nDialogue: ${dialogs.join('\n')}`;
      const characterNames = s.primaryCharacters && s.primaryCharacters.length > 0 ? s.primaryCharacters : (s.charactersInScene || []);
      const projectId = useFlowStore.getState().projectData?.selectedProjectId || useFlowStore.getState().projectData?.selectedUniverseId || useFlowStore.getState().projectData?.id || '';
      
      const { resolvePromptWithAssetDNA, checkPromptConsistency } = await import('../../services/api');
      const resolveResult = await resolvePromptWithAssetDNA(
         projectId,
         rawPrompt,
         characterNames,
         true // optimize = true
      );
      
      const newPrompt = resolveResult.resolvedPrompt;

      let qcText = "✅ SẴN SÀNG (READY): Đạt chuẩn Letta DNA Consistency Check.";
      try {
        const consistencyRes = await checkPromptConsistency(projectId, newPrompt, characterNames);
        if (consistencyRes.status === 'violations_found' && consistencyRes.violations?.length > 0) {
          qcText = "❌ VI PHẠM THIẾT KẾ (LETTA DNA AUDIT):\n" + 
             consistencyRes.violations.map((v: any) => `- ${v.character}: ${v.violation} (Gợi ý: ${v.suggestion})`).join('\n');
        }
      } catch (e) {
        console.warn("Letta QC check failed during generate prompt:", e);
      }
      
      // Auto generate video prompt using the optimized storyboard prompt
      const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
      const durationVal = s.duration || 4;
      const videoRes = await generateVideoScriptPrompt(newPrompt, durationVal);
      const newVideoPrompt = videoRes?.videoPrompt || `[00:00-00:04] SHOT 1. ${newPrompt}`;
      
      setNodes((nds) => nds.map(n => {
         if (n.id === id) {
            const updatedScenes = [...(n.data.scenes || [])];
            updatedScenes[index] = {
               ...updatedScenes[index],
               storyboardPrompt: newPrompt,
               videoPrompt: updatedScenes[index].videoPrompt || newVideoPrompt || "",
               dialogs: dialogs,
               transitions: [],
               qcAssessment: qcText
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
      
      // Auto propagate to Master Video Node if exists
      if (newVideoPrompt) {
          const edges = getEdges();
          const targetVideoNodeId = edges.find(e => e.source === id)?.target;
          setNodes(nds => nds.map(n => {
            if (n.id === targetVideoNodeId && Array.isArray(n.data.scenes)) {
              const updatedScenes = [...n.data.scenes];
              if (updatedScenes[index]) {
                updatedScenes[index] = {
                  ...updatedScenes[index],
                  videoPrompt: newVideoPrompt
                };
              }
              return { ...n, data: { ...n.data, scenes: updatedScenes } };
            }
            return n;
          }));
      }

    } catch (err: any) {
      alert("Lỗi khi tối ưu hóa prompt (Letta): " + err.message);
    } finally {
      setLocalGenerating(prev => ({ ...prev, [index]: false }));
    }
  };

  const handleManualGenerate = async (index: number) => {
    const s = scenes[index];
    const projectData = useFlowStore.getState().projectData;
    if (!s.storyboardPrompt && !s.physicalCharacteristics) {
      alert("⚠️ Scene này chưa có Prompt. Vui lòng bấm Auto Refine trước.");
      return;
    }

    try {
      setLocalRendering(prev => ({ ...prev, [index]: true }));
      setLocalStatus(prev => ({ ...prev, [index]: "Đang gửi..." }));

      const allNodes = getNodes();
      const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
      
      const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
      const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
      
      const originalText = (s.action || s.physicalCharacteristics || "").toLowerCase();
      const promptText = (s.storyboardPrompt || "").toLowerCase();
      
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      let mediaIds: string[] = [];
      const linkedAssetIds: string[] = [];
      const linkedEntities: Array<{ entityId: string; role: string }> = [];
      
      // Detect tag for this shot/scene
      const cameraTag = detectCameraTag(promptText, s.kind, s.angle || s.camera_angle || s.framing);
      const baseUrl = getApiBaseUrl();

      // Match Characters
      const matchedChars: any[] = [];
      allCharacters.forEach((char: any) => {
         const name = (char.name || "").toLowerCase().trim();
         if (name && safeMatchName(promptText, name, char.aliases)) {
            matchedChars.push(char);
         }
      });

      for (const char of matchedChars) {
         if (char.worldAssetCharId) {
            if (linkedAssetIds.includes(char.worldAssetCharId)) {
               continue;
            }
            const defaultMedia = char.mediaId || null;
            const defaultUrl = char.imageUrl || null;
            
            const resolvedMedia = await resolveReferencedAssetMedia(
               char.worldAssetCharId,
               cameraTag,
               defaultMedia,
               defaultUrl,
               useRemote,
               projectData?.id || '',
               baseUrl
            );
            if (resolvedMedia) {
               mediaIds.push(resolvedMedia);
               linkedAssetIds.push(char.worldAssetCharId);
               linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
            }
         }
      }
      
      // Match Location
      const sceneLocName = (s.location || "").toLowerCase().trim();
      const matchedLoc = allLocations.find((loc: any) => {
         const name = (loc.name || "").toLowerCase().trim();
         if (!name) return false;
         return name === sceneLocName || 
                safeMatchName(sceneLocName, name, loc.aliases) || 
                safeMatchName(name, sceneLocName, loc.aliases) || 
                safeMatchName(promptText, name, loc.aliases) || 
                safeMatchName(originalText, name, loc.aliases);
      });
      
      if (matchedLoc && matchedLoc.worldAssetCharId) {
         if (!linkedAssetIds.includes(matchedLoc.worldAssetCharId)) {
            const defaultMedia = matchedLoc.mediaId || null;
            const defaultUrl = matchedLoc.imageUrl || null;
            
            const resolvedMedia = await resolveReferencedAssetMedia(
               matchedLoc.worldAssetCharId,
               cameraTag,
               defaultMedia,
               defaultUrl,
               useRemote,
               projectData?.id || '',
               baseUrl
            );
            if (resolvedMedia) {
               mediaIds.push(resolvedMedia);
               linkedAssetIds.push(matchedLoc.worldAssetCharId);
               linkedEntities.push({ entityId: matchedLoc.worldAssetCharId, role: 'location' });
            }
         }
      }
      
      let finalPrompt = s.storyboardPrompt || s.physicalCharacteristics || "";
      const primaryCharacters: string[] = s.primaryCharacters || [];
      const missingNames: string[] = [];
      const primaryMatchedChars: any[] = [];
      
      allCharacters.forEach((char: any) => {
         const name = (char.name || "").toLowerCase().trim();
         if (!name) return;
         
         const isPrimary = primaryCharacters.some(cName => {
            const cn = cName.toLowerCase().trim();
            return cn === name || safeMatchName(cn, name, char.aliases) || safeMatchName(name, cn, char.aliases);
         });
         
         if (isPrimary) {
            primaryMatchedChars.push(char);
         }
      });

      for (const char of primaryMatchedChars) {
         if (char.worldAssetCharId) {
            if (linkedAssetIds.includes(char.worldAssetCharId)) {
               const name = (char.name || "").toLowerCase().trim();
               if (!safeMatchName(finalPrompt, name, char.aliases)) {
                  missingNames.push(char.name);
               }
               continue;
            }
            
            const name = (char.name || "").toLowerCase().trim();
            const defaultMedia = char.mediaId || null;
            const defaultUrl = char.imageUrl || null;
            
            const resolvedMedia = await resolveReferencedAssetMedia(
               char.worldAssetCharId,
               cameraTag,
               defaultMedia,
               defaultUrl,
               useRemote,
               projectData?.id || '',
               baseUrl
            );
            
            if (resolvedMedia) {
               if (!safeMatchName(finalPrompt, name, char.aliases)) {
                  missingNames.push(char.name);
               }
               mediaIds.push(resolvedMedia);
               linkedAssetIds.push(char.worldAssetCharId);
               linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
            }
         }
      }

      if (missingNames.length > 0) {
         finalPrompt += `\n**CHARACTER REFERENCES:** Ensure consistent appearance for: ${missingNames.join(', ')}.`;
      }

      setLocalStatus(prev => ({ ...prev, [index]: "Đang tạo..." }));
      const response = await generateMediaViaGateway({
        prompt: finalPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: parseInt(batch.replace('x', '')),
        mediaIds: mediaIds,
        ratio: ratio === 'Auto' ? '16:9' : ratio,
        mediaType: 'image',
        linkedEntities: linkedEntities,
        ipId: `${id}-scene-${index}`, 
        entityType: 'scene'
      }, (status: string) => setLocalStatus(prev => ({ ...prev, [index]: status })));

      setLocalRendering(prev => ({ ...prev, [index]: false }));
      if (!response.success || !response.images || response.images.length === 0) {
         alert("Lỗi tạo ảnh: " + (response.error || "Unknown"));
         setLocalStatus(prev => ({ ...prev, [index]: "Lỗi" }));
         return;
      }

      setLocalStatus(prev => ({ ...prev, [index]: "Xong!" }));
      const finalUrl = response.images[0].url;
      const finalId = response.images[0].mediaId;
      
      // Auto sync variant to DB
      if (linkedAssetIds.length > 0 && finalUrl) {
         const baseUrl = getApiBaseUrl();
         const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
         const headers: any = { 'Content-Type': 'application/json' };
         if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

         linkedAssetIds.forEach(assetId => {
            const tagId = `scene_gen_${id.toLowerCase()}_${index}_${Date.now()}`;
            fetch(`${baseUrl}/internal/v1/asset/world/orchestrator/sync-variant`, {
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

      const newVariant = {
         url: finalUrl,
         mediaId: finalId,
         prompt: finalPrompt,
         modelId: modelId,
         timestamp: Date.now()
      };

      setNodes((nds) => nds.map(n => {
         if (n.id === id) {
            const updatedScenes = [...(n.data.scenes || [])];
            const currentVariants = updatedScenes[index].variants || [];
            updatedScenes[index] = {
               ...updatedScenes[index],
               renderUrl: finalUrl,
               imageUrl: finalUrl,
               generatedMediaId: finalId,
               variants: [...currentVariants, newVariant]
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

      // Sync reference to Zustand Store pendingShots (only first shot matched by sceneId)
      const targetSceneNum = getSceneNum(s, index);
      const currentPendingShots = useFlowStore.getState().pendingShots || [];
      let foundFirst = false;
      const updatedPending = currentPendingShots.map((sh: any) => {
         const shSceneNum = getShotSceneNum(sh);
         if (targetSceneNum === shSceneNum) {
            if (!foundFirst) {
               foundFirst = true;
               const currentVariants = sh.variants || [];
               return {
                  ...sh,
                  renderUrl: finalUrl,
                  imageUrl: finalUrl,
                  generatedMediaId: finalId,
                  variants: [...currentVariants, newVariant]
               };
            }
         }
         return sh;
      });
      useFlowStore.getState().setPendingShots(updatedPending);
      
      // Sync reference to Video Master Node
      const edges = getEdges();
      const targetVideoNodeId = edges.find(e => e.source === id)?.target;
      setNodes(nds => nds.map(n => {
        if (n.id === targetVideoNodeId && Array.isArray(n.data.scenes)) {
          const updatedScenes = [...n.data.scenes];
          if (updatedScenes[index]) {
            updatedScenes[index] = {
              ...updatedScenes[index],
              status: 'success',
              videoUrl: finalUrl,
              mediaType: 'image'
            };
          }
          return { ...n, data: { ...n.data, scenes: updatedScenes } };
        }
        return n;
      }));

    } catch (err: any) {
      alert("❌ Lỗi khi Render: " + err.message);
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
      <div className="bg-[#121216] rounded-xl border-2 border-fuchsia-500 shadow-[0_0_30px_rgba(217,70,239,0.25)] group relative text-slate-100 pb-4 w-auto" style={{ minWidth: '700px' }}>
       <Handle type="target" position={Position.Top} id="in" className="w-3 h-3 bg-blue-500 border-2 border-[#121216]" />
       <Handle type="source" position={Position.Bottom} id="out" className="w-3 h-3 bg-fuchsia-500 border-2 border-[#121216]" />
       
       {/* Top Master Header */}
       <div className="bg-[#2a2a32] p-3 flex items-center justify-between border-b border-slate-700/50 rounded-t-xl react-flow__node-draghandle cursor-move">
         <div className="flex items-center gap-2">
           <Clapperboard size={16} className="text-fuchsia-400" />
           <span className="text-sm font-black text-white tracking-wide">MASTER STORYBOARD BOARD</span>
           <span className="text-xs bg-fuchsia-600/30 text-fuchsia-300 border border-fuchsia-500/20 px-2 py-0.5 rounded-full font-black">{scenes.length} Scenes</span>
         </div>
         <div className="flex items-center gap-2">
           <button 
             onClick={handleAutoPromptAll}
             className="flex items-center gap-1 text-[10px] bg-fuchsia-600/30 hover:bg-fuchsia-600 text-fuchsia-300 hover:text-white border border-fuchsia-500/20 px-2 py-1 rounded transition-all font-black"
             title="Auto Refine for all scenes sequentially"
           >
             ✨ Refine All
           </button>
           <button 
             onClick={handleRenderAll}
             className="flex items-center gap-1 text-[10px] bg-fuchsia-600 hover:bg-fuchsia-500 text-white px-2 py-1 rounded transition-all font-black"
             title="Render all scenes sequentially to avoid captchas"
           >
             🎬 Render All
           </button>
         </div>
       </div>
       {/* Scenes vertical stack */}
       <div className="flex flex-row gap-4 items-start overflow-visible nodrag">
          {scenes.map((s: any, idx: number) => {
             const allNodes = getNodes();
             const worldNode = allNodes.find((n: any) => n.type === 'worldAssetNode');
             const allCharacters = worldNode ? (worldNode.data.characters || []) : [];

             const promptText = (s.storyboardPrompt || "").toLowerCase();
             const primaryCharacters: string[] = s.primaryCharacters || [];

             const recognizedCharacters: any[] = [];
             allCharacters.forEach((char: any) => {
                const name = (char.name || "").toLowerCase().trim();
                if (!name) return;
                const isPrimary = primaryCharacters.some(cName => {
                   const cn = cName.toLowerCase().trim();
                   return cn === name || safeMatchName(cn, name, char.aliases) || safeMatchName(name, cn, char.aliases);
                });
                if (safeMatchName(promptText, name, char.aliases) || isPrimary) {
                   recognizedCharacters.push(char.name);
                }
             });

             const isGen = localGenerating[idx];
             const isRen = localRendering[idx];
             const status = localStatus[idx];

             return (
                <div key={idx} className="bg-[#17171d] rounded-lg border border-slate-700/50 p-3 space-y-3 relative hover:border-fuchsia-500/30 transition-all duration-200 w-[280px] shrink-0 flex flex-col">
                   {/* Scene Title */}
                   <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-xs font-black text-fuchsia-400 tracking-wider">🎬 Scene {idx + 1}</span>
                      <div className="flex items-center gap-2">
                         {isRen ? (
                            <Loader2 size={13} className="text-yellow-400 animate-spin" />
                         ) : (
                            <button onClick={() => handleManualGenerate(idx)} className="text-slate-400 hover:text-green-400 transition-colors" title="Render Storyboard for this Scene">
                               <Play size={13} />
                            </button>
                         )}
                         <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">{status || 'Prompt'}</span>
                      </div>
                   </div>

                   {/* Keyframe Image Preview - RIGHT AT THE TOP */}
                    <div className="w-full aspect-video rounded overflow-hidden border border-slate-800 relative bg-slate-900/50 shrink-0 group">
                       {(s.renderUrl || s.imageUrl) ? (
                          <>
                             <img src={s.renderUrl || s.imageUrl} className="w-full h-full object-cover" alt={`Scene ${idx+1} Storyboard`} />
                             <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                                <span className="text-[9px] text-slate-300 uppercase tracking-widest font-black">Scene {idx+1}</span>
                             </div>
                          </>
                       ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 text-[10px] uppercase font-black font-mono">
                             Chưa vẽ concept
                          </div>
                       )}
                    </div>

                    {/* Variant Strip - constant height to keep elements perfectly aligned */}
                    <div className="h-[46px] flex flex-col justify-center shrink-0">
                       {s.variants && s.variants.length > 0 ? (
                          <div className="flex gap-1 overflow-x-auto py-0.5 bg-black/35 p-1 rounded border border-slate-800/80 h-full no-scrollbar scrollbar-thin">
                             {s.variants.map((v: any, vIdx: number) => {
                                const isSelected = s.renderUrl === v.url || s.imageUrl === v.url;
                                return (
                                   <div 
                                      key={vIdx} 
                                      onClick={() => {
                                         updateSceneField(idx, 'renderUrl', v.url);
                                         updateSceneField(idx, 'imageUrl', v.url);
                                         updateSceneField(idx, 'generatedMediaId', v.mediaId);

                                         // Sync selected variant to pendingShots (only first shot matched by sceneId)
                                         const targetSceneNum = getSceneNum(s, idx);
                                         const currentPendingShots = useFlowStore.getState().pendingShots || [];
                                         let foundFirst = false;
                                         const updatedPending = currentPendingShots.map((sh: any) => {
                                            const shSceneNum = getShotSceneNum(sh);
                                            if (targetSceneNum === shSceneNum) {
                                               if (!foundFirst) {
                                                  foundFirst = true;
                                                  return { 
                                                     ...sh, 
                                                     renderUrl: v.url, 
                                                     imageUrl: v.url, 
                                                     generatedMediaId: v.mediaId 
                                                  };
                                               }
                                            }
                                            return sh;
                                         });
                                         useFlowStore.getState().setPendingShots(updatedPending);
                                      }}
                                      className={`relative w-6 h-6 rounded bg-slate-950 border overflow-hidden shrink-0 cursor-pointer hover:scale-105 transition-all ${isSelected ? 'border-fuchsia-500 ring-2 ring-fuchsia-500/30' : 'border-slate-850 hover:border-slate-755'}`}
                                   >
                                      <img src={v.url} className="w-full h-full object-cover" alt="variant" />
                                   </div>
                                );
                             })}
                          </div>
                       ) : (
                          <div className="h-full flex items-center justify-center bg-slate-950/20 rounded border border-dashed border-slate-900/60">
                             <span className="text-[7.5px] text-slate-650 font-black uppercase tracking-wider">Không có biến thể</span>
                          </div>
                       )}
                    </div>

                    {/* Location & Time */}
                   <div className="grid grid-cols-2 gap-2">
                      <div>
                         <label className="text-[8px] text-slate-500 uppercase font-black">Location</label>
                         <input
                           type="text"
                           className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] mt-0.5 text-white focus:border-fuchsia-500 outline-none"
                           value={s.location || ''}
                           onChange={(e) => updateSceneField(idx, 'location', e.target.value)}
                         />
                      </div>
                      <div>
                         <label className="text-[8px] text-slate-500 uppercase font-black">Time of Day</label>
                         <input
                           type="text"
                           className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] mt-0.5 text-white focus:border-fuchsia-500 outline-none"
                           value={s.timeOfDay || ''}
                           onChange={(e) => updateSceneField(idx, 'timeOfDay', e.target.value)}
                         />
                      </div>
                   </div>

                    {/* Shot Kind & Function */}
                    <div className="grid grid-cols-2 gap-2 bg-[#0f0f14] p-1.5 rounded border border-slate-800/60">
                       <div>
                          <label className="text-[8px] text-slate-400 uppercase font-black">Shot Kind</label>
                          <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[10px] mt-0.5 text-fuchsia-300 focus:border-fuchsia-500 outline-none font-bold"
                            value={s.kind || 'Medium Shot'}
                            onChange={(e) => updateSceneField(idx, 'kind', e.target.value)}
                            placeholder="Medium Shot..."
                          />
                       </div>
                       <div>
                          <label className="text-[8px] text-slate-400 uppercase font-black">Function</label>
                          <input
                            type="text"
                            className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[10px] mt-0.5 text-indigo-300 focus:border-fuchsia-500 outline-none font-bold"
                            value={s.function || 'Rising Action'}
                            onChange={(e) => updateSceneField(idx, 'function', e.target.value)}
                            placeholder="Rising Action..."
                          />
                       </div>
                    </div>

                   {/* Action */}
                   <div>
                      <label className="text-[8px] text-slate-500 uppercase font-black flex items-center gap-1">
                         ⚡ Action <span className="text-[7px] text-slate-600 lowercase font-normal">(3-4 shots)</span>
                      </label>
                      <textarea
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] mt-0.5 text-white focus:border-fuchsia-500 outline-none leading-relaxed"
                        rows={Math.max(2, Math.ceil((s.action || '').length / 28))}
                        style={{ height: 'auto', overflowY: 'hidden', resize: 'none' }}
                        value={s.action || ''}
                        onChange={(e) => updateSceneField(idx, 'action', e.target.value)}
                      />
                   </div>

                   {/* Dialogs */}
                   <div>
                      <label className="text-[8px] text-slate-500 uppercase font-black">Dialog</label>
                      <textarea
                        className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[11px] mt-0.5 text-white focus:border-fuchsia-500 outline-none leading-relaxed"
                        rows={Math.max(2, Math.ceil((s.dialogText || (Array.isArray(s.dialogs) ? s.dialogs.join('\n') : '')).length / 28))}
                        style={{ height: 'auto', overflowY: 'hidden', resize: 'none' }}
                        value={s.dialogText || (Array.isArray(s.dialogs) ? s.dialogs.join('\n') : '')}
                        onChange={(e) => updateDialogs(idx, e.target.value)}
                      />
                   </div>

                   {/* Storyboard Prompt & Auto-Prompt */}
                   <div className="bg-[#0f0f14] p-2 rounded border border-slate-800/80">
                      <div className="flex items-center justify-between mb-1">
                         <span className="text-[8px] text-fuchsia-300 font-black uppercase">🎨 Storyboard Prompt</span>
                         <button 
                           onClick={() => handleGeneratePrompt(idx)}
                           disabled={isGen}
                           className="text-[8px] bg-fuchsia-600/20 hover:bg-fuchsia-600 text-fuchsia-300 hover:text-white px-2 py-0.5 rounded transition-all font-black border border-fuchsia-500/30"
                         >
                            {isGen ? 'Refining...' : '✨ Auto Refine'}
                         </button>
                      </div>
                      <textarea
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-300 focus:border-fuchsia-500 outline-none leading-relaxed"
                        rows={Math.max(3, Math.ceil((s.storyboardPrompt || '').length / 28))}
                        style={{ height: 'auto', overflowY: 'hidden', resize: 'none' }}
                        value={s.storyboardPrompt || ''}
                        onChange={(e) => updateSceneField(idx, 'storyboardPrompt', e.target.value)}
                        placeholder="Click ✨ Auto Refine to generate from Action + Dialog + Assets..."
                      />
                   </div>

                   {/* Causal Link & QC Assessment */}
                   <div className="space-y-2 pt-1.5 border-t border-slate-800/80 bg-[#0f0f14] p-2 rounded border border-slate-850">
                      <div>
                         <label className="text-[8px] text-indigo-400 uppercase font-black">🔗 Causal Link (Nhân quả)</label>
                         <input
                           type="text"
                           className="w-full bg-slate-900 border border-slate-800 rounded p-1 text-[10.5px] mt-0.5 text-slate-200 focus:border-fuchsia-500 outline-none italic"
                           value={s.causalLink || ''}
                           onChange={(e) => updateSceneField(idx, 'causalLink', e.target.value)}
                           placeholder="Mối quan hệ nhân quả với các shot khác..."
                         />
                      </div>
                      <div>
                         <label className="text-[8px] text-emerald-400 uppercase font-black flex items-center justify-between">
                            <span>🛡️ QC Assessment</span>
                         </label>
                         <textarea
                           className="w-full bg-emerald-950/20 border border-emerald-900/40 rounded p-1 text-[10.5px] mt-0.5 text-emerald-300/95 focus:border-emerald-500 outline-none leading-relaxed italic"
                           rows={2}
                           style={{ height: 'auto', overflowY: 'hidden', resize: 'none' }}
                           value={s.qcAssessment || ''}
                           onChange={(e) => updateSceneField(idx, 'qcAssessment', e.target.value)}
                           placeholder="Chưa đánh giá QC..."
                         />
                      </div>
                   </div>

                   {/* Character tags reference inline list */}
                   {recognizedCharacters.length > 0 && (
                      <div className="flex flex-wrap gap-1 items-center">
                         <span className="text-[8px] text-slate-600 font-bold mr-1">REFS:</span>
                         {recognizedCharacters.map(char => (
                            <span key={char} className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded font-black">
                               👤 {char}
                            </span>
                         ))}
                      </div>
                   )}

                   {/* Inline Image Preview */}
                   {false && (s.renderUrl || s.imageUrl) && (
                      <div className="mt-2 w-full aspect-video rounded overflow-hidden border border-slate-800 relative group">
                         <img src={s.renderUrl || s.imageUrl} className="w-full h-full object-cover" alt={`Scene ${idx+1} Storyboard`} />
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                            <span className="text-[9px] text-slate-300 uppercase tracking-widest font-black">Preview Scene {idx+1}</span>
                         </div>
                      </div>
                   )}
                </div>
             );
          })}
       </div>
       
       {/* Generation Config Bar in Master Node */}
       <div className="p-3 bg-[#141418] border-t border-slate-800 rounded-b-xl flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
             <select 
               className="bg-[#2a2a32] text-xs font-black text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors"
               value={batch} onChange={e => setBatch(e.target.value)}
             >
                <option>1x</option><option>2x</option>
             </select>
             <button className="bg-[#2a2a32] text-xs font-black text-slate-300 py-1 px-2 rounded border border-transparent flex items-center gap-1">
                <ImageIcon size={12}/> 16:9
             </button>
             <select 
               value={modelId}
               onChange={(e) => setModelId(e.target.value)}
               className="bg-[#2a2a32] text-xs font-black text-fuchsia-400 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors"
             >
                <option value="narwhal">NARWHAL (Fine-Art)</option>
             </select>
          </div>
       </div>
     </div>
  );
}

function SceneNode({ id, data }: any) {
  if (data.isNarrativeScene) {
    const sceneId = data.sceneId || 'Scene';
    const location = data.location || 'Unknown Location';
    const timeOfDay = data.timeOfDay || 'DAY';
    const description = data.action || data.sceneDescription || '';
    const characters = data.charactersInScene || [];
    
    const setActiveSceneId = useFlowStore.getState().setActiveSceneId;
    const activeSceneId = useFlowStore(s => s.activeSceneId);
    const isFocused = activeSceneId === sceneId;

    const parsedData = useFlowStore(state => state.parsedData);
    const pendingShots = useFlowStore(state => state.pendingShots || []);
    const allShots = pendingShots.length > 0 ? pendingShots : (parsedData?.shots || []);
    const sceneShots = allShots.filter((sh: any) => 
      isSameScene(sh.sceneId || sh.sc || sh.scene_id || (sh.sceneNumber ? `Scene-${sh.sceneNumber}` : ''), sceneId)
    );

    const mainStoryboardImg = data.renderUrl || data.imageUrl || sceneShots.find((sh: any) => sh.renderUrl || sh.imageUrl || sh.previewUrl)?.renderUrl || sceneShots.find((sh: any) => sh.renderUrl || sh.imageUrl || sh.previewUrl)?.imageUrl || sceneShots.find((sh: any) => sh.renderUrl || sh.imageUrl || sh.previewUrl)?.previewUrl;

    let warningCount = 0;
    const warningList: string[] = [];
    sceneShots.forEach((sh: any) => {
      if (sh.warnings && Array.isArray(sh.warnings)) {
        warningCount += sh.warnings.length;
        sh.warnings.forEach((w: string) => {
          if (w) warningList.push(`- ${w}`);
        });
      }
    });
    const warningDescriptions = warningList.join('\n');

    const VALENCE_COLOR: Record<string, string> = {
      positive:    '#10b981',
      negative:    '#ef4445',
      neutral:     '#64748b',
      tense:       '#f97316',
      melancholic: '#8b5cf6',
    };

    return (
      <div className={`relative w-80 rounded-3xl p-5 border bg-[#121216] transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.5)] select-none ${
        isFocused 
          ? 'border-indigo-500 shadow-[0_0_25px_rgba(99,102,241,0.35)] ring-2 ring-indigo-500/25' 
          : 'border-emerald-500/30 hover:border-emerald-500/60 hover:shadow-[0_0_25px_rgba(16,185,129,0.25)]'
      }`}>
        <Handle type="target" position={Position.Left} className="w-3 h-3 bg-emerald-500 border-2 border-[#121216] -ml-1" />

        {warningCount > 0 && (
          <div 
            className="absolute top-4 right-4 flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/35 text-amber-400 text-[8px] font-black animate-pulse shadow-md z-10 cursor-help"
            title={`Phân cảnh có ${warningCount} lỗi đứt gãy:\n${warningDescriptions}`}
          >
            <AlertTriangle className="w-2.5 h-2.5 text-amber-500 shrink-0" />
            <span>{warningCount} WARNINGS</span>
          </div>
        )}
        
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3 react-flow__node-draghandle cursor-move">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]">
            <Clapperboard size={15} />
          </div>
          <div>
            <div className="text-[9px] text-emerald-400 font-black tracking-widest uppercase">NARRATIVE SCENE</div>
            <div className="text-sm font-black text-white">{sceneId}</div>
          </div>
        </div>

        {/* Location & Time */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3 text-slate-400 text-[10px] font-medium">
          <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-200 font-bold truncate max-w-[140px]">{location}</span>
          <span className="px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-200 font-bold">{timeOfDay}</span>
        </div>

        {/* Storyboard Visual Preview */}
        {mainStoryboardImg && (
          <div className="relative mb-3 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video group shadow-inner">
            <img 
              src={mainStoryboardImg} 
              alt={`Storyboard ${sceneId}`} 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            />
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              STORYBOARD FRAME
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2.5">
              <span className="text-[10px] text-white/90 font-medium line-clamp-1 italic">
                {data.storyboardPrompt || description}
              </span>
            </div>
          </div>
        )}

        {/* Description */}
        <div className="p-3 bg-slate-950/50 rounded-2xl border border-slate-900 text-[11px] text-slate-355 leading-relaxed max-h-24 overflow-y-auto italic custom-scrollbar">
          {description}
        </div>

        {/* Emotional State (Emotion Arc Integration) */}
        {(data.emotion || data.emotionIntensity !== undefined) && (
          <div className="mt-3 p-2.5 rounded-2xl bg-slate-900/40 border border-slate-850/60 space-y-1.5 text-left">
            <div className="flex justify-between items-center text-[9px] uppercase font-black text-slate-400 tracking-wider">
              <span>Mạch cảm xúc: <span className="text-indigo-400 font-bold ml-1">{data.emotion || 'trung lập'}</span></span>
              <span style={{ color: VALENCE_COLOR[data.valence] || '#94a3b8' }} className="font-bold">{data.valence || 'neutral'}</span>
            </div>
            {data.emotionIntensity !== undefined && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-950 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500" 
                    style={{ 
                      width: `${data.emotionIntensity}%`, 
                      backgroundColor: VALENCE_COLOR[data.valence] || '#6366f1' 
                    }} 
                  />
                </div>
                <span className="text-[9px] font-black text-slate-300 font-mono">{data.emotionIntensity}%</span>
              </div>
            )}
          </div>
        )}

        {/* Characters In Scene */}
        {characters.length > 0 && (
          <div className="mt-3">
            <div className="text-[9px] text-slate-500 font-black tracking-wider uppercase mb-1">CHARACTERS ({characters.length})</div>
            <div className="flex flex-wrap gap-1">
              {characters.map((char: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-md text-[9px] font-bold bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 truncate max-w-[90px]" title={char}>
                  {char}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Shot Strip Gallery */}
        {sceneShots.length > 0 && (
          <div className="mt-3 space-y-1.5 text-left">
            <div className="flex items-center justify-between text-[9px] uppercase font-black text-slate-400 tracking-wider">
              <span>SHOTS TRONG CẢNH ({sceneShots.length})</span>
              <span className="text-emerald-400 font-mono">
                {sceneShots.filter((s: any) => s.renderUrl || s.imageUrl || s.previewUrl).length}/{sceneShots.length} có ảnh
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 nodrag">
              {sceneShots.map((sh: any, sIdx: number) => {
                const shotImg = sh.renderUrl || sh.imageUrl || sh.previewUrl;
                return (
                  <div 
                    key={sh.id || sh.beat || sIdx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSceneId(sceneId);
                      useFlowStore.getState().setIsRightDrawerCollapsed(false);
                    }}
                    className="group/thumb relative aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-950/60 cursor-pointer hover:border-indigo-500 transition-all shadow-sm flex flex-col justify-end"
                    title={sh.diễn_tả || sh.description || sh.beat || `Shot ${sIdx + 1}`}
                  >
                    {shotImg ? (
                      <img src={shotImg} alt={sh.beat || `Shot ${sIdx + 1}`} className="w-full h-full object-cover absolute inset-0 group-hover/thumb:scale-110 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 absolute inset-0">
                        <ImageIcon size={12} />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                    <div className="relative z-10 px-1 py-0.5 flex items-center justify-between text-[8px] font-bold text-white font-mono">
                      <span className="bg-black/60 px-1 rounded text-[7px] text-indigo-300">#{sIdx + 1}</span>
                      <span className="text-[7.5px] text-slate-300 truncate max-w-[45px]">{sh.cameraAngle || sh.framing || `${sh.duration || 3}s`}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Button: Open Right Drawer */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            const willFocus = !isFocused;
            setActiveSceneId(willFocus ? sceneId : 'all');
            useFlowStore.getState().setIsRightDrawerCollapsed(!willFocus);
          }}
          className={`nodrag mt-3.5 w-full text-white text-[11px] font-black py-2.5 rounded-2xl transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95 border ${
            isFocused 
              ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-500/15 border-rose-500/30' 
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/15 border-indigo-500/30'
          }`}
        >
          🎬 {isFocused ? 'Đóng Drawer Shot Setup' : 'Thiết kế Shot & Atmosphere'}
        </button>

        <Handle type="source" position={Position.Right} className="w-3 h-3 bg-indigo-500 border-2 border-[#121216] -mr-1" />
      </div>
    );
  }

  if (data.scenes && Array.isArray(data.scenes)) {
     return <MasterStoryboardNode id={id} data={data} />;
  }
  const [active, setActive] = useState(true);
  const [ratio, setRatio] = useState('16:9');
  const [batch, setBatch] = useState('1x');
  const [modelId, setModelId] = useState('narwhal');
  const panelGrid = '1x1'; // NEW: panel grid size
  const [promptExpanded, setPromptExpanded] = useState(false); // NEW: collapsible prompt
  const [selectedVariant, setSelectedVariant] = useState<any | null>(null); // NEW: variant preview modal
  
  const { getNodes, getEdges } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const setEdges = useFlowStore.getState().setEdges;
  const hoveredAssetId = useFlowStore(state => state.hoveredAssetId);

  const {
    isGenerating,
    isRendering,
    renderStatus,
    handleManualGenerate,
    handleConvertToSketch,
    handleGeneratePrompt
  } = useSceneGeneration(id, data, modelId, ratio, batch);

  const edges = getEdges();
  const isHoveredLinked = hoveredAssetId && edges.some(e => e.source === hoveredAssetId && e.target === id);

  // Compute recognized characters and locations dynamically for visual preview
  const allNodes = getNodes();
  const worldNode = allNodes.find((n: any) => n.type === 'worldAssetNode');
  
  const allCharacters = worldNode ? (worldNode.data.characters || []) : [];
  const allLocations = worldNode ? (worldNode.data.locations || []) : [];
  const allProps = worldNode ? (worldNode.data.props || []) : [];
  
  const originalText = (data.action || data.physicalCharacteristics || "").toLowerCase();
  const promptText = (data.storyboardPrompt || "").toLowerCase();
  const primaryCharacters: string[] = data.primaryCharacters || [];
  const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';

  const recognizedCharacters: any[] = [];
  const processedNames = new Set<string>();
  allCharacters.forEach((char: any) => {
     const name = (char.name || "").toLowerCase().trim();
     if (!name || processedNames.has(name)) return;
     
     const isPrimary = primaryCharacters.some(cName => {
        const cn = cName.toLowerCase().trim();
        return cn === name || safeMatchName(cn, name, char.aliases) || safeMatchName(name, cn, char.aliases);
      });
     
     if (safeMatchName(promptText, name, char.aliases) || isPrimary) {
        processedNames.add(name);
        recognizedCharacters.push({
           name: char.name || 'Unknown',
           hasMedia: !!(char.mediaId || (useRemote && char.imageUrl))
        });
     }
  });
  
  const sceneLocName = (data.location || "").toLowerCase().trim();
  const matchedLoc = allLocations.find((loc: any) => {
     const name = (loc.name || "").toLowerCase().trim();
     if (!name) return false;
     return name === sceneLocName || 
            safeMatchName(sceneLocName, name, loc.aliases) || 
            safeMatchName(name, sceneLocName, loc.aliases) || 
            safeMatchName(promptText, name, loc.aliases) || 
            safeMatchName(originalText, name, loc.aliases);
  });
  
  const recognizedLocation = matchedLoc ? {
     name: matchedLoc.name || 'Location',
     hasMedia: !!(matchedLoc.mediaId || (useRemote && matchedLoc.imageUrl))
  } : null;

  const recognizedProps: any[] = [];
  const processedProps = new Set<string>();
  const propsInScene: string[] = data.props || [];
  allProps.forEach((prop: any) => {
     const name = (prop.name || "").toLowerCase().trim();
     if (!name || processedProps.has(name)) return;
     
     const inList = propsInScene.some((pName: string) => {
        const pn = pName.toLowerCase().trim();
        return pn === name || safeMatchName(pn, name, prop.aliases) || safeMatchName(name, pn, prop.aliases);
     });
     
     if (inList || safeMatchName(promptText, name, prop.aliases) || safeMatchName(originalText, name, prop.aliases)) {
        processedProps.add(name);
        recognizedProps.push({
           name: prop.name || 'Prop',
           hasMedia: !!(prop.mediaId || (useRemote && prop.imageUrl))
        });
     }
  });

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // Helper: update a data field
  const updateData = (field: string, value: any) =>
    setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));

  // NEW: Helper to update dialogs array from textarea text (split by newline)
  const updateDialogs = (text: string) => {
    const dialogs = text.split('\n').filter(d => d.trim() !== '');
    updateData('dialogs', dialogs);
    updateData('dialogText', text);
  };

  const handleSetActiveVariant = (v: any) => {
    updateData('renderUrl', v.url);
    updateData('generatedMediaId', v.mediaId);
    
    const targetEdge = edges.find(e => e.source === id);
    if (targetEdge) {
      setNodes((nds) => nds.map(n => {
        if (n.id === targetEdge.target) {
          return { 
            ...n, 
            data: { 
              ...n.data, 
              status: 'success', 
              videoUrl: v.url, 
              mediaType: 'image' 
            } 
          };
        }
        return n;
      }));
    }
  };

  const variants = data.variants || (data.renderUrl ? [{
    url: data.renderUrl,
    mediaId: data.generatedMediaId || 'initial',
    prompt: data.storyboardPrompt || '',
    modelId: modelId,
    timestamp: Date.now()
  }] : []);

  // Compute dialog display text
  const dialogText = data.dialogText || (Array.isArray(data.dialogs) ? data.dialogs.join('\n') : '');

  // Primary / secondary character split
  const primaryChars: string[] = data.primaryCharacters || [];
  const secondaryChars: string[] = data.secondaryCharacters || [];
  const hasTooManyPrimary = primaryChars.length > 2;

  // Model Styling Logic
  let borderClass = 'border-slate-700';
  let badgeColor = 'text-blue-400';
  
  if (active) {
    if (modelId === 'omni_flash') {
      borderClass = 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)]';
      badgeColor = 'text-green-400';
    } else if (modelId === 'narwhal') {
      borderClass = 'border-fuchsia-500 shadow-[0_0_20px_rgba(217,70,239,0.5)]';
      badgeColor = 'text-fuchsia-400';
    } else if (modelId === 'veo_3_1') {
      borderClass = 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)]';
      badgeColor = 'text-yellow-400';
    } else {
      borderClass = 'border-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
    }
  }

  // Dynamic Glow
  if (isHoveredLinked) {
    borderClass = 'border-indigo-400 ring-4 ring-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.8)] scale-[1.03] z-50 transition-all duration-300';
  }


  // Stats & Risk Auditing for this narrative scene
  const pendingShots = useFlowStore(state => state.pendingShots || []);
  const sceneShots = pendingShots.filter((sh: any) => {
    const sId = sh.sceneId || sh.sc || '';
    return isSameScene(sId, data.sceneId) || isSameScene(sId, id);
  });
  const totalSceneDuration = sceneShots.reduce((sum: number, sh: any) => sum + (sh.duration || 4), 0);
  
  let highestRisk = 'READY';
  if (sceneShots.some((sh: any) => sh.riskFlag === 'NEED PATCH')) {
    highestRisk = 'NEED PATCH';
  } else if (sceneShots.some((sh: any) => sh.riskFlag === 'NEED SPLIT')) {
    highestRisk = 'NEED SPLIT';
  } else if (sceneShots.some((sh: any) => sh.riskFlag === 'NEED REF')) {
    highestRisk = 'NEED REF';
  } else if (sceneShots.some((sh: any) => sh.riskFlag === 'NEED DIRECTOR DECISION')) {
    highestRisk = 'NEED DIRECTOR DECISION';
  }

  const getHeaderRiskColor = (risk: string) => {
    switch (risk) {
      case 'NEED PATCH': return 'bg-rose-500/25 border-rose-500/40 text-rose-300';
      case 'NEED SPLIT': return 'bg-yellow-500/25 border-yellow-500/40 text-yellow-300';
      case 'NEED REF': return 'bg-amber-500/25 border-amber-500/40 text-amber-300';
      case 'NEED DIRECTOR DECISION': return 'bg-fuchsia-500/25 border-fuchsia-500/40 text-fuchsia-300';
      default: return 'bg-emerald-500/20 border-emerald-500/35 text-emerald-300';
    }
  };

  return (
    <div className={`bg-[#121216] rounded-xl border-2 ${borderClass} w-[360px] transition-all group relative`}>
      {/* Handles In */}
      <Handle type="target" position={Position.Top} id="in" style={{ left: '35%' }} className={`w-3 h-3 ${isHoveredLinked ? 'bg-indigo-400' : 'bg-blue-500'} border-2 border-[#121216]`} />
      
      {/* Handle Config In */}
      <Handle type="target" position={Position.Top} id="config" style={{ left: '65%' }} className="w-3 h-3 bg-yellow-500 border-2 border-[#121216]" />
      
      {/* Header */}
      <SceneHeaderControls
        sceneId={data.sceneId}
        active={active}
        setActive={setActive}
        highestRisk={highestRisk}
        badgeColor={badgeColor}
        isRendering={isRendering}
        handleManualGenerate={handleManualGenerate}
        handleDelete={handleDelete}
        sceneShots={sceneShots}
        totalSceneDuration={totalSceneDuration}
        getHeaderRiskColor={getHeaderRiskColor}
      />
      
      {/* Content */}
      <div className={`p-3 space-y-3 ${active ? 'opacity-100' : 'opacity-40 grayscale pointer-events-none'}`}>
        
        {/* Row: Location + Time */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[9px] text-slate-400 uppercase font-bold flex justify-between">
              <span>Location</span>
              <span className="text-slate-600 text-[8px]">(Linked)</span>
            </label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs mt-1 text-white focus:border-blue-500 outline-none"
              defaultValue={data.location}
              onChange={(e) => updateData('location', e.target.value)}
              placeholder="Location name"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-400 uppercase font-bold">Time of Day</label>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-xs mt-1 text-white focus:border-blue-500 outline-none"
              defaultValue={data.timeOfDay}
              onChange={(e) => updateData('timeOfDay', e.target.value)}
              placeholder="DAY / NIGHT"
            />
          </div>
        </div>

        {/* Scene Description (read-only from script) */}
        {data.sceneDescription && (
          <div className="bg-[#0d0d14] border border-slate-700/40 rounded-lg p-2">
            <div className="text-[8px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1">
              📋 <span>Scene Description</span>
              <span className="text-slate-700 ml-auto">from script · read-only</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed italic">{data.sceneDescription}</p>
          </div>
        )}

        {/* PRIMARY / SECONDARY Characters */}
        {(primaryChars.length > 0 || secondaryChars.length > 0) && (
          <div className="space-y-1.5">
            {hasTooManyPrimary && (
              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg px-2 py-1.5">
                <span className="text-[10px]">⚠️</span>
                <span className="text-[10px] text-rose-400 font-bold">
                  {primaryChars.length} nhân vật chính → storyboard có thể bị lỗi style/voice
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-1.5">
              {primaryChars.length > 0 && (
                <div className="bg-[#0d0d14] border border-emerald-500/20 rounded-lg p-1.5">
                  <div className="text-[8px] text-emerald-400 font-black uppercase tracking-wider mb-1">
                    🎯 Primary ({primaryChars.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {primaryChars.map((c: string, i: number) => (
                      <span key={i} className="text-[9px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1 py-0.5 rounded font-semibold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {secondaryChars.length > 0 && (
                <div className="bg-[#0d0d14] border border-slate-700/40 rounded-lg p-1.5">
                  <div className="text-[8px] text-slate-500 font-black uppercase tracking-wider mb-1">
                    🌫 Secondary ({secondaryChars.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {secondaryChars.map((c: string, i: number) => (
                      <span key={i} className="text-[9px] bg-slate-700/30 text-slate-400 border border-slate-700/40 px-1 py-0.5 rounded font-semibold">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* ACTION Section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Zap size={11} className="text-amber-400" />
            <label className="text-[9px] text-amber-300 uppercase font-bold tracking-wider">Action</label>
            <span className="text-[8px] text-slate-600 ml-auto">3-4 sequential actions → shots</span>
          </div>
          <textarea
            className="w-full bg-[#111118] border border-amber-500/20 rounded-lg p-2 text-[11px] text-white resize-none h-[60px] focus:border-amber-400 outline-none placeholder-slate-600 leading-relaxed"
            value={data.action || ''}
            onChange={(e) => updateData('action', e.target.value)}
            placeholder={"SHOT 1: Character walks in, mid shot\nSHOT 2: Reaches for object, close-up\nSHOT 3: Reaction, wide shot"}
          />
        </div>

        {/* DIALOG Section */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <MessageSquare size={11} className="text-sky-400" />
            <label className="text-[9px] text-sky-300 uppercase font-bold tracking-wider">Dialog</label>
            <span className="text-[8px] text-slate-600 ml-auto">one line per spoken line</span>
          </div>
          <textarea
            className="w-full bg-[#111118] border border-sky-500/20 rounded-lg p-2 text-[11px] text-white resize-none h-[52px] focus:border-sky-400 outline-none placeholder-slate-600 leading-relaxed font-mono"
            value={dialogText}
            onChange={(e) => updateDialogs(e.target.value)}
            placeholder={"CHARACTER_A: Line of dialogue here.\nCHARACTER_B: Reply line here."}
          />
        </div>

        {/* Divider */}
        <div className="border-t border-slate-800" />

        {/* STORYBOARD PROMPT Section — Collapsible */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <LayoutGrid size={11} className="text-fuchsia-400" />
              <label className="text-[9px] text-fuchsia-300 uppercase font-bold tracking-wider">Storyboard Prompt</label>
              {/* Panel grid selector inline (Temporarily hidden for single shot mode) */}
            </div>
            <div className="flex items-center gap-1.5">
              <button 
                onClick={handleGeneratePrompt}
                disabled={isGenerating}
                className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded transition-colors ${isGenerating ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-fuchsia-600/30 text-fuchsia-300 hover:bg-fuchsia-600 hover:text-white border border-fuchsia-500/50'}`}
                title="Auto-generate Storyboard Prompt from Action + Dialog + Characters + Location"
              >
                ✨ {isGenerating ? 'Refining...' : 'Auto Refine'}
              </button>
              <button
                onClick={() => setPromptExpanded(prev => !prev)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
                title={promptExpanded ? 'Collapse prompt' : 'Expand prompt'}
              >
                {promptExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {/* Collapsed preview */}
          {!promptExpanded && (
            <div
              className="w-full bg-[#111118] border border-fuchsia-500/15 rounded-lg p-2 text-[10px] text-slate-400 cursor-pointer hover:border-fuchsia-500/40 transition-colors line-clamp-2 min-h-[36px]"
              onClick={() => setPromptExpanded(true)}
              title="Click to expand and edit prompt"
            >
              {data.storyboardPrompt || data.physicalCharacteristics
                ? (data.storyboardPrompt || data.physicalCharacteristics).substring(0, 120) + ((data.storyboardPrompt || data.physicalCharacteristics).length > 120 ? '...' : '')
                : <span className="italic text-slate-600">Bấm ✨ Auto Refine hoặc click để soạn thảo thủ công...</span>
              }
            </div>
          )}

          {/* Expanded textarea */}
          {promptExpanded && (
            <textarea 
              className="w-full bg-[#111118] border border-fuchsia-500/30 rounded-lg p-2 text-[11px] text-white resize-none h-[100px] focus:border-fuchsia-400 outline-none leading-relaxed"
              value={data.storyboardPrompt || data.physicalCharacteristics || ''} 
              onChange={(e) => updateData('storyboardPrompt', e.target.value)}
              placeholder={`**STORYBOARD ${panelGrid.toUpperCase()} GRID**\nCreate a single 16:9 image divided into a ${panelGrid} storyboard grid with perfect visual continuity.\n**CHARACTERS:** ...\n**SCENE ACTION:** ...\n**DIALOGUE CONTEXT:** "..."\n**VISUAL STYLE:** 3D Pixar, cinematic, textless.`}
            />
          )}

          {/* Panel grid badge (hidden for single shot mode) */}
          <div className="flex items-center gap-1 mt-1">
            {(data.action || data.dialogs?.length > 0) && !data.storyboardPrompt && (
              <span className="text-[8px] text-amber-400 font-medium">⚡ Action/Dialog ready → bấm Auto Refine</span>
            )}
          </div>
        </div>

        {/* REFINEMENT FEEDBACK Section */}
        <div className="bg-[#0f0f14] p-2 rounded border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[8px] text-indigo-300 font-black uppercase">💡 Tinh Chỉnh Prompt Bằng Nhận Xét</span>
            <button
              onClick={async () => {
                if (!data.feedback || !data.feedback.trim()) {
                  alert("Vui lòng nhập nhận xét tinh chỉnh!");
                  return;
                }
                try {
                  updateData('renderStatus', 'Refining...');
                  const { refinePromptWithAI } = await import('../../services/api');
                  const projectData = useFlowStore.getState().projectData;
                  const activeProjId = projectData?.id || '';
                  const refined = await refinePromptWithAI(
                    activeProjId,
                    data.storyboardPrompt || data.physicalCharacteristics || '',
                    data.feedback,
                    'storyboard'
                  );
                  updateData('storyboardPrompt', refined);
                  updateData('feedback', ''); // Clear feedback
                  updateData('renderStatus', 'Ready');
                  
                  // Trigger re-render
                  setTimeout(() => {
                    handleManualGenerate();
                  }, 100);
                } catch (err: any) {
                  alert("Lỗi tinh chỉnh prompt: " + err.message);
                  updateData('renderStatus', 'Error');
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
            placeholder="Ví dụ: Paco trông cần tức giận hơn và bối cảnh tối đi 50%..."
          />
        </div>

        {/* Recognized Reference Assets Section */}
        <SceneAssetHydrator
          recognizedCharacters={recognizedCharacters}
          recognizedLocation={recognizedLocation}
          recognizedProps={recognizedProps}
        />
      </div>

      {/* Generation Config Bar */}
      <div className="p-2 bg-[#141418] border-t border-slate-800 flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
             <select 
               className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
               value={batch} onChange={e => setBatch(e.target.value)}
             >
                <option>1x</option><option>2x</option><option>3x</option><option>4x</option>
             </select>

             <button className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded outline-none border border-transparent flex items-center gap-1 cursor-default">
                <ImageIcon size={12}/> Image
             </button>

             <select 
               className="bg-[#2a2a32] text-xs font-bold text-slate-300 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
               value={ratio} onChange={e => setRatio(e.target.value)}
             >
                <option>16:9</option><option>4:3</option><option>1:1</option><option>3:4</option><option>9:16</option><option>Auto</option>
             </select>

             <select 
                value={data.generatorMode || 'standard'}
                onChange={(e) => updateData('generatorMode', e.target.value)}
                className="bg-[#2a2a32] text-xs font-bold text-fuchsia-400 py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none text-center"
                title="Generation Mode"
             >
                <option value="standard">Standard</option>
                <option value="xray">X-Ray (Applet)</option>
             </select>

             <select 
               value={modelId}
               onChange={(e) => setModelId(e.target.value)}
               className={`bg-[#2a2a32] text-xs font-bold ${badgeColor} py-1 px-2 rounded hover:bg-slate-700 outline-none cursor-pointer border border-transparent hover:border-slate-600 transition-colors appearance-none max-w-[120px] truncate`}
             >
                <option value="narwhal">NARWHAL (Fine-Art)</option>
             </select>
          </div>
      </div>

      {/* Integrated Image Preview & Variant History Gallery */}
      {(data.renderUrl || data.sketchRenderUrl || variants.length > 0) && (
        <div className="p-3 border-t border-slate-800 bg-[#141418] space-y-3">
          {/* Active Preview */}
          {data.renderUrl && (
             <div className="w-full aspect-video rounded overflow-hidden border border-slate-700 relative group shadow-inner">
               <img src={data.renderUrl} className="w-full h-full object-cover" alt="Storyboard Preview" />
               <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col gap-2 items-center justify-center transition-all duration-300">
                  <span className="text-[10px] text-slate-300 uppercase tracking-widest font-black">Phân Cảnh Hiện Tại</span>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const activeV = variants.find((v: any) => v.url === data.renderUrl) || {
                          url: data.renderUrl,
                          mediaId: data.generatedMediaId || 'initial',
                          prompt: data.storyboardPrompt || '',
                          modelId: modelId,
                          timestamp: Date.now()
                        };
                        setSelectedVariant(activeV);
                      }} 
                      className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[10px] px-3 py-1.5 rounded font-black transition-colors flex items-center gap-1 shadow-lg"
                    >
                      <ExternalLink size={10} /> Phóng To
                    </button>
                    <button onClick={handleConvertToSketch} className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] px-3 py-1.5 rounded font-black transition-colors flex items-center gap-1 shadow-lg">
                      🪄 Sketch
                    </button>
                  </div>
               </div>
             </div>
          )}

          {data.sketchRenderUrl && (
             <div className="w-full aspect-video rounded overflow-hidden border border-slate-700 relative shadow-inner">
               <div className="absolute top-1.5 right-1.5 bg-black/75 text-[8px] text-slate-300 px-1.5 py-0.5 rounded font-bold uppercase shadow tracking-wider">Sketch Mode</div>
               <img src={data.sketchRenderUrl} className="w-full h-full object-cover grayscale" alt="Storyboard Sketch" />
             </div>
          )}

          {/* Variants Thumbnail Grid */}
          {variants.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest flex justify-between">
                <span>Bộ Sưu Tập Biến Thể ({variants.length})</span>
                <span className="text-fuchsia-400">Click để zoom</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {variants.map((v: any, vIdx: number) => {
                  const isActive = data.renderUrl === v.url;
                  return (
                    <div 
                      key={vIdx} 
                      onClick={() => setSelectedVariant(v)}
                      className={`relative aspect-video rounded border overflow-hidden cursor-pointer bg-slate-900 group transition-all hover:scale-[1.05] ${
                        isActive 
                        ? 'border-fuchsia-500 ring-1 ring-fuchsia-500/50 shadow-[0_0_8px_rgba(217,70,239,0.3)]' 
                        : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img src={v.url} className="w-full h-full object-cover" alt={`V${vIdx + 1}`} />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[8px] font-black text-white bg-black/85 px-1 py-0.5 rounded shadow">XEM</span>
                      </div>
                      {isActive && (
                        <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-fuchsia-500 rounded-full border border-black shadow-[0_0_4px_#d946ef]" />
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-black/75 py-0.5 text-[6px] text-center text-slate-400 font-bold uppercase truncate px-0.5 leading-none">
                        V{vIdx + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Full-screen Glassmorphic Variant Viewer Modal */}
      {selectedVariant && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-[#0a0a0f] animate-fade-in p-4 md:p-8"
          onClick={() => setSelectedVariant(null)}
        >
          <div 
            className="bg-[#181820] border border-slate-700/50 rounded-2xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col md:flex-row shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left: Image Container */}
            <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-slate-800">
              <img 
                src={selectedVariant.url} 
                className="w-full h-full object-contain max-h-[85vh]" 
                alt="Large Preview" 
              />
              <div className="absolute top-4 left-4 bg-black/85 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] text-slate-300 font-mono font-bold tracking-wide">ID: {selectedVariant.mediaId}</span>
              </div>
              <button 
                onClick={() => setSelectedVariant(null)} 
                className="absolute top-4 right-4 bg-black/60 hover:bg-red-600 text-white p-2 rounded-full transition-colors border border-slate-700/50"
              >
                <X size={18} />
              </button>
            </div>

            {/* Right: Metadata Panel */}
            <div className="w-full md:w-[360px] p-6 flex flex-col justify-between bg-[#121218] overflow-y-auto">
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-white text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                    <LayoutGrid size={16} className="text-fuchsia-400" />
                    Chi Tiết Biến Thể
                  </h3>
                  <span className="text-[10px] bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30 px-2 py-0.5 rounded font-black tracking-wider">
                    STORYBOARD
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Storyboard Prompt Used</div>
                  <div className="bg-[#09090d] border border-slate-800 rounded-xl p-3 text-xs text-slate-300 max-h-[220px] overflow-y-auto leading-relaxed font-mono whitespace-pre-wrap select-all">
                    {selectedVariant.prompt || "No prompt details saved."}
                  </div>
                </div>

                <div className="space-y-3 bg-slate-900/30 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400">
                  <div className="flex justify-between">
                    <span className="font-bold">Engine & Model:</span>
                    <span className="text-fuchsia-400 font-black">{selectedVariant.modelId?.toUpperCase() || 'NARWHAL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Độ phân giải:</span>
                    <span className="text-white">16:9 Standard</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold">Thời gian sinh:</span>
                    <span className="text-slate-300">
                      {new Date(selectedVariant.timestamp).toLocaleTimeString()} ({new Date(selectedVariant.timestamp).toLocaleDateString()})
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-6 border-t border-slate-800">
                {data.renderUrl === selectedVariant.url ? (
                  <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-xs py-3 rounded-xl flex items-center justify-center gap-2">
                    <Check size={14} /> ĐANG CHỌN LÀM ẢNH CHÍNH
                  </div>
                ) : (
                  <button 
                    onClick={() => handleSetActiveVariant(selectedVariant)}
                    className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black text-xs py-3 rounded-xl transition-all shadow-[0_0_15px_rgba(217,70,239,0.4)] hover:shadow-[0_0_20px_rgba(217,70,239,0.6)] flex items-center justify-center gap-1.5"
                  >
                    ✨ CHỌN LÀM PHÂN CẢNH CHÍNH
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    handleConvertToSketch();
                    setSelectedVariant(null);
                  }}
                  className="w-full bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-black text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5"
                >
                  🪄 CHUYỂN SANG SKETCH
                </button>

                <button 
                  onClick={() => setSelectedVariant(null)}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs py-2.5 rounded-xl transition-colors"
                >
                  ĐÓNG
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Handles Out */}
      <Handle type="source" position={Position.Bottom} id="out" className="w-3 h-3 bg-blue-500 border-2 border-[#121216]" />
    </div>
  );
}

export default memo(SceneNode);
