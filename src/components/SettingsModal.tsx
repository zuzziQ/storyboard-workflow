import { useState, useEffect } from 'react';
import { Settings, X, Check, Loader2, Globe, Key, Cpu, Film, ImageIcon, RefreshCw, Sliders } from 'lucide-react';
import { ConnectionSettings } from './Settings/ConnectionSettings';
import { ProviderSettings } from './Settings/ProviderSettings';
import { useFlowStore } from '../store/useFlowStore';
import { getApiBaseUrl, sanitizeHubUrl, fetchWithTimeout } from '../utils/apiConfig';

export default function SettingsModal() {
  const isSettingOpen = useFlowStore((state) => state.isSettingOpen);
  const setIsSettingOpen = useFlowStore((state) => state.setIsSettingOpen);
  const store = useFlowStore();

  // Local Settings states
  const [hubUrl, setHubUrl] = useState('');
  const [hubConnectionMode, setHubConnectionMode] = useState<'vps' | 'staging' | 'local'>('staging');
  const [localIp, setLocalIp] = useState('127.0.0.1');

  // Sync calculated Hub Base URL and Custom Local API Override based on connection mode & local IP
  useEffect(() => {
    if (hubConnectionMode === 'vps') {
      setHubUrl('https://hub.storymee.com');
      setCustomApiUrl('');
    } else if (hubConnectionMode === 'staging') {
      setHubUrl('https://dev-hub.storymee.com');
      setCustomApiUrl('');
    } else {
      setHubUrl(`http://${localIp}:5100`);
      setCustomApiUrl(`http://${localIp}:5100`);
    }
  }, [hubConnectionMode, localIp]);

  const [hubApiKey, setHubApiKey] = useState('');
  const [sdkUrl, setSdkUrl] = useState('https://bapi.vidtory.net');
  const [sdkApiKey, setSdkApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  const [llmProvider, setLlmProvider] = useState<'hub' | 'sdk' | 'google-native'>('hub');
  const [imageProvider, setImageProvider] = useState<'hub' | 'sdk' | 'google-native' | 'dreamina'>('hub');
  const [videoProvider, setVideoProvider] = useState<'hub' | 'sdk' | 'google-native' | 'dreamina'>('hub');

  const [hubLlmModel, setHubLlmModel] = useState('gpt-5.4-mini');
  const [hubImageModel, setHubImageModel] = useState('auto');
  const [hubVideoModel, setHubVideoModel] = useState('auto');
  
  const [sdkLlmModel, setSdkLlmModel] = useState('gemini-3-flash-preview');
  const [sdkImageModel, setSdkImageModel] = useState('imagen-3');
  const [sdkVideoModel, setSdkVideoModel] = useState('veo-3.1-fast-generate-001');
  
  const [googleLlmModel, setGoogleLlmModel] = useState('gemini-2.5-flash');
  const [googleImageModel, setGoogleImageModel] = useState('imagen-3.0-fast-002');
  const [googleVideoModel, setGoogleVideoModel] = useState('veo-2.0-generate-001');

  const [dreaminaImageModel, setDreaminaImageModel] = useState('high_aes_general_v50');
  const [dreaminaVideoModel, setDreaminaVideoModel] = useState('dreamina_seedance_40');
  
  const [universalNegativePrompt, setUniversalNegativePrompt] = useState('');
  const [customApiUrl, setCustomApiUrl] = useState('');
  const [buildMode, setBuildMode] = useState<'1x1' | 'consolidated'>('1x1');

  // ZLProxy configurations
  const [zlproxyKey, setZlproxyKey] = useState('');
  const [useZlproxyForGflow, setUseZlproxyForGflow] = useState(false);
  const [useZlproxyForAIWorkers, setUseZlproxyForAIWorkers] = useState(true);
  const [disableWebpConversion, setDisableWebpConversion] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);


  // Load custom api url on init
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = (store.hubConnectionMode || 'staging') as 'vps' | 'staging' | 'local';
      const savedIp = store.localIp || '127.0.0.1';
      setHubConnectionMode(savedMode);
      setLocalIp(savedIp);
    }
  }, [isSettingOpen, store.hubConnectionMode, store.localIp]);

  const loadGlobalSettings = async () => {
    setIsLoading(true);
    try {
      const savedMode = (store.hubConnectionMode || 'staging') as 'vps' | 'staging' | 'local';
      const savedIp = store.localIp || '127.0.0.1';
      setHubConnectionMode(savedMode);
      setLocalIp(savedIp);

      const resolvedHubUrl = savedMode === 'local' 
        ? `http://${savedIp}:5100` 
        : savedMode === 'staging' ? 'https://dev-hub.storymee.com' : 'https://hub.storymee.com';
      setHubUrl(resolvedHubUrl);
      
      setHubApiKey(store.hubApiKey || store.hubToken || localStorage.getItem('STORYMEE_HUB_API_KEY') || '');
      setSdkUrl(store.sdkUrl || 'https://bapi.vidtory.net');
      setSdkApiKey(store.sdkApiKey || '');
      setGeminiApiKey(store.geminiApiKey || '');
      
      setLlmProvider((store.llmProvider as any) || 'hub');
      setImageProvider((store.imageProvider as any) || 'hub');
      setVideoProvider((store.videoProvider as any) || 'hub');
      
      const mapLegacyModel = (m: string) => {
        if (m === 'google-flow') return 'narwhal';
        if (m === 'iilabs') return 'banana2';
        return m;
      };
      setHubLlmModel(store.hubLlmModel || 'gpt-5.4-mini');
      setHubImageModel(mapLegacyModel(store.hubImageModel || 'auto'));
      setHubVideoModel(store.hubVideoModel || 'auto');
      
      setSdkLlmModel(store.sdkLlmModel || 'gemini-3-flash-preview');
      setSdkImageModel(store.sdkImageModel || 'imagen-3');
      setSdkVideoModel(store.sdkVideoModel || 'veo-3.1-fast-generate-001');
      
      setGoogleLlmModel(store.googleLlmModel || 'gemini-2.5-flash');
      setGoogleImageModel(store.googleImageModel || 'imagen-3.0-fast-002');
      setGoogleVideoModel(store.googleVideoModel || 'veo-2.0-generate-001');

      setDreaminaImageModel(store.dreaminaImageModel || 'high_aes_general_v50');
      setDreaminaVideoModel(store.dreaminaVideoModel || 'dreamina_seedance_40');
      
      setUniversalNegativePrompt(store.universalNegativePrompt || '');
      setBuildMode(store.buildMode || '1x1');
      setZlproxyKey(store.zlproxyKey || '');
      setUseZlproxyForGflow(store.useZlproxyForGflow !== undefined ? store.useZlproxyForGflow : false);
      setUseZlproxyForAIWorkers(store.useZlproxyForAIWorkers !== undefined ? store.useZlproxyForAIWorkers : true);
      setDisableWebpConversion(store.disableWebpConversion !== undefined ? store.disableWebpConversion : false);
    } catch (e: any) {
      console.warn('Failed to load settings:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isSettingOpen) {
      loadGlobalSettings();
    }
  }, [isSettingOpen]);

  const handleSave = async () => {
    setIsSavingSettings(true);
    try {
      const updatedData = {
        hubUrl,
        hubApiKey,
        sdkUrl,
        sdkApiKey,
        geminiApiKey,
        activeProvider: llmProvider,
        llmProvider,
        imageProvider,
        videoProvider,
        hubLlmModel,
        hubImageModel,
        hubVideoModel,
        sdkLlmModel,
        sdkImageModel,
        sdkVideoModel,
        googleLlmModel,
        googleImageModel,
        googleVideoModel,
        dreaminaImageModel,
        dreaminaVideoModel,
        universalNegativePrompt,
        buildMode,
        zlproxyKey,
        useZlproxyForGflow,
        useZlproxyForAIWorkers,
        disableWebpConversion
      };

      // Always update local Zustand store
      store.updateGlobalSettings({
        ...updatedData,
        hubConnectionMode,
        localIp,
      });

      // Save custom api url override and Hub API Key
      if (typeof window !== 'undefined') {
        localStorage.setItem('STORYMEE_HUB_API_KEY', hubApiKey);
        const finalCustomUrl = hubConnectionMode === 'local' ? `http://${localIp}:5100` : '';
        if (finalCustomUrl) {
          localStorage.setItem('STORYMEE_CUSTOM_API_URL', finalCustomUrl);
        } else {
          localStorage.removeItem('STORYMEE_CUSTOM_API_URL');
        }
      }

      alert('✅ Đã lưu cấu hình hệ thống thành công!');
      setIsSettingOpen(false);
    } catch (err) {
      console.error('Error saving settings:', err);
      alert('⚠️ Lỗi khi lưu cấu hình!');
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (!isSettingOpen) return null;

  const showSdkFields = llmProvider === 'sdk' || imageProvider === 'sdk' || videoProvider === 'sdk';
  const showGoogleFields = llmProvider === 'google-native' || imageProvider === 'google-native' || videoProvider === 'google-native';

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
      <div className="bg-[#0f172a] border border-[#334155]/60 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
        {/* Glow effects */}
        <div className="absolute -top-16 -left-16 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-pink-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500" />

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#334155]/40 bg-[#1e293b]/20">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-500/15 rounded-lg text-purple-400">
              <Sliders size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Global Engine Settings</h2>
              <p className="text-xs text-slate-400">Configure connection endpoints, AI models & credentials</p>
            </div>
          </div>
          <button 
            onClick={() => setIsSettingOpen(false)}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        {/* Body (Scrollable) */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar text-left font-sans">
          
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 bg-slate-900/40 border border-slate-800/50 rounded-xl">
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              <span className="text-xs text-slate-400">Syncing settings from OMNI Core...</span>
            </div>
          )}

          {/* SECTION 1: GLOBAL GATEWAY OVERRIDE */}
          <ConnectionSettings 
            hubConnectionMode={hubConnectionMode}
            setHubConnectionMode={setHubConnectionMode}
            localIp={localIp}
            setLocalIp={setLocalIp}
            hubUrl={hubUrl}
          />

          {/* SECTION 2: ACCESS KEY AND TOKENS */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-3.5">
            <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <Key className="w-3.5 h-3.5" /> 2. Credentials & Tokens
            </h4>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Hub Access Key / Bearer Token</label>
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">REQUIRED</span>
                </div>
                <input
                  type="password"
                  value={hubApiKey}
                  onChange={(e) => setHubApiKey(e.target.value)}
                  placeholder="Enter your sk-hub-... token"
                  className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-2.5 outline-none text-xs transition-all font-mono"
                />
              </div>

              {showSdkFields && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800/50 animate-in slide-in-from-top-1 duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vidtory SDK Base URL</label>
                    <input
                      type="text"
                      value={sdkUrl}
                      onChange={(e) => setSdkUrl(e.target.value)}
                      placeholder="https://bapi.vidtory.net"
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-2.5 outline-none text-xs transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vidtory SDK Key</label>
                    <input
                      type="password"
                      value={sdkApiKey}
                      onChange={(e) => setSdkApiKey(e.target.value)}
                      placeholder="vidtory_..."
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-2.5 outline-none text-xs transition-all font-mono"
                    />
                  </div>
                </div>
              )}

              {showGoogleFields && (
                <div className="space-y-1 pt-2 border-t border-slate-800/50 animate-in slide-in-from-top-1 duration-150">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Google Gemini API Key (Native)</label>
                  <input
                    type="password"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-2.5 outline-none text-xs transition-all font-mono"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: PROVIDERS FOR LLM, IMAGE & VIDEO */}
          <ProviderSettings
            llmProvider={llmProvider} setLlmProvider={setLlmProvider}
            imageProvider={imageProvider} setImageProvider={setImageProvider}
            videoProvider={videoProvider} setVideoProvider={setVideoProvider}
          />

          {/* SECTION 4: AI MODEL SELECTION */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-3.5">
            <h4 className="text-[11px] font-bold text-pink-400 uppercase tracking-widest flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" /> 4. AI Models Assignment
            </h4>

            <div className="space-y-4">
              {/* Hub Gateway defaults */}
              <div className="p-3.5 bg-[#090d16]/60 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    ☁️ Hub Gateway Defaults
                  </span>
                  {(llmProvider === 'hub' || imageProvider === 'hub' || videoProvider === 'hub') && (
                    <span className="text-[9px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">Active</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">LLM Model</label>
                    <select
                      value={hubLlmModel}
                      onChange={(e) => setHubLlmModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="gpt-5.4-mini">GPT 5.4 Mini</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Image Model</label>
                    <select
                      value={hubImageModel}
                      onChange={(e) => setHubImageModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="narwhal">Google Flow (Narwhal)</option>
                      <option value="banana2">IILabs (Banana2)</option>
                      <option value="omni-flash-3">Omni Flash 3</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Video Model</label>
                    <select
                      value={hubVideoModel}
                      onChange={(e) => setHubVideoModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="auto">Auto (Tự động)</option>
                      <option value="luma">Luma</option>
                      <option value="kling">Kling</option>
                      <option value="runway">Runway</option>
                      <option value="veo_3_1_lite_low_priority">Veo 3.1 (Low Priority)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Vidtory SDK defaults */}
              <div className="p-3.5 bg-[#090d16]/60 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    🔌 Vidtory SDK Defaults
                  </span>
                  {(llmProvider === 'sdk' || imageProvider === 'sdk' || videoProvider === 'sdk') && (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">Active</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">LLM Model</label>
                    <select
                      value={sdkLlmModel}
                      onChange={(e) => setSdkLlmModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Image Model</label>
                    <select
                      value={sdkImageModel}
                      onChange={(e) => setSdkImageModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="imagen-3">Imagen 3</option>
                      <option value="flux-schnell">Flux Schnell</option>
                      <option value="flux-dev">Flux Dev</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Video Model</label>
                    <select
                      value={sdkVideoModel}
                      onChange={(e) => setSdkVideoModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="veo-3.1-fast-generate-001">Veo 3.1 Fast</option>
                      <option value="veo-2">Veo 2</option>
                      <option value="luma-dream-machine">Luma Dream Machine</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Google Native defaults */}
              <div className="p-3.5 bg-[#090d16]/60 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                    🤖 Google Native Defaults
                  </span>
                  {(llmProvider === 'google-native' || imageProvider === 'google-native' || videoProvider === 'google-native') && (
                    <span className="text-[9px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full font-bold">Active</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">LLM Model</label>
                    <select
                      value={googleLlmModel}
                      onChange={(e) => setGoogleLlmModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                      <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                      <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Image Model</label>
                    <select
                      value={googleImageModel}
                      onChange={(e) => setGoogleImageModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="imagen-3.0-generate-002">Imagen 3.0 Gen</option>
                      <option value="imagen-3.0-fast-002">Imagen 3.0 Fast</option>
                      <option value="imagen-3.0-fast-00">Imagen 3.0 Fast (00)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Video Model</label>
                    <select
                      value={googleVideoModel}
                      onChange={(e) => setGoogleVideoModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="veo-2.0-generate-001">Veo 2.0 (Native)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Dreamina defaults */}
              <div className="p-3.5 bg-[#090d16]/60 rounded-xl border border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">
                    🎨 Dreamina Defaults
                  </span>
                  {(imageProvider === 'dreamina' || videoProvider === 'dreamina') && (
                    <span className="text-[9px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-bold">Active</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Image Model</label>
                    <select
                      value={dreaminaImageModel}
                      onChange={(e) => setDreaminaImageModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="high_aes_gpt_v20">GPT Image 2 (New)</option>
                      <option value="high_aes_general_v50">Image 5.0 Lite</option>
                      <option value="high_aes_general_v47">Image 4.7 (New)</option>
                      <option value="high_aes_general_v46">Image 4.6</option>
                      <option value="high_aes_general_v45">Image 4.5</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Video Model</label>
                    <select
                      value={dreaminaVideoModel}
                      onChange={(e) => setDreaminaVideoModel(e.target.value)}
                      className="w-full bg-[#090d16] border border-[#334155]/50 text-white rounded-xl p-2 outline-none text-xs cursor-pointer"
                    >
                      <option value="dreamina_seedance_40_mini">Dreamina Seedance 2.0 Mini (New)</option>
                      <option value="dreamina_seedance_40">Dreamina Seedance 2.0 Fast (New)</option>
                      <option value="dreamina_seedance_40_pro">Dreamina Seedance 2.0 (New)</option>
                      <option value="dreamina_lib_sync_image_quick_1.5">Dreamina Seedance 1.5 Pro (New)</option>
                      <option value="dreamina_seedance_10">Dreamina Seedance 1.0</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: STORYBOARD BUILD LAYOUT MODE */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-3">
            <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5" /> 5. Storyboard Canvas Layout Mode
            </h4>
            
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 bg-[#090d16] p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setBuildMode('1x1')}
                  className={`py-2.5 px-3 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider flex flex-col items-center gap-1 ${
                    buildMode === '1x1'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>1x1 Node Column Mode</span>
                  <span className="text-[9px] font-normal lowercase text-slate-300">Individual shot nodes</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBuildMode('consolidated')}
                  className={`py-2.5 px-3 rounded-lg text-[10px] font-bold transition-all uppercase tracking-wider flex flex-col items-center gap-1 ${
                    buildMode === 'consolidated'
                      ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50'
                  }`}
                >
                  <span>Consolidated Master Board</span>
                  <span className="text-[9px] font-normal lowercase text-slate-300">Single scrollable list node</span>
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 6: NEGATIVE PROMPT */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-2">
            <h4 className="text-[11px] font-bold text-rose-400 uppercase tracking-widest flex items-center gap-2">
              🚫 Universal Negative Prompt
            </h4>
            <span className="text-[9px] text-slate-500 block leading-tight">Automatically added to block artifacts or unwanted elements.</span>
            <textarea
              rows={2}
              value={universalNegativePrompt}
              onChange={(e) => setUniversalNegativePrompt(e.target.value)}
              placeholder="e.g. blurry, deformed hands, low quality, cartoon, 3d render..."
              className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-3 outline-none text-xs resize-none transition-all font-mono"
            />
          </div>

          {/* SECTION 7: ZLPROXY CONFIGURATION */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-3.5">
            <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest flex items-center gap-2">
              🌐 ZLProxy Network Configuration
            </h4>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">ZLProxy API Key (Residential Proxy)</label>
                <input
                  type="password"
                  value={zlproxyKey}
                  onChange={(e) => setZlproxyKey(e.target.value)}
                  placeholder="Enter ZLProxy key to rotate residential IPs"
                  className="w-full bg-[#090d16] border border-[#334155]/50 text-white placeholder-slate-700 rounded-xl p-2.5 outline-none text-xs transition-all font-mono"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/50 font-sans">
                <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useZlproxyForGflow}
                    onChange={(e) => setUseZlproxyForGflow(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-800 bg-[#090d16] text-purple-600 focus:ring-purple-500/20 mt-0.5"
                  />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-white block">Enable ZLProxy for GFlow Worker</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Use proxy for Google Flow jobs. Normally disabled to run on raw local IP.</span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 cursor-pointer select-none mt-1">
                  <input
                    type="checkbox"
                    checked={useZlproxyForAIWorkers}
                    onChange={(e) => setUseZlproxyForAIWorkers(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-800 bg-[#090d16] text-purple-600 focus:ring-purple-500/20 mt-0.5"
                  />
                  <div className="text-left">
                    <span className="text-xs font-semibold text-white block">Enable ZLProxy for AI Workers (Dreamina, Picsart, Topview)</span>
                    <span className="text-[9px] text-slate-500 block leading-tight">Use proxy for automation tasks to bypass account auth/bot checks.</span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* SECTION 8: IMAGE QUALITY CONFIGURATION */}
          <div className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-4 space-y-3.5">
            <h4 className="text-[11px] font-bold text-sky-400 uppercase tracking-widest flex items-center gap-2">
              🖼️ Image Quality & Format Settings
            </h4>
            
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/50 font-sans">
              <label className="flex items-start space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={disableWebpConversion}
                  onChange={(e) => setDisableWebpConversion(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-800 bg-[#090d16] text-purple-600 focus:ring-purple-500/20 mt-0.5"
                />
                <div className="text-left">
                  <span className="text-xs font-semibold text-white block">Disable WebP Conversion (Keep Original Quality)</span>
                  <span className="text-[9px] text-slate-500 block leading-tight">When enabled, generated or downloaded images will be saved in their original formats (PNG/JPEG) instead of being automatically compressed and converted to WebP.</span>
                </div>
              </label>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 bg-[#090d16] border-t border-[#334155]/30">
          <div className="flex gap-2 font-sans">
            <button
              onClick={() => setIsSettingOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 border border-slate-800/80 text-slate-400 transition-colors"
              disabled={isSavingSettings}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              disabled={isSavingSettings || isLoading}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-500 text-white rounded-xl hover:from-purple-500 hover:to-pink-400 transition-all font-bold text-xs tracking-wide shadow-lg shadow-purple-500/20 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-3 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
