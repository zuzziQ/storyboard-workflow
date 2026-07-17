import { Handle, Position } from 'reactflow';
import { useState, useEffect, memo } from 'react';
import { Clapperboard, CheckCircle2, AlertTriangle, Lightbulb, ChevronDown, ChevronUp, Plus, X, Sparkles, LayoutGrid, RotateCcw, HelpCircle, Compass, Activity, CloudRain, Database, Link, ArrowRight } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { generateShotsForSingleScene } from '../../utils/generateExpandedShots';
import { analyzeScene } from '../../utils/sceneIntelligence';

// ─── Emotion Color Palette ─────────────────────────────────────────────────
const ARC_COLORS: Record<string, { border: string; bg: string; badge: string; text: string; button: string }> = {
  setup:      { border: 'border-slate-600',   bg: 'bg-slate-900/80',   badge: 'bg-slate-700',    text: 'text-slate-300', button: 'bg-slate-800 hover:bg-slate-700' },
  inciting:   { border: 'border-amber-500/70',bg: 'bg-amber-950/40',   badge: 'bg-amber-700/60', text: 'text-amber-300', button: 'bg-amber-900/60 hover:bg-amber-800/80' },
  rising:     { border: 'border-orange-500/70',bg: 'bg-orange-950/30', badge: 'bg-orange-700/60',text: 'text-orange-300', button: 'bg-orange-900/60 hover:bg-orange-800/80' },
  climax:     { border: 'border-red-500/80',  bg: 'bg-red-950/40',     badge: 'bg-red-700/60',   text: 'text-red-300', button: 'bg-red-900/60 hover:bg-red-800/80' },
  falling:    { border: 'border-violet-500/70',bg:'bg-violet-950/30',  badge: 'bg-violet-700/60',text: 'text-violet-300', button: 'bg-violet-900/60 hover:bg-violet-800/80' },
  resolution: { border: 'border-emerald-500/70',bg:'bg-emerald-950/30',badge: 'bg-emerald-700/60',text:'text-emerald-300', button: 'bg-emerald-900/60 hover:bg-emerald-800/80' },
};

const VALENCE_EMOJI: Record<string, string> = {
  positive: '😊', negative: '😔', neutral: '😐', tense: '😰', melancholic: '🌧️'
};

// ─── Setup Suggestions helper ──────────────────────────────────────────────
function getSetupSuggestions(valence: string, emotion: string, intensity: number) {
  const normValence = (valence || '').toLowerCase();
  const normEmotion = (emotion || '').toLowerCase();
  
  if (normValence === 'negative' || normValence === 'melancholic' || normEmotion === 'sadness' || normEmotion === 'grief') {
    return {
      weather: 'Mưa phùn (Drizzle), U ám (Overcast)',
      lighting: 'Mờ ảo, Cool blue, Low key, Silhouette',
      sound: 'Tiếng mưa rơi nhẹ, Nhạc cụ dây buồn bã, Tiếng gió thở dài',
      guidance: 'Cảnh u buồn thích hợp với bối cảnh ẩm ướt, sương mù, ánh sáng lạnh và các khoảng lặng sâu sắc.'
    };
  }
  if (normValence === 'tense' || normEmotion === 'fear' || normEmotion === 'anger' || intensity >= 70) {
    return {
      weather: 'Bão dông (Stormy), Đêm tối mịt mù, Gió giật',
      lighting: 'Harsh shadows, Flickering red/amber, Chiaroscuro',
      sound: 'Âm bass dồn dập, Tiếng tim đập, Tiếng sấm chớp gián đoạn',
      guidance: 'Cảnh căng thẳng cao độ cần độ tương phản ánh sáng mạnh, bóng đổ sâu và thời tiết khắc nghiệt để đẩy kịch tính.'
    };
  }
  if (normValence === 'positive' || normEmotion === 'joy' || normEmotion === 'trust') {
    return {
      weather: 'Nắng ấm (Sunny), Trời xanh không mây, Nắng dịu nhẹ',
      lighting: 'Golden hour, Ánh sáng ấm áp rực rỡ, High key',
      sound: 'Tiếng chim hót, Nhạc điệu vui tươi, Gió rì rào',
      guidance: 'Cảnh tươi sáng hạnh phúc nên dùng tông màu ấm (vàng/cam), bối cảnh trong lành và âm thanh nhẹ nhàng.'
    };
  }
  return {
    weather: 'Trời quang đãng (Clear), Trời mây nhẹ',
    lighting: 'Ánh sáng tự nhiên khuếch tán (Diffuse daylight), Tông trung tính',
    sound: 'Tiếng bước chân, Tiếng ồn môi trường tự nhiên (Ambient)',
    guidance: 'Cảnh chuyển tiếp/bình thường nên giữ ánh sáng tự nhiên ôn hòa để ổn định nhịp phim trước các biến cố.'
  };
}

// ─── Gap Detection ──────────────────────────────────────────────────────────
function detectGaps(data: any): string[] {
  const gaps: string[] = [];
  if (!data.location || data.location === 'Unknown Location') gaps.push('⚠️ Chưa xác định bối cảnh cụ thể');
  if (!data.action || data.action.trim().length < 20) gaps.push('⚠️ Mô tả hành động quá sơ sài (< 20 ký tự)');
  if (!data.charactersInScene || data.charactersInScene.length === 0) gaps.push('⚠️ Chưa xác định nhân vật có mặt');
  if (!data.lighting && !data.weather) gaps.push('💡 Chưa cấu hình ánh sáng / thời tiết');
  if (!data.timeOfDay || data.timeOfDay === 'DAY') gaps.push('💡 Khung thời gian mặc định (DAY)');
  return gaps;
}

// ─── Component ─────────────────────────────────────────────────────────────
function ScenePrepNode({ id, data }: { id: string; data: any }) {
  const setNodes = useFlowStore.getState().setNodes;

  const arcPos = data.arcPosition || 'setup';
  const colors = ARC_COLORS[arcPos] || ARC_COLORS.setup;
  const intensity = data.emotionIntensity ?? 40;
  const valence = data.valence || 'neutral';

  const [isReady, setIsReady] = useState<boolean>(data.isReady || false);
  const [showGaps, setShowGaps] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
  const [prepNotes, setPrepNotes] = useState(data.prepNotes || '');
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<string[]>(data.acceptedSuggestions || []);
  const [location, setLocation] = useState(data.location || '');
  const [timeOfDay, setTimeOfDay] = useState(data.timeOfDay || 'DAY');
  const [lighting, setLighting] = useState(data.lighting || '');
  const [weather, setWeather] = useState(data.weather || '');
  const [soundCue, setSoundCue] = useState(data.soundCue || '');
  const [panelGrid, setPanelGrid] = useState<string>('1x1');

  // Scene Intelligence States
  const [activeStep, setActiveStep] = useState<number>(1);
  const [action, setAction] = useState(data.action || data.sceneDescription || '');
  const [storyDirection, setStoryDirection] = useState(data.storyDirection || '');
  const [scenePurpose, setScenePurpose] = useState(data.scenePurpose || '');
  const [emotionHook, setEmotionHook] = useState(data.emotionHook || '');
  const [moodShift, setMoodShift] = useState(data.moodShift || '');
  const [moodShiftOut, setMoodShiftOut] = useState(data.moodShiftOut || '');
  const [moodShiftPurpose, setMoodShiftPurpose] = useState(data.moodShiftPurpose || '');
  const [outerSetup, setOuterSetup] = useState(data.outerSetup ?? false);

  // Load setup recommendations
  const guide = getSetupSuggestions(valence, data.emotion || 'anticipation', intensity);

  // Get previous and next scene context
  const parsedData = useFlowStore(state => state.parsedData);
  const scenes = parsedData?.scenes || [];
  const currentSceneIndex = scenes.findIndex((s: any) => s.id === data.sceneId || s.id === data.id);
  const prevScene = currentSceneIndex > 0 ? scenes[currentSceneIndex - 1] : undefined;
  const nextScene = currentSceneIndex !== -1 && currentSceneIndex < scenes.length - 1 ? scenes[currentSceneIndex + 1] : undefined;
  const scenePlan = analyzeScene(data, prevScene, nextScene);

  // Sync isReady and panelGrid state from props
  useEffect(() => {
    setIsReady(data.isReady || false);
    if (data.panelGrid) {
      setPanelGrid(data.panelGrid);
    }
  }, [data.isReady, data.panelGrid]);

  // Sync local inputs when node data is updated from outside (e.g. from EmotionArcNode)
  useEffect(() => {
    if (data.location !== undefined) setLocation(data.location);
    if (data.timeOfDay !== undefined) setTimeOfDay(data.timeOfDay);
    if (data.lighting !== undefined) setLighting(data.lighting);
    if (data.weather !== undefined) setWeather(data.weather);
    if (data.soundCue !== undefined) setSoundCue(data.soundCue);
    if (data.prepNotes !== undefined) setPrepNotes(data.prepNotes);
    if (data.action !== undefined) setAction(data.action);
    else if (data.sceneDescription !== undefined) setAction(data.sceneDescription);
  }, [data.location, data.timeOfDay, data.lighting, data.weather, data.soundCue, data.prepNotes, data.action, data.sceneDescription]);

  // Sync and pre-populate intelligence values
  useEffect(() => {
    if (data.storyDirection) {
      setStoryDirection(data.storyDirection);
    } else if (!storyDirection && scenePlan.purpose) {
      setStoryDirection(scenePlan.purpose);
    }

    if (data.scenePurpose) {
      setScenePurpose(data.scenePurpose);
    } else if (!scenePurpose && scenePlan.purpose) {
      setScenePurpose(scenePlan.purpose);
    }

    if (data.emotionHook) {
      setEmotionHook(data.emotionHook);
    } else if (!emotionHook && scenePlan.hookPosition) {
      setEmotionHook(scenePlan.hookPosition);
    }

    if (data.moodShift) {
      setMoodShift(data.moodShift);
    } else if (!moodShift && scenePlan.causalLinkIn) {
      setMoodShift(scenePlan.causalLinkIn);
    }

    if (data.moodShiftOut) {
      setMoodShiftOut(data.moodShiftOut);
    } else if (!moodShiftOut && scenePlan.causalLinkOut) {
      setMoodShiftOut(scenePlan.causalLinkOut);
    }

    if (data.moodShiftPurpose) {
      setMoodShiftPurpose(data.moodShiftPurpose);
    } else if (!moodShiftPurpose) {
      const defaultPurpose = scenePlan.moodShiftType !== 'none'
        ? `Chuyển đổi cảm xúc từ ${scenePlan.moodShiftFrom} sang ${scenePlan.moodShiftTo} để tạo nhịp kịch tính ${scenePlan.moodShiftType === 'sharp' ? 'đột ngột, nhấn mạnh biến cố' : 'nhẹ nhàng, dẫn dắt tự nhiên'}.`
        : `Duy trì nhịp cảm xúc ${scenePlan.moodShiftTo} để ổn định tâm lý nhân vật trước khi chuyển biến câu chuyện.`;
      setMoodShiftPurpose(defaultPurpose);
    }

    if (data.outerSetup !== undefined) {
      setOuterSetup(data.outerSetup);
    } else if (scenePlan.atmosphericNeeds.length > 0) {
      setOuterSetup(true);
    }
  }, [data.storyDirection, data.scenePurpose, data.emotionHook, data.moodShift, data.moodShiftOut, data.moodShiftPurpose, data.outerSetup, scenePlan]);

  const gaps = detectGaps({ ...data, location, timeOfDay, lighting, weather });
  const aiSuggestions: string[] = data.aiSuggestions || [];

  const updateField = (field: string, value: any) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, [field]: value } } : n));
  };

  const handleMarkReady = () => {
    const newReady = !isReady;
    setIsReady(newReady);
    updateField('isReady', newReady);
    updateField('prepNotes', prepNotes);
    updateField('location', location);
    updateField('timeOfDay', timeOfDay);
    updateField('lighting', lighting);
    updateField('weather', weather);
    updateField('soundCue', soundCue);
    updateField('panelGrid', panelGrid);
    updateField('acceptedSuggestions', acceptedSuggestions);
    updateField('storyDirection', storyDirection);
    updateField('scenePurpose', scenePurpose);
    updateField('emotionHook', emotionHook);
    updateField('moodShift', moodShift);
    updateField('moodShiftOut', moodShiftOut);
    updateField('moodShiftPurpose', moodShiftPurpose);
    updateField('outerSetup', outerSetup);
    updateField('action', action);
    updateField('sceneDescription', action);
  };

  const handleAcceptSuggestion = (s: string) => {
    const updated = [...acceptedSuggestions, s];
    setAcceptedSuggestions(updated);
    updateField('acceptedSuggestions', updated);
    // Append to action context
    const currentAction = action || '';
    const newAction = currentAction + (currentAction ? '\n' : '') + '→ ' + s;
    setAction(newAction);
    updateField('action', newAction);
    updateField('sceneDescription', newAction);
  };

  const handleRejectSuggestion = (s: string) => {
    const remaining = aiSuggestions.filter((x: string) => x !== s);
    updateField('aiSuggestions', remaining);
  };

  // ─── Generate Shots for this single scene ──────────────────────────────────
  const handleGenerateShots = () => {
    // 1. Fetch character names from World Asset Node
    const nodes = useFlowStore.getState().nodes;
    const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
    const characters = worldAssetNode?.data?.characters || [];
    const charNames = characters.map((c: any) => c.name || c);

    // 2. Compose scene object
    const sceneObj = {
      id: data.sceneId,
      sceneId: data.sceneId,
      location: location || 'Unknown Location',
      timeOfDay: timeOfDay || 'DAY',
      action: action || data.action || data.sceneDescription || '',
      charactersInScene: data.charactersInScene || [],
      props: data.props || [],
      weather: weather,
      lighting: lighting,
      soundCue: soundCue,
      moodShift: moodShift,
      moodShiftOut: moodShiftOut,
      moodShiftPurpose: moodShiftPurpose,
      outerSetup: outerSetup,
      emotionIntensity: data.emotionIntensity || 40,
    };

    // 3. Generate expanded list of shots
    const generated = generateShotsForSingleScene(sceneObj, charNames, panelGrid);

    // 4. Update pendingShots in flow store
    const store = useFlowStore.getState();
    const currentPending = store.pendingShots || [];
    
    // Filter out existing shots for this scene to prevent duplicates
    const filteredPending = currentPending.filter((s: any) => {
      return s.sceneId !== data.sceneId && s.id !== data.sceneId && s.beat !== data.sceneId && !s.beat.startsWith(data.sceneId + '_');
    });

    const newPending = [...filteredPending, ...generated];
    store.setPendingShots(newPending);

    // 5. Update local & node states
    setIsReady(true);
    updateField('isReady', true);
    updateField('panelGrid', panelGrid);
    updateField('location', location);
    updateField('timeOfDay', timeOfDay);
    updateField('lighting', lighting);
    updateField('weather', weather);
    updateField('soundCue', soundCue);
    updateField('storyDirection', storyDirection);
    updateField('scenePurpose', scenePurpose);
    updateField('emotionHook', emotionHook);
    updateField('moodShift', moodShift);
    updateField('moodShiftOut', moodShiftOut);
    updateField('moodShiftPurpose', moodShiftPurpose);
    updateField('outerSetup', outerSetup);

    // 6. Request graph rebuild
    if (typeof (window as any).handleBuildStoryboard === 'function') {
      setTimeout(() => {
        (window as any).handleBuildStoryboard();
      }, 50);
    }
  };

  // ─── Clear Generated Shots ─────────────────────────────────────────────────
  const handleClearShots = () => {
    const store = useFlowStore.getState();
    const currentPending = store.pendingShots || [];
    
    const filteredPending = currentPending.filter((s: any) => {
      return s.sceneId !== data.sceneId && s.id !== data.sceneId && s.beat !== data.sceneId && !s.beat.startsWith(data.sceneId + '_');
    });
    
    store.setPendingShots(filteredPending);
    setIsReady(false);
    updateField('isReady', false);

    if (typeof (window as any).handleBuildStoryboard === 'function') {
      setTimeout(() => {
        (window as any).handleBuildStoryboard();
      }, 50);
    }
  };

  // Check if shots exist in global store for this scene
  const storePending = useFlowStore(state => state.pendingShots || []);
  const shotsCreated = storePending.some((s: any) => s.sceneId === data.sceneId);

  return (
    <div className={`w-[340px] rounded-2xl border-2 ${colors.border} bg-[#121216] shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition-all duration-300 ${isReady ? 'ring-2 ring-emerald-500/30' : ''} relative`}>
      <Handle type="target" position={Position.Left} className="w-3.5 h-3.5 bg-slate-500 border-2 border-[#121216]" />
      <Handle type="source" position={Position.Right} className="w-3.5 h-3.5 bg-slate-500 border-2 border-[#121216]" />
      <Handle type="source" position={Position.Bottom} id="shots" className="w-3.5 h-3.5 bg-indigo-500 border-2 border-[#121216]" />

      {/* Header */}
      <div className={`px-4 py-3 flex items-center justify-between border-b border-white/10 react-flow__node-draghandle cursor-move`}>
        <div className="flex items-center gap-2">
          <Clapperboard size={16} className={colors.text} />
          <div>
            <div className={`text-[8px] font-black uppercase tracking-widest ${colors.text}`}>
              SCENE PREP · {arcPos.toUpperCase()}
            </div>
            <div className="text-sm font-black text-white leading-tight">{data.sceneId || 'Scene'}</div>
          </div>
        </div>
        
        {/* Toggle ready status manually */}
        <button
          onClick={handleMarkReady}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black transition-all duration-200 active:scale-95 ${
            isReady
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-500'
          }`}
        >
          <CheckCircle2 size={12} className={isReady ? 'fill-emerald-500 text-emerald-500' : ''} />
          {isReady ? 'Ready ✓' : 'Mark Ready'}
        </button>
      </div>

      {/* Emotion Intensity Bar */}
      <div className="px-4 pt-3 pb-1.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[8.5px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
            <span>{VALENCE_EMOJI[valence]}</span>
            <span>Intensity ({valence})</span>
          </span>
          <span className={`text-[9.5px] font-black ${colors.text}`}>{intensity}/100</span>
        </div>
        <div className="h-2 bg-slate-950 rounded-full overflow-hidden p-[1px] border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              intensity >= 80 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
              intensity >= 60 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]' :
              intensity >= 40 ? 'bg-amber-500' : 'bg-slate-500'
            }`}
            style={{ width: `${intensity}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <div className={`text-[9px] font-bold ${colors.text}`}>
            Mood: {data.emotion || 'anticipation'}
          </div>
          
          {/* Suggestions toggle */}
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="flex items-center gap-1 text-[9px] text-indigo-400 hover:text-indigo-300 font-bold"
          >
            <HelpCircle size={10} />
            <span>Gợi ý Mood Arc</span>
          </button>
        </div>
      </div>

      {/* Mood Arc Suggestions Panel */}
      {showGuide && (
        <div className="mx-4 my-1.5 p-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 text-[10px] space-y-1.5 leading-relaxed text-indigo-200">
          <div className="font-bold text-white flex items-center gap-1">
            <Sparkles size={11} className="text-indigo-400" />
            <span>Gợi ý thiết lập cho mood "{data.emotion}":</span>
          </div>
          <div><span className="font-semibold text-indigo-300">🌤 Weather:</span> {guide.weather}</div>
          <div><span className="font-semibold text-indigo-300">💡 Light:</span> {guide.lighting}</div>
          <div><span className="font-semibold text-indigo-300">🎵 Sound:</span> {guide.sound}</div>
          <p className="text-[9px] text-indigo-300/80 italic mt-1 border-t border-indigo-500/10 pt-1">
            {guide.guidance}
          </p>
        </div>
      )}

      {/* Step Tabs */}
      <div className="flex border-b border-white/5 bg-slate-950/45 p-1 gap-1 mx-4 mt-2 rounded-xl">
        <button
          onClick={() => setActiveStep(1)}
          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
            activeStep === 1
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Compass size={11} />
          <span>1. Ý Tưởng</span>
        </button>
        <button
          onClick={() => setActiveStep(2)}
          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
            activeStep === 2
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <Database size={11} />
          <span>2. Asset DB</span>
        </button>
        <button
          onClick={() => setActiveStep(3)}
          className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
            activeStep === 3
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
          }`}
        >
          <LayoutGrid size={11} />
          <span>3. Tạo Shot</span>
        </button>
      </div>

      {/* Step 1: Phân Tích & Ý Tưởng */}
      {activeStep === 1 && (
        <div className="px-4 py-3 space-y-3">
          {/* Diễn biến (Nội dung phân cảnh gốc) */}
          <div>
            <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
              <Clapperboard size={11} className="text-indigo-400" />
              <span>Diễn biến (Nội dung phân cảnh gốc)</span>
            </label>
            <textarea
              value={action}
              onChange={e => {
                setAction(e.target.value);
                updateField('action', e.target.value);
                updateField('sceneDescription', e.target.value);
              }}
              rows={2}
              className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-[10.5px] text-white outline-none focus:border-indigo-500/60 transition-all resize-none leading-relaxed"
              placeholder="Mô tả diễn biến phân cảnh gốc..."
            />
          </div>

          {/* Mục tiêu & Hướng phát triển */}
          <div>
            <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
              <Sparkles size={11} className="text-purple-400" />
              <span>Mục tiêu & Hướng phát triển (Step-by-step shots)</span>
            </label>
            <textarea
              value={storyDirection}
              onChange={e => {
                setStoryDirection(e.target.value);
                updateField('storyDirection', e.target.value);
                setScenePurpose(e.target.value);
                updateField('scenePurpose', e.target.value);
              }}
              rows={3}
              className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-[10.5px] text-white outline-none focus:border-purple-500/60 transition-all resize-none leading-relaxed"
              placeholder="Ý tưởng phát triển, chia tách các shot theo dạng step (ví dụ: Step 1: Cảnh toàn, Step 2: Cận cảnh Paco...)..."
            />
          </div>

          {/* Hook Placement & Mood Shift */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                <Activity size={11} className="text-rose-400" />
                <span>Emotion Hook Arc</span>
              </label>
              <select
                value={emotionHook}
                onChange={e => {
                  setEmotionHook(e.target.value);
                  updateField('emotionHook', e.target.value);
                }}
                className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-[10.5px] text-white outline-none focus:border-rose-500/60 transition-all"
              >
                <option value="early">Mở màn (Early)</option>
                <option value="middle">Giữa cảnh (Middle)</option>
                <option value="late">Cuối cảnh (Late)</option>
                <option value="none">Không có (None)</option>
              </select>
            </div>

            <div>
              <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                <CloudRain size={11} className="text-sky-400" />
                <span>Cảnh ngoại / B-Roll</span>
              </label>
              <button
                onClick={() => {
                  const newVal = !outerSetup;
                  setOuterSetup(newVal);
                  updateField('outerSetup', newVal);
                  if (newVal && panelGrid === '1x1') {
                    setPanelGrid('2x2');
                    updateField('panelGrid', '2x2');
                  }
                }}
                className={`w-full mt-1 flex items-center justify-between px-2.5 py-1.5 border rounded-lg text-[10px] font-black transition-all ${
                  outerSetup
                    ? 'bg-sky-500/20 text-sky-400 border-sky-500/40 shadow-[0_0_8px_rgba(56,189,248,0.2)]'
                    : 'bg-slate-950/60 text-slate-400 border-slate-800 hover:border-slate-700'
                }`}
              >
                <span>Nhiều cảnh ngoại</span>
                <span>{outerSetup ? 'BẬT' : 'TẮT'}</span>
              </button>
            </div>
          </div>

          {/* Mood Shift / Transition notes */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <RotateCcw size={11} className="text-amber-400" />
                  <span>Mood Shift từ trước</span>
                </label>
                <input
                  type="text"
                  value={moodShift}
                  onChange={e => {
                    setMoodShift(e.target.value);
                    updateField('moodShift', e.target.value);
                  }}
                  className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-white outline-none focus:border-amber-500/60 transition-all"
                  placeholder="Từ scene trước..."
                />
              </div>

              <div>
                <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <ArrowRight size={11} className="text-purple-400" />
                  <span>Mood Shift sang sau</span>
                </label>
                <input
                  type="text"
                  value={moodShiftOut}
                  onChange={e => {
                    setMoodShiftOut(e.target.value);
                    updateField('moodShiftOut', e.target.value);
                  }}
                  className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-white outline-none focus:border-purple-500/60 transition-all"
                  placeholder="Sang scene sau..."
                />
              </div>
            </div>

            <div>
              <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
                <Sparkles size={11} className="text-indigo-400" />
                <span>Mục đích chuyển đổi cảm xúc</span>
              </label>
              <input
                type="text"
                value={moodShiftPurpose}
                onChange={e => {
                  setMoodShiftPurpose(e.target.value);
                  updateField('moodShiftPurpose', e.target.value);
                }}
                className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] text-white outline-none focus:border-indigo-500/60 transition-all"
                placeholder="Mục đích chuyển đổi không khí..."
              />
            </div>
          </div>

          {/* Recommendations Tips */}
          {outerSetup && (
            <div className="p-2.5 rounded-lg border border-sky-500/20 bg-sky-950/15 text-[10px] text-sky-300 leading-relaxed flex items-start gap-1.5">
              <span>💡</span>
              <div>
                Cảnh có nhiều chi tiết môi trường (mưa, xe cộ, dây phơi...). Khuyên dùng layout **2x2** hoặc **2x3** để bao quát không gian tốt nhất.
              </div>
            </div>
          )}

          <div className="p-2.5 rounded-lg border border-indigo-500/20 bg-indigo-950/15 text-[10px] text-indigo-300 leading-relaxed flex items-start gap-1.5">
            <span>🎯</span>
            <div>
              AI khuyến nghị dùng **Grid {scenePlan.recommendedGrid}** ({scenePlan.recommendedShotCount} shots) dựa trên độ căng thẳng và chi tiết cảnh.
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Kết Nối World Asset */}
      {activeStep === 2 && (
        <div className="px-4 py-3 space-y-3">
          <div>
            <div className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider mb-1.5 flex items-center gap-1">
              <Database size={11} className="text-indigo-400" />
              <span>Nhân vật có mặt trong cảnh</span>
            </div>
            {(data.charactersInScene || []).length > 0 ? (
              <div className="space-y-1.5">
                {(data.charactersInScene as string[]).map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800">
                    <span className="text-[11px] text-slate-200 font-bold flex items-center gap-1.5">
                      <span>👤</span>
                      <span>{c}</span>
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                      <Link size={9} />
                      <span>Linked</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 border border-dashed border-slate-800 rounded-lg text-slate-500 text-[10px]">
                Không phát hiện nhân vật nào.
              </div>
            )}
          </div>

          <div>
            <div className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider mb-1.5 flex items-center gap-1">
              <Compass size={11} className="text-indigo-400" />
              <span>Bối cảnh / Địa điểm</span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950/70 border border-slate-800">
              <span className="text-[11px] text-slate-200 font-bold flex items-center gap-1.5">
                <span>📍</span>
                <span>{location || 'Chưa đặt bối cảnh'}</span>
              </span>
              {location ? (
                <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold flex items-center gap-1">
                  <Link size={9} />
                  <span>Linked</span>
                </span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                  Missing
                </span>
              )}
            </div>
          </div>

          {/* Quick inputs for basic settings */}
          <div className="border-t border-slate-800/80 pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[8px] text-slate-500 uppercase font-black">📍 Location Override</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => {
                    setLocation(e.target.value);
                    updateField('location', e.target.value);
                  }}
                  className="w-full mt-0.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-500/50"
                  placeholder="Bối cảnh..."
                />
              </div>
              <div>
                <label className="text-[8px] text-slate-500 uppercase font-black">Time of Day</label>
                <input
                  type="text"
                  value={timeOfDay}
                  onChange={e => {
                    setTimeOfDay(e.target.value);
                    updateField('timeOfDay', e.target.value);
                  }}
                  className="w-full mt-0.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-white outline-none focus:border-indigo-500/50"
                  placeholder="DAY / NIGHT..."
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <div>
                <label className="text-[8px] text-slate-500 uppercase font-black">💡 Lighting</label>
                <input
                  type="text"
                  value={lighting}
                  onChange={e => {
                    setLighting(e.target.value);
                    updateField('lighting', e.target.value);
                  }}
                  className="w-full mt-0.5 bg-slate-950/80 border border-slate-800 rounded-lg px-1.5 py-1 text-[9.5px] text-white outline-none focus:border-indigo-500/50"
                  placeholder="Ánh sáng..."
                />
              </div>
              <div>
                <label className="text-[8px] text-slate-500 uppercase font-black">🌤 Weather</label>
                <input
                  type="text"
                  value={weather}
                  onChange={e => {
                    setWeather(e.target.value);
                    updateField('weather', e.target.value);
                  }}
                  className="w-full mt-0.5 bg-slate-950/80 border border-slate-800 rounded-lg px-1.5 py-1 text-[9.5px] text-white outline-none focus:border-indigo-500/50"
                  placeholder="Thời tiết..."
                />
              </div>
              <div>
                <label className="text-[8px] text-slate-500 uppercase font-black">🎵 Sound Cue</label>
                <input
                  type="text"
                  value={soundCue}
                  onChange={e => {
                    setSoundCue(e.target.value);
                    updateField('soundCue', e.target.value);
                  }}
                  className="w-full mt-0.5 bg-slate-950/80 border border-slate-800 rounded-lg px-1.5 py-1 text-[9.5px] text-white outline-none focus:border-indigo-500/50"
                  placeholder="Âm thanh..."
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Tạo Phân Cảnh */}
      {activeStep === 3 && (
        <div className="px-4 py-3 space-y-3">
          {/* Action Description */}
          <div>
            <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider flex items-center gap-1">
              <Clapperboard size={11} className="text-indigo-400" />
              <span>Nội dung phân cảnh gốc</span>
            </label>
            <p className="mt-1 text-[10px] text-slate-300 leading-relaxed bg-slate-950/60 rounded-lg p-2 border border-slate-800 max-h-11 overflow-y-auto italic">
              {data.action || data.sceneDescription || '(Không có mô tả)'}
            </p>
          </div>

          {/* Panel Grid Selector & Generator (Temporarily hidden for single shot mode) */}
          <div className="space-y-2">
            {/* Action Trigger Buttons */}
            <div className="flex gap-2 pt-1">
              {shotsCreated ? (
                <>
                  <button
                    onClick={handleGenerateShots}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg active:scale-95 transition-all"
                  >
                    <Sparkles size={13} />
                    <span>Re-Generate Shots</span>
                  </button>
                  <button
                    onClick={handleClearShots}
                    className="px-3 py-2 rounded-xl text-xs font-black bg-slate-800 hover:bg-slate-700 text-rose-400 border border-slate-700 hover:border-rose-500/30 active:scale-95 transition-all"
                    title="Xóa toàn bộ các shot đã tạo"
                  >
                    <RotateCcw size={13} />
                  </button>
                </>
              ) : (
                <button
                  onClick={handleGenerateShots}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 active:scale-95 transition-all shadow-[0_0_12px_rgba(99,102,241,0.2)]"
                >
                  <Sparkles size={13} />
                  <span>Generate Shots</span>
                </button>
              )}
            </div>
          </div>

          {/* Prep Notes */}
          <div>
            <label className="text-[8.5px] text-slate-400 uppercase font-black tracking-wider">✏️ Ghi chú phụ (Prep Notes)</label>
            <textarea
              value={prepNotes}
              onChange={e => {
                setPrepNotes(e.target.value);
                updateField('prepNotes', e.target.value);
              }}
              rows={1}
              className="w-full mt-1 bg-slate-950/80 border border-slate-800 rounded-lg p-2 text-[10.5px] text-slate-300 outline-none resize-none focus:border-indigo-500/40 transition-all leading-relaxed"
              placeholder="Ghi chú kỹ thuật bổ sung..."
            />
          </div>
        </div>
      )}

      {/* Script Gap Detector */}
      {gaps.length > 0 && (
        <div className="mx-4 mb-2.5 rounded-xl border border-amber-500/20 bg-amber-950/10 overflow-hidden">
          <button
            onClick={() => setShowGaps(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-left"
          >
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-amber-400" />
              <span className="text-[9.5px] text-amber-400 font-black uppercase tracking-wider">Script Gaps ({gaps.length})</span>
            </div>
            {showGaps ? <ChevronUp size={12} className="text-amber-400" /> : <ChevronDown size={12} className="text-amber-400" />}
          </button>
          {showGaps && (
            <div className="px-3 pb-2.5 space-y-1">
              {gaps.map((g, i) => (
                <div key={i} className="text-[9.5px] text-amber-300/80 font-medium flex items-center gap-1">
                  <span>•</span>
                  <span>{g}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI Gap-Fill Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="mx-4 mb-2.5 rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/10 overflow-hidden">
          <button
            onClick={() => setShowSuggestions(p => !p)}
            className="w-full flex items-center justify-between px-3 py-2 text-left"
          >
            <div className="flex items-center gap-1.5">
              <Lightbulb size={12} className="text-fuchsia-400" />
              <span className="text-[9.5px] text-fuchsia-400 font-black uppercase tracking-wider">⚡ AI Suggestions ({aiSuggestions.length})</span>
            </div>
            {showSuggestions ? <ChevronUp size={12} className="text-fuchsia-400" /> : <ChevronDown size={12} className="text-fuchsia-400" />}
          </button>
          {showSuggestions && (
            <div className="px-3 pb-2.5 space-y-2">
              {aiSuggestions.map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[10px] bg-slate-950/40 p-1.5 rounded-lg border border-white/5">
                  <span className="text-fuchsia-300 flex-1 leading-relaxed">{s}</span>
                  <div className="flex gap-1">
                    <button onClick={() => handleAcceptSuggestion(s)} className="text-emerald-400 hover:text-emerald-300 flex-shrink-0 p-0.5 hover:bg-emerald-500/10 rounded">
                      <Plus size={12} />
                    </button>
                    <button onClick={() => handleRejectSuggestion(s)} className="text-rose-400 hover:text-rose-300 flex-shrink-0 p-0.5 hover:bg-rose-500/10 rounded">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accepted suggestions chips */}
      {acceptedSuggestions.length > 0 && (
        <div className="mx-4 mb-2 flex flex-wrap gap-1">
          {acceptedSuggestions.map((s: string, i: number) => (
            <span key={i} className="text-[8.5px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-lg font-bold">
              ✓ {s.substring(0, 32)}{s.length > 32 ? '…' : ''}
            </span>
          ))}
        </div>
      )}

      {/* Characters in scene */}
      {(data.charactersInScene || []).length > 0 && (
        <div className="mx-4 mb-3.5 flex flex-wrap gap-1 border-t border-white/5 pt-2">
          {(data.charactersInScene as string[]).map((c, i) => (
            <span key={i} className="text-[9.5px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded-lg font-semibold">
              👤 {c}
            </span>
          ))}
        </div>
      )}

      {/* Bottom status */}
      <div className={`px-4 py-2 border-t border-white/5 rounded-b-2xl flex items-center justify-between ${isReady ? 'bg-emerald-950/20' : 'bg-slate-950/30'}`}>
        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">
          {gaps.length === 0 ? '✅ Ready to generate' : `${gaps.length} warning${gaps.length > 1 ? 's' : ''}`}
        </span>
        <span className={`text-[9px] font-black uppercase tracking-wide flex items-center gap-1 ${isReady ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span>{isReady ? '🔓 Flow Active' : '🔒 Flow Locked'}</span>
        </span>
      </div>
    </div>
  );
}

export default memo(ScenePrepNode);
