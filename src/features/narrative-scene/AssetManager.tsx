import { FolderGit2, Wand2, BookOpen, Clock, Film, Users, MapPin, Package, Sliders, Sparkles, ShieldCheck, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import { type ParsedScript } from '../../utils/scriptParser';
import { useFlowStore } from '../../store/useFlowStore';

interface AssetManagerProps {
  parsedData: ParsedScript | null;
  onBuildStoryboard: (assetImages: Record<string, string>) => void;
  isBuilding?: boolean;
  buildingStage?: string;
}

export default function AssetManager({ parsedData, onBuildStoryboard, isBuilding, buildingStage }: AssetManagerProps) {
  const projectData = useFlowStore(state => state.projectData);
  const setProjectData = useFlowStore(state => state.setProjectData);
  const [isGeneratingStyle, setIsGeneratingStyle] = useState(false);

  const handleAutoPromptStyle = async () => {
    try {
      setIsGeneratingStyle(true);
      const { generateStylePrompt } = await import('../../utils/scriptParser');
      const result = await generateStylePrompt(projectData.stylePrompt || '');
      setProjectData({ ...projectData, stylePrompt: result.stylePrompt });
    } catch (e) {
      console.warn("Lỗi auto style", e);
    } finally {
      setIsGeneratingStyle(false);
    }
  };

  if (!parsedData) {
    return (
      <div className="w-64 border-r border-slate-800 bg-[#16161a]/95 flex flex-col h-full z-10 p-4">
        <div className="flex flex-col items-center justify-center h-full text-slate-500 text-center gap-3">
          <FolderGit2 size={32} className="opacity-50" />
          <p className="text-sm font-bold">Flow Controller</p>
          <p className="text-xs">Phân tích kịch bản để bắt đầu thiết kế luồng.</p>
        </div>
      </div>
    );
  }

  // Stats
  const totalChars = parsedData.characters?.length || 0;
  const totalLocs = parsedData.locations?.length || 0;
  const totalProps = parsedData.props?.length || 0;
  const totalScenes = parsedData.scenes?.length || parsedData.totalScenes || 0;

  return (
    <div className="w-72 border-r border-slate-800 bg-[#16161a] flex flex-col h-full shadow-2xl z-10">
      {/* Header */}
      <div className="p-4 border-b border-slate-800 bg-[#1e1e24] flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <FolderGit2 size={18} className="text-indigo-400" />
          <div className="text-left font-sans">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded block w-fit mb-0.5">Bước 3</span>
            <h2 className="font-bold text-sm tracking-wide">Flow Controller</h2>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* ── STORY OVERVIEW ──────────────────────────────── */}
        <div className="bg-[#1a1a22] rounded-xl border border-indigo-500/20 p-3 space-y-2.5">
          <div className="flex items-center gap-1.5">
            <BookOpen size={12} className="text-indigo-400" />
            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Story Overview</span>
          </div>

          {/* Summary */}
          {parsedData.scriptSummary && (
            <p className="text-[11px] text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/40 pl-2">
              "{parsedData.scriptSummary}"
            </p>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-[#0f0f16] rounded-lg p-2 flex items-center gap-2">
              <Clock size={11} className="text-sky-400 flex-shrink-0" />
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Duration</div>
                <div className="text-[11px] text-white font-bold">{parsedData.estimatedDuration || `~${totalScenes * 8}s`}</div>
              </div>
            </div>
            <div className="bg-[#0f0f16] rounded-lg p-2 flex items-center gap-2">
              <Film size={11} className="text-fuchsia-400 flex-shrink-0" />
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Scenes</div>
                <div className="text-[11px] text-white font-bold">{totalScenes} scenes</div>
              </div>
            </div>
            <div className="bg-[#0f0f16] rounded-lg p-2 flex items-center gap-2">
              <Users size={11} className="text-emerald-400 flex-shrink-0" />
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Characters</div>
                <div className="text-[11px] text-white font-bold">{totalChars} chars</div>
              </div>
            </div>
            <div className="bg-[#0f0f16] rounded-lg p-2 flex items-center gap-2">
              <MapPin size={11} className="text-amber-400 flex-shrink-0" />
              <div>
                <div className="text-[9px] text-slate-500 uppercase font-bold">Locations</div>
                <div className="text-[11px] text-white font-bold">{totalLocs} locs</div>
              </div>
            </div>
          </div>

          {/* Characters chips */}
          <div className="space-y-1">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Cast</div>
            <div className="flex flex-wrap gap-1">
              {(parsedData.characters || []).map((c, i) => (
                <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                  👤 {c.name}
                </span>
              ))}
            </div>
          </div>

          {/* Locations chips */}
          <div className="space-y-1">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Locations</div>
            <div className="flex flex-wrap gap-1">
              {(parsedData.locations || []).map((l, i) => (
                <span key={i} className="text-[10px] bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                  📍 {l.name}
                </span>
              ))}
            </div>
          </div>

          {/* Props chips (if any) */}
          {parsedData.props && parsedData.props.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                <Package size={9} /> Props
              </div>
              <div className="flex flex-wrap gap-1">
                {(parsedData.props || []).map((p, i) => (
                  <span key={i} className="text-[10px] bg-sky-500/10 text-sky-300 border border-sky-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                    🧰 {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scene list summary */}
          <div className="space-y-1">
            <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Scene Breakdown</div>
            <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
              {(parsedData.scenes || []).map((s, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px]">
                  <span className="text-fuchsia-400 font-black flex-shrink-0 w-6">S{i+1}</span>
                  <span className="text-slate-400 leading-tight">{s.sceneDescription || s.action?.substring(0, 60) || s.location}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── GLOBAL CONFIGS ──────────────────────────────── */}
        <div className="bg-[#1a1a22] rounded-xl border border-indigo-500/20 p-3 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sliders size={12} className="text-indigo-400" />
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Global Configs</span>
            </div>
          </div>

          {/* Aspect Ratio */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
              <span>Aspect Ratio</span>
              <span className="text-[8px] text-slate-600 font-normal lowercase">(Tỷ lệ khung hình)</span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {(['16:9', '9:16', '1:1'] as const).map((ratio) => (
                <button
                  key={ratio}
                  type="button"
                  onClick={() => setProjectData({ ...projectData, aspectRatio: ratio })}
                  className={`py-1 text-[10px] font-bold rounded border transition-all ${
                    projectData.aspectRatio === ratio
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                      : 'bg-[#0f0f16] border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {ratio === '16:9' ? '横 16:9' : ratio === '9:16' ? '竖 9:16' : '方 1:1'}
                </button>
              ))}
            </div>
          </div>

          {/* Dialogue Mode */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider flex items-center justify-between">
              <span>Dialogue Mode</span>
              <span className="text-[8px] text-slate-600 font-normal lowercase">(Chế độ thoại)</span>
            </label>
            <select
              value={projectData.dialogueMode || 'post-sync'}
              onChange={(e) => setProjectData({ ...projectData, dialogueMode: e.target.value as any })}
              className="w-full bg-[#0f0f16] border border-slate-800 hover:border-slate-700 rounded p-1.5 text-[10px] text-slate-200 outline-none focus:border-indigo-500/50"
            >
              <option value="post-sync">🎤 Post-Sync (Lồng tiếng sau)</option>
              <option value="ai-speech">🤖 AI Speech (TTS trực tiếp)</option>
              <option value="silent">🔇 Silent (Không thoại/Câm)</option>
            </select>
          </div>

          {/* Global Style Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
                <span>Visual Style Prompt</span>
              </label>
              <button
                type="button"
                onClick={handleAutoPromptStyle}
                disabled={isGeneratingStyle}
                className="text-[8px] bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 flex items-center gap-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={8} className={isGeneratingStyle ? 'animate-spin' : ''} />
                <span>{isGeneratingStyle ? 'AI Styling...' : 'AI Suggest'}</span>
              </button>
            </div>
            <textarea
              value={projectData.stylePrompt || ''}
              onChange={(e) => setProjectData({ ...projectData, stylePrompt: e.target.value })}
              placeholder="Nhập visual style prompt hoặc nhấn AI Suggest..."
              className="w-full bg-[#0f0f16] border border-slate-800 hover:border-slate-700 rounded p-2 text-[10px] text-slate-300 outline-none focus:border-indigo-500/50 h-14 resize-none leading-normal font-mono"
            />
          </div>

          {/* Target Runtime & Max Shots */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                Runtime (s)
              </label>
              <input
                type="number"
                value={projectData.targetRuntime || 180}
                onChange={(e) => setProjectData({ ...projectData, targetRuntime: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#0f0f16] border border-slate-800 hover:border-slate-700 rounded p-1 text-[10px] text-slate-200 outline-none focus:border-indigo-500/50"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">
                Max Shots
              </label>
              <input
                type="number"
                value={projectData.maxShotCount || 40}
                onChange={(e) => setProjectData({ ...projectData, maxShotCount: parseInt(e.target.value) || 0 })}
                className="w-full bg-[#0f0f16] border border-slate-800 hover:border-slate-700 rounded p-1 text-[10px] text-slate-200 outline-none focus:border-indigo-500/50"
              />
            </div>
          </div>

          {/* AI Generator Engines */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">
                Storyboard Model
              </label>
              <select
                value={projectData.imageModel || 'auto'}
                onChange={(e) => setProjectData({ ...projectData, imageModel: e.target.value })}
                className="w-full bg-[#0f0f16] border border-slate-800 hover:border-slate-700 rounded p-1 text-[9px] text-slate-200 outline-none focus:border-indigo-500/50"
              >
                <option value="auto">Auto Model</option>
                <option value="imagen-3.0-generate-002">Imagen 3.0 Gen</option>
                <option value="imagen-3.0-fast-002">Imagen 3.0 Fast</option>
                <option value="imagen-3.0-fast-00">Imagen 3.0 Fast (00)</option>
                <option value="midjourney-v6">Midjourney v6</option>
                <option value="stable-diffusion-xl">Stable Diffusion XL</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] text-slate-400 uppercase font-bold tracking-wider">
                Video Model
              </label>
              <select
                value={projectData.videoModel || 'auto'}
                onChange={(e) => setProjectData({ ...projectData, videoModel: e.target.value })}
                className="w-full bg-[#0f0f16] border border-slate-800 hover:border-slate-700 rounded p-1 text-[9px] text-slate-200 outline-none focus:border-indigo-500/50"
              >
                <option value="auto">Auto Router</option>
                <option value="veo-3.1-fast-generate-001">Google Veo 3.1 Fast</option>
                <option value="veo-2.0-generate-001">Google Veo 2.0</option>
                <option value="runway-gen3">Runway Gen-3</option>
                <option value="seedance-video">Seedance (Flex)</option>
              </select>
            </div>
          </div>

          {/* Safety Locks */}
          <div className="space-y-1.5">
            <label className="text-[9px] text-slate-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <ShieldCheck size={11} className="text-emerald-400" />
              <span>Khóa an toàn AI (Safety Locks)</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5 bg-[#0f0f16] p-2 rounded border border-slate-800/80">
              {([
                { key: 'no-text', label: 'Cấm sinh Text' },
                { key: 'no-subtitles', label: 'Cấm phụ đề' },
                { key: 'no-morphing', label: 'Chống Biến hình' },
                { key: 'no-watermark', label: 'Không Logo/W' }
              ]).map((lock) => {
                const currentLocks = projectData.safetyLocks || [];
                const isLocked = currentLocks.includes(lock.key);
                return (
                  <label key={lock.key} className="flex items-center gap-1.5 text-[9px] text-slate-400 hover:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isLocked}
                      onChange={(e) => {
                        const nextLocks = e.target.checked
                          ? [...currentLocks, lock.key]
                          : currentLocks.filter(k => k !== lock.key);
                        setProjectData({ ...projectData, safetyLocks: nextLocks });
                      }}
                      className="rounded border-slate-800 bg-[#16161a] text-indigo-600 focus:ring-indigo-500/30 h-3 w-3"
                    />
                    <span>{lock.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── BUILD ACTION ──────────────────────────────── */}
      <div className="p-4 border-t border-slate-800 bg-[#1e1e24] space-y-2">
        {/* Quick summary bar */}
        <div className="flex items-center justify-between text-[9px] text-slate-500 font-semibold px-0.5">
          <span>{totalScenes} scenes · {totalChars} chars · {totalLocs} locs{totalProps > 0 ? ` · ${totalProps} props` : ''}</span>
          <span className="text-indigo-400">{parsedData.estimatedDuration || `~${totalScenes * 8}s`}</span>
        </div>

        <button 
          onClick={() => { if (!isBuilding) onBuildStoryboard({}) }}
          disabled={isBuilding}
          className={`w-full flex items-center justify-center gap-2 text-white py-3 px-2 rounded-lg font-extrabold text-xs shadow-[0_0_20px_rgba(79,70,229,0.3)] transition-all ${isBuilding ? 'bg-indigo-800 cursor-not-allowed opacity-80' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500'}`}
        >
          {isBuilding ? (
            <>
              <svg className="animate-spin -ml-1 mr-1 h-3.5 w-3.5 text-white flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="truncate">{buildingStage || "Đang dựng luồng..."}</span>
            </>
          ) : (
            `🚀 Bước 4: Tạo sơ đồ Storyboard`
          )}
        </button>
      </div>
    </div>
  );
}
