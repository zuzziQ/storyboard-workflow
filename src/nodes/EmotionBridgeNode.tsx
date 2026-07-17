import { Handle, Position } from 'reactflow';
import { useState, useEffect, memo } from 'react';
import { ArrowRight, Clock, MapPin, Zap, Plus, Activity } from 'lucide-react';
import { useFlowStore } from '../store/useFlowStore';

// ─── Bridge type metadata ───────────────────────────────────────────────────
const BRIDGE_META: Record<string, { icon: string; color: string; label: string }> = {
  time_skip:       { icon: '⏱', color: 'text-amber-400',   label: 'Time Skip' },
  location_shift:  { icon: '📍', color: 'text-sky-400',     label: 'Location Shift' },
  mood_shift:      { icon: '🌊', color: 'text-violet-400',  label: 'Mood Shift' },
  reveal:          { icon: '💡', color: 'text-yellow-400',  label: 'Reveal' },
  contrast:        { icon: '⚡', color: 'text-orange-400',  label: 'Contrast' },
  cutaway:         { icon: '✂️', color: 'text-fuchsia-400', label: 'Cutaway' },
};

const URGENCY_STYLE: Record<string, string> = {
  required:  'border-red-500/50 bg-red-950/20',
  suggested: 'border-amber-500/30 bg-amber-950/10',
  optional:  'border-slate-700 bg-slate-900/30',
};

const VALENCE_COLOR: Record<string, string> = {
  positive:    '#10b981',
  negative:    '#ef4444',
  neutral:     '#64748b',
  tense:       '#f97316',
  melancholic: '#8b5cf6',
};

// ─── Mini SVG mood bar ──────────────────────────────────────────────────────
function MoodTransition({ fromIntensity, toIntensity, fromValence, toValence }: any) {
  const w = 240;
  const h = 40;
  const x1 = 20;
  const x2 = w - 20;
  const y1 = h - (fromIntensity / 100) * (h - 8) - 4;
  const y2 = h - (toIntensity / 100) * (h - 8) - 4;
  const cx = w / 2;
  const fromColor = VALENCE_COLOR[fromValence] || '#64748b';
  const toColor   = VALENCE_COLOR[toValence]   || '#64748b';
  const gradId    = `grad-${fromValence}-${toValence}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={fromColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={toColor}   stopOpacity={0.8} />
        </linearGradient>
      </defs>
      {/* Grid line */}
      <line x1={x1} y1={h / 2} x2={x2} y2={h / 2} stroke="#1e293b" strokeWidth={1} />
      {/* Curve */}
      <path
        d={`M ${x1},${y1} C ${cx},${y1} ${cx},${y2} ${x2},${y2}`}
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Dots */}
      <circle cx={x1} cy={y1} r={3.5} fill={fromColor} />
      <circle cx={x2} cy={y2} r={3.5} fill={toColor} />
      {/* Labels */}
      <text x={x1} y={h - 1} textAnchor="middle" fontSize={7} fill={fromColor} fontWeight="bold">{fromIntensity}</text>
      <text x={x2} y={h - 1} textAnchor="middle" fontSize={7} fill={toColor}   fontWeight="bold">{toIntensity}</text>
    </svg>
  );
}

// ─── Component ─────────────────────────────────────────────────────────────
function EmotionBridgeNode({ id, data }: { id: string; data: any }) {
  const setNodes = useFlowStore.getState().setNodes;
  const [showAddCutaway, setShowAddCutaway] = useState(false);
  const [cutawayDesc, setCutawayDesc] = useState('');

  const [moodShiftOut, setMoodShiftOut] = useState(data.moodShiftOut || '');
  const [moodShift, setMoodShift] = useState(data.moodShift || '');
  const [moodShiftPurpose, setMoodShiftPurpose] = useState(data.moodShiftPurpose || '');
  const [showPsychology, setShowPsychology] = useState(false);

  useEffect(() => {
    setMoodShiftOut(data.moodShiftOut || '');
    setMoodShift(data.moodShift || '');
    setMoodShiftPurpose(data.moodShiftPurpose || '');
  }, [data.moodShiftOut, data.moodShift, data.moodShiftPurpose]);

  const updatePsychologyFields = (updates: { moodShift?: string; moodShiftOut?: string; moodShiftPurpose?: string }) => {
    setNodes(nds => nds.map(n => {
      if (n.type === 'scenePrepNode' && n.data?.sceneId === data.afterSceneId) {
        return { 
          ...n, 
          data: { 
            ...n.data, 
            moodShiftOut: updates.moodShiftOut !== undefined ? updates.moodShiftOut : n.data.moodShiftOut 
          } 
        };
      }
      if (n.type === 'scenePrepNode' && n.data?.sceneId === data.beforeSceneId) {
        return { 
          ...n, 
          data: { 
            ...n.data, 
            moodShift: updates.moodShift !== undefined ? updates.moodShift : n.data.moodShift,
            moodShiftPurpose: updates.moodShiftPurpose !== undefined ? updates.moodShiftPurpose : n.data.moodShiftPurpose
          } 
        };
      }
      if (n.id === id) {
        return { ...n, data: { ...n.data, ...updates } };
      }
      return n;
    }));
  };

  const bridgeType   = data.suggestedType || 'mood_shift';
  const urgency      = data.urgency || 'suggested';
  const meta         = BRIDGE_META[bridgeType] || BRIDGE_META.mood_shift;

  const fromIntensity = data.fromIntensity ?? 50;
  const toIntensity   = data.toIntensity   ?? 50;
  const fromValence   = data.fromValence   || 'neutral';
  const toValence     = data.toValence     || 'neutral';

  const handleAddCutaway = () => {
    // Inject a new ScenePrepNode between the two scenes in the graph
    // This fires a store event; useGraphBuilder watches for injections
    const injectionEvent = {
      type: 'injectScene',
      afterSceneId: data.afterSceneId,
      beforeSceneId: data.beforeSceneId,
      description: cutawayDesc || data.description,
    };
    // Store in node data for graph builder to pick up on next render cycle
    setNodes(nds => nds.map(n => n.id === id
      ? { ...n, data: { ...n.data, pendingInjection: injectionEvent } }
      : n
    ));
    setShowAddCutaway(false);
    setCutawayDesc('');
  };

  return (
    <div className={`w-[260px] rounded-xl border ${URGENCY_STYLE[urgency]} bg-[#111115] shadow-[0_2px_20px_rgba(0,0,0,0.5)] transition-all`}>
      <Handle type="target" position={Position.Left}  className="w-2.5 h-2.5 bg-slate-600 border-2 border-[#1a1a20]" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-slate-600 border-2 border-[#1a1a20]" />

      {/* Header */}
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between react-flow__node-draghandle cursor-move border-b border-white/5">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{meta.icon}</span>
          <div>
            <div className={`text-[8px] font-black uppercase tracking-widest ${meta.color}`}>BRIDGE</div>
            <div className="text-[10px] font-bold text-white">{meta.label}</div>
          </div>
        </div>
        <div className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-full ${
          urgency === 'required' ? 'bg-red-500/20 text-red-400' :
          urgency === 'suggested' ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-800 text-slate-500'
        }`}>{urgency}</div>
      </div>

      {/* Scene labels */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
        <span className="text-indigo-300 max-w-[80px] truncate">{data.afterSceneId}</span>
        <ArrowRight size={10} className="text-slate-600 flex-shrink-0" />
        <span className="text-fuchsia-300 max-w-[80px] truncate">{data.beforeSceneId}</span>
      </div>

      {/* Mood transition curve */}
      <div className="px-3 pb-1">
        <MoodTransition
          fromIntensity={fromIntensity}
          toIntensity={toIntensity}
          fromValence={fromValence}
          toValence={toValence}
        />
      </div>

      {/* Bridge description */}
      <div className="px-3 pb-2">
        <p className="text-[9px] text-slate-400 leading-relaxed italic border-l-2 border-slate-700 pl-2">
          {data.description || 'Chuyển cảnh...'}
        </p>
      </div>

      {/* Meta info row */}
      <div className="px-3 pb-2 flex flex-wrap gap-1.5">
        {data.timeSkip && (
          <span className="flex items-center gap-1 text-[8px] bg-slate-800 text-amber-300 px-1.5 py-0.5 rounded-md font-bold">
            <Clock size={8} /> {data.timeSkip}
          </span>
        )}
        {data.locationChange && (
          <span className="flex items-center gap-1 text-[8px] bg-slate-800 text-sky-300 px-1.5 py-0.5 rounded-md font-bold">
            <MapPin size={8} /> Location
          </span>
        )}
        {data.soundCue && (
          <span className="text-[8px] bg-slate-800 text-purple-300 px-1.5 py-0.5 rounded-md font-bold">
            🎵 {data.soundCue}
          </span>
        )}
      </div>

      {/* Psychology Accordion */}
      <div className="px-3 pb-2.5">
        <button
          onClick={() => setShowPsychology(!showPsychology)}
          className="w-full flex items-center justify-between py-1 px-1.5 rounded bg-slate-900 border border-white/5 text-slate-300 hover:text-white transition-all text-[8px] font-black uppercase tracking-wider"
        >
          <span className="flex items-center gap-1">
            <Activity size={10} className="text-violet-400" />
            Diễn tiến tâm lý (Psychology)
          </span>
          <span>{showPsychology ? '▲' : '▼'}</span>
        </button>

        {showPsychology && (
          <div className="mt-2 space-y-2 p-2 rounded-lg bg-slate-950 border border-white/5">
            <div>
              <label className="text-[7.5px] text-slate-500 font-bold uppercase block mb-0.5">Tâm lý ra (Scene A):</label>
              <input
                type="text"
                value={moodShiftOut}
                onChange={e => {
                  setMoodShiftOut(e.target.value);
                  updatePsychologyFields({ moodShiftOut: e.target.value });
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-white outline-none focus:border-violet-500/50"
                placeholder="Mood shift out..."
              />
            </div>
            <div>
              <label className="text-[7.5px] text-slate-500 font-bold uppercase block mb-0.5">Tâm lý vào (Scene B):</label>
              <input
                type="text"
                value={moodShift}
                onChange={e => {
                  setMoodShift(e.target.value);
                  updatePsychologyFields({ moodShift: e.target.value });
                }}
                className="w-full bg-slate-900/60 border border-slate-800 rounded px-2 py-0.5 text-[9px] text-white outline-none focus:border-violet-500/50"
                placeholder="Mood shift in..."
              />
            </div>
            <div>
              <label className="text-[7.5px] text-slate-500 font-bold uppercase block mb-0.5">Mục tiêu chuyển tiếp (Purpose):</label>
              <textarea
                value={moodShiftPurpose}
                onChange={e => {
                  setMoodShiftPurpose(e.target.value);
                  updatePsychologyFields({ moodShiftPurpose: e.target.value });
                }}
                rows={2}
                className="w-full bg-slate-900/60 border border-slate-800 rounded p-1.5 text-[9px] text-white outline-none focus:border-violet-500/50 resize-none leading-normal"
                placeholder="Psychological transition goal..."
              />
            </div>
          </div>
        )}
      </div>

      {/* Add cutaway toggle */}
      {!showAddCutaway ? (
        <div className="px-3 pb-3">
          <button
            onClick={() => setShowAddCutaway(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-fuchsia-500/30 text-fuchsia-400 hover:border-fuchsia-500/60 hover:bg-fuchsia-950/20 transition-all text-[9px] font-bold"
          >
            <Plus size={10} />
            + Add Cutaway Scene
          </button>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1.5">
          <label className="text-[8px] text-fuchsia-400 font-black uppercase">Mô tả cảnh cutaway:</label>
          <textarea
            autoFocus
            value={cutawayDesc}
            onChange={e => setCutawayDesc(e.target.value)}
            placeholder={data.description}
            className="w-full h-14 bg-slate-950 border border-fuchsia-500/30 rounded-lg p-1.5 text-[10px] text-white outline-none resize-none focus:border-fuchsia-500/70 leading-relaxed"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleAddCutaway}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[9px] font-black active:scale-95 transition-all"
            >
              <Zap size={10} /> Inject Scene
            </button>
            <button
              onClick={() => { setShowAddCutaway(false); setCutawayDesc(''); }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-[9px] font-bold hover:bg-slate-700 active:scale-95"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(EmotionBridgeNode);
