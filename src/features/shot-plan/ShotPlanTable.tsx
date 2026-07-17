import React, { useState, useRef } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { getSanitizedImageModel, getSanitizedVideoModel } from './ShotDetailModal';
import { Trash2, Plus, X, Film, Sparkles, Zap, Image as ImageIcon, Wand2, Loader2, Maximize2, Eye, Download, Play, MapPin, User, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { generateMediaViaGateway } from '../../utils/mediaGateway';
import { uploadFileToDB, createAssetInDB } from '../../services/api';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { runAdvancedQCAudit } from '../../utils/qcRulesManager';
import { safeMatchName, matchAssetWithMapping, cleanLocationName } from '../../utils/assetMatcher';
import { runCinematicPipeline } from '../../lib/cinematic-engine';


const normalizeCameraMovement = (val: any): string => {
  if (!val) return 'STATIC';
  const rawVal = typeof val === 'object' && val !== null ? (val.type || 'STATIC') : val;
  if (typeof rawVal !== 'string') return 'STATIC';
  const clean = rawVal.toUpperCase().trim();
  if (clean === 'STATIC TILT' || clean === 'STATIC') return 'STATIC';
  if (clean === 'PAN LEFT/RIGHT' || clean === 'PAN') return 'PAN_LEFT';
  if (clean === 'ZOOM IN/OUT' || clean === 'ZOOM') return 'ZOOM_IN';
  if (clean === 'DOLLY IN/OUT' || clean === 'DOLLY') return 'DOLLY_IN';
  if (clean === 'TRACKING SHOT' || clean === 'TRACKING') return 'TRACKING_L2R';
  if (clean === 'CRANE UP/DOWN' || clean === 'CRANE') return 'CRANE_UP';
  if (clean === 'HANDHELD') return 'HANDHELD';
  if (clean === 'ORBIT') return 'ORBIT';
  if (clean === 'TILT_UP') return 'TILT_UP';
  if (clean === 'TILT_DOWN') return 'TILT_DOWN';
  return clean;
};

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

// ─── Component ─────────────────────────────────────────────────────────────
export default function ShotPlanTable({ onBuild }: { onBuild: (assetImages: Record<string, string>, customShots?: any[]) => void }) {
  const pendingShots = useFlowStore((state) => state.pendingShots);
  const setPendingShots = useFlowStore((state) => state.setPendingShots);
  const parsedData = useFlowStore((state) => state.parsedData);
  const setParsedData = useFlowStore((state) => state.setParsedData);
  const projectData = useFlowStore((state) => state.projectData);
  const nodes = useFlowStore((state) => state.nodes);

  const syncWithCinematicPipeline = (shots: any[]) => {
    const prepared = shots.map((sh, idx) => {
      const copy = { ...sh };
      copy.scene_id = copy.sceneId || copy.sc || "SC01";
      copy.duration_target = parseFloat(copy.duration) || 4;
      copy.camera_movement = normalizeCameraMovement(copy.cameraMovement);
      copy.action_description = copy.diễn_tả || copy.description || "";
      copy.character_refs = copy.characterIds || copy.character_refs || [];
      
      delete copy.beat;
      delete copy.id;
      copy.shotNumber = idx + 1;
      return copy;
    });

    const result = runCinematicPipeline(prepared);
    setPendingShots(result.optimizedShots);
    useFlowStore.getState().setCinematicWarnings(result.warnings);
    useFlowStore.getState().setCinematicGlueNotes(result.glueNotes);
  };

  const handleInsertGlueShotTable = (insertIndex: number) => {
    const prevShot = pendingShots[insertIndex];
    const nextShot = pendingShots[insertIndex + 1];
    const sceneId = prevShot?.sceneId || prevShot?.sc || nextShot?.sceneId || nextShot?.sc || "SC01";

    const newGlueShot: any = {
      beat: `B${Date.now()}`,
      sc: sceneId,
      sceneId: sceneId,
      kind: 'action',
      duration: 3,
      cameraMovement: 'Static Tilt',
      angle: 'Eye-Level',
      diễn_tả: 'Cảnh trám B-Roll mô tả không khí bối cảnh.',
      hình_ảnh: 'Bố cục, góc máy, ánh sáng...',
      thoại: '',
      is_glue: true,
      objective: "Chèn cảnh trám để che điểm nối trục máy.",
      location: prevShot?.location || prevShot?.bối_cảnh || nextShot?.location || ""
    };

    const newShots = [...pendingShots];
    newShots.splice(insertIndex + 1, 0, newGlueShot);
    syncWithCinematicPipeline(newShots);
  };

  const imageProvider = useFlowStore(state => state.imageProvider) || 'hub';
  const videoProvider = useFlowStore(state => state.videoProvider) || 'hub';
  const hubImageModel = useFlowStore(state => state.hubImageModel) || 'auto';
  const hubVideoModel = useFlowStore(state => state.hubVideoModel) || 'auto';
  const sdkImageModel = useFlowStore(state => state.sdkImageModel) || 'imagen-3';
  const sdkVideoModel = useFlowStore(state => state.sdkVideoModel) || 'veo-3.1-fast-generate-001';
  const googleImageModel = useFlowStore(state => state.googleImageModel) || 'imagen-3.0-fast-002';
  const googleVideoModel = useFlowStore(state => state.googleVideoModel) || 'veo-2.0-generate-001';
  const dreaminaImageModel = useFlowStore(state => state.dreaminaImageModel) || 'high_aes_general_v50';
  const dreaminaVideoModel = useFlowStore(state => state.dreaminaVideoModel) || 'dreamina_seedance_40';

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

  const [generatingStates, setGeneratingStates] = useState<Record<string, string>>({});
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [collapsedScenes, setCollapsedScenes] = useState<Record<string, boolean>>({});
  const [activeDetailBeat, _setActiveDetailBeat] = useState<string | null>(null);
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const [videoGeneratingStates, setVideoGeneratingStates] = useState<Record<string, string>>({});
  const [storyboardModels, setStoryboardModels] = useState<Record<string, string>>({});
  const [batchQueueStatus, setBatchQueueStatus] = useState<{
    sceneId: string;
    type: 'image' | 'video';
    total: number;
    current: number;
    currentShotId: string | null;
    statusText: string;
    isPausedForCaptcha: boolean;
  } | null>(null);
  const cancelBatchRef = useRef<boolean>(false);

  const customProjectRules = useFlowStore((state) => state.customProjectRules || []);
  const customEpisodeRules = useFlowStore((state) => state.customEpisodeRules || []);
  const [activeDetailTab, setActiveDetailTab] = useState<'image' | 'video'>('image');
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);

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
      const resUpdate = await fetch(`${baseUrl}/world-asset/projects/${projectId}/shots/${currentShotId}`, {
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

  const setActiveDetailBeat = (beat: string | null) => {
    _setActiveDetailBeat(beat);
    if (beat !== null) {
      setActiveDetailTab('image');
    }
  };

  // Letta QC consistency check
  const [lettaViolations, setLettaViolations] = useState<any[]>([]);
  const [lettaVideoViolations, setLettaVideoViolations] = useState<any[]>([]);
  const [isCheckingLetta, setIsCheckingLetta] = useState(false);

  const activeShot = pendingShots.find(s => s.beat === activeDetailBeat);
  const activePrompt = activeShot?.storyboardPrompt || activeShot?.visual || activeShot?.hình_ảnh || '';
  const activeVideoPrompt = activeShot?.videoPrompt || activeShot?.video_prompt || '';
  const activeCharIds = activeShot?.characterIds || [];

  const [debouncedPrompt, setDebouncedPrompt] = useState('');
  const [debouncedVideoPrompt, setDebouncedVideoPrompt] = useState('');

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPrompt(activePrompt);
    }, 400);
    return () => clearTimeout(handler);
  }, [activePrompt]);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedVideoPrompt(activeVideoPrompt);
    }, 400);
    return () => clearTimeout(handler);
  }, [activeVideoPrompt]);

  React.useEffect(() => {
    let active = true;
    const check = async () => {
      if (!debouncedPrompt) {
        setLettaViolations([]);
        return;
      }
      const projectId = projectData?.selectedProjectId || projectData?.selectedUniverseId || projectData?.id;
      if (!projectId || projectId === 'new') return;

      const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
      const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
      
      const charNames = activeCharIds.map((id: string) => {
        const c = allCharacters.find((char: any) => char.worldAssetCharId === id);
        return c ? c.name : null;
      }).filter(Boolean) as string[];

      if (charNames.length === 0) {
        setLettaViolations([]);
        return;
      }

      try {
        setIsCheckingLetta(true);
        const { checkPromptConsistency } = await import('../../services/api');
        const res = await checkPromptConsistency(projectId, debouncedPrompt, charNames);
        if (active && res.status === 'violations_found' && res.violations) {
          setLettaViolations(res.violations);
        } else if (active) {
          setLettaViolations([]);
        }
      } catch (err) {
        console.warn("[QCAudit] Letta consistency check failed:", err);
      } finally {
        if (active) setIsCheckingLetta(false);
      }
    };
    check();
    return () => { active = false; };
  }, [debouncedPrompt, activeCharIds, projectData, nodes]);

  React.useEffect(() => {
    let active = true;
    const check = async () => {
      if (!debouncedVideoPrompt) {
        setLettaVideoViolations([]);
        return;
      }
      const projectId = projectData?.selectedProjectId || projectData?.selectedUniverseId || projectData?.id;
      if (!projectId || projectId === 'new') return;

      const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
      const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
      
      const charNames = activeCharIds.map((id: string) => {
        const c = allCharacters.find((char: any) => char.worldAssetCharId === id);
        return c ? c.name : null;
      }).filter(Boolean) as string[];

      if (charNames.length === 0) {
        setLettaVideoViolations([]);
        return;
      }

      try {
        const { checkPromptConsistency } = await import('../../services/api');
        const res = await checkPromptConsistency(projectId, debouncedVideoPrompt, charNames);
        if (active && res.status === 'violations_found' && res.violations) {
          setLettaVideoViolations(res.violations);
        } else if (active) {
          setLettaVideoViolations([]);
        }
      } catch (err) {
        console.warn("[QCAudit] Letta video consistency check failed:", err);
      }
    };
    check();
    return () => { active = false; };
  }, [debouncedVideoPrompt, activeCharIds, projectData, nodes]);


  const handleAiRegeneratePrompt = async (sh: any) => {
    try {
      const { compileCinematicPrompt } = await import('../../lib/cinematic-engine/promptBuilder');
      const projectStyle = projectData?.stylePrompt || "Pixar-style 3D animation";
      
      const charRefs = (sh.characterIds || []).map((id: string) => {
        const c = allCharacters.find((char: any) => char.worldAssetCharId === id);
        return c ? c.name : null;
      }).filter(Boolean);

      const compiled = compileCinematicPrompt({
        ...sh,
        description: sh.diễn_tả || sh.description || "",
        character_refs: charRefs
      }, projectStyle);

      const newStoryboardPrompt = compiled.promptText;

      const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
      const durationVal = sh.duration || 4;
      const videoRes = await generateVideoScriptPrompt(newStoryboardPrompt, durationVal);
      const newVideoPrompt = videoRes?.videoPrompt || `[00:00-00:04] SHOT ${sh.beat || sh.id}. ${newStoryboardPrompt}`;

      handleUpdateField(sh.beat, 'storyboardPrompt', newStoryboardPrompt);
      handleUpdateField(sh.beat, 'visual', newStoryboardPrompt);
      handleUpdateField(sh.beat, 'hình_ảnh', newStoryboardPrompt);
      handleUpdateField(sh.beat, 'videoPrompt', newVideoPrompt);
      handleUpdateField(sh.beat, 'video_prompt', newVideoPrompt);

      alert("🎉 Đã sinh lại prompt vẽ ảnh & video thành công!");
    } catch (err: any) {
      alert("Lỗi AI Regenerate Prompt: " + err.message);
    }
  };

  const handleGenerateVideo = async (sh: any, throwOnError: boolean = false) => {
    const beatId = sh.beat;
    setVideoGeneratingStates(prev => ({ ...prev, [beatId]: 'Đang gửi...' }));
    try {
      const storyboardUrl = sh.renderUrl || sh.imageUrl;
      if (!storyboardUrl) {
        if (throwOnError) {
          throw new Error("Vui lòng vẽ ảnh Storyboard trước khi dựng Video");
        }
        alert("⚠️ Vui lòng vẽ ảnh Storyboard trước khi dựng Video.");
        setVideoGeneratingStates(prev => ({ ...prev, [beatId]: '' }));
        return;
      }
      if (!sh.videoPrompt) {
        if (throwOnError) {
          throw new Error("Video chưa có Prompt");
        }
        alert("⚠️ Video chưa có Prompt. Vui lòng sinh hoặc nhập video prompt.");
        setVideoGeneratingStates(prev => ({ ...prev, [beatId]: '' }));
        return;
      }

      let mediaIds: string[] = [storyboardUrl];
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      const baseUrl = getApiBaseUrl();

      const charRefs = sh.character_refs || sh.characterIds || [];
      const matchedChars = charRefs.map((id: string) => {
        return allCharacters.find((c: any) => c.worldAssetCharId === id || c.name === id);
      }).filter(Boolean);

      matchedChars.forEach((c: any) => {
        const resolved = c.mediaId || (useRemote ? c.imageUrl : null);
        if (resolved && !mediaIds.includes(resolved)) mediaIds.push(resolved);
      });

      let activeVideoModel = getSanitizedVideoModel(sh.videoModel || 'auto', videoProvider);
      if (activeVideoModel === 'auto') {
        activeVideoModel = defaultVideoModel;
      }

      const response = await generateMediaViaGateway({
        prompt: sh.videoPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: mediaIds,
        ratio: '16:9',
        mediaType: 'video',
        videoModelKey: activeVideoModel,
        ipId: beatId,
        entityType: 'scene',
        storyboardFrameUrl: storyboardUrl,
        duration: `${sh.duration || 4}s`
      }, (status) => setVideoGeneratingStates(prev => ({ ...prev, [beatId]: status })));

      const videoUrl = response.url || (response.images && response.images[0]?.url);
      if (response.success && videoUrl) {
        handleUpdateField(beatId, 'videoUrl', videoUrl);
        handleUpdateField(beatId, 'video_url', videoUrl);
        setVideoGeneratingStates(prev => ({ ...prev, [beatId]: 'Xong' }));
      } else {
        const errorMsg = response.error || "Không có phản hồi";
        const opIdStr = response.operationIds && response.operationIds.length > 0 ? ` [Job ID: ${response.operationIds.join(', ')}]` : '';
        setVideoGeneratingStates(prev => ({ ...prev, [beatId]: 'Lỗi: ' + errorMsg + opIdStr }));
        if (throwOnError) {
          throw new Error(errorMsg + opIdStr);
        } else {
          alert("❌ Lỗi dựng video: " + errorMsg + opIdStr);
        }
      }
    } catch (e: any) {
      setVideoGeneratingStates(prev => ({ ...prev, [beatId]: 'Lỗi: ' + e.message }));
      if (throwOnError) {
        throw e;
      } else {
        alert("❌ Lỗi dựng video: " + e.message);
      }
    }
  };

  const handleAiAnalyzeShots = async (sceneId: string) => {
    const sceneShots = pendingShots.filter((sh: any) => {
      const shSceneId = sh.sceneId || sh.sc || sh.scene_id || '';
      return isSameScene(shSceneId, sceneId);
    });

    if (sceneShots.length === 0) return;
    if (!confirm(`Sếp có muốn sử dụng AI (Gemini 2.5) để phân tích ngữ cảnh, tự động map đại từ nhân xưng và bối cảnh cho ${sceneShots.length} shots trong Cảnh ${sceneId} không?`)) {
      return;
    }
    
    setIsAnalyzingAi(true);

    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
      const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : (parsedData?.characters || []);
      const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : (parsedData?.locations || []);
      const allProps = worldAssetNode ? (worldAssetNode.data.props || []) : (parsedData?.props || []);

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

      const universeProps = allProps.map((p: any) => ({
        id: p.id || p.name || (typeof p === 'string' ? p : ''),
        name: p.name || (typeof p === 'string' ? p : ''),
        aliases: p.aliases || ''
      }));

      const shotsPayload = sceneShots.map((sh: any) => ({
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

  // States for Slice Panel tool
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [activeSliceShot, setActiveSliceShot] = useState<any>(null);
  const [slicingStates, setSlicingStates] = useState<Record<number, string>>({});

  const handleOpenSliceModal = (sh: any) => {
    setActiveSliceShot(sh);
    setSlicingStates({});
    setSliceModalOpen(true);
  };

  const handleSaveSlice = async (idx: number, row: number, col: number, totalRows: number, totalCols: number) => {
    if (!activeSliceShot) return;
    const imageUrl = activeSliceShot.imageUrl || activeSliceShot.renderUrl;
    if (!imageUrl) return;

    setSlicingStates(prev => ({ ...prev, [idx]: 'Đang cắt...' }));

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Canvas context is not available");

      const subWidth = img.naturalWidth / totalCols;
      const subHeight = img.naturalHeight / totalRows;

      canvas.width = subWidth;
      canvas.height = subHeight;

      ctx.drawImage(
        img,
        col * subWidth, row * subHeight, subWidth, subHeight,
        0, 0, subWidth, subHeight
      );

      setSlicingStates(prev => ({ ...prev, [idx]: 'Đang lưu...' }));

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error("Failed to create blob from canvas");

      const uploadRes = await uploadFileToDB(blob, `slice_${activeSliceShot.beat}_${idx}.jpg`);
      const finalUrl = uploadRes.url;

      await createAssetInDB({
        ipId: activeSliceShot.locationId || null,
        assetType: 'image',
        driveUrl: finalUrl,
        tags: ['angle-slice', `beat-${activeSliceShot.beat}`, `grid-${activeSliceShot.panelGrid}`, 'paco-bible'],
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        episodeId: activeSliceShot.episodeId || undefined,
        sceneId: activeSliceShot.sceneId || undefined
      });

      setSlicingStates(prev => ({ ...prev, [idx]: 'Đã lưu Ref!' }));
    } catch (err: any) {
      console.error(err);
      setSlicingStates(prev => ({ ...prev, [idx]: `Lỗi: ${err.message || err}` }));
    }
  };

  if (!pendingShots || pendingShots.length === 0) return null;

  const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
  const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
  const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];

  const runBatchGenForScene = async (sceneId: string, type: 'image' | 'video') => {
    if (batchQueueStatus) {
      alert("⚠️ Đang có một hàng đợi sinh media khác đang chạy!");
      return;
    }

    const sceneShots = (groupedShots[sceneId] || []).filter((sh: any) => {
      if (sh.isApproved) return false;
      if (type === 'image') {
        const promptText = sh.visual || sh.hình_ảnh || sh.diễn_tả || sh.description || '';
        return !!promptText;
      } else {
        return !!sh.videoPrompt;
      }
    });

    if (sceneShots.length === 0) {
      alert(`⚠️ Không tìm thấy shot nào đủ điều kiện sinh ${type === 'image' ? 'storyboard' : 'video'} (Chưa khóa & có Prompt) trong Cảnh ${sceneId}.`);
      return;
    }

    cancelBatchRef.current = false;
    setBatchQueueStatus({
      sceneId,
      type,
      total: sceneShots.length,
      current: 0,
      currentShotId: null,
      statusText: "Bắt đầu hàng đợi sinh media...",
      isPausedForCaptcha: false
    });

    for (let i = 0; i < sceneShots.length; i++) {
      if (cancelBatchRef.current) {
        setBatchQueueStatus(null);
        alert("🛑 Hàng đợi đã bị hủy bởi người dùng.");
        return;
      }

      const sh = sceneShots[i];
      const beatId = sh.beat;

      setBatchQueueStatus(prev => prev ? {
        ...prev,
        current: i + 1,
        currentShotId: beatId,
        statusText: `Đang xử lý shot ${beatId} (${i + 1}/${sceneShots.length})...`,
        isPausedForCaptcha: false
      } : null);

      let attempts = 0;
      let success = false;

      while (!success && !cancelBatchRef.current) {
        try {
          if (type === 'image') {
            await handleGenerateStoryboard(sh, true);
          } else {
            await handleGenerateVideo(sh, true);
          }
          success = true;
        } catch (err: any) {
          attempts++;
          const errMsg = err.message || '';
          console.warn(`[BatchQueue Table] Error on shot ${beatId} (Attempt ${attempts}):`, errMsg);

          // 1. CAPTCHA Check
          const isCaptcha = /captcha|verification|robot|cloudflare|puzzle/i.test(errMsg);
          if (isCaptcha) {
            setBatchQueueStatus(prev => prev ? {
              ...prev,
              statusText: `⚠️ Phát hiện Captcha tại Shot ${beatId}. Vui lòng giải captcha. Tự động thử lại sau 15 giây...`,
              isPausedForCaptcha: true
            } : null);
            await new Promise(resolve => setTimeout(resolve, 15000));
            continue;
          }

          // 2. Rate Limit Check (429)
          const isRateLimit = /429|rate limit|too many requests|quota exceeded|busy/i.test(errMsg);
          if (isRateLimit) {
            if (attempts >= 3) {
              console.error(`[BatchQueue Table] Rate limit persisted for shot ${beatId}. Skipping.`);
              break;
            }
            const waitTimeSec = attempts * 8;
            setBatchQueueStatus(prev => prev ? {
              ...prev,
              statusText: `⏳ Rate limit tại Shot ${beatId}. Thử lại sau ${waitTimeSec} giây (Lần ${attempts}/3)...`,
              isPausedForCaptcha: false
            } : null);
            await new Promise(resolve => setTimeout(resolve, waitTimeSec * 1000));
            continue;
          }

          // 3. Network / CORS Check
          const isNetwork = /failed to fetch|network error|networkrequestfailed|network request failed/i.test(errMsg);
          if (isNetwork) {
            if (attempts >= 3) {
              console.error(`[BatchQueue Table] Network/CORS error persisted for shot ${beatId}. Skipping.`);
              break;
            }
            const actualWait = attempts === 1 ? 3 : (attempts === 2 ? 6 : 12);
            setBatchQueueStatus(prev => prev ? {
              ...prev,
              statusText: `🌐 Lỗi Mạng/CORS tại Shot ${beatId}. Thử lại sau ${actualWait} giây (Lần ${attempts}/3)...`,
              isPausedForCaptcha: false
            } : null);
            await new Promise(resolve => setTimeout(resolve, actualWait * 1000));
            continue;
          }

          // Other non-recoverable errors
          console.error(`[BatchQueue Table] Non-recoverable error for shot ${beatId}:`, errMsg);
          break;
        }
      }

      // Safe Cooldown 1.5s
      if (success && i < sceneShots.length - 1 && !cancelBatchRef.current) {
        setBatchQueueStatus(prev => prev ? {
          ...prev,
          statusText: `✅ Thành công Shot ${beatId}. Nghỉ 1.5 giây để tránh rate limit...`
        } : null);
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    setBatchQueueStatus(null);
    alert(`🎉 Đã hoàn thành tiến trình sinh hàng loạt ${type === 'image' ? 'Storyboard' : 'Video'} cho Cảnh ${sceneId}!`);
  };

  const handleGenerateStoryboard = async (sh: any, throwOnError: boolean = false) => {
    const beatId = sh.beat;
    setGeneratingStates(prev => ({ ...prev, [beatId]: 'Đang gửi...' }));
    
    try {
      const finalPromptText = sh.visual || sh.hình_ảnh || sh.diễn_tả || sh.description || '';
      if (!finalPromptText) {
        if (throwOnError) {
          throw new Error("Mô tả hình ảnh/Prompt trống");
        }
        alert("⚠️ Vui lòng điền mô tả hành động hoặc hướng dẫn hình ảnh để tạo prompt.");
        setGeneratingStates(prev => ({ ...prev, [beatId]: '' }));
        return;
      }
      
      let mediaIds: string[] = [];
      const linkedEntities: Array<{ entityId: string; role: string }> = [];
      const promptLower = finalPromptText.toLowerCase();
      
      const selectedLocId = sh.locationId;
      const selectedCharIds = sh.characterIds || [];
      
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      const baseUrl = getApiBaseUrl();
      const cameraTag = detectCameraTag(promptLower, sh.angle || sh.camera_angle || sh.framing || sh.kind);

      // Resolve Location (Ưu tiên thủ công)
      if (selectedLocId) {
        const loc = allLocations.find((l: any) => l.worldAssetCharId === selectedLocId);
        if (loc) {
          const resolvedMedia = await resolveReferencedAssetMedia(
             selectedLocId,
             cameraTag,
             loc.mediaId || null,
             loc.imageUrl || null,
             useRemote,
             projectData?.id || '',
             baseUrl
          );
          if (resolvedMedia) {
             mediaIds.push(resolvedMedia);
             linkedEntities.push({ entityId: selectedLocId, role: 'location' });
          }
        }
      } else {
        const sceneLocName = (sh.sceneId || sh.sc || "").toLowerCase().trim();
        const matchedLoc = allLocations.find((loc: any) => {
          const name = (loc.name || "").toLowerCase().trim();
          return name && (name === sceneLocName || name.includes(sceneLocName) || sceneLocName.includes(name) || promptLower.includes(name));
        });
        if (matchedLoc && matchedLoc.worldAssetCharId) {
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

      // Resolve Characters (Ưu tiên thủ công)
      if (selectedCharIds.length > 0) {
        for (const charId of selectedCharIds) {
          const char = allCharacters.find((c: any) => c.worldAssetCharId === charId);
          if (char && charId) {
            const resolvedMedia = await resolveReferencedAssetMedia(
               charId,
               cameraTag,
               char.mediaId || null,
               char.imageUrl || null,
               useRemote,
               projectData?.id || '',
               baseUrl
            );
            if (resolvedMedia) {
               mediaIds.push(resolvedMedia);
               linkedEntities.push({ entityId: charId, role: 'character' });
            }
          }
        }
      }
      
      // Auto-match characters in prompt
      for (const char of allCharacters) {
        const name = (char.name || "").toLowerCase().trim();
        if (name && promptLower.includes(name) && char.worldAssetCharId) {
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
      console.log(`[StoryMee][Table] Resolved reference images mediaIds (useRemote: ${useRemote}):`, mediaIds);
      
      let finalPrompt = finalPromptText;
      const missingNames: string[] = [];
      
      // Check which characters are primary/selected in this shot
      if (selectedCharIds.length > 0) {
         selectedCharIds.forEach((charId: string) => {
            const char = allCharacters.find((c: any) => c.worldAssetCharId === charId);
            if (char && char.name && !promptLower.includes(char.name.toLowerCase().trim())) {
               missingNames.push(char.name);
            }
         });
      }

      if (missingNames.length > 0) {
         finalPrompt += `\n**CHARACTER REFERENCES:** Ensure consistent appearance for: ${missingNames.join(', ')}.`;
      }

      let activeImageModel = getSanitizedImageModel(sh.storyboardModel || 'auto', imageProvider);
      if (activeImageModel === 'auto') {
        activeImageModel = defaultImageModel;
      }

      const response = await generateMediaViaGateway({
        prompt: finalPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: mediaIds,
        ratio: '16:9',
        mediaType: 'image',
        linkedEntities: linkedEntities,
        ipId: beatId,
        entityType: 'scene',
        renderMode: sh.renderMode || 'combined',
        gridFormat: sh.panelGrid === '2x2' ? '2x2' : (sh.panelGrid === '2x3' ? '2x3' : '1x1'),
        videoModelKey: activeImageModel
      }, (status) => setGeneratingStates(prev => ({ ...prev, [beatId]: status })));
      
      if (response.success && response.images && response.images.length > 0) {
        const finalUrl = response.images[0].url;
        const finalId = response.images[0].mediaId || response.images[0].id || finalUrl;
        
        // Auto sync variant to DB
        if (linkedEntities.length > 0 && finalUrl) {
           const headers: any = { 'Content-Type': 'application/json' };
           const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
           if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

           linkedEntities.forEach(ent => {
              if (ent.role === 'character') {
                 const tagId = `shot_gen_${beatId.toLowerCase()}_${Date.now()}`;
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

        handleUpdateField(beatId, 'imageUrl', finalUrl);
        handleUpdateField(beatId, 'renderUrl', finalUrl);
        handleUpdateField(beatId, 'generatedMediaId', finalId);
        
        setGeneratingStates(prev => ({ ...prev, [beatId]: 'Xong' }));
      } else {
        const errorMsg = response.error || "Không có phản hồi";
        const opIdStr = response.operationIds && response.operationIds.length > 0 ? ` [Job ID: ${response.operationIds.join(', ')}]` : '';
        setGeneratingStates(prev => ({ ...prev, [beatId]: 'Lỗi: ' + errorMsg + opIdStr }));
        if (throwOnError) {
          throw new Error(errorMsg + opIdStr);
        } else {
          alert("❌ Lỗi vẽ ảnh: " + errorMsg + opIdStr);
        }
      }
    } catch (e: any) {
      setGeneratingStates(prev => ({ ...prev, [beatId]: 'Lỗi: ' + e.message }));
      if (throwOnError) {
        throw e;
      } else {
        alert("❌ Lỗi vẽ ảnh: " + e.message);
      }
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleUpdateField = (beatId: string, field: string, value: any) => {
    const updatedShots = pendingShots.map((sh) => {
      if (sh.beat === beatId || sh.id === beatId) {
        const updated = { ...sh, [field]: value };
        if (field === 'diễn_tả') {
          updated.description = value;
        }
        if (field === 'hình_ảnh') {
          updated.visual = value;
        }
        if (field === 'thoại') {
          updated.dialogue = value;
          updated.dialog = value;
        }
        if (field === 'mục_tiêu') {
          updated.objective = value;
        }

        // Camera Height / Angle Height updates
        if (field === 'cameraHeight') {
          updated.camera_angle = {
            ...(updated.camera_angle || { bearing: 20, side: 'A' }),
            height: value
          };
          const displayHeight = value === 'EYE' ? 'EYE' : value === 'HIGH' ? 'HIGH' : value === 'LOW' ? 'LOW' : value === 'BIRD' ? 'BIRD' : 'EYE';
          updated.angle = `${displayHeight}-Level (Bearing: ${updated.camera_angle.bearing || 20}°, Side: ${updated.camera_angle.side || 'A'})`;
        }

        // Camera Bearing updates
        if (field === 'cameraBearing') {
          updated.camera_angle = {
            ...(updated.camera_angle || { height: 'EYE', side: 'A' }),
            bearing: Number(value) || 0
          };
          const displayHeight = updated.camera_angle.height || 'EYE';
          updated.angle = `${displayHeight}-Level (Bearing: ${value}°, Side: ${updated.camera_angle.side || 'A'})`;
        }

        // Camera Side updates
        if (field === 'cameraSide') {
          updated.camera_angle = {
            ...(updated.camera_angle || { height: 'EYE', bearing: 20 }),
            side: value
          };
          const displayHeight = updated.camera_angle.height || 'EYE';
          updated.angle = `${displayHeight}-Level (Bearing: ${updated.camera_angle.bearing || 20}°, Side: ${value})`;
        }

        return updated;
      }
      return sh;
    });

    syncWithCinematicPipeline(updatedShots);
  };

  const handleDeleteShot = (beatId: string) => {
    const updated = pendingShots.filter((sh) => sh.beat !== beatId && sh.id !== beatId);
    syncWithCinematicPipeline(updated);
  };

  const handleAddShot = () => {
    const nextIndex = pendingShots.length + 1;
    const last = pendingShots[pendingShots.length - 1];
    const newShot = {
      beat: `B${String(nextIndex).padStart(2, '0')}`,
      sc: last?.sc || 'SC01',
      sceneId: last?.sceneId || 'Scene 1',
      kind: 'action',
      function: 'rising_action',
      duration: 4,
      cameraMovement: 'Static Tilt',
      angle: 'Eye-Level',
      diễn_tả: 'Mô tả hành động mới...',
      hình_ảnh: 'Bố cục, góc máy, ánh sáng...',
      thoại: '',
      mục_tiêu: '',
      causalLink: '',
      panelGrid: '1x1',
      renderMode: 'combined',
      detectedCharacters: [],
      detectedProps: [],
    };
    syncWithCinematicPipeline([...pendingShots, newShot]);
  };

  const handleAutoSuggestGrids = () => {
    // Group beats by scene id
    const groups: Record<string, typeof pendingShots> = {};
    pendingShots.forEach((sh) => {
      const sceneId = sh.sceneId || sh.sc || 'SC01';
      if (!groups[sceneId]) groups[sceneId] = [];
      groups[sceneId].push(sh);
    });

    // Determine layout for each group
    const updatedShots = pendingShots.map((sh) => {
      const sceneId = sh.sceneId || sh.sc || 'SC01';
      const count = groups[sceneId].length;
      let grid = '1x1';
      if (count === 2) grid = '1x2';
      else if (count >= 3 && count <= 4) grid = '2x2';
      else if (count >= 5 && count <= 6) grid = '2x3';
      else if (count > 6) grid = '3x3';
      return { ...sh, panelGrid: grid };
    });

    setPendingShots(updatedShots);
  };

  const handleOptimizeFraming = () => {
    const anglePool = ['Close-up', 'Medium Shot', 'Wide / Establishing', 'Over the Shoulder', 'Extreme Close-up'];
    const updatedShots = pendingShots.map((sh) => ({ ...sh }));
    
    for (let i = 1; i < updatedShots.length; i++) {
      const prev = updatedShots[i - 1];
      const curr = updatedShots[i];
      
      const prevScene = prev.sceneId || prev.sc || 'SC01';
      const currScene = curr.sceneId || curr.sc || 'SC01';
      
      // Only optimize within the same scene
      if (prevScene === currScene) {
        const prevAngle = prev.angle || 'Eye-Level';
        const currAngle = curr.angle || 'Eye-Level';
        
        if (prevAngle === currAngle) {
          // Change the current angle to something else in the pool to avoid jump cut
          const available = anglePool.filter(a => a !== prevAngle);
          const newAngle = available[Math.floor(Math.random() * available.length)];
          curr.angle = newAngle;
        }
      }
    }
    
    setPendingShots(updatedShots);
  };

  const handleConfirmAndBuild = () => {
    if (parsedData) {
      setParsedData({ ...parsedData, shots: pendingShots });
    }
    onBuild({}, pendingShots);
    setPendingShots([]);
  };

  // ── Derived Stats ─────────────────────────────────────────────────────────
  const totalDuration = pendingShots.reduce((acc, sh) => acc + (sh.duration || 4), 0);
  const sceneCounts: Record<string, number> = {};
  pendingShots.forEach((sh) => {
    const key = sh.sceneId || sh.sc || 'SC01';
    sceneCounts[key] = (sceneCounts[key] || 0) + 1;
  });
  const sceneGroups = Object.entries(sceneCounts);

  // Group pendingShots by sceneId for collapsible grouping
  const groupedShots: Record<string, typeof pendingShots> = {};
  pendingShots.forEach((sh) => {
    const sId = sh.sceneId || sh.sc || 'SC01';
    if (!groupedShots[sId]) groupedShots[sId] = [];
    groupedShots[sId].push(sh);
  });

  const renderQCAuditPanel = (
    promptText: string,
    shotKind: string,
    characterIds: string[],
    locationId: string,
    activeModel: string,
    lettaViolationsList: any[] = []
  ) => {
    const result = runAdvancedQCAudit(
      promptText,
      shotKind,
      characterIds,
      locationId,
      activeModel,
      customProjectRules,
      customEpisodeRules
    );

    // Risk Flag styling
    let riskBadgeColor = 'bg-emerald-950/40 border-emerald-500/30 text-emerald-400';
    let riskLabel = 'SẴN SÀNG (READY)';
    if (result.suggestedRiskFlag === 'NEED REF') {
      riskBadgeColor = 'bg-amber-950/40 border-amber-500/30 text-amber-400';
      riskLabel = 'THIẾU ẢNH REF (NEED REF)';
    } else if (result.suggestedRiskFlag === 'NEED PATCH' || lettaViolationsList.length > 0) {
      riskBadgeColor = 'bg-orange-950/40 border-orange-500/30 text-orange-400';
      riskLabel = lettaViolationsList.length > 0 ? 'VI PHẠM THIẾT KẾ (DNA VIOLATION)' : 'CẦN SỬA PROMPT (NEED PATCH)';
    } else if (result.suggestedRiskFlag === 'NEED SPLIT') {
      riskBadgeColor = 'bg-rose-955/40 border-rose-500/30 text-rose-455';
      riskLabel = 'CẦN TÁCH SHOT (NEED SPLIT)';
    } else if (result.suggestedRiskFlag === 'NEED DIRECTOR DECISION') {
      riskBadgeColor = 'bg-fuchsia-955/40 border-fuchsia-500/30 text-fuchsia-400';
      riskLabel = 'CẦN ĐẠO DIỄN CHỐT (NEED DIRECTOR DECISION)';
    }

    // Word Budget Status styling
    let budgetColor = 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400';
    if (result.wordBudgetStatus === 'caution') {
      budgetColor = 'bg-amber-950/30 border-amber-900/40 text-amber-400';
    } else if (result.wordBudgetStatus === 'danger') {
      budgetColor = 'bg-rose-955/30 border-rose-900/40 text-rose-450';
    } else if (result.wordBudgetStatus === 'low') {
      budgetColor = 'bg-slate-900 border-slate-800 text-slate-400';
    }

    return (
      <div className="bg-[#121217] border border-slate-850 rounded-2xl p-4 space-y-3.5 shadow-inner">
        {/* Header Panel */}
        <div className="flex items-center justify-between border-b border-slate-855/60 pb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-[10px] font-black text-slate-355 uppercase tracking-widest">KẾT QUẢ KIỂM TRA CHẤT LƯỢNG (QC AUDIT)</span>
          </div>
          <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${riskBadgeColor}`}>
            {riskLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* Word budget */}
          <div className="bg-[#0b0b0d] border border-slate-900 p-2.5 rounded-xl flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">NGÂN SÁCH TỪ</span>
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-white font-mono">{result.wordCount} từ</span>
              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold border ${budgetColor}`}>
                {result.wordBudgetMessage}
              </span>
            </div>
          </div>

          {/* Structure syntax */}
          <div className="bg-[#0b0b0d] border border-slate-900 p-2.5 rounded-xl flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">CÚ PHÁP SEEDANCE 2.0</span>
            <div className="flex gap-1">
              <span className={`flex-1 text-center py-0.5 rounded text-[8px] font-black border uppercase ${result.hasStart ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-slate-900 border-slate-850 text-slate-600'}`}>Start</span>
              <span className={`flex-1 text-center py-0.5 rounded text-[8px] font-black border uppercase ${result.hasMotion ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-slate-900 border-slate-850 text-slate-600'}`}>Motion</span>
              <span className={`flex-1 text-center py-0.5 rounded text-[8px] font-black border uppercase ${result.hasCamera ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-slate-900 border-slate-850 text-slate-600'}`}>Camera</span>
              <span className={`flex-1 text-center py-0.5 rounded text-[8px] font-black border uppercase ${result.hasEnd ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-400 font-extrabold' : 'bg-slate-900 border-slate-850 text-slate-600'}`}>End</span>
            </div>
          </div>

          {/* Negative locks */}
          <div className="bg-[#0b0b0d] border border-slate-900 p-2.5 rounded-xl flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-1">NEGATIVE LOCKS (TỪ CẤM)</span>
            <div className="truncate text-[9px] font-bold">
              {result.bannedWordsMatched.length > 0 ? (
                <span className="text-rose-455 font-extrabold truncate block" title={result.bannedWordsMatched.join(', ')}>
                  Chứa từ cấm: {result.bannedWordsMatched.join(', ')}
                </span>
              ) : (
                <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> An toàn
                </span>
              )}
            </div>
          </div>
        </div>

        {lettaViolationsList.length > 0 && (
          <div className="space-y-1 mt-2">
            <div className="text-[8.5px] font-black text-orange-400 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle size={10} className="text-orange-400 animate-pulse" />
              <span>CẢNH BÁO VI PHẠM THIẾT KẾ (LETTA DNA AUDIT) ({lettaViolationsList.length})</span>
            </div>
            <div className="space-y-1 max-h-20 overflow-y-auto custom-scrollbar">
              {lettaViolationsList.map((v: any, vIdx: number) => (
                <div key={vIdx} className="flex flex-col p-1.5 bg-orange-950/20 border border-orange-900/30 rounded-lg text-[9.5px] text-orange-200 leading-tight text-left">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={10} className="text-orange-400 shrink-0" />
                    <span className="font-extrabold text-white">{v.character} - Vi phạm quy tắc</span>
                  </div>
                  <span className="text-slate-300 text-[9px] mt-0.5 pl-4 block">{v.violation}</span>
                  <span className="text-slate-400 italic text-[9px] pl-4 block">Gợi ý: {v.suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings & Risk Notes list */}
        <div className="bg-[#070709] border border-slate-900 rounded-xl p-2.5 space-y-1">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">KHUYẾN NGHỊ &amp; LƯU Ý RỦI RO</span>
          <div className="max-h-24 overflow-y-auto custom-scrollbar space-y-1 pr-1 text-left">
            {result.suggestedRiskNotes.map((note, idx) => {
              const isOk = note.includes("đạt chuẩn") || note.includes("sẵn sàng");
              return (
                <div key={idx} className="flex items-start gap-1.5 text-[9.5px] text-slate-355 leading-relaxed">
                  {isOk ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  )}
                  <span>{note}</span>
                </div>
              );
            })}
            {result.modelAlerts.map((alertMsg, idx) => (
              <div key={`alert-${idx}`} className="flex items-start gap-1.5 text-[9.5px] text-amber-400 leading-relaxed font-bold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-550 shrink-0 mt-0.5" />
                <span>{alertMsg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (

    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/85 backdrop-blur-md">
      <div className="bg-[#16161a] border-2 border-indigo-500/40 rounded-2xl w-full max-w-[1500px] h-[90vh] flex flex-col shadow-[0_0_60px_rgba(99,102,241,0.35)] overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-4 bg-[#1e1e24] border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Film size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Bảng Phân Cảnh Nâng Cao (Shot Division Review)
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {pendingShots.length} shots · {Math.round(totalDuration / 60)}m {totalDuration % 60}s ·&nbsp;
                {sceneGroups.length} scenes: {sceneGroups.map(([k, v]) => `${k} (${v})`).join(', ')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoSuggestGrids}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/40 text-indigo-400 hover:text-indigo-300 border border-indigo-900/60 hover:bg-indigo-950/80 text-xs font-bold transition-all active:scale-95"
              title="Tự động đề xuất Grid Layout dựa trên số lượng shot của mỗi Scene"
            >
              <Sparkles size={13} />
              <span>Gợi ý Layout Grid</span>
            </button>
            <button
              onClick={handleOptimizeFraming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950/40 text-teal-400 hover:text-teal-300 border border-teal-900/60 hover:bg-teal-950/80 text-xs font-bold transition-all active:scale-95"
              title="Tự động thay đổi cỡ cảnh (Framing Variety) tránh lỗi jump cut"
            >
              <Zap size={13} />
              <span>Tránh Jump Cut</span>
            </button>
          </div>
        </div>


        {/* ── Table ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto bg-[#111114] custom-scrollbar">
          <table className="w-full text-left border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-[#1a1a20]">
              <tr className="border-b border-slate-800 text-[10px] uppercase font-black tracking-wider text-indigo-400">
                {projectData?.shotlistPreset === 'paco_production' ? (
                  <>
                    <th className="py-3 px-3 w-[15%] border-r border-slate-800/60">CAMERA</th>
                    <th className="py-3 px-3 w-[20%] border-r border-slate-800/60">BACKGROUND</th>
                    <th className="py-3 px-3 w-[14%] border-r border-slate-800/60">CHARACTERS</th>
                    <th className="py-3 px-3 w-[16%] border-r border-slate-800/60">ACTION</th>
                  </>
                ) : (
                  <>
                    <th className="py-3 px-3 w-[16%] border-r border-slate-800/60">Shot / Camera / Verify</th>
                    <th className="py-3 px-3 w-[22%] border-r border-slate-800/60">Mô Tả Hành Động</th>
                    <th className="py-3 px-3 w-[11%] border-r border-slate-800/60">Thoại</th>
                    <th className="py-3 px-3 w-[16%] border-r border-slate-800/60">Mục Tiêu &amp; Liên Kết</th>
                  </>
                )}
                <th className="py-3 px-3 w-[18%] border-r border-slate-800/60">Prompts (Storyboard &amp; Video)</th>
                <th className="py-3 px-3 w-[17%]">Storyboard &amp; Video Preview</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedShots).map(([sceneId, sceneShots]) => {
                const isCollapsed = collapsedScenes[sceneId];
                return (
                  <React.Fragment key={sceneId}>
                    {/* Scene Section Header Row */}
                    <tr className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-[5]">
                      <td colSpan={6} className="py-2 px-3 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setCollapsedScenes(prev => ({ ...prev, [sceneId]: !prev[sceneId] }))}
                          className="flex items-center gap-2 hover:text-white text-indigo-400 text-xs font-black uppercase tracking-wider focus:outline-none"
                        >
                          <span className="text-[10px]">{isCollapsed ? '▶' : '▼'}</span>
                          <span>Cảnh {sceneId}</span>
                          <span className="text-[10px] bg-indigo-950/60 border border-indigo-900/40 text-slate-400 px-2 py-0.5 rounded-full font-bold normal-case">
                            {sceneShots.length} shots · {sceneShots.reduce((sum, s) => sum + (s.duration || 4), 0)}s
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAiAnalyzeShots(sceneId)}
                            disabled={isAnalyzingAi}
                            className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 hover:bg-amber-500 text-amber-355 hover:text-white border border-amber-500/30 rounded text-[9.5px] font-black uppercase transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                          >
                            {isAnalyzingAi ? (
                              <>
                                <Loader2 size={10} className="animate-spin text-amber-400" />
                                <span>Đang phân tích...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={10} className="text-amber-400" />
                                <span>🤖 AI Phân Tích Cảnh</span>
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => runBatchGenForScene(sceneId, 'image')}
                            disabled={!!batchQueueStatus}
                            className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-600/25 hover:bg-indigo-650 text-indigo-300 hover:text-white border border-indigo-500/30 rounded text-[9.5px] font-black uppercase transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            🎨 TẠO ALL STORYBOARD
                          </button>
                          <button
                            type="button"
                            onClick={() => runBatchGenForScene(sceneId, 'video')}
                            disabled={!!batchQueueStatus}
                            className="flex items-center gap-1 px-2.5 py-0.5 bg-purple-600/25 hover:bg-purple-650 text-purple-300 hover:text-white border border-purple-500/30 rounded text-[9.5px] font-black uppercase transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                          >
                            🎬 DỰNG ALL VIDEO
                          </button>
                        </div>
                      </td>
                    </tr>

                    {batchQueueStatus && batchQueueStatus.sceneId === sceneId && (
                      <tr className="bg-indigo-950/20 border-b border-indigo-900/40">
                        <td colSpan={6} className="py-2 px-4">
                          <div className="flex items-center justify-between gap-3 text-[10.5px]">
                            <div className="flex items-center gap-2 truncate">
                              <Loader2 className="animate-spin text-indigo-400 shrink-0" size={12} />
                              <span className="font-extrabold text-indigo-300 uppercase shrink-0">
                                [Hàng đợi {batchQueueStatus.type === 'image' ? 'Storyboard' : 'Video'}]:
                              </span>
                              <span className="text-slate-300 font-semibold truncate">{batchQueueStatus.statusText}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[9px] bg-indigo-900/50 px-2 py-0.5 rounded-full text-indigo-300 border border-indigo-850/60 font-black">
                                {batchQueueStatus.current}/{batchQueueStatus.total} Shot
                              </span>
                              <button
                                type="button"
                                onClick={() => { cancelBatchRef.current = true; }}
                                className="px-1.5 py-0.5 bg-red-655/30 hover:bg-red-600 border border-red-500/35 text-red-200 hover:text-white rounded text-[9px] font-bold active:scale-95 transition-all cursor-pointer"
                              >
                                HỦY
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {!isCollapsed && sceneShots.map((sh, shIdx) => {
                      const shotIdVal = sh.beat;

                      // Asset Verify: realtime match
                      const verifiedAssets = getShotVerifiedAssets(sh, allCharacters, allLocations);
                      const isGlue = sh.is_glue === true;

                      return (
                        <tr
                          key={sh.beat}
                          className={`transition-colors align-top border-b border-slate-800/50 ${
                            isGlue 
                              ? 'bg-purple-950/15 hover:bg-purple-950/25' 
                              : 'hover:bg-slate-900/25'
                          }`}
                        >
                          {projectData?.shotlistPreset === 'paco_production' ? (
                            <>
                              <td className="p-3 border-r border-slate-800/60 space-y-2 align-top">
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-black font-mono tracking-wider text-[11px] text-indigo-400">
                                      SHOT {shIdx + 1} ({sh.beat})
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => handleDeleteShot(sh.beat)}
                                    className="text-slate-500 hover:text-rose-455 p-0.5 rounded hover:bg-rose-955/20 transition-colors"
                                    title="Xóa shot"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <div 
                                  className="text-[11px] text-slate-300 font-medium p-1 cursor-pointer hover:bg-slate-900/25 transition-colors mt-2 min-h-[80px]" 
                                  onClick={() => setActiveDetailBeat(sh.beat)}
                                >
                                  {sh.camera || '(Trống)'}
                                </div>
                              </td>
                              <td className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors align-top" onClick={() => setActiveDetailBeat(sh.beat)}>
                                <div className="text-[11px] text-slate-300 whitespace-pre-wrap p-1 h-full min-h-[120px]">
                                  {sh.background || '(Trống)'}
                                </div>
                              </td>
                              <td className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors align-top" onClick={() => setActiveDetailBeat(sh.beat)}>
                                <div className="text-[11px] text-slate-300 whitespace-pre-wrap p-1 h-full min-h-[120px]">
                                  {sh.characters || '(Trống)'}
                                </div>
                              </td>
                              <td className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors align-top" onClick={() => setActiveDetailBeat(sh.beat)}>
                                <div className="text-[11px] text-slate-300 whitespace-pre-wrap p-1 h-full min-h-[120px]">
                                  {sh.action || sh.description || sh.diễn_tả || '(Trống)'}
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              {/* Col 1: Shot / Camera / Verify */}
                          <td className="p-3 border-r border-slate-800/60 space-y-2">
                            {/* Shot header & Trash */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                              <div className="flex flex-col gap-0.5">
                                {isGlue && (
                                  <span className="text-[9px] bg-purple-950 border border-purple-800 text-purple-300 px-1.5 py-0.5 rounded font-bold w-fit mb-1">
                                    [CẢNH TRÁM / GLUE]
                                  </span>
                                )}
                                <span className={`font-black font-mono tracking-wider text-[11px] ${isGlue ? 'text-purple-400' : 'text-indigo-400'}`}>
                                  SHOT {shIdx + 1} ({sh.beat})
                                </span>
                              </div>
                              <button
                                onClick={() => handleDeleteShot(sh.beat)}
                                className="text-slate-500 hover:text-rose-455 p-0.5 rounded hover:bg-rose-955/20 transition-colors"
                                title="Xóa shot"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>

                            {/* Dropdowns xếp dọc */}
                            <div className="flex flex-col gap-2">
                              <div>
                                <label className="text-[7.5px] text-slate-400 font-bold uppercase block mb-0.5">Loại Shot</label>
                                <select
                                  value={sh.kind || 'action'}
                                  onChange={(e) => handleUpdateField(sh.beat, 'kind', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-indigo-500/40"
                                >
                                  <option value="establishing">Establishing</option>
                                  <option value="detail">Detail</option>
                                  <option value="action">Action</option>
                                  <option value="reaction">Reaction</option>
                                  <option value="dialogue">Dialogue</option>
                                  <option value="montage">Montage</option>
                                  <option value="transition">Transition</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[7.5px] text-slate-400 font-bold uppercase block mb-0.5">Cỡ Cảnh</label>
                                <select
                                  value={
                                    sh.camera_angle?.height ||
                                    (sh.angle?.startsWith('HIGH') ? 'HIGH' :
                                     sh.angle?.startsWith('LOW') ? 'LOW' :
                                     sh.angle?.startsWith('BIRD') ? 'BIRD' : 'EYE')
                                  }
                                  onChange={(e) => handleUpdateField(sh.beat, 'cameraHeight', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-indigo-500/40"
                                >
                                  <option value="EYE">Eye-Level</option>
                                  <option value="HIGH">High Angle</option>
                                  <option value="LOW">Low Angle</option>
                                  <option value="BIRD">Bird View</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[7.5px] text-slate-400 font-bold uppercase block mb-0.5">Camera</label>
                                <select
                                  value={normalizeCameraMovement(sh.cameraMovement)}
                                  onChange={(e) => handleUpdateField(sh.beat, 'cameraMovement', e.target.value)}
                                  className="w-full bg-slate-955 border border-slate-800 rounded px-2 py-1 text-[10px] font-bold text-white outline-none focus:border-indigo-500/40"
                                >
                                  <option value="STATIC">Static Tilt</option>
                                  <option value="PAN_LEFT">Pan Left</option>
                                  <option value="PAN_RIGHT">Pan Right</option>
                                  <option value="TILT_UP">Tilt Up</option>
                                  <option value="TILT_DOWN">Tilt Down</option>
                                  <option value="ZOOM_IN">Zoom In</option>
                                  <option value="ZOOM_OUT">Zoom Out</option>
                                  <option value="DOLLY_IN">Dolly In</option>
                                  <option value="DOLLY_OUT">Dolly Out</option>
                                  <option value="TRACKING_L2R">Tracking L2R</option>
                                  <option value="TRACKING_R2L">Tracking R2L</option>
                                  <option value="CRANE_UP">Crane Up</option>
                                  <option value="CRANE_DOWN">Crane Down</option>
                                  <option value="HANDHELD">Handheld</option>
                                  <option value="ORBIT">Orbit</option>
                                </select>
                              </div>

                              <div>
                                <label className="text-[7.5px] text-slate-400 font-bold uppercase block mb-0.5">Lưới Grid</label>
                                <select
                                  value={sh.panelGrid || '1x1'}
                                  onChange={(e) => handleUpdateField(sh.beat, 'panelGrid', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[10px] font-bold text-slate-350 outline-none focus:border-indigo-500/40"
                                >
                                  <option value="1x1">1x1 (Single)</option>
                                  <option value="1x2">1x2 Panel</option>
                                  <option value="2x2">2x2 Grid</option>
                                  <option value="2x3">2x3 Grid</option>
                                  <option value="3x3">3x3 Grid</option>
                                  <option value="auto">AI Auto</option>
                                </select>
                              </div>
                            </div>

                            {/* Warnings List */}
                            {sh.warnings && sh.warnings.length > 0 && (
                              <div className="bg-amber-955/30 border border-amber-500/25 rounded p-2 text-[10px] text-amber-300 font-mono space-y-1">
                                <div className="flex items-center gap-1 font-bold text-amber-400">
                                  <AlertTriangle size={12} className="text-amber-500 animate-pulse shrink-0" />
                                  <span>CẢNH BÁO CONTINUITY:</span>
                                </div>
                                <ul className="list-disc pl-3.5 space-y-0.5 text-[9px] text-amber-300/80">
                                  {sh.warnings.map((warn: string, wIdx: number) => (
                                    <li key={wIdx}>{warn}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Chèn cảnh trám */}
                            <button
                              type="button"
                              onClick={() => handleInsertGlueShotTable(pendingShots.indexOf(sh))}
                              className="w-full flex items-center justify-center gap-1 py-1.5 px-2.5 bg-purple-650/20 hover:bg-purple-650 border border-purple-500/30 hover:border-purple-500 rounded text-[9px] font-black text-purple-300 hover:text-white transition-all active:scale-95 cursor-pointer uppercase"
                              title="Chèn cảnh trám ngay sau shot này"
                            >
                              <Plus size={10} />
                              <span>+ Chèn Cảnh Trám</span>
                            </button>

                            {/* Asset Verify */}
                            <div className="bg-slate-950/40 p-1.5 rounded border border-slate-850/80 space-y-1">
                              <div className="text-[7.5px] font-black text-indigo-400/80 uppercase tracking-widest flex items-center justify-between">
                                <span>Asset Verify</span>
                                <span className="text-[6.5px] text-slate-500 lowercase">(realtime)</span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {/* Render Locations */}
                                {verifiedAssets.locations.length > 0 ? (
                                  verifiedAssets.locations.map((loc, lIdx) => (
                                    loc.isLinked ? (
                                      <div key={`loc-linked-${lIdx}`} className="flex items-center gap-1 bg-orange-600/10 border border-orange-500/20 text-[8px] font-black text-orange-300 px-1 py-0.5 rounded-md truncate max-w-[100px]" title={`Bối cảnh: ${loc.name} (Đã liên kết)`}>
                                        {loc.imageUrl ? (
                                          <img src={loc.imageUrl} className="w-3.5 h-3.5 rounded object-cover shrink-0" alt="Loc" />
                                        ) : (
                                          <MapPin size={8} className="shrink-0 text-orange-400" />
                                        )}
                                        <span className="truncate">{loc.name}</span>
                                      </div>
                                    ) : (
                                      <div key={`loc-unlinked-${lIdx}`} className="flex items-center gap-1 bg-rose-950/20 border border-rose-500/30 text-[8px] font-bold text-rose-300 px-1 py-0.5 rounded-md truncate max-w-[100px]" title={`Bối cảnh: ${loc.name} (Chưa liên kết)`}>
                                        <MapPin size={8} className="shrink-0 text-rose-400 animate-pulse" />
                                        <span className="truncate">{loc.name} (Unlinked)</span>
                                      </div>
                                    )
                                  ))
                                ) : (
                                  <span className="text-[7.5px] bg-slate-900 border border-slate-850 text-slate-500 px-1 py-0.5 rounded-md">📍 Loc: None</span>
                                )}

                                {/* Render Characters */}
                                {verifiedAssets.characters.length > 0 ? (
                                  verifiedAssets.characters.map((char, cIdx) => (
                                    char.isLinked ? (
                                      <div key={`char-linked-${cIdx}`} className="flex items-center gap-1 bg-emerald-600/10 border border-emerald-500/20 text-[8px] font-black text-emerald-300 px-1 py-0.5 rounded" title={`Nhân vật: ${char.name} (Đã liên kết)`}>
                                        {char.imageUrl ? (
                                          <img src={char.imageUrl} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" alt="Char" />
                                        ) : (
                                          <User size={7} className="shrink-0 text-emerald-400" />
                                        )}
                                        <span className="truncate max-w-[50px]">{char.name}</span>
                                      </div>
                                    ) : (
                                      <div key={`char-unlinked-${cIdx}`} className="flex items-center gap-1 bg-slate-800 border border-slate-700/60 text-[8px] font-bold text-slate-400 px-1 py-0.5 rounded" title={`Nhân vật: ${char.name} (Chưa liên kết)`}>
                                        <User size={7} className="shrink-0 text-slate-500" />
                                        <span className="truncate max-w-[50px]">{char.name} (?)</span>
                                      </div>
                                    )
                                  ))
                                ) : (
                                  <span className="text-[7.5px] bg-slate-900 border border-slate-850 text-slate-500 px-1 py-0.5 rounded-md">👥 Chars: None</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Col 2: Mô Tả Hành Động */}
                          <td 
                            className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors"
                            onClick={() => setActiveDetailBeat(sh.beat)}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed break-words text-[11px] text-slate-200 select-all p-1 h-full min-h-[120px] space-y-2">
                              <div>{sh.diễn_tả || sh.description || '(Trống)'}</div>
                              {projectData.shotlistPreset === 'paco_production' && sh.characterExpressions && Object.keys(sh.characterExpressions).length > 0 && (
                                <div className="mt-2 bg-pink-955/20 border border-pink-500/20 rounded p-1.5 space-y-1">
                                  <span className="text-[7.5px] font-black text-pink-400 uppercase tracking-widest block">🎭 Character Cues</span>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(sh.characterExpressions).map(([cName, cue]) => {
                                      if (!cue || cue === 'N/A') return null;
                                      return (
                                        <div key={cName} className="text-[9px] bg-slate-950/80 border border-slate-800 rounded px-1.5 py-0.5 text-slate-300">
                                          <span className="font-extrabold text-amber-300 uppercase mr-1">{cName}:</span>
                                          <span>{cue as string}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Col 3: Thoại */}
                          <td 
                            className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors"
                            onClick={() => setActiveDetailBeat(sh.beat)}
                          >
                            <div className="whitespace-pre-wrap leading-relaxed break-words text-[11px] text-amber-300 italic select-all p-1 h-full min-h-[120px] space-y-2">
                              <div>{sh.thoại || sh.dialogue || sh.dialog || '(Trống)'}</div>
                              {projectData.shotlistPreset === 'paco_production' && (
                                <div className="mt-2 space-y-1 text-[9px] not-italic border-t border-slate-800/40 pt-1.5">
                                  {sh.timingPattern && (
                                    <div className="text-slate-400">
                                      <span className="font-bold text-slate-550 uppercase mr-1">[Timing]:</span>
                                      <span className="font-mono text-cyan-400">{sh.timingPattern}</span>
                                      {sh.timing && <span className="text-slate-500 text-[8.5px] ml-1">({sh.timing})</span>}
                                    </div>
                                  )}
                                  {sh.sfx && (
                                    <div className="text-slate-400">
                                      <span className="font-bold text-slate-550 uppercase mr-1">[SFX]:</span>
                                      <span className="text-slate-300">{sh.sfx}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Col 4: Mục Tiêu & Liên Kết */}
                          <td 
                            className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors space-y-2.5"
                            onClick={() => setActiveDetailBeat(sh.beat)}
                          >
                            <div>
                              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest block mb-0.5">Objective</span>
                              <div className="whitespace-pre-wrap leading-relaxed break-words text-[10.5px] text-slate-300 select-all p-1">
                                {sh.mục_tiêu || sh.objective || '(Trống)'}
                              </div>
                            </div>

                            {projectData.shotlistPreset === 'paco_production' && (
                              <div className="bg-[#121217] border border-indigo-500/10 rounded p-1.5 space-y-1.5 text-[9px] text-slate-400">
                                {(sh.lensFeel || sh.motion) && (
                                  <div className="flex gap-2">
                                    {sh.lensFeel && <div><span className="text-slate-550 font-bold uppercase">Lens:</span> <span className="text-slate-300">{sh.lensFeel}</span></div>}
                                    {sh.motion && <div><span className="text-slate-550 font-bold uppercase">Motion:</span> <span className="text-slate-300">{sh.motion}</span></div>}
                                  </div>
                                )}
                                {sh.storyboardNote && (
                                  <div>
                                    <span className="text-pink-400 font-bold uppercase">[Render]:</span> <span className="text-slate-350">{sh.storyboardNote}</span>
                                  </div>
                                )}
                                {sh.seedanceNote && (
                                  <div>
                                    <span className="text-teal-400 font-bold uppercase">[Motion]:</span> <span className="text-slate-350">{sh.seedanceNote}</span>
                                  </div>
                                )}
                                {sh.gagFlag && (
                                  <div>
                                    <span className="text-amber-400 font-bold uppercase">[Gag]:</span> <span className="text-slate-350">{sh.gagFlag}</span>
                                  </div>
                                )}
                                {sh.flag && (
                                  <div className="text-yellow-455 font-bold">
                                    ★ {sh.flag}
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="pt-2 border-t border-slate-850/50">
                              <span className="text-[8px] font-black text-pink-400 uppercase tracking-widest block mb-0.5">Causal Link</span>
                              <div className="whitespace-pre-wrap leading-relaxed break-words text-[10.5px] text-slate-355 select-all p-1 italic">
                                {sh.causalLink || '(Trống)'}
                              </div>
                            </div>
                          </td>
                            </>
                          )}

                          {/* Col 5: Prompts Box */}
                          <td 
                            className="p-3 border-r border-slate-800/60 cursor-pointer hover:bg-slate-900/25 transition-colors space-y-3"
                            onClick={() => setActiveDetailBeat(sh.beat)}
                          >
                            <div className="bg-slate-950/40 p-2 rounded border border-slate-855/80 min-h-[50px]">
                              <span className="text-[7.5px] font-black text-pink-450 uppercase tracking-widest block mb-1">Storyboard Prompt</span>
                              <p className="text-[10px] text-slate-400 line-clamp-3 leading-normal font-mono select-all break-words">
                                {sh.storyboardPrompt || sh.visual || sh.hình_ảnh || 'Chưa sinh prompt...'}
                              </p>
                            </div>

                            <div className="bg-slate-950/40 p-2 rounded border border-slate-855/80 min-h-[50px]">
                              <span className="text-[7.5px] font-black text-indigo-400 uppercase tracking-widest block mb-1">Video Prompt</span>
                              <p className="text-[10px] text-slate-400 line-clamp-3 leading-normal font-mono select-all break-words">
                                {sh.videoPrompt || 'Chưa sinh video prompt...'}
                              </p>
                            </div>
                          </td>

                          {/* Col 6: Storyboard & Video Preview */}
                          <td className="p-3 space-y-2">
                            {sh.imageUrl || sh.renderUrl ? (
                              <div className="relative group/img overflow-hidden rounded-lg border border-slate-800 bg-slate-950 aspect-video">
                                <img src={sh.imageUrl || sh.renderUrl} className="w-full h-full object-cover" alt="Storyboard Frame" />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setSelectedZoomImage(sh.imageUrl || sh.renderUrl)}
                                    className="px-2 py-1 bg-indigo-650 text-white rounded text-[9px] font-black flex items-center gap-0.5"
                                  >
                                    <Eye size={10} /> Xem lớn
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="w-full aspect-video rounded-lg border border-dashed border-slate-800 bg-slate-950/40 flex flex-col items-center justify-center text-[9px] text-slate-500 font-bold gap-1">
                                <ImageIcon size={14} className="text-slate-600" />
                                <span>Chưa vẽ Storyboard</span>
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <select
                                value={storyboardModels[sh.beat] || 'narwhal'}
                                onChange={(e) => setStoryboardModels(prev => ({ ...prev, [sh.beat]: e.target.value }))}
                                className="w-full bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[9.5px] font-bold text-slate-350 outline-none focus:border-indigo-500/40"
                              >
                                <option value="narwhal">Narwhal (Fast)</option>
                                <option value="flux_schnell">Flux Schnell</option>
                                <option value="auto">Auto Model</option>
                              </select>

                              <div className="flex gap-1">
                                <button
                                  onClick={() => handleGenerateStoryboard(sh)}
                                  disabled={!!(generatingStates[sh.beat] && !generatingStates[sh.beat].includes('Xong') && !generatingStates[sh.beat].includes('Lỗi'))}
                                  className="flex-1 py-1 bg-pink-600/20 hover:bg-pink-650 hover:text-white border border-pink-500/30 text-[9.5px] font-black text-pink-300 rounded transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                  {generatingStates[sh.beat] && !generatingStates[sh.beat].includes('Xong') && !generatingStates[sh.beat].includes('Lỗi') ? (
                                    <>
                                      <Loader2 size={10} className="animate-spin text-pink-400" />
                                      {generatingStates[sh.beat]}
                                    </>
                                  ) : (
                                    <>
                                      <Wand2 size={10} /> Vẽ ảnh
                                    </>
                                  )}
                                </button>
                                
                                {(sh.imageUrl || sh.renderUrl) && (sh.panelGrid === '2x2' || sh.panelGrid === '2x3') && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSliceModal(sh)}
                                    className="px-2 py-1 bg-slate-855 hover:bg-slate-750 text-slate-300 border border-slate-700 text-[9.5px] font-black rounded transition-all flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                                    title="Cắt ảnh Panel thành các biến thể Ref"
                                  >
                                    <Sparkles size={10} /> Cắt Ref
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="p-4 bg-[#1e1e24] border-t border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider space-y-0.5">
            <div>
              Tổng: <span className="text-white">{pendingShots.length} Shots</span>
              {' '}·{' '}
              <span className="text-amber-400">{Math.floor(totalDuration / 60)}m {totalDuration % 60}s</span>
              {' '}·{' '}
              <span className="text-indigo-300">{sceneGroups.length} Scenes</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setPendingShots([])}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-xs font-bold text-slate-400 hover:text-white transition-all active:scale-95"
            >
              Hủy bỏ
            </button>
            <button
              onClick={handleConfirmAndBuild}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-xs font-black uppercase text-white shadow-lg active:scale-95 transition-all"
            >
              <Sparkles size={14} />
              <span>Dựng Sơ Đồ (Confirm & Build)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Slice Panel Modal */}
      {sliceModalOpen && activeSliceShot && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#1a1a20] border border-indigo-500/30 rounded-3xl w-full max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col shadow-[0_0_50px_rgba(99,102,241,0.25)]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-[#202027]">
              <div>
                <h4 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400 animate-pulse" /> Công Cụ Cắt Panel Góc Máy (Multi-Angle Slicing)
                </h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  Cắt ảnh Grid {activeSliceShot.panelGrid} thành các bối cảnh tham chiếu (Ref bối cảnh sạch) lưu trực tiếp vào thư viện.
                </p>
              </div>
              <button
                onClick={() => setSliceModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col items-center gap-6 custom-scrollbar bg-[#111115]">
              {/* Preview Image with grid overlay */}
              <div className="relative border border-slate-800 rounded-2xl overflow-hidden max-w-[650px] shadow-2xl">
                <img
                  src={activeSliceShot.imageUrl || activeSliceShot.renderUrl}
                  className="w-full object-contain max-h-[50vh]"
                  alt="Grid panel source"
                />
                {/* Grid Lines Overlay */}
                <div className="absolute inset-0 flex flex-col pointer-events-none">
                  {/* Rows */}
                  {Array.from({ length: 2 }).map((_, rIdx) => (
                    rIdx < 1 && (
                      <div
                        key={`row-${rIdx}`}
                        className="border-b-2 border-dashed border-indigo-500/60 w-full absolute top-[50%] left-0"
                      />
                    )
                  ))}
                </div>
                <div className="absolute inset-0 flex pointer-events-none">
                  {/* Cols */}
                  {activeSliceShot.panelGrid === '2x3' ? (
                    <>
                      <div className="border-r-2 border-dashed border-indigo-500/60 h-full absolute left-[33.33%] top-0" />
                      <div className="border-r-2 border-dashed border-indigo-500/60 h-full absolute left-[66.66%] top-0" />
                    </>
                  ) : (
                    <div className="border-r-2 border-dashed border-indigo-500/60 h-full absolute left-[50%] top-0" />
                  )}
                </div>
              </div>

              {/* Slices selector & action items */}
              <div className="w-full space-y-4">
                <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2">Danh sách ô cắt ({activeSliceShot.panelGrid === '2x3' ? 6 : 4} góc máy)</h5>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Array.from({ 
                    length: activeSliceShot.panelGrid === '2x3' ? 6 : 4 
                  }).map((_, idx) => {
                    const cols = activeSliceShot.panelGrid === '2x3' ? 3 : 2;
                    const rows = 2;
                    const row = Math.floor(idx / cols);
                    const col = idx % cols;

                    const status = slicingStates[idx] || 'Sẵn sàng';
                    const isSaving = status === 'Đang cắt...' || status === 'Đang lưu...';
                    const isDone = status === 'Đã lưu Ref!';

                    return (
                      <div key={idx} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 relative overflow-hidden">
                        <div>
                          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-950/30 border border-indigo-900/30 px-2 py-0.5 rounded">Góc máy {idx + 1} (Hàng {row + 1}, Cột {col + 1})</span>
                          <div className="text-[10px] text-slate-400 mt-2">
                            Trạng thái: <span className={`font-bold ${isDone ? 'text-emerald-400' : isSaving ? 'text-amber-400' : 'text-slate-500'}`}>{status}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSaveSlice(idx, row, col, rows, cols)}
                          disabled={isSaving || isDone}
                          className={`w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition cursor-pointer active:scale-95 ${
                            isDone
                              ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/40 cursor-default font-extrabold'
                              : isSaving
                              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-wait'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow shadow-indigo-500/20 font-black'
                          }`}
                        >
                          {isDone ? 'Đã lưu Ref!' : isSaving ? 'Đang lưu...' : 'Lưu làm Ref'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-800 flex justify-end bg-[#1e1e24]">
              <button
                type="button"
                onClick={() => setSliceModalOpen(false)}
                className="px-6 py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-xs font-black uppercase text-slate-300 hover:text-white transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shot Detail Editor Modal */}
      {activeDetailBeat && (() => {
        const sh = pendingShots.find(s => s.beat === activeDetailBeat);
        if (!sh) return null;

        const finalPromptText = sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.description || sh.diễn_tả || '';
        const wordCount = finalPromptText.split(/\s+/).filter(Boolean).length;
        const isOverBudget = wordCount > 180;
        const storyboardUrl = sh.renderUrl || sh.imageUrl;
        const videoUrl = sh.videoUrl || sh.video_url;

        const storyboardVariants = sh.variants || [];
        const videoVariants = sh.videoVariants || [];

        // Match Characters & Location
        const selectedLocId = sh.locationId;
        const matchedLoc = allLocations.find((l: any) => l.worldAssetCharId === selectedLocId);
        
        const selectedCharIds = sh.characterIds || [];
        const matchedChars = selectedCharIds.map((charId: string) => {
          return allCharacters.find((c: any) => c.worldAssetCharId === charId);
        }).filter(Boolean);

        return (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-955/90 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-[#101014] border border-indigo-500/30 rounded-3xl w-full max-w-[1200px] h-[85vh] overflow-hidden flex flex-col shadow-[0_0_60px_rgba(99,102,241,0.3)]">
              
              {/* Modal Header */}
              <div className="px-6 py-4 bg-[#181820] border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                    {sh.beat}
                  </span>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider">Chi Tiết Phân Cảnh &amp; Cấu Hình Kỹ Thuật</h4>
                    <p className="text-[10px] text-slate-400">Thiết lập góc máy, nhân vật, bối cảnh, prompt và sinh thử media trực quan</p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDetailBeat(null)}
                  className="p-1.5 rounded-lg bg-slate-855 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-800"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 flex gap-6 custom-scrollbar text-left bg-[#0c0c0e]">
                {/* Cột trái: Media Preview (45%) */}
                <div className="w-[45%] space-y-4 flex flex-col">
                  {/* Tab Selector */}
                  <div className="flex gap-2 p-1 bg-slate-950/80 border border-slate-850 rounded-2xl w-fit">
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab('image')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition-all duration-150 ${activeDetailTab === 'image' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Storyboard
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveDetailTab('video')}
                      className={`px-4 py-1.5 rounded-xl text-xs font-black uppercase transition-all duration-150 ${activeDetailTab === 'video' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Dựng Video
                    </button>
                  </div>

                  {/* Visual Preview */}
                  <div className="flex-1 min-h-[300px] bg-slate-950/60 border border-slate-850 rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner group">
                    {activeDetailTab === 'video' && videoUrl ? (
                      <>
                        <video
                          src={videoUrl}
                          className="w-full h-full object-contain"
                          controls
                          autoPlay
                          muted
                          loop
                        />
                        <button
                          type="button"
                          onClick={() => handleExtractLastFrame(sh)}
                          disabled={isExtractingFrame}
                          className="absolute bottom-4 right-4 bg-indigo-600/90 hover:bg-indigo-650 text-white text-[10px] px-3 py-1.5 rounded-xl font-black transition-all shadow-md active:scale-95 z-10 flex items-center gap-1.5 cursor-pointer border border-indigo-500/30 disabled:opacity-50"
                          title="Trích xuất frame cuối của video này và đặt làm ảnh Storyboard cho Shot tiếp theo để nối raccord"
                        >
                          {isExtractingFrame ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span>🪄 Lấy frame cuối cho Shot sau</span>
                          )}
                        </button>
                      </>
                    ) : (activeDetailTab === 'image' && storyboardUrl) || (!videoUrl && storyboardUrl) ? (
                      <>
                        <img
                          src={storyboardUrl}
                          className="w-full h-full object-contain"
                          alt="Preview Storyboard"
                        />
                        <button
                          type="button"
                          onClick={() => handleAutoLayout(sh)}
                          disabled={isAutoDrawing}
                          className="absolute bottom-4 right-4 bg-emerald-600/90 hover:bg-emerald-650 text-white text-[10px] px-3 py-1.5 rounded-xl font-black transition-all shadow-md active:scale-95 z-10 flex items-center gap-1.5 cursor-pointer border border-emerald-500/30 disabled:opacity-50"
                          title="Phân tích prompt để nhận diện nhân vật và vẽ khối vị trí lên ảnh"
                        >
                          {isAutoDrawing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span>🪄 Auto vẽ khối</span>
                          )}
                        </button>
                      </>
                    ) : (
                      <div className="text-center text-slate-655 space-y-2">
                        <ImageIcon size={48} className="mx-auto text-slate-800" />
                        <span className="text-xs block">
                          {activeDetailTab === 'video' 
                            ? 'Chưa dựng Video Ref cho Shot này' 
                            : 'Chưa vẽ ảnh Storyboard Ref cho Shot này'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAutoLayout(sh)}
                          disabled={isAutoDrawing}
                          className="mt-2 bg-emerald-600/90 hover:bg-emerald-650 text-white text-[10px] px-3 py-1.5 rounded-xl font-black transition-all shadow-md active:scale-95 flex items-center gap-1.5 mx-auto cursor-pointer border border-emerald-500/30 disabled:opacity-50"
                        >
                          {isAutoDrawing ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <span>🪄 Auto vẽ khối</span>
                          )}
                        </button>
                      </div>
                    )}

                    {storyboardUrl && (
                      <button
                        type="button"
                        onClick={() => setSelectedZoomImage(storyboardUrl)}
                        className="absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Phóng to ảnh"
                      >
                        <Maximize2 size={16} />
                      </button>
                    )}
                  </div>


                  {/* Generation Actions Area */}
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-850 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Orchestrator Engine</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Image Gen Block */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-pink-400 font-black uppercase block">Storyboard Model</span>
                        <select
                          value={getSanitizedImageModel(sh.storyboardModel || 'auto', imageProvider)}
                          onChange={(e) => handleUpdateField(sh.beat, 'storyboardModel', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-bold text-pink-400 outline-none cursor-pointer"
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
                          onClick={() => handleGenerateStoryboard(sh)}
                          disabled={!!(generatingStates[sh.beat] && !generatingStates[sh.beat].includes('Xong') && !generatingStates[sh.beat].includes('Lỗi'))}
                          className="w-full py-2 bg-pink-600 hover:bg-pink-500 text-white font-black text-xs uppercase rounded-xl transition-all shadow-lg shadow-pink-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {generatingStates[sh.beat] && !generatingStates[sh.beat].includes('Xong') && !generatingStates[sh.beat].includes('Lỗi') ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Wand2 size={14} />
                          )}
                          <span>Vẽ lại ảnh</span>
                        </button>
                      </div>

                      {/* Video Gen Block */}
                      <div className="space-y-2">
                        <span className="text-[9px] font-purple-400 font-black uppercase block">Video Model</span>
                        <select
                          value={getSanitizedVideoModel(sh.videoModel || 'auto', videoProvider)}
                          onChange={(e) => handleUpdateField(sh.beat, 'videoModel', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs font-bold text-purple-400 outline-none cursor-pointer"
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
                          onClick={() => handleGenerateVideo(sh)}
                          disabled={!!(videoGeneratingStates[sh.beat] && !videoGeneratingStates[sh.beat].includes('Xong') && !videoGeneratingStates[sh.beat].includes('Lỗi'))}
                          className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase rounded-xl transition-all shadow-lg shadow-purple-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {videoGeneratingStates[sh.beat] && !videoGeneratingStates[sh.beat].includes('Xong') && !videoGeneratingStates[sh.beat].includes('Lỗi') ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          <span>Dựng lại Video</span>
                        </button>
                      </div>
                    </div>

                    {/* Thumbnail variants */}
                    {storyboardVariants.length > 0 && (
                      <div className="pt-2 border-t border-slate-800 space-y-1.5">
                        <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block">Các biến thể ảnh cũ (Click để đổi):</span>
                        <div className="flex gap-1.5 items-center flex-wrap overflow-y-auto max-h-16">
                          {storyboardVariants.map((v: any, vIdx: number) => (
                            <div
                              key={vIdx}
                              onClick={() => handleUpdateField(sh.beat, 'renderUrl', v.url)}
                              className={`w-14 aspect-video bg-slate-950 rounded border cursor-pointer overflow-hidden transition-all ${v.url === storyboardUrl ? 'border-pink-500 scale-95 shadow' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                            >
                              <img src={v.url} className="w-full h-full object-cover" alt="v" />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cột phải: Form Settings & Prompts (55%) */}
                <div className="w-[55%] space-y-4 pr-1">
                  {/* Technical Parameters grid */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl space-y-4">
                    <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-2">Thông Số Góc Máy &amp; Bối Cảnh (Camera &amp; Environment)</h5>
                    
                    <div className="grid grid-cols-2 gap-4">
                      {/* Scene Code & Location */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Cảnh (Scene Number)</label>
                        <input
                          type="text"
                          value={sh.sc || 'SC01'}
                          onChange={(e) => handleUpdateField(sh.beat, 'sc', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-350 font-bold outline-none focus:border-indigo-500/40"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Địa Điểm (Location Override)</label>
                        <select
                          value={sh.locationId || ''}
                          onChange={(e) => handleUpdateField(sh.beat, 'locationId', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-amber-400 font-bold outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="">-- Tự động --</option>
                          {allLocations.map((loc: any) => (
                            <option key={loc.worldAssetCharId} value={loc.worldAssetCharId}>{loc.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Shot Kind & Framing */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Loại Shot</label>
                        <select
                          value={sh.kind || 'action'}
                          onChange={(e) => handleUpdateField(sh.beat, 'kind', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-emerald-400 font-bold outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="establishing">Establishing</option>
                          <option value="detail">Detail</option>
                          <option value="action">Action</option>
                          <option value="reaction">Reaction</option>
                          <option value="dialogue">Dialogue</option>
                          <option value="montage">Montage</option>
                          <option value="transition">Transition</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Cỡ Cảnh / Camera Height</label>
                        <select
                          value={sh.camera_angle?.height || 'EYE'}
                          onChange={(e) => handleUpdateField(sh.beat, 'cameraHeight', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-blue-400 font-bold outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="EYE">Eye-Level</option>
                          <option value="HIGH">High Angle</option>
                          <option value="LOW">Low Angle</option>
                          <option value="BIRD">Bird View</option>
                        </select>
                      </div>

                      {/* Layout Grid & Render Mode */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Layout Grid</label>
                        <select
                          value={sh.panelGrid || '1x1'}
                          onChange={(e) => handleUpdateField(sh.beat, 'panelGrid', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-fuchsia-400 font-bold outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="1x1">1x1 (Single)</option>
                          <option value="1x2">1x2 Panel</option>
                          <option value="2x2">2x2 Grid</option>
                          <option value="2x3">2x3 Grid</option>
                          <option value="3x3">3x3 Grid</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Render Mode</label>
                        <select
                          value={sh.renderMode || 'combined'}
                          onChange={(e) => handleUpdateField(sh.beat, 'renderMode', e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-pink-400 font-bold outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="combined">Combined (Ghép Ref)</option>
                          <option value="location_only">Location Only</option>
                          <option value="character_only">Character Only</option>
                        </select>
                      </div>

                      {/* Camera Movement */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Camera Movement</label>
                        <select
                          value={normalizeCameraMovement(sh.cameraMovement)}
                          onChange={(e) => handleUpdateField(sh.beat, 'cameraMovement', e.target.value)}
                          className="w-full bg-slate-955 border border-slate-800 rounded-lg p-2 text-purple-400 font-bold outline-none focus:border-indigo-500/40 cursor-pointer"
                        >
                          <option value="STATIC">Static Tilt</option>
                          <option value="PAN_LEFT">Pan Left</option>
                          <option value="PAN_RIGHT">Pan Right</option>
                          <option value="TILT_UP">Tilt Up</option>
                          <option value="TILT_DOWN">Tilt Down</option>
                          <option value="ZOOM_IN">Zoom In</option>
                          <option value="ZOOM_OUT">Zoom Out</option>
                          <option value="DOLLY_IN">Dolly In</option>
                          <option value="DOLLY_OUT">Dolly Out</option>
                        </select>
                      </div>

                      {/* Character Checkboxes */}
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase block">Nhân Vật Tương Tác</label>
                        <div className="flex flex-wrap gap-1 bg-slate-950 border border-slate-800 rounded-lg p-1.5 h-[34px] overflow-y-auto custom-scrollbar">
                          {allCharacters.map((char: any) => {
                            const isSel = selectedCharIds.includes(char.worldAssetCharId);
                            return (
                              <button
                                key={char.worldAssetCharId}
                                type="button"
                                onClick={() => {
                                  const next = isSel
                                    ? selectedCharIds.filter((id: string) => id !== char.worldAssetCharId)
                                    : [...selectedCharIds, char.worldAssetCharId];
                                  handleUpdateField(sh.beat, 'characterIds', next);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition ${isSel ? 'bg-indigo-600/30 border border-indigo-500 text-indigo-200' : 'bg-slate-900 border border-slate-850 text-slate-500 hover:text-slate-350'}`}
                              >
                                {char.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Character & Location Reference Matches */}
                    <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-1.5 items-center">
                      <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block">Verify Assets Match:</span>
                      <div className="flex flex-wrap gap-1">
                        {matchedLoc ? (
                          <span className="flex items-center gap-1 bg-orange-600/10 border border-orange-500/20 text-[8px] font-black text-orange-300 px-1.5 py-0.5 rounded">
                            <MapPin size={8} /> {matchedLoc.name}
                          </span>
                        ) : (
                          <span className="text-[8px] bg-slate-950 border border-slate-850 text-slate-500 px-1 py-0.5 rounded">📍 Unlinked Loc</span>
                        )}

                        {matchedChars.map((c: any, idx: number) => (
                          <span key={idx} className="flex items-center gap-1 bg-emerald-600/10 border border-emerald-500/20 text-[8px] font-black text-emerald-300 px-1.5 py-0.5 rounded">
                            <User size={8} /> {c.name}
                          </span>
                        ))}
                        {matchedChars.length === 0 && (
                          <span className="text-[8px] bg-slate-955 border border-slate-855 text-slate-550 px-1 py-0.5 rounded">👥 No Characters Linked</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Prompts Section */}
                  <div className="space-y-4">
                    {/* Action & Dialogue Row */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Action (Hành Động)</span>
                        <textarea
                          rows={3}
                          value={sh.diễn_tả || sh.description || ''}
                          onChange={(e) => handleUpdateField(sh.beat, 'diễn_tả', e.target.value)}
                          className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 outline-none resize-none leading-relaxed focus:border-indigo-500/40"
                          placeholder="Mô tả hành động của nhân vật..."
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Dialogue (Lời Thoại)</span>
                        <textarea
                          rows={3}
                          value={sh.thoại || sh.dialogue || ''}
                          onChange={(e) => handleUpdateField(sh.beat, 'thoại', e.target.value)}
                          className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-amber-300 outline-none resize-none leading-relaxed italic focus:border-indigo-500/40"
                          placeholder="Lời thoại nhân vật..."
                        />
                      </div>
                    </div>

                    {/* Dynamic Prompt Fields based on Active Tab */}
                    {activeDetailTab === 'image' ? (
                      <div className="space-y-3.5">
                        {/* Visual Cue (Storyboard Prompt) */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-indigo-400 uppercase block">MÔ TẢ VẼ ẢNH (PROMPT)</span>
                              <button
                                type="button"
                                onClick={() => handleAiRegeneratePrompt(sh)}
                                className="px-2 py-0.5 bg-indigo-600/20 hover:bg-indigo-600 hover:text-white border border-indigo-500/30 text-[9px] font-black text-indigo-300 rounded transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                                title="Tự động biên dịch & sinh lại prompt vẽ ảnh & video dựa trên các thiết lập đã sửa"
                              >
                                <Sparkles size={10} /> Auto Refine
                              </button>
                            </div>
                            <span className={`text-[8.5px] font-bold ${isOverBudget ? 'text-rose-455 animate-pulse' : 'text-slate-550'}`}>{wordCount}/180 từ</span>
                          </div>
                          <textarea
                            rows={4}
                            value={sh.storyboardPrompt || sh.visual || sh.hình_ảnh || ''}
                            onChange={(e) => handleUpdateField(sh.beat, 'storyboardPrompt', e.target.value)}
                            className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-indigo-300 outline-none resize-none leading-relaxed focus:border-indigo-500/40"
                            placeholder="Mô tả góc máy, bối cảnh, ánh sáng, chi tiết vẽ ảnh..."
                          />
                        </div>

                        {/* Storyboard QC Audit Panel */}
                        {renderQCAuditPanel(
                          sh.storyboardPrompt || sh.visual || sh.hình_ảnh || '',
                          sh.kind || 'action',
                          selectedCharIds,
                          sh.locationId || '',
                          sh.storyboardModel || 'auto',
                          lettaViolations
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {/* Video Motion Prompt */}
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black text-purple-400 uppercase block">Video Motion Prompt (Prompt video)</span>
                            <button
                              onClick={async () => {
                                try {
                                  const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
                                  const durationVal = sh.duration || 4;
                                  const promptText = sh.storyboardPrompt || sh.visual || sh.hình_ảnh || sh.description || sh.diễn_tả || '';
                                  const res = await generateVideoScriptPrompt(promptText, durationVal);
                                  if (res && res.videoPrompt) {
                                    handleUpdateField(sh.beat, 'videoPrompt', res.videoPrompt);
                                  }
                                } catch (e: any) {
                                  alert("AI Error: " + e.message);
                                }
                              }}
                              className="text-[8.5px] text-purple-400 hover:text-purple-300 font-black flex items-center gap-0.5"
                            >
                              <Sparkles size={10} /> AI gợi ý
                            </button>
                          </div>
                          <textarea
                            rows={4}
                            value={sh.videoPrompt || sh.video_prompt || ''}
                            onChange={(e) => handleUpdateField(sh.beat, 'videoPrompt', e.target.value)}
                            className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-purple-300 outline-none resize-none leading-relaxed focus:border-indigo-500/40"
                            placeholder="Mô tả các chuyển động, hiệu ứng động của video..."
                          />
                        </div>

                        {/* Video QC Audit Panel */}
                        {renderQCAuditPanel(
                          sh.videoPrompt || sh.video_prompt || '',
                          sh.kind || 'action',
                          selectedCharIds,
                          sh.locationId || '',
                          sh.videoModel || 'veo_3_1_r2v_lite_low_priority',
                          lettaVideoViolations
                        )}

                        {/* Objective & Causal Link */}
                        <div className="grid grid-cols-2 gap-4 pt-1">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase block">Objective (Mục tiêu kịch bản)</span>
                            <textarea
                              rows={2.5}
                              value={sh.mục_tiêu || sh.objective || ''}
                              onChange={(e) => handleUpdateField(sh.beat, 'mục_tiêu', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-355 outline-none resize-none leading-relaxed focus:border-indigo-500/40"
                              placeholder="Mục tiêu của shot..."
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase block">Causal Link (Chuyển tiếp nhân quả)</span>
                            <textarea
                              rows={2.5}
                              value={sh.causalLink || ''}
                              onChange={(e) => handleUpdateField(sh.beat, 'causalLink', e.target.value)}
                              className="w-full bg-slate-955 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-355 outline-none resize-none leading-relaxed focus:border-indigo-500/40"
                              placeholder="Sự kiện kéo theo tiếp theo..."
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 bg-[#181820] border-t border-slate-800 flex justify-end">
                <button
                  onClick={() => setActiveDetailBeat(null)}
                  className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-black uppercase tracking-wider tracking-wide transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Hoàn Tất
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Zoom Preview Overlay */}
      {selectedZoomImage && (
        <div 
          className="fixed inset-0 z-[10005] bg-black/95 flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setSelectedZoomImage(null)}
        >
          <button 
            onClick={() => setSelectedZoomImage(null)}
            className="absolute top-6 right-6 p-3 rounded-full bg-slate-900 text-white transition-all shadow-xl hover:bg-slate-800"
          >
            <X size={20} />
          </button>
          <img 
            src={selectedZoomImage} 
            className="max-w-full max-h-full object-contain rounded-2xl border border-slate-850 shadow-2xl" 
            alt="Asset Preview Large" 
          />
        </div>
      )}
    </div>
  );
}