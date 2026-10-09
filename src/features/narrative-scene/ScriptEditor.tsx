import { 
  FileText, 
  Loader2, 
  Database, 
  Download, 
  Upload, 
  Clipboard, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw,
  Sparkles,
  Trash2,
  BookOpen
} from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import { getApiBaseUrl, coreRequest } from '../../utils/apiConfig';
import { useFlowStore } from '../../store/useFlowStore';
import { hydrateShotsWithUniverseAssets } from '../../utils/assetMatcher';

interface ScriptEditorProps {
  onAnalyze: (text: string) => void;
  isLoading?: boolean;
  externalScript?: string;
  onImportEpisode?: (episode: any) => Promise<void>;
  onBuildStoryboard?: () => void;
}

const SAMPLE_SCRIPT = `CẢNH 1: PHÒNG KHÁCH NHÀ PACO - NGÀY

Paco đang ngồi chăm chú lắp ráp mô hình robot trên bàn gỗ.
(Cảm xúc: hào hứng, tập trung)

PACO
(cười rạng rỡ)
Mảnh ghép cuối cùng đây rồi! Chuẩn bị khởi động thôi!

Bất ngờ, một tiếng động lạ phát ra từ ngăn kéo bàn làm việc.

CẢNH 2: GÓC BÀN LÀM VIỆC - NGÀY

Paco từ từ tiến lại gần ngăn kéo, mắt mở to cảnh giác.
(Cảm xúc: hồi hộp, tò mò)

PACO
Ai ở trong đó thế?`;

export default function ScriptEditor({ onAnalyze, isLoading = false, externalScript, onImportEpisode }: ScriptEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const parsedData = useFlowStore(state => state.parsedData);
  const projectData = useFlowStore(state => state.projectData);
  const hubApiKey = useFlowStore(state => state.hubApiKey);
  const setProjectData = useFlowStore(state => state.setProjectData);

  // Tab State: 'editor' (Biên kịch) | 'import' (Nhập tệp / DB)
  const [editorMode, setEditorMode] = useState<'editor' | 'import'>('editor');
  const [showCheatsheet, setShowCheatsheet] = useState(false);

  // World Asset DB Integration States
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [projectRefreshTrigger, setProjectRefreshTrigger] = useState(0);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [isAnalyzingAssets, setIsAnalyzingAssets] = useState(false);

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

  // Fetch projects when entering import mode or on refresh
  useEffect(() => {
    if (editorMode === 'import') {
      const fetchProjects = async () => {
        setIsLoadingImportProjects(true);
        setProjectsLoadError(null);
        try {
          const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
          
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
              setSelectedProjectId(activeId);
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
      setSelectedProjectId(activeId);
    }
  }, [editorMode, projects, importSelectedWorldId, projectData]);

  // Load Episodes when selectedProjectId changes
  useEffect(() => {
    if (!selectedProjectId) return;
    const loadEpisodes = async () => {
      setIsLoadingDb(true);
      try {
        const baseUrl = getApiBaseUrl();
        const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
        const headers: Record<string, string> = {};
        if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;
        
        const res = await fetch(`${baseUrl}/internal/v1/asset/world/episodes?projectId=${selectedProjectId}`, { headers });
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
  }, [selectedProjectId, hubApiKey]);

  const handleSelectProject = (projectId: string) => {
    setImportSelectedWorldId(projectId);
    setSelectedProjectId(projectId);
    useFlowStore.getState().setProjectData({
      ...projectData,
      selectedProjectId: projectId,
      selectedUniverseId: projectId,
    });
  };

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
    const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
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
      const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const res = await fetch(`${baseUrl}/internal/v1/asset/world/characters?projectId=${activeProjId}`, {
        headers: { 'Authorization': `Bearer ${HUB_API_KEY}` }
      });
      if (!res.ok) throw new Error("Không thể tải danh sách Asset từ World DB");
      const dbChars = await res.json();

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

      window.dispatchEvent(new CustomEvent('WORLD_ASSETS_CHANGED'));

      alert(`✅ Đã phân tích kịch bản và tự động gắn asset thành công cho ${enrichedShots.length} shots! (Phát hiện ${enrichedChars.length} nhân vật, ${enrichedLocs.length} bối cảnh & ${enrichedProps.length} đạo cụ).`);
    } catch (err: any) {
      alert("❌ Lỗi khi phân tích asset: " + err.message);
    } finally {
      setIsAnalyzingAssets(false);
    }
  };

  // Helper format HTML cho Screenplay
  const formatScriptHtml = (text: string) => {
    return text.split('\n').map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<div><br></div>';
      
      // Scene Headings (INT. / EXT. / CẢNH)
      if (trimmed.match(/^(INT\.|EXT\.|CẢNH)/i)) {
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
      // Character Names (All caps Vietnamese & Latin, short)
      if (trimmed.match(/^([A-Z0-9\sÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴÝỶỸ]+)$/) && trimmed.length > 1 && trimmed.length < 30) {
        return `<div style="font-weight: bold; color: #a855f7; text-align: center; margin-top: 10px;">${trimmed}</div>`;
      }
      
      return `<div>${trimmed}</div>`;
    }).join('');
  };

  const setEditorText = (text: string) => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = formatScriptHtml(text);
  };

  // Load Script Content from Selected Episode (DB Sync)
  const handleLoadDbScript = async () => {
    if (!selectedEpisodeId) return;
    setIsLoadingDb(true);
    try {
      const baseUrl = getApiBaseUrl();
      const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
      
      const res = await fetch(`${baseUrl}/internal/v1/asset/world/episodes/${selectedEpisodeId}/storyboard-assets`, {
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
            setEditorMode('editor');
            setEditorText(scriptContent);
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

  useEffect(() => {
    if (editorRef.current && externalScript) {
      editorRef.current.innerHTML = formatScriptHtml(externalScript);
    }
  }, [externalScript]);

  const insertTemplate = (type: 'title' | 'scene' | 'dialog' | 'transition' | 'character' | 'location') => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    
    const selection = window.getSelection();
    const selectedText = selection?.toString() || '';
    
    let html = '';
    
    if (selectedText) {
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
      switch(type) {
        case 'title':
          html = '<div style="text-align: center; font-weight: bold; text-transform: uppercase; color: white; padding: 15px 0 5px 0;">[ TIÊU ĐỀ KỊCH BẢN ]</div><div><br></div>';
          break;
        case 'scene':
          html = '<div><br></div><div style="font-weight: bold; text-transform: uppercase; color: #34d399;">CẢNH 1: [BỐI CẢNH] - NGÀY</div><div><br></div>';
          break;
        case 'dialog':
          html = '<div><br></div><div style="text-align: center; font-weight: bold; text-transform: uppercase; color: #a855f7;">TÊN NHÂN VẬT</div><div style="text-align: center; padding: 0 15%; font-style: italic; color: #94a3b8;">(Cảm xúc biểu cảm)</div><div style="text-align: center; padding: 0 15%; color: #60a5fa;">Lời thoại ở đây...</div><div><br></div>';
          break;
        case 'transition':
          html = '<div><br></div><div style="text-align: right; font-weight: bold; text-transform: uppercase; color: #fb923c; padding-right: 5%;">CUT TO:</div><div><br></div>';
          break;
        case 'character':
          html = '<span style="font-weight: bold; color: #a855f7;">[TÊN NHÂN VẬT]</span>';
          break;
        case 'location':
          html = '<span style="font-weight: bold; color: #f43f5e;">[TÊN BỐI CẢNH]</span>';
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

  // Quick Action Toolbar Handlers
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        setEditorText(text);
      } else {
        alert("Clipboard của bạn đang trống!");
      }
    } catch (err) {
      console.warn("Không thể truy cập clipboard qua API navigator:", err);
      const text = prompt("Dán kịch bản của bạn vào đây:");
      if (text) setEditorText(text);
    }
  };

  const handleLoadSampleScript = () => {
    if (editorRef.current && editorRef.current.innerText.trim()) {
      if (!confirm("Thay thế nội dung hiện tại bằng kịch bản mẫu tiêu chuẩn?")) return;
    }
    setEditorText(SAMPLE_SCRIPT);
  };

  const handleClearEditor = () => {
    if (!editorRef.current || !editorRef.current.innerText.trim()) return;
    if (confirm("Sếp có chắc chắn muốn xóa trắng nội dung kịch bản đang soạn?")) {
      editorRef.current.innerHTML = '<div><br></div>';
    }
  };

  return (
    <div className="w-[360px] border-r border-slate-800 bg-[#16161a] flex flex-col h-full shadow-2xl z-20 transition-all font-sans">
      <div className="p-4 border-b border-slate-800 bg-[#1e1e24] flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-300">
          <FileText size={18} className="text-indigo-400" />
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
                const HUB_API_KEY = hubApiKey || localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
                
                const getRes = await fetch(`${baseUrl}/internal/v1/asset/world/projects/${activeId}`, {
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

                  await fetch(`${baseUrl}/internal/v1/asset/world/projects/${activeId}`, {
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

      {/* Tabs: 2 Tabs duy nhất */}
      <div className="flex border-b border-slate-800 bg-[#16161a] px-2 gap-1 pt-2 shrink-0">
        <button
          onClick={() => setEditorMode('editor')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 outline-none whitespace-nowrap cursor-pointer ${
            editorMode === 'editor'
              ? 'border-indigo-500 text-white bg-[#111114]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText size={13} className="flex-shrink-0" />
          <span>Biên kịch</span>
        </button>
        <button
          onClick={() => setEditorMode('import')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-black uppercase tracking-wider transition-all border-b-2 outline-none whitespace-nowrap cursor-pointer ${
            editorMode === 'import'
              ? 'border-indigo-500 text-white bg-[#111114]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Upload size={13} className="flex-shrink-0" />
          <span>Nhập tệp / DB</span>
        </button>
      </div>

      {editorMode === 'import' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#111114]">
          {/* Card 1: Chọn Universe / Dự Án World Asset */}
          <div className="space-y-1.5 text-left bg-[#1a1a20] p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Database size={11} /> Dự Án World Asset (Universe)
              </label>
              {projectsLoadError && (
                <button
                  type="button"
                  onClick={() => setProjectRefreshTrigger(prev => prev + 1)}
                  className="text-[9px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 active:scale-95 transition-all outline-none"
                  title="Tải lại danh sách dự án"
                >
                  <RefreshCw size={9} /> Tải lại
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
                onChange={(e) => handleSelectProject(e.target.value)}
                className="w-full bg-[#111116] border border-slate-800 rounded-lg p-2.5 text-xs text-white outline-none focus:border-indigo-500/50 cursor-pointer transition-all font-bold"
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

          {/* Card 2: Lấy Kịch Bản từ World Asset DB */}
          <div className="space-y-2 bg-[#1a1a20] p-3 rounded-xl border border-slate-800/80 text-left">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                <Download size={11} /> Lấy Kịch Bản từ World DB
              </label>
              <span className="text-[9px] text-slate-500 font-semibold">{episodes.length} episodes</span>
            </div>

            {isLoadingDb && projects.length === 0 ? (
              <div className="py-2.5 flex items-center justify-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase">
                <Loader2 size={11} className="animate-spin text-emerald-400" />
                <span>Đang kết nối thư viện...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {episodes.length === 0 ? (
                  <div className="text-[10px] text-amber-500 font-semibold italic bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                    Chưa có kịch bản (Episode) nào trong dự án này.
                  </div>
                ) : (
                  <select 
                    value={selectedEpisodeId}
                    onChange={(e) => setSelectedEpisodeId(e.target.value)}
                    className="w-full bg-[#111116] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-white font-bold outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    {episodes.map(ep => (
                      <option key={ep.id} value={ep.id}>{ep.title}</option>
                    ))}
                  </select>
                )}

                <button
                  onClick={handleLoadDbScript}
                  disabled={!selectedEpisodeId || isLoadingDb}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-[10px] uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-emerald-950/20 active:scale-95 duration-200 cursor-pointer"
                >
                  {isLoadingDb ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                  <span>Đồng Bộ Kịch Bản Từ DB</span>
                </button>
              </div>
            )}
          </div>

          {/* Card 3: Nhập tệp tin / Dán Shotlist */}
          <div className="space-y-2.5 bg-[#1a1a20] p-3 rounded-xl border border-slate-800/80 text-left">
            <div className="flex border border-slate-800 bg-[#111116] p-0.5 rounded-lg gap-0.5">
              <button
                type="button"
                onClick={() => { setImportActiveTab('file'); setImportError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  importActiveTab === 'file'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Upload size={10} />
                <span>Tải tệp tin (.docx/.txt)</span>
              </button>
              <button
                type="button"
                onClick={() => { setImportActiveTab('text'); setImportError(null); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  importActiveTab === 'text'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Clipboard size={10} />
                <span>Dán Shotlist</span>
              </button>
            </div>

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
                className={`w-full aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-3 cursor-pointer transition-all ${
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
                  <div className="flex flex-col items-center text-center space-y-1.5 max-w-full">
                    <FileText size={20} className="text-emerald-400 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-200 block truncate max-w-[220px]">{importFile.name}</span>
                    <span className="text-[8px] text-slate-500 block">{(importFile.size / 1024).toFixed(1)} KB</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center space-y-1">
                    <Upload size={18} className="text-slate-500 shrink-0" />
                    <span className="text-[10px] font-bold text-slate-350">Kéo thả hoặc click để tải</span>
                    <span className="text-[8px] text-slate-600 block">Hỗ trợ .docx hoặc .txt</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-left">
                <textarea
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  className="w-full h-28 bg-[#111116] border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-300 font-mono outline-none focus:border-indigo-500/50 resize-none leading-relaxed"
                  placeholder="Dán nội dung kịch bản/shotlist tại đây..."
                />
              </div>
            )}
          </div>

          {/* Card 4: Prompt Template Section */}
          <div className="space-y-2 bg-[#1a1a20] p-3 rounded-xl border border-slate-800/80 text-left">
            <label className="text-[10px] text-purple-400 font-extrabold uppercase tracking-wider block">
              Prompt Template (Cấu hình style)
            </label>
            <textarea
              value={promptTemplateText}
              onChange={(e) => setPromptTemplateText(e.target.value)}
              className="w-full h-20 bg-[#111116] border border-slate-800 rounded-lg p-2.5 text-[10px] text-slate-300 font-mono outline-none focus:border-indigo-500/50 resize-none placeholder:text-slate-600 leading-relaxed"
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
            <div className="flex flex-col items-center justify-center py-4 space-y-2 text-center bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <CheckCircle size={24} className="text-emerald-400" />
              <h4 className="text-xs font-bold text-white">Import thành công!</h4>
              <p className="text-[10px] text-slate-400">Đang khởi tạo các Narrative Scene và Shot Node lên Canvas...</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleImportShotlist}
              disabled={isImporting || (importActiveTab === 'file' ? !importFile : !importRawText.trim())}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-indigo-500/15 flex items-center justify-center gap-1.5 transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <Upload size={13} />
                  Phân tích &amp; gán asset lên Canvas
                </>
              )}
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Quick Toolbar: Dán Clipboard, Mẫu kịch bản, Xóa trắng, Hướng dẫn */}
          <div className="px-3 py-2 border-b border-slate-800/80 bg-[#16161c] flex items-center justify-between gap-1 text-[11px] shrink-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={handlePasteClipboard}
                className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md font-bold text-[10px] flex items-center gap-1 transition-all active:scale-95 border border-slate-700/50 cursor-pointer"
                title="Dán nội dung từ Clipboard"
              >
                <Clipboard size={11} className="text-indigo-400" />
                <span>📋 Dán Clipboard</span>
              </button>
              <button
                onClick={handleLoadSampleScript}
                className="px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md font-bold text-[10px] flex items-center gap-1 transition-all active:scale-95 border border-slate-700/50 cursor-pointer"
                title="Nạp mẫu kịch bản tiêu chuẩn Hollywood"
              >
                <FileText size={11} className="text-emerald-400" />
                <span>📄 Mẫu kịch bản</span>
              </button>
              <button
                onClick={handleClearEditor}
                className="px-2 py-1 bg-slate-800/80 hover:bg-red-950/40 text-slate-400 hover:text-red-400 rounded-md font-bold text-[10px] flex items-center gap-1 transition-all active:scale-95 border border-transparent hover:border-red-900/40 cursor-pointer"
                title="Xóa trắng khung soạn thảo"
              >
                <Trash2 size={11} />
                <span>🗑️ Xóa trắng</span>
              </button>
            </div>
            <button
              onClick={() => setShowCheatsheet(prev => !prev)}
              className={`p-1 rounded-md transition-all cursor-pointer ${
                showCheatsheet 
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
              title="Hướng dẫn định dạng kịch bản"
            >
              <BookOpen size={13} />
            </button>
          </div>

          {/* Format Cheatsheet Drawer */}
          {showCheatsheet && (
            <div className="p-3 bg-[#121217] border-b border-indigo-900/40 text-[10px] space-y-2 animate-fade-in shrink-0">
              <div className="flex items-center justify-between text-indigo-300 font-bold">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={12} className="text-indigo-400" /> Format Cheatsheet (Cấu trúc chuẩn)
                </span>
                <button 
                  onClick={() => setShowCheatsheet(false)}
                  className="text-slate-500 hover:text-slate-300 text-xs px-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1.5 font-mono text-[10px] bg-slate-950/90 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed text-slate-300">
                <div>
                  <span className="text-emerald-400 font-bold">CẢNH 1: [BỐI CẢNH] - [THỜI GIAN]</span>
                  <span className="text-slate-500 ml-1.5 font-sans">(hoặc INT./EXT.)</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">Mô tả hành động</span>
                  <span className="text-slate-500 ml-1.5 font-sans">(Góc quay, cử chỉ, bối cảnh)</span>
                </div>
                <div>
                  <span className="text-slate-400 font-semibold">(Cảm xúc: ...)</span>
                  <span className="text-slate-500 ml-1.5 font-sans">(Tông cảm xúc từng cảnh/shot)</span>
                </div>
                <div>
                  <span className="text-purple-400 font-bold">TÊN NHÂN VẬT</span>
                  <span className="text-slate-500 ml-1.5 font-sans">(VIẾT HOA ở dòng riêng)</span>
                </div>
                <div>
                  <span className="text-slate-400 italic">(hành động biểu cảm thoại)</span>
                </div>
                <div>
                  <span className="text-blue-400 font-medium">Lời thoại của nhân vật</span>
                </div>
              </div>
            </div>
          )}

          {/* Format Bar Tags */}
          <div className="px-4 py-2 border-b border-slate-800 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500 bg-[#1a1a1f] shadow-inner shrink-0">
            <button onClick={() => insertTemplate('title')} className="hover:text-white px-2 py-0.5 rounded hover:bg-white/5 transition-all outline-none border border-transparent hover:border-slate-700 cursor-pointer">TITLE</button>
            <button onClick={() => insertTemplate('scene')} className="hover:text-emerald-400 px-2 py-0.5 rounded hover:bg-emerald-400/10 transition-all text-emerald-500/70 outline-none border border-transparent hover:border-emerald-500/30 cursor-pointer">SCENE</button>
            <button onClick={() => insertTemplate('dialog')} className="hover:text-blue-400 px-2 py-0.5 rounded hover:bg-blue-400/10 transition-all text-blue-500/70 outline-none border border-transparent hover:border-blue-500/30 cursor-pointer">DIALOG</button>
            <button onClick={() => insertTemplate('transition')} className="hover:text-orange-400 px-2 py-0.5 rounded hover:bg-orange-400/10 transition-all text-orange-500/70 outline-none border border-transparent hover:border-orange-500/30 cursor-pointer">TRANSITION</button>
            <button onClick={() => insertTemplate('character')} className="hover:text-purple-400 px-2 py-0.5 rounded hover:bg-purple-400/10 transition-all text-purple-500/70 outline-none border border-transparent hover:border-purple-500/30 cursor-pointer">CHARACTER</button>
            <button onClick={() => insertTemplate('location')} className="hover:text-rose-400 px-2 py-0.5 rounded hover:bg-rose-400/10 transition-all text-rose-500/70 outline-none border border-transparent hover:border-rose-500/30 cursor-pointer">LOCATION</button>
          </div>

          {/* Rich Text Editor */}
          <div 
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            {...{ placeholder: "Nhập kịch bản của bạn tại đây hoặc dán nội dung / nạp kịch bản mẫu..." } as any}
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
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(99,102,241,0.35)] transition-all duration-200 active:scale-98 cursor-pointer"
              >
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>{isLoading ? 'Đang Phân Tích Kịch Bản...' : '⚡ Phân Tích Kịch Bản (AI Script Analysis)'}</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
