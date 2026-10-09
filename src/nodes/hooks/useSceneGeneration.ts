import { useState } from 'react';
import { useReactFlow } from 'reactflow';
import { useFlowStore } from '../../store/useFlowStore';
import { generateMediaViaGateway } from '../../utils/mediaGateway';
import { getApiBaseUrl } from '../../utils/apiConfig';

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

export function useSceneGeneration(id: string, data: any, modelId: string, ratio: string, batch: string) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderStatus, setRenderStatus] = useState<string | null>(null);
  
  const { getNodes, getEdges } = useReactFlow();
  const setNodes = useFlowStore.getState().setNodes;
  const projectData = useFlowStore(state => state.projectData);
  const engine = 'google_flow';
  
  const handleManualGenerate = async () => {
    if (!data.storyboardPrompt && !data.physicalCharacteristics) {
      alert("⚠️ Scene này chưa có Prompt. Vui lòng bấm Auto Refine trước.");
      return;
    }

    try {
      setIsRendering(true);
      setRenderStatus("Đang gửi lệnh...");

      const allNodes = getNodes();
      const worldAssetNode = allNodes.find(n => n.type === 'worldAssetNode');
      
      const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];
      const allLocations = worldAssetNode ? (worldAssetNode.data.locations || []) : [];
      
      const originalText = (data.action || data.physicalCharacteristics || "").toLowerCase();
      const promptText = (data.storyboardPrompt || "").toLowerCase();
      
      const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
      let mediaIds: string[] = [];
      const linkedAssetIds: string[] = [];
      const linkedEntities: Array<{ entityId: string; role: string }> = [];
      
      // Detect tag for this shot/scene
      const cameraTag = detectCameraTag(promptText, data.angle || data.camera_angle, data.framing);
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
      
      console.log(`[StoryMee][Scene] Resolved reference images mediaIds (useRemote: ${useRemote}):`, mediaIds);
      console.log(`[StoryMee][Scene] Linked World Asset IDs to sync:`, linkedAssetIds);
 
      let finalPrompt = data.storyboardPrompt || data.physicalCharacteristics || "";
      const primaryCharacters: string[] = data.primaryCharacters || [];
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

      // Automatically resolve storyboardFrameUrl from the connected scene node
      let storyboardFrameUrl = undefined;
      const incomingEdge = getEdges().find(e => e.target === id);
      if (incomingEdge) {
         const sourceNode = allNodes.find(n => n.id === incomingEdge.source);
         if (sourceNode) {
            storyboardFrameUrl = sourceNode.data.renderUrl || sourceNode.data.imageUrl;
         }
      }

      // =========================================================================
      // [NEW] ĐỊNH TUYẾN THAM CHIẾU PANORAMA TỰ ĐỘNG CHO CÁC SHOT PHỤ
      // =========================================================================
      const currentSc = data.sc || 'SC01';
      const establishingNode = allNodes.find(n => {
         if (n.id === id) return false; // Không lấy chính mình
         const nData = n.data || {};
         const nSc = nData.sc || '';
         if (nSc !== currentSc) return false;
         
         // Shot là establishing hoặc có shotNumber/id nhỏ nhất (ví dụ kết thúc bằng _B01 hoặc có shotNumber = 1)
         const isEst = nData.kind === 'establishing' || nData.framing === 'WIDE SHOT' || nData.framing === 'EXTREME WIDE';
         const isFirstShot = n.id.endsWith('_B01') || nData.shotNumber === 1 || nData.shot_number === 1;
         
         return isEst || isFirstShot;
      });

      if (establishingNode) {
         const estUrl = establishingNode.data.renderUrl || establishingNode.data.imageUrl;
         if (estUrl) {
            console.log(`[useSceneGeneration] Found establishing/panorama node ${establishingNode.id} with image ${estUrl}. Adding to the front of mediaIds as background reference!`);
            mediaIds = [estUrl, ...mediaIds.filter(id => id !== estUrl)];
         }
      }
      // =========================================================================

      const payload = {
        prompt: finalPrompt,
        config: {
          engine: engine,
          model_id: modelId,
          xray: data.generatorMode === 'xray',
          aspect_ratio: ratio === 'Auto' ? '16:9' : ratio,
          num_outputs: parseInt(batch.replace('x', '')),
          media_ids: mediaIds
        }
      };

      setRenderStatus("Đang khởi tạo...");
      const response = await generateMediaViaGateway({
        prompt: finalPrompt,
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: payload.config.num_outputs,
        mediaIds: mediaIds,
        ratio: payload.config.aspect_ratio,
        mediaType: 'image',
        linkedEntities: linkedEntities,
        ipId: id, // NEW: pass scene database ID!
        entityType: 'scene', // NEW: declare scene entity type!
        generatorMode: data.generatorMode || 'standard',
        storyboardFrameUrl: storyboardFrameUrl
      }, (status) => setRenderStatus(status));

      setIsRendering(false);
      if (!response.success || !response.images || response.images.length === 0) {
         console.error("Lỗi gen ảnh scene:", response.error);
         alert("Lỗi tạo ảnh: " + (response.error || "Unknown"));
         setRenderStatus("Lỗi");
         return;
      }

      setRenderStatus("Hoàn thành!");
      const edges = getEdges();
      const targetEdge = edges.find(e => e.source === id);
      const finalUrl = response.images[0].url;
      const finalId = response.images[0].mediaId;
      
      // Tự động đồng bộ ảnh hoạt cảnh vừa sinh vào thư viện Variants của các World Asset liên kết
      if (linkedAssetIds.length > 0 && finalUrl) {
         const baseUrl = getApiBaseUrl();
         const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
         const headers: any = { 'Content-Type': 'application/json' };
         if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

         linkedAssetIds.forEach(assetId => {
            const tagId = `scene_gen_${id.toLowerCase()}_${Date.now()}`;
            fetch(`${baseUrl}/internal/v1/asset/world/orchestrator/sync-variant`, {
               method: 'POST',
               headers,
               body: JSON.stringify({
                  characterId: assetId,
                  tagId: tagId,
                  driveUrl: finalUrl
               })
            }).then(r => r.json())
              .then(d => console.log(`[WorldAsset Sync] Synced variant for Asset ${assetId} successfully:`, d))
              .catch(e => console.error(`[WorldAsset Sync] Failed to sync variant for Asset ${assetId}:`, e));
         });
      }

      if (targetEdge) {
         setNodes((nds) => nds.map(n => {
            if (n.id === id) {
               const currentVariants = n.data.variants || [];
               const newVariant = {
                  url: finalUrl,
                  mediaId: finalId,
                  prompt: finalPrompt,
                  modelId: modelId,
                  timestamp: Date.now()
               };
               return { 
                  ...n, 
                  data: { 
                     ...n.data, 
                     renderUrl: finalUrl, 
                     generatedMediaId: finalId,
                     variants: [...currentVariants, newVariant]
                  } 
               };
            }
            if (n.id === targetEdge.target) return { ...n, data: { ...n.data, status: 'success', videoUrl: finalUrl, mediaType: 'image' } };
            return n;
         }));
         
         // Tự động Gen Video Prompt luôn sau khi có ảnh
         import('../../utils/scriptParser').then(({ generateVideoScriptPrompt }) => {
            const currentSceneNode = getNodes().find(n => n.id === id);
            if (currentSceneNode && currentSceneNode.data.storyboardPrompt) {
                const durationVal = currentSceneNode.data.duration || 8;
                generateVideoScriptPrompt(currentSceneNode.data.storyboardPrompt, durationVal).then(res => {
                    setNodes(nds => nds.map(n => 
                       n.id === targetEdge.target 
                       ? { ...n, data: { ...n.data, videoPrompt: res.videoPrompt } } 
                       : n
                    ));
                }).catch(e => console.warn("Lỗi auto video prompt", e));
            }
         });

      } else {
         setNodes((nds) => nds.map(n => {
            if (n.id === id) {
               const currentVariants = n.data.variants || [];
               const newVariant = {
                  url: finalUrl,
                  mediaId: finalId,
                  prompt: finalPrompt,
                  modelId: modelId,
                  timestamp: Date.now()
               };
               return { 
                  ...n, 
                  data: { 
                     ...n.data, 
                     renderUrl: finalUrl, 
                     generatedMediaId: finalId,
                     variants: [...currentVariants, newVariant]
                  } 
               };
            }
            return n;
         }));
      }

    } catch (err: any) {
      alert("❌ Lỗi khi Render: " + err.message);
      setIsRendering(false);
      setRenderStatus("Lỗi kết nối");
    }
  };

  const handleConvertToSketch = async () => {
    if (!data.generatedMediaId) {
      alert("⚠️ Vui lòng gen ảnh storyboard màu trước khi chuyển sang Sketch.");
      return;
    }
    try {
      setIsRendering(true);
      setRenderStatus("Đang chuyển Sketch...");
      
      const payload = {
        prompt: "Clean coloring page, black and white line art, pure white background, thin black outlines, sharp contours, no shading, no grayscale, colorless, perfect for coloring. " + (data.storyboardPrompt || ""),
        projectId: projectData?.id === 'new' ? undefined : projectData?.id,
        numOutputs: 1,
        mediaIds: [data.generatedMediaId]
      };

      const response = await generateMediaViaGateway({
        prompt: payload.prompt,
        projectId: payload.projectId,
        numOutputs: payload.numOutputs,
        mediaIds: payload.mediaIds,
        mediaType: 'image',
        generatorMode: 'xray' // Kích hoạt ControlNet trích xuất viền đen trắng
      }, (status) => setRenderStatus(status));

      setIsRendering(false);
      if (!response.success || !response.images || response.images.length === 0) {
         alert("Lỗi chuyển sketch: " + (response.error || "Unknown"));
         setRenderStatus("Lỗi");
         return;
      }

      setRenderStatus("Hoàn thành Sketch!");
      const finalUrl = response.images[0].url;
      const finalId = response.images[0].mediaId || response.images[0].id || finalUrl;
      setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, sketchRenderUrl: finalUrl, sketchMediaId: finalId } } : n));

    } catch (e: any) {
      alert("❌ Lỗi: " + e.message);
      setIsRendering(false);
      setRenderStatus("Lỗi");
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
      
      const worldAssetNode = connectedNodes.find(n => n.type === 'worldAssetNode');
      
      const matchedLoc = worldAssetNode ? (worldAssetNode.data.locations || []).find((l: any) => {
         const lName = l.name.toLowerCase().trim();
         const targetLName = (data.location || "").toLowerCase().trim();
         return lName === targetLName || safeMatchName(targetLName, lName) || safeMatchName(lName, targetLName);
      }) : null;
      
      let location = data.location || 'Unknown';
      const action = data.action || data.physicalCharacteristics || '';
      const dialogs: string[] = Array.isArray(data.dialogs) ? data.dialogs : 
        (data.dialogText ? data.dialogText.split('\n').filter((d: string) => d.trim() !== '') : []);
      
      const rawPrompt = `Location: ${location}\nAction: ${action}\nDialogue: ${dialogs.join('\n')}`;
      const characterNames = data.primaryCharacters && data.primaryCharacters.length > 0 ? data.primaryCharacters : (data.charactersInScene || []);
      const projectId = projectData?.selectedProjectId || projectData?.selectedUniverseId || projectData?.id || '';
      
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
             consistencyRes.violations.map(v => `- ${v.character}: ${v.violation} (Gợi ý: ${v.suggestion})`).join('\n');
        }
      } catch (e) {
        console.warn("Letta QC check failed during generate prompt:", e);
      }
      
      // Auto generate video prompt using the optimized storyboard prompt
      const { generateVideoScriptPrompt } = await import('../../utils/scriptParser');
      const durationVal = data.duration || 4;
      const videoRes = await generateVideoScriptPrompt(newPrompt, durationVal);
      const newVideoPrompt = videoRes?.videoPrompt || `[00:00-00:04] SHOT 1. ${newPrompt}`;
      
      setNodes((nds) => nds.map(n => {
         if (n.id === id) {
            return {
               ...n,
               data: {
                  ...n.data,
                  storyboardPrompt: newPrompt,
                  videoPrompt: n.data.videoPrompt || newVideoPrompt || "",
                  dialogs: dialogs,
                  transitions: [],
                  qcAssessment: qcText
               }
            };
         }
         return n;
      }));
    } catch (err: any) {
      alert("Lỗi khi tối ưu hóa prompt (Letta): " + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    isRendering,
    renderStatus,
    handleManualGenerate,
    handleConvertToSketch,
    handleGeneratePrompt
  };
}
