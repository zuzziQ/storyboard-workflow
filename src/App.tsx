
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  ReactFlowProvider,
} from 'reactflow';
import type { NodeTypes, DefaultEdgeOptions } from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, Upload, Play, FileText, Cpu, Wifi, ChevronDown, Check, Loader2, Film, Zap, Brain, Sparkles, ChevronLeft, ChevronRight, Settings, X } from 'lucide-react';
import { useRef, useState, useEffect, useMemo } from 'react';

import { registryNodeTypes, flowRegistry } from './features/registry';
import ScriptEditor from './features/narrative-scene/ScriptEditor';
import AssetManager from './features/narrative-scene/AssetManager';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFlowStore } from './store/useFlowStore';
import { useDnD } from './hooks/useDnD';
import { useGraphBuilder } from './hooks/useGraphBuilder';
import { useProjectStorage } from './hooks/useProjectStorage';
import TimelineStudio from './features/review-board/TimelineStudio';
import { generateExpandedShots } from './utils/generateExpandedShots';
import ShotDetailModal, { getSanitizedImageModel, getSanitizedVideoModel } from './features/shot-plan/ShotDetailModal';
import ShotPlanNode from './features/shot-plan/ShotPlanNode';
import CanvasSidebarWrapper from './components/CanvasSidebarWrapper';
import { generateMediaViaGateway } from './utils/mediaGateway';
import { getApiBaseUrl } from './utils/apiConfig';
import { PACO_DEMO_PROJECT } from './demo/pacoDemoProject';

const nodeTypes: NodeTypes = registryNodeTypes as any;

const defaultEdgeOptions: DefaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: '#94a3b8' },
  animated: false,
};

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

function removeVietnameseTones(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function safeMatchName(text: string, name: string, aliases?: string | string[]): boolean {
  const cleanText = text.toLowerCase();
  const cleanName = name.toLowerCase().trim();
  if (!cleanName) return false;
  
  const matchSingle = (word: string) => {
     const escaped = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
     const letterClass = 'a-zA-Z0-9àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđĐ_';
     const regex = new RegExp(`(^|[^${letterClass}])${escaped}([^${letterClass}]|$)`, 'i');
     return regex.test(cleanText);
  };

  if (matchSingle(cleanName)) return true;

  const noToneName = removeVietnameseTones(cleanName);
  if (matchSingle(noToneName)) return true;
  if (matchSingle(noToneName.replace(/\s+/g, '_'))) return true;

  if (aliases) {
     const list = typeof aliases === 'string'
        ? aliases.split(',').map(x => x.trim().toLowerCase()).filter(Boolean)
        : aliases.map(x => x.trim().toLowerCase()).filter(Boolean);
     for (const item of list) {
        if (matchSingle(item)) return true;
        const noToneItem = removeVietnameseTones(item);
        if (matchSingle(noToneItem)) return true;
        if (matchSingle(noToneItem.replace(/\s+/g, '_'))) return true;
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
   let defaultVal = defaultImageUrl || defaultMediaId || null;
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

function App() {
  const [hubTokenInput, setHubTokenInput] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedToken = localStorage.getItem('STORYMEE_HUB_API_KEY') || '';
      setHubTokenInput(savedToken);
    }
  }, []);

  const nodes = useFlowStore(state => state.nodes);
  const edges = useFlowStore(state => state.edges);
  const onNodesChange = useFlowStore(state => state.onNodesChange);
  const onEdgesChange = useFlowStore(state => state.onEdgesChange);
  const onConnect = useFlowStore(state => state.onConnect);
  const parsedData = useFlowStore(state => state.parsedData);
  
  const activeDetailBeat = useFlowStore(state => state.activeDetailBeat);
  const setActiveDetailBeat = useFlowStore(state => state.setActiveDetailBeat);
  const pendingShots = useFlowStore(state => state.pendingShots);
  const updateShot = useFlowStore(state => state.updateShot);
  const renderingStates = useFlowStore(state => state.renderingStates);
  const videoStates = useFlowStore(state => state.videoStates);
  const setRenderingState = useFlowStore(state => state.setRenderingState);
  const setVideoState = useFlowStore(state => state.setVideoState);

  const allCharacters = useMemo(() => {
    const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
    return worldAssetNode?.data?.characters || parsedData?.characters || [];
  }, [nodes, parsedData]);

  const allLocations = useMemo(() => {
    const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
    return worldAssetNode?.data?.locations || parsedData?.locations || [];
  }, [nodes, parsedData]);

  const runImageGenForShot = async (sh: any, modelId: string = 'auto') => {
    const shotIdVal = sh.id || sh.beat;
    const finalPromptText = sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.description || sh.diễn_tả || '';
    if (!finalPromptText) {
       alert("⚠️ Prompt của Shot này trống. Vui lòng nhập hoặc sinh prompt trước.");
       return;
    }

    const state = useFlowStore.getState();
    let activeModel = getSanitizedImageModel(modelId, state.imageProvider || 'hub');
    if (activeModel === 'auto') {
      if (state.imageProvider === 'hub') {
        activeModel = state.hubImageModel === 'auto' ? 'narwhal' : state.hubImageModel;
      } else if (state.imageProvider === 'sdk') {
        activeModel = state.sdkImageModel;
      } else if (state.imageProvider === 'dreamina') {
        activeModel = state.dreaminaImageModel;
      } else {
        activeModel = state.googleImageModel;
      }
    }

    setRenderingState(shotIdVal, "Đang vẽ...");
    
    try {
      const charRefs = sh.character_refs || sh.detectedCharacters || [];
      const matchedChars = charRefs.map((ref: string) => {
        if (!ref) return null;
        return allCharacters.find((c: any) => {
          const cName = typeof c === 'string' ? c : (c?.name || '');
          return cName.toLowerCase().trim() === ref.toLowerCase().trim();
        });
      }).filter(Boolean);

      let mediaIds: string[] = [];
      const linkedEntities: any[] = [];
      const promptLower = finalPromptText.toLowerCase();
      
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      const baseUrl = getApiBaseUrl();
      const cameraTag = detectCameraTag(promptLower, sh.angle || sh.camera_angle || sh.framing || sh.kind);
      
      for (const char of matchedChars) {
        const name = char.name;
        if (name && char.worldAssetCharId) {
           const resolvedMedia = await resolveReferencedAssetMedia(
              char.worldAssetCharId,
              cameraTag,
              char.mediaId || null,
              char.imageUrl || null,
              useRemote,
              projectData?.id || '',
              baseUrl
           );
           if (resolvedMedia) {
              mediaIds.push(resolvedMedia);
              linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
           }
        }
      }

      for (const char of allCharacters) {
        const name = (char.name || "").toLowerCase().trim();
        if (name && safeMatchName(promptLower, name, char.aliases) && char.worldAssetCharId) {
          if (linkedEntities.some(e => e.entityId === char.worldAssetCharId)) {
             continue;
          }
          const resolvedMedia = await resolveReferencedAssetMedia(
             char.worldAssetCharId,
             cameraTag,
             char.mediaId || null,
             char.imageUrl || null,
             useRemote,
             projectData?.id || '',
             baseUrl
          );
          if (resolvedMedia) {
             mediaIds.push(resolvedMedia);
             linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
          }
        }
      }

      const sceneLocName = (sh.location || sh.bối_cảnh || "").toLowerCase().trim();
      const matchedLoc = allLocations.find((loc: any) => {
        const name = (loc.name || "").toLowerCase().trim();
        if (!name) return false;
        return name === sceneLocName || name.includes(sceneLocName) || sceneLocName.includes(name) || safeMatchName(promptLower, name, loc.aliases);
      });
      if (matchedLoc && matchedLoc.worldAssetCharId) {
        if (!linkedEntities.some(e => e.entityId === matchedLoc.worldAssetCharId)) {
          const resolvedMedia = await resolveReferencedAssetMedia(
             matchedLoc.worldAssetCharId,
             cameraTag,
             matchedLoc.mediaId || null,
             matchedLoc.imageUrl || null,
             useRemote,
             projectData?.id || '',
             baseUrl
          );
          if (resolvedMedia) {
             mediaIds.push(resolvedMedia);
             linkedEntities.push({ entityId: matchedLoc.worldAssetCharId, role: 'location' });
          }
        }
      }
      console.log(`[StoryMee][Shot] Resolved reference images mediaIds (useRemote: ${useRemote}):`, mediaIds);

      let finalPrompt = finalPromptText;
      const missingNames: string[] = [];
      const primaryMatchedChars: any[] = [];
      
      matchedChars.forEach((char: any) => {
         primaryMatchedChars.push(char);
      });

      for (const char of primaryMatchedChars) {
         const name = (char.name || "").toLowerCase().trim();
         if (!safeMatchName(promptLower, name, char.aliases)) {
            missingNames.push(char.name);
         }
      }

      if (missingNames.length > 0) {
         finalPrompt += `\n**CHARACTER REFERENCES:** Ensure consistent appearance for: ${missingNames.join(', ')}.`;
      }

      const response = await generateMediaViaGateway({
        prompt: finalPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: mediaIds,
        ratio: '16:9',
        mediaType: 'image',
        linkedEntities: linkedEntities,
        ipId: activeSceneId,
        entityType: 'scene',
        videoModelKey: activeModel
      }, (status) => setRenderingState(shotIdVal, status));

      if (!response.success || !response.images || response.images.length === 0) {
        setRenderingState(shotIdVal, "Lỗi: " + (response.error || "Unknown"));
        return;
      }

      const finalUrl = response.images[0].url;
      const finalId = response.images[0].mediaId || response.images[0].id || finalUrl;

      const currentVariants = sh.variants || [];
      const newVariant = {
        url: finalUrl,
        mediaId: finalId,
        prompt: finalPrompt,
        modelId: modelId,
        timestamp: Date.now()
      };
      
      if (linkedEntities.length > 0 && finalUrl) {
         const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
         const headers: any = { 'Content-Type': 'application/json' };
         if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

         linkedEntities.forEach(ent => {
            if (ent.role === 'character') {
               const tagId = `shot_gen_${shotIdVal.toLowerCase()}_${Date.now()}`;
               fetch(`${baseUrl}/internal/v1/asset/world/orchestrator/sync-variant`, {
                  method: 'POST',
                  headers,
                  body: JSON.stringify({
                     characterId: ent.entityId,
                     tagId: tagId,
                     driveUrl: finalUrl
                  })
               }).catch(e => console.error(e));
            }
         });
      }

      let videoPromptVal = sh.videoPrompt || '';
      try {
         const { generateVideoScriptPrompt } = await import('./utils/scriptParser');
         const durationVal = sh.duration || 4;
         const res = await generateVideoScriptPrompt(finalPrompt, durationVal);
         if (res && res.videoPrompt) {
           videoPromptVal = res.videoPrompt;
         }
      } catch (e) {
         console.warn("Lỗi auto video prompt:", e);
      }

      updateShot(sh.beat || sh.id, {
        renderUrl: finalUrl,
        generatedMediaId: finalId,
        variants: [...currentVariants, newVariant],
        videoPrompt: videoPromptVal
      });
      
      setRenderingState(shotIdVal, "Xong!");
      
    } catch (err: any) {
      setRenderingState(shotIdVal, "Lỗi: " + err.message);
    }
  };

  const runVideoGenForShot = async (sh: any, videoModel: string = 'veo_3_1_r2v_lite_low_priority') => {
    const shotIdVal = sh.id || sh.beat;
    if (!sh.videoPrompt) {
      alert("⚠️ Video của Shot này chưa có Prompt. Vui lòng nhập prompt trước.");
      return;
    }

    const state = useFlowStore.getState();
    let activeModel = getSanitizedVideoModel(videoModel, state.videoProvider || 'hub');
    if (activeModel === 'auto') {
      if (state.videoProvider === 'hub') {
        activeModel = state.hubVideoModel === 'auto' || state.hubVideoModel === 'veo_3_1_r2v_lite_low_priority'
          ? 'veo_3_1_r2v_lite_low_priority' 
          : state.hubVideoModel;
      } else if (state.videoProvider === 'sdk') {
        activeModel = state.sdkVideoModel;
      } else if (state.videoProvider === 'dreamina') {
        activeModel = state.dreaminaVideoModel;
      } else {
        activeModel = state.googleVideoModel;
      }
    }

    setVideoState(shotIdVal, "Đang dựng...");

    try {
      let mediaIds: string[] = [];
      const storyboardUrl = sh.renderUrl || sh.imageUrl;
      if (storyboardUrl) {
         mediaIds.push(storyboardUrl);
      }

      const charRefs = sh.character_refs || sh.detectedCharacters || [];
      const matchedChars = charRefs.map((ref: string) => {
        if (!ref) return null;
        return allCharacters.find((c: any) => {
          const cName = typeof c === 'string' ? c : (c?.name || '');
          return cName.toLowerCase().trim() === ref.toLowerCase().trim();
        });
      }).filter(Boolean);

      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      matchedChars.forEach((char: any) => {
         const resolvedMedia = (char.mediaId && char.mediaId.startsWith('http')) ? char.mediaId : (char.imageUrl || char.rootImageUrl || null);
         if (resolvedMedia) mediaIds.push(resolvedMedia);
      });

      mediaIds = Array.from(new Set(mediaIds));

      const response = await generateMediaViaGateway({
        prompt: sh.videoPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: mediaIds,
        ratio: '16:9',
        mediaType: 'video',
        videoModelKey: activeModel,
        ipId: activeSceneId,
        entityType: 'scene',
        storyboardFrameUrl: storyboardUrl,
        duration: `${sh.duration || 4}s`
      }, (status) => setVideoState(shotIdVal, status));

      const videoUrl = response.url || (response.images && response.images[0]?.url);

      if (!response.success || !videoUrl) {
        setVideoState(shotIdVal, "Lỗi: " + (response.error || "Unknown"));
        return;
      }

      setVideoState(shotIdVal, "Hoàn thành!");

      updateShot(shotIdVal, {
        videoUrl: videoUrl,
        video_url: videoUrl,
        renderVideoUrl: videoUrl
      });
    } catch (error: any) {
      console.error("[runVideoGenForShot] Error:", error);
      setVideoState(shotIdVal, "Lỗi: " + error.message);
    }
  };
  const isAnalyzing = useFlowStore(state => state.isAnalyzing);
  const isDrawerOpen = useFlowStore(state => state.isDrawerOpen);
  const setIsDrawerOpen = useFlowStore(state => state.setIsDrawerOpen);
  const projectData = useFlowStore(state => state.projectData);
  const setProjectData = useFlowStore(state => state.setProjectData);
  const activeSceneId = useFlowStore(state => state.activeSceneId);
  const setActiveSceneId = useFlowStore(state => state.setActiveSceneId);
  const buildMode = useFlowStore(state => state.buildMode);

  const showRuleBoard = useFlowStore(state => state.showRuleBoard);
  const setShowRuleBoard = useFlowStore(state => state.setShowRuleBoard);
  const customProjectRules = useFlowStore(state => state.customProjectRules || []);
  const customEpisodeRules = useFlowStore(state => state.customEpisodeRules || []);
  const updateGlobalSettings = useFlowStore(state => state.updateGlobalSettings);
  const [ruleBoardTab, setRuleBoardTab] = useState<'global' | 'templates' | 'budget' | 'flags' | 'project'>('global');
  const [newRule, setNewRule] = useState('');
  const [ruleType, setRuleType] = useState<'project' | 'episode'>('project');

  const isRightDrawerCollapsed = useFlowStore(state => state.isRightDrawerCollapsed);
  const setIsRightDrawerCollapsed = useFlowStore(state => state.setIsRightDrawerCollapsed);

  // Sync left drawer toggle with right drawer activeSceneId
  useEffect(() => {
    if (activeSceneId !== 'all') {
      setIsDrawerOpen(false);
      setIsRightDrawerCollapsed(false);
    } else {
      setIsDrawerOpen(true);
    }
  }, [activeSceneId, setIsDrawerOpen]);

  // ── Scene Tab Filtering ───────────────────────────────────────────────────
  // Extract unique scene groups from nodes that have a sceneGroupId
  const sceneGroups = useMemo(() => {
    const groups: { id: string; label: string }[] = [];
    const seenGroups = new Set<string>();
    nodes.forEach((n: any) => {
      const gid: string | undefined = n.data?.sceneGroupId;
      if (gid && !seenGroups.has(gid)) {
        seenGroups.add(gid);
        groups.push({ id: gid, label: gid });
      }
    });
    return groups;
  }, [nodes]);

  // Nodes to render: always keep WorldAsset + ReviewBoard + EmotionArc + (scene column if filtered)
  const filteredNodes = useMemo(() => {
    const ALWAYS_VISIBLE = new Set(['world-asset-main', 'review-board-main', 'emotion-arc-main', 'scene-master', 'video-master']);
    const allowedNodeTypes = new Set(['worldAssetNode', 'emotionArcNode', 'sceneNode', 'reviewBoardNode']);
    return (activeSceneId === 'all'
      ? nodes
      : nodes.filter((n: any) => ALWAYS_VISIBLE.has(n.id) || n.type === 'sceneNode' || isSameScene(n.data?.sceneGroupId, activeSceneId))
    ).filter((n: any) => allowedNodeTypes.has(n.type || ''));
  }, [nodes, activeSceneId]);

  const filteredEdges = useMemo(() => {
    const filteredNodeIds = new Set(filteredNodes.map((n: any) => n.id));
    return edges.filter((e: any) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target));
  }, [edges, filteredNodes]);

  const [activeTab, setActiveTab] = useState<'canvas' | 'timeline'>('canvas');
  const [isImportShotlistModalOpen, setIsImportShotlistModalOpen] = useState<boolean>(false);

  const [useRemoteWorker, setUseRemoteWorker] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const extId = localStorage.getItem('STORYMEE_EXT_ID');
      // Nếu chưa cấu hình extension ID cá nhân (hoặc đang dùng ID mặc định/placeholder), tự động kích hoạt Cloud Worker
      if (!extId || extId === 'kplobceepifjljflggclppfagndnnech' || extId === 'sk-extension-default') {
        localStorage.setItem('STORYMEE_USE_REMOTE_WORKER', 'true');
        return true;
      }
      
      const saved = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER');
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return true;
  });
  const [extId, setExtId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('STORYMEE_EXT_ID') || 'kplobceepifjljflggclppfagndnnech';
    }
    return 'kplobceepifjljflggclppfagndnnech';
  });
  const [isExtConnected, setIsExtConnected] = useState<boolean>(false);
  const [isWorkerDropdownOpen, setIsWorkerDropdownOpen] = useState<boolean>(false);

  useEffect(() => {
    const checkExt = () => {
      if ((window as any).chrome?.runtime && extId) {
        try {
          (window as any).chrome.runtime.sendMessage(extId, { action: "PING" }, (res: any) => {
            const lastErr = (window as any).chrome.runtime.lastError;
            if (!lastErr && (res?.status === "PONG" || res)) {
              setIsExtConnected(true);
            } else {
              try {
                (window as any).chrome.runtime.sendMessage(extId, { action: "GET_GOOGLE_LABS_TOKEN" }, () => {
                  const fallbackErr = (window as any).chrome.runtime.lastError;
                  if (fallbackErr) {
                    setIsExtConnected(false);
                  } else {
                    setIsExtConnected(true);
                  }
                });
              } catch {
                setIsExtConnected(false);
              }
            }
          });
        } catch (e) {
          setIsExtConnected(false);
        }
      } else {
        setIsExtConnected(false);
      }
    };
    checkExt();
    const interval = setInterval(checkExt, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, [extId]);

  const handleToggleWorker = (remote: boolean) => {
    setUseRemoteWorker(remote);
    localStorage.setItem('STORYMEE_USE_REMOTE_WORKER', remote ? 'true' : 'false');
    setIsWorkerDropdownOpen(false);
  };

  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Auto hydration from deep-link parameters ?projectId=...&episodeId=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const projectId = params.get('projectId');
    const episodeId = params.get('episodeId');

    if (projectId && episodeId) {
      console.log(`[AutoHydrate] Found query parameters: projectId=${projectId}, episodeId=${episodeId}. Starting DB sync...`);
      import('./services/api').then(async ({ fetchStoryboardAssetsFromDB }) => {
        try {
          const data = await fetchStoryboardAssetsFromDB(episodeId);
          if (data && data.episode) {
            const ep = data.episode;
            // Cập nhật project data
            setProjectData({
              id: ep.id,
              name: ep.title,
              selectedUniverseId: projectId,
              selectedProjectId: projectId,
              stylePrompt: projectData.stylePrompt
            });

            // Ghi nhận kịch bản, nhân vật, bối cảnh và shots vào editor
            const savedShots = ep.meta && typeof ep.meta === 'object' ? (ep.meta as any).shots || [] : [];
            const parsed = {
              scriptText: ep.script || "",
              scenes: ep.scenes || [],
              characters: data.characters || [],
              locations: data.locations || [],
              shots: savedShots
            };
            useFlowStore.getState().setParsedData(parsed);
            if (savedShots.length > 0) {
              useFlowStore.getState().setPendingShots(savedShots);
            }

            // Kiểm tra xem Episode có canvas state đã lưu trước đó không
            const savedCanvasState = ep.meta && typeof ep.meta === 'object' ? (ep.meta as any).canvasState : null;

            if (savedCanvasState && Array.isArray(savedCanvasState.nodes)) {
              console.log("[AutoHydrate] Found saved canvasState inside Episode meta! Restoring canvas layout...");
              useFlowStore.getState().setNodes(savedCanvasState.nodes);
              useFlowStore.getState().setEdges(savedCanvasState.edges || []);
            } else {
              // Tự động dựng các SceneNode và CharacterNode/LocationNode nếu chưa có Node nào
              const currentNodes = useFlowStore.getState().nodes;
              if (currentNodes.length === 0 && ep.scenes && ep.scenes.length > 0) {
                const newNodes: any[] = [];
                const newEdges: any[] = [];

                // Tạo World Asset Node (Bridge) làm node gốc tích hợp Project
                const worldAssetNodeId = 'world-asset-main';
                newNodes.push({
                  id: worldAssetNodeId,
                  type: 'worldAssetNode',
                  position: { x: 100, y: 50 },
                  data: { name: 'World Asset Bridge' }
                });

                // Sinh các SceneNode nối đuôi nhau theo hàng ngang
                ep.scenes.forEach((scene: any, idx: number) => {
                  const sceneNodeId = `scene-${scene.id || idx}`;
                  newNodes.push({
                    id: sceneNodeId,
                    type: 'sceneNode',
                    position: { x: 450 + idx * 320, y: 1100 },
                    data: {
                      sceneId: `Cảnh ${scene.sceneNumber || idx + 1}`,
                      location: scene.title || '',
                      timeOfDay: 'Day',
                      storyboardPrompt: scene.prompt || '',
                      physicalCharacteristics: scene.description || '',
                      renderUrl: scene.imageUrl || null
                    }
                  });

                  // Nối Edge trực tiếp từ World Asset Bridge -> từng Scene Node theo cấu trúc
                  newEdges.push({
                    id: `edge-worldasset-to-${sceneNodeId}`,
                    source: worldAssetNodeId,
                    target: sceneNodeId,
                    type: 'smoothstep',
                    animated: false
                  });
                });

                useFlowStore.getState().setNodes(newNodes);
                useFlowStore.getState().setEdges(newEdges);
                console.log(`[AutoHydrate] Successfully generated ${ep.scenes.length} SceneNodes on Canvas!`);
              }
            }
          }
        } catch (e: any) {
          console.error("[AutoHydrate] Error loading episode details:", e.message);
        }
      });
    }
  }, []);

  const handleSyncToDB = async () => {
    const universeId = projectData.selectedProjectId || projectData.selectedUniverseId;
    const episodeId = projectData.id;

    if (!universeId || episodeId === 'new') {
      alert("⚠️ Dự án Storyboard này chưa được liên kết với World Asset DB!\nVui lòng truy cập qua link deep-link của World Asset để kích hoạt liên kết tự động.");
      return;
    }

    setIsSyncing(true);
    try {
      let scenesPayload = [];
      const currentShots = parsedData?.shots || [];
      if (currentShots.length > 0) {
        scenesPayload = currentShots.map((sh, idx) => {
          return {
            sceneNumber: idx + 1,
            title: sh.location || sh.bối_cảnh || `Shot ${idx + 1}`,
            description: sh.description || sh.diễn_tả || '',
            prompt: sh.visual || sh.hình_ảnh || sh.storyboardPrompt || '',
            imageUrl: sh.renderUrl || sh.imageUrl || null,
            tags: sh.character_refs || sh.characterIds || []
          };
        });
      } else {
        const sceneNodes = nodes.filter(n => n.type === 'sceneNode');
        const sortedScenes = [...sceneNodes].sort((a, b) => {
          const aId = parseInt(a.data?.sceneId?.replace(/\D/g, '') || '0');
          const bId = parseInt(b.data?.sceneId?.replace(/\D/g, '') || '0');
          if (aId !== bId) return aId - bId;
          return a.position.x - b.position.x;
        });

        scenesPayload = sortedScenes.map((node, idx) => {
          const d = node.data || {};
          return {
            sceneNumber: idx + 1,
            title: d.location || `Scene ${idx + 1}`,
            description: d.physicalCharacteristics || '',
            prompt: d.storyboardPrompt || '',
            imageUrl: d.renderUrl || null,
            tags: d.tags || []
          };
        });
      }

      // Tạo canvasState đóng gói các nodes và edges hiện tại
      const canvasState = {
        nodes,
        edges
      };

      const pendingShots = useFlowStore.getState().pendingShots || [];
      const shotsPayload = pendingShots.map((sh: any) => ({
        sceneNumber: sh.sceneNumber || sh.scene_number || 1,
        shotNumber: sh.shotNumber || sh.shot_number || 0,
        description: sh.description || sh.diễn_tả || '',
        prompt: sh.visual || sh.hình_ảnh || sh.storyboardPrompt || '',
        imageUrl: sh.renderUrl || sh.imageUrl || null,
        videoUrl: sh.videoUrl || null
      }));

      const { syncEpisodeToDB } = await import('./services/api');
      await syncEpisodeToDB({
        universeId,
        title: projectData.name,
        scriptText: parsedData?.scriptText || '',
        scenes: scenesPayload,
        shots: shotsPayload,
        gflowProjectId: projectData.id,
        canvasState
      });

      alert("🎉 ĐỒNG BỘ THÀNH CÔNG!\n\nToàn bộ kịch bản, phân cảnh và bố cục Canvas đã được ghi đè trực tiếp vào PostgreSQL DB chung. Các thay đổi đã xuất hiện bên World Asset Management!");
    } catch (e: any) {
      alert(`⚠️ Đồng bộ thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  
  const { reactFlowInstance, setReactFlowInstance, onDragStart, onDragOver, onDrop } = useDnD();
  const { handleExport, handleImport } = useProjectStorage();
  const { handleAnalyze, handleBuildStoryboard, isBuildingStoryboard, buildingStage, handleImportEpisode, isAnalyzingEmotion, handleAnalyzeImportedScriptEmotion, handleRefreshAssets } = useGraphBuilder();

  // Tự động khớp lại assets khi liên kết/thay đổi dự án World Asset
  useEffect(() => {
    const activeProjId = projectData.selectedProjectId || projectData.selectedUniverseId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (activeProjId && uuidRegex.test(activeProjId)) {
      console.log(`[App] Auto-refreshing assets for project: ${activeProjId}`);
      handleRefreshAssets(activeProjId);
    }
  }, [projectData.selectedProjectId, projectData.selectedUniverseId]);

  // Sanitize hydrated edges to disable animation by default (GPU optimization)
  useEffect(() => {
    const store = useFlowStore.getState();
    const hasAnimatedEdges = store.edges.some(e => e.animated);
    if (hasAnimatedEdges) {
      console.log("[App] Disabling animated edges from persisted storage to optimize GPU...");
      const sanitized = store.edges.map(e => e.animated ? { ...e, animated: false } : e);
      store.setEdges(sanitized);
    }
  }, []);

  const handleLoadDemoProject = () => {
    const store = useFlowStore.getState();
    store.setNodes(PACO_DEMO_PROJECT.nodes);
    store.setEdges(PACO_DEMO_PROJECT.edges);
    store.setParsedData(PACO_DEMO_PROJECT.parsedData);
    store.setPendingShots(PACO_DEMO_PROJECT.parsedData.shots || []);
    store.setProjectData(PACO_DEMO_PROJECT.projectData);
    store.setActiveSceneId('all');
    store.setIsDrawerOpen(false);
    store.setIsRightDrawerCollapsed(false);
    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.15, duration: 600 });
    }, 200);
  };

  // Auto-seed Paco Showcase Demo if canvas is empty or demo project is missing pending shots
  useEffect(() => {
    const store = useFlowStore.getState();
    const isDemo = store.projectData?.id === 'paco-showcase-demo';
    const hasNoNodes = !store.nodes || store.nodes.length === 0;
    const hasNoShots = !store.pendingShots || store.pendingShots.length === 0;
    const scene1Node = store.nodes?.find(n => n.id === 'scene-1');
    const demoNeedsUpgrade = isDemo && (!scene1Node?.data?.renderUrl || hasNoShots);

    if (hasNoNodes || demoNeedsUpgrade) {
      console.log("[App] Auto-seeding Paco Showcase Demo Project for visitors...");
      handleLoadDemoProject();
    }
  }, []);

  const triggerAutoGFlow = () => {
    alert("🚀 TÍNH NĂNG CHẠY TỰ ĐỘNG ĐÃ BỊ TẮT!\n\nTheo kiến trúc mới, vui lòng bấm chạy thủ công trên từng Node để kiểm soát dữ liệu chính xác nhất!");
  };

  const handleExportScript = () => {
    const sceneNodes = nodes.filter(n => n.type === 'sceneNode');
    if (sceneNodes.length === 0) {
      alert("Không tìm thấy phân cảnh kịch bản (Scene Node) nào trên Canvas để xuất!");
      return;
    }
    
    const sortedScenes = [...sceneNodes].sort((a, b) => {
      const aId = parseInt(a.data?.sceneId?.replace(/\D/g, '') || '0');
      const bId = parseInt(b.data?.sceneId?.replace(/\D/g, '') || '0');
      if (aId !== bId) return aId - bId;
      return a.position.x - b.position.x;
    });

    let scriptContent = `================================================================\n`;
    scriptContent += `KỊCH BẢN PHÂN CẢNH TRỰC QUAN (VISUAL STORYBOARD SCRIPT)\n`;
    scriptContent += `DỰ ÁN: ${projectData.name || 'Chưa đặt tên'}\n`;
    scriptContent += `GOOGLE LABS PROJECT ID: ${projectData.id === 'new' ? 'Chưa liên kết' : projectData.id}\n`;
    scriptContent += `TỔNG SỐ PHÂN CẢNH: ${sortedScenes.length}\n`;
    scriptContent += `================================================================\n\n`;

    sortedScenes.forEach((node, idx) => {
      const d = node.data || {};
      scriptContent += `[PHÂN CẢNH ${idx + 1}] 🎬\n`;
      scriptContent += `MÃ SỐ: ${d.sceneId || `Scene-${idx + 1}`}\n`;
      scriptContent += `BỐI CẢNH (LOCATION): ${d.location || 'Chưa xác định'}\n`;
      scriptContent += `THỜI GIAN (TIME OF DAY): ${d.timeOfDay || 'Chưa xác định'}\n`;
      scriptContent += `MÔ TẢ CHI TIẾT & HÀNH ĐỘNG (STORYBOARD PROMPT):\n`;
      scriptContent += `${d.storyboardPrompt || d.physicalCharacteristics || '(Trống)'}\n`;
      if (d.renderUrl) {
        scriptContent += `ẢNH PHÁC HỌA LIÊN KẾT: ${d.renderUrl}\n`;
      }
      scriptContent += `\n----------------------------------------------------------------\n\n`;
    });

    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectData.name || 'du-an'}-kich-ban.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAutoLayout = () => {
    const currentNodes = useFlowStore.getState().nodes;
    if (currentNodes.length === 0) {
      alert("⚠️ Không có node nào trên canvas để sắp xếp!");
      return;
    }
    
    // Sort scene nodes by scene number to maintain order
    const sceneNodes = currentNodes.filter(n => n.type === 'sceneNode');
    
    // Sort scenes by sceneId/sceneNumber
    const sortedScenes = [...sceneNodes].sort((a, b) => {
      const aId = parseInt(a.data?.sceneId?.replace(/\D/g, '') || '0', 10);
      const bId = parseInt(b.data?.sceneId?.replace(/\D/g, '') || '0', 10);
      if (aId !== bId) return aId - bId;
      return a.position.x - b.position.x;
    });

    const nextNodes = currentNodes.map(node => {
      // 1. World Asset Node
      if (node.type === 'worldAssetNode') {
        return { ...node, position: { x: 50, y: 50 } };
      }
      // 2. Emotion Arc Node
      if (node.type === 'emotionArcNode') {
        return { ...node, position: { x: 50, y: 720 } };
      }
      // 3. Narrative Scene Nodes (placed side-by-side in pipeline)
      if (node.type === 'sceneNode') {
        const sceneIndex = sortedScenes.findIndex(s => s.id === node.id);
        const idx = sceneIndex !== -1 ? sceneIndex : 0;
        return { ...node, position: { x: 620 + idx * 400, y: 50 } };
      }
      // 4. Review Board Node
      if (node.type === 'reviewBoardNode') {
        const xPos = 620 + Math.max(sortedScenes.length, 1) * 400;
        return { ...node, position: { x: xPos, y: 50 } };
      }
      return node;
    });

    useFlowStore.getState().setNodes(nextNodes);
    setTimeout(() => {
      reactFlowInstance?.fitView({ padding: 0.15, duration: 600 });
    }, 100);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-6 py-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md z-40 relative">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold shadow-lg shadow-purple-500/20">F</div>
          <div>
            <input 
               type="text" 
               value={projectData.name} 
               onChange={(e) => setProjectData({...projectData, name: e.target.value})}
               className="text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-700 focus:border-purple-500 outline-none text-white transition-all w-64 px-1 -ml-1 rounded"
               placeholder="Project Name..."
               title="Click to rename project"
            />
            <div className="flex items-center text-[10px] text-slate-400 font-semibold tracking-wide gap-3">
               <div>
                 <span className="uppercase tracking-widest text-indigo-400">Labs ID:</span>
                 <span className="ml-2 font-mono bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">
                   {projectData.id === 'new' ? 'Auto-generated on render' : projectData.id}
                 </span>
                 {projectData.id !== 'new' && (
                    <button 
                      onClick={() => setProjectData({...projectData, id: 'new'})} 
                      className="ml-2 hover:text-red-400 text-slate-500 bg-slate-800/50 hover:bg-slate-800 px-1.5 py-0.5 rounded transition-colors" 
                      title="Reset to create a new project"
                    >
                      Disconnect
                    </button>
                 )}
               </div>
               <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/20 font-bold uppercase tracking-wider">
                 Pipeline Flow
               </span>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex bg-slate-950/60 p-1 rounded-xl border border-slate-800 ml-4">
            <button 
              onClick={() => setActiveTab('canvas')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'canvas' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Interactive Canvas
            </button>
            <button 
              onClick={() => setActiveTab('timeline')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'timeline' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Lite Timeline Studio
            </button>

          </div>
        </div>
        <div className="flex gap-3 items-center">
          {(projectData.selectedProjectId || projectData.selectedUniverseId) && projectData.id !== 'new' && (
            <button 
              onClick={handleSyncToDB}
              disabled={isSyncing}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-lg shadow-emerald-500/25 active:scale-95 border border-emerald-500/30 disabled:opacity-50"
              title="Đồng bộ toàn bộ kịch bản và scenes trên Canvas về World Asset DB chung (PostgreSQL)"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đồng bộ...
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-300" /> Sync to DB
                </>
              )}
            </button>
          )}

          <button 
            onClick={handleLoadDemoProject}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white px-3.5 py-2 rounded-lg font-bold text-xs transition-all shadow-lg shadow-purple-500/25 active:scale-95 cursor-pointer border border-purple-400/40"
            title="Tải ngay dự án mẫu Paco hoàn chỉnh để người xem portfolio trải nghiệm toàn bộ hệ thống"
          >
            <Sparkles size={14} className="text-yellow-300 animate-spin" style={{ animationDuration: '3s' }} />
            <span>✨ Demo Showcase</span>
          </button>

          {/* Export / Import Project File (.storymee) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
            <button
              onClick={handleExport}
              className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
              title="Xuất dự án ra file .storymee để lưu hoặc chia sẻ"
            >
              <Download size={13} />
              <span>Lưu</span>
            </button>
            <label
              className="px-2.5 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all border-l border-slate-800"
              title="Nhập file .storymee từ máy tính"
            >
              <Upload size={13} />
              <span>Nạp</span>
              <input type="file" accept=".storymee,.json" onChange={handleImport} className="hidden" />
            </label>
          </div>

          <button 
            onClick={handleAutoLayout}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all shadow-md shadow-amber-500/10 active:scale-95 cursor-pointer"
            title="Tự động sắp xếp vị trí các Node trên sơ đồ tránh đè chồng"
          >
            <Zap size={14} /> Auto Layout
          </button>


          <button 
            onClick={() => setShowRuleBoard(true)}
            className="flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-650 text-indigo-300 hover:text-white px-4 py-2 rounded-lg font-bold text-xs transition-all border border-indigo-500/30 shadow-sm active:scale-95 cursor-pointer"
            title="Xem bảng quy tắc thiết kế prompt chuẩn Seedance 2.0"
          >
            📖 Quy tắc Prompt
          </button>

          {/* Quick Hub Access Token Input */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Hub Token:</span>
            <input
              type="password"
              value={hubTokenInput}
              onChange={(e) => {
                const val = e.target.value;
                setHubTokenInput(val);
                localStorage.setItem('STORYMEE_HUB_API_KEY', val);
                useFlowStore.getState().updateGlobalSettings({ hubApiKey: val });
              }}
              placeholder="sk-hub-..."
              className="bg-[#090d16] border border-[#334155]/40 text-white placeholder-slate-700 rounded px-2 py-1 text-xs outline-none w-28 font-mono focus:border-indigo-500 focus:w-40 transition-all"
              title="Nhập và lưu STORYMEE_HUB_API_KEY để khắc phục lỗi 401 khi gọi AI Copilot"
            />
          </div>

          <button 
            onClick={() => useFlowStore.getState().setIsSettingOpen(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-2 rounded-lg font-bold text-xs transition-all border border-slate-700 shadow-sm active:scale-95 cursor-pointer"
            title="Cấu hình hệ thống chi tiết (Settings)"
          >
            <Settings size={14} />
            <span>Cấu hình</span>
          </button>

          {/* Grid Worker Selector */}
          <div className="relative">
            <button 
              onClick={() => setIsWorkerDropdownOpen(!isWorkerDropdownOpen)}
              className="flex items-center gap-2.5 bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all border border-slate-800 shadow-md active:scale-95 flex items-center justify-between"
            >
              <div className="relative flex h-2.5 w-2.5">
                {(useRemoteWorker || isExtConnected) ? (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_8px_#34d399]"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                )}
              </div>
              <div className="text-left leading-none">
                <span className="text-[8px] text-indigo-400 uppercase font-black tracking-wider block">Grid Worker</span>
                <span className="text-[11px] font-bold text-slate-100 mt-0.5 block">
                  {useRemoteWorker ? 'Cloud Worker (VPS Grid)' : 'Local Worker (Chrome Ext)'}
                </span>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ml-1 ${isWorkerDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isWorkerDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 border border-slate-800 rounded-2xl shadow-2xl z-50 p-2 space-y-1 backdrop-blur-md bg-[#0b0f19]/95">
                <div className="px-3 py-1.5 text-[9px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800/60 mb-1">
                  Chọn AI Worker Đang Hoạt Động
                </div>
                
                {/* Option 1: Local Worker */}
                <button
                  onClick={() => handleToggleWorker(false)}
                  className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-colors ${!useRemoteWorker ? 'bg-indigo-600/10 text-white border border-indigo-500/20' : 'hover:bg-slate-850 text-slate-400 hover:text-white'}`}
                >
                  <div className="flex items-center gap-2">
                    <Cpu size={14} className={!useRemoteWorker ? 'text-indigo-400' : 'text-slate-500'} />
                    <div className="text-left">
                      <span className="text-xs font-bold block leading-none">Local Chrome Extension</span>
                      <span className="text-[9px] text-slate-500 mt-1 block leading-tight">
                        {isExtConnected ? '🟢 Đã kết nối • Hoạt động' : '🟡 Chưa mở extension hoặc sai ID'}
                      </span>
                    </div>
                  </div>
                  {!useRemoteWorker && <Check size={14} className="text-indigo-400" />}
                </button>

                {/* Option 2: Cloud Worker */}
                <button
                  onClick={() => handleToggleWorker(true)}
                  className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-colors ${useRemoteWorker ? 'bg-indigo-600/10 text-white border border-indigo-500/20' : 'hover:bg-slate-850 text-slate-400 hover:text-white'}`}
                >
                  <div className="flex items-center gap-2">
                    <Wifi size={14} className={useRemoteWorker ? 'text-indigo-400' : 'text-slate-500'} />
                    <div className="text-left">
                      <span className="text-xs font-bold block leading-none">VPS Cloud Grid Worker</span>
                      <span className="text-[9px] text-emerald-400 mt-1 block font-semibold animate-pulse leading-tight">🟢 Hoạt động qua Cổng API</span>
                    </div>
                  </div>
                  {useRemoteWorker && <Check size={14} className="text-indigo-400" />}
                </button>

                {/* Edit Extension ID Link */}
                <div className="border-t border-slate-800/60 pt-1.5 mt-1 px-2.5 pb-1 flex items-center justify-between text-[10px] text-slate-500">
                  <span>Extension ID:</span>
                  <button 
                    onClick={() => {
                      const newId = prompt("Nhập Extension ID (chrome://extensions):", extId);
                      if (newId) {
                        localStorage.setItem("STORYMEE_EXT_ID", newId.trim());
                        setExtId(newId.trim());
                      }
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold underline ml-1 truncate max-w-[120px]"
                    title={extId}
                  >
                    {extId.substring(0, 10)}...
                  </button>
                </div>
              </div>
            )}
          </div>
          <button 
            onClick={() => useFlowStore.getState().setIsRightDrawerCollapsed(!isRightDrawerCollapsed)} 
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all border cursor-pointer active:scale-95 ${
              !isRightDrawerCollapsed 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-400/60 shadow-lg shadow-indigo-500/25' 
                : 'bg-slate-850 hover:bg-slate-800 text-slate-300 hover:text-white border-slate-700'
            }`}
            title="Mở hoặc thu gọn bảng chi tiết Shot (Shot Plan Drawer)"
          >
            <Film size={15} />
            <span>🎬 Bảng Shot</span>
          </button>
        </div>
      </header>

      {/* Main Area: Toolbox + Canvas + Drawer */}
      <div className="flex-1 w-full relative flex h-[calc(100vh-73px)] overflow-hidden">
        
        {activeTab === 'canvas' ? (
          <ReactFlowProvider>
            {/* Floating Toolbox (Modern Pill Design) */}
            <Sidebar onDragStart={onDragStart} />

            {/* Floating Drawer (Script Editor & Asset Manager) */}
            <div 
              className={`absolute left-24 top-6 bottom-6 max-w-[calc(100vw-120px)] rounded-2xl z-40 flex flex-col bg-[#111118]/95 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] transition-all duration-300 ease-in-out border border-slate-700/80 overflow-hidden ${isDrawerOpen ? 'translate-x-0 opacity-100 pointer-events-auto' : '-translate-x-full opacity-0 pointer-events-none'}`}
            >
              {/* Drawer Top Header with Title and Explicit Close Button */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-[#161622]/90 select-none">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">Kịch Bản & Quản Lý Tài Sản (Script & Assets)</span>
                </div>
                <button
                  onClick={() => useFlowStore.getState().setIsDrawerOpen(false)}
                  className="p-1 px-2.5 rounded-xl bg-slate-800/80 hover:bg-rose-600/80 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-700/50 flex items-center gap-1.5 text-xs font-bold"
                  title="Đóng bảng kịch bản"
                >
                  <X size={14} />
                  <span>Đóng</span>
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 flex overflow-hidden">
                <ScriptEditor 
                  onAnalyze={handleAnalyze} 
                  isLoading={isAnalyzing} 
                  externalScript={parsedData?.scriptText} 
                  onImportEpisode={handleImportEpisode}
                  onBuildStoryboard={handleBuildStoryboard}
                />
                <AssetManager 
                  parsedData={parsedData} 
                  onBuildStoryboard={handleBuildStoryboard} 
                  isBuilding={isBuildingStoryboard}
                  buildingStage={buildingStage}
                />
              </div>
            </div>

            {/* React Flow Canvas (Main Workspace) */}
            <div 
              className={`flex-1 relative reactflow-wrapper z-10 flex flex-col transition-all duration-300 ease-in-out ${
                (!isRightDrawerCollapsed) ? 'pr-[55vw] min-[1364px]:pr-[min(55vw,1050px)] min-[1000px]:pr-[650px]' : ''
              }`}
              ref={reactFlowWrapper}
            >

              {/* ── Scene Tab Bar ─────────────────────────────────────────── */}
              {sceneGroups.length > 1 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-[#1a1a20]/90 border border-slate-700/70 rounded-2xl px-2 py-1.5 shadow-xl backdrop-blur-md">
                  <button
                    onClick={() => setActiveSceneId('all')}
                    className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wide transition-all ${
                      activeSceneId === 'all'
                        ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)]'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    All ({nodes.length})
                  </button>
                  {sceneGroups.map((sg, i) => {
                    const shotCount = nodes.filter((n: any) => isSameScene(n.data?.sceneGroupId, sg.id) && n.type === 'sceneNode' && !n.data?.isNarrativeScene && !n.data?.scenes).length;
                    const isActive = isSameScene(activeSceneId, sg.id);
                    return (
                      <button
                        key={sg.id}
                        onClick={() => setActiveSceneId(sg.id)}
                        className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-wide transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-fuchsia-600 text-white shadow-[0_0_12px_rgba(217,70,239,0.5)]'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title={`Chỉ hiện ${sg.label}`}
                      >
                        Scene {i + 1}
                        {shotCount > 0 && (
                          <span className={`ml-1 text-[8px] px-1 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-700'}`}>
                            {shotCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {filteredNodes.length === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none p-4">
                  <div className="bg-slate-900/95 backdrop-blur-2xl border border-indigo-500/30 rounded-2xl p-8 max-w-md text-center shadow-2xl pointer-events-auto space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="w-16 h-16 bg-gradient-to-tr from-purple-500 via-pink-500 to-indigo-500 rounded-2xl mx-auto flex items-center justify-center shadow-xl shadow-purple-500/30">
                      <Sparkles className="w-8 h-8 text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white tracking-wide">Trải Nghiệm Flow Architect</h3>
                      <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                        Hệ thống tự động hóa kịch bản thành Storyboard, World Asset DNA và phân rã Shot hình điện ảnh.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2.5 pt-2">
                      <button
                        onClick={handleLoadDemoProject}
                        className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 hover:from-purple-500 hover:via-pink-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-xl shadow-purple-500/30 active:scale-95 cursor-pointer border border-purple-400/40"
                      >
                        <Sparkles size={14} className="text-yellow-300" />
                        <span>Tải Dự Án Mẫu (Demo Showcase)</span>
                      </button>
                      <span className="text-[10px] text-slate-500">Hoặc mở Drawer góc trái để viết kịch bản từ đầu</span>
                    </div>
                  </div>
                </div>
              )}

              <ErrorBoundary fallbackTitle="Lỗi Sơ Đồ Canvas (React Flow)">
                <ReactFlow
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  onInit={setReactFlowInstance}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  nodeTypes={nodeTypes}
                  defaultEdgeOptions={defaultEdgeOptions}
                  fitView
                  onlyRenderVisibleElements={true}
                  className="dark bg-[#0f0f13]"
                >
                  <Controls className="bg-slate-800 border-slate-700 fill-slate-300" />
                  <MiniMap 
                    className="bg-[#1e1e24] border-slate-800" 
                    maskColor="rgba(15, 23, 42, 0.8)"
                    nodeColor={(n) => {
                      if (n.type === 'omniNode') return '#9333ea';
                      if (n.type === 'sceneNode') return '#3b82f6';
                      if (n.type === 'characterNode') return '#10b981';
                      if (n.type === 'locationNode') return '#f97316';
                      return '#475569';
                    }}
                  />
                  <Background gap={24} size={2} color="#1e1e24" />
                </ReactFlow>
              </ErrorBoundary>
            </div>

            <CanvasSidebarWrapper>
              <ShotPlanNode />
            </CanvasSidebarWrapper>
          </ReactFlowProvider>
        ) : (
          <TimelineStudio />
        )}
      </div>
      <SettingsModal />

      {showRuleBoard && (
        <div className="fixed inset-0 z-[10060] flex items-center justify-center p-4 bg-slate-955/95 backdrop-blur-md animate-in fade-in duration-200 text-left">
          <div className="bg-[#101014] border border-indigo-500/30 rounded-3xl w-full max-w-[850px] h-[75vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(99,102,241,0.25)] text-slate-100">
            
            {/* Header */}
            <div className="px-6 py-4 bg-[#181820] border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Film size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-wider">Bảng Quy Tắc Viết Prompt (Seedance 2.0 Spec)</h4>
                  <p className="text-[10px] text-slate-400">Trích xuất và đối chiếu raccord chuẩn từ AI Film Shotlist Addendum v005</p>
                </div>
              </div>
              <button
                onClick={() => setShowRuleBoard(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-800"
              >
                <span className="text-xs font-bold font-mono">X</span>
              </button>
            </div>

            {/* Tabs Selector */}
            <div className="flex bg-[#0a0a0d] px-6 py-2 border-b border-slate-900 gap-1.5 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setRuleBoardTab('global')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${ruleBoardTab === 'global' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
              >
                Quy tắc chung
              </button>
              <button
                type="button"
                onClick={() => setRuleBoardTab('templates')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${ruleBoardTab === 'templates' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
              >
                Mẫu Prompt
              </button>
              <button
                type="button"
                onClick={() => setRuleBoardTab('budget')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${ruleBoardTab === 'budget' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
              >
                Ngân sách từ
              </button>
              <button
                type="button"
                onClick={() => setRuleBoardTab('flags')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${ruleBoardTab === 'flags' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'}`}
              >
                Cờ Rủi Ro
              </button>
              <button
                type="button"
                onClick={() => setRuleBoardTab('project')}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${ruleBoardTab === 'project' ? 'bg-[#251e36] text-purple-300 border border-purple-800/40 shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Quy tắc Dự án & Tập
              </button>
            </div>

            {/* Tab Body */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0a0a0d] custom-scrollbar text-xs leading-relaxed text-slate-300 space-y-4">
              
              {ruleBoardTab === 'global' && (
                <div className="space-y-4">
                  <div className="p-3 bg-indigo-950/20 border border-indigo-900/35 rounded-xl">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider block mb-1">Mục đích chính của Seedance 2.0</span>
                    Mô tả chính xác trạng thái vật lý để AI có thể render được, tuyệt đối loại bỏ các từ ngữ mang tính trừu tượng hoặc ẩn dụ (semantic-only adjectives như "irony", "sadness", "dramatic relationship"). Chuyển hóa toàn bộ sang pose, eyeline, biểu cảm gương mặt và vị trí vật lý cụ thể.
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-[#111115] border border-slate-850 rounded-xl space-y-2">
                      <span className="text-[9px] font-black uppercase text-emerald-400 tracking-wider block">Ưu tiên nguồn trích xuất</span>
                      <ol className="list-decimal list-inside space-y-1 text-slate-450 text-[11px]">
                        <li>Chỉ dẫn trực tiếp hiện tại của Đạo diễn</li>
                        <li>Locked Screenplay + Khóa an toàn toàn cục</li>
                        <li>SOT Control Page trong kịch bản</li>
                        <li>Vendor Shotlist Field Cards (First/End Frame, Delta)</li>
                        <li>Production Shotlist (Macro rhythm, dialogue timing)</li>
                      </ol>
                    </div>

                    <div className="p-3 bg-[#111115] border border-slate-850 rounded-xl space-y-2">
                      <span className="text-[9px] font-black uppercase text-pink-400 tracking-wider block">Quy tắc cấm (Negative Locks)</span>
                      <ul className="list-disc list-inside space-y-1 text-slate-455 text-[11px]">
                        <li><strong>Không chữ:</strong> Chặn subtitles, UI, logo, fake writing, symbol, nốt nhạc.</li>
                        <li><strong>Không Morphing:</strong> Tránh các mô tả chuyển đổi hình thể/biến dạng phi vật lý.</li>
                        <li><strong>Không Thoại Trực Tiếp:</strong> Chỉ dùng khẩu hình miệng nhẹ để lồng tiếng (post-sync), không generated speech.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {ruleBoardTab === 'templates' && (
                <div className="space-y-4">
                  <div className="p-3.5 bg-[#111115] border border-slate-855 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">1. Action Shot Template</span>
                      <span className="text-[8.5px] bg-[#0a0a0d] border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Hành động kịch tính</span>
                    </div>
                    <pre className="p-2.5 bg-slate-950/80 rounded-lg text-[9.5px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap select-all">
                      {"Premium stylized 3D family animation, [environment], [aspect ratio], [framing]. Match @IMAGE1 composition and screen direction. Start: [first-frame state]. Motion: [subject performs one physical action] moving [screen direction] at [tempo]. Secondary reactions stay simple. Camera: [locked/stable camera move]. End: [clean planned last frame, clean hold]. SFX/ambient only. No generated speech, text, subtitles, UI, morphing."}
                    </pre>
                  </div>

                  <div className="p-3.5 bg-[#111115] border border-slate-855 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">2. Reaction / Dialogue Shot Template</span>
                      <span className="text-[8.5px] bg-[#0a0a0d] border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Hội thoại & Biểu cảm</span>
                    </div>
                    <pre className="p-2.5 bg-slate-950/80 rounded-lg text-[9.5px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap select-all">
                      {"Premium stylized 3D family animation, [environment], [aspect ratio], [framing]. Match @IMAGE1 composition, eyeline, and lighting. Start: [character position and start expression]. Performance: subtle mouth acting for post-sync only; [character] moves from [start expression] to [end expression]. Camera: [locked / gentle push]. End: [clean reaction hold 0.3-0.5s]. SFX/ambient only. No generated speech, text, subtitles."}
                    </pre>
                  </div>

                  <div className="p-3.5 bg-[#111115] border border-slate-855 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider">3. Insert / Prop / Object Shot Template</span>
                      <span className="text-[8.5px] bg-[#0a0a0d] border border-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Cận cảnh đạo cụ</span>
                    </div>
                    <pre className="p-2.5 bg-slate-950/80 rounded-lg text-[9.5px] text-slate-400 font-mono overflow-x-auto whitespace-pre-wrap select-all">
                      {"Premium stylized 3D family animation, [environment], [aspect ratio], [ECU/CU insert]. Match @IMAGE1 object placement and scale. Start: [prop/object state: holder, visibility, motion state]. Motion: [single physical change: lifts/drops/rolls/opens]. Camera: locked readable insert. End: [exact prop/object end state]. SFX/ambient only. No text, symbols, subtitles."}
                    </pre>
                  </div>
                </div>
              )}

              {ruleBoardTab === 'budget' && (
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider block mb-1">Word Budget & Compression Rules</div>
                  
                  <div className="overflow-hidden border border-slate-855 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#111115] border-b border-slate-855 text-[9px] font-black text-slate-455 uppercase tracking-wider">
                          <th className="p-2.5">Loại Phân Phối Shot</th>
                          <th className="p-2.5 text-center">Ngân sách từ</th>
                          <th className="p-2.5">Trường hợp ứng dụng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-855 text-[10.5px]">
                        <tr className="hover:bg-slate-900/20">
                          <td className="p-2.5 font-bold text-emerald-450">Simple reaction / insert</td>
                          <td className="p-2.5 text-center font-mono">60-100 từ</td>
                          <td className="p-2.5 text-slate-450">Khóa camera tĩnh, thay đổi biểu cảm nhẹ hoặc chuyển động đạo cụ đơn giản.</td>
                        </tr>
                        <tr className="hover:bg-slate-900/20">
                          <td className="p-2.5 font-bold text-blue-450">Comedy / dialogue beat</td>
                          <td className="p-2.5 text-center font-mono">80-120 từ</td>
                          <td className="p-2.5 text-slate-450">Bao gồm nhịp biểu cảm start/end, chỉ dẫn post-sync, giữ nhịp biểu cảm cuối.</td>
                        </tr>
                        <tr className="hover:bg-slate-900/20">
                          <td className="p-2.5 font-bold text-amber-405">Action / multi-character</td>
                          <td className="p-2.5 text-center font-mono">110-150 từ</td>
                          <td className="p-2.5 text-slate-455">Một hành động chính + phản ứng phụ. Khóa chi tiết nhân vật, bối cảnh, đạo cụ.</td>
                        </tr>
                        <tr className="hover:bg-slate-900/20 bg-amber-500/5">
                          <td className="p-2.5 font-bold text-amber-500">Upper Caution Zone</td>
                          <td className="p-2.5 text-center font-mono">150-180 từ</td>
                          <td className="p-2.5 text-slate-455">Chỉ dùng khi shot yêu cầu khóa raccord liên tục nặng. Kiểm tra kỹ lặp từ.</td>
                        </tr>
                        <tr className="hover:bg-slate-900/20 bg-rose-500/5 animate-pulse">
                          <td className="p-2.5 font-bold text-rose-500">Danger Zone (Nguy hiểm)</td>
                          <td className="p-2.5 text-center font-mono">180-200+ từ</td>
                          <td className="p-2.5 text-slate-455">Rất dễ bị cắt chữ hoặc drift hình khi đưa vào mô hình AI. Cần nén từ gấp.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl space-y-1.5">
                    <span className="text-[8.5px] font-black uppercase text-indigo-400 tracking-wider block">Độ ưu tiên nén từ (khi bị quá số chữ):</span>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Khi cần rút gọn: Giữ lại <strong className="text-white">Hành động chính</strong> &rarr; <strong className="text-white">Frame đầu</strong> &rarr; <strong className="text-white">Frame cuối</strong> &rarr; <strong className="text-white">Đạo cụ liên quan</strong> &rarr; <strong className="text-white">Khóa cấm (No text/speech)</strong>. Loại bỏ các chi tiết thừa thãi về môi trường không ảnh hưởng trực tiếp raccord.
                    </p>
                  </div>
                </div>
              )}

              {ruleBoardTab === 'flags' && (
                <div className="space-y-4">
                  <div className="text-[10px] font-black uppercase text-indigo-400 tracking-wider block mb-1">Hệ Thống Cờ Rủi Ro (Risk Flags) & Raccord Action</div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3.5 bg-blue-955/10 border border-blue-900/20 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider block">🔵 NEED REF</span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        <strong>Lý do:</strong> Nhân vật, đạo cụ chưa có visual reference ảnh thiết kế trong World DB nhưng xuất hiện trong shot.<br />
                        <strong>Hành động:</strong> Tạo hoặc cập nhật ảnh thiết kế nhân vật trước khi xuất prompt hàng loạt.
                      </p>
                    </div>

                    <div className="p-3.5 bg-fuchsia-955/10 border border-fuchsia-900/20 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-fuchsia-400 tracking-wider block">🟣 NEED SPLIT</span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        <strong>Lý do:</strong> Shot chứa quá nhiều hành động phức tạp tuần tự, hoặc chuyển động camera chồng chéo, hoặc thời lượng quá dài (&gt;8s).<br />
                        <strong>Hành động:</strong> Tách thành các shot nhỏ hơn trên storyboard để tránh AI không kết xuất được.
                      </p>
                    </div>

                    <div className="p-3.5 bg-amber-955/10 border border-amber-900/20 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">🟡 NEED PATCH</span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        <strong>Lý do:</strong> Thiếu thông tin bối cảnh hoặc các mô tả frame đầu/cuối của shotlist thô.<br />
                        <strong>Hành động:</strong> Điền bổ sung, đồng bộ lại bối cảnh với World DB trước khi chạy prompt.
                      </p>
                    </div>

                    <div className="p-3.5 bg-rose-955/10 border border-rose-900/20 rounded-xl space-y-1.5">
                      <span className="text-[10px] font-black uppercase text-rose-400 tracking-wider block">🔴 NEED DIRECTOR DECISION</span>
                      <p className="text-[10px] text-slate-400 font-medium">
                        <strong>Lý do:</strong> Có sự mâu thuẫn về tuổi, giới tính, trang phục nhân vật hoặc hướng màn hình, vị trí đạo cụ không thống nhất.<br />
                        <strong>Hành động:</strong> Chuyển trạng thái lên Đạo Diễn chốt để có chỉ định cụ thể, không tự ý sáng tạo.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {ruleBoardTab === 'project' && (() => {
                const handleAddRule = () => {
                  const trimmed = newRule.trim();
                  if (!trimmed) return;
                  if (ruleType === 'project') {
                    const next = [...customProjectRules, trimmed];
                    updateGlobalSettings({ customProjectRules: next });
                  } else {
                    const next = [...customEpisodeRules, trimmed];
                    updateGlobalSettings({ customEpisodeRules: next });
                  }
                  setNewRule('');
                };

                const handleRemoveRule = (type: 'project' | 'episode', index: number) => {
                  if (type === 'project') {
                    const next = customProjectRules.filter((_, i) => i !== index);
                    updateGlobalSettings({ customProjectRules: next });
                  } else {
                    const next = customEpisodeRules.filter((_, i) => i !== index);
                    updateGlobalSettings({ customEpisodeRules: next });
                  }
                };

                return (
                  <div className="space-y-4">
                    <div className="text-[10px] font-black uppercase text-purple-400 tracking-wider block mb-1">Thiết lập Quy Tắc Đặc Thù Theo Dự Án / Tập Phim</div>
                    
                    {/* Add Rule Form */}
                    <div className="p-3 bg-[#111115] border border-slate-855 rounded-xl space-y-2.5">
                      <span className="text-[9px] font-black uppercase text-slate-455 tracking-wider block">Thêm quy tắc tùy biến mới</span>
                      <div className="flex gap-2">
                        <select
                          value={ruleType}
                          onChange={(e) => setRuleType(e.target.value as 'project' | 'episode')}
                          className="bg-[#0c0c0e] border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-white outline-none cursor-pointer"
                        >
                          <option value="project">Dự án (Project)</option>
                          <option value="episode">Tập phim (Episode)</option>
                        </select>
                        <input
                          type="text"
                          value={newRule}
                          onChange={(e) => setNewRule(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddRule(); }}
                          className="flex-1 bg-[#0c0c0e] border border-slate-800 rounded-lg px-3 py-1 text-[11px] text-white outline-none focus:border-indigo-500/50"
                          placeholder="Ví dụ: Cấm nụ cười, cấm morphing, phải có mưa..."
                        />
                        <button
                          type="button"
                          onClick={handleAddRule}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          Thêm
                        </button>
                      </div>
                      <div className="text-[8px] text-slate-500 leading-tight">
                        * Mẹo viết quy tắc cấm: Dùng từ khóa "cấm" hoặc "no" kèm theo từ cần cấm (ví dụ: "Cấm máu"). Bộ lọc QC Audit sẽ tự động quét prompt và cảnh báo nếu phát hiện từ này.
                      </div>
                    </div>

                    {/* Rules List */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Project Rules */}
                      <div className="p-3.5 bg-[#111115] border border-slate-855 rounded-xl space-y-2.5">
                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-wider block">Quy tắc cấp Dự án ({customProjectRules.length})</span>
                        {customProjectRules.length === 0 ? (
                          <div className="text-[10px] text-slate-500 italic py-4 text-center">Chưa có quy tắc dự án nào.</div>
                        ) : (
                          <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                            {customProjectRules.map((rule, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-[#0c0c0e] border border-slate-850 rounded-lg px-2.5 py-1 text-[10.5px]">
                                <span className="text-slate-300 font-medium">{rule}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRule('project', idx)}
                                  className="text-slate-555 hover:text-red-400 p-0.5 rounded transition-colors"
                                >
                                  <span className="text-xs font-bold font-mono">X</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Episode Rules */}
                      <div className="p-3.5 bg-[#111115] border border-slate-855 rounded-xl space-y-2.5">
                        <span className="text-[10px] font-black uppercase text-violet-400 tracking-wider block">Quy tắc cấp Tập phim ({customEpisodeRules.length})</span>
                        {customEpisodeRules.length === 0 ? (
                          <div className="text-[10px] text-slate-500 italic py-4 text-center">Chưa có quy tắc tập phim nào.</div>
                        ) : (
                          <div className="space-y-1.5 max-h-[150px] overflow-y-auto custom-scrollbar pr-1">
                            {customEpisodeRules.map((rule, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-[#0c0c0e] border border-slate-850 rounded-lg px-2.5 py-1 text-[10.5px]">
                                <span className="text-slate-300 font-medium">{rule}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRule('episode', idx)}
                                  className="text-slate-555 hover:text-red-400 p-0.5 rounded transition-colors"
                                >
                                  <span className="text-xs font-bold font-mono">X</span>
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-[#181820] border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowRuleBoard(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Đóng Quy Tắc
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shot Detail Editor Modal được dời lên Root */}
      {activeDetailBeat && (() => {
        const sh = pendingShots.find(s => s.beat === activeDetailBeat || s.id === activeDetailBeat);
        if (!sh) return null;
        return (
          <ShotDetailModal
            sh={sh}
            allLocations={allLocations}
            allCharacters={allCharacters}
            renderingStates={renderingStates}
            videoStates={videoStates}
            runImageGenForShot={runImageGenForShot}
            runVideoGenForShot={runVideoGenForShot}
            handleUpdateShot={(beatId, field, val) => updateShot(beatId, field, val)}
            setActiveDetailBeat={setActiveDetailBeat}
            customProjectRules={customProjectRules}
            customEpisodeRules={customEpisodeRules}
            projectData={projectData}
            activeSceneId={activeSceneId}
          />
        );
      })()}
    </div>
  );
}

export default App;
