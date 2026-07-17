import { FileText, Wand2, Loader2, Database, ChevronDown, ChevronUp, Download, Upload, Clipboard, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { getApiBaseUrl, coreApi, coreRequest } from '../../utils/apiConfig';
import { compileCopilotScreenplay } from '../../utils/scriptParser';
import { generateExpandedShots } from '../../utils/generateExpandedShots';
import { useFlowStore } from '../../store/useFlowStore';

import { safeMatchName, matchAssetWithMapping, hydrateShotsWithUniverseAssets } from '../../utils/assetMatcher';
import { useGraphBuilder } from '../../hooks/useGraphBuilder';

interface ScriptEditorProps {
  onAnalyze: (text: string) => void;
  isLoading?: boolean;
  externalScript?: string;
  onImportEpisode?: (episode: any) => Promise<void>;
  onBuildStoryboard?: () => void;
}

export default function ScriptEditor({ onAnalyze, isLoading = false, externalScript, onImportEpisode, onBuildStoryboard }: ScriptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const parsedData = useFlowStore(state => state.parsedData);
  const projectData = useFlowStore(state => state.projectData);
  const hubApiKey = useFlowStore(state => state.hubApiKey);
  const setParsedData = useFlowStore(state => state.setParsedData);
  const setProjectData = useFlowStore(state => state.setProjectData);
  const setPendingShots = useFlowStore(state => state.setPendingShots);
  const { handleImportGeneratedShotlist } = useGraphBuilder();

  // World Asset DB Integration States
  const [isDbSelectorOpen, setIsDbSelectorOpen] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [projectRefreshTrigger, setProjectRefreshTrigger] = useState(0);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [isLoadingDb, setIsLoadingDb] = useState(false);

  // AI Co-Pilot & Local Characters States
  const [editorMode, setEditorMode] = useState<'editor' | 'copilot' | 'import'>('editor');
  const [premise, setPremise] = useState('');
  const [totalDur, setTotalDur] = useState(60);
  const [avgShotDur, setAvgShotDur] = useState(4);
  const [emotion, setEmotion] = useState('Hồi hộp & Trinh thám (Suspense & Mystery)');
  const [twist, setTwist] = useState('Không có nút thắt (None)');
  const [retention, setRetention] = useState('Mở đầu kịch tính (Cold Open)');
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationStatus, setCompilationStatus] = useState('');
  const [projectCharacters, setProjectCharacters] = useState<any[]>([]);
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [customCharName, setCustomCharName] = useState('');
  const [isAnalyzingAssets, setIsAnalyzingAssets] = useState(false);

  // Copilot Advanced States
  const [structure, setStructure] = useState('3-Act Structure (Cấu trúc 3 hồi)');
  const [pacing, setPacing] = useState('Balanced (Cân bằng & Nhịp nhàng)');
  const [bridgeRule, setBridgeRule] = useState('Strictly Continuous (Khớp hành động & Liên tục tuyệt đối - Action Match, Eyeline Match)');
  const [visualDirectives, setVisualDirectives] = useState('');
  const [forceScaleRules, setForceScaleRules] = useState(true);

  // Import Shotlist Tab States
  const [importActiveTab, setImportActiveTab] = useState<'file' | 'text'>('file');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importRawText, setImportRawText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [importDragOver, setImportDragOver] = useState(false);
  const [importSelectedWorldId, setImportSelectedWorldId] = useState<string>('');
  const [promptTemplateText, setPromptTemplateText] = useState('');
  const [isLoadingImportProjects, setIsLoadingImportProjects] = useState(false);

  const importFileInputRef = useRef<HTMLInputElement>(null);
  const templateFileInputRef = useRef<HTMLInputElement>(null);

  // Fetch projects for import tab
  useEffect(() => {
    if (editorMode === 'import') {
      const fetchProjects = async () => {
        setIsLoadingImportProjects(true);
        setProjectsLoadError(null);
        try {
          const baseUrl = getApiBaseUrl();
          const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
          const apiConfig = { headers: { 'Authorization': `Bearer ${HUB_API_KEY}` } };
          
          if (!HUB_API_KEY) {
            setProjectsLoadError("Chưa cấu hình Hub Token. Sếp vui lòng nhập token ở góc trên bên phải hoặc vào AI Settings.");
            setIsLoadingImportProjects(false);
            return;
          }

          try {
            const list = await coreRequest('/world-asset/projects');
            setProjects(list || []);
            if (list && list.length > 0) {
              const activeId = projectData.selectedProjectId || projectData.selectedUniverseId || list[0].id;
              setImportSelectedWorldId(activeId);
            }
          } catch(err: any) { 
            setProjectsLoadError(`Lỗi máy chủ: ${err.message || err.data?.message || err}`);
          }
        } catch (err: any) {
          setProjectsLoadError(`Lỗi kết nối mạng: ${err.message || err}`);
          console.error("Lỗi tải dự án import:", err);
        } finally {
          setIsLoadingImportProjects(false);
        }
      };
      fetchProjects();
    }
  }, [editorMode, projectRefreshTrigger, hubApiKey, projectData.selectedProjectId, projectData.selectedUniverseId]);

  useEffect(() => {
    if (editorMode === 'import' && projects.length > 0 && !importSelectedWorldId) {
      const activeId = projectData.selectedProjectId || projectData.selectedUniverseId || projects[0].id;
      setImportSelectedWorldId(activeId);
    }
  }, [editorMode, projects, importSelectedWorldId, projectData]);

  const validateAndSetImportFile = (selectedFile: File) => {
    setImportError(null);
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext === 'docx' || ext === 'txt') {
      setImportFile(selectedFile);
    } else {
      setImportError('Định dạng tệp không hỗ trợ. Vui lòng chọn tệp Word (.docx) hoặc Văn bản (.txt).');
      setImportFile(null);
    }
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        setPromptTemplateText(event.target?.result as string || '');
        alert(`📂 Đã nạp file template: ${selectedFile.name}`);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImportShotlist = async () => {
    let uploadFile = importFile;

    if (importActiveTab === 'text') {
      if (!importRawText.trim()) {
        setImportError('Vui lòng nhập hoặc dán kịch bản shotlist.');
        return;
      }
      uploadFile = new File([importRawText], 'pasted_shotlist.txt', { type: 'text/plain' });
    }

    if (!uploadFile) {
      setImportError('Vui lòng chọn tệp Shotlist hoặc dán văn bản.');
      return;
    }

    if (!importSelectedWorldId) {
      setImportError('Vui lòng chọn một Dự án World Asset.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('projectId', importSelectedWorldId);
    formData.append('title', uploadFile.name.replace(/\.[^/.]+$/, ""));

    const baseUrl = getApiBaseUrl();
    const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
    const headers: Record<string, string> = {};
    if (HUB_API_KEY) {
      headers['Authorization'] = `Bearer ${HUB_API_KEY}`;
    }

    try {
      const res = await fetch(`${baseUrl}/api/world-asset/episodes/import-shotlist`, {
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
        throw new Error('Dữ liệu trả về bị thiếu thông tin Episode.');
      }

      setImportSuccess(true);
      
      // Update selectedProjectId into store
      useFlowStore.getState().setProjectData({
        ...projectData,
        selectedProjectId: importSelectedWorldId,
        selectedUniverseId: importSelectedWorldId,
        name: projectData.name === 'Untitled Storyboard Project' ? resData.episode.title : projectData.name
      });

      // Parse Prompt Template if exists
      if (promptTemplateText.trim()) {
        const lines = promptTemplateText.split('\n');
        const newProjectData = { 
          ...useFlowStore.getState().projectData, 
          selectedProjectId: importSelectedWorldId, 
          selectedUniverseId: importSelectedWorldId 
        };
        let hasKey = false;
        
        lines.forEach(line => {
          const parts = line.split(':');
          if (parts.length >= 2) {
            const key = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(':').trim();
            if (key === 'style' || key === 'style prompt' || key === 'visual style' || key === 'art style' || key === 'visual') {
              newProjectData.stylePrompt = value;
              hasKey = true;
            } else if (key === 'aspect ratio' || key === 'aspect' || key === 'ratio') {
              if (value.includes('16:9')) newProjectData.aspectRatio = '16:9';
              else if (value.includes('9:16')) newProjectData.aspectRatio = '9:16';
              else if (value.includes('1:1')) newProjectData.aspectRatio = '1:1';
              hasKey = true;
            } else if (key === 'dialogue' || key === 'dialogue mode') {
              if (value.toLowerCase().includes('sync')) newProjectData.dialogueMode = 'post-sync';
              else if (value.toLowerCase().includes('speech') || value.toLowerCase().includes('ai')) newProjectData.dialogueMode = 'ai-speech';
              else if (value.toLowerCase().includes('silent')) newProjectData.dialogueMode = 'silent';
              hasKey = true;
            } else if (key === 'runtime' || key === 'duration') {
              const num = parseInt(value);
              if (!isNaN(num)) newProjectData.targetRuntime = num;
              hasKey = true;
            } else if (key === 'max shot' || key === 'max shots' || key === 'max_shots') {
              const num = parseInt(value);
              if (!isNaN(num)) newProjectData.maxShotCount = num;
              hasKey = true;
            }
          }
        });

        if (!hasKey && promptTemplateText.trim().length > 10) {
          newProjectData.stylePrompt = promptTemplateText.trim();
        }

        useFlowStore.getState().setProjectData(newProjectData);
      }

      // Reconstruct graph on canvas
      if (onImportEpisode) {
        await onImportEpisode(resData.episode);
      }

      setTimeout(() => {
        setImportSuccess(false);
        setEditorMode('editor');
        setEditorText(resData.episode.script || resData.episode.scriptText || "");
      }, 1500);

    } catch (err: any) {
      console.error('[Import Shotlist] Upload failed:', err);
      setImportError(err.message || 'Có lỗi xảy ra khi xử lý dữ liệu.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleAnalyzeAssets = async () => {
    const activeProjId = projectData.selectedProjectId || projectData.selectedUniverseId;
    if (!activeProjId || activeProjId === 'new' || activeProjId === 'undefined') {
      alert("⚠️ Vui lòng liên kết dự án World Asset trên thanh công cụ trước khi thực hiện phân tích!");
      return;
    }

    setIsAnalyzingAssets(true);
    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      // 1. Tải danh sách assets thực tế từ World DB
      const res = await fetch(`${baseUrl}/api/world-asset/characters?projectId=${activeProjId}`, {
        headers: { 'Authorization': `Bearer ${HUB_API_KEY}` }
      });
      if (!res.ok) throw new Error("Không thể tải danh sách Asset từ World DB");
      const dbChars = await res.json();

      // Helper lấy mediaId
      const getMediaId = (dbItem: any) => {
        try {
          const sg = typeof dbItem.styleGuide === 'string' ? JSON.parse(dbItem.styleGuide) : dbItem.styleGuide;
          if (sg?.gflowMediaIds?.[projectData.id]) {
            return sg.gflowMediaIds[projectData.id];
          } else if (sg?.gflowMediaId) {
            return sg.gflowMediaId;
          }
        } catch (e) {}
        return undefined;
      };

      // 2. Phân tích văn bản của từng shot để gán nhân vật, bối cảnh và đạo cụ khớp
      const currentShots = useFlowStore.getState().pendingShots || [];
      const enrichedShots = hydrateShotsWithUniverseAssets(currentShots, dbChars, projectData.id, parsedData?.scenes);

      const detectedCharNames = new Set<string>();
      const detectedLocNames = new Set<string>();
      const detectedPropNames = new Set<string>();

      enrichedShots.forEach((sh: any) => {
        if (sh.character_refs) sh.character_refs.forEach((c: string) => detectedCharNames.add(c));
        if (sh.location) detectedLocNames.add(sh.location);
        if (sh.prop_refs) sh.prop_refs.forEach((p: string) => detectedPropNames.add(p));
      });

      if (parsedData?.props && Array.isArray(parsedData.props)) {
        parsedData.props.forEach((p: any) => {
          const nameStr = typeof p === 'string' ? p : (p.name || String(p));
          if (nameStr.trim()) detectedPropNames.add(nameStr.trim());
        });
      }

      // 3. Tạo danh sách các Characters & Locations & Props đã làm giàu (enrich) để hiển thị trên cast/overview
      const enrichedChars = Array.from(detectedCharNames).map(name => {
        const dbMatch = dbChars.find((c: any) => (c.entityType === 'character' || !c.entityType) && c.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Nhân vật khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'character_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Nhân vật phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'character_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const enrichedLocs = Array.from(detectedLocNames).map(name => {
        const dbMatch = dbChars.find((c: any) => c.entityType === 'location' && c.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Bối cảnh khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'location_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Bối cảnh phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'location_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      const enrichedProps = Array.from(detectedPropNames).map(name => {
        const dbMatch = dbChars.find((c: any) => c.entityType === 'prop' && c.name.toLowerCase().trim() === name.toLowerCase().trim());
        if (dbMatch) {
          let dbAliases = '';
          try {
            const sg = typeof dbMatch.styleGuide === 'string' ? JSON.parse(dbMatch.styleGuide) : dbMatch.styleGuide;
            dbAliases = sg?.aliases || '';
          } catch(e){}
          return {
            name: dbMatch.name,
            description: dbMatch.description || 'Đạo cụ khớp từ World DB.',
            imageUrl: dbMatch.rootImageUrl || '',
            worldAssetCharId: dbMatch.id,
            worldAssetCharName: dbMatch.name,
            mediaId: getMediaId(dbMatch),
            renderMode: 'prop_only',
            gridFormat: '2x2',
            aliases: dbAliases
          };
        }
        return {
          name: name,
          description: 'Đạo cụ phát hiện từ kịch bản.',
          imageUrl: '',
          worldAssetCharId: undefined,
          worldAssetCharName: name,
          mediaId: '',
          renderMode: 'prop_only',
          gridFormat: '2x2',
          aliases: ''
        };
      }).filter(Boolean) as any[];

      // 4. Đồng bộ dữ liệu nodes trên canvas (cập nhật worldAssetNode)
      const setNodes = useFlowStore.getState().setNodes;
      setNodes(nds => nds.map(n => {
        if (n.type === 'worldAssetNode') {
          return {
            ...n,
            data: {
              ...n.data,
              characters: enrichedChars,
              locations: enrichedLocs,
              props: enrichedProps
            }
          };
        }
        return n;
      }));

      // 5. Lưu lại store
      useFlowStore.getState().setPendingShots(enrichedShots);
      useFlowStore.getState().setParsedData({
        ...parsedData,
        characters: enrichedChars,
        locations: enrichedLocs,
        props: enrichedProps,
        scenes: parsedData?.scenes || [],
        scriptText: parsedData?.scriptText || "",
        isImported: true,
        shots: enrichedShots
      });

      // Báo sự kiện thay đổi asset
      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));

      alert(`✅ Đã phân tích kịch bản và tự động gắn asset thành công cho ${enrichedShots.length} shots! (Phát hiện ${enrichedChars.length} nhân vật, ${enrichedLocs.length} bối cảnh & ${enrichedProps.length} đạo cụ).`);
    } catch (err: any) {
      alert("❌ Lỗi khi phân tích asset: " + err.message);
    } finally {
      setIsAnalyzingAssets(false);
    }
  };

  const setEditorText = (text: string) => {
    if (!editorRef.current) return;
    const htmlFormatted = text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<div><br></div>';
      
      // Scene Headings (INT. / EXT.)
      if (trimmed.match(/^(INT\.|EXT\.)/i)) {
        return `<div style="font-weight: bold; color: #34d399; margin-top: 15px;">${trimmed}</div>`;
      }
      // Transitions
      if (trimmed.match(/^(CUT TO:|FADE IN:|FADE OUT\.|FADE TO BLACK\.)/i)) {
        return `<div style="font-weight: bold; color: #fb923c; text-align: right; margin-top: 15px;">${trimmed}</div>`;
      }
      // Parentheticals (Emotion)
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        return `<div style="font-style: italic; color: #94a3b8; text-align: center;">${trimmed}</div>`;
      }
      // Character Names
      if (trimmed.match(/^([A-Z0-9\s]+)$/) && trimmed.length > 1 && trimmed.length < 30) {
        return `<div style="font-weight: bold; color: #a855f7; text-align: center; margin-top: 10px;">${trimmed}</div>`;
      }
      
      return `<div>${trimmed}</div>`;
    }).join('');
    
    editorRef.current.innerHTML = htmlFormatted;
  };

  // Load Projects on expand
  const handleToggleDbSelector = async () => {
    const nextState = !isDbSelectorOpen;
    setIsDbSelectorOpen(nextState);
    if (nextState) {
      if (projects.length === 0) {
        setIsLoadingDb(true);
        try {
          const baseUrl = getApiBaseUrl();
          const res = await fetch(`${baseUrl}/api/world-asset/projects`);
          if (res.ok) {
            const list = await res.json();
            setProjects(list || []);
            if (list && list.length > 0) {
              setSelectedProjectId(list[0].id);
            }
          }
        } catch (err) {
          console.error("Lỗi fetch projects:", err);
        } finally {
          setIsLoadingDb(false);
        }
      } else if (!selectedProjectId) {
        setSelectedProjectId(projects[0].id);
      }
    }
  };

  // Load Episodes when selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) return;
    const loadEpisodes = async () => {
      setIsLoadingDb(true);
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/world-asset/episodes?projectId=${selectedProjectId}`);
        if (res.ok) {
          const list = await res.json();
          setEpisodes(list || []);
          if (list && list.length > 0) {
            setSelectedEpisodeId(list[0].id);
          } else {
            setSelectedEpisodeId('');
          }
        }
      } catch (err) {
        console.error("Lỗi fetch episodes:", err);
      } finally {
        setIsLoadingDb(false);
      }
    };
    loadEpisodes();
  }, [selectedProjectId]);

  // Load Script Content from Selected Episode
  const handleLoadDbScript = async () => {
    if (!selectedEpisodeId) return;
    setIsLoadingDb(true);
    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const res = await fetch(`${baseUrl}/api/world-asset/episodes/${selectedEpisodeId}/storyboard-assets`, {
        headers: {
          'Authorization': `Bearer ${HUB_API_KEY}`
        }
      });
      
      if (res.ok) {
        const detail = await res.json();
        const ep = detail.episode;
        if (ep) {
          const scriptContent = ep.script || ep.scriptText;
          if (scriptContent) {
            setEditorText(scriptContent);
            // Automatically restore the entire flow control graph and nodes on canvas!
            if (onImportEpisode) {
              console.log(`[ScriptEditor] Automatically triggering graph reconstruction for episode "${ep.title}"...`);
              await onImportEpisode(ep);
            }
            alert(`✅ Đã đồng bộ kịch bản và khôi phục toàn bộ sơ đồ phân cảnh "${ep.title}" thành công!`);
          } else {
            alert("⚠️ Kịch bản này không có nội dung chữ (script / scriptText)!");
          }
        } else {
          alert("⚠️ Không tìm thấy dữ liệu chi tiết của episode trong response!");
        }
      } else {
        alert(`⚠️ Không thể lấy thông tin chi tiết kịch bản: ${res.statusText}`);
      }
    } catch (err: any) {
      console.error("Lỗi đồng bộ kịch bản:", err);
      alert(`⚠️ Lỗi đồng bộ kịch bản: ${err.message}`);
    } finally {
      setIsLoadingDb(false);
    }
  };

  const defaultHtml = ``;

  useEffect(() => {
    if (editorRef.current) {
      if (externalScript) {
        // Auto-Highlight chuẩn Hollywood Screenplay
        const htmlFormatted = externalScript.split('\n').map(line => {
          const trimmed = line.trim();
          if (!trimmed) return '<div><br></div>';
          
          // Scene Headings (INT. / EXT.)
          if (trimmed.match(/^(INT\.|EXT\.)/i)) {
            return `<div style="font-weight: bold; color: #34d399; margin-top: 15px;">${trimmed}</div>`;
          }
          // Transitions
          if (trimmed.match(/^(CUT TO:|FADE IN:|FADE OUT\.|FADE TO BLACK\.)/i)) {
            return `<div style="font-weight: bold; color: #fb923c; text-align: right; margin-top: 15px;">${trimmed}</div>`;
          }
          // Parentheticals (Emotion)
          if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
            return `<div style="font-style: italic; color: #94a3b8; text-align: center;">${trimmed}</div>`;
          }
          // Character Names (All caps, no punctuation, short)
          if (trimmed.match(/^([A-Z0-9\s]+)$/) && trimmed.length > 1 && trimmed.length < 30) {
            return `<div style="font-weight: bold; color: #a855f7; text-align: center; margin-top: 10px;">${trimmed}</div>`;
          }
          
          // Action lines & Dialog text
          return `<div>${trimmed}</div>`;
        }).join('');
        
        editorRef.current.innerHTML = htmlFormatted;
      } else {
        // Chỉ gán mặc định nếu rỗng
        if (!editorRef.current.innerHTML.trim()) {
           editorRef.current.innerHTML = defaultHtml;
        }
      }
    }
  }, [externalScript]);

  const insertTemplate = (type: 'title' | 'scene' | 'dialog' | 'transition' | 'character' | 'location') => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    
    let html = '';
    
    if (selectedText) {
      // Chế độ bọc text bôi đen
      switch(type) {
        case 'title':
          html = `<span style="font-weight: bold; color: white;">[TITLE: ${selectedText}]</span>`;
          break;
        case 'scene':
          html = `<span style="font-weight: bold; color: #34d399;">[SCENE: ${selectedText}]</span>`;
          break;
        case 'dialog':
          html = `<span style="font-style: italic; color: #60a5fa;">[DIALOG: ${selectedText}]</span>`;
          break;
        case 'transition':
          html = `<span style="font-weight: bold; color: #fb923c;">[TRANSITION: ${selectedText}]</span>`;
          break;
        case 'character':
          html = `<span style="font-weight: bold; color: #a855f7;">[CHARACTER: ${selectedText}]</span>`;
          break;
        case 'location':
          html = `<span style="font-weight: bold; color: #f43f5e;">[LOCATION: ${selectedText}]</span>`;
          break;
      }
    } else {
      // Chế độ chèn template rỗng như cũ
      switch(type) {
        case 'title':
          html = '<div style="text-align: center; font-weight: bold; text-transform: uppercase; color: white; padding: 15px 0 5px 0;">[ TITLE HERE ]</div><div><br></div>';
          break;
        case 'scene':
          html = '<div><br></div><div style="font-weight: bold; text-transform: uppercase; color: #34d399;">INT. SCENE LOCATION - DAY</div><div><br></div>';
          break;
        case 'dialog':
          html = '<div><br></div><div style="text-align: center; font-weight: bold; text-transform: uppercase; color: white;">CHARACTER NAME</div><div style="text-align: center; padding: 0 15%; font-style: italic; color: #94a3b8;">(Emotion)</div><div style="text-align: center; padding: 0 15%; color: #60a5fa;">Dialog text goes here...</div><div><br></div>';
          break;
        case 'transition':
          html = '<div><br></div><div style="text-align: right; font-weight: bold; text-transform: uppercase; color: #fb923c; padding-right: 5%;">CUT TO:</div><div><br></div>';
          break;
        case 'character':
          html = '<span style="font-weight: bold; color: #a855f7;">[CHARACTER NAME]</span>';
          break;
        case 'location':
          html = '<span style="font-weight: bold; color: #f43f5e;">[LOCATION NAME]</span>';
          break;
      }
    }
    
    document.execCommand('insertHTML', false, html);
  };

  const handleAnalyzeClick = () => {
    if (editorRef.current) {
      onAnalyze(editorRef.current.innerText);
    }
  };

  // Fetch characters of selectedProjectId
  useEffect(() => {
    if (!selectedProjectId) return;
    const loadCharacters = async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const res = await fetch(`${baseUrl}/api/world-asset/characters?projectId=${selectedProjectId}`, {
          headers: {
            'Authorization': `Bearer ${HUB_API_KEY}`
          }
        });
        if (res.ok) {
          const list = await res.json();
          setProjectCharacters(list || []);
          setSelectedChars((list || []).map((c: any) => c.name));
        }
      } catch (err) {
        console.error("Lỗi fetch characters:", err);
      }
    };
    loadCharacters();
  }, [selectedProjectId]);

  const handleToggleCharacter = (name: string) => {
    if (selectedChars.includes(name)) {
      setSelectedChars(selectedChars.filter(n => n !== name));
    } else {
      setSelectedChars([...selectedChars, name]);
    }
  };

  const handleAddCustomCharacter = () => {
    if (!customCharName.trim()) return;
    const name = customCharName.trim();
    if (!projectCharacters.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setProjectCharacters([...projectCharacters, { id: 'custom-' + Date.now(), name }]);
    }
    if (!selectedChars.includes(name)) {
      setSelectedChars([...selectedChars, name]);
    }
    setCustomCharName('');
  };

  const handleCompileScreenplay = async () => {
    if (!premise.trim()) return;
    setIsCompiling(true);
    setCompilationStatus('Khởi tạo kết nối...');

    let secondsTimer: any = null;
    let pollTimer: any = null;

    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      const targetWorldId = selectedProjectId || projectData.selectedProjectId || projectData.selectedUniverseId;

      const response = await fetch(`${baseUrl}/api/media/copilot-agentic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${HUB_API_KEY}`
        },
        body: JSON.stringify({
          premise,
          projectId: targetWorldId,
          structure,
          pacing,
          config: {
            async: true,
            forceScaleRules
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const resJson = await response.json();
      if (resJson.status !== 'success' || !resJson.data || (!resJson.data.job_id && !resJson.data.jobId)) {
        throw new Error(resJson.message || 'Yêu cầu không thành công hoặc không nhận được Job ID.');
      }

      const jobId = resJson.data.job_id || resJson.data.jobId;

      let elapsedSeconds = 0;
      setCompilationStatus(`Biên kịch đang xử lý qua Multi-Agent... (0 giây)`);
      secondsTimer = setInterval(() => {
        elapsedSeconds += 1;
        setCompilationStatus(`Biên kịch đang xử lý qua Multi-Agent... (${elapsedSeconds} giây)`);
      }, 1000);

      const jobData = await new Promise<any>((resolve, reject) => {
        pollTimer = setInterval(async () => {
          try {
            const statusRes = await fetch(`${baseUrl}/api/media/status/${jobId}`, {
              headers: {
                'Authorization': `Bearer ${HUB_API_KEY}`
              }
            });
            if (!statusRes.ok) {
              console.warn(`Lỗi check status (sẽ thử lại): ${statusRes.status}`);
              return;
            }
            const statusJson = await statusRes.json();
            const jobData = statusJson.data || statusJson;
            const currentStatus = jobData.status || jobData.state;

            if (currentStatus === 'COMPLETED') {
              clearInterval(pollTimer);
              resolve(jobData);
            } else if (currentStatus === 'FAILED' || currentStatus === 'ERROR') {
              clearInterval(pollTimer);
              console.error("Multi-Agent Job Failed. Full jobData:", jobData);
              
              // Trích xuất mọi trường lỗi tiềm năng từ backend
              const detailErr = jobData.error_message || 
                                jobData.errorMessage || 
                                jobData.error || 
                                jobData.message || 
                                jobData.reason || 
                                (jobData.details ? (typeof jobData.details === 'string' ? jobData.details : JSON.stringify(jobData.details)) : '') || 
                                'Không rõ nguyên nhân cụ thể (vui lòng kiểm tra log backend trên storymee-pc)';
                                
              reject(new Error(`Tiến trình Multi-Agent thất bại. Chi tiết lỗi từ Backend: ${detailErr}`));
            }
          } catch (err) {
            console.error("Lỗi trong quá trình polling status:", err);
          }
        }, 3000);
      });

      if (secondsTimer) {
        clearInterval(secondsTimer);
        secondsTimer = null;
      }

      // 1. Tìm nguồn dữ liệu kịch bản từ các trường tiềm năng
      let rawOutput = jobData.output_url || jobData.outputUrls || jobData.result || jobData.output || jobData.output_file || jobData.outputFile;
      if (!rawOutput) {
        console.error("Job completed but output fields are empty. jobData:", jobData);
        throw new Error('Không tìm thấy dữ liệu kịch bản (output_url/result) trong kết quả hoàn thành.');
      }

      let resultObj: any = null;

      // Unwrap nếu dữ liệu trả về nằm trong mảng
      if (Array.isArray(rawOutput)) {
        if (rawOutput.length === 0) {
          throw new Error('Mảng dữ liệu kết quả kịch bản bị rỗng.');
        }
        rawOutput = rawOutput[0];
      }

      // Xử lý dữ liệu sau khi đã unwrap mảng (hoặc ban đầu là dạng đơn lẻ)
      if (typeof rawOutput === 'string') {
        const cleaned = rawOutput.trim();
        // Nếu là URL, tiến hành fetch nội dung JSON về
        if (cleaned.startsWith('http://') || cleaned.startsWith('https://') || cleaned.startsWith('/')) {
          setCompilationStatus('Đang tải dữ liệu kịch bản chi tiết...');
          try {
            const fetchRes = await fetch(cleaned);
            if (!fetchRes.ok) {
              throw new Error(`Không thể fetch kịch bản từ URL: ${cleaned} (Status: ${fetchRes.status})`);
            }
            resultObj = await fetchRes.json();
          } catch (fetchErr: any) {
            throw new Error(`Lỗi khi tải file kịch bản từ backend: ${fetchErr.message || fetchErr}`);
          }
        } else {
          // Thử parse nếu là chuỗi JSON string
          try {
            resultObj = JSON.parse(cleaned);
          } catch (e) {
            throw new Error('Dữ liệu kịch bản trả về dạng text không phải JSON hợp lệ.');
          }
        }
      } else if (typeof rawOutput === 'object' && rawOutput !== null) {
        resultObj = rawOutput;
      }

      if (!resultObj) {
        throw new Error('Không thể phân tích dữ liệu kịch bản từ kết quả hoàn thành.');
      }

      // Đảm bảo dữ liệu kịch bản có các trường cơ bản, hỗ trợ nếu bị bọc thêm một lớp
      if (!resultObj.scenes || !resultObj.shots) {
        const innerObj = resultObj.data || resultObj.result || resultObj.script;
        if (innerObj && innerObj.scenes && innerObj.shots) {
          resultObj = innerObj;
        } else {
          throw new Error('Dữ liệu kịch bản thiếu các trường scenes hoặc shots bắt buộc.');
        }
      }

      setEditorText(resultObj.rawScript || resultObj.scriptText || '');
      await handleImportGeneratedShotlist(resultObj, targetWorldId);

      setEditorMode('editor');
      alert("🎉 Biên kịch kịch bản thành công! Đã tự động chia khung hình (shots). Vui lòng kiểm tra và xác nhận ở Bảng Phân Chia Phân Cảnh.");
    } catch (error: any) {
      console.error("Lỗi compile kịch bản:", error);
      alert(`⚠️ Lỗi khi biên kịch kịch bản AI: ${error.message || error}`);
    } finally {
      if (secondsTimer) clearInterval(secondsTimer);
      if (pollTimer) clearInterval(pollTimer);
      setIsCompiling(false);
      setCompilationStatus('');
    }
  };

  return (
    <div className="w-[350px] border-r border-slate-800 bg-[#16161a] flex flex-col h-full shadow-2xl z-20 transition-all font-sans">
      <div className="p-4 border-b border-slate-800 bg-[#1e1e24] flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <FileText size={18} />
          <h2 className="font-bold text-sm tracking-wide">Script Editor</h2>
        </div>
      </div>

      {/* Bước 1: Chọn Profile Preset Dự Án */}
      <div className="p-3 bg-[#1e1e24]/40 border-b border-slate-800 space-y-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Bước 1</span>
          <span className="text-[11px] font-bold text-slate-300">Cấu hình Profile Preset Dự Án</span>
        </div>
        <select
          value={projectData.shotlistPreset || 'universal_cinematic'}
          onChange={async (e) => {
            const newPreset = e.target.value as any;
            const updatedProj = { ...projectData, shotlistPreset: newPreset };
            setProjectData(updatedProj);
            const activeId = projectData.selectedProjectId || projectData.selectedUniverseId;
            if (activeId && activeId !== 'new') {
              try {
                const baseUrl = getApiBaseUrl();
                const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
                
                // Fetch existing details
                const getRes = await fetch(`${baseUrl}/api/world-asset/projects/${activeId}`, {
                  headers: { 'Authorization': `Bearer ${HUB_API_KEY}` }
                });
                if (getRes.ok) {
                  const proj = await getRes.json();
                  let existingMeta: any = {};
                  if (proj.description && proj.description.trim().startsWith("{")) {
                    try {
                      existingMeta = JSON.parse(proj.description);
                    } catch (e) {}
                  }
                  
                  const payload = {
                    name: proj.name,
                    description: JSON.stringify({
                      ...existingMeta,
                      gflowProjectId: projectData.id,
                      shotlistPreset: newPreset
                    }),
                    stylePrompt: projectData.stylePrompt || proj.stylePrompt || ''
                  };

                  await fetch(`${baseUrl}/api/world-asset/projects/${activeId}`, {
                    method: 'PUT',
                    headers: { 
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${HUB_API_KEY}`
                    },
                    body: JSON.stringify(payload)
                  });
                  console.log(`[ScriptEditor] Synced preset ${newPreset} to project ${activeId}`);
                }
              } catch (err) {
                console.error("[ScriptEditor] Failed to sync project settings:", err);
              }
            }
          }}
          className="w-full bg-[#0a0a0d] border border-slate-800 rounded-lg p-2 text-xs text-white outline-none focus:border-indigo-500/50 cursor-pointer font-bold transition-all hover:border-slate-700"
        >
          <option value="universal_cinematic">🎬 Universal Cinematic (Tiêu chuẩn)</option>
          <option value="paco_production">🐥 Paco Show and Tell (Sản xuất hoạt hình)</option>
        </select>
      </div>

      {/* Bước 2: Chọn Phương Thức Nhập Liệu */}
      <div className="px-3 pt-3 bg-[#16161a] shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded">Bước 2</span>
          <span className="text-[11px] font-bold text-slate-350">Chọn Phương Thức Nhập Liệu</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 bg-[#16161a] px-2 gap-1 pt-1 shrink-0">
        <button
          onClick={() => setEditorMode('editor')}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border-b-2 outline-none whitespace-nowrap ${
            editorMode === 'editor'
              ? 'border-indigo-500 text-white bg-[#111114]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText size={12} className="flex-shrink-0" />
          <span>Biên kịch</span>
        </button>
        <button
          onClick={() => setEditorMode('copilot')}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border-b-2 outline-none whitespace-nowrap ${
            editorMode === 'copilot'
              ? 'border-indigo-500 text-white bg-[#111114]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Wand2 size={12} className="flex-shrink-0" />
          <span>AI Co-Pilot</span>
        </button>
        <button
          onClick={() => setEditorMode('import')}
          className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all border-b-2 outline-none whitespace-nowrap ${
            editorMode === 'import'
              ? 'border-indigo-500 text-white bg-[#111114]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload size={12} className="flex-shrink-0" />
          <span>Import</span>
        </button>
      </div>

      {editorMode === 'copilot' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111114]">
          {/* Premise input */}
          <div className="space-y-1">
            <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
              <span>💡 Ý tưởng kịch bản (Premise)</span>
              <span className="text-slate-500 font-normal lowercase">(Bắt buộc)</span>
            </label>
            <textarea
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="Ví dụ: Kilo bị mất tích bí ẩn tại thị trấn Sương Mù. Bruno tìm thấy chiếc nơ cổ của Kilo gần phòng thí nghiệm của bác học điên Wolfie..."
              className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/50 min-h-[100px] resize-none leading-relaxed"
            />
          </div>

          {/* Character selection chips */}
          <div className="space-y-2">
            <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
              👤 Nhân vật tham gia (Cast List)
            </label>
            {projectCharacters.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto bg-slate-950/40 p-2 rounded-lg border border-slate-900 animate-fade-in">
                {projectCharacters.map((char) => {
                  const isSelected = selectedChars.includes(char.name);
                  return (
                    <button
                      key={char.id || char.name}
                      onClick={() => handleToggleCharacter(char.name)}
                      className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                        isSelected
                          ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300'
                          : 'bg-[#1a1a1f] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-350'
                      }`}
                    >
                      {char.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[9px] text-slate-500 italic block">
                Chưa có nhân vật nào trong Universe. Hãy thêm nhân vật tùy chỉnh dưới đây.
              </span>
            )}
            
            {/* Custom character input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customCharName}
                onChange={(e) => setCustomCharName(e.target.value)}
                placeholder="Nhân vật mới..."
                className="flex-1 bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-indigo-500/50"
              />
              <button
                onClick={handleAddCustomCharacter}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg border border-slate-700 active:scale-95 transition-all"
              >
                +
              </button>
            </div>
          </div>

          {/* Time settings */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                ⏱️ Tổng thời lượng
              </label>
              <select
                value={totalDur}
                onChange={(e) => setTotalDur(parseInt(e.target.value))}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                <option value="60">60 giây (1 Phút)</option>
                <option value="120">120 giây (2 Phút)</option>
                <option value="180">180 giây (3 Phút)</option>
                <option value="300">300 giây (5 Phút)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                📸 Thời lượng Shot
              </label>
              <select
                value={avgShotDur}
                onChange={(e) => setAvgShotDur(parseInt(e.target.value))}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
              >
                <option value="3">3 giây / shot</option>
                <option value="4">4 giây / shot (Chuẩn)</option>
                <option value="5">5 giây / shot</option>
                <option value="6">6 giây / shot</option>
              </select>
            </div>
          </div>

          {/* Dramatic Presets */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                🎭 Tông màu cảm xúc (Mood Preset)
              </label>
              <select
                value={emotion}
                onChange={(e) => setEmotion(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="Hồi hộp & Trinh thám (Suspense & Mystery)">Hồi hộp & Trinh thám (Suspense)</option>
                <option value="Hài hước & Nhí nhảnh (Comedy & Playful)">Hài hước & Nhí nhảnh (Comedy)</option>
                <option value="Kịch tính & Cảm xúc (Emotional Drama)">Kịch tính & Cảm xúc (Emotional)</option>
                <option value="Hành động kịch tính (High-octane Action)">Hành động kịch tính (Action)</option>
                <option value="Bình yên & Khám phá (Adventure & Wonder)">Bình yên & Khám phá (Adventure)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                🔀 Nút thắt kịch bản (Plot Twist Preset)
              </label>
              <select
                value={twist}
                onChange={(e) => setTwist(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="Không có nút thắt (None)">Không có nút thắt (None)</option>
                <option value="Kẻ phản diện quay xe / Hóa giải hiểu lầm (Villain redemption)">Kẻ phản diện quay xe / Hóa giải hiểu lầm</option>
                <option value="Danh tính bất ngờ / Đồng minh phản bội (Ally is betrayer)">Danh tính bất ngờ / Đồng minh phản bội</option>
                <option value="Kết mở / Gợi ý phần tiếp theo (Cliffhanger ending)">Kết mở / Gợi ý phần tiếp theo (Cliffhanger)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                🪝 Giữ chân người xem (Hook & Retention)
              </label>
              <select
                value={retention}
                onChange={(e) => setRetention(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="Mở đầu kịch tính (Cold Open)">Mở đầu kịch tính (Cold Open)</option>
                <option value="Câu hỏi gợi tò mò (Intriguing Question)">Câu hỏi gợi tò mò (Intriguing Question)</option>
                <option value="Hành động ngay lập tức (In-media-res)">Hành động ngay lập tức (In-media-res)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                📐 Cấu trúc kể chuyện (Story Structure)
              </label>
              <select
                value={structure}
                onChange={(e) => setStructure(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="3-Act Structure (Cấu trúc 3 hồi)">3-Act Structure</option>
                <option value="Hero's Journey (Hành trình người hùng)">Hero's Journey</option>
                <option value="Kishōtenketsu (Cấu trúc Khởi-Thừa-Chuyển-Hợp)">Kishōtenketsu</option>
                <option value="In Media Res (Bắt đầu từ giữa truyện)">In Media Res</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                ⚡ Nhịp độ kể chuyện (Pacing)
              </label>
              <select
                value={pacing}
                onChange={(e) => setPacing(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="Balanced (Cân bằng & Nhịp nhàng)">Balanced</option>
                <option value="Fast-paced (Nhanh & Dồn dập)">Fast-paced</option>
                <option value="Slow-burn (Chậm rãi & Sâu lắng)">Slow-burn</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                🔗 Quy tắc liên tục / Chuyển cảnh (Continuity Style)
              </label>
              <select
                value={bridgeRule}
                onChange={(e) => setBridgeRule(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 outline-none"
              >
                <option value="Strictly Continuous (Khớp hành động & Liên tục tuyệt đối - Action Match, Eyeline Match)">Strictly Continuous</option>
                <option value="Dramatic & Impactful (Kịch tính & Ấn tượng)">Dramatic & Impactful</option>
                <option value="Fluid & Atmospheric (Mượt mà & Cảm xúc)">Fluid & Atmospheric</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">
                🎬 Chỉ dẫn đạo diễn bổ sung (Director's Visual Directives)
              </label>
              <textarea
                value={visualDirectives}
                onChange={(e) => setVisualDirectives(e.target.value)}
                placeholder="Nhập chỉ dẫn tự do (ví dụ: góc quay thấp từ dưới lên, chuyển cảnh Match Cut đỏ...)"
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500/50 min-h-[80px] resize-none leading-relaxed"
              />
            </div>
            
            {/* Force Scale Rules Toggle */}
            <div className="flex items-center justify-between p-2.5 bg-indigo-950/20 border border-indigo-900/30 rounded-lg mt-3 text-left">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-indigo-300">Khóa tỷ lệ nhân vật (Letta Scale Rules)</span>
                <span className="text-[8px] text-slate-500 mt-0.5">Tự động sửa prompt theo tỷ lệ chiều cao chuẩn trong World DNA</span>
              </div>
              <input
                type="checkbox"
                checked={forceScaleRules}
                onChange={(e) => setForceScaleRules(e.target.checked)}
                className="w-4 h-4 accent-indigo-500 rounded bg-[#1a1a1f] border-slate-800 cursor-pointer"
              />
            </div>
          </div>

          {/* Compilation Trigger */}
          <div className="pt-2">
            <button
              onClick={handleCompileScreenplay}
              disabled={isCompiling || !premise.trim()}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-sm shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-all duration-200 active:scale-95"
            >
              {isCompiling ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              <span>{isCompiling ? (compilationStatus || 'Đang viết kịch bản...') : 'Biên Kịch AI (Compile)'}</span>
            </button>
          </div>
        </div>
      ) : editorMode === 'import' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111114]">
          {/* World Selector Dropdown */}
          <div className="space-y-1.5 text-left">
            <div className="flex justify-between items-center">
              <label className="text-[9px] text-indigo-400 font-extrabold uppercase tracking-wider block">Chọn dự án World Asset</label>
              {projectsLoadError && (
                <button
                  type="button"
                  onClick={() => setProjectRefreshTrigger(prev => prev + 1)}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 active:scale-95 transition-all outline-none"
                  title="Tải lại danh sách dự án"
                >
                  <RefreshCw size={8} /> Tải lại
                </button>
              )}
            </div>
            
            {isLoadingImportProjects ? (
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-950/40 p-2.5 rounded-lg border border-slate-850">
                <Loader2 size={12} className="animate-spin text-indigo-400" />
                <span>Đang tải danh sách dự án...</span>
              </div>
            ) : projectsLoadError ? (
              <div className="space-y-2 p-3 bg-red-950/15 border border-red-900/30 rounded-xl text-left font-sans">
                <span className="text-[10px] text-red-400 block leading-relaxed font-semibold">
                  ⚠️ {projectsLoadError}
                </span>
                <span className="text-[8px] text-slate-500 block leading-tight">
                  Đường dẫn: <span className="font-mono bg-[#090d16] px-1 py-0.5 rounded text-slate-400 select-all">{getApiBaseUrl()}/api/world-asset/projects</span>
                </span>
                <button
                  type="button"
                  onClick={() => setProjectRefreshTrigger(prev => prev + 1)}
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-[10px] text-slate-350 hover:text-white rounded-lg font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all outline-none"
                >
                  <RefreshCw size={10} /> Thử kết nối lại
                </button>
              </div>
            ) : (
              <select
                value={importSelectedWorldId}
                onChange={(e) => setImportSelectedWorldId(e.target.value)}
                className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500/50 cursor-pointer transition-all font-bold"
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

          {/* Selector tab: File vs Text */}
          <div className="flex border border-slate-800 bg-[#1a1a1f] p-0.5 rounded-lg gap-0.5">
            <button
              type="button"
              onClick={() => { setImportActiveTab('file'); setImportError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                importActiveTab === 'file'
                  ? 'bg-indigo-655 text-white shadow bg-indigo-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Upload size={10} />
              <span>Tải tệp tin</span>
            </button>
            <button
              type="button"
              onClick={() => { setImportActiveTab('text'); setImportError(null); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                importActiveTab === 'text'
                  ? 'bg-indigo-655 text-white shadow bg-indigo-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Clipboard size={10} />
              <span>Dán Shotlist</span>
            </button>
          </div>

          {/* Shotlist Input Container */}
          {importActiveTab === 'file' ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setImportDragOver(true); }}
              onDragLeave={() => setImportDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setImportDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  validateAndSetImportFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => importFileInputRef.current?.click()}
              className={`w-full aspect-video rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 cursor-pointer transition-all ${
                importDragOver 
                  ? 'border-indigo-500 bg-indigo-500/5' 
                  : importFile 
                    ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500' 
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/20'
              }`}
            >
              <input 
                type="file" 
                ref={importFileInputRef}
                accept=".docx,.txt"
                className="hidden" 
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    validateAndSetImportFile(e.target.files[0]);
                  }
                }}
              />
              
              {importFile ? (
                <div className="flex flex-col items-center text-center space-y-2 max-w-full">
                  <FileText size={20} className="text-emerald-400 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-200 block truncate max-w-[220px]">{importFile.name}</span>
                  <span className="text-[8px] text-slate-500 block">{(importFile.size / 1024).toFixed(1)} KB</span>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center space-y-1">
                  <Upload size={20} className="text-slate-550 shrink-0" />
                  <span className="text-[10px] font-bold text-slate-405">Kéo thả hoặc click để tải</span>
                  <span className="text-[8px] text-slate-600 block">Hỗ trợ .docx hoặc .txt</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5 text-left">
              <label className="text-[9px] text-slate-400 uppercase font-black tracking-wider block">Nội dung Shotlist</label>
              <textarea
                value={importRawText}
                onChange={(e) => setImportRawText(e.target.value)}
                className="w-full h-32 bg-[#1a1a1f] border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-350 font-mono outline-none focus:border-indigo-500/50 resize-none"
                placeholder="Dán nội dung kịch bản/shotlist tại đây..."
              />
            </div>
          )}

          {/* Prompt Template Section */}
          <div className="space-y-1.5 pt-2 border-t border-slate-800/50 text-left">
            <label className="text-[9px] text-purple-400 font-extrabold uppercase tracking-wider block">Prompt Template (Cấu hình style)</label>
            <textarea
              value={promptTemplateText}
              onChange={(e) => setPromptTemplateText(e.target.value)}
              className="w-full h-24 bg-[#1a1a1f] border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-350 font-mono outline-none focus:border-indigo-500/50 resize-none placeholder:text-slate-650"
              placeholder="Dán cấu hình style prompt, tỷ lệ khung hình:&#10;style: cinematic 3D anime style, vibrant&#10;aspect: 16:9&#10;dialogue: post-sync"
            />
            <input 
              type="file"
              accept=".txt,.json"
              ref={templateFileInputRef}
              className="hidden"
              onChange={handleTemplateFileChange}
            />
            <button
              type="button"
              onClick={() => templateFileInputRef.current?.click()}
              className="w-full py-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg text-[9px] font-black uppercase border border-slate-800 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <Upload size={10} /> Chọn file Template (.txt)
            </button>
          </div>

          {/* Import Errors / Success feedbacks */}
          {importError && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] text-left">
              <AlertCircle size={12} className="shrink-0 mt-0.5" />
              <span>{importError}</span>
            </div>
          )}

          {importSuccess ? (
            <div className="flex flex-col items-center justify-center py-4 space-y-2 text-center">
              <CheckCircle size={24} className="text-emerald-400" />
              <h4 className="text-xs font-bold text-white">Import thành công!</h4>
              <p className="text-[10px] text-slate-450">Đang khởi tạo các Narrative Scene và Shot Node lên Canvas...</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleImportShotlist}
              disabled={isImporting || (importActiveTab === 'file' ? !importFile : !importRawText.trim())}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
            >
              {isImporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Upload size={13} />
                  Phân tích &amp; gán asset
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* World Asset DB Sync Panel */}
          <div className="border-b border-slate-800/80 bg-[#1e1e24]/40">
            <button 
              onClick={handleToggleDbSelector}
              className="w-full px-4 py-2.5 flex items-center justify-between text-[11px] font-black text-indigo-400 hover:text-indigo-350 hover:bg-slate-800/20 transition-all outline-none uppercase tracking-wide"
            >
              <div className="flex items-center gap-1.5">
                <Database size={12} className={isDbSelectorOpen ? 'animate-pulse' : ''} />
                <span>Lấy Kịch Bản từ World Asset</span>
              </div>
              {isDbSelectorOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {isDbSelectorOpen && (
              <div className="px-4 pb-4 pt-1 space-y-3 bg-[#111114]/80 border-t border-slate-800/50 animate-fade-in">
                {isLoadingDb && projects.length === 0 ? (
                  <div className="py-3 flex items-center justify-center gap-1.5 text-[9px] text-slate-500 font-bold uppercase">
                    <Loader2 size={11} className="animate-spin" />
                    <span>Đang kết nối thư viện...</span>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block">Chọn dự án (Universe)</label>
                      <select 
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-indigo-500/50"
                      >
                        {projects.map(proj => (
                          <option key={proj.id} value={proj.id}>{proj.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] text-slate-500 font-black uppercase tracking-wider block">Chọn kịch bản (Episode)</label>
                      {episodes.length === 0 ? (
                        <span className="text-[9px] text-amber-500 font-bold italic block py-1 uppercase">Chưa có kịch bản nào được đồng bộ</span>
                      ) : (
                        <select 
                          value={selectedEpisodeId}
                          onChange={(e) => setSelectedEpisodeId(e.target.value)}
                          className="w-full bg-[#1a1a1f] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold outline-none focus:border-indigo-500/50"
                        >
                          {episodes.map(ep => (
                            <option key={ep.id} value={ep.id}>{ep.title}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    <button
                      onClick={handleLoadDbScript}
                      disabled={!selectedEpisodeId || isLoadingDb}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[9px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-950/20 active:scale-95 duration-200"
                    >
                      {isLoadingDb ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                      <span>Đồng Bộ Kịch Bản</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>


          {/* Format Bar */}
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 bg-[#1a1a1f] shadow-inner">
            <button onClick={() => insertTemplate('title')} className="hover:text-white px-2 py-1 rounded hover:bg-white/5 transition-all outline-none border border-transparent hover:border-slate-700">TITLE</button>
            <button onClick={() => insertTemplate('scene')} className="hover:text-emerald-400 px-2 py-1 rounded hover:bg-emerald-400/10 transition-all text-emerald-500/70 outline-none border border-transparent hover:border-emerald-500/30">SCENE</button>
            <button onClick={() => insertTemplate('dialog')} className="hover:text-blue-400 px-2 py-1 rounded hover:bg-blue-400/10 transition-all text-blue-500/70 outline-none border border-transparent hover:border-blue-500/30">DIALOG</button>
            <button onClick={() => insertTemplate('transition')} className="hover:text-orange-400 px-2 py-1 rounded hover:bg-orange-400/10 transition-all text-orange-500/70 outline-none border border-transparent hover:border-orange-500/30">TRANSITION</button>
            <button onClick={() => insertTemplate('character')} className="hover:text-purple-400 px-2 py-1 rounded hover:bg-purple-400/10 transition-all text-purple-500/70 outline-none border border-transparent hover:border-purple-500/30">CHARACTER</button>
            <button onClick={() => insertTemplate('location')} className="hover:text-rose-400 px-2 py-1 rounded hover:bg-rose-400/10 transition-all text-rose-500/70 outline-none border border-transparent hover:border-rose-500/30">LOCATION</button>
          </div>

          {/* Rich Text Editor */}
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            {...{ placeholder: "Nhập kịch bản của bạn tại đây hoặc đồng bộ từ World Asset / sử dụng AI Co-Pilot..." } as any}
            className="flex-1 w-full bg-[#111114] text-slate-300 p-6 outline-none font-mono text-[13px] leading-loose overflow-y-auto focus:ring-inset focus:ring-1 focus:ring-slate-800"
            style={{ whiteSpace: 'pre-wrap' }}
          ></div>

          {/* Actions / Stats Panel */}
          {parsedData?.isImported ? (
            <div className="p-4 border-t border-slate-800 bg-[#15151b] space-y-3 shrink-0">
              <div className="p-3.5 rounded-2xl bg-[#1d1d28]/70 border border-emerald-500/20 shadow-md">
                <div className="flex items-center gap-2 text-emerald-400 font-black text-[10px] uppercase tracking-wider mb-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Kịch bản Import Trực Tiếp</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                  <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900/60">
                    <div className="text-slate-500 font-semibold block uppercase text-[8px] tracking-wider">Phân cảnh</div>
                    <div className="text-xs font-black text-white mt-0.5">{parsedData.scenes?.length || 0} Scenes</div>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900/60">
                    <div className="text-slate-500 font-semibold block uppercase text-[8px] tracking-wider">Khung hình</div>
                    <div className="text-xs font-black text-white mt-0.5">{parsedData.shots?.length || 0} Shots</div>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900/60">
                    <div className="text-slate-500 font-semibold block uppercase text-[8px] tracking-wider">Nhân vật</div>
                    <div className="text-xs font-black text-white mt-0.5">{parsedData.characters?.length || 0} Casts</div>
                  </div>
                  <div className="bg-slate-950/40 p-2 rounded-xl border border-slate-900/60">
                    <div className="text-slate-500 font-semibold block uppercase text-[8px] tracking-wider">Bối cảnh</div>
                    <div className="text-xs font-black text-white mt-0.5">{parsedData.locations?.length || 0} Locs</div>
                  </div>
                </div>
              </div>

              {/* Chỉ dẫn chuyển sang cột phải */}
              <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 text-left space-y-1 mb-2.5">
                <div className="text-[10px] font-black text-indigo-400 flex items-center gap-1.5 uppercase tracking-wider">
                  👉 Bước tiếp theo: Sang cột bên phải
                </div>
                <p className="text-[9px] text-slate-400 leading-relaxed font-semibold">
                  Kịch bản đã sẵn sàng! Mời Sếp xem cột <b>Flow Controller</b> (bên phải) để thiết lập Visual Style, Aspect Ratio (Bước 3) và click <b>Build Scene Flow</b> (Bước 4) để tự động sinh Sơ đồ canvas.
                </p>
              </div>

              <button
                onClick={handleAnalyzeAssets}
                disabled={isAnalyzingAssets}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-1.5 transition-all active:scale-95 duration-200 cursor-pointer disabled:opacity-50"
              >
                {isAnalyzingAssets ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    Đang phân tích Asset...
                  </>
                ) : (
                  <>
                    <Database size={13} />
                    Phân tích &amp; Gán Asset vào Shot
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  if (confirm("Sếp có chắc chắn muốn TẠO MỚI dự án? Việc này sẽ xóa sạch sâu toàn bộ kịch bản, các node trên canvas và cấu hình lưu trữ, bao gồm cả liên kết dự án trên URL.")) {
                    const store = useFlowStore.getState();
                    store.setParsedData(null);
                    store.setPendingShots([]);
                    store.setNodes([]);
                    store.setEdges([]);
                    store.setProjectData({
                      id: 'new',
                      name: 'Untitled Storyboard Project',
                      stylePrompt: 'Cinematic lighting, hyperrealistic, 8k resolution, unreal engine 5 render, concept art',
                      aspectRatio: '16:9',
                      dialogueMode: 'post-sync',
                      targetRuntime: 180,
                      maxShotCount: 40,
                      imageModel: 'auto',
                      videoModel: 'auto',
                      safetyLocks: ['no-text', 'no-subtitles', 'no-morphing']
                    });
                    localStorage.removeItem('flow-architect-storage');
                    window.history.pushState({}, document.title, window.location.pathname);
                    if (editorRef.current) {
                      editorRef.current.innerHTML = "";
                    }
                    window.location.reload();
                  }
                }}
                className="w-full py-2 bg-slate-900 hover:bg-red-950/30 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-900/40 rounded-xl font-bold text-xs transition-all active:scale-95 duration-200 cursor-pointer"
              >
                Tạo mới / Xóa kịch bản
              </button>
            </div>
          ) : (
            <div className="p-4 border-t border-slate-800 bg-[#1e1e24] shrink-0">
              <button 
                onClick={handleAnalyzeClick}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {isLoading ? 'AI Analyzing...' : 'Analyze Script via LLM'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
