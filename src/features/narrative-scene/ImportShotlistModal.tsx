import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, Loader2, AlertCircle, CheckCircle, Clipboard, Sparkles } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { getApiBaseUrl } from '../../utils/apiConfig';
import { useGraphBuilder } from '../../hooks/useGraphBuilder';
import { generateShotlistFromScript } from '../../utils/scriptParser';

interface ImportShotlistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportShotlistModal({ isOpen, onClose }: ImportShotlistModalProps) {
  const [activeTab, setActiveTab] = useState<'file' | 'text' | 'ai'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [rawScriptText, setRawScriptText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string>('');
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);

  // States cho tính năng Trợ lý AI sinh Shotlist
  const [generatedShots, setGeneratedShots] = useState<any[] | null>(null);
  const [generatedData, setGeneratedData] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectData = useFlowStore(state => state.projectData);
  const { handleImportEpisode, handleImportGeneratedShotlist } = useGraphBuilder();

  // Load Projects on mount if modal is open
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const res = await fetch(`${baseUrl}/internal/v1/asset/world/projects`, {
          headers: {
            'Authorization': `Bearer ${HUB_API_KEY}`
          }
        });
        if (res.ok) {
          const list = await res.json();
          setProjects(list || []);
          if (list && list.length > 0) {
            const activeId = projectData.selectedProjectId || projectData.selectedUniverseId || list[0].id;
            setSelectedWorldId(activeId);
          }
        }
      } catch (err) {
        console.error("Lỗi fetch projects trong Import modal:", err);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    if (isOpen) {
      fetchProjects();
    }
  }, [isOpen, projectData]);

  if (!isOpen) return null;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'txt') {
      setFile(selectedFile);
    } else {
      setError('Định dạng tệp không được hỗ trợ. Vui lòng chỉ chọn tệp Word (.docx) hoặc Văn bản (.txt).');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    let uploadFile = file;

    // If text tab is active, convert rawText to a virtual file
    if (activeTab === 'text') {
      if (!rawText.trim()) {
        setError('Vui lòng nhập hoặc dán văn bản shotlist.');
        return;
      }
      uploadFile = new File([rawText], 'pasted_shotlist.txt', { type: 'text/plain' });
    }

    if (!uploadFile) return;

    if (!selectedWorldId) {
      setError('Vui lòng chọn một Dự án World Asset.');
      return;
    }

    setIsUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('projectId', selectedWorldId);
    formData.append('title', uploadFile.name.replace(/\.[^/.]+$/, "")); // Strip extension for default title

    const baseUrl = getApiBaseUrl();
    const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
    const headers: Record<string, string> = {};
    if (HUB_API_KEY) {
      headers['Authorization'] = `Bearer ${HUB_API_KEY}`;
    }

    try {
      const res = await fetch(`${baseUrl}/internal/v1/asset/world/episodes/import-shotlist`, {
        method: 'POST',
        headers,
        body: formData
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Lỗi tải tệp lên server (${res.status})`);
      }

      const resData = await res.json();
      if (!resData.episode) {
        throw new Error('Dữ liệu trả về từ server bị thiếu thông tin Episode.');
      }

      setSuccess(true);
      
      // Update selectedProjectId into store to sync with target world
      useFlowStore.getState().setProjectData({
        ...projectData,
        selectedProjectId: selectedWorldId,
        selectedUniverseId: selectedWorldId,
        name: projectData.name === 'Untitled Storyboard Project' ? resData.episode.title : projectData.name
      });

      // Trigger canvas graph builder rebuild using the newly imported episode details
      setTimeout(async () => {
        await handleImportEpisode(resData.episode, selectedWorldId);
        onClose();
      }, 1500);

    } catch (err: any) {
      console.error('[Import Shotlist] Upload failed:', err);
      setError(err.message || 'Có lỗi xảy ra trong quá trình upload và parse dữ liệu.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!rawScriptText.trim()) {
      setError('Vui lòng nhập hoặc dán nội dung kịch bản thô.');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const nodes = useFlowStore.getState().nodes;
      const worldAssetNode = nodes.find(n => n.type === 'worldAssetNode');
      const existingAssets = [
        ...(worldAssetNode?.data?.characters || []).map((c: any) => ({ name: c.name || c, entityType: 'character', description: c.description || '' })),
        ...(worldAssetNode?.data?.locations || []).map((l: any) => ({ name: l.name || l, entityType: 'location', description: l.description || '' }))
      ];

      const data = await generateShotlistFromScript(rawScriptText, existingAssets, projectData?.shotlistPreset);
      if (data && data.shots) {
        setGeneratedShots(data.shots);
        setGeneratedData(data);
      } else {
        throw new Error("Không thể sinh danh sách shot từ kịch bản.");
      }
    } catch (err: any) {
      console.error("AI Generation error:", err);
      setError(err.message || "Sinh shotlist thất bại. Vui lòng kiểm tra cấu hình OpenAI/Vidtory API.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditShot = (index: number, field: 'description' | 'dialogue', value: string) => {
    if (!generatedShots || !generatedData) return;
    const updatedShots = [...generatedShots];
    updatedShots[index] = { ...updatedShots[index], [field]: value };
    setGeneratedShots(updatedShots);
    setGeneratedData({ ...generatedData, shots: updatedShots });
  };

  const handleConfirmAILoad = async () => {
    if (!generatedData) return;
    setIsUploading(true);
    setError(null);
    try {
      if (selectedWorldId) {
        useFlowStore.getState().setProjectData({
          ...projectData,
          selectedProjectId: selectedWorldId,
          selectedUniverseId: selectedWorldId
        });
      }
      await handleImportGeneratedShotlist(generatedData, selectedWorldId);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setGeneratedShots(null);
        setGeneratedData(null);
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      console.error("[Confirm AI Load] Error:", err);
      setError(err.message || "Không thể nạp dữ liệu lên canvas.");
    } finally {
      setIsUploading(false);
    }
  };

  const isSubmitDisabled = activeTab === 'file' ? !file : !rawText.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className={`relative w-full overflow-hidden bg-[#16161a] border border-slate-800 rounded-3xl shadow-2xl transition-all duration-300 ${generatedShots ? 'max-w-4xl' : 'max-w-lg'}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#1e1e24]">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Nhập dữ liệu Shotlist trực tiếp</h3>
            <p className="text-[10px] text-slate-500 mt-1">Nạp trực tiếp danh sách shot chuẩn bằng cách chọn file hoặc dán văn bản</p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs selector */}
        <div className="flex border-b border-slate-800 bg-[#111115] p-1 gap-1">
          <button
            onClick={() => { setActiveTab('file'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'file'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Upload size={12} />
            <span>Tải lên tệp tin</span>
          </button>
          <button
            onClick={() => { setActiveTab('text'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'text'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Clipboard size={12} />
            <span>Dán kịch bản / Shotlist</span>
          </button>
          <button
            onClick={() => { setActiveTab('ai'); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-200 cursor-pointer ${
              activeTab === 'ai'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
            }`}
          >
            <Sparkles size={12} className="text-yellow-400 animate-pulse" />
            <span>Trợ lý AI (Sinh Shotlist)</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-3 text-center">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <CheckCircle size={32} />
              </div>
              <h4 className="text-sm font-bold text-white">Import thành công!</h4>
              <p className="text-xs text-slate-400">Đang khởi tạo các Narrative Scene và Shot Node lên Canvas...</p>
            </div>
          ) : generatedShots ? (
            /* PREVIEW TABLE VIEW */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5 uppercase tracking-wider">
                    <Sparkles size={14} className="text-yellow-400 animate-pulse" />
                    Xem trước Shotlist sinh từ AI
                  </h4>
                  <p className="text-[9px] text-slate-500 mt-0.5">
                    Đã sinh thành công {generatedShots.length} shots. Sếp có thể sửa nhanh thoại và mô tả.
                  </p>
                </div>
                <button
                  onClick={() => { setGeneratedShots(null); setGeneratedData(null); setError(null); }}
                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider transition-colors cursor-pointer"
                >
                  ← Nhập lại kịch bản
                </button>
              </div>

              <div className="w-full max-h-[340px] overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/60 shadow-inner">
                <table className="w-full border-collapse text-[10px] text-slate-350">
                  <thead className="sticky top-0 bg-[#1e1e24] text-slate-400 font-black uppercase text-[9px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-2 text-left w-[70px]">Scene</th>
                      <th className="p-2 text-center w-[50px]">Shot</th>
                      <th className="p-2 text-left w-[110px]">Cài đặt Camera</th>
                      <th className="p-2 text-left">Mô tả chi tiết phân cảnh (Visual)</th>
                      <th className="p-2 text-left w-[160px]">Lời thoại (Dialogue)</th>
                      <th className="p-2 text-center w-[50px]">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {generatedShots.map((sh, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-2 font-mono text-indigo-400 align-top pt-3">{sh.sceneId}</td>
                        <td className="p-2 text-center font-bold align-top pt-3">{sh.shotNumber}</td>
                        <td className="p-2 text-slate-400 align-top pt-3 leading-relaxed">
                          <span className="block text-white font-bold">{sh.framing}</span>
                          <span className="block text-[8px] text-slate-500 font-semibold">{sh.cameraMovement}</span>
                        </td>
                        <td className="p-2">
                          <textarea
                            value={sh.description || ''}
                            onChange={(e) => handleEditShot(idx, 'description', e.target.value)}
                            className="w-full bg-slate-900/40 hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-indigo-500/50 rounded p-1 text-[10px] text-slate-200 resize-none h-[52px] outline-none transition-all leading-normal"
                          />
                        </td>
                        <td className="p-2">
                          <textarea
                            value={sh.dialogue || ''}
                            onChange={(e) => handleEditShot(idx, 'dialogue', e.target.value)}
                            className="w-full bg-slate-900/40 hover:bg-slate-900 focus:bg-slate-900 border border-transparent focus:border-indigo-500/50 rounded p-1 text-[10px] text-slate-200 resize-none h-[52px] outline-none transition-all leading-normal"
                            placeholder="(Không thoại)"
                          />
                        </td>
                        <td className="p-2 text-center font-mono text-slate-500 align-top pt-3">{sh.duration}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* World Selector for AI confirm */}
              <div className="space-y-1.5 bg-slate-950/20 p-3 rounded-2xl border border-slate-850/60">
                <label className="text-[10px] text-indigo-450 uppercase font-black tracking-wider block">Đồng bộ với Dự án World Asset</label>
                <select
                  value={selectedWorldId}
                  onChange={(e) => setSelectedWorldId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-2.5 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="" disabled>-- Chọn dự án --</option>
                  {projects.map((proj: any) => (
                    <option key={proj.id} value={proj.id}>
                      {proj.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Confirm Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => { setGeneratedShots(null); setGeneratedData(null); setError(null); }}
                  disabled={isUploading}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800/80 font-bold text-xs py-3 rounded-2xl transition-all disabled:opacity-40 cursor-pointer text-center"
                >
                  Huỷ bỏ
                </button>
                <button
                  onClick={handleConfirmAILoad}
                  disabled={isUploading || !selectedWorldId}
                  className="flex-1 bg-gradient-to-r from-emerald-600 to-indigo-650 hover:from-emerald-500 hover:to-indigo-550 text-white font-bold text-xs py-3 rounded-2xl transition-all shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang nạp lên Canvas...
                    </>
                  ) : (
                    'Xác nhận & Nạp lên Canvas'
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* FORM VIEW (FILE / PASTE TEXT / AI INPUT) */
            <>
              {/* World Selector Dropdown */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-indigo-400 uppercase font-black tracking-wider block">Chọn dự án World Asset</label>
                {isLoadingProjects ? (
                  <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-950/40 p-3.5 rounded-2xl border border-slate-850">
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                    <span>Đang tải danh sách dự án...</span>
                  </div>
                ) : (
                  <select
                    value={selectedWorldId}
                    onChange={(e) => setSelectedWorldId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-xs text-white outline-none focus:border-indigo-500 cursor-pointer transition-all"
                  >
                    <option value="" disabled>-- Chọn dự án --</option>
                    {projects.map((proj: any) => (
                      <option key={proj.id} value={proj.id}>
                        {proj.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeTab === 'file' && (
                /* Drag and Drop Zone */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full aspect-video rounded-3xl border-2 border-dashed flex flex-col items-center justify-center p-6 cursor-pointer transition-all ${
                    dragOver 
                      ? 'border-indigo-500 bg-indigo-500/5' 
                      : file 
                        ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500' 
                        : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
                  }`}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    accept=".docx,.txt"
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                  
                  {file ? (
                    <div className="flex flex-col items-center text-center space-y-2.5">
                      <div className="p-3 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-2xl">
                        <FileText size={24} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-200 block truncate max-w-[280px]">{file.name}</span>
                        <span className="text-[10px] text-slate-500 mt-1 block">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-center space-y-2.5">
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400">
                        <Upload size={24} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-300 block">Kéo thả tệp Shotlist vào đây</span>
                        <span className="text-[10px] text-slate-500 mt-1.5 block">Hỗ trợ tệp Microsoft Word (.docx) hoặc Text (.txt)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'text' && (
                /* Textarea Paste Zone */
                <div className="space-y-2">
                  <label className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">Nội dung Shotlist</label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="w-full h-48 bg-slate-950 border border-slate-850 rounded-2xl p-3.5 text-[11px] text-slate-300 font-mono outline-none focus:border-indigo-500 resize-none placeholder:text-slate-650"
                    placeholder="Dán nội dung bảng shotlist hoặc kịch bản thô tại đây (hệ thống sẽ tự nhận diện cấu trúc)..."
                  />
                </div>
              )}

              {activeTab === 'ai' && (
                /* AI Generation script text input */
                <div className="space-y-2">
                  <label className="text-[10px] text-indigo-400 uppercase font-black tracking-wider block flex items-center gap-1">
                    <Sparkles size={11} className="text-yellow-450 animate-spin-slow" />
                    Nhập kịch bản thô (Raw Screenplay)
                  </label>
                  <textarea
                    value={rawScriptText}
                    onChange={(e) => setRawScriptText(e.target.value)}
                    className="w-full h-48 bg-slate-950 border border-slate-850 rounded-2xl p-3.5 text-[11px] text-slate-300 outline-none focus:border-indigo-500 resize-none placeholder:text-slate-600 leading-relaxed font-sans"
                    placeholder="Nhập hoặc dán nội dung kịch bản văn học/kịch bản thô ở đây. AI sẽ phân tích bối cảnh, nhân vật, hành động để tự phân rã và sinh ra bảng shotlist đầy đủ..."
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onClose}
                  disabled={isUploading || isGenerating}
                  className="flex-1 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-slate-800/80 font-bold text-xs py-3 rounded-2xl transition-all disabled:opacity-40 cursor-pointer"
                >
                  Hủy bỏ
                </button>
                {activeTab === 'ai' ? (
                  <button
                    onClick={handleAIGenerate}
                    disabled={isGenerating || !rawScriptText.trim()}
                    className="flex-1 bg-gradient-to-r from-purple-650 via-pink-600 to-indigo-650 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        AI đang sinh Shotlist...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} fill="currentColor" className="text-yellow-300" />
                        Bắt đầu sinh Shotlist tự động
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleUpload}
                    disabled={isSubmitDisabled || isUploading}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Đang xử lý dữ liệu...
                      </>
                    ) : (
                      'Tiến hành nạp dữ liệu'
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
