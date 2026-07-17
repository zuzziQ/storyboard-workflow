import { useState, useRef, memo } from 'react';
import { Film, Plus, Trash2, Zap, HelpCircle, ArrowLeft, Eye, X, Maximize2, MapPin, User, Clock, Sparkles, Check, Link2, TrendingUp, Loader2, Wand2, Image as ImageIcon, Play, Download, Lock, Unlock, Star } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { generateShotsForSingleScene } from '../../utils/generateExpandedShots';
import { getSanitizedImageModel, getSanitizedVideoModel } from './ShotDetailModal';
import { getApiBaseUrl, fetchWithTimeout } from '../../utils/apiConfig';
import ShotPlanHeader from './components/ShotPlanHeader';
import ShotPlanSettingsPanel from './components/ShotPlanSettingsPanel';
import { generateMediaViaGateway } from '../../utils/mediaGateway';
import { parseTransitionString, matchAssetWithMapping, cleanLocationName } from '../../utils/assetMatcher';

const SHOT_TYPES = ['ESTABLISHING', 'DETAIL', 'ACTION', 'REACTION', 'DIALOGUE', 'TRANSITION'];
const FRAMING_OPTIONS = ['HIGH ANGLE', 'LOW ANGLE', 'EYE-LEVEL', 'CLOSE-UP', 'MEDIUM SHOT', 'WIDE SHOT', 'OVER THE SHOULDER'];
const CAMERA_MOVEMENTS = [
  'STATIC', 'PAN_LEFT', 'PAN_RIGHT', 'TILT_UP', 'TILT_DOWN', 
  'ZOOM_IN', 'ZOOM_OUT', 'DOLLY_IN', 'DOLLY_OUT', 
  'TRACKING_L2R', 'TRACKING_R2L', 'CRANE_UP', 'CRANE_DOWN', 
  'HANDHELD', 'ORBIT'
];
const GRID_OPTIONS = ['1x1', '1x2', '2x2', '2x3', '3x3'];

const getAutoRows = (text: string, minRows: number = 1, charsPerLine: number = 26) => {
  if (!text) return minRows;
  const lines = text.split('\n').length;
  const calculated = Math.ceil(text.length / charsPerLine);
  return Math.max(minRows, lines, calculated);
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

function getAssetRefUrl(asset: any): string | null {
  if (!asset) return null;
  return asset.imageUrl || asset.driveUrl || asset.avatar || asset.mediaId || null;
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
      
      const res = await fetch(`${baseUrl}/api/world-asset/upload`, {
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
      const response = await fetch(`${baseUrl}/api/world-asset/orchestrator/query`, {
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
            
            if (useRemote) {
               return driveUrl;
            } else {
               console.log(`[OrchestratorQuery] Non-remote mode. Uploading variant image to GFlow on-the-fly...`);
               try {
                  const b64 = await getBase64Image(driveUrl);
                  const mediaId = await uploadImageToGFlow(b64, projectId, useRemote, baseUrl);
                  if (mediaId) {
                     console.log(`[OrchestratorQuery] GFlow Upload Success! Media ID: ${mediaId}`);
                     return mediaId;
                  }
               } catch (err) {
                  console.warn("[OrchestratorQuery] GFlow upload failed, falling back to driveUrl", err);
               }
               return driveUrl;
            }
         } else {
            console.log(`[OrchestratorQuery] Miss variant. Falling back to default.`);
         }
      }
   } catch (e) {
      console.warn(`[OrchestratorQuery] Error querying orchestrator:`, e);
   }
   
   return defaultVal;
};

const isStateActive = (state: string | undefined): boolean => {
  if (!state) return false;
  const lower = state.toLowerCase();
  return !lower.includes('xong') && !lower.includes('hoàn thành') && !lower.includes('lỗi');
};

const getMainTransition = (causal: string): string => {
  if (!causal) return '';
  const lower = causal.toLowerCase();
  if (lower.includes('hard cut') || lower.includes('hard-cut')) return 'HARD CUT';
  if (lower.includes('dissolve')) return 'DISSOLVE';
  if (lower.includes('fade')) return 'FADE IN/OUT';
  if (lower.includes('wipe')) return 'WIPE';
  if (lower.includes('match cut') || lower.includes('match-cut')) return 'MATCH CUT';
  if (lower.includes('whip pan') || lower.includes('whip-pan')) return 'WHIP PAN';
  if (lower.includes('zoom cut')) return 'ZOOM CUT';
  if (lower.includes('cut to')) return 'CUT TO';
  if (lower.includes('jump cut') || lower.includes('jump-cut')) return 'JUMP CUT';
  return causal.toUpperCase();
};

const getTransitionIcon = (transition: string): string => {
  if (!transition) return '🎬';
  const lower = transition.toLowerCase();
  if (lower.includes('hard cut')) return '⚡';
  if (lower.includes('dissolve')) return '💧';
  if (lower.includes('fade')) return '🌫️';
  if (lower.includes('wipe')) return '🧹';
  if (lower.includes('match cut')) return '🧩';
  if (lower.includes('whip pan')) return '🔄';
  if (lower.includes('zoom cut')) return '🔍';
  if (lower.includes('jump cut')) return '🦘';
  return '🎬';
};

const getShotVerifiedAssets = (sh: any, allCharacters: any[], allLocations: any[]) => {
  const actionText = sh.diễn_tả || sh.description || "";
  const dialogueText = sh.thoại || sh.dialogue || "";
  const combinedText = `${actionText} ${dialogueText}`.toLowerCase();

  // 1. Nhận diện nhân vật
  const charRefs = Array.isArray(sh.character_refs || sh.detectedCharacters)
    ? (sh.character_refs || sh.detectedCharacters)
    : [];
  
  const detectedCharNames = new Set<string>();
  charRefs.forEach((ref: any) => {
    const nameStr = typeof ref === 'string' ? ref : (ref?.name || '');
    if (nameStr.trim()) detectedCharNames.add(nameStr.trim());
  });

  allCharacters.forEach((c: any) => {
    const charName = typeof c === 'string' ? c : c?.name;
    if (!charName) return;
    let dbAliases = '';
    try {
      const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
      dbAliases = sg?.aliases || '';
    } catch (e) {}
    
    if (matchAssetWithMapping(combinedText, charName, dbAliases)) {
      detectedCharNames.add(charName);
    }
  });

  const verifiedCharacters = Array.from(detectedCharNames).map(charName => {
    const matchedDbChar = allCharacters.find((c: any) => {
      const cName = typeof c === 'string' ? c : c?.name;
      if (!cName) return false;
      let dbAliases = '';
      try {
        const sg = typeof c.styleGuide === 'string' ? JSON.parse(c.styleGuide) : c.styleGuide;
        dbAliases = sg?.aliases || '';
      } catch (e) {}
      return c.id === charName || cName.toLowerCase().trim() === charName.toLowerCase().trim() || safeMatchName(charName, cName, dbAliases);
    });

    return {
      name: charName,
      isLinked: !!matchedDbChar,
      imageUrl: matchedDbChar?.imageUrl || matchedDbChar?.avatar || null,
      dbChar: matchedDbChar
    };
  });

  // 2. Nhận diện bối cảnh (Location)
  const locRefs = new Set<string>();
  const rawShotLoc = sh.location || sh.scene_ref || '';
  const cleanShotLoc = cleanLocationName(rawShotLoc);
  
  const isValidLocName = (name: string) => {
    if (!name) return false;
    const lower = name.toLowerCase().trim();
    return lower !== 'bối cảnh' && lower !== 'boicanh' && lower !== 'cảnh' && lower !== 'scene' && !/^(scene|sc|cảnh)\s*\d+$/i.test(lower);
  };

  if (isValidLocName(cleanShotLoc)) {
    locRefs.add(cleanShotLoc);
  }

  allLocations.forEach((l: any) => {
    const locName = typeof l === 'string' ? l : l?.name;
    if (!locName) return;
    let dbAliases = '';
    try {
      const sg = typeof l.styleGuide === 'string' ? JSON.parse(l.styleGuide) : l.styleGuide;
      dbAliases = sg?.aliases || '';
    } catch (e) {}

    if (matchAssetWithMapping(combinedText, locName, dbAliases)) {
      locRefs.add(locName);
    }
  });

  const verifiedLocations = Array.from(locRefs).map(locName => {
    const matchedDbLoc = allLocations.find((l: any) => {
      const lName = typeof l === 'string' ? l : l?.name;
      if (!lName) return false;
      let dbAliases = '';
      try {
        const sg = typeof l.styleGuide === 'string' ? JSON.parse(l.styleGuide) : l.styleGuide;
        dbAliases = sg?.aliases || '';
      } catch (e) {}
      return l.id === locName || lName.toLowerCase().trim() === locName.toLowerCase().trim() || safeMatchName(locName, lName, dbAliases);
    });

    return {
      name: locName,
      isLinked: !!matchedDbLoc,
      imageUrl: matchedDbLoc?.imageUrl || matchedDbLoc?.driveUrl || null,
      dbLoc: matchedDbLoc
    };
  });

  return {
    characters: verifiedCharacters,
    locations: verifiedLocations
  };
};

function ShotPlanNode() {
  const parsedData = useFlowStore((state) => state.parsedData);
  const pendingShots = useFlowStore((state) => state.pendingShots);
  const setPendingShots = useFlowStore((state) => state.setPendingShots);
  const activeSceneId = useFlowStore((state) => state.activeSceneId);
  const setActiveSceneId = useFlowStore((state) => state.setActiveSceneId);
  const setActiveDetailBeat = useFlowStore((state) => state.setActiveDetailBeat);
  
  const nodes = useFlowStore((state) => state.nodes);
  const setNodes = useFlowStore((state) => state.setNodes);

  const imageProvider = useFlowStore((state) => state.imageProvider) || 'hub';
  const videoProvider = useFlowStore((state) => state.videoProvider) || 'hub';
  const hubImageModel = useFlowStore((state) => state.hubImageModel) || 'auto';
  const hubVideoModel = useFlowStore((state) => state.hubVideoModel) || 'auto';
  const sdkImageModel = useFlowStore((state) => state.sdkImageModel) || 'imagen-3';
  const sdkVideoModel = useFlowStore((state) => state.sdkVideoModel) || 'veo-3.1-fast-generate-001';
  const googleImageModel = useFlowStore((state) => state.googleImageModel) || 'imagen-3.0-fast-002';
  const googleVideoModel = useFlowStore((state) => state.googleVideoModel) || 'veo-2.0-generate-001';
  const dreaminaImageModel = useFlowStore((state) => state.dreaminaImageModel) || 'high_aes_general_v50';
  const dreaminaVideoModel = useFlowStore((state) => state.dreaminaVideoModel) || 'dreamina_seedance_40';

  const defaultImageModel = imageProvider === 'google-native' 
    ? googleImageModel 
    : imageProvider === 'sdk' 
      ? sdkImageModel 
      : imageProvider === 'dreamina'
        ? dreaminaImageModel
        : hubImageModel;

  const defaultVideoModel = videoProvider === 'google-native' 
    ? googleVideoModel 
    : videoProvider === 'sdk' 
      ? sdkVideoModel 
      : videoProvider === 'dreamina'
        ? dreaminaVideoModel
        : hubVideoModel;
  const [justApplied, setJustApplied] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'unrendered' | 'has_image' | 'has_video'>('all');
  const [batchQueueStatus, setBatchQueueStatus] = useState<{
    type: 'image' | 'video';
    total: number;
    current: number;
    currentShotId: string | null;
    statusText: string;
    isPausedForCaptcha: boolean;
  } | null>(null);
  const cancelBatchRef = useRef<boolean>(false);

  const emotionArcNode = nodes.find(n => n.id === 'emotion-arc-main');
  const beats: any[] = emotionArcNode?.data?.emotionArc || [];
  const sceneConfigs = emotionArcNode?.data?.sceneConfigs || {};
  const activeConfig = activeSceneId && activeSceneId !== 'all' ? sceneConfigs[activeSceneId] : undefined;

  const updateConfig = (sceneId: string, updatedFields: Partial<any>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === 'emotion-arc-main') {
          const updatedConfigs = {
            ...n.data?.sceneConfigs,
            [sceneId]: {
              ...n.data?.sceneConfigs?.[sceneId],
              ...updatedFields,
            },
          };
          return {
            ...n,
            data: {
              ...n.data,
              sceneConfigs: updatedConfigs,
            },
          };
        }
        return n;
      })
    );
  };

  // For prompt modal preview tool
  const [viewingPromptShotId, setViewingPromptShotId] = useState<string | null>(null);
  const [viewingVideoPromptShotId, setViewingVideoPromptShotId] = useState<string | null>(null);

  const scenes = parsedData?.scenes || [];

  const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
  const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : (parsedData?.characters || []);
  const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : (parsedData?.locations || []);

  // Group shots by sceneId
  const getSceneShots = (sceneId: string) => {
    return pendingShots.filter((sh: any) => {
      const shSceneId = sh.sceneId || sh.sc || sh.scene_id || '';
      return isSameScene(shSceneId, sceneId);
    });
  };

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);

  // Generate shots for a single scene via heuristic
  const handleGenerateForScene = (scene: any) => {
    const charNames = allCharacters.map((c: any) => c.name || c);

    const generated = generateShotsForSingleScene(scene, charNames, scene.panelGrid || '1x1');

    // Filter out old shots of this scene and append the new ones
    const cleanId = String(scene.id || scene.sceneId || '').toLowerCase().trim();
    const otherShots = pendingShots.filter((sh: any) => {
      const shSceneId = String(sh.sceneId || sh.sc || sh.scene_id || '').toLowerCase().trim();
      return !isSameScene(shSceneId, cleanId);
    });

    setPendingShots([...otherShots, ...generated]);
  };

  // Generate shots using LangGraph and Letta Memory on backend
  const handleRegenerateSceneShots = async (scene: any) => {
    const userInstructions = prompt("Sếp có muốn đưa thêm chỉ dẫn đặc biệt nào cho LangGraph không? (Ví dụ: 'tối tăm u ám hơn', 'cú máy rộng', 'tập trung Mica khóc'...):");
    if (userInstructions === null) return; // Cancelled

    setIsRegenerating(true);
    try {
      const activeUniverseId = useFlowStore.getState().projectData?.selectedProjectId || useFlowStore.getState().projectData?.selectedUniverseId;
      const sceneIdVal = scene.id || scene.sceneId;
      const charNames = allCharacters.map((c: any) => c.name || c);
      const sceneChars = scene.charactersInScene || charNames.filter((name: string) => 
        (scene.action || '').toLowerCase().includes(name.toLowerCase())
      );
      
      const baseUrl = getApiBaseUrl();
      const payload = {
        projectId: activeUniverseId || '',
        sceneId: sceneIdVal,
        sceneAction: activeConfig?.action || scene.action || scene.sceneDescription || '',
        characters: sceneChars,
        locationName: activeConfig?.location || scene.location || '',
        userInstructions: userInstructions,
        panelGrid: activeConfig?.panelGrid || scene.panelGrid || 'auto'
      };

      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const response = await fetchWithTimeout(`${baseUrl}/api/agent/regenerate-scene-shots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUB_API_KEY}`
        },
        body: JSON.stringify(payload),
        timeout: 45000 // 45 seconds for LangGraph
      });

      if (!response.ok) {
        throw new Error(`Server status: ${response.status}`);
      }

      const resData = await response.json();
      if (resData.status === 'success' && Array.isArray(resData.data?.shots) && resData.data.shots.length > 0) {
        const generatedRaw = resData.data.shots;

        // Tối ưu hóa góc máy và sinh prompt trực quan chuẩn thông qua cinematic pipeline
        const { runCinematicPipeline } = await import('../../lib/cinematic-engine');
        
        // Đảm bảo mapping các trường đúng kiểu CinematicShot trước khi đưa vào pipeline
        const rawShots = generatedRaw.map((sh: any) => ({
          ...sh,
          id: sh.id || sh.beat,
          scene_id: sh.sc || sh.sceneId || "SC01",
          shot_type: sh.shot_type || "ACTION",
          framing: sh.framing || "MEDIUM",
          camera_movement: sh.camera_movement || "STATIC",
          action_description: sh.description || sh.diễn_tả || "",
          character_refs: sh.character_refs || []
        }));
        
        const { optimizedShots } = runCinematicPipeline(rawShots);
        
        const cleanId = String(sceneIdVal).toLowerCase().trim();
        const otherShots = pendingShots.filter((sh: any) => {
          const shSceneId = String(sh.sceneId || sh.sc || sh.scene_id || '').toLowerCase().trim();
          return !isSameScene(shSceneId, cleanId);
        });

        setPendingShots([...otherShots, ...optimizedShots]);
        alert(`Chúc mừng Sếp! LangGraph đã chia lại thành công ${optimizedShots.length} shots kết hợp Letta Memory và tối ưu hóa góc máy.`);
      } else {
        throw new Error(resData.message || "Không nhận được mảng shots hợp lệ từ API.");
      }
    } catch (error: any) {
      console.error("[RegenerateSceneShots] Failed:", error);
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleAiAnalyzeShots = async () => {
    if (activeSceneShots.length === 0) return;
    if (!confirm(`Sếp có muốn sử dụng AI (Gemini 2.5) để phân tích ngữ cảnh, tự động map đại từ nhân xưng và bối cảnh cho ${activeSceneShots.length} shots trong phân cảnh này không?`)) {
      return;
    }
    
    setIsAnalyzingAi(true);

    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const universeChars = allCharacters.map((c: any) => ({
        id: c.id || c.name || (typeof c === 'string' ? c : ''),
        name: c.name || (typeof c === 'string' ? c : ''),
        aliases: c.aliases || ''
      }));

      const universeLocs = allLocations.map((l: any) => ({
        id: l.id || l.name || (typeof l === 'string' ? l : ''),
        name: l.name || (typeof l === 'string' ? l : ''),
        aliases: l.aliases || ''
      }));

      const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
      const allProps = worldAssetNode ? (worldAssetNode.data.props || []) : (parsedData?.props || []);
      const universeProps = allProps.map((p: any) => ({
        id: p.id || p.name || (typeof p === 'string' ? p : ''),
        name: p.name || (typeof p === 'string' ? p : ''),
        aliases: p.aliases || ''
      }));

      const shotsPayload = activeSceneShots.map((sh: any) => ({
        id: sh.id || sh.beat,
        description: sh.diễn_tả || sh.description || '',
        dialogue: sh.thoại || sh.dialogue || '',
        current_location: sh.location || '',
        current_characters: sh.character_refs || sh.detectedCharacters || []
      }));

      const systemPrompt = `Bạn là một AI trợ lý phân tích kịch bản phim xuất sắc. Nhiệm vụ của bạn là nhận diện chính xác các nhân vật, bối cảnh, đạo cụ xuất hiện trong danh sách các Shot kịch bản dựa vào danh sách thực thể chính thức của dự án.

Danh sách Nhân Vật dự án:
${JSON.stringify(universeChars, null, 2)}

Danh sách Bối Cảnh dự án:
${JSON.stringify(universeLocs, null, 2)}

Danh sách Đạo Cụ dự án:
${JSON.stringify(universeProps, null, 2)}

Quy tắc phân tích:
1. Đọc kỹ mô tả hành động (description) và lời thoại (dialogue) của từng Shot.
2. Xác định các nhân vật xuất hiện trong Shot:
   - Map chính xác các đại từ nhân xưng (ví dụ: "cô bé", "nó", "con mèo", "vẹt", "chú vẹt"...) sang TÊN nhân vật chính thức của dự án (ví dụ: "Mica", "Paco", "Mướp").
   - Nếu nhân vật được nhắc đến bằng tên hoặc biệt danh/aliases trùng khớp với danh sách nhân vật dự án, hãy đưa vào mảng "character_refs".
3. Xác định bối cảnh (location) của Shot:
   - Trích xuất địa danh được nhắc đến hoặc suy luận logic từ các cảnh xung quanh (continuity).
   - Chọn tên bối cảnh TRÙNG KHỚP HOÀN TOÀN với một trong các bối cảnh dự án được cung cấp (ví dụ: "Ban công chung cư Hà Nội" thay vì viết chung chung là "ban công" hay "bối cảnh").
4. Xác định đạo cụ (prop_refs) nếu xuất hiện trong mô tả.
5. Chỉ trả về một mảng JSON các Shot đã được bổ sung/chuẩn hóa dữ liệu ở định dạng:
\`\`\`json
[
  {
    "id": "SC01_B01",
    "location": "Tên bối cảnh dự án",
    "character_refs": ["Tên nhân vật dự án 1", "Tên nhân vật dự án 2"],
    "prop_refs": ["Tên đạo cụ dự án"]
  }
]
\`\`\`
Lưu ý: Chỉ xuất ra JSON hợp lệ nằm trong khối block code json. Không thêm lời giải thích nào khác.`;

      const userPrompt = `Hãy phân tích và map chính xác các shot sau:
${JSON.stringify(shotsPayload, null, 2)}`;

      const HUB_API_URL = `${baseUrl}/api/media/prompt`;
      
      const response = await fetch(HUB_API_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${HUB_API_KEY}` 
        },
        body: JSON.stringify({
          prompt: systemPrompt + "\n\nUser Input:\n" + userPrompt,
          config: {
            provider: 'google-native',
            model_id: 'gemini-2.5-flash',
            projectName: projectData?.name || 'StoryMee',
            purpose: 'shotlist_asset_analysis',
            jobType: 'text_generation',
            async: false
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status: ${response.status}`);
      }

      const resData = await response.json();
      if (resData.status !== 'success' || !resData.data?.text) {
        throw new Error(resData.message || "Không nhận được phản hồi text từ AI.");
      }

      const rawText = resData.data.text;
      let cleaned = rawText.trim();
      cleaned = cleaned.replace(/^```(?:json|javascript)?\s*/i, "").replace(/\s*```$/i, "").trim();
      
      let parsedResults: any[] = [];
      try {
        parsedResults = JSON.parse(cleaned);
      } catch (err) {
        const startIdx = cleaned.indexOf("[");
        const endIdx = cleaned.lastIndexOf("]");
        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          parsedResults = JSON.parse(cleaned.substring(startIdx, endIdx + 1));
        } else {
          throw new Error("Không thể parse JSON từ AI. Nội dung phản hồi: " + rawText.substring(0, 150));
        }
      }

      if (Array.isArray(parsedResults)) {
        const updated = pendingShots.map((sh: any) => {
          const matchedResult = parsedResults.find(r => r.id === sh.id || r.id === sh.beat);
          if (matchedResult) {
            // Find resolved ID for matching location & characters
            const matchedDbLoc = allLocations.find((l: any) => {
              const lName = typeof l === 'string' ? l : l?.name;
              return lName?.toLowerCase().trim() === matchedResult.location?.toLowerCase().trim();
            });
            const locationId = matchedDbLoc ? matchedDbLoc.id : undefined;

            const characterIds = (matchedResult.character_refs || []).map((refName: string) => {
              const matchedDbChar = allCharacters.find((c: any) => {
                const cName = typeof c === 'string' ? c : c?.name;
                return cName?.toLowerCase().trim() === refName.toLowerCase().trim();
              });
              return matchedDbChar ? matchedDbChar.id : null;
            }).filter(Boolean);

            return {
              ...sh,
              location: matchedResult.location || sh.location || '',
              locationId: locationId || sh.locationId,
              character_refs: matchedResult.character_refs || sh.character_refs || [],
              detectedCharacters: matchedResult.character_refs || sh.detectedCharacters || [],
              characterIds: Array.from(new Set([...(sh.characterIds || []), ...characterIds])),
              prop_refs: matchedResult.prop_refs || sh.prop_refs || []
            };
          }
          return sh;
        });

        setPendingShots(updated);
        alert(`🎉 AI đã phân tích và chuẩn hóa thành công ${parsedResults.length} Shots! Các nhân vật, bối cảnh, đạo cụ đã được tự động map và verify.`);
      }
    } catch (error: any) {
      console.error("[AiAnalyzeShots] Failed:", error);
      alert(`AI Phân tích thất bại: ${error.message || error}`);
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  // Add a new empty shot to a scene
  const handleAddNewShot = (sceneId: string) => {
    const sceneShots = getSceneShots(sceneId);
    const nextNum = sceneShots.length + 1;
    const cleanId = String(sceneId).replace(/[^0-9]/g, '');
    const scCode = `SC${cleanId.padStart(2, '0')}`;
    const beatId = `${scCode}_B${String(nextNum).padStart(2, '0')}`;

    const newShot = {
      id: beatId,
      beat: beatId,
      sceneId: sceneId,
      sc: scCode,
      shotNumber: nextNum,
      kind: 'ACTION',
      shot_type: 'ACTION',
      framing: 'EYE-LEVEL',
      angle: 'Eye-Level',
      duration: 4,
      duration_target: 4,
      cameraMovement: 'STATIC',
      camera_movement: 'STATIC',
      description: 'Mô tả hành động của shot mới...',
      diễn_tả: 'Mô tả hành động của shot mới...',
      objective: 'Mô tả mục tiêu của shot...',
      mục_tiêu: 'Mô tả mục tiêu của shot...',
      causalLink: 'Mối liên kết nhân quả...',
      panelGrid: '1x1',
      thoại: '',
      dialogue: '',
      visual: '',
      hình_ảnh: '',
      storyboardPrompt: '',
      videoPrompt: '',
      video_prompt: ''
    };

    setPendingShots([...pendingShots, newShot]);
  };

  // Remove a shot
  const handleRemoveShot = (shotId: string) => {
    if (confirm('Sếp có chắc chắn muốn xóa shot này không?')) {
      const updated = pendingShots.filter((sh: any) => sh.id !== shotId && sh.beat !== shotId);
      setPendingShots(updated);
    }
  };

  // Update a single shot field or multiple fields
  const handleUpdateShot = (shotId: string, field: string | Record<string, any>, value?: any) => {
    const updated = pendingShots.map((sh: any) => {
      if (sh.id === shotId || sh.beat === shotId) {
        let updatedShot = { ...sh };
        if (typeof field === 'string') {
          updatedShot[field] = value;
          // Sync camelCase and snake_case fields
          if (field === 'kind') updatedShot.shot_type = value.toUpperCase();
          if (field === 'shot_type') updatedShot.kind = value;
          if (field === 'angle') updatedShot.framing = value.toUpperCase();
          if (field === 'framing') updatedShot.angle = value;
          if (field === 'cameraMovement') updatedShot.camera_movement = value.toUpperCase();
          if (field === 'camera_movement') updatedShot.cameraMovement = value;
          if (field === 'description') updatedShot.diễn_tả = value;
          if (field === 'diễn_tả') updatedShot.description = value;
          if (field === 'objective') updatedShot.mục_tiêu = value;
          if (field === 'mục_tiêu') updatedShot.objective = value;
          if (field === 'storyboardPrompt' || field === 'visual' || field === 'hình_ảnh') {
            updatedShot.storyboardPrompt = value;
            updatedShot.visual = value;
            updatedShot.hình_ảnh = value;
          }
          if (field === 'videoPrompt' || field === 'video_prompt') {
            updatedShot.videoPrompt = value;
            updatedShot.video_prompt = value;
          }
        } else {
          updatedShot = { ...updatedShot, ...field };
          Object.entries(field).forEach(([k, v]) => {
            if (k === 'kind') updatedShot.shot_type = v.toUpperCase();
            if (k === 'shot_type') updatedShot.kind = v;
            if (k === 'angle') updatedShot.framing = v.toUpperCase();
            if (k === 'framing') updatedShot.angle = v;
            if (k === 'cameraMovement') updatedShot.camera_movement = v.toUpperCase();
            if (k === 'camera_movement') updatedShot.cameraMovement = v;
            if (k === 'description') updatedShot.diễn_tả = v;
            if (k === 'diễn_tả') updatedShot.description = v;
            if (k === 'objective') updatedShot.mục_tiêu = v;
            if (k === 'mục_tiêu') updatedShot.objective = v;
            if (k === 'storyboardPrompt' || k === 'visual' || k === 'hình_ảnh') {
              updatedShot.storyboardPrompt = v;
              updatedShot.visual = v;
              updatedShot.hình_ảnh = v;
            }
            if (k === 'videoPrompt' || k === 'video_prompt') {
              updatedShot.videoPrompt = v;
              updatedShot.video_prompt = v;
            }
          });
        }
        return updatedShot;
      }
      return sh;
    });
    setPendingShots(updated);
  };

  const projectData = useFlowStore((state) => state.projectData);
  const [renderingStates, setRenderingStates] = useState<Record<string, string>>({});
  const [videoStates, setVideoStates] = useState<Record<string, string>>({});
  const [storyboardModels, setStoryboardModels] = useState<Record<string, string>>({});
  const [videoModels, setVideoModels] = useState<Record<string, string>>({});
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

  const handleExtractLastFrame = async (sh: any) => {
    const activeVideoUrl = sh.videoUrl || sh.video_url;
    if (!activeVideoUrl) return;
    try {
      setIsExtractingFrame(true);
      
      const video = document.createElement('video');
      video.src = activeVideoUrl;
      video.crossOrigin = "anonymous";
      video.muted = true;
      video.playsInline = true;
      
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => resolve(null);
        video.onerror = (e) => reject(new Error("Không thể load video: " + e));
      });
      
      const lastFrameTime = Math.max(0, video.duration - 0.15);
      video.currentTime = lastFrameTime;
      
      await new Promise((resolve) => {
        video.onseeked = () => resolve(null);
      });
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Không tạo được context canvas");
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.95);
      
      const projectId = projectData?.id || '';
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      const baseUrl = getApiBaseUrl();
      
      let finalUrl = await uploadImageToGFlow(base64, projectId, useRemote, baseUrl);
      if (!finalUrl) {
         console.warn("Upload thất bại, sử dụng base64 trực tiếp làm fallback");
         finalUrl = base64;
      }
      
      // Find the next shot
      const currentIndex = pendingShots.findIndex(s => s.beat === sh.beat || s.id === sh.id);
      if (currentIndex !== -1 && currentIndex + 1 < pendingShots.length) {
         const nextShot = pendingShots[currentIndex + 1];
         
         // Update the next shot's storyboard image in Zustand Store
         const updatedShots = pendingShots.map((s, idx) => {
            if (idx === currentIndex + 1) {
               return {
                  ...s,
                  renderUrl: finalUrl,
                  imageUrl: finalUrl,
                  generatedMediaId: finalUrl
               };
            }
            return s;
         });
         
         setPendingShots(updatedShots);
         
         // Also synchronize it to backend database by calling handleUpdateShot for the next shot
         handleUpdateShot(nextShot.beat || nextShot.id, {
            renderUrl: finalUrl,
            imageUrl: finalUrl,
            generatedMediaId: finalUrl
         });
         
         alert(`🎉 Đã trích xuất thành công frame cuối và đặt làm ảnh Storyboard cho Shot tiếp theo (${nextShot.beat || 'sau'})!`);
      } else {
         alert(`🎉 Trích xuất thành công! Không có Shot tiếp theo để kế thừa.`);
      }
    } catch (err: any) {
      console.error("Lỗi trích xuất frame:", err);
      alert("❌ Lỗi trích xuất frame: " + err.message);
    } finally {
      setIsExtractingFrame(false);
    }
  };

  const [isAutoDrawing, setIsAutoDrawing] = useState(false);

  const drawLayoutOnCanvas = (
    bgImageUrl: string,
    characters: Array<{ name: string; color: string; boundingBox: { x: number; y: number; w: number; h: number }; label: string }>
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const W = 960, H = 540; // 16:9
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context unavailable'));
        ctx.drawImage(img, 0, 0, W, H);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 0, W, H);
        characters.forEach(c => {
          const { x, y, w, h } = c.boundingBox;
          const bx = x * W, by = y * H, bw = w * W, bh = h * H;
          ctx.strokeStyle = c.color;
          ctx.lineWidth = 4;
          ctx.fillStyle = c.color + '44';
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeRect(bx, by, bw, bh);
          const fontSize = Math.max(14, Math.round(bw * 0.18));
          ctx.font = `bold ${fontSize}px Inter, sans-serif`;
          ctx.fillStyle = '#fff';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 6;
          ctx.fillText(c.name, bx + 6, by + fontSize + 4);
          ctx.fillStyle = c.color + 'bb';
          ctx.font = `${Math.max(11, fontSize - 3)}px Inter, sans-serif`;
          ctx.fillText(c.label || '', bx + 6, by + fontSize * 2 + 6);
          ctx.shadowBlur = 0;
        });
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => {
        const W = 960, H = 540;
        const canvas = document.createElement('canvas');
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#1e1e2e';
        ctx.fillRect(0, 0, W, H);
        characters.forEach(c => {
          const { x, y, w, h } = c.boundingBox;
          ctx.strokeStyle = c.color;
          ctx.lineWidth = 4;
          ctx.fillStyle = c.color + '55';
          ctx.fillRect(x * W, y * H, w * W, h * H);
          ctx.strokeRect(x * W, y * H, w * W, h * H);
          ctx.font = `bold ${Math.max(14, Math.round(w * W * 0.18))}px Inter, sans-serif`;
          ctx.fillStyle = '#fff';
          ctx.fillText(c.name, x * W + 6, y * H + 20);
        });
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = bgImageUrl;
    });
  };

  const handleAutoLayout = async (sh: any) => {
    const prompt = sh.videoPrompt || sh.description || sh.beat;
    if (!prompt) {
      alert('⚠️ Shot chưa có mô tả hoặc Video Prompt. Hãy nhập Prompt trước.');
      return;
    }
    try {
      setIsAutoDrawing(true);
      const baseUrl = getApiBaseUrl();
      const projectId = projectData?.id || '';
      const charRefs: string[] = (sh.character_refs || sh.detectedCharacters || []).map((c: any) =>
        typeof c === 'string' ? c : c?.name || ''
      ).filter(Boolean);
      const shotType = sh.cameraSize || sh.shotType || 'medium';

      const res = await fetch(`${baseUrl}/world-asset/projects/${projectId}/auto-layout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, characters: charRefs, shotType })
      });
      const data = await res.json();
      if (!data.success || !data.layout?.characters?.length) {
        throw new Error(data.error || 'Không nhận được dữ liệu layout từ AI');
      }

      const bgUrl = sh.renderUrl || sh.imageUrl || sh.locationImageUrl || '';
      const compositeBase64 = await drawLayoutOnCanvas(bgUrl, data.layout.characters);

      const currentShotId = sh.beat || sh.id;
      const updatedShots = pendingShots.map(s => {
        if (s.beat === sh.beat || s.id === sh.id) {
          return { ...s, renderUrl: compositeBase64, imageUrl: compositeBase64 };
        }
        return s;
      });
      setPendingShots(updatedShots);
      
      // Đồng bộ cơ sở dữ liệu backend
      const updatedFields = { renderUrl: compositeBase64, imageUrl: compositeBase64 };
      await fetch(`${baseUrl}/world-asset/projects/${projectId}/shots/${currentShotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields)
      });

      alert(`✅ Auto Draw hoàn thành! Đã vẽ bố cục ${data.layout.characters.length} nhân vật.`);
    } catch (err: any) {
      console.error('[AutoLayout] Lỗi:', err);
      alert('❌ Lỗi Auto Draw: ' + err.message);
    } finally {
      setIsAutoDrawing(false);
    }
  };

  const runImageGenForShot = async (sh: any, modelId: string = 'auto', throwOnError: boolean = false) => {
    const shotIdVal = sh.id || sh.beat;
    const finalPromptText = sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.description || sh.diễn_tả || '';
    if (!finalPromptText) {
       if (throwOnError) {
          throw new Error("Prompt của Shot này trống");
       }
       alert("⚠️ Prompt của Shot này trống. Vui lòng nhập hoặc sinh prompt trước.");
       return;
    }

    let activeModel = getSanitizedImageModel(modelId, imageProvider);
    if (activeModel === 'auto') {
      activeModel = defaultImageModel;
    }

    setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Đang vẽ..." }));
    
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
      
      // 1. Add selected characters references
      for (const char of matchedChars) {
        const name = char.name;
        if (name) {
           if (char.worldAssetCharId) {
              linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
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
           if (resolvedMedia && !mediaIds.includes(resolvedMedia)) {
              mediaIds.push(resolvedMedia);
           }
        }
      }

      // 2. Auto-match characters mentioned in the prompt but not selected
      for (const char of allCharacters) {
        const name = (char.name || "").toLowerCase().trim();
        if (name && safeMatchName(promptLower, name, char.aliases)) {
          if (char.worldAssetCharId) {
             if (!linkedEntities.some(e => e.entityId === char.worldAssetCharId)) {
                linkedEntities.push({ entityId: char.worldAssetCharId, role: 'character' });
             }
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
          if (resolvedMedia && !mediaIds.includes(resolvedMedia)) {
             mediaIds.push(resolvedMedia);
          }
        }
      }

      // 3. Match and add location reference
      const sceneLocName = (sh.location || sh.bối_cảnh || "").toLowerCase().trim();
      const matchedLoc = allLocations.find((loc: any) => {
        const name = (loc.name || "").toLowerCase().trim();
        if (!name) return false;
        return name === sceneLocName || name.includes(sceneLocName) || sceneLocName.includes(name) || safeMatchName(promptLower, name, loc.aliases);
      });
      if (matchedLoc) {
        if (matchedLoc.worldAssetCharId) {
           linkedEntities.push({ entityId: matchedLoc.worldAssetCharId, role: 'location' });
        }
        const resolvedMedia = await resolveReferencedAssetMedia(
           matchedLoc.worldAssetCharId,
           cameraTag,
           matchedLoc.mediaId || null,
           matchedLoc.imageUrl || null,
           useRemote,
           projectData?.id || '',
           baseUrl
        );
        if (resolvedMedia && !mediaIds.includes(resolvedMedia)) {
          mediaIds.push(resolvedMedia);
        }
      }

      mediaIds = Array.from(new Set(mediaIds));
      console.log(`[StoryMee][Shot] Resolved reference images mediaIds (useRemote: ${useRemote}):`, mediaIds);

      let finalPrompt = finalPromptText;
      const missingNames: string[] = [];
      const primaryMatchedChars: any[] = [];
      
      // Check which characters are primary in this shot
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
      }, (status) => setRenderingStates(prev => ({ ...prev, [shotIdVal]: status })));

      if (!response.success || !response.images || response.images.length === 0) {
        const errorMsg = response.error || "Unknown";
        const opIdStr = response.operationIds && response.operationIds.length > 0 ? ` [Job ID: ${response.operationIds.join(', ')}]` : '';
        setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Lỗi: " + errorMsg + opIdStr }));
        if (throwOnError) {
          throw new Error(errorMsg + opIdStr);
        }
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
      
      // Auto sync variant to DB
      if (linkedEntities.length > 0 && finalUrl) {
         const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
         const headers: any = { 'Content-Type': 'application/json' };
         if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

         linkedEntities.forEach(ent => {
            if (ent.role === 'character') {
               const tagId = `shot_gen_${shotIdVal.toLowerCase()}_${Date.now()}`;
               fetch(`${baseUrl}/api/world-asset/orchestrator/sync-variant`, {
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

      // Auto suggest video prompt right away
      let videoPromptVal = sh.videoPrompt || '';
      try {
         const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
         const durationVal = sh.duration || 4;
         const res = await generateVideoScriptPrompt(finalPrompt, durationVal);
         if (res && res.videoPrompt) {
           videoPromptVal = res.videoPrompt;
         }
      } catch (e) {
         console.warn("Lỗi auto video prompt:", e);
      }

      handleUpdateShot(sh.beat || sh.id, {
        renderUrl: finalUrl,
        generatedMediaId: finalId,
        variants: [...currentVariants, newVariant],
        videoPrompt: videoPromptVal
      });
      
      setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Xong!" }));
      
    } catch (err: any) {
      setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Lỗi: " + err.message }));
      if (throwOnError) {
        throw err;
      }
    }
  };

  const runSketchGenForShot = async (sh: any) => {
    const shotIdVal = sh.id || sh.beat;
    if (!sh.generatedMediaId && !sh.renderUrl) {
      alert("⚠️ Vui lòng vẽ ảnh storyboard màu trước khi tạo Sketch.");
      return;
    }

    setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Đang tạo Sketch..." }));
    
    try {
      const sketchPrompt = "Clean coloring page, black and white line art, pure white background, thin black outlines, sharp contours, no shading, no grayscale, colorless, perfect for coloring. " + (sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.description || sh.diễn_tả || "");
      
      const inputMediaId = sh.generatedMediaId || sh.renderUrl;
      const response = await generateMediaViaGateway({
        prompt: sketchPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: [inputMediaId],
        mediaType: 'image',
        modelId: 'auto',
        ipId: activeSceneId,
        entityType: 'scene',
        generatorMode: 'xray' // Kích hoạt ControlNet trích xuất viền đen trắng
      }, (status) => setRenderingStates(prev => ({ ...prev, [shotIdVal]: status })));

      if (!response.success || !response.images || response.images.length === 0) {
        setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Lỗi Sketch: " + (response.error || "Unknown") }));
        return;
      }

      const finalUrl = response.images[0].url;
      const finalId = response.images[0].mediaId || response.images[0].id || finalUrl;

      setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Hoàn thành Sketch!" }));

      handleUpdateShot(shotIdVal, {
        sketchRenderUrl: finalUrl,
        sketchMediaId: finalId,
        renderUrl: finalUrl,
        imageUrl: finalUrl
      });
    } catch (error: any) {
      console.error("[runSketchGenForShot] Error:", error);
      setRenderingStates(prev => ({ ...prev, [shotIdVal]: "Lỗi: " + error.message }));
    }
  };

  const runVideoGenForShot = async (sh: any, videoModel: string = 'auto', throwOnError: boolean = false) => {
    const shotIdVal = sh.id || sh.beat;
    if (!sh.videoPrompt) {
      if (throwOnError) {
        throw new Error("Video của Shot này chưa có Prompt");
      }
      alert("⚠️ Video của Shot này chưa có Prompt. Vui lòng nhập prompt trước.");
      return;
    }

    let activeModel = getSanitizedVideoModel(videoModel, videoProvider);
    if (activeModel === 'auto') {
      activeModel = defaultVideoModel;
    }

    setVideoStates(prev => ({ ...prev, [shotIdVal]: "Đang dựng..." }));

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
      }, (status) => setVideoStates(prev => ({ ...prev, [shotIdVal]: status })));

      const videoUrl = response.url || (response.images && response.images[0]?.url);

      if (!response.success || !videoUrl) {
        const errorMsg = response.error || "Unknown";
        const opIdStr = response.operationIds && response.operationIds.length > 0 ? ` [Job ID: ${response.operationIds.join(', ')}]` : '';
        setVideoStates(prev => ({ ...prev, [shotIdVal]: "Lỗi: " + errorMsg + opIdStr }));
        if (throwOnError) {
          throw new Error(errorMsg + opIdStr);
        }
        return;
      }

      setVideoStates(prev => ({ ...prev, [shotIdVal]: "Hoàn thành!" }));

      handleUpdateShot(shotIdVal, {
        videoUrl: videoUrl,
        video_url: videoUrl,
        renderVideoUrl: videoUrl
      });
    } catch (error: any) {
      console.error("[runVideoGenForShot] Error:", error);
      setVideoStates(prev => ({ ...prev, [shotIdVal]: "Lỗi: " + error.message }));
      if (throwOnError) {
        throw error;
      }
    }
  };

  const runBatchGenForScene = async (type: 'image' | 'video') => {
    if (batchQueueStatus) {
      alert("⚠️ Đang có một hàng đợi sinh media khác đang chạy!");
      return;
    }

    if (isOverview) {
      alert("⚠️ Vui lòng chọn một phân cảnh cụ thể để sinh hàng loạt!");
      return;
    }

    // Filter shots belonging to current scene and not locked (isApproved !== true)
    const eligibleShots = activeSceneShots.filter((sh: any) => {
      if (sh.isApproved) return false;
      if (type === 'image') {
        const promptText = sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.description || sh.diễn_tả || '';
        return !!promptText;
      } else {
        return !!sh.videoPrompt;
      }
    });

    if (eligibleShots.length === 0) {
      alert(`⚠️ Không tìm thấy shot nào đủ điều kiện sinh ${type === 'image' ? 'storyboard' : 'video'} (Chưa khóa & có Prompt) trong cảnh này.`);
      return;
    }

    cancelBatchRef.current = false;
    setBatchQueueStatus({
      type,
      total: eligibleShots.length,
      current: 0,
      currentShotId: null,
      statusText: "Bắt đầu hàng đợi sinh media...",
      isPausedForCaptcha: false
    });

    for (let i = 0; i < eligibleShots.length; i++) {
      if (cancelBatchRef.current) {
        setBatchQueueStatus(null);
        alert("🛑 Hàng đợi đã bị hủy bởi người dùng.");
        return;
      }

      const sh = eligibleShots[i];
      const shotIdVal = sh.id || sh.beat;

      setBatchQueueStatus(prev => prev ? {
        ...prev,
        current: i + 1,
        currentShotId: shotIdVal,
        statusText: `Đang xử lý shot ${sh.beat || shotIdVal} (${i + 1}/${eligibleShots.length})...`,
        isPausedForCaptcha: false
      } : null);

      let attempts = 0;
      let success = false;

      while (!success && !cancelBatchRef.current) {
        try {
          if (type === 'image') {
            const mId = storyboardModels[shotIdVal] || defaultImageModel;
            await runImageGenForShot(sh, mId, true);
          } else {
            const mId = videoModels[shotIdVal] || defaultVideoModel;
            await runVideoGenForShot(sh, mId, true);
          }
          success = true;
        } catch (err: any) {
          attempts++;
          const errMsg = err.message || '';
          console.warn(`[BatchQueue] Error on shot ${shotIdVal} (Attempt ${attempts}):`, errMsg);

          // 1. CAPTCHA Check
          const isCaptcha = /captcha|verification|robot|cloudflare|puzzle/i.test(errMsg);
          if (isCaptcha) {
            setBatchQueueStatus(prev => prev ? {
              ...prev,
              statusText: `⚠️ Phát hiện Captcha tại Shot ${sh.beat || shotIdVal}. Vui lòng giải captcha. Tự động thử lại sau 15 giây...`,
              isPausedForCaptcha: true
            } : null);
            await new Promise(resolve => setTimeout(resolve, 15000));
            continue;
          }

          // 2. Rate Limit Check (429)
          const isRateLimit = /429|rate limit|too many requests|quota exceeded|busy/i.test(errMsg);
          if (isRateLimit) {
            if (attempts >= 3) {
              console.error(`[BatchQueue] Rate limit persisted for shot ${shotIdVal}. Skipping.`);
              break;
            }
            const waitTimeSec = attempts * 8;
            setBatchQueueStatus(prev => prev ? {
              ...prev,
              statusText: `⏳ Rate limit tại Shot ${sh.beat || shotIdVal}. Thử lại sau ${waitTimeSec} giây (Lần ${attempts}/3)...`,
              isPausedForCaptcha: false
            } : null);
            await new Promise(resolve => setTimeout(resolve, waitTimeSec * 1000));
            continue;
          }

          // 3. Network / CORS Check
          const isNetwork = /failed to fetch|network error|networkrequestfailed|network request failed/i.test(errMsg);
          if (isNetwork) {
            if (attempts >= 3) {
              console.error(`[BatchQueue] Network/CORS error persisted for shot ${shotIdVal}. Skipping.`);
              break;
            }
            const actualWait = attempts === 1 ? 3 : (attempts === 2 ? 6 : 12);
            setBatchQueueStatus(prev => prev ? {
              ...prev,
              statusText: `🌐 Lỗi Mạng/CORS tại Shot ${sh.beat || shotIdVal}. Thử lại sau ${actualWait} giây (Lần ${attempts}/3)...`,
              isPausedForCaptcha: false
            } : null);
            await new Promise(resolve => setTimeout(resolve, actualWait * 1000));
            continue;
          }

          // Other non-recoverable errors
          console.error(`[BatchQueue] Non-recoverable error for shot ${shotIdVal}:`, errMsg);
          break;
        }
      }

      // Safe Cooldown 1.5s
      if (success && i < eligibleShots.length - 1 && !cancelBatchRef.current) {
        setBatchQueueStatus(prev => prev ? {
          ...prev,
          statusText: `✅ Thành công Shot ${sh.beat || shotIdVal}. Nghỉ 1.5 giây để tránh rate limit...`
        } : null);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setBatchQueueStatus(null);
    alert(`🎉 Đã hoàn thành tiến trình sinh hàng loạt ${type === 'image' ? 'Storyboard' : 'Video'} cho Cảnh này!`);
  };

  // Check if we are showing a specific active scene or the overview
  const isOverview = activeSceneId === 'all';
  const activeScene = scenes.find((s: any) => isSameScene(s.id || s.sceneId, activeSceneId));
  const activeSceneShots = activeScene ? getSceneShots(activeScene.id || activeScene.sceneId || "") : [];

  const viewingShot = pendingShots.find((sh: any) => sh.id === viewingPromptShotId || sh.beat === viewingPromptShotId);

  // Stats & Filters logic
  const totalCount = activeSceneShots.length;
  const hasImageCount = activeSceneShots.filter((sh: any) => !!(sh.renderUrl || sh.imageUrl)).length;
  const hasVideoCount = activeSceneShots.filter((sh: any) => !!(sh.videoUrl || sh.renderVideoUrl || sh.video_url)).length;
  const unrenderedCount = activeSceneShots.filter((sh: any) => !(sh.renderUrl || sh.imageUrl)).length;

  const filteredShots = activeSceneShots.filter((sh: any) => {
    const hasImg = sh.renderUrl || sh.imageUrl;
    const hasVid = sh.videoUrl || sh.renderVideoUrl || sh.video_url;
    if (mediaFilter === 'unrendered') return !hasImg;
    if (mediaFilter === 'has_image') return !!hasImg;
    if (mediaFilter === 'has_video') return !!hasVid;
    return true; // 'all'
  });

  return (
    <div className="w-full bg-transparent flex flex-col h-full text-slate-100">
      <ShotPlanHeader
        isOverview={isOverview}
        activeSceneId={activeSceneId}
        activeScene={activeScene}
        scenes={scenes}
        pendingShots={pendingShots}
        setActiveSceneId={setActiveSceneId}
        handleRegenerateSceneShots={handleRegenerateSceneShots}
        isRegenerating={isRegenerating}
        handleAiAnalyzeShots={handleAiAnalyzeShots}
        isAnalyzingAi={isAnalyzingAi}
        runBatchGenForScene={runBatchGenForScene}
        batchQueueStatus={batchQueueStatus}
        handleAddNewShot={handleAddNewShot}
        cancelBatchRef={cancelBatchRef}
        totalCount={totalCount}
        hasImageCount={hasImageCount}
        hasVideoCount={hasVideoCount}
        activeSceneShots={activeSceneShots}
      />

      {/* Content Area */}
      <div className="p-4 flex-1 overflow-y-auto custom-scrollbar text-left">
        {scenes.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs italic flex flex-col items-center justify-center gap-1.5">
            <HelpCircle size={20} className="text-slate-600" />
            <span>Kịch bản chưa được phân tích hoặc không tìm thấy scene nào.</span>
          </div>
        ) : isOverview ? (
          /* OVERVIEW MODE (Compact list of scenes) */
          <div className="space-y-2.5">
            <div className="text-[9px] uppercase tracking-wider text-indigo-400/80 font-black mb-1">
              Danh sách Cảnh (Click Cảnh trên biểu đồ Emotion Arc hoặc chọn bên dưới để xem shot)
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {scenes.map((scene: any, index: number) => {
                const sId = scene.id || scene.sceneId || `Scene ${index + 1}`;
                const sShots = getSceneShots(sId);
                return (
                  <div
                    key={sId}
                    onClick={() => setActiveSceneId(sId)}
                    className="p-3 rounded-xl border border-slate-850 bg-slate-900/40 hover:bg-slate-900/80 hover:border-indigo-500/30 cursor-pointer transition-all flex flex-col justify-between h-24 group relative"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                          {sId}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono bg-slate-950/50 px-1.5 py-0.5 rounded font-bold">
                          {sShots.length} shots
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-white truncate max-w-[240px]">
                        {scene.location || 'Bối cảnh'}
                      </div>
                      <div className="text-[9px] text-slate-500 truncate max-w-[240px] mt-0.5">
                        {scene.action || scene.sceneDescription || 'Không có mô tả'}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-850/60" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleGenerateForScene(scene)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600/10 hover:bg-indigo-650 hover:text-white border border-indigo-500/20 text-[9px] font-black text-indigo-300 rounded transition-colors"
                      >
                        ⚡ Sinh Shot
                      </button>
                      <span className="text-[9px] text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-bold">
                        Thiết kế <Eye size={10} className="ml-0.5" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* DETAILED SHOTS MODE (Right Drawer Workspace) */
          <div className="space-y-4 w-full">
            
            {/* Scene Atmosphere & Emotional Director Panel */}
            {activeConfig && (() => {
              const activeBeatIndex = beats.findIndex((b: any) => isSameScene(b.sceneId, activeSceneId));
              const activeBeat = activeBeatIndex !== -1 ? beats[activeBeatIndex] : undefined;

              const prevBeat = activeBeatIndex > 0 ? beats[activeBeatIndex - 1] : undefined;
              const bridgeFromPrev = prevBeat ? parsedData?.bridgeHints?.find(
                (b: any) => isSameScene(b.afterSceneId, prevBeat.sceneId) && isSameScene(b.beforeSceneId, activeSceneId)
              ) : undefined;

              const nextBeat = activeBeatIndex < beats.length - 1 ? beats[activeBeatIndex + 1] : undefined;
              const bridgeToNext = nextBeat ? parsedData?.bridgeHints?.find(
                (b: any) => isSameScene(b.afterSceneId, activeSceneId) && isSameScene(b.beforeSceneId, nextBeat.sceneId)
              ) : undefined;

              // Color palette per arc position 
              const ARC_COLORS: Record<string, string> = {
                setup:      '#64748b',
                inciting:   '#f59e0b',
                rising:     '#f97316',
                climax:     '#ef4444',
                falling:    '#8b5cf6',
                resolution: '#10b981',
              };

              const isLightingSynced = activeConfig.lighting === activeBeat?.lighting;
              const isWeatherSynced = activeConfig.weather === activeBeat?.weather;
              const isSoundCueSynced = activeConfig.soundCue === activeBeat?.soundCue;
              const isAtmosphereSynced = isLightingSynced && isWeatherSynced && isSoundCueSynced;

              const handleApplyAtmosphere = () => {
                if (!activeBeat) return;
                updateConfig(activeSceneId, {
                  lighting: activeBeat.lighting || activeConfig.lighting,
                  weather: activeBeat.weather || activeConfig.weather,
                  soundCue: activeBeat.soundCue || activeConfig.soundCue,
                  moodShift: activeConfig.moodShift || activeBeat.transitionHint || '',
                });
                setJustApplied(true);
                setTimeout(() => setJustApplied(false), 2000);
              };

              return (
                <div className="p-4 rounded-xl border border-indigo-500/20 bg-[#13131c] text-left space-y-4">
                  {/* Top line with controls */}
                  <div className="flex items-center justify-between border-b border-indigo-500/10 pb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveSceneId('all')}
                        className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Quay lại tổng quan"
                      >
                        <ArrowLeft size={14} />
                      </button>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                        {activeSceneId}
                      </span>
                      <span className="text-xs font-bold text-white truncate max-w-[280px]">
                        📍 {activeConfig.location || activeScene?.location || 'Chưa đặt bối cảnh'}
                      </span>
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {activeConfig.timeOfDay || 'DAY'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleRegenerateSceneShots(activeScene)}
                        disabled={isRegenerating}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-650 hover:text-white border border-indigo-500/30 text-[10px] font-black text-indigo-300 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isRegenerating ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-indigo-400" />
                            Đang chạy LangGraph...
                          </>
                        ) : (
                          <>
                            ⚡ Sinh lại Storyboard Cảnh Này
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleAiAnalyzeShots}
                        disabled={isAnalyzingAi}
                        className="flex items-center gap-1 px-3 py-1 bg-amber-500/20 hover:bg-amber-500 text-amber-355 hover:text-white border border-amber-500/30 rounded-lg text-[10px] font-black uppercase transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {isAnalyzingAi ? (
                          <>
                            <Loader2 size={12} className="animate-spin text-amber-400" />
                            <span>Đang phân tích...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={11} className="text-amber-400" />
                            <span>🤖 AI PHÂN TÍCH SHOT</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => runBatchGenForScene('image')}
                        disabled={!!batchQueueStatus}
                        className="flex items-center gap-1 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-650 hover:text-white border border-indigo-500/30 text-[10px] font-black text-indigo-300 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      >
                        🎨 TẠO ALL STORYBOARD
                      </button>
                      <button
                        onClick={() => runBatchGenForScene('video')}
                        disabled={!!batchQueueStatus}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-600/20 hover:bg-purple-650 hover:text-white border border-purple-500/30 text-[10px] font-black text-purple-300 rounded-lg transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                      >
                        🎬 DỰNG ALL VIDEO
                      </button>
                      <button
                        onClick={() => handleAddNewShot(activeSceneId)}
                        className="flex items-center gap-1 px-3 py-1 bg-emerald-600/20 hover:bg-emerald-650 hover:text-white border border-emerald-500/30 text-[10px] font-black text-emerald-300 rounded-lg transition-all active:scale-95 cursor-pointer"
                      >
                        ➕ Thêm Shot mới
                      </button>
                    </div>
                  </div>

                  {batchQueueStatus && (
                    <div className="mb-4 p-3 bg-slate-900 border border-indigo-500/30 rounded-xl flex items-center justify-between gap-3 text-[11px] shadow-lg animate-pulse">
                      <div className="flex items-center gap-2 truncate">
                        <Loader2 className="animate-spin text-indigo-400 shrink-0" size={13} />
                        <span className="font-bold text-indigo-300 uppercase shrink-0">
                          [Hàng đợi {batchQueueStatus.type === 'image' ? 'Storyboard' : 'Video'}]:
                        </span>
                        <span className="text-slate-300 font-semibold truncate">{batchQueueStatus.statusText}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[9px] bg-indigo-950/60 px-2 py-0.5 rounded-full text-indigo-300 border border-indigo-800/40 font-black">
                          {batchQueueStatus.current}/{batchQueueStatus.total} Shot
                        </span>
                        <button
                          onClick={() => { cancelBatchRef.current = true; }}
                          className="px-2 py-0.5 bg-red-600/20 hover:bg-red-600 border border-red-500/30 text-red-200 hover:text-white rounded-lg text-[9px] font-bold active:scale-95 transition-all cursor-pointer"
                        >
                          HỦY
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Settings Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Left Column: Atmosphere */}
                    <div className="space-y-3">
                      <div className="text-[9px] uppercase tracking-wider text-indigo-400/80 font-black">
                        Thiết lập Cảnh trí (Atmosphere & Scene)
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850 text-xs text-white space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Địa điểm (Override)</label>
                            <input
                              type="text"
                              value={activeConfig.location || ''}
                              onChange={(e) => updateConfig(activeSceneId, { location: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                              placeholder="Địa điểm..."
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Thời điểm</label>
                            <select
                              value={activeConfig.timeOfDay || 'DAY'}
                              onChange={(e) => updateConfig(activeSceneId, { timeOfDay: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                            >
                              <option value="DAY">DAY</option>
                              <option value="NIGHT">NIGHT</option>
                              <option value="SUNRISE">SUNRISE</option>
                              <option value="SUNSET">SUNSET</option>
                              <option value="DUSK">DUSK</option>
                              <option value="DAWN">DAWN</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">💡 Ánh sáng</label>
                            <input
                              type="text"
                              value={activeConfig.lighting || ''}
                              onChange={(e) => updateConfig(activeSceneId, { lighting: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] text-white outline-none focus:border-indigo-500/50"
                              placeholder="Ánh sáng..."
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">☁️ Thời tiết</label>
                            <input
                              type="text"
                              value={activeConfig.weather || ''}
                              onChange={(e) => updateConfig(activeSceneId, { weather: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[11px] text-white outline-none focus:border-indigo-500/50"
                              placeholder="Thời tiết..."
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Lưới Grid</label>
                            <select
                              value={activeConfig.panelGrid || 'auto'}
                              onChange={(e) => updateConfig(activeSceneId, { panelGrid: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-1.5 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                            >
                              <option value="auto">Auto (Phân tích thông minh)</option>
                              <option value="1x1">Grid 1x1</option>
                              <option value="1x2">Grid 1x2</option>
                              <option value="2x1">Grid 2x1</option>
                              <option value="2x2">Grid 2x2</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">🎵 Âm thanh & Tiếng động</label>
                            <input
                              type="text"
                              value={activeConfig.soundCue || ''}
                              onChange={(e) => updateConfig(activeSceneId, { soundCue: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                              placeholder="Tiếng động/BGM..."
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">👥 Nhân vật tham gia</label>
                            <input
                              type="text"
                              value={(activeConfig.charactersInScene || []).join(', ')}
                              onChange={(e) => updateConfig(activeSceneId, { charactersInScene: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean) })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                              placeholder="Nhân vật..."
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">📝 Ghi chú Bối cảnh & Mô tả Scene</label>
                          <textarea
                            rows={getAutoRows(activeConfig.action || '', 2, 40)}
                            value={activeConfig.action || ''}
                            onChange={(e) => updateConfig(activeSceneId, { action: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500/50 resize-none leading-relaxed custom-scrollbar"
                            placeholder="Nhân vật làm gì, diễn biến tổng quan..."
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Mood shift & Narrative Bridges */}
                    <div className="space-y-3">
                      <div className="text-[9px] uppercase tracking-wider text-indigo-400/80 font-black flex items-center justify-between">
                        <span>Biến Chuyển Cảm Xúc (Mood Shift)</span>
                        {activeBeat && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase" style={{ backgroundColor: `${ARC_COLORS[activeBeat.arcPosition] || '#64748b'}20`, color: ARC_COLORS[activeBeat.arcPosition] || '#64748b', border: `1px solid ${ARC_COLORS[activeBeat.arcPosition] || '#64748b'}30` }}>
                            {activeBeat.arcPosition}
                          </span>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850 text-xs text-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="capitalize font-black text-indigo-300 text-[12px]">{activeBeat?.emotion || 'neutral'}</span>
                          <span className="text-[10px] font-bold text-indigo-400">Cường độ: {activeConfig.emotionIntensity ?? activeBeat?.intensity ?? 40}%</span>
                        </div>
                        
                        <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${activeConfig.emotionIntensity ?? activeBeat?.intensity ?? 40}%` }} />
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Cảm xúc lối vào (Mood In)</label>
                            <input
                              type="text"
                              value={activeConfig.moodShift || ''}
                              onChange={(e) => updateConfig(activeSceneId, { moodShift: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                              placeholder="Mood In..."
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-slate-400 font-semibold block mb-0.5">Cảm xúc lối ra (Mood Out)</label>
                            <input
                              type="text"
                              value={activeConfig.moodShiftOut || ''}
                              onChange={(e) => updateConfig(activeSceneId, { moodShiftOut: e.target.value })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-xs text-white outline-none focus:border-indigo-500/50"
                              placeholder="Mood Out..."
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bridges */}
                      <div className="space-y-1.5">
                        <div className="text-[8px] uppercase tracking-wider text-indigo-400/80 font-black">Cầu nối Chuyển cảnh (Bridges)</div>
                        <div className="grid grid-cols-2 gap-2">
                          {prevBeat ? (
                            <div className="p-2 rounded bg-slate-950/40 border border-slate-850 text-[10px] space-y-1">
                              <div className="flex items-center justify-between text-slate-450 font-bold text-[9px]">
                                <span className="flex items-center gap-0.5">
                                  <Link2 size={9} className="text-indigo-400" />
                                  Vào từ S{beats.findIndex((b: any) => isSameScene(b.sceneId, prevBeat.sceneId)) + 1} ({prevBeat.emotion})
                                </span>
                              </div>
                              <p className="text-slate-350 italic text-[10px] leading-tight line-clamp-3">
                                {bridgeFromPrev ? bridgeFromPrev.description : `Mạch cảm xúc đi từ ${prevBeat.emotion} sang ${activeBeat?.emotion || 'neutral'}.`}
                              </p>
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-slate-950/20 border border-slate-850 text-[9px] text-slate-500 italic">
                              Cảnh mở đầu câu chuyện.
                            </div>
                          )}

                          {nextBeat ? (
                            <div className="p-2 rounded bg-slate-950/40 border border-slate-850 text-[10px] space-y-1">
                              <div className="flex items-center justify-between text-slate-450 font-bold text-[9px]">
                                <span className="flex items-center gap-0.5">
                                  <Link2 size={9} className="text-violet-400" />
                                  Ra sang S{beats.findIndex((b: any) => isSameScene(b.sceneId, nextBeat.sceneId)) + 1} ({nextBeat.emotion})
                                </span>
                              </div>
                              <p className="text-slate-350 italic text-[10px] leading-tight line-clamp-3">
                                {bridgeToNext ? bridgeToNext.description : `Chuyển cảm xúc sang ${nextBeat.emotion}.`}
                              </p>
                            </div>
                          ) : (
                            <div className="p-2 rounded bg-slate-950/20 border border-slate-850 text-[9px] text-slate-500 italic">
                              Cảnh kết thúc câu chuyện.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Sync Atmosphere Button */}
                      {!isAtmosphereSynced && activeBeat && (
                        <button
                          onClick={handleApplyAtmosphere}
                          disabled={justApplied}
                          className={`w-full py-1.5 px-3 rounded-lg text-[10px] font-black text-white flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                            justApplied
                              ? 'bg-emerald-600/30 border-emerald-500/30 text-emerald-300'
                              : 'bg-indigo-600/20 hover:bg-indigo-600/40 border-indigo-500/30 text-indigo-300'
                          }`}
                        >
                          {justApplied ? 'Đã đồng bộ!' : 'Đồng bộ không khí từ Emotion Arc'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
            <div className="space-y-4 w-full nodrag">
              {activeSceneShots.length === 0 ? (
                <div className="w-full py-16 text-center border border-dashed border-slate-850 bg-slate-950/20 text-slate-500 text-xs italic flex flex-col items-center justify-center gap-2">
                  <span>Chưa có shot plan nào cho cảnh này.</span>
                  <button
                    onClick={() => handleRegenerateSceneShots(activeScene)}
                    disabled={isRegenerating}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                  >
                    {isRegenerating ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Đang chạy LangGraph...
                      </>
                    ) : (
                      <>
                        Tự động tạo Shot Plan
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <>
                  {/* Summary & Filters Bar */}
                  <div className="flex items-center justify-between bg-slate-900/60 border border-slate-850 rounded-xl p-3 text-xs text-white">
                    {/* Left: Info */}
                    <div className="flex items-center gap-3 font-semibold text-[10px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        Tổng: <strong className="text-white">{totalCount}</strong> shots
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        Có ảnh: <strong className="text-white">{hasImageCount}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Có video: <strong className="text-white">{hasVideoCount}</strong>
                      </span>
                    </div>

                    {/* Right: Filters Tabs */}
                    <div className="flex bg-slate-950/50 p-1 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setMediaFilter('all')}
                        className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          mediaFilter === 'all'
                            ? 'bg-indigo-600 text-white shadow font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        TẤT CẢ
                      </button>
                      <button
                        onClick={() => setMediaFilter('unrendered')}
                        className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          mediaFilter === 'unrendered'
                            ? 'bg-indigo-600 text-white shadow font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        CHƯA GEN ({unrenderedCount})
                      </button>
                      <button
                        onClick={() => setMediaFilter('has_image')}
                        className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          mediaFilter === 'has_image'
                            ? 'bg-indigo-600 text-white shadow font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        CÓ ẢNH ({hasImageCount})
                      </button>
                      <button
                        onClick={() => setMediaFilter('has_video')}
                        className={`px-3 py-1 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                          mediaFilter === 'has_video'
                            ? 'bg-indigo-600 text-white shadow font-black'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        CÓ VIDEO ({hasVideoCount})
                      </button>
                    </div>
                  </div>

                  {/* Horizontal Overview Carousel */}
                  <div className="bg-[#0f0f13]/90 border border-slate-850 rounded-2xl p-3.5 space-y-2 shadow-inner">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                      <span className="flex items-center gap-1 uppercase tracking-wider text-indigo-400">
                        <Film size={12} /> BỨC TRANH TỔNG QUAN CẢNH ({totalCount} SHOTS)
                      </span>
                      <span className="text-slate-500 font-mono text-[9px]">
                        Tổng lượng: {activeSceneShots.reduce((acc: number, sh: any) => acc + (Number(sh.duration) || 0), 0)}s
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 overflow-x-auto py-2.5 px-1 custom-scrollbar">
                      {activeSceneShots.map((sh: any, idx: number) => {
                        const shotIdVal = sh.id || sh.beat;
                        const shotType = (sh.kind || sh.shot_type || 'ACTION').toUpperCase();
                        let borderClass = 'border-slate-800 hover:border-indigo-500/50';
                        let badgeColor = 'bg-slate-800 text-slate-400';
                        
                        if (shotType.includes('ESTABLISHING')) {
                          borderClass = 'border-blue-900/60 hover:border-blue-500/50';
                          badgeColor = 'bg-blue-900/30 text-blue-300 border border-blue-900/50';
                        } else if (shotType.includes('DIALOGUE')) {
                          borderClass = 'border-amber-900/60 hover:border-amber-500/50';
                          badgeColor = 'bg-amber-900/30 text-amber-300 border border-amber-900/50';
                        } else if (shotType.includes('ACTION')) {
                          borderClass = 'border-indigo-900/60 hover:border-indigo-500/50';
                          badgeColor = 'bg-indigo-900/30 text-indigo-300 border border-indigo-900/50';
                        } else if (shotType.includes('REACTION')) {
                          borderClass = 'border-rose-900/60 hover:border-rose-500/50';
                          badgeColor = 'bg-rose-900/30 text-rose-300 border border-rose-900/50';
                        } else if (shotType.includes('TRANSITION')) {
                          borderClass = 'border-purple-900/60 hover:border-purple-500/50';
                          badgeColor = 'bg-purple-900/30 text-purple-300 border border-purple-900/50';
                        }

                        const hasImg = sh.renderUrl || sh.imageUrl;
                        const isActiveGen = isStateActive(renderingStates[shotIdVal]) || isStateActive(videoStates[shotIdVal]);

                        return (
                          <div
                            key={shotIdVal}
                            onClick={() => {
                              const el = document.getElementById(`shot-card-${shotIdVal}`);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            className={`flex-shrink-0 w-36 h-20 rounded-xl border-2 bg-slate-950/80 p-2 text-left relative cursor-pointer group transition-all duration-300 overflow-hidden ${borderClass} flex flex-col justify-between`}
                          >
                            {/* Background image if exists */}
                            {hasImg && (
                              <>
                                <div 
                                  className="absolute inset-0 bg-cover bg-center opacity-25 group-hover:opacity-45 transition-opacity duration-300 pointer-events-none"
                                  style={{ backgroundImage: `url(${hasImg})` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/40 pointer-events-none" />
                              </>
                            )}

                            {/* Content overlay */}
                            <div className="relative z-10 flex flex-col justify-between h-full w-full">
                              {/* Header row: Index & duration & Glow Dot */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1">
                                  <span className="text-[9px] font-black text-white px-1.5 py-0.5 rounded bg-black/65 border border-slate-800">
                                    #{idx + 1}
                                  </span>
                                  {sh.isApproved && (
                                    <span className="text-[9px] leading-none" title="Đã chốt (Locked)">🔒</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span 
                                    className={`w-2 h-2 rounded-full border border-black/45 ${
                                      isActiveGen
                                        ? 'bg-amber-500 animate-pulse shadow-[0_0_6px_rgba(245,158,11,0.85)]' 
                                        : sh.videoUrl || sh.video_url
                                          ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.85)]' 
                                          : hasImg
                                            ? 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.85)]' 
                                            : 'bg-slate-700'
                                    }`} 
                                    title={
                                      isActiveGen
                                        ? 'Đang render...' 
                                        : sh.videoUrl || sh.video_url
                                          ? 'Đã có Video' 
                                          : hasImg
                                            ? 'Đã có Ảnh' 
                                            : 'Chưa gen'
                                    }
                                  />
                                  <span className="text-[8.5px] font-mono font-bold text-indigo-400 bg-slate-950/80 px-1 py-0.5 rounded leading-none">
                                    {sh.duration ? `${sh.duration}s` : 'Auto'}
                                  </span>
                                </div>
                              </div>

                              {/* Footer row: Kind & truncate desc */}
                              <div className="space-y-0.5 mt-auto">
                                <div className={`text-[7px] font-black uppercase inline-block px-1 rounded-sm ${badgeColor}`}>
                                  {shotType.replace('ESTABLISHING', 'EST.')}
                                </div>
                                <div className="text-[9px] text-slate-300 font-semibold line-clamp-1 truncate w-full">
                                  {sh.diễn_tả || sh.description || 'Không có mô tả'}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vertical Shot Cards List */}
                  <div className="space-y-4">
                    {filteredShots.map((sh: any, shIdx: number) => {
                      const shotIdVal = sh.id || sh.beat;
                      const globalIdx = activeSceneShots.findIndex((x: any) => (x.id || x.beat) === shotIdVal);

                      // Asset Verify: realtime match
                      const verifiedAssets = getShotVerifiedAssets(sh, allCharacters, allLocations);

                      const hasImg = sh.renderUrl || sh.imageUrl;
                      const hasVid = sh.videoUrl || sh.renderVideoUrl || sh.video_url;

                      return (
                        <div key={shotIdVal} className="space-y-4">
                          {/* Main Shot Card */}
                          <div 
                            id={`shot-card-${shotIdVal}`}
                            className={`border rounded-2xl p-4 shadow-xl hover:border-slate-700/80 transition-all duration-300 flex flex-col md:flex-row gap-4 text-left relative overflow-hidden group ${
                              sh.isApproved 
                                ? 'bg-[#181512]/90 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.06)]' 
                                : 'bg-[#12121a]/85 border-slate-800/80'
                            }`}
                          >
                            {/* Background image if exists */}
                            {hasImg && (
                              <>
                                <div 
                                  className={`absolute inset-0 bg-cover bg-center transition-opacity duration-300 pointer-events-none ${
                                    sh.isApproved ? 'opacity-20 group-hover:opacity-35' : 'opacity-25 group-hover:opacity-40'
                                  }`}
                                  style={{ backgroundImage: `url(${hasImg})` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0d0d12] via-[#0d0d12]/90 to-[#0d0d12]/50 pointer-events-none" />
                              </>
                            )}
                            {/* Column 1: Config & Asset Verify (Left) */}
                            <div className="w-full md:w-[24%] flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-800/60 pb-3 md:pb-0 md:pr-4 space-y-3 shrink-0">
                              {/* Shot title & Delete button */}
                              <div className="flex items-center justify-between border-b border-slate-800/60 pb-2 relative z-10">
                                <span className="font-black text-indigo-400 font-mono tracking-wider text-xs flex items-center gap-1.5">
                                  SHOT #{globalIdx + 1}
                                  <span className="text-[9px] text-slate-500 font-normal">({sh.beat})</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleUpdateShot(shotIdVal, 'isApproved', !sh.isApproved)}
                                    className={`px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-[8.5px] font-black border ${
                                      sh.isApproved 
                                        ? 'bg-amber-500/20 border-amber-500/30 text-amber-350 hover:bg-amber-500/30 shadow-inner' 
                                        : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
                                    }`}
                                    title={sh.isApproved ? "Mở khóa Shot" : "Chốt & Khóa Shot"}
                                  >
                                    {sh.isApproved ? (
                                      <>
                                        <Lock size={10} className="text-amber-400" />
                                        <span>ĐÃ CHỐT</span>
                                      </>
                                    ) : (
                                      <>
                                        <Unlock size={10} className="text-slate-400" />
                                        <span>CHỐT SHOT</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => handleRemoveShot(shotIdVal)}
                                    className="text-slate-500 hover:text-rose-450 p-1 rounded hover:bg-rose-950/20 transition-colors cursor-pointer"
                                    title="Xóa shot"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>

                              {/* Controls */}
                              <div className="grid grid-cols-2 gap-2 relative z-10">
                                <div>
                                  <label className="text-[7.5px] text-slate-400 font-black uppercase block mb-0.5">Loại Shot</label>
                                  <select
                                    disabled={sh.isApproved}
                                    value={(sh.kind || sh.shot_type || 'ACTION').toUpperCase()}
                                    onChange={(e) => handleUpdateShot(shotIdVal, 'kind', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-indigo-500/50 disabled:opacity-50"
                                  >
                                    {SHOT_TYPES.map((t) => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[7.5px] text-slate-400 font-black uppercase block mb-0.5">Cỡ Cảnh</label>
                                  <select
                                    disabled={sh.isApproved}
                                    value={(sh.angle || sh.framing || 'EYE-LEVEL').toUpperCase()}
                                    onChange={(e) => handleUpdateShot(shotIdVal, 'angle', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-indigo-500/50 disabled:opacity-50"
                                  >
                                    {FRAMING_OPTIONS.map((f) => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="col-span-2">
                                  <label className="text-[7.5px] text-slate-400 font-black uppercase block mb-0.5">Camera Movement</label>
                                  <select
                                    disabled={sh.isApproved}
                                    value={(sh.cameraMovement || sh.camera_movement || 'STATIC').toUpperCase()}
                                    onChange={(e) => handleUpdateShot(shotIdVal, 'cameraMovement', e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-indigo-500/50 disabled:opacity-50"
                                  >
                                    {CAMERA_MOVEMENTS.map((c) => (
                                      <option key={c} value={c}>{c}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Duration info */}
                              <div className="flex items-center justify-between text-[10px] bg-slate-950/60 p-2 rounded-lg border border-slate-855 relative z-10">
                                <span className="text-slate-450 font-bold">THỜI LƯỢNG:</span>
                                <span className="font-mono font-black text-indigo-400">{sh.duration ? `${sh.duration}s` : 'Auto'}</span>
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-2 relative z-10">
                                <button
                                  disabled={sh.isApproved}
                                  onClick={() => setActiveDetailBeat(shotIdVal)}
                                  className="w-full py-1.5 bg-indigo-500/10 hover:bg-indigo-500 text-indigo-300 hover:text-white border border-indigo-500/20 hover:border-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                                  title="Mở bảng chỉnh sửa chi tiết nâng cao"
                                >
                                  <Sparkles size={11} className="text-amber-400" /> BIÊN TẬP
                                </button>
                              </div>

                              {/* Asset Verify Section */}
                              <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-850/80 space-y-1.5 mt-auto">
                                <div className="text-[7.5px] font-black text-indigo-400/80 uppercase tracking-widest flex items-center justify-between">
                                  <span>Asset Verify</span>
                                  <span className="text-[7px] text-slate-500 lowercase">(realtime match)</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {/* Render Locations */}
                                  {verifiedAssets.locations.length > 0 ? (
                                    verifiedAssets.locations.map((loc, lIdx) => (
                                      loc.isLinked ? (
                                        <div key={`loc-linked-${lIdx}`} className="flex items-center gap-1.5 bg-orange-600/10 border border-orange-500/20 text-[8.5px] font-black text-orange-300 px-2 py-0.5 rounded-md truncate max-w-[120px]" title={`Bối cảnh: ${loc.name} (Đã liên kết)`}>
                                          {loc.imageUrl ? (
                                            <img src={loc.imageUrl} className="w-3.5 h-3.5 rounded object-cover shrink-0" alt="Loc" />
                                          ) : (
                                            <MapPin size={8} className="shrink-0 text-orange-400" />
                                          )}
                                          <span className="truncate">{loc.name}</span>
                                        </div>
                                      ) : (
                                        <div key={`loc-unlinked-${lIdx}`} className="flex items-center gap-1 bg-rose-950/20 border border-rose-500/30 text-[8.5px] font-bold text-rose-300 px-2 py-0.5 rounded-md truncate max-w-[120px]" title={`Bối cảnh: ${loc.name} (Chưa liên kết)`}>
                                          <MapPin size={8} className="shrink-0 text-rose-400 animate-pulse" />
                                          <span className="truncate">{loc.name} (Unlinked)</span>
                                        </div>
                                      )
                                    ))
                                  ) : (
                                    <span className="text-[7.5px] bg-slate-900 border border-slate-855 text-slate-500 px-2 py-0.5 rounded-md">📍 Loc: None</span>
                                  )}

                                  {/* Render Characters */}
                                  {verifiedAssets.characters.length > 0 ? (
                                    verifiedAssets.characters.map((char, cIdx) => (
                                      char.isLinked ? (
                                        <div key={`char-linked-${cIdx}`} className="flex items-center gap-1 bg-emerald-600/10 border border-emerald-500/20 text-[8.5px] font-black text-emerald-300 px-1.5 py-0.5 rounded" title={`Nhân vật: ${char.name} (Đã liên kết)`}>
                                          {char.imageUrl ? (
                                            <img src={char.imageUrl} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" alt="Char" />
                                          ) : (
                                            <User size={7} className="shrink-0 text-emerald-400" />
                                          )}
                                          <span className="truncate max-w-[60px]">{char.name}</span>
                                        </div>
                                      ) : (
                                        <div key={`char-unlinked-${cIdx}`} className="flex items-center gap-1 bg-slate-800 border border-slate-700/60 text-[8.5px] font-bold text-slate-400 px-1.5 py-0.5 rounded" title={`Nhân vật: ${char.name} (Chưa liên kết)`}>
                                          <User size={7} className="shrink-0 text-slate-500" />
                                          <span className="truncate max-w-[60px]">{char.name} (?)</span>
                                        </div>
                                      )
                                    ))
                                  ) : (
                                    <span className="text-[7.5px] bg-slate-900 border border-slate-855 text-slate-500 px-2 py-0.5 rounded-md">👥 Chars: None</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Column 2: Scripts & Prompts (Middle) */}
                            <div className="flex-1 flex flex-col justify-between space-y-3 relative z-10">
                              {/* Action Description */}
                              <div className="space-y-1">
                                <label className="text-[8px] text-amber-400 font-black uppercase tracking-wider block font-black">MÔ TẢ DIỄN BIẾN HÀNH ĐỘNG</label>
                                <textarea
                                  disabled={sh.isApproved}
                                  rows={getAutoRows(sh.diễn_tả || sh.description || '', 3, 40)}
                                  value={sh.diễn_tả || sh.description || ''}
                                  onChange={(e) => handleUpdateShot(shotIdVal, 'diễn_tả', e.target.value)}
                                  placeholder="Nhân vật làm gì, diễn biến hành động cụ thể..."
                                  className="w-full bg-slate-900/30 border border-slate-850 rounded-xl p-2.5 text-xs text-slate-200 outline-none focus:bg-slate-950/40 focus:ring-1 focus:ring-indigo-500/30 resize-none leading-relaxed custom-scrollbar disabled:text-slate-450 disabled:bg-slate-900/10 disabled:cursor-not-allowed"
                                />
                              </div>

                              {/* Dialogue */}
                              <div className="space-y-1">
                                <label className="text-[8px] text-indigo-400 font-black uppercase tracking-wider block font-black">LỜI THOẠI</label>
                                <textarea
                                  disabled={sh.isApproved}
                                  rows={getAutoRows(sh.thoại || sh.dialogue || '', 2, 40)}
                                  value={sh.thoại || sh.dialogue || ''}
                                  onChange={(e) => handleUpdateShot(shotIdVal, 'thoại', e.target.value)}
                                  placeholder="Lời thoại nhân vật..."
                                  className="w-full bg-slate-900/30 border border-slate-850 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:bg-slate-950/40 focus:ring-1 focus:ring-indigo-500/30 resize-none leading-relaxed custom-scrollbar font-medium disabled:text-slate-450 disabled:bg-slate-900/10 disabled:cursor-not-allowed"
                                />
                              </div>
                            </div>

                            {/* Column 3: Storyboard & Video Box (Right) */}
                            <div className="w-full md:w-[28%] flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-800/60 pt-3 md:pt-0 md:pl-4 space-y-3 shrink-0 relative z-10">
                              {/* Preview Area */}
                              {hasImg ? (
                                <div className="relative group/img overflow-hidden rounded-xl border border-slate-800 bg-slate-950 aspect-video shadow-inner">
                                  <img src={hasImg} className="w-full h-full object-cover" alt="Storyboard Frame" />
                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setSelectedZoomImage(hasImg)}
                                      className="px-2 py-1 bg-indigo-650/90 hover:bg-indigo-600 text-white rounded text-[9px] font-black flex items-center gap-0.5 cursor-pointer shadow"
                                    >
                                      <Eye size={10} /> Xem lớn
                                    </button>
                                    <button
                                      disabled={sh.isApproved || isAutoDrawing}
                                      onClick={() => handleAutoLayout(sh)}
                                      className="px-2 py-1 bg-emerald-605/90 hover:bg-emerald-600 text-white rounded text-[9px] font-black flex items-center gap-0.5 cursor-pointer shadow disabled:opacity-50"
                                      title="Auto Draw: Tự động phân tích prompt và vẽ khối màu nhân vật"
                                    >
                                      {isAutoDrawing ? (
                                        <Loader2 size={8} className="animate-spin text-white" />
                                      ) : (
                                        <span>🪄 Auto vẽ khối</span>
                                      )}
                                    </button>
                                    <a
                                      href={hasImg}
                                      download
                                      target="_blank"
                                      className="px-2 py-1 bg-slate-800/90 hover:bg-slate-755 text-white rounded text-[9px] font-black flex items-center justify-center shadow"
                                    >
                                      <Download size={10} />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="w-full aspect-video rounded-xl border border-dashed border-slate-855 bg-slate-950/40 flex flex-col items-center justify-center text-[9px] text-slate-500 font-black gap-1.5 py-4">
                                  <ImageIcon size={16} className="text-slate-650 animate-pulse" />
                                  <span>AWAITING MEDIA</span>
                                  <button
                                    disabled={sh.isApproved || isAutoDrawing}
                                    onClick={() => handleAutoLayout(sh)}
                                    className="mt-1 px-2.5 py-1 bg-emerald-600/95 hover:bg-emerald-650 text-white rounded text-[9px] font-black flex items-center gap-1 cursor-pointer shadow disabled:opacity-50"
                                  >
                                    {isAutoDrawing ? (
                                      <Loader2 size={8} className="animate-spin text-white" />
                                    ) : (
                                      <span>🪄 Auto vẽ khối</span>
                                    )}
                                  </button>
                                </div>
                              )}

                              {/* Storyboard Render Button & model selector */}
                              <div className="space-y-1.5">
                                {sh.isApproved ? (
                                  <div className="w-full py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[8.5px] font-black uppercase flex items-center justify-center gap-1 cursor-default shadow-sm">
                                    <Lock size={10} className="text-amber-400" />
                                    <span>🔒 Đã chốt & Khóa</span>
                                  </div>
                                ) : (
                                  <div className="flex gap-1">
                                    <select 
                                      value={getSanitizedImageModel(storyboardModels[shotIdVal] || sh.storyboardModel || 'auto', imageProvider)} 
                                      onChange={e => setStoryboardModels(prev => ({ ...prev, [shotIdVal]: e.target.value }))}
                                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[9.5px] font-bold text-slate-355 outline-none focus:border-indigo-500/40"
                                    >
                                      {imageProvider === 'dreamina' && (
                                        <>
                                          <option value="auto">Auto Model (Mặc định)</option>
                                          <option value="high_aes_gpt_v20">GPT Image 2 (New)</option>
                                          <option value="high_aes_general_v50">Image 5.0 Lite</option>
                                          <option value="high_aes_general_v47">Image 4.7 (New)</option>
                                          <option value="high_aes_general_v46">Image 4.6</option>
                                          <option value="high_aes_general_v45">Image 4.5</option>
                                        </>
                                      )}
                                      {imageProvider === 'google-native' && (
                                        <>
                                          <option value="imagen-3.0-fast-002">Imagen 3.0 Fast</option>
                                          <option value="imagen-3.0-generate-002">Imagen 3.0 HQ</option>
                                          <option value="auto">Auto Model</option>
                                        </>
                                      )}
                                      {imageProvider === 'sdk' && (
                                        <>
                                          <option value="imagen-3">Imagen 3 (SDK)</option>
                                          <option value="auto">Auto Model</option>
                                        </>
                                      )}
                                      {imageProvider === 'hub' && (
                                        <>
                                          <option value="narwhal">Narwhal (Fast)</option>
                                          <option value="flux_schnell">Flux Schnell</option>
                                          <option value="auto">Auto Model</option>
                                        </>
                                      )}
                                    </select>
                                    <button
                                      onClick={() => runImageGenForShot(sh, storyboardModels[shotIdVal] || defaultImageModel)}
                                      disabled={renderingStates[shotIdVal]?.includes('Đang')}
                                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[9.5px] font-black rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                                    >
                                      {renderingStates[shotIdVal]?.includes('Đang') ? (
                                        <Loader2 size={10} className="animate-spin text-white" />
                                      ) : (
                                        <Wand2 size={10} />
                                      )}
                                      <span>SINH ẢNH</span>
                                    </button>
                                  </div>
                                )}
                                {renderingStates[shotIdVal] && (
                                  <div className="text-[8.5px] font-bold text-indigo-400 bg-slate-950/40 border border-slate-850/80 rounded-lg px-2 py-0.5 text-center truncate">
                                    {renderingStates[shotIdVal]}
                                  </div>
                                )}
                              </div>

                              {/* Video Section */}
                              <div className="pt-2 border-t border-slate-800/45 space-y-1.5">
                                {hasVid ? (
                                  <div className="relative group/vid overflow-hidden rounded-xl border border-slate-855 bg-slate-950 aspect-video shadow-inner">
                                    <video 
                                      src={hasVid} 
                                      className="w-full h-full object-cover" 
                                      controls 
                                      playsInline 
                                      preload="metadata" 
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleExtractLastFrame(sh)}
                                      disabled={isExtractingFrame}
                                      className="absolute bottom-2 right-2 bg-indigo-650/90 hover:bg-indigo-600 text-white text-[8px] px-1.5 py-0.5 rounded font-black transition-all shadow-md active:scale-95 z-10 flex items-center gap-0.5 cursor-pointer border border-indigo-500/30 disabled:opacity-50"
                                      title="Trích xuất frame cuối của video này và đặt làm ảnh Storyboard cho Shot tiếp theo để nối raccord"
                                    >
                                      {isExtractingFrame ? (
                                        <Loader2 size={8} className="animate-spin" />
                                      ) : (
                                        <span>🪄 Lấy frame cuối cho Shot sau</span>
                                      )}
                                    </button>
                                  </div>
                                ) : sh.isApproved ? (
                                  <div className="text-[8.5px] text-slate-500 text-center italic py-2">
                                    Video bị khóa (Chưa sinh)
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <div className="flex gap-1">
                                      <select 
                                        value={getSanitizedVideoModel(videoModels[shotIdVal] || sh.videoModel || 'auto', videoProvider)} 
                                        onChange={e => setVideoModels(prev => ({ ...prev, [shotIdVal]: e.target.value }))}
                                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2 py-0.5 text-[9.5px] font-bold text-slate-355 outline-none focus:border-indigo-500/40"
                                      >
                                        {videoProvider === 'dreamina' && (
                                          <>
                                            <option value="auto">Auto Model (Mặc định)</option>
                                            <option value="dreamina_seedance_40_mini">Dreamina Seedance 2.0 Mini (New)</option>
                                            <option value="dreamina_seedance_40">Dreamina Seedance 2.0 Fast (New)</option>
                                            <option value="dreamina_seedance_40_pro">Dreamina Seedance 2.0 (New)</option>
                                            <option value="dreamina_lib_sync_image_quick_1.5">Dreamina Seedance 1.5 Pro (New)</option>
                                            <option value="dreamina_seedance_10">Dreamina Seedance 1.0</option>
                                          </>
                                        )}
                                        {videoProvider === 'google-native' && (
                                          <>
                                            <option value="veo-2.0-generate-001">Veo 2.0 Native</option>
                                            <option value="auto">Auto Model</option>
                                          </>
                                        )}
                                        {videoProvider === 'sdk' && (
                                          <>
                                            <option value="veo-3.1-fast-generate-001">Veo 3.1 Fast SDK</option>
                                            <option value="veo-2">Veo 2 SDK</option>
                                            <option value="auto">Auto Model</option>
                                          </>
                                        )}
                                        {videoProvider === 'hub' && (
                                          <>
                                            <option value="veo_3_1_r2v_lite_low_priority">Veo 3.1 Low (Pri)</option>
                                            <option value="veo_3_1_r2v_lite">Veo 3.1 Std</option>
                                            <option value="veo_3_1">Veo 3.1 HQ</option>
                                            <option value="dreamina">Dreamina</option>
                                            <option value="auto">Auto Model</option>
                                          </>
                                        )}
                                      </select>
                                      <button
                                        onClick={() => runVideoGenForShot(sh, videoModels[shotIdVal] || defaultVideoModel)}
                                        disabled={!sh.videoPrompt || videoStates[shotIdVal]?.includes('Đang')}
                                        className="px-3 py-1 bg-purple-600/20 hover:bg-purple-650 hover:text-white border border-purple-500/30 text-[9.5px] font-black text-purple-300 rounded-lg transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-45 disabled:pointer-events-none"
                                      >
                                        {videoStates[shotIdVal]?.includes('Đang') ? (
                                          <Loader2 size={10} className="animate-spin text-purple-400" />
                                        ) : (
                                          <Play size={10} />
                                        )}
                                        <span>VIDEO</span>
                                      </button>
                                    </div>
                                    {videoStates[shotIdVal] && (
                                      <div className="text-[8.5px] font-bold text-purple-400 bg-slate-950/40 border border-slate-850/80 rounded-lg px-2 py-0.5 text-center truncate">
                                        {videoStates[shotIdVal]}
                                      </div>
                                    )}
                                    {!sh.videoPrompt && (
                                      <div className="text-[7.5px] text-slate-500 text-center italic">
                                        Hãy sinh Video Prompt trước
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* 2. Transition Link (Causal Link Connector) */}
                          {mediaFilter === 'all' && shIdx < activeSceneShots.length - 1 && (
                            <div className="py-4 relative flex flex-col items-center justify-center">
                              {/* Vertical line connection with pulse dot */}
                              <div className="absolute inset-y-0 w-0.5 border-l-2 border-dashed border-indigo-500/20 z-0" />
                              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-indigo-500/40 animate-ping z-0" />
                              
                              {/* Row of Badges */}
                              <div className="flex flex-wrap items-center justify-center gap-1.5 relative z-10">
                                {(() => {
                                  const causalVal = sh.causalLink || sh.causal_link || '';
                                  const parsedTrans = parseTransitionString(causalVal);
                                  const causal = parsedTrans.causalLink || causalVal;
                                  const mainTransition = getMainTransition(causal);
                                  const isSoundBridge = String(causal || '').toLowerCase().includes('sound') || !!parsedTrans.audioSfxRules;
                                  const isVisualBridge = !!parsedTrans.visualBridge || String(causal || '').toLowerCase().includes('visual') || String(causal || '').toLowerCase().includes('match cut');
                                  const isGeometry = !!parsedTrans.transitionGeometry || String(causal || '').toLowerCase().includes('geometry');

                                  return (
                                    <>
                                      {/* Main Transition Badge */}
                                      {mainTransition && (
                                        <div 
                                          className="bg-[#161224] border border-purple-500/30 hover:border-purple-500/60 rounded-full px-3 py-0.5 text-[8.5px] font-black uppercase tracking-wider text-purple-300 hover:text-white shadow-md transition-all duration-300 flex items-center gap-1 shrink-0"
                                          title={causal}
                                        >
                                          <span>{getTransitionIcon(mainTransition)}</span>
                                          <span className="font-mono text-[7px] text-slate-500">TRANSITION:</span>
                                          <span className="text-purple-200">{mainTransition}</span>
                                        </div>
                                      )}

                                      {/* Sound Transition Badge */}
                                      {isSoundBridge && (
                                        <span className="bg-blue-950/40 border border-blue-500/20 text-blue-400 rounded-full px-2 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                                          🔊 Sound Transition
                                        </span>
                                      )}

                                      {/* Visual Transition Badge */}
                                      {isVisualBridge && (
                                        <span className="bg-emerald-950/40 border border-emerald-500/20 text-emerald-455 rounded-full px-2 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                                          👁️ Visual Transition
                                        </span>
                                      )}

                                      {/* Geometry Transition Badge */}
                                      {isGeometry && (
                                        <span className="bg-violet-950/40 border border-violet-500/20 text-violet-400 rounded-full px-2 py-0.5 text-[7.5px] font-extrabold uppercase tracking-wide flex items-center gap-1 shadow-sm">
                                          📐 Geometry
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Technical Details Box */}
                              {(() => {
                                const causalVal = sh.causalLink || sh.causal_link || '';
                                const parsedTrans = parseTransitionString(causalVal);
                                
                                const visualBridge = sh.transition?.visualBridge || sh.visualBridge || sh.visual_bridge || parsedTrans.visualBridge;
                                const transitionGeometry = sh.transition?.transitionGeometry || sh.transitionGeometry || sh.transition_geometry || parsedTrans.transitionGeometry;
                                const audioSfxRules = sh.transition?.audioSfxRules || sh.audioSfxRules || sh.audio_sfx_rules || parsedTrans.audioSfxRules;
                                
                                if (!visualBridge && !transitionGeometry && !audioSfxRules) return null;
                                
                                return (
                                  <div className="mt-2 mx-auto max-w-lg bg-[#0e0c1a]/95 border border-purple-950/70 p-2.5 rounded-xl text-[9px] text-slate-400 space-y-1 relative z-10 shadow-lg leading-relaxed text-center">
                                    {visualBridge && (
                                      <div>
                                        <span className="text-purple-400 shrink-0 font-bold">👁️ Visual: </span>
                                        <span className="text-slate-300 font-medium">{visualBridge}</span>
                                      </div>
                                    )}
                                    {transitionGeometry && (
                                      <div>
                                        <span className="text-violet-400 shrink-0 font-bold">📐 Geometry: </span>
                                        <span className="text-slate-300 font-medium">{transitionGeometry}</span>
                                      </div>
                                    )}
                                    {audioSfxRules && (
                                      <div>
                                        <span className="text-blue-455 shrink-0 font-bold">🔊 Audio/SFX: </span>
                                        <span className="text-slate-300 font-medium">{audioSfxRules}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Back Button bottom */}
            <button
              onClick={() => setActiveSceneId('all')}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[11px] font-black uppercase text-indigo-400 hover:text-indigo-300 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              ◀ Quay lại danh sách tổng quan cảnh
            </button>
          </div>
        )}
      </div>

      {/* Full Prompt View Overlay Dialog */}
      {viewingPromptShotId && viewingShot && (
        <div 
          className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setViewingPromptShotId(null)}
        >
          <div 
            className="bg-[#13131c] border border-slate-800/80 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4 text-left relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Dialog */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {viewingShot.beat}
                </span>
                <span className="text-sm font-black text-white">Full Storyboard Prompt</span>
              </div>
              <button 
                onClick={() => setViewingPromptShotId(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Prompt Textarea for editing and full view */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prompt Sinh Ảnh Storyboard</label>
              <textarea
                rows={10}
                value={viewingShot.storyboardPrompt || viewingShot.visual || viewingShot.hình_ảnh || ''}
                onChange={(e) => handleUpdateShot(viewingPromptShotId, 'storyboardPrompt', e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-[11px] font-mono leading-relaxed text-slate-200 outline-none focus:border-indigo-500/40"
                placeholder="Storyboard prompt detail..."
              />
            </div>

            {/* Actions Dialog */}
            <div className="flex justify-end pt-2 border-t border-slate-800/50">
              <button 
                onClick={() => setViewingPromptShotId(null)}
                className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-650/80 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Hoàn tất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Video Prompt View Overlay Dialog */}
      {viewingVideoPromptShotId && (
        (() => {
          const viewingShotForVideo = pendingShots.find((sh: any) => sh.id === viewingVideoPromptShotId || sh.beat === viewingVideoPromptShotId);
          if (!viewingShotForVideo) return null;
          return (
            <div 
              className="fixed inset-0 z-[10000] bg-black/95 flex items-center justify-center p-4"
              onClick={() => setViewingVideoPromptShotId(null)}
            >
              <div 
                className="bg-[#13131c] border border-slate-800/80 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4 text-left relative overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header Dialog */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                      {viewingShotForVideo.beat}
                    </span>
                    <span className="text-sm font-black text-white">Full Video Prompt</span>
                  </div>
                  <button 
                    onClick={() => setViewingVideoPromptShotId(null)}
                    className="text-slate-400 hover:text-white p-1"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Prompt Textarea for editing and full view */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Prompt Sinh Video</label>
                  <textarea
                    rows={10}
                    value={viewingShotForVideo.videoPrompt || viewingShotForVideo.video_prompt || ''}
                    onChange={(e) => handleUpdateShot(viewingVideoPromptShotId, 'videoPrompt', e.target.value)}
                    className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-[11px] font-mono leading-relaxed text-slate-200 outline-none focus:border-indigo-500/40"
                    placeholder="Nhập prompt sinh video chi tiết..."
                  />
                </div>

                {/* Actions Dialog */}
                <div className="flex justify-end pt-2 border-t border-slate-800/50">
                  <button 
                    onClick={() => setViewingVideoPromptShotId(null)}
                    className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-650/80 text-white rounded-lg text-[10px] font-black uppercase transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Zoom Image Overlay Dialog */}
      {selectedZoomImage && (
        <div 
          className="fixed inset-0 z-[10050] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setSelectedZoomImage(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedZoomImage(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <img 
              src={selectedZoomImage} 
              alt="Zoomed Storyboard Frame" 
              className="max-w-full max-h-[80vh] object-contain"
            />
            <div className="p-4 bg-slate-950/80 border-t border-slate-900 flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold font-mono">Storyboard Preview</span>
              <a 
                href={selectedZoomImage} 
                download 
                target="_blank" 
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
              >
                <Download size={14} /> Tải Ảnh Về
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ShotPlanNode);
