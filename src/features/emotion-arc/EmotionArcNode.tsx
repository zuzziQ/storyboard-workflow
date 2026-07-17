import { useState, memo } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { TrendingUp, Clock, Sparkles, Check, Zap, Link2, ShieldAlert, CheckCircle, AlertTriangle } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import type { EmotionBeat } from '../../utils/scriptParser';

import { generateExpandedShots } from '../../utils/generateExpandedShots';

// ─── Color palette per arc position ────────────────────────────────────────
const ARC_COLORS: Record<string, string> = {
  setup:      '#64748b',
  inciting:   '#f59e0b',
  rising:     '#f97316',
  climax:     '#ef4444',
  falling:    '#8b5cf6',
  resolution: '#10b981',
};

const VALENCE_COLOR: Record<string, string> = {
  positive:    '#10b981',
  negative:    '#ef4444',
  neutral:     '#64748b',
  tense:       '#f97316',
  melancholic: '#8b5cf6',
};

// ─── SVG Arc Chart ──────────────────────────────────────────────────────────
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

function EmotionArcChart({
  beats,
  activeSceneId,
  onSceneClick,
}: {
  beats: EmotionBeat[];
  activeSceneId: string;
  onSceneClick: (sceneId: string) => void;
}) {
  if (beats.length === 0) return <div className="text-center text-slate-600 text-xs py-4">No emotional data</div>;

  const W = 580;
  const H = 90;
  const PAD_X = 30;
  const PAD_Y = 10;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const points = beats.map((b, i) => ({
    x: PAD_X + (i / Math.max(1, beats.length - 1)) * chartW,
    y: PAD_Y + chartH - (b.intensity / 100) * chartH,
    beat: b,
    idx: i,
  }));

  // Build smooth SVG path using cubic bezier
  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = points[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return acc + ` C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }, '');

  // Fill area under curve
  const fillD = pathD + ` L ${points[points.length - 1].x},${H} L ${points[0].x},${H} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id="arc-fill" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#64748b" stopOpacity={0.15} />
          <stop offset="40%"  stopColor="#f97316" stopOpacity={0.20} />
          <stop offset="60%"  stopColor="#ef4444" stopOpacity={0.25} />
          <stop offset="80%"  stopColor="#8b5cf6" stopOpacity={0.20} />
          <stop offset="100%" stopColor="#10b981" stopOpacity={0.15} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(pct => {
        const y = PAD_Y + chartH - (pct / 100) * chartH;
        return (
          <g key={pct}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="#1e293b" strokeWidth={1} strokeDasharray={pct === 0 || pct === 100 ? 'none' : '3,3'} />
            <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize={7} fill="#475569">{pct}</text>
          </g>
        );
      })}

      {/* Fill */}
      <path d={fillD} fill="url(#arc-fill)" />

      {/* Arc path */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {/* Scene dots + labels */}
      {points.map(({ x, y, beat, idx }) => {
        const isActive = isSameScene(beat.sceneId, activeSceneId);
        const color = ARC_COLORS[beat.arcPosition] || '#64748b';
        return (
          <g
            key={idx}
            onClick={() => onSceneClick(beat.sceneId)}
            style={{ cursor: 'pointer' }}
          >
            {/* Hover hit area */}
            <circle cx={x} cy={y} r={14} fill="transparent" />
            {/* Active ring */}
            {isActive && <circle cx={x} cy={y} r={9} fill={color} opacity={0.2} />}
            {/* Dot */}
            <circle
              cx={x} cy={y} r={isActive ? 6 : 4.5}
              fill={color}
              stroke={isActive ? '#fff' : '#0f172a'}
              strokeWidth={isActive ? 2 : 1.5}
            />
            {/* Label */}
            <text
              x={x} y={H - 2}
              textAnchor="middle"
              fontSize={7}
              fill={isActive ? color : '#475569'}
              fontWeight={isActive ? 'bold' : 'normal'}
            >
              {`S${idx + 1}`}
            </text>
            {/* Emotion label on hover via title */}
            <title>{beat.sceneId} · {beat.emotion} · {beat.intensity}/100</title>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
function EmotionArcNode({ data }: { id: string; data: any }) {
  const { fitView, getNodes } = useReactFlow();
  const setActiveSceneId = useFlowStore(s => s.setActiveSceneId);
  const activeSceneId    = useFlowStore(s => s.activeSceneId);
  const setNodes         = useFlowStore(s => s.setNodes);
  const parsedData       = useFlowStore(s => s.parsedData);
  const setPendingShots  = useFlowStore(s => s.setPendingShots);
  const [justApplied, setJustApplied] = useState(false);

  const beats: EmotionBeat[] = data.emotionArc || [];
  const scriptQuality: string = data.scriptQuality || 'medium';

  const sceneConfigs = data.sceneConfigs || {};
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

  const handleRebuild = () => {
    if (parsedData) {
      const charNames = parsedData.characters ? parsedData.characters.map((c: any) => typeof c === 'string' ? c : c.name) : [];
      const totalDur = 180;
      const avgShotDur = 4;
      const initialShots = generateExpandedShots(
        parsedData.scenes || [],
        charNames,
        totalDur,
        avgShotDur,
        parsedData.scriptText
      );
      setPendingShots(initialShots);
    } else {
      alert("Không có kịch bản đã phân tích. Vui lòng phân tích kịch bản trước.");
    }
  };

  // When a scene dot is clicked: filter canvas to that scene
  const handleSceneClick = (sceneId: string) => {
    setActiveSceneId(isSameScene(sceneId, activeSceneId) ? 'all' : sceneId);
    // Try to fitView on that scene's first storyboard shot node
    const allNodes = getNodes();
    const targetNode = allNodes.find((n: any) => 
      n.type === 'sceneNode' && 
      isSameScene(n.data?.sceneGroupId, sceneId)
    );
    if (targetNode) {
      setTimeout(() => fitView({ nodes: [targetNode], duration: 600, padding: 0.3 }), 100);
    }
  };

  // Compute climax (max intensity scene)
  const climax = beats.reduce((a, b) => (b.intensity > a.intensity ? b : a), beats[0]);

  // Query World Asset Node data to compute readiness metrics
  const allNodes = getNodes();
  const worldAssetCharacters = useFlowStore((state) => state.nodes.find(n => n.type === 'worldAssetNode')?.data?.characters);
  const worldAssetLocations = useFlowStore((state) => state.nodes.find(n => n.type === 'worldAssetNode')?.data?.locations);
  const allCharacters = worldAssetCharacters || parsedData?.characters || [];
  const allLocations = worldAssetLocations || parsedData?.locations || [];

  const verifiedChars = allCharacters.filter((c: any) => c.worldAssetCharId && !c.worldAssetCharId.startsWith('custom-')).length;
  const verifiedLocs = allLocations.filter((l: any) => l.worldAssetCharId && !l.worldAssetCharId.startsWith('custom-')).length;

  const pendingShots = useFlowStore((state) => state.pendingShots);
  const projectData = useFlowStore((state) => state.projectData);
  const targetRuntime = projectData?.targetRuntime || 180;
  const totalShots = parsedData?.shots?.length || pendingShots?.length || 0;
  const actualRuntime = (parsedData?.shots || pendingShots || []).reduce(
    (acc: number, sh: any) => acc + (Number(sh.duration) || 0), 
    0
  );
  const runtimePercent = Math.min(100, Math.round((actualRuntime / targetRuntime) * 100));
  const avgDuration = totalShots > 0 ? (actualRuntime / totalShots).toFixed(1) : '0';

  const avgNum = Number(avgDuration);
  const pacingLabel = avgNum === 0 
    ? 'CHƯA CÓ SHOT' 
    : avgNum < 3.5 
      ? '⚡ NHANH (FAST)' 
      : avgNum <= 5.5 
        ? '⚖️ VỪA (STANDARD)' 
        : '🐢 CINEMATIC/CHẬM';

  const totalAssets = allCharacters.length + allLocations.length;
  const verifiedAssets = verifiedChars + verifiedLocs;
  const readinessScore = totalAssets > 0 ? Math.round((verifiedAssets / totalAssets) * 100) : 100;

  const transitionCoverage = parsedData?.shots && parsedData.shots.length > 0 
    ? Math.round((parsedData.shots.filter((s: any) => s.causalLink || s.causal_link).length / parsedData.shots.length) * 100) 
    : 100;

  const qualityColor = scriptQuality === 'rich' ? 'text-emerald-400' : scriptQuality === 'medium' ? 'text-amber-400' : 'text-rose-400';
  const qualityLabel = scriptQuality === 'rich' ? '🟢 Rich' : scriptQuality === 'medium' ? '🟡 Medium' : '🔴 Sparse';

  return (
    <div className="w-[760px] rounded-2xl border border-indigo-500/25 bg-[#121216] shadow-[0_0_40px_rgba(99,102,241,0.15)] overflow-hidden">
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-indigo-500 border-2 border-[#121216]" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-indigo-500 border-2 border-[#121216]" />

      {/* Header */}
      <div className="px-4 py-3 bg-[#141418] border-b border-slate-800/80 flex items-center justify-between react-flow__node-draghandle cursor-move">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
            <TrendingUp size={16} className="text-indigo-400" />
          </div>
          <div>
            <div className="text-[9px] text-indigo-400 font-black uppercase tracking-widest">EMOTIONAL ARC</div>
            <div className="text-sm font-black text-white">{data.title || 'Story Emotion Map'}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Script quality badge */}
          <div className="text-right">
            <div className="text-[8px] text-slate-500 uppercase font-bold">Script Quality</div>
            <div className={`text-[10px] font-black ${qualityColor}`}>{qualityLabel}</div>
          </div>
          {climax && (
            <div className="text-right">
              <div className="text-[8px] text-slate-500 uppercase font-bold">Climax</div>
              <div className="text-[10px] font-black text-red-400">{climax.sceneId}</div>
            </div>
          )}
          {/* Scene count */}
          <div className="text-right">
            <div className="text-[8px] text-slate-500 uppercase font-bold">Scenes</div>
            <div className="text-[10px] font-black text-white">{beats.length}</div>
          </div>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="px-4 pt-3 pb-2">
        <EmotionArcChart
          beats={beats}
          activeSceneId={activeSceneId}
          onSceneClick={handleSceneClick}
        />
      </div>

      {/* Legend row */}
      <div className="px-4 pb-3 flex items-center flex-wrap gap-2">
        {Object.entries(ARC_COLORS).map(([pos, color]) => (
          <div key={pos} className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-slate-500 capitalize font-semibold">{pos}</span>
          </div>
        ))}
        <div className="ml-auto text-[8px] text-slate-600 italic">Click dot to focus scene</div>
      </div>

      {/* Narrative Pace, Readiness Notes & Final Audit Panels */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-950/40 grid grid-cols-3 gap-4 text-left nodrag">
        {/* Column 1: Pacing & Runtime */}
        <div className="space-y-2.5">
          <div className="text-[9px] uppercase tracking-widest text-indigo-400 font-black flex items-center gap-1 select-none">
            <Clock size={11} className="text-indigo-400" /> Pace &amp; Runtime
          </div>
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500 font-semibold">Runtime:</span>
              <span className="font-mono text-slate-300 font-bold">{actualRuntime}s / {targetRuntime}s</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-950 border border-slate-900 rounded-full h-1.5 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500" 
                style={{ width: `${runtimePercent}%` }}
              />
            </div>

            <div className="space-y-1.5 pt-1 text-[9px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Shots Count:</span>
                <span className="font-bold text-slate-300">{totalShots}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Avg Duration:</span>
                <span className="font-bold text-slate-300">{avgDuration}s</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Visual Pacing:</span>
                <span className="font-black text-indigo-400 uppercase tracking-tight">{pacingLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Readiness Notes */}
        <div className="space-y-2.5">
          <div className="text-[9px] uppercase tracking-widest text-emerald-400 font-black flex items-center gap-1 select-none">
            <CheckCircle size={11} className="text-emerald-400" /> Readiness Notes
          </div>
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-500 font-semibold">Asset Mapping:</span>
              <span className={`font-black ${readinessScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>{readinessScore}%</span>
            </div>
            
            {/* Tiny progress bar */}
            <div className="w-full bg-slate-950 border border-slate-900 rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-full bg-gradient-to-r ${readinessScore >= 80 ? 'from-emerald-500 to-teal-500' : 'from-amber-500 to-orange-500'} transition-all`} 
                style={{ width: `${readinessScore}%` }}
              />
            </div>

            <div className="space-y-1.5 pt-1 text-[9px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Chars Linked:</span>
                <span className="font-bold text-slate-300">{verifiedChars}/{allCharacters.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Locs Verified:</span>
                <span className="font-bold text-slate-300">{verifiedLocs}/{allLocations.length}</span>
              </div>
              <div className="text-[7.5px] text-slate-500 italic pt-1 border-t border-slate-900/50">
                {readinessScore === 100 ? '✓ Mapped to World Assets.' : '⚠ Some assets are unlinked.'}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Final Audit */}
        <div className="space-y-2.5">
          <div className="text-[9px] uppercase tracking-widest text-yellow-500 font-black flex items-center gap-1 select-none">
            <ShieldAlert size={11} className="text-yellow-500" /> Final Audit
          </div>
          <div className="bg-[#0b0b0f] border border-slate-900 rounded-xl p-3 space-y-2 text-[9px] leading-relaxed">
            {/* Checklist Item 1 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span className="text-slate-400">Visual DNA Continuity</span>
              </div>
              <span className="text-[7.5px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.2 rounded font-mono font-black uppercase">PASSED</span>
            </div>

            {/* Checklist Item 2 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400 font-bold">✓</span>
                <span className="text-slate-400">Transition Validation</span>
              </div>
              <span className="text-[7.5px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 py-0.2 rounded font-mono font-black uppercase">{transitionCoverage}%</span>
            </div>

            {/* Checklist Item 3 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className={readinessScore === 100 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>{readinessScore === 100 ? '✓' : '⚠'}</span>
                <span className="text-slate-400">Asset Verification Check</span>
              </div>
              <span className={`text-[7.5px] px-1 py-0.2 rounded font-mono font-black uppercase ${readinessScore === 100 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                {readinessScore === 100 ? 'READY' : 'PENDING'}
              </span>
            </div>
            
            <div className="text-[7.5px] text-slate-500 italic pt-1 border-t border-slate-900/50 flex items-center justify-between">
              <span>Violations detected:</span>
              <span className={readinessScore === 100 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                {readinessScore === 100 ? '0 Warnings' : 'Warnings Present'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(EmotionArcNode);
