import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from 'reactflow';
import type {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
} from 'reactflow';
import type { ParsedScript } from '../utils/scriptParser';

interface FlowState {
  // 1. React Flow State
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;

  // 2. Project State
  projectData: { 
    id: string; 
    name: string; 
    stylePrompt?: string; 
    selectedUniverseId?: string; 
    selectedProjectId?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    dialogueMode?: 'post-sync' | 'ai-speech' | 'silent';
    targetRuntime?: number;
    maxShotCount?: number;
    imageModel?: string;
    videoModel?: string;
    safetyLocks?: string[];
    universeGenre?: string;
    worldConstraints?: string;
    shotlistPreset?: string;
  };
  setProjectData: (data: { 
    id: string; 
    name: string; 
    stylePrompt?: string; 
    selectedUniverseId?: string; 
    selectedProjectId?: string;
    aspectRatio?: '16:9' | '9:16' | '1:1';
    dialogueMode?: 'post-sync' | 'ai-speech' | 'silent';
    targetRuntime?: number;
    maxShotCount?: number;
    imageModel?: string;
    videoModel?: string;
    safetyLocks?: string[];
    universeGenre?: string;
    worldConstraints?: string;
    shotlistPreset?: string;
  }) => void;

  // 3. UI State
  isDrawerOpen: boolean;
  setIsDrawerOpen: (isOpen: boolean) => void;
  isSettingOpen: boolean;
  setIsSettingOpen: (isOpen: boolean) => void;
  hoveredAssetId: string | null;
  setHoveredAssetId: (id: string | null) => void;
  activeDetailBeat: string | null;
  setActiveDetailBeat: (beatId: string | null) => void;
  isRightDrawerCollapsed: boolean;
  setIsRightDrawerCollapsed: (collapsed: boolean) => void;

  // 4. Parse State
  parsedData: ParsedScript | null;
  setParsedData: (data: ParsedScript | null) => void;
  isAnalyzing: boolean;
  setIsAnalyzing: (is: boolean) => void;
  pendingShots: any[];
  setPendingShots: (shots: any[]) => void;

  // 5. Scene Tab Filter — 'all' shows full canvas, sceneId isolates one scene column
  activeSceneId: string;
  setActiveSceneId: (id: string) => void;

  // 5. LLM Settings & Global Settings
  llmProvider: string;
  geminiKey: string;
  hubToken: string;
  hubModel: string;
  
  hubUrl: string;
  hubApiKey: string;
  sdkUrl: string;
  sdkApiKey: string;
  geminiApiKey: string;
  activeProvider: string;
  imageProvider: string;
  videoProvider: string;
  hubLlmModel: string;
  hubImageModel: string;
  hubVideoModel: string;
  sdkLlmModel: string;
  sdkImageModel: string;
  sdkVideoModel: string;
  googleLlmModel: string;
  googleImageModel: string;
  googleVideoModel: string;
  dreaminaImageModel: string;
  dreaminaVideoModel: string;
  universalNegativePrompt: string;
  customProjectRules: string[];
  customEpisodeRules: string[];

  buildMode: '1x1' | 'consolidated';
  zlproxyKey?: string;
  useZlproxyForGflow?: boolean;
  useZlproxyForAIWorkers?: boolean;
  disableWebpConversion?: boolean;
  hubConnectionMode: 'vps' | 'staging' | 'local';
  localIp: string;
  
  showRuleBoard: boolean;
  setShowRuleBoard: (show: boolean) => void;

  renderingStates: Record<string, string>;
  videoStates: Record<string, string>;
  setRenderingState: (shotId: string, state: string) => void;
  setVideoState: (shotId: string, state: string) => void;
  updateShot: (shotId: string, field: string | Record<string, any>, value?: any) => void;
  
  cinematicWarnings: string[];
  cinematicGlueNotes: string[];
  setCinematicWarnings: (warnings: string[]) => void;
  setCinematicGlueNotes: (notes: string[]) => void;
  
  setLlmSettings: (settings: { provider?: string; geminiKey?: string; hubToken?: string; hubModel?: string }) => void;
  updateGlobalSettings: (settings: Partial<FlowState>) => void;
}

let writeTimeout: any = null;

const debouncedLocalStorage = {
  getItem: (name: string) => {
    return localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (writeTimeout) clearTimeout(writeTimeout);
    writeTimeout = setTimeout(() => {
      localStorage.setItem(name, value);
    }, 500);
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  }
};

// Auto-migration for legacy IP 192.168.1.10 -> storymee-pc.local
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const rawStorage = window.localStorage.getItem('flow-architect-storage');
    if (rawStorage) {
      const parsed = JSON.parse(rawStorage);
      if (parsed && parsed.state) {
        let changed = false;
        if (parsed.state.localIp === '192.168.1.10') {
          parsed.state.localIp = 'storymee-pc.local';
          changed = true;
        }
        if (typeof parsed.state.hubUrl === 'string' && parsed.state.hubUrl.includes('192.168.1.10')) {
          parsed.state.hubUrl = parsed.state.hubUrl.replace(/192\.168\.1\.10/g, 'storymee-pc.local');
          changed = true;
        }
        if (changed) {
          window.localStorage.setItem('flow-architect-storage', JSON.stringify(parsed));
        }
      }
    }
  } catch (e) {
    console.error('Failed to migrate flow-architect-storage:', e);
  }

  try {
    const customApiUrl = window.localStorage.getItem('STORYMEE_CUSTOM_API_URL');
    if (customApiUrl && customApiUrl.includes('192.168.1.10')) {
      const updatedApiUrl = customApiUrl.replace(/192\.168\.1\.10/g, 'storymee-pc.local');
      window.localStorage.setItem('STORYMEE_CUSTOM_API_URL', updatedApiUrl);
    }
  } catch (e) {
    console.error('Failed to migrate STORYMEE_CUSTOM_API_URL:', e);
  }
}

export const useFlowStore = create<FlowState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      onNodesChange: (changes: NodeChange[]) => {
        set({
          nodes: applyNodeChanges(changes, get().nodes),
        });
      },
      onEdgesChange: (changes: EdgeChange[]) => {
        set({
          edges: applyEdgeChanges(changes, get().edges),
        });
      },
      onConnect: (connection: Connection) => {
        set({
          edges: addEdge({ ...connection, type: 'smoothstep', animated: false, style: { strokeWidth: 2, stroke: '#94a3b8' } }, get().edges),
        });
      },
      setNodes: (nodesOrUpdater) => {
        const nextNodes = typeof nodesOrUpdater === 'function' ? nodesOrUpdater(get().nodes) : nodesOrUpdater;
        set({ nodes: nextNodes });
      },
      setEdges: (edgesOrUpdater) => {
        const nextEdges = typeof edgesOrUpdater === 'function' ? edgesOrUpdater(get().edges) : edgesOrUpdater;
        set({ edges: nextEdges });
      },

      projectData: { 
        id: 'new', 
        name: 'Untitled Storyboard Project', 
        stylePrompt: 'Cinematic lighting, hyperrealistic, 8k resolution, unreal engine 5 render, concept art',
        aspectRatio: '16:9',
        dialogueMode: 'post-sync',
        targetRuntime: 180,
        maxShotCount: 40,
        imageModel: 'auto',
        videoModel: 'auto',
        safetyLocks: ['no-text', 'no-subtitles', 'no-morphing'],
        universeGenre: '',
        worldConstraints: '',
        shotlistPreset: 'universal_cinematic'
      },
      setProjectData: (data) => set({ projectData: data }),

      isDrawerOpen: true,
      setIsDrawerOpen: (isOpen) => set({ isDrawerOpen: isOpen }),

      isSettingOpen: false,
      setIsSettingOpen: (isOpen) => set({ isSettingOpen: isOpen }),

      hoveredAssetId: null,
      setHoveredAssetId: (id) => set({ hoveredAssetId: id }),

      activeDetailBeat: null,
      setActiveDetailBeat: (beatId) => set({ activeDetailBeat: beatId }),
      isRightDrawerCollapsed: false,
      setIsRightDrawerCollapsed: (collapsed) => set({ isRightDrawerCollapsed: collapsed }),

      parsedData: null,
      setParsedData: (data) => set({ parsedData: data }),

      isAnalyzing: false,
      setIsAnalyzing: (is) => set({ isAnalyzing: is }),

      pendingShots: [],
      setPendingShots: (shots) => {
        set({ pendingShots: shots });
        const currentParsed = get().parsedData;
        if (currentParsed) {
          set({ parsedData: { ...currentParsed, shots } });
        }
      },

      activeSceneId: 'all',
      setActiveSceneId: (id) => set({ activeSceneId: id }),

      buildMode: '1x1',

      llmProvider: 'hub',
      geminiKey: '',
      hubToken: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || "",
      hubModel: 'gpt-5.4-mini',

      // Global Settings Properties
      hubUrl: '',
      hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || '',
      sdkUrl: 'https://bapi.vidtory.net',
      sdkApiKey: '',
      geminiApiKey: '',
      activeProvider: 'hub',
      imageProvider: 'hub',
      videoProvider: 'hub',
      hubLlmModel: 'gpt-5.4-mini',
      hubImageModel: 'auto',
      hubVideoModel: 'auto',
      sdkLlmModel: 'gemini-3-flash-preview',
      sdkImageModel: 'imagen-3',
      sdkVideoModel: 'veo-3.1-fast-generate-001',
      googleLlmModel: 'gemini-2.5-flash',
      googleImageModel: 'imagen-3.0-fast-002',
      googleVideoModel: 'veo-2.0-generate-001',
      dreaminaImageModel: 'high_aes_general_v50',
      dreaminaVideoModel: 'dreamina_seedance_40',
      universalNegativePrompt: '',
      disableWebpConversion: false,
      hubConnectionMode: 'staging',
      localIp: '127.0.0.1',
      customProjectRules: [],
      customEpisodeRules: [],
      showRuleBoard: false,
      setShowRuleBoard: (show) => set({ showRuleBoard: show }),

      cinematicWarnings: [],
      cinematicGlueNotes: [],
      setCinematicWarnings: (warnings) => set({ cinematicWarnings: warnings }),
      setCinematicGlueNotes: (notes) => set({ cinematicGlueNotes: notes }),

      setLlmSettings: (settings) => {
        set((state) => {
          const newState = {
            llmProvider: settings.provider ?? state.llmProvider,
            geminiKey: settings.geminiKey ?? state.geminiKey,
            hubToken: settings.hubToken ?? state.hubToken,
            hubModel: settings.hubModel ?? state.hubModel,
            
            // Keep in sync with corresponding global fields
            geminiApiKey: settings.geminiKey ?? state.geminiApiKey,
            hubApiKey: settings.hubToken ?? state.hubApiKey,
            hubLlmModel: settings.hubModel ?? state.hubLlmModel
          };
          if (settings.provider) {
            localStorage.setItem('STORYMEE_LLM_PROVIDER', settings.provider);
            newState.llmProvider = settings.provider;
          }
          if (settings.geminiKey) localStorage.setItem('STORYMEE_GEMINI_KEY', settings.geminiKey);
          if (settings.hubToken) localStorage.setItem('STORYMEE_HUB_TOKEN', settings.hubToken);
          if (settings.hubModel) localStorage.setItem('STORYMEE_HUB_MODEL', settings.hubModel);
          return newState;
        });
      },

      renderingStates: {},
      videoStates: {},
      setRenderingState: (shotId, state) => set((prev) => ({
        renderingStates: { ...prev.renderingStates, [shotId]: state }
      })),
      setVideoState: (shotId, state) => set((prev) => ({
        videoStates: { ...prev.videoStates, [shotId]: state }
      })),
      updateShot: (shotId, field, value) => {
        const pendingShots = get().pendingShots;
        const updated = pendingShots.map((sh: any) => {
          if (sh.beat === shotId || sh.id === shotId) {
            const updatedShot = { ...sh };
            if (typeof field === 'object') {
              Object.assign(updatedShot, field);
            } else {
              updatedShot[field] = value;
            }
            // Sync legacy fields
            if (updatedShot.diễn_tả) updatedShot.description = updatedShot.diễn_tả;
            if (updatedShot.description) updatedShot.diễn_tả = updatedShot.description;
            if (updatedShot.thoại) updatedShot.dialogue = updatedShot.thoại;
            if (updatedShot.dialogue) updatedShot.thoại = updatedShot.dialogue;
            if (updatedShot.storyboardPrompt) updatedShot.visual = updatedShot.storyboardPrompt;
            if (updatedShot.visual) updatedShot.storyboardPrompt = updatedShot.visual;
            return updatedShot;
          }
          return sh;
        });
        get().setPendingShots(updated);
      },

      updateGlobalSettings: (settings) => {
        set((state) => {
          const newState = {
            ...state,
            ...settings,
            // Keep legacy ones in sync
            llmProvider: settings.llmProvider ?? settings.activeProvider ?? state.llmProvider,
            geminiKey: settings.geminiApiKey ?? state.geminiKey,
            hubToken: settings.hubApiKey ?? state.hubToken,
            hubModel: settings.hubLlmModel ?? state.hubModel,
            disableWebpConversion: settings.disableWebpConversion ?? state.disableWebpConversion
          };
          return newState;
        });
      }
    }),
    {
      name: 'flow-architect-storage', // Tên key trong localStorage
      partialize: (state) => ({ // Chỉ lưu những state này xuống ổ cứng
        llmProvider: state.llmProvider,
        geminiKey: state.geminiKey,
        hubToken: state.hubToken,
        hubModel: state.hubModel,
        projectData: state.projectData,
        buildMode: state.buildMode,
        hubConnectionMode: state.hubConnectionMode,
        localIp: state.localIp,
        
        hubUrl: state.hubUrl,
        hubApiKey: state.hubApiKey,
        sdkUrl: state.sdkUrl,
        sdkApiKey: state.sdkApiKey,
        geminiApiKey: state.geminiApiKey,
        activeProvider: state.activeProvider,
        imageProvider: state.imageProvider,
        videoProvider: state.videoProvider,
        hubLlmModel: state.hubLlmModel,
        hubImageModel: state.hubImageModel,
        hubVideoModel: state.hubVideoModel,
        sdkLlmModel: state.sdkLlmModel,
        sdkImageModel: state.sdkImageModel,
        sdkVideoModel: state.sdkVideoModel,
        googleLlmModel: state.googleLlmModel,
        googleImageModel: state.googleImageModel,
        googleVideoModel: state.googleVideoModel,
        dreaminaImageModel: state.dreaminaImageModel,
        dreaminaVideoModel: state.dreaminaVideoModel,
        universalNegativePrompt: state.universalNegativePrompt,
        disableWebpConversion: state.disableWebpConversion,
        customProjectRules: state.customProjectRules,
        customEpisodeRules: state.customEpisodeRules,
        nodes: state.nodes,
        edges: state.edges,
        parsedData: state.parsedData,
        pendingShots: state.pendingShots,
        cinematicWarnings: state.cinematicWarnings,
        cinematicGlueNotes: state.cinematicGlueNotes
      }),
      storage: createJSONStorage(() => debouncedLocalStorage),
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).__flow_store__ = useFlowStore;
}
