import { useState, useEffect, useRef } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { 
  Play, 
  Pause, 
  Volume2, 
  Sparkles, 
  Video, 
  Music, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  RefreshCw,
  Layers,
  Wand2,
  AlertTriangle,
  Plus
} from 'lucide-react';
import { createMediaJob, checkJobStatus } from '../../services/api';
import { generateMediaViaGateway } from '../../utils/mediaGateway';
import { runCinematicPipeline } from '../../lib/cinematic-engine';
import { getSanitizedVideoModel } from '../shot-plan/ShotDetailModal';

interface SceneVoiceConfig {
  voiceId: string;
  speed: number;
  pitch: number;
  text: string;
}

interface SceneRenderState {
  status: 'idle' | 'pending' | 'rendering' | 'success' | 'failed';
  jobId?: string;
  videoUrl?: string;
  error?: string;
  progress?: number;
}

const AVAILABLE_VOICES = [
  { id: 'moyin-male-news', name: 'Moyin - Nam Thời Sự (Trầm ấm)' },
  { id: 'moyin-female-story', name: 'Moyin - Nữ Kể Chuyện (Truyền cảm)' },
  { id: 'moyin-male-anime', name: 'Moyin - Nam Anime (Năng động)' },
  { id: 'moyin-female-youth', name: 'Moyin - Nữ Trẻ Trung (Ngọt ngào)' },
  { id: 'eleven-labs-adam', name: 'ElevenLabs - Adam (Deep Male)' },
];

async function pLimit<T, U>(items: T[], fn: (item: T, idx: number) => Promise<U>, limit: number = 2): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await fn(items[currentIndex], currentIndex);
      } catch (err) {
        console.error(`[pLimit] Error at index ${currentIndex}:`, err);
      }
    }
  }
  const workers = [];
  const workerCount = Math.min(limit, items.length);
  for (let i = 0; i < workerCount; i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

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

export default function TimelineStudio() {
  const nodes = useFlowStore(state => state.nodes);
  const pendingShots = useFlowStore((state: any) => state.pendingShots || []);
  const setPendingShots = useFlowStore((state: any) => state.setPendingShots);
  const useShots = pendingShots && pendingShots.length > 0;

  // Helper to extract numeric scene index
  const getSceneNumber = (sceneId: string | number) => {
    const match = String(sceneId || '').match(/\d+/);
    return match ? parseInt(match[0], 10) : 9999;
  };

  const sortedShots = [...pendingShots].sort((a: any, b: any) => {
    const aSceneNum = getSceneNumber(a.sceneId);
    const bSceneNum = getSceneNumber(b.sceneId);
    if (aSceneNum !== bSceneNum) return aSceneNum - bSceneNum;
    return (a.shotNumber || 0) - (b.shotNumber || 0);
  });

  const getShotKey = (shot: any) => {
    return shot.id || `shot-${shot.sceneId}-${shot.shotNumber}`;
  };

  // Lấy các scene nodes hợp lệ từ Canvas
  const sceneNodes = nodes
    .filter(n => n.type === 'sceneNode')
    .sort((a, b) => {
      const aId = parseInt(a.data?.sceneId?.replace(/\D/g, '') || '0');
      const bId = parseInt(b.data?.sceneId?.replace(/\D/g, '') || '0');
      if (aId !== bId) return aId - bId;
      return a.position.x - b.position.x;
    });

  const [activeSceneId, setActiveSceneId] = useState<string>('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  
  // Custom durations for each scene (default 4s)
  const [sceneDurations, setSceneDurations] = useState<Record<string, number>>({});
  // Moyin TTS configs per scene
  const [voiceConfigs, setVoiceConfigs] = useState<Record<string, SceneVoiceConfig>>({});
  // Render states per scene/shot
  const [renderStates, setRenderStates] = useState<Record<string, SceneRenderState>>({});
  const [insertMenuIndex, setInsertMenuIndex] = useState<number | null>(null);

  const handleInsertGlueShot = (insertIndex: number, type: 'CLOSE_UP' | 'B_ROLL') => {
    if (!useShots) return;
    const prevShot = sortedShots[insertIndex - 1];
    const nextShot = sortedShots[insertIndex];
    const sceneId = prevShot?.sceneId || nextShot?.sceneId || "SC01";

    const newGlueShot: any = {
      id: `glue-${Date.now()}`,
      scene_id: sceneId,
      sceneId: sceneId,
      shot_type: type === 'CLOSE_UP' ? 'REACTION' : 'CUTAWAY',
      framing: type === 'CLOSE_UP' ? 'CLOSE_UP' : 'MEDIUM_WIDE',
      duration_target: 3,
      duration: 3,
      camera_movement: 'STATIC',
      action_description: type === 'CLOSE_UP' 
        ? 'Cận cảnh chi tiết biểu cảm nhân vật.' 
        : 'Cảnh trám B-Roll mô tả không khí bối cảnh.',
      character_refs: type === 'CLOSE_UP' ? (prevShot?.character_refs || []) : [],
      is_glue: true,
      objective: "Chèn cảnh trám để che điểm nối trục máy.",
      location: prevShot?.location || prevShot?.bối_cảnh || nextShot?.location || ""
    };

    const newShots = [...sortedShots];
    newShots.splice(insertIndex, 0, newGlueShot);

    const prepared = newShots.map((sh, idx) => {
      const copy = { ...sh };
      delete copy.beat;
      delete copy.id;
      copy.shotNumber = idx + 1;
      return copy;
    });

    const result = runCinematicPipeline(prepared);
    setPendingShots(result.optimizedShots);
    useFlowStore.getState().setCinematicWarnings(result.warnings);
    useFlowStore.getState().setCinematicGlueNotes(result.glueNotes);

    if (result.optimizedShots[insertIndex]) {
      setActiveSceneId(result.optimizedShots[insertIndex].id);
    }
  };

  const playheadRef = useRef<HTMLDivElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // 1. Khởi tạo dữ liệu mặc định từ Canvas Nodes hoặc pendingShots
  useEffect(() => {
    if (useShots) {
      if (sortedShots.length > 0) {
        if (!activeSceneId || !sortedShots.find(s => getShotKey(s) === activeSceneId)) {
          setActiveSceneId(getShotKey(sortedShots[0]));
        }
      }
    } else if (sceneNodes.length > 0) {
      if (!activeSceneId || !sceneNodes.find(n => n.id === activeSceneId)) {
        setActiveSceneId(sceneNodes[0].id);
      }

      // Khởi tạo durations & voiceConfigs nếu chưa có cho scene nodes
      const initialDurations: Record<string, number> = { ...sceneDurations };
      const initialVoiceConfigs: Record<string, SceneVoiceConfig> = { ...voiceConfigs };
      const initialRenderStates: Record<string, SceneRenderState> = { ...renderStates };

      sceneNodes.forEach(node => {
        if (!initialDurations[node.id]) {
          initialDurations[node.id] = 4; // mặc định 4 giây
        }
        if (!initialVoiceConfigs[node.id]) {
          initialVoiceConfigs[node.id] = {
            voiceId: 'moyin-female-story',
            speed: 1.0,
            pitch: 1.0,
            text: node.data.physicalCharacteristics || node.data.storyboardPrompt || ''
          };
        }
        if (!initialRenderStates[node.id]) {
          initialRenderStates[node.id] = {
            status: node.data.renderUrl ? 'success' : 'idle',
            videoUrl: node.data.renderUrl || undefined
          };
        }
      });

      setSceneDurations(initialDurations);
      setVoiceConfigs(initialVoiceConfigs);
      setRenderStates(initialRenderStates);
    }
  }, [nodes, pendingShots, useShots]);

  // Tính tổng thời gian
  useEffect(() => {
    let total = 0;
    if (useShots) {
      sortedShots.forEach(sh => {
        total += parseFloat(sh.duration) || 4;
      });
    } else {
      sceneNodes.forEach(node => {
        total += sceneDurations[node.id] || 4;
      });
    }
    setTotalDuration(total);
  }, [sceneDurations, nodes, pendingShots, useShots]);

  // 2. Core Playback Animation Loop
  useEffect(() => {
    if (isPlaying) {
      lastTimeRef.current = performance.now();
      const updatePlayhead = () => {
        const now = performance.now();
        const delta = (now - lastTimeRef.current) / 1000;
        lastTimeRef.current = now;

        setCurrentTime(prev => {
          const next = prev + delta;
          if (next >= totalDuration) {
            setIsPlaying(false);
            return 0;
          }
          return next;
        });

        animationFrameRef.current = requestAnimationFrame(updatePlayhead);
      };
      animationFrameRef.current = requestAnimationFrame(updatePlayhead);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, totalDuration]);

  // Tự động chuyển activeScene theo currentTime khi đang play
  useEffect(() => {
    if (!isPlaying) return;
    let accumulated = 0;
    
    if (useShots) {
      for (const shot of sortedShots) {
        const dur = parseFloat(shot.duration) || 4;
        if (currentTime >= accumulated && currentTime < accumulated + dur) {
          const key = getShotKey(shot);
          if (activeSceneId !== key) {
            setActiveSceneId(key);
          }
          break;
        }
        accumulated += dur;
      }
    } else {
      for (const node of sceneNodes) {
        const dur = sceneDurations[node.id] || 4;
        if (currentTime >= accumulated && currentTime < accumulated + dur) {
          if (activeSceneId !== node.id) {
            setActiveSceneId(node.id);
          }
          break;
        }
        accumulated += dur;
      }
    }
  }, [currentTime, isPlaying, useShots, sortedShots, sceneNodes]);

  const activeShot = useShots ? sortedShots.find(s => getShotKey(s) === activeSceneId) || sortedShots[0] : null;
  const activeNode = useShots ? null : sceneNodes.find(n => n.id === activeSceneId);

  // Generalised active properties
  const activeLabel = useShots
    ? `Cảnh ${activeShot?.sceneId} - Shot ${activeShot?.shotNumber}`
    : (activeNode ? activeNode.data.sceneId : 'No Scene Selected');

  const activeTitle = useShots
    ? (activeShot?.location || activeShot?.description || 'Untitled Shot')
    : (activeNode ? (activeNode.data.location || 'Untitled Location') : 'Select a Scene to start');

  const activeVoice = useShots
    ? {
        text: activeShot?.dialogue || activeShot?.description || '',
        voiceId: 'moyin-female-story',
        speed: 1.0,
        pitch: 1.0
      }
    : (activeSceneId ? voiceConfigs[activeSceneId] : null);

  const activeRender = activeSceneId ? renderStates[activeSceneId] : null;

  // 3. Xử lý thay đổi Voice Settings
  const handleVoiceChange = (field: string, value: any) => {
    if (!activeSceneId) return;
    if (useShots) {
      const updatedShots = pendingShots.map((sh: any) => {
        if (getShotKey(sh) === activeSceneId) {
          return {
            ...sh,
            [field === 'text' ? 'dialogue' : field]: value
          };
        }
        return sh;
      });
      setPendingShots(updatedShots);
    } else {
      setVoiceConfigs(prev => ({
        ...prev,
        [activeSceneId]: {
          ...prev[activeSceneId],
          [field]: value
        }
      }));
    }
  };

  // 4. Xử lý kéo thả thay đổi thời lượng Scene/Shot (Duration resizing)
  const handleDurationChange = (itemId: string, delta: number) => {
    if (useShots) {
      const updatedShots = pendingShots.map((sh: any) => {
        if (getShotKey(sh) === itemId) {
          const currentDur = parseFloat(sh.duration) || 4;
          const nextVal = Math.max(1, Math.min(15, currentDur + delta));
          return {
            ...sh,
            duration: Math.round(nextVal * 10) / 10
          };
        }
        return sh;
      });
      setPendingShots(updatedShots);
    } else {
      setSceneDurations(prev => {
        const nextVal = Math.max(1, Math.min(15, (prev[itemId] || 4) + delta));
        return {
          ...prev,
          [itemId]: Math.round(nextVal * 10) / 10
        };
      });
    }
  };

  // 5. API calls: Sinh Video cho Phân cảnh / Shot hiện tại
  const handleGenerateVideo = async (itemId: string) => {
    if (useShots) {
      const shot = sortedShots.find(s => getShotKey(s) === itemId);
      if (!shot) return;

      setRenderStates(prev => ({
        ...prev,
        [itemId]: { status: 'pending', progress: 10 }
      }));

      try {
        const prompt = shot.videoPrompt || shot.visual || shot.description || "Cinematic scene";
        const storyboardUrl = shot.imageUrl || shot.renderUrl || null;

        const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
        const allCharacters = worldAssetNode ? (worldAssetNode.data.characters || []) : [];

        let mediaIds: string[] = [];
        if (storyboardUrl) {
          mediaIds.push(storyboardUrl);
        }
        
        const matchedChars: any[] = [];
        const promptLower = prompt.toLowerCase();
        allCharacters.forEach((char: any) => {
           const name = (char.name || "").toLowerCase().trim();
           if (name && safeMatchName(promptLower, name, char.aliases)) {
              matchedChars.push(char);
           }
        });

        const useRemote = localStorage.getItem('STORYMEE_USE_REMOTE_WORKER') === 'true';
        for (const char of matchedChars) {
           const media = char.mediaId || (useRemote ? char.imageUrl : null);
           if (media) mediaIds.push(media);
        }
        
        mediaIds = Array.from(new Set(mediaIds));

        // Call generateMediaViaGateway dynamically resolving video model settings
        const state = useFlowStore.getState();
        const activeProvider = state.videoProvider || 'hub';
        let defaultVideoModel = 'auto';
        if (activeProvider === 'hub') defaultVideoModel = state.hubVideoModel || 'auto';
        else if (activeProvider === 'sdk') defaultVideoModel = state.sdkVideoModel || 'auto';
        else if (activeProvider === 'google' || activeProvider === 'google-native') defaultVideoModel = state.googleVideoModel || 'auto';
        else if (activeProvider === 'dreamina') defaultVideoModel = state.dreaminaVideoModel || 'auto';

        const activeModel = getSanitizedVideoModel(defaultVideoModel, activeProvider);

        const response = await generateMediaViaGateway({
          prompt,
          projectId: state.projectData?.id === 'new' ? undefined : state.projectData?.id,
          numOutputs: 1,
          mediaIds: mediaIds,
          ratio: '16:9',
          mediaType: 'video',
          videoModelKey: activeModel,
          ipId: shot.sceneId,
          entityType: 'scene',
          storyboardFrameUrl: storyboardUrl,
          duration: `${parseFloat(shot.duration) || 4}s`
        }, (status) => {
          // Update local render state progress
          setRenderStates(prev => {
            let progress = 30;
            if (status.includes("20%")) progress = 20;
            else if (status.includes("40%")) progress = 40;
            else if (status.includes("60%")) progress = 60;
            else if (status.includes("80%")) progress = 80;
            else if (status.includes("90%")) progress = 90;
            else if (status.includes("Processing")) progress = 50;
            else if (status.includes("Queue")) progress = 20;
            else if (status.includes("Hoàn thành")) progress = 100;
            return {
              ...prev,
              [itemId]: { 
                status: status.includes("Lỗi") ? 'failed' : 'rendering', 
                progress,
                error: status.includes("Lỗi") ? status : undefined
              }
            };
          });
        });

        const videoUrl = response.url || (response.images && response.images[0]?.url);

        if (!response.success || !videoUrl) {
          const errorMsg = response.error || "Generation failed";
          setRenderStates(prev => ({
            ...prev,
            [itemId]: { status: 'failed', error: errorMsg }
          }));
          return;
        }

        setRenderStates(prev => ({
          ...prev,
          [itemId]: { status: 'success', videoUrl: videoUrl, progress: 100 }
        }));

        // Cập nhật renderUrl trực tiếp vào store cho shot này
        const updatedShots = pendingShots.map((sh: any) => {
          if (getShotKey(sh) === itemId) {
            return {
              ...sh,
              renderUrl: videoUrl,
              videoUrl: videoUrl
            };
          }
          return sh;
        });
        setPendingShots(updatedShots);

      } catch (e: any) {
        setRenderStates(prev => ({
          ...prev,
          [itemId]: { status: 'failed', error: e.message }
        }));
      }
    } else {
      const node = sceneNodes.find(n => n.id === itemId);
      if (!node) return;

      setRenderStates(prev => ({
        ...prev,
        [itemId]: { status: 'pending', progress: 10 }
      }));

      try {
        const state = useFlowStore.getState();
        const activeProvider = state.videoProvider || 'hub';
        let defaultVideoModel = 'auto';
        if (activeProvider === 'hub') defaultVideoModel = state.hubVideoModel || 'auto';
        else if (activeProvider === 'sdk') defaultVideoModel = state.sdkVideoModel || 'auto';
        else if (activeProvider === 'google' || activeProvider === 'google-native') defaultVideoModel = state.googleVideoModel || 'auto';
        else if (activeProvider === 'dreamina') defaultVideoModel = state.dreaminaVideoModel || 'auto';

        const activeModel = getSanitizedVideoModel(defaultVideoModel, activeProvider);

        const prompt = node.data.storyboardPrompt || node.data.physicalCharacteristics || "Cinematic scene";
        const payload = {
          prompt,
          config: {
            model_id: activeModel,
            duration: `${sceneDurations[itemId] || 4}s`,
            aspect_ratio: '16:9'
          }
        };

        const res = await createMediaJob('video', payload);
        
        setRenderStates(prev => ({
          ...prev,
          [itemId]: { status: 'rendering', jobId: res.job_id, progress: 40 }
        }));

        const interval = setInterval(async () => {
          try {
            const statusRes = await checkJobStatus(res.job_id);
            const job = statusRes.data;
            
            if (job.status === 'completed' && job.output_url) {
              clearInterval(interval);
              setRenderStates(prev => ({
                ...prev,
                [itemId]: { status: 'success', videoUrl: job.output_url, progress: 100 }
              }));
              
              node.data.renderUrl = job.output_url;
              useFlowStore.getState().setNodes([...useFlowStore.getState().nodes]);
            } else if (job.status === 'failed') {
              clearInterval(interval);
              setRenderStates(prev => ({
                ...prev,
                [itemId]: { status: 'failed', error: job.error || 'Render failed on worker side.' }
              }));
            }
          } catch (e: any) {
            clearInterval(interval);
            setRenderStates(prev => ({
              ...prev,
              [itemId]: { status: 'failed', error: e.message }
            }));
          }
        }, 4000);

      } catch (e: any) {
        setRenderStates(prev => ({
          ...prev,
          [itemId]: { status: 'failed', error: e.message }
        }));
      }
    }
  };

  // 6. Preview Moyin Voice TTS (Mock preview)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const handleSpeakPreview = () => {
    if (!activeVoice?.text) return;
    setIsSpeaking(true);
    
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeVoice.text);
      utterance.rate = activeVoice.speed;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setTimeout(() => setIsSpeaking(false), 2000);
    }
  };

  return (
    <div className="flex flex-col flex-1 h-full bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Workspaces: Player + Inspector */}
      <div className="flex flex-1 min-h-0 border-b border-slate-800/80">
        
        {/* Left Side: Video Preview Panel */}
        <div className="flex-1 flex flex-col p-6 bg-slate-950 relative min-w-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {activeLabel}
              </span>
              <h2 className="text-lg font-semibold truncate text-slate-200">
                {activeTitle}
              </h2>
            </div>
            
            <div className="flex items-center gap-2">
              {activeRender?.status === 'rendering' && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400 animate-pulse bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  AI Rendering... ({activeRender.progress}%)
                </span>
              )}
              {activeRender?.status === 'success' && (
                <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Ready
                </span>
              )}
            </div>
          </div>

          {/* Video Player Display */}
          <div className="flex-1 bg-slate-900/50 rounded-2xl border border-slate-800/80 overflow-hidden relative flex items-center justify-center shadow-2xl group">
            {useShots ? (
              activeRender?.videoUrl || activeShot?.renderUrl || activeShot?.videoUrl ? (
                <video 
                  src={activeRender?.videoUrl || activeShot?.renderUrl || activeShot?.videoUrl} 
                  className="w-full h-full object-contain"
                  controls
                  autoPlay={isPlaying}
                  key={activeRender?.videoUrl || activeShot?.renderUrl || activeShot?.videoUrl}
                  loop
                  muted
                />
              ) : activeShot?.imageUrl ? (
                <img 
                  src={activeShot.imageUrl} 
                  className="w-full h-full object-contain filter brightness-90 group-hover:scale-102 transition-transform duration-500" 
                  alt="Shot storyboard placeholder"
                />
              ) : (
                <div className="text-center p-8">
                  <Video className="w-16 h-16 text-slate-700 mx-auto mb-4 stroke-[1.5]" />
                  <p className="text-slate-400 text-sm font-medium">Chưa có Clip được sinh cho shot này</p>
                  <button 
                    onClick={() => activeSceneId && handleGenerateVideo(activeSceneId)}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-xs font-semibold text-white shadow-lg transition-all flex items-center gap-1.5 mx-auto active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Sinh Video Preview AI
                  </button>
                </div>
              )
            ) : (
              activeRender?.videoUrl ? (
                <video 
                  src={activeRender.videoUrl} 
                  className="w-full h-full object-contain"
                  controls
                  autoPlay={isPlaying}
                  key={activeRender.videoUrl}
                  loop
                  muted
                />
              ) : activeNode?.data.renderUrl ? (
                <video 
                  src={activeNode.data.renderUrl} 
                  className="w-full h-full object-contain"
                  controls
                  autoPlay={isPlaying}
                  key={activeNode.data.renderUrl}
                  loop
                  muted
                />
              ) : activeNode?.data.imageUrl ? (
                <img 
                  src={activeNode.data.imageUrl} 
                  className="w-full h-full object-contain filter brightness-90 group-hover:scale-102 transition-transform duration-500" 
                  alt="Scene storyboard placeholder"
                />
              ) : (
                <div className="text-center p-8">
                  <Video className="w-16 h-16 text-slate-700 mx-auto mb-4 stroke-[1.5]" />
                  <p className="text-slate-400 text-sm font-medium">Chưa có Clip được sinh cho cảnh quay này</p>
                  <button 
                    onClick={() => activeSceneId && handleGenerateVideo(activeSceneId)}
                    className="mt-4 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-xs font-semibold text-white shadow-lg transition-all flex items-center gap-1.5 mx-auto active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Sinh Video Preview AI
                  </button>
                </div>
              )
            )}

            {/* Subtitle Overlay */}
            {activeVoice?.text && (
              <div className="absolute bottom-6 left-6 right-6 text-center pointer-events-none z-20">
                <span className="px-4 py-2 bg-black/75 text-white text-xs md:text-sm rounded-lg border border-white/10 shadow-lg inline-block max-w-xl font-medium tracking-wide">
                  {activeVoice.text}
                </span>
              </div>
            )}

            {/* Error Overlay */}
            {activeRender?.status === 'failed' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6 text-center z-10">
                <div>
                  <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
                  <h4 className="text-rose-400 font-semibold text-sm mb-1">Lỗi Render Phân Cảnh</h4>
                  <p className="text-slate-400 text-xs max-w-sm mb-4 line-clamp-3">{activeRender.error}</p>
                  <button 
                    onClick={() => activeSceneId && handleGenerateVideo(activeSceneId)}
                    className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 mx-auto"
                  >
                    <RefreshCw className="w-3 h-3" /> Thử lại
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Moyin Voice & Script Inspector */}
        <div className="w-96 border-l border-slate-800/80 bg-slate-900/30 backdrop-blur-md flex flex-col p-6 overflow-y-auto">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-4 mb-6">
            <Volume2 className="w-5 h-5 text-indigo-400" />
            <h3 className="text-md font-semibold text-slate-200">Cấu hình Moyin TTS & Kịch bản</h3>
          </div>

          {activeSceneId ? (
            <div className="flex flex-col gap-6 flex-1">
              {activeShot?.warnings && activeShot.warnings.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex flex-col gap-1.5 text-xs text-amber-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-500 animate-pulse shrink-0" />
                    <span>CẢNH BÁO ĐỨT GÃY CONTINUITY</span>
                  </div>
                  <ul className="list-disc pl-4 flex flex-col gap-1 text-[10px] text-amber-300/90 font-mono">
                    {activeShot.warnings.map((warn: string, wIdx: number) => (
                      <li key={wIdx}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Script physical description */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Lời thoại kịch bản gốc</label>
                <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-xs leading-relaxed text-slate-300 font-mono">
                  {useShots ? (activeShot?.description || activeShot?.visual || 'Không có mô tả.') : (activeNode?.data.physicalCharacteristics || 'Không có mô tả phân cảnh.')}
                </div>
              </div>

              {/* TTS Input */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Lời thoại Moyin TTS (Voiceover)</label>
                  <button 
                    onClick={handleSpeakPreview}
                    disabled={isSpeaking || !activeVoice?.text}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all ${
                      isSpeaking 
                        ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 animate-pulse'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 active:scale-95'
                    }`}
                  >
                    {isSpeaking ? 'Đang đọc thử...' : 'Nghe Thử TTS'}
                  </button>
                </div>
                <textarea 
                  value={activeVoice?.text || ''}
                  onChange={(e) => handleVoiceChange('text', e.target.value)}
                  placeholder="Nhập lời thoại Moyin sẽ lồng tiếng vào shot này..."
                  className="w-full h-24 p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs focus:outline-none focus:border-indigo-500 text-slate-300 resize-none leading-relaxed"
                />
              </div>

              {/* Speaker Select */}
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Diễn viên lồng tiếng (Speaker)</label>
                <select 
                  value={activeVoice?.voiceId || 'moyin-female-story'}
                  onChange={(e) => handleVoiceChange('voiceId', e.target.value)}
                  className="w-full p-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                >
                  {AVAILABLE_VOICES.map(voice => (
                    <option key={voice.id} value={voice.id}>{voice.name}</option>
                  ))}
                </select>
              </div>

              {/* Voice sliders */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tốc độ ({activeVoice?.speed}x)</label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.1" 
                    value={activeVoice?.speed || 1.0}
                    onChange={(e) => handleVoiceChange('speed', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Tông giọng ({activeVoice?.pitch})</label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="1.5" 
                    step="0.1" 
                    value={activeVoice?.pitch || 1.0}
                    onChange={(e) => handleVoiceChange('pitch', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                </div>
              </div>

              {/* Action Node render */}
              <div className="mt-auto border-t border-slate-800/80 pt-4 flex gap-3">
                <button
                  onClick={() => handleGenerateVideo(activeSceneId)}
                  disabled={activeRender?.status === 'rendering'}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:cursor-not-allowed rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-98"
                >
                  {activeRender?.status === 'rendering' ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Rendering Video...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5" />
                      Sinh Video Clip
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-slate-500">
              <div>
                <Layers className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-xs">Chọn phân cảnh trên timeline để chỉnh sửa</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Panel: Timeline & Multi-track view */}
      <div className="h-64 bg-slate-900 border-t border-slate-800/80 flex flex-col min-h-0 relative select-none">
        
        {/* Playback controls toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800/80 bg-slate-950/80">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 active:scale-95 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-0.5" />}
            </button>
            
            <div className="text-xs font-mono text-slate-400">
              <span className="text-slate-100 font-bold">{currentTime.toFixed(1)}s</span> / {totalDuration.toFixed(1)}s
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 font-medium">Render All Scenes:</span>
            <button
              onClick={() => {
                alert("🚀 Bắt đầu lập hàng đợi Render Song Song cho toàn bộ kịch bản!\nGiới hạn p-limit = 2 để tránh rate limit.");
                const runBatch = async () => {
                  if (useShots) {
                    await pLimit(sortedShots, async (sh) => {
                      const delay = 1000 + Math.random() * 1500;
                      await new Promise(r => setTimeout(r, delay));
                      await handleGenerateVideo(getShotKey(sh));
                    }, 2);
                  } else {
                    await pLimit(sceneNodes, async (node) => {
                      const delay = 1000 + Math.random() * 1500;
                      await new Promise(r => setTimeout(r, delay));
                      await handleGenerateVideo(node.id);
                    }, 2);
                  }
                };
                runBatch().catch(err => console.error("Lỗi Batch Render:", err));
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1 active:scale-95 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Batch Render
            </button>
          </div>
        </div>

        {/* Timeline Tracks Area */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 relative flex flex-col gap-4 min-w-0" ref={timelineTrackRef}>
          
          {/* Timeline Rule Header (Ticks of seconds) */}
          <div className="h-6 relative border-b border-slate-800 mb-1 flex items-end font-mono text-[9px] text-slate-500" style={{ width: `${Math.max(1000, totalDuration * 50)}px` }}>
            {Array.from({ length: Math.ceil(totalDuration) + 1 }).map((_, i) => (
              <div key={i} className="absolute border-l border-slate-800 h-2 pl-1.5 flex items-end pb-0.5" style={{ left: `${i * 50}px` }}>
                {i}s
              </div>
            ))}
          </div>

          {/* Track 1: Video/Shot Block Track */}
          <div className="flex items-center relative gap-0.5" style={{ width: `${Math.max(1000, totalDuration * 50)}px` }}>
            <div className="absolute -left-4 text-[10px] text-slate-500 font-semibold select-none flex items-center gap-1 rotate-270 translate-x-[-120%] z-10 bg-slate-900 py-1 px-2 rounded border border-slate-800">
              <Video className="w-3 h-3 text-indigo-400" />
              SHOTS
            </div>
            
            {(useShots ? sortedShots : sceneNodes).map((item: any, idx: number) => {
              const id = useShots ? getShotKey(item) : item.id;
              const duration = useShots ? (parseFloat(item.duration) || 4) : (sceneDurations[item.id] || 4);
              const isActive = id === activeSceneId;
              const rState = renderStates[id];
              const sceneNum = useShots ? item.sceneId : (item.data.sceneId?.replace(/\D/g, '') || (idx + 1));
              const label = useShots ? `Cảnh ${sceneNum} - Shot ${item.shotNumber}` : `Cảnh ${sceneNum}`;
              const renderUrl = useShots ? (item.renderUrl || item.videoUrl) : item.data.renderUrl;
              const imageUrl = useShots ? item.imageUrl : item.data.imageUrl;
              const isGlue = item.is_glue === true;
              const hasWarnings = item.warnings && item.warnings.length > 0;

              return (
                <div key={id} className="flex items-center shrink-0 relative">
                  <div
                    onClick={() => setActiveSceneId(id)}
                    style={{ width: `${duration * 50}px` }}
                    className={`h-24 rounded-xl border relative overflow-hidden flex flex-col group transition-all cursor-pointer ${
                      isActive 
                        ? isGlue 
                          ? 'border-purple-500 shadow-lg bg-purple-950/30 shadow-purple-500/10' 
                          : 'border-indigo-500 shadow-lg bg-indigo-950/20' 
                        : isGlue 
                          ? 'border-purple-500/50 bg-purple-950/10 hover:bg-purple-900/20' 
                          : 'border-slate-800/80 bg-slate-950 hover:bg-slate-900/60'
                    }`}
                  >
                    {/* Warning Icon Overlay */}
                    {hasWarnings && (
                      <div 
                        className="absolute top-1.5 right-1.5 z-20 bg-slate-950/95 border border-amber-500/40 p-1 rounded-full cursor-help hover:scale-105 transition-all text-amber-500 animate-pulse shadow-md"
                        title={item.warnings.join("\n")}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </div>
                    )}

                    {/* Thumbnail / Loading Preview */}
                    <div className="flex-1 bg-slate-900 overflow-hidden relative flex items-center justify-center">
                      {rState?.videoUrl || renderUrl ? (
                        <video 
                          src={rState?.videoUrl || renderUrl} 
                          className="w-full h-full object-cover filter brightness-90"
                        />
                      ) : imageUrl ? (
                        <img 
                          src={imageUrl} 
                          className="w-full h-full object-cover" 
                          alt="Shot thumbnail"
                        />
                      ) : (
                        <div className="text-[10px] text-slate-600 flex flex-col items-center gap-0.5">
                          <Video className="w-4 h-4 text-slate-700" />
                          No Video
                        </div>
                      )}

                      {/* Rendering Overlay Progress */}
                      {rState?.status === 'rendering' && (
                        <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center gap-1 z-10">
                          <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                          <span className="text-[8px] font-mono text-amber-400 font-bold">{rState.progress}%</span>
                        </div>
                      )}
                    </div>

                    {/* Shot footer identifier */}
                    <div className="px-2.5 py-1 bg-slate-950/80 backdrop-blur-sm border-t border-slate-900 flex justify-between items-center text-[10px]">
                      <span className="font-semibold text-slate-300 truncate">
                        {isGlue ? `[GLUE] ${label}` : label}
                      </span>
                      <span className="text-[9px] font-mono text-slate-500">{duration}s</span>
                    </div>

                    {/* Resizers left & right to adjust duration on timeline */}
                    <div 
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const onMouseMove = (moveEvent: MouseEvent) => {
                          const deltaX = moveEvent.clientX - startX;
                          const secondsDelta = deltaX / 50;
                          handleDurationChange(id, secondsDelta);
                        };
                        const onMouseUp = () => {
                          window.removeEventListener('mousemove', onMouseMove);
                          window.removeEventListener('mouseup', onMouseUp);
                        };
                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);
                      }}
                      className="absolute right-0 top-0 bottom-0 w-1.5 bg-slate-700/0 hover:bg-indigo-500/80 cursor-ew-resize transition-all z-20"
                    />
                  </div>

                  {/* Manual Glue Shot inserter (divider zone) */}
                  {useShots && idx < sortedShots.length - 1 && (
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setInsertMenuIndex(idx + 1);
                      }}
                      className="w-4 mx-[-8px] h-24 flex items-center justify-center relative group/trans z-30 shrink-0 cursor-pointer"
                    >
                      {/* Vertical line indicator */}
                      <div className="w-[2px] h-12 bg-slate-800/80 group-hover/trans:bg-indigo-500/50 transition-colors rounded" />
                      
                      {/* Absolute floating plus button */}
                      <div className="absolute opacity-0 scale-75 group-hover/trans:opacity-100 group-hover/trans:scale-100 transition-all z-10 w-5 h-5 rounded-full bg-slate-900 border border-slate-850 hover:bg-indigo-600 hover:border-indigo-400 flex items-center justify-center text-slate-400 hover:text-white shadow-md">
                        <Plus className="w-3 h-3 font-bold" />
                      </div>

                      {/* Dropdown Menu & Click-Outside Overlay */}
                      {insertMenuIndex === idx + 1 && (
                        <>
                          <div 
                            className="fixed inset-0 z-40 cursor-default"
                            onClick={(e) => {
                              e.stopPropagation();
                              setInsertMenuIndex(null);
                            }}
                          />
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-12 left-1/2 -translate-x-1/2 bg-slate-950/95 backdrop-blur-md border border-slate-800 rounded-lg shadow-xl py-1 px-1 flex flex-col gap-0.5 z-50 text-[10px] min-w-[110px] font-sans animate-in fade-in zoom-in-95 duration-100"
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInsertGlueShot(idx + 1, 'CLOSE_UP');
                                setInsertMenuIndex(null);
                              }}
                              className="px-2 py-1.5 hover:bg-indigo-600/30 hover:text-indigo-200 rounded flex items-center gap-1.5 text-left text-slate-300 font-semibold transition-all"
                            >
                              <Video className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span>Cận cảnh (3s)</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleInsertGlueShot(idx + 1, 'B_ROLL');
                                setInsertMenuIndex(null);
                              }}
                              className="px-2 py-1.5 hover:bg-indigo-600/30 hover:text-indigo-200 rounded flex items-center gap-1.5 text-left text-slate-300 font-semibold transition-all"
                            >
                              <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                              <span>B-Roll (3s)</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Track 2: Moyin TTS Audio Voice Track */}
          <div className="flex items-center relative gap-0.5" style={{ width: `${Math.max(1000, totalDuration * 50)}px` }}>
            <div className="absolute -left-4 text-[10px] text-slate-500 font-semibold select-none flex items-center gap-1 rotate-270 translate-x-[-120%] z-10 bg-slate-900 py-1 px-2 rounded border border-slate-800">
              <Music className="w-3 h-3 text-indigo-400" />
              VOICE
            </div>

            {(useShots ? sortedShots : sceneNodes).map((item: any, idx: number) => {
              const id = useShots ? getShotKey(item) : item.id;
              const duration = useShots ? (parseFloat(item.duration) || 4) : (sceneDurations[item.id] || 4);
              const text = useShots ? (item.dialogue || '') : (voiceConfigs[item.id]?.text || '');

              return (
                <div
                  key={`voice-${id}`}
                  style={{ width: `${duration * 50}px` }}
                  className={`h-12 rounded-xl border flex items-center px-3 relative font-mono text-[9px] truncate transition-all ${
                    text
                      ? 'bg-indigo-950/10 border-indigo-500/40 text-indigo-300'
                      : 'bg-slate-950/40 border-slate-900 text-slate-600'
                  }`}
                >
                  <Music className={`w-3.5 h-3.5 mr-2 shrink-0 ${text ? 'text-indigo-400' : 'text-slate-800'}`} />
                  <span className="truncate italic">
                    {text ? `"${text}"` : '(Trống - Nhập thoại)'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Vertical Playhead Cursor */}
          <div 
            ref={playheadRef}
            className="absolute top-0 bottom-0 w-0.5 bg-indigo-500 z-30 pointer-events-none"
            style={{ 
              left: `${currentTime * 50 + 24}px`, // 24px padding offsets
              transition: isPlaying ? 'none' : 'left 0.1s ease-out'
            }}
          >
            {/* Pointer cap tip */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-500 rounded-full shadow-lg" />
          </div>
        </div>

      </div>
    </div>
  );
}
