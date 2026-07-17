import { PlusCircle, Loader2, Sparkles, Wand2, Film, DownloadCloud } from 'lucide-react';

interface ProjectSettingsPanelProps {
  selectedProjectId: string;
  setSelectedProjectId: (val: string) => void;
  projects: any[];
  newProjectName: string;
  setNewProjectName: (val: string) => void;
  handleCreateWorldAssetProject: () => void;
  isCreatingWorldAssetProject: boolean;
  projectData: any;
  setProjectData: (data: any) => void;
  handleCreateProject: () => Promise<string | null>;
  isCreatingProject: boolean;
  handleAutoPromptStyle: () => void;
  isGeneratingStyle: boolean;
  handleSyncEpisodeToDB: () => void;
  isSyncingEpisode: boolean;
  episodes: any[];
  isLoadingEpisodes: boolean;
  handleImportEpisode: (ep: any) => void;
  isSyncingLetta: boolean;
  handleSyncLetta: () => void;
}

export function ProjectSettingsPanel({
  selectedProjectId,
  setSelectedProjectId,
  projects,
  newProjectName,
  setNewProjectName,
  handleCreateWorldAssetProject,
  isCreatingWorldAssetProject,
  projectData,
  setProjectData,
  handleCreateProject,
  isCreatingProject,
  handleAutoPromptStyle,
  isGeneratingStyle,
  handleSyncEpisodeToDB,
  isSyncingEpisode,
  episodes,
  isLoadingEpisodes,
  handleImportEpisode,
  isSyncingLetta,
  handleSyncLetta
}: ProjectSettingsPanelProps) {
  return (
    <div className="flex gap-4 w-full text-left">
      {/* World Asset & Labs GFlow Config */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3 w-[260px] shrink-0">
        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block border-b border-slate-800/80 pb-1.5">
          Universe Selection
        </span>
        
        <div className="space-y-1">
          <label className="text-[9px] text-slate-500 font-bold uppercase">World Asset Project</label>
          <select 
            className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 transition-all font-semibold cursor-pointer"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            {projects.map((proj: any) => (
              <option key={proj.id} value={proj.id}>{proj.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-1.5">
          <input 
            type="text" 
            placeholder="Dự án mới..."
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-[11px] text-white outline-none focus:border-indigo-500/50 font-sans"
          />
          <button 
            onClick={handleCreateWorldAssetProject}
            disabled={isCreatingWorldAssetProject}
            className="px-2.5 rounded-lg bg-indigo-650 hover:bg-indigo-550 text-white flex items-center justify-center shrink-0 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isCreatingWorldAssetProject ? <Loader2 size={10} className="animate-spin" /> : <PlusCircle size={12} />}
          </button>
        </div>

        <button
          onClick={handleSyncLetta}
          disabled={isSyncingLetta}
          className="w-full py-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/30 hover:bg-indigo-650 hover:text-white text-indigo-200 hover:border-indigo-600 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
        >
          {isSyncingLetta ? (
            <><Loader2 size={10} className="animate-spin" /> Đồng bộ Letta...</>
          ) : (
            <>🧠 Đồng bộ Letta Agent Memory</>
          )}
        </button>

        <div className="w-full h-px bg-slate-800" />

        <div className="space-y-2">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Google Labs (GFlow)</span>
          <div>
            <span className="text-[8px] text-slate-600 font-bold block mb-0.5 font-sans">PROJECT NAME</span>
            <input 
              type="text" 
              value={projectData.name || ''} 
              onChange={(e) => setProjectData({ ...projectData, name: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-[11px] text-white outline-none focus:border-indigo-500 transition-all font-semibold font-sans"
              placeholder="Tên Project GFlow"
            />
          </div>
          <div>
            <span className="text-[8px] text-slate-600 font-bold block mb-0.5">LABS ID (GFlow)</span>
            <div className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-[10px] text-indigo-400 font-mono font-bold select-all truncate">
              {projectData.id && projectData.id !== 'new' ? projectData.id : 'Chưa khởi tạo'}
            </div>
          </div>
          <button
            onClick={handleCreateProject}
            disabled={isCreatingProject}
            className="w-full py-1.5 rounded-lg bg-indigo-650 hover:bg-indigo-550 disabled:bg-indigo-900/40 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
          >
            {isCreatingProject ? (
              <><Loader2 size={10} className="animate-spin text-white" /> Khởi tạo...</>
            ) : (
              <><Sparkles size={10} fill="currentColor" /> Initialize Labs GFlow</>
            )}
          </button>
        </div>

        <div className="w-full h-px bg-slate-800" />

        <div className="space-y-2">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Universe Settings (Letta)</span>
          <div>
            <span className="text-[8px] text-slate-600 font-bold block mb-0.5">UNIVERSE GENRE</span>
            <input 
              type="text" 
              value={projectData.universeGenre || ''} 
              onChange={(e) => setProjectData({ ...projectData, universeGenre: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-[11px] text-white outline-none focus:border-indigo-500 transition-all"
              placeholder="VD: Sci-Fi, Fantasy, Cổ trang..."
            />
          </div>
          <div>
            <span className="text-[8px] text-slate-600 font-bold block mb-0.5">WORLD CONSTRAINTS</span>
            <textarea 
              value={projectData.worldConstraints || ''} 
              onChange={(e) => setProjectData({ ...projectData, worldConstraints: e.target.value })}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg px-2.5 py-1 text-[10px] text-white resize-none h-[50px] outline-none focus:border-indigo-500 transition-all font-sans"
              placeholder="VD: Trọng lực thấp, không dùng điện..."
            />
          </div>
        </div>
      </div>

      {/* Global Art Style Area */}
      <div className="bg-[#17171c]/90 rounded-xl border border-sky-500/10 p-3 space-y-3 w-[260px] shrink-0 flex flex-col justify-between">
        <div className="space-y-2">
          <span className="text-[10px] text-sky-400 font-black uppercase tracking-widest flex justify-between items-center border-b border-slate-800/80 pb-1.5">
            <span>GLOBAL ART STYLE</span>
            <button 
              onClick={handleAutoPromptStyle}
              disabled={isGeneratingStyle}
              className="text-[8px] text-sky-400 hover:text-white flex items-center gap-0.5 transition-colors bg-sky-500/10 px-1.5 py-0.5 rounded font-black uppercase cursor-pointer"
            >
              {isGeneratingStyle ? <Loader2 size={8} className="animate-spin" /> : <><Wand2 size={8} /> Auto Style</>}
            </button>
          </span>
          <p className="text-[8.5px] text-slate-500 leading-normal font-sans">
            Style prompt này sẽ được đính kèm vào tất cả các yêu cầu tạo ảnh nhân vật, bối cảnh, đạo cụ để đảm bảo tính đồng nhất.
          </p>
          <textarea
            value={projectData.stylePrompt || ''}
            onChange={(e) => setProjectData({ ...projectData, stylePrompt: e.target.value })}
            className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-[10px] text-sky-100 resize-none h-[180px] outline-none focus:border-sky-500 transition-all font-mono leading-relaxed"
            placeholder="Nhập 1 style ngắn gọn (VD: disney pixar, cinematic, anime). Nhấn 'Auto Style' để AI tự động mở rộng..."
          />
        </div>
      </div>

      {/* Kịch bản (Scenario / Episode) Sync */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 space-y-3 w-[240px] shrink-0 flex flex-col justify-between">
        <div className="space-y-2">
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block border-b border-slate-800/80 pb-1.5 font-sans">
            Kịch Bản (Script DB)
          </span>
          <p className="text-[8.5px] text-slate-500 leading-normal font-sans">
            Lưu trữ kịch bản phân đoạn hiện tại trên Canvas lên World Asset DB để đồng bộ liên tầng.
          </p>
          <button 
            onClick={handleSyncEpisodeToDB}
            disabled={isSyncingEpisode}
            className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center gap-1 transition-all font-sans cursor-pointer"
          >
            {isSyncingEpisode ? (
              <><Loader2 size={10} className="animate-spin text-white" /> Đang lưu...</>
            ) : (
              <>Lưu Kịch Bản Hiện Tại</>
            )}
          </button>
        </div>

        <div className="w-full h-px bg-slate-800" />

        <div className="space-y-2 flex-1 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
          <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1.5 font-sans">
            <Film size={10} className="text-indigo-400" /> Kịch bản ({episodes.length})
          </span>

          {isLoadingEpisodes ? (
            <div className="py-3 flex flex-col items-center justify-center gap-1">
              <Loader2 size={14} className="animate-spin text-indigo-400" />
              <span className="text-[8px] text-slate-500 font-sans">Đang tải...</span>
            </div>
          ) : episodes.length === 0 ? (
            <div className="py-4 text-center border border-dashed border-slate-850 rounded-lg bg-slate-950/20">
              <span className="text-[8px] text-slate-600 italic font-sans">Chưa lưu kịch bản nào</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {episodes.map((ep: any, idx: number) => (
                <div key={idx} className="bg-slate-950/60 p-2 rounded-lg border border-slate-850 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors">
                  <div className="min-w-0 flex-1">
                    <span className="text-[9px] font-bold text-white block truncate font-sans">{ep.title}</span>
                    <span className="text-[7.5px] text-slate-600 block mt-0.5 font-sans">
                      {ep.scenes?.length || 0} Phân cảnh
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Sếp có chắc chắn muốn Import "${ep.title}" đè lên canvas hiện tại không?`)) {
                        handleImportEpisode(ep);
                      }
                    }}
                    className="shrink-0 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[8px] font-bold flex items-center gap-0.5 transition-all font-sans cursor-pointer"
                  >
                    <DownloadCloud size={8} /> Import
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
