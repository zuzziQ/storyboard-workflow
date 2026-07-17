import { useState, useEffect, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { runAdvancedQCAudit } from '../../../../../../utils/qcRulesManager';
import { useFlowStore } from '../../../../../../store/useFlowStore';
import { X, Maximize2, Image as ImageIcon, Wand2, Loader2, Play, AlertTriangle, CheckCircle, Zap, MapPin, User, Download, Sparkles, Star, Lock, Unlock } from 'lucide-react';
import HighlightedTextarea from '../../../../../../components/HighlightedTextarea';
import { LOCAL_MAPPING_KEYWORDS } from '../../../../../../utils/assetMatcher';
import ShotVisualPromptForm from '../../../ShotVisualPromptForm';
import ShotAssetLinker from '../../../ShotAssetLinker';
import { getApiBaseUrl } from '../../../../../../utils/apiConfig';

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

const isStateActive = (state: string | undefined): boolean => {
  if (!state) return false;
  const lower = state.toLowerCase();
  return !lower.includes('xong') && !lower.includes('hoàn thành') && !lower.includes('lỗi');
};

export const getSanitizedImageModel = (model: string, provider: string) => {
  const modelVal = model || 'auto';
  if (provider === 'dreamina') {
    const valid = ['high_aes_gpt_v20', 'high_aes_general_v50', 'high_aes_general_v47', 'high_aes_general_v46', 'high_aes_general_v45', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'google-native') {
    const valid = ['imagen-3.0-fast-002', 'imagen-3.0-generate-002', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'sdk') {
    const valid = ['imagen-3', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'hub') {
    const valid = ['narwhal', 'flux_schnell', 'banana2', 'omni-flash-3', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  return modelVal;
};

export const getSanitizedVideoModel = (model: string, provider: string) => {
  const modelVal = model || 'auto';
  if (provider === 'dreamina') {
    const valid = ['dreamina_seedance_40_mini', 'dreamina_seedance_40', 'dreamina_seedance_40_pro', 'dreamina_lib_sync_image_quick_1.5', 'dreamina_seedance_10', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'google-native') {
    const valid = ['veo-2.0-generate-001', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'sdk') {
    const valid = ['veo-3.1-fast-generate-001', 'veo-2', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  if (provider === 'hub') {
    const valid = ['veo_3_1_r2v_lite_low_priority', 'veo_3_1_r2v_lite', 'veo_3_1', 'dreamina', 'auto'];
    return valid.includes(modelVal) ? modelVal : 'auto';
  }
  return modelVal;
};

interface ShotDetailModalProps {
  sh: any;
  allLocations: any[];
  allCharacters: any[];
  renderingStates: Record<string, string>;
  videoStates: Record<string, string>;
  runImageGenForShot: (sh: any, modelId: string) => void;
  runVideoGenForShot: (sh: any, videoModel: string) => void;
  handleUpdateShot: (shotId: string, field: string | Record<string, any>, value?: any) => void;
  setActiveDetailBeat: (beatId: string | null) => void;
  customProjectRules: string[];
  customEpisodeRules: string[];
  projectData: any;
  activeSceneId: string;
}

// Component con biên tập chi tiết Shot cô lập re-render để chống lag
const PacoShotDetailModal = memo(function PacoShotDetailModal({
  sh,
  allLocations,
  allCharacters,
  renderingStates,
  videoStates,
  runImageGenForShot,
  runVideoGenForShot,
  handleUpdateShot,
  setActiveDetailBeat,
  customProjectRules,
  customEpisodeRules,
  projectData,
  activeSceneId
}: ShotDetailModalProps) {
  const [activeDetailTab, setActiveDetailTab] = useState<'image' | 'video'>('image');
  const [selectedZoomImage, setSelectedZoomImage] = useState<string | null>(null);
  const [isExtractingFrame, setIsExtractingFrame] = useState(false);
  const [isAutoDrawing, setIsAutoDrawing] = useState(false);
  const [autoLayoutPreview, setAutoLayoutPreview] = useState<string | null>(null);

  const pendingShots = useFlowStore(state => state.pendingShots) || [];
  const setPendingShots = useFlowStore(state => state.setPendingShots);

  // Vẽ khối nhân vật lên Canvas, trả về Data URL
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
        // Vẽ overlay mờ
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, 0, W, H);
        characters.forEach(c => {
          const { x, y, w, h } = c.boundingBox;
          const bx = x * W, by = y * H, bw = w * W, bh = h * H;
          // Khối màu bán trong suốt
          ctx.strokeStyle = c.color;
          ctx.lineWidth = 4;
          ctx.fillStyle = c.color + '44';
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeRect(bx, by, bw, bh);
          // Nhãn tên
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
        // Nếu ảnh nền không load được, vẽ nền trắng
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

  const handleAutoLayout = async () => {
    const prompt = sh.videoPrompt || sh.description || sh.beat;
    if (!prompt) {
      alert('⚠️ Shot chưa có mô tả hoặc Video Prompt. Hãy nhập Prompt trước.');
      return;
    }
    try {
      setIsAutoDrawing(true);
      setAutoLayoutPreview(null);
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

      // Lấy ảnh nền hiện tại của Shot (nếu có)
      const bgUrl = sh.renderUrl || sh.imageUrl || sh.locationImageUrl || '';
      const compositeBase64 = await drawLayoutOnCanvas(bgUrl, data.layout.characters);
      setAutoLayoutPreview(compositeBase64);

      // Cập nhật ảnh storyboard của chính Shot này
      const currentShotId = sh.beat || sh.id;
      const updatedShots = pendingShots.map(s => {
        if (s.beat === sh.beat || s.id === sh.id) {
          return { ...s, renderUrl: compositeBase64, imageUrl: compositeBase64 };
        }
        return s;
      });
      setPendingShots(updatedShots);
      handleUpdateShot(currentShotId, { renderUrl: compositeBase64, imageUrl: compositeBase64 });
      alert(`✅ Auto Draw hoàn thành! Đã vẽ bố cục ${data.layout.characters.length} nhân vật.`);
    } catch (err: any) {
      console.error('[AutoLayout] Lỗi:', err);
      alert('❌ Lỗi Auto Draw: ' + err.message);
    } finally {
      setIsAutoDrawing(false);
    }
  };

  const handleExtractLastFrame = async () => {
    const activeVideoUrl = sh.videoUrl || sh.video_url || sh.renderVideoUrl;
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

  // Parse structured actingDetails string into sub-fields using index-based tracking
  const parseActingDetails = (text: string) => {
    const lines = text || "";
    let expressionArc = "";
    let startEndStates = "";
    let physicalDelta = "";

    const lowerText = lines.toLowerCase();
    const expIdx = lowerText.indexOf("expression arc:");
    const startEndIdx = lowerText.indexOf("start/end support:");
    const deltaIdx = lowerText.indexOf("physical delta:");

    const indices = [
      { key: 'exp', idx: expIdx, label: 'Expression arc:' },
      { key: 'startEnd', idx: startEndIdx, label: 'Start/end support:' },
      { key: 'delta', idx: deltaIdx, label: 'Physical delta:' }
    ].filter(item => item.idx !== -1).sort((a, b) => a.idx - b.idx);

    if (indices.length > 0) {
      for (let i = 0; i < indices.length; i++) {
        const current = indices[i];
        const next = indices[i + 1];
        const start = current.idx + current.label.length;
        const end = next ? next.idx : lines.length;
        
        let chunk = lines.substring(start, end).trim();
        // Remove trailing semicolon
        if (chunk.endsWith(';')) {
          chunk = chunk.slice(0, -1).trim();
        }
        if (current.key === 'exp') expressionArc = chunk;
        else if (current.key === 'startEnd') startEndStates = chunk;
        else if (current.key === 'delta') physicalDelta = chunk;
      }
    } else {
      // Fallback: If not structured, split lines
      const parts = lines.split('\n\n').filter(Boolean);
      expressionArc = parts[0] || "";
      startEndStates = parts[1] || "";
      physicalDelta = parts[2] || "";
    }

    return { expressionArc, startEndStates, physicalDelta };
  };

  const compileActingDetails = (exp: string, startEnd: string, delta: string) => {
    const parts = [];
    if (exp.trim()) parts.push(`Expression arc: ${exp.trim()};`);
    if (startEnd.trim()) parts.push(`Start/end support: ${startEnd.trim()};`);
    if (delta.trim()) parts.push(`Physical delta: ${delta.trim()};`);
    return parts.join('\n\n');
  };

  // Parse structured firstFrameState string into sub-fields
  const parseFirstFrameState = (text: string) => {
    const lines = text || "";
    let firstFrameVisual = "";
    let startState = "";
    let cameraFraming = "";
    let expressionStart = "";

    const lowerText = lines.toLowerCase();
    const visualIdx = lowerText.indexOf("first frame self-contained:");
    const startIdx = lowerText.indexOf("start state:");
    const cameraIdx = lowerText.indexOf("camera/framing:");
    const expIdx = lowerText.indexOf("expression start:");

    const indices = [
      { key: 'visual', idx: visualIdx, label: 'First frame self-contained:' },
      { key: 'start', idx: startIdx, label: 'Start state:' },
      { key: 'camera', idx: cameraIdx, label: 'Camera/framing:' },
      { key: 'exp', idx: expIdx, label: 'Expression start:' }
    ].filter(item => item.idx !== -1).sort((a, b) => a.idx - b.idx);

    if (indices.length > 0) {
      for (let i = 0; i < indices.length; i++) {
        const current = indices[i];
        const next = indices[i + 1];
        const start = current.idx + current.label.length;
        const end = next ? next.idx : lines.length;

        let chunk = lines.substring(start, end).trim();
        // Remove trailing period or semicolon
        if (chunk.endsWith('.')) chunk = chunk.slice(0, -1).trim();
        if (chunk.endsWith(';')) chunk = chunk.slice(0, -1).trim();

        if (current.key === 'visual') firstFrameVisual = chunk;
        else if (current.key === 'start') startState = chunk;
        else if (current.key === 'camera') cameraFraming = chunk;
        else if (current.key === 'exp') expressionStart = chunk;
      }
    } else {
      // Fallback
      firstFrameVisual = lines;
    }

    return { firstFrameVisual, startState, cameraFraming, expressionStart };
  };

  const compileFirstFrameState = (visual: string, start: string, camera: string, exp: string) => {
    const parts = [];
    if (visual.trim()) parts.push(`First frame self-contained: ${visual.trim()}.`);
    if (start.trim()) parts.push(`Start state: ${start.trim()}.`);
    if (camera.trim()) parts.push(`Camera/framing: ${camera.trim()}.`);
    if (exp.trim()) parts.push(`Expression start: ${exp.trim()}.`);
    return parts.join('\n');
  };

  // Hàm helper lấy dữ liệu diễn xuất fallback từ sh.originalFields
  const getFallbackActingDetails = (s: any) => {
    if (s.actingDetails || s.acting_details) return s.actingDetails || s.acting_details;
    const parts = [
      s.originalFields?.["Expression Arc / Physical Cue"],
      s.originalFields?.["Start -> End State"],
      s.originalFields?.["Physical Motion Delta"]
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('\n\n') : '';
  };

  // Hàm helper lấy dữ liệu ghi chú an toàn/đóng gói fallback từ sh.originalFields
  const getFallbackProductionSafety = (s: any) => {
    if (s.productionSafety || s.production_safety) return s.productionSafety || s.production_safety;
    const parts = [
      s.originalFields?.["Safety / No-text Note"] ? `Safety: ${s.originalFields["Safety / No-text Note"]}` : "",
      s.originalFields?.["Continuity Lock"] ? `Continuity Lock: ${s.originalFields["Continuity Lock"]}` : "",
      s.originalFields?.["Storyboard Usability Note"] ? `Usability: ${s.originalFields["Storyboard Usability Note"]}` : "",
      s.originalFields?.["Prompt Macro Note"] ? `Macro: ${s.originalFields["Prompt Macro Note"]}` : ""
    ].filter(Boolean);
    return parts.length > 0 ? parts.join('\n') : '';
  };

  // Local state cho cac truong textarea nhap chu
  const [localAction, setLocalAction] = useState(sh.diễn_tả || sh.description || sh.action || sh.originalFields?.["Action"] || '');
  const [localThoai, setLocalThoai] = useState(sh.thoại || sh.dialogue || sh.originalFields?.["Dialogue Timing Pass"] || sh.originalFields?.["Audio / Dialogue Note"] || '');
  const [localPrompt, setLocalPrompt] = useState(sh.storyboardPrompt || sh.visual || sh.hình_ảnh || '');
  const [localVideoPrompt, setLocalVideoPrompt] = useState(sh.videoPrompt || sh.video_prompt || '');
  const [localObjective, setLocalObjective] = useState(sh.mục_tiêu || sh.objective || sh.originalFields?.["Objective"] || '');
  const [localCausalLink, setLocalCausalLink] = useState(sh.causalLink || sh.causal_link || sh.originalFields?.["Transition Mode"] || sh.originalFields?.["Causal Link"] || sh.originalFields?.["Camera Transition Geometry / Visual Bridge"] || '');

  // Local state cho cac select box va input "Canh" de triet tieu delay
  const [localSc, setLocalSc] = useState(sh.sc || 'SC01');
  const [localLocationId, setLocalLocationId] = useState(sh.locationId || '');
  const [localKind, setLocalKind] = useState(sh.kind || 'action');
  const [localCameraHeight, setLocalCameraHeight] = useState(sh.camera_angle?.height || sh.cameraHeight || sh.originalFields?.["Framing"] || 'EYE');
  const [localPanelGrid, setLocalPanelGrid] = useState(sh.panelGrid || '1x1');
  const [localRenderMode, setLocalRenderMode] = useState(sh.renderMode || 'combined');
  const [localCameraMovement, setLocalCameraMovement] = useState(sh.cameraMovement || 'STATIC');
  const [localCharacterIds, setLocalCharacterIds] = useState<string[]>(sh.characterIds || []);
  const [localStoryboardModel, setLocalStoryboardModel] = useState(() => 
    getSanitizedImageModel(sh.storyboardModel || 'auto', imageProvider)
  );
  const [localVideoModel, setLocalVideoModel] = useState(() => 
    getSanitizedVideoModel(sh.videoModel || 'auto', videoProvider)
  );

  // KHUNG XƯƠNG MỚI: Các trường điện ảnh chi tiết
  const [localBearing, setLocalBearing] = useState<number>(sh.camera_angle?.bearing || sh.bearing || 0);
  const [localSide, setLocalSide] = useState<'A' | 'B'>(sh.camera_angle?.side || sh.side || 'A');
  const [localCameraMovementDetail, setLocalCameraMovementDetail] = useState<string>(sh.cameraMovementDetail || sh.camera_movement_detail || sh.camera_movement?.detail || sh.cameraMovement?.detail || sh.originalFields?.["Camera / Staging"] || '');
  
  const [localFirstFrameState, setLocalFirstFrameState] = useState<string>(sh.firstFrameState || sh.first_frame_state || sh.originalFields?.["First Frame Exact Visual State"] || '');
  const [localPhysicalDelta, setLocalPhysicalDelta] = useState<string>(sh.physicalDelta || sh.physical_delta || sh.originalFields?.["Physical Motion Delta"] || '');
  const [localPlannedLastFrame, setLocalPlannedLastFrame] = useState<string>(sh.plannedLastFrame || sh.planned_last_frame || sh.originalFields?.["Planned Last Frame / Clean Out Anchor"] || '');
  const [localPropState, setLocalPropState] = useState<string>(sh.propState || sh.prop_state || sh.originalFields?.["Prop / Object State (end of shot)"] || sh.originalFields?.["Tracked Object Last Position"] || '');
  
  const [localVisualBridge, setLocalVisualBridge] = useState<string>(sh.transition?.visualBridge || sh.visualBridge || sh.visual_bridge || sh.originalFields?.["Camera Transition Geometry / Visual Bridge"] || '');
  const [localTransitionGeometry, setLocalTransitionGeometry] = useState<string>(sh.transition?.transitionGeometry || sh.transitionGeometry || sh.transition_geometry || sh.originalFields?.["Transition Mode"] || '');
  const [localAudioSfxRules, setLocalAudioSfxRules] = useState<string>(sh.transition?.audioSfxRules || sh.audioSfxRules || sh.audio_sfx_rules || sh.originalFields?.["Audio / Dialogue Note"] || '');
  const [activeRightTab, setActiveRightTab] = useState<'acting' | 'camera' | 'production'>('acting');
  const [localActingDetails, setLocalActingDetails] = useState<string>(getFallbackActingDetails(sh));
  
  // Split states for Expression, States, Delta
  const initialActingParsed = parseActingDetails(getFallbackActingDetails(sh));
  const [localExpressionArc, setLocalExpressionArc] = useState<string>(initialActingParsed.expressionArc);
  const [localStartEndStates, setLocalStartEndStates] = useState<string>(initialActingParsed.startEndStates);
  const [localActingPhysicalDelta, setLocalActingPhysicalDelta] = useState<string>(initialActingParsed.physicalDelta);

  // Split states for First Frame State
  const initialFirstFrameParsed = parseFirstFrameState(sh.firstFrameState || sh.first_frame_state || sh.originalFields?.["First Frame Exact Visual State"] || '');
  const [localFirstFrameVisual, setLocalFirstFrameVisual] = useState<string>(initialFirstFrameParsed.firstFrameVisual);
  const [localFirstFrameStartState, setLocalFirstFrameStartState] = useState<string>(initialFirstFrameParsed.startState);
  const [localFirstFrameCamera, setLocalFirstFrameCamera] = useState<string>(initialFirstFrameParsed.cameraFraming);
  const [localFirstFrameExpression, setLocalFirstFrameExpression] = useState<string>(initialFirstFrameParsed.expressionStart);

  const [localMovementTempo, setLocalMovementTempo] = useState<string>(sh.movementTempo || sh.movement_tempo || sh.originalFields?.["Movement Speed / Tempo"] || '');
  const [localScreenDirection, setLocalScreenDirection] = useState<string>(sh.screenDirection || sh.screen_direction || sh.originalFields?.["Screen Direction / Frame Positions"] || '');
  const [localRaccordRef, setLocalRaccordRef] = useState<string>(sh.raccordRef || sh.raccord_ref || sh.raccordRequirement || sh.raccord_requirement || sh.originalFields?.["Raccord Ref Requirement"] || '');
  const [localProductionSafety, setLocalProductionSafety] = useState<string>(getFallbackProductionSafety(sh));

  // Tu dong dong bo khi shot prop ben ngoai thay doi (vi du khi doi shot hoac AI sinh xong)
  useEffect(() => {
    setLocalAction(sh.diễn_tả || sh.description || sh.action || sh.originalFields?.["Action"] || '');
    setLocalThoai(sh.thoại || sh.dialogue || sh.originalFields?.["Dialogue Timing Pass"] || sh.originalFields?.["Audio / Dialogue Note"] || '');
    setLocalPrompt(sh.storyboardPrompt || sh.visual || sh.hình_ảnh || '');
    setLocalVideoPrompt(sh.videoPrompt || sh.video_prompt || '');
    setLocalObjective(sh.mục_tiêu || sh.objective || sh.originalFields?.["Objective"] || '');
    setLocalCausalLink(sh.causalLink || sh.causal_link || sh.originalFields?.["Transition Mode"] || sh.originalFields?.["Causal Link"] || sh.originalFields?.["Camera Transition Geometry / Visual Bridge"] || '');
    
    setLocalSc(sh.sc || 'SC01');
    setLocalLocationId(sh.locationId || '');
    setLocalKind(sh.kind || 'action');
    setLocalCameraHeight(sh.camera_angle?.height || sh.cameraHeight || sh.originalFields?.["Framing"] || 'EYE');
    setLocalPanelGrid(sh.panelGrid || '1x1');
    setLocalRenderMode(sh.renderMode || 'combined');
    setLocalCameraMovement(sh.cameraMovement || 'STATIC');
    setLocalCharacterIds(sh.characterIds || []);
    setLocalStoryboardModel(getSanitizedImageModel(sh.storyboardModel || 'auto', imageProvider));
    setLocalVideoModel(getSanitizedVideoModel(sh.videoModel || 'auto', videoProvider));

    // Đồng bộ các trường điện ảnh chi tiết mới
    setLocalBearing(sh.camera_angle?.bearing || sh.bearing || 0);
    setLocalSide(sh.camera_angle?.side || sh.side || 'A');
    setLocalCameraMovementDetail(sh.cameraMovementDetail || sh.camera_movement_detail || sh.camera_movement?.detail || sh.cameraMovement?.detail || sh.originalFields?.["Camera / Staging"] || '');
    
    const fallbackFirstFrame = sh.firstFrameState || sh.first_frame_state || sh.originalFields?.["First Frame Exact Visual State"] || '';
    setLocalFirstFrameState(fallbackFirstFrame);
    const parsedFirstFrame = parseFirstFrameState(fallbackFirstFrame);
    setLocalFirstFrameVisual(parsedFirstFrame.firstFrameVisual);
    setLocalFirstFrameStartState(parsedFirstFrame.startState);
    setLocalFirstFrameCamera(parsedFirstFrame.cameraFraming);
    setLocalFirstFrameExpression(parsedFirstFrame.expressionStart);

    setLocalPhysicalDelta(sh.physicalDelta || sh.physical_delta || sh.originalFields?.["Physical Motion Delta"] || '');
    setLocalPlannedLastFrame(sh.plannedLastFrame || sh.planned_last_frame || sh.originalFields?.["Planned Last Frame / Clean Out Anchor"] || '');
    setLocalPropState(sh.propState || sh.prop_state || sh.originalFields?.["Prop / Object State (end of shot)"] || sh.originalFields?.["Tracked Object Last Position"] || '');
    
    setLocalVisualBridge(sh.transition?.visualBridge || sh.visualBridge || sh.visual_bridge || sh.originalFields?.["Camera Transition Geometry / Visual Bridge"] || '');
    setLocalTransitionGeometry(sh.transition?.transitionGeometry || sh.transitionGeometry || sh.transition_geometry || sh.originalFields?.["Transition Mode"] || '');
    setLocalAudioSfxRules(sh.transition?.audioSfxRules || sh.audioSfxRules || sh.audio_sfx_rules || sh.originalFields?.["Audio / Dialogue Note"] || '');

    const fallbackActing = getFallbackActingDetails(sh);
    setLocalActingDetails(fallbackActing);
    const parsedActing = parseActingDetails(fallbackActing);
    setLocalExpressionArc(parsedActing.expressionArc);
    setLocalStartEndStates(parsedActing.startEndStates);
    setLocalActingPhysicalDelta(parsedActing.physicalDelta);

    setLocalMovementTempo(sh.movementTempo || sh.movement_tempo || sh.originalFields?.["Movement Speed / Tempo"] || '');
    setLocalScreenDirection(sh.screenDirection || sh.screen_direction || sh.originalFields?.["Screen Direction / Frame Positions"] || '');
    setLocalRaccordRef(sh.raccordRef || sh.raccord_ref || sh.raccordRequirement || sh.raccord_requirement || sh.originalFields?.["Raccord Ref Requirement"] || '');
    setLocalProductionSafety(getFallbackProductionSafety(sh));
  }, [sh]);

  // Debounce 800ms de chay QC Audit ma khong lam lag input khi dang go
  const [debouncedPrompt, setDebouncedPrompt] = useState(localPrompt);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedPrompt(localPrompt);
    }, 800);
    return () => clearTimeout(handler);
  }, [localPrompt]);

  const [debouncedVideoPrompt, setDebouncedVideoPrompt] = useState(localVideoPrompt);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedVideoPrompt(localVideoPrompt);
    }, 800);
    return () => clearTimeout(handler);
  }, [localVideoPrompt]);

  const [lettaViolations, setLettaViolations] = useState<any[]>([]);
  const [lettaVideoViolations, setLettaVideoViolations] = useState<any[]>([]);
  const [isCheckingLetta, setIsCheckingLetta] = useState(false);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!debouncedPrompt) {
        setLettaViolations([]);
        return;
      }
      const projectId = projectData?.selectedProjectId || projectData?.selectedUniverseId || projectData?.id;
      if (!projectId || projectId === 'new') return;
      
      const charNames = localCharacterIds.map((id: string) => {
        const c = allCharacters.find((char: any) => char.worldAssetCharId === id);
        return c ? c.name : null;
      }).filter(Boolean) as string[];

      if (charNames.length === 0) {
        setLettaViolations([]);
        return;
      }

      try {
        setIsCheckingLetta(true);
        const { checkPromptConsistency } = await import('../../../../../../services/api');
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
  }, [debouncedPrompt, localCharacterIds, projectData]);

  useEffect(() => {
    let active = true;
    const check = async () => {
      if (!debouncedVideoPrompt) {
        setLettaVideoViolations([]);
        return;
      }
      const projectId = projectData?.selectedProjectId || projectData?.selectedUniverseId || projectData?.id;
      if (!projectId || projectId === 'new') return;
      
      const charNames = localCharacterIds.map((id: string) => {
        const c = allCharacters.find((char: any) => char.worldAssetCharId === id);
        return c ? c.name : null;
      }).filter(Boolean) as string[];

      if (charNames.length === 0) {
        setLettaVideoViolations([]);
        return;
      }

      try {
        const { checkPromptConsistency } = await import('../../../../../../services/api');
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
  }, [debouncedVideoPrompt, localCharacterIds, projectData]);

  // Ham dong bo tu local state len Zustand store
  const flushLocalStates = () => {
    handleUpdateShot(sh.beat || sh.id, {
      diễn_tả: localAction,
      description: localAction,
      thoại: localThoai,
      dialogue: localThoai,
      storyboardPrompt: localPrompt,
      visual: localPrompt,
      hình_ảnh: localPrompt,
      videoPrompt: localVideoPrompt,
      video_prompt: localVideoPrompt,
      mục_tiêu: localObjective,
      objective: localObjective,
      causalLink: localCausalLink,
      
      sc: localSc,
      locationId: localLocationId,
      kind: localKind,
      cameraHeight: localCameraHeight,
      panelGrid: localPanelGrid,
      renderMode: localRenderMode,
      cameraMovement: localCameraMovement,
      characterIds: localCharacterIds,
      storyboardModel: localStoryboardModel,
      videoModel: localVideoModel,

      // Đồng bộ các trường điện ảnh mới
      bearing: Number(localBearing),
      side: localSide,
      camera_angle: {
        height: localCameraHeight,
        bearing: Number(localBearing),
        side: localSide
      },
      cameraMovementDetail: localCameraMovementDetail,
      camera_movement_detail: localCameraMovementDetail,
      camera_movement: {
        type: localCameraMovement,
        detail: localCameraMovementDetail
      },
      firstFrameState: compileFirstFrameState(localFirstFrameVisual, localFirstFrameStartState, localFirstFrameCamera, localFirstFrameExpression),
      first_frame_state: compileFirstFrameState(localFirstFrameVisual, localFirstFrameStartState, localFirstFrameCamera, localFirstFrameExpression),
      physicalDelta: localPhysicalDelta,
      physical_delta: localPhysicalDelta,
      plannedLastFrame: localPlannedLastFrame,
      planned_last_frame: localPlannedLastFrame,
      propState: localPropState,
      prop_state: localPropState,
      
      visualBridge: localVisualBridge,
      visual_bridge: localVisualBridge,
      transitionGeometry: localTransitionGeometry,
      transition_geometry: localTransitionGeometry,
      audioSfxRules: localAudioSfxRules,
      audio_sfx_rules: localAudioSfxRules,
      transition: {
        type: localKind === 'transition' ? 'custom' : 'none',
        visualBridge: localVisualBridge,
        transitionGeometry: localTransitionGeometry,
        audioSfxRules: localAudioSfxRules
      },

      actingDetails: compileActingDetails(localExpressionArc, localStartEndStates, localActingPhysicalDelta),
      acting_details: compileActingDetails(localExpressionArc, localStartEndStates, localActingPhysicalDelta),
      movementTempo: localMovementTempo,
      movement_tempo: localMovementTempo,
      screenDirection: localScreenDirection,
      screen_direction: localScreenDirection,
      raccordRef: localRaccordRef,
      raccord_ref: localRaccordRef,
      productionSafety: localProductionSafety,
      production_safety: localProductionSafety
    });
  };

  const handleBlur = () => {
    flushLocalStates();
  };

  const handleAiRegeneratePromptWithLocal = async () => {
    try {
      const { compileCinematicPrompt } = await import('../../../../../../lib/cinematic-engine/promptBuilder');
      const projectStyle = projectData?.stylePrompt || "Pixar-style 3D animation";
      
      const charRefs = localCharacterIds.map((id: string) => {
        const c = allCharacters.find((char: any) => char.worldAssetCharId === id);
        return c ? c.name : null;
      }).filter(Boolean);

      const compiled = compileCinematicPrompt({
        ...sh,
        sc: localSc,
        locationId: localLocationId,
        kind: localKind,
        cameraHeight: localCameraHeight,
        panelGrid: localPanelGrid,
        renderMode: localRenderMode,
        cameraMovement: localCameraMovement,
        characterIds: localCharacterIds,
        description: localAction, // Dung gia tri local sếp dang sua
        character_refs: charRefs
      }, projectStyle);

      const newStoryboardPrompt = compiled.promptText;
      const newVideoPrompt = compiled.videoPromptText || compiled.promptText;

      setLocalPrompt(newStoryboardPrompt);
      setLocalVideoPrompt(newVideoPrompt);

      handleUpdateShot(sh.beat || sh.id, {
        storyboardPrompt: newStoryboardPrompt,
        visual: newStoryboardPrompt,
        hình_ảnh: newStoryboardPrompt,
        videoPrompt: newVideoPrompt,
        video_prompt: newVideoPrompt,

        sc: localSc,
        locationId: localLocationId,
        kind: localKind,
        cameraHeight: localCameraHeight,
        panelGrid: localPanelGrid,
        renderMode: localRenderMode,
        cameraMovement: localCameraMovement,
        characterIds: localCharacterIds
      });

      alert("🎉 Đã sinh lại prompt vẽ ảnh & video thành công!");
    } catch (err: any) {
      alert("Lỗi AI Regenerate Prompt: " + err.message);
    }
  };

  const runImageGenWithLocal = () => {
    const updatedFields = {
      diễn_tả: localAction,
      description: localAction,
      thoại: localThoai,
      dialogue: localThoai,
      storyboardPrompt: localPrompt,
      visual: localPrompt,
      hình_ảnh: localPrompt,
      videoPrompt: localVideoPrompt,
      video_prompt: localVideoPrompt,
      mục_tiêu: localObjective,
      objective: localObjective,
      causalLink: localCausalLink,
      sc: localSc,
      locationId: localLocationId,
      kind: localKind,
      cameraHeight: localCameraHeight,
      panelGrid: localPanelGrid,
      renderMode: localRenderMode,
      cameraMovement: localCameraMovement,
      characterIds: localCharacterIds,
      storyboardModel: localStoryboardModel,
      videoModel: localVideoModel
    };
    handleUpdateShot(sh.beat || sh.id, updatedFields);
    runImageGenForShot({ ...sh, ...updatedFields }, localStoryboardModel);
  };

  const runVideoGenWithLocal = () => {
    const updatedFields = {
      diễn_tả: localAction,
      description: localAction,
      thoại: localThoai,
      dialogue: localThoai,
      storyboardPrompt: localPrompt,
      visual: localPrompt,
      hình_ảnh: localPrompt,
      videoPrompt: localVideoPrompt,
      video_prompt: localVideoPrompt,
      mục_tiêu: localObjective,
      objective: localObjective,
      causalLink: localCausalLink,
      sc: localSc,
      locationId: localLocationId,
      kind: localKind,
      cameraHeight: localCameraHeight,
      panelGrid: localPanelGrid,
      renderMode: localRenderMode,
      cameraMovement: localCameraMovement,
      characterIds: localCharacterIds,
      storyboardModel: localStoryboardModel,
      videoModel: localVideoModel
    };
    handleUpdateShot(sh.beat || sh.id, updatedFields);
    runVideoGenForShot({ ...sh, ...updatedFields }, localVideoModel);
  };

  const handleClose = () => {
    flushLocalStates();
    setActiveDetailBeat(null);
  };

  const finalPromptText = debouncedPrompt;
  const wordCount = localPrompt.split(/\s+/).filter(Boolean).length;
  const isOverBudget = wordCount > 180;
  const storyboardUrl = sh.renderUrl || sh.imageUrl;
  const videoUrl = sh.videoUrl || sh.video_url || sh.renderVideoUrl;
  const storyboardVariants = sh.variants || [];

  const selectedLocId = localLocationId;
  const matchedLoc = allLocations.find((l: any) => l.worldAssetCharId === selectedLocId);
  const selectedCharIds = localCharacterIds;
  const matchedChars = selectedCharIds.map((charId: any) => {
    return allCharacters.find((c: any) => c.worldAssetCharId === charId);
  }).filter(Boolean);

  const normalizeCameraMovement = (movement: any): string => {
    if (!movement) return 'STATIC';
    const clean = String(movement).toUpperCase().trim();
    if (clean.includes('PAN_LEFT') || clean.includes('LEFT')) return 'PAN_LEFT';
    if (clean.includes('PAN_RIGHT') || clean.includes('RIGHT')) return 'PAN_RIGHT';
    if (clean.includes('TILT_UP') || clean.includes('UP')) return 'TILT_UP';
    if (clean.includes('TILT_DOWN') || clean.includes('DOWN')) return 'TILT_DOWN';
    if (clean.includes('ZOOM_IN') || clean.includes('IN')) return 'ZOOM_IN';
    if (clean.includes('ZOOM_OUT') || clean.includes('OUT')) return 'ZOOM_OUT';
    return 'STATIC';
  };

  const hasRealDialogue = localThoai && 
    localThoai.trim().length > 0 && 
    !/^(no\s+dialogue|no\s+visible\s+dialogue|silent|none|no\s+voiceover|no\s+visible)/i.test(localThoai.trim());

  const isCharacterSpeaking = (charName: string, charId: string): boolean => {
    if (!hasRealDialogue) return false;
    const cleanDialogue = localThoai.toLowerCase();
    const keywords = LOCAL_MAPPING_KEYWORDS[charName] || [charName];
    const hasKeyword = keywords.some(kw => cleanDialogue.includes(kw.toLowerCase()));
    if (hasKeyword) return true;
    if (localCharacterIds.length === 1 && localCharacterIds[0] === charId) {
      return true;
    }
    return false;
  };

  // Tính toán QC Audit một lần duy nhất ở đầu modal
  const qcResult = runAdvancedQCAudit(
    finalPromptText,
    localKind,
    localCharacterIds,
    localLocationId,
    localStoryboardModel,
    customProjectRules,
    customEpisodeRules
  );

  const qcVideoResult = runAdvancedQCAudit(
    debouncedVideoPrompt,
    localKind,
    localCharacterIds,
    localLocationId,
    localVideoModel,
    customProjectRules,
    customEpisodeRules
  );

  const renderQCAuditPanel = (
    result: any,
    activeModel: string,
    lettaViolationsList: any[] = []
  ) => {
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

    let budgetColor = 'bg-emerald-950/30 border-emerald-900/40 text-emerald-400';
    if (result.wordBudgetStatus === 'caution') {
      budgetColor = 'bg-amber-950/30 border-amber-900/40 text-amber-400';
    } else if (result.wordBudgetStatus === 'danger') {
      budgetColor = 'bg-rose-955/30 border-rose-900/40 text-rose-450';
    } else if (result.wordBudgetStatus === 'low') {
      budgetColor = 'bg-slate-900 border-slate-800 text-slate-400';
    }

    return (
      <div className="bg-[#121217] border border-slate-855 rounded-xl p-2.5 space-y-2 shadow-inner">
        <div className="flex items-center justify-between border-b border-slate-855/60 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-indigo-400 animate-pulse" />
            <span className="text-[9.5px] font-black text-slate-355 uppercase tracking-wider">KẾT QUẢ KIỂM TRA CHẤT LƯỢNG (QC AUDIT)</span>
          </div>
          <span className={`px-1.5 py-0.5 rounded border text-[8.5px] font-black uppercase tracking-wider ${riskBadgeColor}`}>
            {riskLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-[#0b0b0d] border border-slate-900 py-1.5 px-2 rounded-lg flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">NGÂN SÁCH TỪ</span>
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-black text-white font-mono">{result.wordCount} từ</span>
              <span className={`px-1 py-0.5 rounded text-[8px] font-extrabold border ${budgetColor}`}>
                {result.wordBudgetMessage}
              </span>
            </div>
          </div>

          <div className="bg-[#0b0b0d] border border-slate-900 py-1.5 px-2 rounded-lg flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">PHÙ HỢP ENGINE</span>
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-black text-indigo-300 uppercase tracking-wider truncate max-w-[120px]">{activeModel}</span>
              <span className="text-[9px] font-bold text-slate-455 font-mono">OK</span>
            </div>
          </div>

          <div className="bg-[#0b0b0d] border border-slate-900 py-1.5 px-2 rounded-lg flex flex-col justify-between">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block mb-0.5">LIÊN KẾT ASSET</span>
            <div className="text-[9px] font-bold text-slate-300 flex items-center justify-between">
              <span>Chars: {selectedCharIds.length}</span>
              <span>Loc: {selectedLocId ? 'Có' : 'Không'}</span>
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
                <div key={vIdx} className="flex flex-col p-1.5 bg-orange-950/20 border border-orange-900/30 rounded-lg text-[9.5px] text-orange-200 leading-tight">
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

        {result.bannedWordsMatched.length > 0 && (
          <div className="space-y-1">
            <div className="text-[8.5px] font-black text-rose-450 uppercase tracking-wider">Cảnh báo vi phạm từ cấm ({result.bannedWordsMatched.length})</div>
            <div className="space-y-1 max-h-16 overflow-y-auto custom-scrollbar">
              {result.bannedWordsMatched.map((v: any, vIdx: number) => (
                <div key={vIdx} className="flex gap-1.5 p-1 bg-rose-955/20 border border-rose-900/30 rounded-lg text-[9px] text-rose-200">
                  <AlertTriangle size={10} className="text-rose-455 shrink-0 mt-0.5" />
                  <span className="leading-tight">Từ cấm: "{v}" (Có thể gây rác chữ/kí hiệu lạ trong video/ảnh)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[#070709] border border-slate-900 rounded-lg p-2 space-y-1">
          <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider block">KHUYẾN NGHỊ &amp; LƯU Ý RỦI RO</span>
          <div className="max-h-16 overflow-y-auto custom-scrollbar space-y-1 pr-1 text-left">
            {result.suggestedRiskNotes.map((note: string, idx: number) => {
              const isOk = note.includes("đạt chuẩn") || note.includes("sẵn sàng");
              return (
                <div key={idx} className="flex items-start gap-1 text-[9px] text-slate-355 leading-tight">
                  {isOk ? (
                    <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-amber-555 shrink-0 mt-0.5" />
                  )}
                  <span>{note}</span>
                </div>
              );
            })}
            {result.modelAlerts.map((alertMsg: string, idx: number) => (
              <div key={`alert-${idx}`} className="flex items-start gap-1 text-[9px] text-amber-400 leading-tight font-bold">
                <AlertTriangle className="w-3 h-3 text-amber-555 shrink-0 mt-0.5" />
                <span>{alertMsg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        onClick={handleClose}
        className="fixed inset-0 z-[9998] bg-slate-955/60 backdrop-blur-sm animate-in fade-in duration-200"
      />
      
      {/* Right Drawer */}
      <div className="fixed top-16 right-0 bottom-0 w-[68vw] min-w-[950px] max-w-[1400px] bg-[#101014] border-l border-slate-800/80 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] z-[9999] flex flex-col overflow-hidden rounded-l-3xl animate-in slide-in-from-right duration-300">
        
        {/* Modal Header */}
        <div className="px-5 py-3 bg-[#181820] border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-lg text-xs font-black bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-bold">
              {sh.beat || sh.id}
            </span>
            <button
              onClick={() => {
                const nextApproved = !sh.isApproved;
                handleUpdateShot(sh.beat || sh.id, 'isApproved', nextApproved);
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-black border flex items-center gap-1.5 transition-all cursor-pointer ${
                sh.isApproved
                  ? 'bg-amber-500/20 border-amber-500/45 text-amber-400 hover:bg-amber-500/30 shadow-inner'
                  : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-350 hover:bg-slate-800'
              }`}
              title={sh.isApproved ? 'Mở khóa và sửa đổi' : 'Khóa chốt shot & ngăn thay đổi'}
            >
              {sh.isApproved ? (
                <>
                  <Lock size={11} className="text-amber-400" />
                  <span>ĐÃ CHỐT</span>
                </>
              ) : (
                <>
                  <Unlock size={11} className="text-slate-400" />
                  <span>CHỐT SHOT</span>
                </>
              )}
            </button>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">Chi Tiết Phân Cảnh &amp; Cấu Hình Kỹ Thuật</h4>
              <p className="text-[9px] text-slate-400">Thiết lập góc máy, nhân vật, bối cảnh, prompt và sinh thử media trực quan</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg bg-slate-855 hover:bg-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer border border-slate-800"
          >
            <X size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden p-4 flex gap-4 text-left bg-[#0c0c0e]">
          {/* Cot trai: Media Preview & QC Audit */}
          <div className="w-[48%] space-y-3 flex flex-col overflow-y-auto custom-scrollbar pr-1 max-h-full">
            <div className="flex gap-1.5 p-0.5 bg-[#181820] border border-slate-850 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setActiveDetailTab('image')}
                className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all duration-150 ${activeDetailTab === 'image' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Storyboard
              </button>
              <button
                type="button"
                onClick={() => setActiveDetailTab('video')}
                className={`px-3 py-1 rounded-lg text-[10.5px] font-black uppercase transition-all duration-150 ${activeDetailTab === 'video' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                Dựng Video
              </button>
            </div>

            <div className="h-[220px] bg-slate-955/60 border border-slate-850 rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner group shrink-0">
              {activeDetailTab === 'video' && videoUrl ? (
                <>
                  <video src={videoUrl} className="w-full h-full object-contain" controls autoPlay muted loop />
                  <button
                    type="button"
                    onClick={handleExtractLastFrame}
                    disabled={isExtractingFrame}
                    className="absolute bottom-3 right-3 bg-indigo-600/90 hover:bg-indigo-650 text-white text-[9px] px-2 py-1 rounded-lg font-black transition-all shadow-md active:scale-95 z-10 flex items-center gap-1 cursor-pointer border border-indigo-500/30 disabled:opacity-50"
                    title="Trích xuất frame cuối của video này và đặt làm ảnh Storyboard cho Shot tiếp theo để nối raccord"
                  >
                    {isExtractingFrame ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <span>🪄 Lấy frame cuối cho Shot sau</span>
                    )}
                  </button>
                </>
              ) : (activeDetailTab === 'image' && storyboardUrl) || (!videoUrl && storyboardUrl) ? (
                <>
                  <img src={storyboardUrl} className="w-full h-full object-contain" alt="Preview Storyboard" />
                  <button
                    type="button"
                    onClick={handleAutoLayout}
                    disabled={isAutoDrawing}
                    className="absolute bottom-3 right-3 bg-emerald-600/90 hover:bg-emerald-650 text-white text-[9px] px-2 py-1 rounded-lg font-black transition-all shadow-md active:scale-95 z-10 flex items-center gap-1 cursor-pointer border border-emerald-500/30 disabled:opacity-50"
                    title="Phân tích prompt để nhận diện nhân vật và vẽ khối vị trí lên ảnh"
                  >
                    {isAutoDrawing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <span>🪄 Auto vẽ khối</span>
                    )}
                  </button>
                </>
              ) : (
                <div className="text-center text-slate-655 space-y-1">
                  <ImageIcon size={36} className="mx-auto text-slate-800" />
                  <span className="text-[10px] block">
                    {activeDetailTab === 'video' ? 'Chưa dựng Video Ref' : 'Chưa vẽ ảnh Storyboard Ref'}
                  </span>
                  <button
                    type="button"
                    onClick={handleAutoLayout}
                    disabled={isAutoDrawing}
                    className="mt-2 bg-emerald-600/90 hover:bg-emerald-650 text-white text-[9px] px-2 py-1 rounded-lg font-black transition-all shadow-md active:scale-95 flex items-center gap-1 mx-auto cursor-pointer border border-emerald-500/30 disabled:opacity-50"
                  >
                    {isAutoDrawing ? (
                      <Loader2 size={10} className="animate-spin" />
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
                  className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Phóng to ảnh"
                >
                  <Maximize2 size={13} />
                </button>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-[#121217] border border-slate-850 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="text-[9px] font-black text-slate-455 uppercase tracking-widest">Asset Orchestrator Engine</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[8.5px] font-black uppercase block text-pink-400">Storyboard Model</span>
                  <select 
                    value={localStoryboardModel} 
                    onChange={e => setLocalStoryboardModel(e.target.value)}
                    className="w-full bg-[#09090c] border border-slate-855 rounded-lg py-1 px-2 text-[10px] font-bold text-pink-400 outline-none focus:border-indigo-500/40 cursor-pointer"
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
                  {sh.isApproved ? (
                    <div className="w-full py-1.5 bg-slate-900/60 border border-slate-800/50 text-slate-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 cursor-default">
                      <Lock size={11} className="text-slate-500" />
                      <span>Đã khóa</span>
                    </div>
                  ) : (
                    <button
                      onClick={runImageGenWithLocal}
                      disabled={isStateActive(renderingStates[sh.beat || sh.id])}
                      className="w-full py-1.5 bg-pink-650 hover:bg-pink-600 text-white font-black text-[10.5px] uppercase rounded-xl transition-all shadow-lg shadow-pink-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isStateActive(renderingStates[sh.beat || sh.id]) ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Wand2 size={12} />
                      )}
                      <span>{isStateActive(renderingStates[sh.beat || sh.id]) ? renderingStates[sh.beat || sh.id] : "Vẽ lại ảnh"}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[8.5px] font-black uppercase block text-purple-400">Video Model</span>
                  <select 
                    value={localVideoModel} 
                    onChange={e => setLocalVideoModel(e.target.value)}
                    className="w-full bg-[#09090c] border border-slate-855 rounded-lg py-1 px-2 text-[10px] font-bold text-purple-400 outline-none focus:border-indigo-500/40 cursor-pointer"
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
                  {sh.isApproved ? (
                    <div className="w-full py-1.5 bg-slate-900/60 border border-slate-800/50 text-slate-500 rounded-xl text-[10px] font-black uppercase flex items-center justify-center gap-1 cursor-default">
                      <Lock size={11} className="text-slate-500" />
                      <span>Đã khóa</span>
                    </div>
                  ) : (
                    <button
                      onClick={runVideoGenWithLocal}
                      disabled={!localVideoPrompt || isStateActive(videoStates[sh.beat || sh.id])}
                      className="w-full py-1.5 bg-purple-650 hover:bg-purple-600 text-white font-black text-[10.5px] uppercase rounded-xl transition-all shadow-lg shadow-purple-500/10 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {isStateActive(videoStates[sh.beat || sh.id]) ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      <span>{isStateActive(videoStates[sh.beat || sh.id]) ? videoStates[sh.beat || sh.id] : "Dựng lại Video"}</span>
                    </button>
                  )}
                </div>
              </div>

              {storyboardVariants.length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <span className="text-[8.5px] font-bold text-slate-500 uppercase tracking-wider block">Các biến thể ảnh cũ (Click để đổi):</span>
                  <div className="flex gap-1.5 items-center flex-wrap overflow-y-auto max-h-16 custom-scrollbar">
                    {storyboardVariants.map((v: any, vIdx: number) => (
                      <div
                        key={vIdx}
                        onClick={() => handleUpdateShot(sh.beat || sh.id, { renderUrl: v.url, imageUrl: v.url, generatedMediaId: v.mediaId })}
                        className={`w-14 aspect-video bg-[#09090c] rounded border cursor-pointer overflow-hidden transition-all ${v.url === storyboardUrl ? 'border-pink-500 scale-95 shadow' : 'border-slate-800 opacity-60 hover:opacity-100'}`}
                      >
                        <img src={v.url} className="w-full h-full object-cover" alt="v" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Prompts Section (Được đưa từ cột 2 sang cột 1) */}
            <fieldset 
              disabled={sh.isApproved} 
              className="space-y-2.5 p-3 bg-[#121217] border border-slate-855 rounded-xl border-none disabled:opacity-90"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase block">Action (Hành Động)</span>
                  <textarea
                    value={localAction}
                    onChange={(e) => setLocalAction(e.target.value)}
                    onBlur={handleBlur}
                    disabled={sh.isApproved}
                    className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-20 2xl:h-44 min-h-[80px] disabled:opacity-65 disabled:cursor-not-allowed"
                    placeholder="Mô tả hành động của nhân vật..."
                    style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                  />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8.5px] font-black text-slate-400 uppercase block">Dialogue (Lời Thoại)</span>
                  <textarea
                    value={localThoai}
                    onChange={(e) => setLocalThoai(e.target.value)}
                    onBlur={handleBlur}
                    disabled={sh.isApproved}
                    className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-amber-300 outline-none resize-y leading-normal italic focus:border-indigo-500/40 custom-scrollbar h-20 2xl:h-44 min-h-[80px] disabled:opacity-65 disabled:cursor-not-allowed"
                    placeholder="Lời thoại nhân vật..."
                    style={{ backgroundColor: '#09090c' }}
                  />
                </div>
              </div>

              {activeDetailTab === 'image' ? (
                <ShotVisualPromptForm
                  sh={sh}
                  localPrompt={localPrompt}
                  setLocalPrompt={setLocalPrompt}
                  localCameraHeight={localCameraHeight}
                  setLocalCameraHeight={setLocalCameraHeight}
                  localPanelGrid={localPanelGrid}
                  setLocalPanelGrid={setLocalPanelGrid}
                  localBearing={localBearing}
                  setLocalBearing={setLocalBearing}
                  localSide={localSide}
                  setLocalSide={setLocalSide}
                  localCameraMovement={localCameraMovement}
                  setLocalCameraMovement={setLocalCameraMovement}
                  localRenderMode={localRenderMode}
                  setLocalRenderMode={setLocalRenderMode}
                  localCameraMovementDetail={localCameraMovementDetail}
                  setLocalCameraMovementDetail={setLocalCameraMovementDetail}
                  handleBlur={handleBlur}
                  wordCount={wordCount}
                  isOverBudget={isOverBudget}
                  qcResult={qcResult}
                  handleAiRegeneratePromptWithLocal={handleAiRegeneratePromptWithLocal}
                  normalizeCameraMovement={normalizeCameraMovement}
                />
              ) : (
                 <div className="space-y-2.5">
                   <div className="space-y-0.5">
                     <div className="flex justify-between items-center">
                       <span className="text-[8.5px] font-black text-purple-400 uppercase block">Video Motion Prompt (Prompt video)</span>
                       <button
                         onClick={async () => {
                           try {
                             const { generateVideoScriptPrompt } = await import('../../../../../../utils/scriptParser');
                             const durationVal = sh.duration || 4;
                             const res = await generateVideoScriptPrompt(localPrompt, durationVal);
                             if (res && res.videoPrompt) {
                               setLocalVideoPrompt(res.videoPrompt);
                               handleUpdateShot(sh.beat || sh.id, { videoPrompt: res.videoPrompt, video_prompt: res.videoPrompt });
                             }
                           } catch (e: any) {
                              alert("AI Error: " + e.message);
                           }
                         }}
                         className="text-[8px] text-purple-400 hover:text-purple-300 font-black flex items-center gap-0.5 cursor-pointer"
                       >
                         <Sparkles size={9} /> AI gợi ý
                       </button>
                     </div>
                     <HighlightedTextarea
                       value={localVideoPrompt}
                       onChange={(e: any) => setLocalVideoPrompt(e.target.value)}
                       onBlur={handleBlur}
                       disabled={sh.isApproved}
                       placeholder="Mô tả các chuyển động, hiệu ứng động của video..."
                       bannedWords={qcVideoResult.bannedWordsMatched}
                       className="h-36 2xl:h-72 min-h-[140px]"
                     />
                  </div>
                </div>
              )}
            </fieldset>

            {/* QC Audit Panel */}
            {activeDetailTab === 'image' ? (
              renderQCAuditPanel(qcResult, localStoryboardModel, lettaViolations)
            ) : (
              renderQCAuditPanel(qcVideoResult, localVideoModel, lettaVideoViolations)
            )}
          </div>

          {/* Cot phai: Form Settings */}
          <fieldset 
            disabled={sh.isApproved}
            className="w-[52%] space-y-3 pr-1 overflow-y-auto custom-scrollbar max-h-full flex flex-col border-none disabled:opacity-90"
          >
            {/* Tabs selector */}
            <div className="flex gap-1.5 p-0.5 bg-[#181820] border border-slate-850 rounded-xl w-full shrink-0">
              <button
                type="button"
                onClick={() => setActiveRightTab('acting')}
                className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all duration-150 cursor-pointer ${activeRightTab === 'acting' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                🎬 Diễn Xuất &amp; Thoại
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('camera')}
                className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all duration-150 cursor-pointer ${activeRightTab === 'camera' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                🎥 Góc Máy &amp; Core
              </button>
              <button
                type="button"
                onClick={() => setActiveRightTab('production')}
                className={`flex-1 py-1.5 rounded-lg text-[9.5px] font-black uppercase transition-all duration-150 cursor-pointer ${activeRightTab === 'production' ? 'bg-indigo-600 text-white shadow shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'}`}
              >
                📦 Đạo Cụ &amp; Safety
              </button>
            </div>

            {/* Tab 1: Kịch Bản & Diễn Xuất */}
            {activeRightTab === 'acting' && (
              <div className="space-y-3 flex-1">
                {/* Basic setup */}
                <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
                  <h5 className="text-[9.5px] font-black text-indigo-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Cấu Hình Cơ Bản (Basic Settings)</h5>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase block">Cảnh (Scene Number)</label>
                      <input
                        type="text"
                        value={localSc}
                        onChange={(e) => setLocalSc(e.target.value)}
                        onBlur={handleBlur}
                        className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-slate-200 font-bold outline-none text-[11px] focus:border-indigo-500/40"
                        style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase block">Loại Shot (Kind)</label>
                      <select
                        value={localKind}
                        onChange={(e) => setLocalKind(e.target.value)}
                        className="w-full bg-[#09090c] border border-slate-800 rounded-lg py-1 px-2 text-emerald-400 font-bold outline-none text-[11px] focus:border-indigo-500/40 cursor-pointer"
                        style={{ backgroundColor: '#09090c' }}
                      >
                        <option value="establishing" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Establishing</option>
                        <option value="detail" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Detail</option>
                        <option value="action" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Action</option>
                        <option value="reaction" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Reaction</option>
                        <option value="dialogue" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Dialogue</option>
                        <option value="montage" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Montage</option>
                        <option value="transition" style={{ backgroundColor: '#09090c', color: '#34d399' }}>Transition</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Acting Details */}
                <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-3.5">
                  <h5 className="text-[9.5px] font-black text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Diễn Xuất &amp; Biểu Cảm (Acting &amp; Expression)</h5>
                  
                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-pink-400 uppercase block">1. Diễn biến Cảm xúc (Expression Arc)</span>
                    <textarea
                      value={localExpressionArc}
                      onChange={(e) => setLocalExpressionArc(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                      placeholder="Mô tả sự thay đổi cảm xúc, nét mặt của nhân vật (ví dụ: Mica cười bất lực)..."
                      style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                    />
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-teal-400 uppercase block">2. Trạng thái Đầu/Cuối (Start/End States)</span>
                    <textarea
                      value={localStartEndStates}
                      onChange={(e) => setLocalStartEndStates(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                      placeholder="Trạng thái bắt đầu và kết thúc để AI khóa raccord diễn xuất..."
                      style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                    />
                  </div>

                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-amber-500 uppercase block">3. Biến đổi Hành động Vật lý (Physical Motion Delta)</span>
                    <textarea
                      value={localActingPhysicalDelta}
                      onChange={(e) => setLocalActingPhysicalDelta(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-20 min-h-[70px]"
                      placeholder="Hành động vật lý cụ thể, di chuyển cơ thể (ví dụ: Mica cười lăn dưới sàn, Paco cúi đầu)..."
                      style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-amber-500 uppercase block">Movement Speed / Tempo</span>
                    <input
                      type="text"
                      value={localMovementTempo}
                      onChange={(e) => setLocalMovementTempo(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-amber-300 outline-none focus:border-amber-500/40 custom-scrollbar"
                      placeholder="VD: SLOW PREDATORY SETUP / FAST CUT / HOLD..."
                      style={{ backgroundColor: '#09090c' }}
                    />
                  </div>
                </div>

                {/* Objectives */}
                <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
                  <h5 className="text-[9.5px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Mục Tiêu &amp; Liên Kết Nhân Quả</h5>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[8.5px] font-black text-slate-400 uppercase block">Objective (Mục tiêu kịch bản)</span>
                      <textarea
                        value={localObjective}
                        onChange={(e) => setLocalObjective(e.target.value)}
                        onBlur={handleBlur}
                        className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-355 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-20 2xl:h-44 min-h-[80px]"
                        placeholder="Mục tiêu của shot..."
                        style={{ backgroundColor: '#09090c', color: '#94a3b8' }}
                      />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8.5px] font-black text-slate-400 uppercase block">Causal Link (Chuyển tiếp nhân quả)</span>
                      <textarea
                        value={localCausalLink}
                        onChange={(e) => setLocalCausalLink(e.target.value)}
                        onBlur={handleBlur}
                        className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-355 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-20 2xl:h-44 min-h-[80px]"
                        placeholder="Sự kiện kéo theo tiếp theo..."
                        style={{ backgroundColor: '#09090c', color: '#94a3b8' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Camera & Core Cinematic */}
            {activeRightTab === 'camera' && (
              <div className="space-y-3 flex-1">
                <ShotAssetLinker
                  allCharacters={allCharacters}
                  localCharacterIds={localCharacterIds}
                  setLocalCharacterIds={setLocalCharacterIds}
                  isCharacterSpeaking={isCharacterSpeaking}
                  allLocations={allLocations}
                  localLocationId={localLocationId}
                  setLocalLocationId={setLocalLocationId}
                  mode="characters"
                />

                {/* Cinematic Core */}
                <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-3.5">
                  <h5 className="text-[9.5px] font-black text-emerald-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Khung Hình &amp; Raccord (Cinematic Continuity)</h5>
                  <div className="space-y-3">
                    {/* Phân tách Khung Hình Đầu */}
                    <div className="space-y-1.5">
                      <span className="text-[9px] font-black text-emerald-400 uppercase block tracking-wider">1. Phân tách Khung hình đầu (First Frame Details)</span>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-0.5">
                          <span className="text-[8.5px] font-black text-pink-400 uppercase block">1.1. Visual Khung Hình Đầu (First Frame Visual)</span>
                          <textarea
                            value={localFirstFrameVisual}
                            onChange={(e) => setLocalFirstFrameVisual(e.target.value)}
                            onBlur={handleBlur}
                            className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                            placeholder="Mô tả visual chi tiết khung hình đầu tiên (ví dụ: Paco MCU, bandana đỏ cam visible...)..."
                            style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[8.5px] font-black text-teal-400 uppercase block">1.2. Trạng thái Bắt đầu (Start State)</span>
                          <textarea
                            value={localFirstFrameStartState}
                            onChange={(e) => setLocalFirstFrameStartState(e.target.value)}
                            onBlur={handleBlur}
                            className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                            placeholder="Trạng thái bắt đầu khóa raccord (ví dụ: Paco đã pose sẵn...)..."
                            style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[8.5px] font-black text-blue-400 uppercase block">1.3. Góc máy &amp; Bố cục (Camera/Framing)</span>
                          <textarea
                            value={localFirstFrameCamera}
                            onChange={(e) => setLocalFirstFrameCamera(e.target.value)}
                            onBlur={handleBlur}
                            className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                            placeholder="Góc máy cụ thể (ví dụ: MCU Paco, slight low angle from sofa level...)..."
                            style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                          />
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-[8.5px] font-black text-amber-500 uppercase block">1.4. Biểu cảm Bắt đầu (Expression Start)</span>
                          <textarea
                            value={localFirstFrameExpression}
                            onChange={(e) => setLocalFirstFrameExpression(e.target.value)}
                            onBlur={handleBlur}
                            className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                            placeholder="Biểu cảm bắt đầu (ví dụ: Mặt trầm trọng như MC thật; ngực ưỡn...)..."
                            style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hàng 2: Khung hình cuối & Yêu cầu Raccord */}
                    <div className="border-t border-slate-800/60 pt-2.5 grid grid-cols-2 gap-2.5">
                      <div className="space-y-0.5">
                        <span className="text-[8.5px] font-black text-indigo-400 uppercase block">2. Khung Hình Cuối (Planned Last Frame)</span>
                        <textarea
                          value={localPlannedLastFrame}
                          onChange={(e) => setLocalPlannedLastFrame(e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                          placeholder="Mô tả visual chi tiết khung hình cuối cùng..."
                          style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8.5px] font-black text-indigo-400 uppercase block">3. Yêu cầu Raccord / Tính liên tục</span>
                        <textarea
                          value={localRaccordRef}
                          onChange={(e) => setLocalRaccordRef(e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 min-h-[60px]"
                          placeholder="Ví dụ: out anchor Paco MCU nhìn frame-left..."
                          style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Đạo Cụ & Safety */}
            {activeRightTab === 'production' && (
              <div className="space-y-3 flex-1">
                <ShotAssetLinker
                  allCharacters={allCharacters}
                  localCharacterIds={localCharacterIds}
                  setLocalCharacterIds={setLocalCharacterIds}
                  isCharacterSpeaking={isCharacterSpeaking}
                  allLocations={allLocations}
                  localLocationId={localLocationId}
                  setLocalLocationId={setLocalLocationId}
                  mode="locations"
                />

                {/* Props & Safety */}
                <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
                  <h5 className="text-[9.5px] font-black text-rose-455 uppercase tracking-widest border-b border-slate-800 pb-1.5">Đạo Cụ &amp; Theo Dấu (Props &amp; Assets State)</h5>
                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-slate-400 uppercase block">Trạng Thái Đạo Cụ &amp; Theo Dõi Vật Thể (Prop State)</span>
                    <textarea
                      value={localPropState}
                      onChange={(e) => setLocalPropState(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-20 2xl:h-40 min-h-[80px]"
                      placeholder="Ghi nhận trạng thái đạo cụ hoặc vị trí cụ thể của vật thể (ví dụ: Paco bandana đỏ cam visible; no Mướp)..."
                      style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                    />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-cyan-500 uppercase block">Screen Direction / Frame Positions (Axis Lock)</span>
                    <textarea
                      value={localScreenDirection}
                      onChange={(e) => setLocalScreenDirection(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-cyan-900/40 rounded-lg p-1.5 text-[11px] text-cyan-300 outline-none resize-y leading-normal focus:border-cyan-500/40 custom-scrollbar h-16 2xl:h-28 min-h-[60px]"
                      placeholder="[AXIS LOCK: ...] / Hướng di chuyển nhân vật / Vị trí frame..."
                      style={{ backgroundColor: '#09090c' }}
                    />
                  </div>
                </div>

                {/* Safety & Usability */}
                <div className="p-3 bg-[#121217] border border-slate-855 rounded-xl space-y-2.5">
                  <h5 className="text-[9.5px] font-black text-purple-400 uppercase tracking-widest border-b border-slate-800 pb-1.5">Quy Tắc Đóng Gói &amp; An Toàn Sản Xuất</h5>
                  <div className="space-y-0.5">
                    <span className="text-[8.5px] font-black text-slate-400 uppercase block">Quy tắc An Toàn &amp; Lưu ý vẽ (Safety Note &amp; Usability)</span>
                    <textarea
                      value={localProductionSafety}
                      onChange={(e) => setLocalProductionSafety(e.target.value)}
                      onBlur={handleBlur}
                      className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-20 2xl:h-40 min-h-[80px]"
                      placeholder="Quy tắc an toàn (ví dụ: Không tạo chữ trên screen, panel phải nói với camera)..."
                      style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                    />
                  </div>
                </div>

                {/* Transition details inside tab 3 if kind is transition */}
                {localKind === 'transition' && (
                  <div className="p-3 bg-[#18122c]/40 border border-purple-950/40 rounded-xl space-y-2.5">
                    <h6 className="text-[9px] font-black text-purple-400 uppercase tracking-widest border-b border-purple-950/30 pb-1.5">Chi Tiết Chuyển Cảnh (Transition Details)</h6>
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="space-y-0.5">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase block">Visual Bridge</span>
                        <textarea
                          value={localVisualBridge}
                          onChange={(e) => setLocalVisualBridge(e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 2xl:h-28 min-h-[60px]"
                          placeholder="Mô tả hành động/hình ảnh nối..."
                          style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase block">Transition Geometry</span>
                        <textarea
                          value={localTransitionGeometry}
                          onChange={(e) => setLocalTransitionGeometry(e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 2xl:h-28 min-h-[60px]"
                          placeholder="Cấu hình bố cục/hình học khi chuyển..."
                          style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-[8.5px] font-black text-slate-400 uppercase block">Audio/SFX Rules</span>
                        <textarea
                          value={localAudioSfxRules}
                          onChange={(e) => setLocalAudioSfxRules(e.target.value)}
                          onBlur={handleBlur}
                          className="w-full bg-[#09090c] border border-slate-800 rounded-lg p-1.5 text-[11px] text-slate-200 outline-none resize-y leading-normal focus:border-indigo-500/40 custom-scrollbar h-16 2xl:h-28 min-h-[60px]"
                          placeholder="Quy tắc âm thanh chuyển cảnh..."
                          style={{ backgroundColor: '#09090c', color: '#e2e8f0' }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>

        {/* Drawer Footer */}
        <div className="px-6 py-4 bg-[#181820] border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={handleClose}
            className="px-6 py-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer font-bold"
          >
            Hoàn Tất
          </button>
        </div>
      </div>

      {selectedZoomImage && (
        <div 
          className="fixed inset-0 z-[10050] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setSelectedZoomImage(null)}
        >
          <div 
            className="relative max-w-5xl max-h-[90vh] bg-[#121217] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedZoomImage(null)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            <img src={selectedZoomImage} alt="Zoomed Storyboard Frame" className="max-w-full max-h-[80vh] object-contain" />
            <div className="p-4 bg-[#121217] border-t border-slate-900 flex justify-between items-center">
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
    </>,
    document.body
  );
});

export default PacoShotDetailModal;


