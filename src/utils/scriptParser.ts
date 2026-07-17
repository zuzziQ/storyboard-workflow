import { getApiBaseUrl, sanitizeHubUrl } from "./apiConfig";
import { cleanLocationName } from "./assetMatcher";
import { llmService } from "../services/llm/llmService";

export interface AssetData {
  name: string;
  description: string;
  aliases?: string | string[];
}

// ─── Emotional Arc Types ────────────────────────────────────────────────────
export interface EmotionBeat {
  sceneId: string;
  intensity: number;  // 0-100
  valence: 'positive' | 'negative' | 'neutral' | 'tense' | 'melancholic';
  emotion: string;    // e.g. "anticipation", "dread", "relief"
  arcPosition: 'setup' | 'inciting' | 'rising' | 'climax' | 'falling' | 'resolution';
  transitionHint?: string;
  lighting?: string;  // suggested lighting mood for the scene
  weather?: string;   // weather/atmosphere suggestion
  soundCue?: string;  // ambient sound suggestion
}

export interface BridgeHint {
  afterSceneId: string;
  beforeSceneId: string;
  suggestedType: 'time_skip' | 'location_shift' | 'mood_shift' | 'reveal' | 'contrast' | 'cutaway';
  description: string;
  urgency: 'required' | 'suggested' | 'optional';
  timeSkip?: string;  // e.g. "3 hours later", "next morning"
}
// ────────────────────────────────────────────────────────────────────────────

export interface ParsedShot {
  sceneId: string;
  shotNumber?: number;
  description?: string;
  dialogue?: string;
  duration?: number;
  cameraMovement?: string;
  framing?: string;
  angle?: string;
  firstFrameState?: string;
  plannedLastFrame?: string;
  physicalMotionDelta?: string;
  propState?: string;
  visualBridge?: string;
  camera?: string;
  background?: string;
  characters?: string;
  action?: string;
  [key: string]: any;
}

export interface ParsedScript {
  scriptText: string;
  scriptSummary?: string;
  estimatedDuration?: string;
  totalScenes?: number;
  totalShots?: number;
  characters: AssetData[];
  locations: AssetData[];
  props?: AssetData[];
  scenes: SceneData[];
  shots?: ParsedShot[];
  // ── Emotional Intelligence ──
  emotionArc?: EmotionBeat[];      // per-scene emotional data
  bridgeHints?: BridgeHint[];      // suggested inter-scene bridges
  scriptQuality?: 'rich' | 'medium' | 'sparse'; // drives AI gap-filling
  isImported?: boolean;
}

export interface SceneData {
  id: string;
  sceneId?: string;
  location: string;
  timeOfDay: string;
  sceneDescription?: string;
  action: string;
  charactersInScene: string[];
  primaryCharacters?: string[];
  secondaryCharacters?: string[];
  props?: string[];
  dialogs?: string[];
  transitions?: string[];
  storyboardPrompt?: string;
  // ── Emotional Fields ──
  emotionIntensity?: number;       // 0-100
  valence?: string;
  arcPosition?: string;
  isReady?: boolean;               // ScenePrepNode checkpoint
  prepNotes?: string;              // user notes from ScenePrepNode
  aiSuggestions?: string[];        // AI gap-fill suggestions
  moodShift?: string;
  moodShiftOut?: string;
  moodShiftPurpose?: string;
  storyDirection?: string;
  scenePurpose?: string;
  emotionHook?: string;
  outerSetup?: boolean;
}

// Helper function to get synchronized settings from Zustand store or fallbacks
function getLlmSettings() {
  try {
    // 1. Try Zustand store state first (guaranteed up-to-date in memory)
    const state = (window as any).__flow_store__?.getState();
    if (state && state.llmProvider) {
      return {
        llmProvider: state.llmProvider,
        geminiApiKey: state.geminiApiKey || '',
        hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || state.hubApiKey || import.meta.env.VITE_HUB_API_KEY || "",
        hubUrl: sanitizeHubUrl(state.hubUrl) || '',
        hubLlmModel: state.hubLlmModel || 'gpt-5.4-mini',
        sdkUrl: state.sdkUrl || 'https://bapi.vidtory.net',
        sdkApiKey: state.sdkApiKey || '',
        sdkLlmModel: state.sdkLlmModel || 'gemini-3-flash-preview',
        googleLlmModel: state.googleLlmModel || 'gemini-2.5-flash',
        
        // Legacy fallbacks for safety
        provider: state.llmProvider,
        geminiKey: state.geminiApiKey || '',
        hubToken: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || state.hubApiKey || import.meta.env.VITE_HUB_API_KEY || "",
        hubModel: state.hubLlmModel || 'gpt-5.4-mini'
      };
    }
  } catch (e) {
    console.error("Zustand getState failed in getLlmSettings, falling back to localStorage:", e);
  }

  try {
    const persisted = localStorage.getItem('flow-architect-storage');
    if (persisted) {
      const parsed = JSON.parse(persisted);
      if (parsed.state) {
        return {
          llmProvider: parsed.state.llmProvider || 'hub',
          geminiApiKey: parsed.state.geminiApiKey || '',
          hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || parsed.state.hubApiKey || import.meta.env.VITE_HUB_API_KEY || "",
          hubUrl: sanitizeHubUrl(parsed.state.hubUrl) || '',
          hubLlmModel: parsed.state.hubLlmModel || 'gpt-5.4-mini',
          sdkUrl: parsed.state.sdkUrl || 'https://bapi.vidtory.net',
          sdkApiKey: parsed.state.sdkApiKey || '',
          sdkLlmModel: parsed.state.sdkLlmModel || 'gemini-3-flash-preview',
          googleLlmModel: parsed.state.googleLlmModel || 'gemini-2.5-flash',
          
          // Legacy fallbacks for safety
          provider: parsed.state.llmProvider || 'hub',
          geminiKey: parsed.state.geminiApiKey || '',
          hubToken: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || parsed.state.hubApiKey || import.meta.env.VITE_HUB_API_KEY || "",
          hubModel: parsed.state.hubLlmModel || 'gpt-5.4-mini'
        };
      }
    }
  } catch (e) {
    console.error("Error reading persisted settings:", e);
  }
  return {
    llmProvider: 'hub',
    geminiApiKey: '',
    hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || "",
    hubUrl: '',
    hubLlmModel: 'gpt-5.4-mini',
    sdkUrl: 'https://bapi.vidtory.net',
    sdkApiKey: '',
    sdkLlmModel: 'gemini-3-flash-preview',
    googleLlmModel: 'gemini-2.5-flash',
    
    // Legacy fallbacks
    provider: 'hub',
    geminiKey: '',
    hubToken: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || "",
    hubModel: 'gpt-5.4-mini'
  };
}

// Gọi API Gemini trực tiếp (Client-Side) để tránh Timeout
function cleanAndParseJSON(rawContent: any): any {
  if (!rawContent) return null;
  if (typeof rawContent !== 'string') {
    if (typeof rawContent === 'object') {
      return rawContent;
    }
    rawContent = String(rawContent);
  }
  let cleaned = rawContent.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // Strip markdown block markers (```json or ```)
  cleaned = cleaned
    .replace(/^```(?:json|javascript)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // Extract the first JSON boundary {...}
  const startIdx = cleaned.indexOf("{");
  const endIdx = cleaned.lastIndexOf("}");
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const jsonCandidate = cleaned.substring(startIdx, endIdx + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (innerErr) {
      console.warn("[JSON Clean] Failed to parse extracted substring:", innerErr);
    }
  }

  throw new Error("Không thể trích xuất JSON hợp lệ từ phản hồi của AI.");
}

async function smartFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return await fetch(url, options);
}

// Unified client-side executor for text/prompt prompts across all providers
async function executePrompt(
  systemPrompt: string, 
  userPrompt: string, 
  jobType: string, 
  purpose: string, 
  projectName: string
): Promise<string> {
  return await llmService.execute(systemPrompt, userPrompt, { jobType, purpose, projectName });
}

async function callHubAPI(promptOrText: string, token: string, existingAssets?: any[]): Promise<ParsedScript> {
  const settings = getLlmSettings();
  const hubUrl = settings.hubUrl ? settings.hubUrl.replace(/\/$/, '') : getApiBaseUrl();
  const HUB_API_URL = `${hubUrl}/api/media/prompt`;
  
  let assetsContext = "";
  if (existingAssets && existingAssets.length > 0) {
    const chars = existingAssets.filter((a: any) => a.entityType === 'character' || !a.entityType).map((a: any) => `- Character: "${a.name}" (${a.description || 'no description'})`);
    const locs = existingAssets.filter((a: any) => a.entityType === 'location').map((a: any) => `- Location: "${a.name}" (${a.description || 'no description'})`);
    const props = existingAssets.filter((a: any) => a.entityType === 'prop').map((a: any) => `- Prop: "${a.name}" (${a.description || 'no description'})`);
    
    assetsContext = `\nCRITICAL ASSET REUSABILITY RULES:\nHere is the list of existing assets in our World Asset Database:\n` + 
      [...chars, ...locs, ...props].join('\n') + 
      `\n\nWhenever the screenplay references a character, location, or prop that resembles or matches any items in this existing library, you MUST strictly use the EXACT name of the existing asset. Do NOT invent new names, spelling variations, or synonyms (e.g. if the list contains "Kính lúp của Kilo", do not name it "Kính lúp" or "Kính lúp nhỏ"; if the list contains "Quảng trường Thị Trấn", do not name it "Quảng trường nhỏ" or "Khu phố"). Reusing the exact names is critical for matching database references.\n\n`;
  }

  const systemPrompt = `You are a professional Screenwriter and AI Script Analyzer.
The user provides a raw story idea.${assetsContext}
CRITICAL RULES:
1. CONCISE: Focus only on extracting the main plot points.
2. STRICT ADHERENCE: DO NOT invent completely unrelated new characters. Stick exactly to the characters provided in the input.
3. FORMAT: Use exact screenplay format.
4. DYNAMIC SCENE & SHOT SPLITTING:
   - "scenes" contains narrative scenes (representing high-level settings and story segments).
   - "shots" contains detailed sequential visual shots/beats.
   - Each narrative scene MUST consist of 4 to 8 shots depending on the story complexity.
   - Each shot has a duration of AT LEAST 4 seconds (e.g. integer 4, 5, 6, 8, etc.). The sum of all shot durations must exactly equal the requested story duration (e.g., 180 seconds for a 3-minute story).
   - For a 3-minute story (180s), you must generate about 6 to 10 narrative scenes containing a total of 30 to 45 shots.
   - For each shot, specify: "kind" (framing/shot type, e.g., Wide Shot, Close-Up, Medium Shot, Extreme Close-Up), "function" (dramatic narrative function, e.g., Establishing Setting, Action, Character Reaction, Detail Shot, Climax, Resolution), "causalLink" (how this shot logically links/leads to the next shot, ensuring strong cause-and-effect continuity), and "qcAssessment" (an evaluation assessment of consistency and narrative logic).
   - Storyboard images are generated as a single 1x1 image frame, NOT a 2x2 grid.
Return ONLY valid JSON:
{
  "scriptSummary": "A 1-sentence story summary",
  "estimatedDuration": "X min Y sec",
  "totalScenes": 6,
  "totalShots": 45,
  "characters": [
    { "name": "CHARACTER_NAME", "aliases": ["alias1", "alias2"], "description": "Visual description of species, appearance, clothing." }
  ],
  "locations": [
    { "name": "LOCATION_NAME", "aliases": ["alias1", "alias2"], "description": "Cinematic environmental description, mood, lighting." }
  ],
  "props": [
    { "name": "PROP_NAME", "aliases": ["alias1", "alias2"], "description": "Visual description of the prop." }
  ],
  "scenes": [
    {
      "id": "Scene 1",
      "location": "LOCATION_NAME",
      "timeOfDay": "DAY",
      "sceneDescription": "One sentence summary of what happens.",
      "charactersInScene": ["CHARACTER_NAME"]
    }
  ],
  "shots": [
    {
      "beat": "Shot 1.1",
      "sceneId": "Scene 1",
      "location": "LOCATION_NAME",
      "timeOfDay": "DAY",
      "description": "Visual action of this shot. Describe setup, environment, clothing, action, and lighting clearly.",
      "thoại": "CHARACTER: Dialog line.",
      "kind": "Medium Shot",
      "function": "Rising Action",
      "causalLink": "Logical connection/continuity to next shot.",
      "qcAssessment": "QC Evaluation: Validated continuity of action and character placement.",
      "detectedCharacters": ["CHARACTER_NAME"],
      "detectedProps": [],
      "duration": 4
    }
  ]
}`;

  const suffixOverride = "\n\n(SYSTEM OVERRIDE: Phân chia số lượng Cảnh và Shot dựa theo độ dài câu chuyện của User. Mỗi Cảnh gồm 4-8 Shot liên quan. Mỗi Shot có thời lượng tối thiểu 4 giây (thường từ 4s đến 8s). Tổng số lượng Shot cho phim 3 phút (180 giây) phải đạt khoảng 30-45 Shot để phủ đầy ý và chi tiết kịch bản, tổng thời lượng của tất cả Shot cộng lại phải bằng đúng thời lượng kịch bản.)";
  
  const hubModel = localStorage.getItem('STORYMEE_HUB_MODEL') || 'gpt-5.4-mini';
  let response;
  try {
    response = await smartFetch(HUB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        prompt: systemPrompt + "\n\nUser Input:\n" + promptOrText + suffixOverride,
        config: { 
          model_id: hubModel,
          projectName: "World Asset (Phân tích kịch bản)",
          purpose: "Parse full screenplay text into JSON components",
          jobType: "text",
          async: true
        } 
      })
    });
  } catch (err) {
    throw new Error("MÁY CHỦ SẬP (502): Không thể kết nối tới Hub. Vui lòng bấm vào icon Bánh Răng (Cài đặt) góc trái dưới, chọn Provider = 'Google Gemini' và nhập API Key của bạn để sử dụng AI trực tiếp trên trình duyệt!");
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    await response.text();
    throw new Error("MÁY CHỦ LỖI: Vui lòng vào Cài đặt -> Chọn Gemini -> Nhập API Key để bypass máy chủ đang sập!");
  }

  const resData = await response.json();
  if (!response.ok || resData.status === 'error') {
    throw new Error(`Lỗi máy chủ Hub: ${resData.message}. Hãy chuyển sang dùng Gemini trong Cài đặt!`);
  }

  let content = "";
  if (resData.status === 'processing' && resData.jobId) {
    const jobId = resData.jobId;
    const pollUrl = HUB_API_URL.replace('/media/prompt', `/jobs/${jobId}`);
    
    let finishedData = null;
    for (let attempt = 0; attempt < 120; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        const pollRes = await smartFetch(pollUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!pollRes.ok) continue;
        
        const jobEnvelope = await pollRes.json();
        const jobDetail = jobEnvelope.data || jobEnvelope;
        const upperStatus = String(jobDetail.status).toUpperCase();
        if (upperStatus === 'COMPLETED' || upperStatus === 'SUCCESS' || upperStatus === 'DONE') {
          finishedData = jobDetail.outputUrls?.[0];
          break;
        } else if (upperStatus === 'FAILED' || upperStatus === 'ERROR') {
          throw new Error(jobDetail.errorMessage || "Phân tích kịch bản thất bại.");
        }
      } catch (pollErr: any) {
        console.warn(`[ScriptParser Poll] Attempt ${attempt + 1} failed:`, pollErr);
        if (pollErr.message && !pollErr.message.includes("fetch")) {
          throw pollErr;
        }
      }
    }
    
    if (!finishedData) {
      throw new Error("Quá thời gian phân tích kịch bản (Timeout). Vui lòng thử lại!");
    }
    content = finishedData.trim();
  } else {
    content = resData.data?.text?.trim() || "{}";
  }
  
  try {
    let parsedResult = cleanAndParseJSON(content);
    if (!parsedResult.characters) parsedResult.characters = [];
    if (!parsedResult.locations) parsedResult.locations = [];
    if (!parsedResult.scriptText) parsedResult.scriptText = promptOrText;
    
    return parsedResult;
  } catch(e) {
    console.error("[callHubAPI] JSON parse error:", e, "Raw Content:", content);
    throw new Error("AI trả về kết quả không phải JSON hợp lệ. Hãy thử lại.");
  }
}

export async function parseChunkedWithHub(text: string, token: string): Promise<ParsedScript> {
  let paragraphs = text.split(/\n\s*\n/);
  if (paragraphs.length === 1) paragraphs = text.match(/[\s\S]{1,500}(?=\s|$)/g) || [text];
  
  let chunks: string[] = [];
  let currentChunk = "";
  for (const p of paragraphs) {
      if ((currentChunk + p).length > 500 && currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
          currentChunk = p;
      } else {
          currentChunk += (currentChunk ? "\n\n" : "") + p;
      }
  }
  if (currentChunk) chunks.push(currentChunk.trim());

  console.log(`[parseChunkedWithHub] Chunked script into ${chunks.length} parts for processing.`);

  let combinedScript: ParsedScript = {
      scriptText: text,
      scriptSummary: "",
      estimatedDuration: "",
      totalScenes: 0,
      characters: [],
      locations: [],
      props: [],
      scenes: []
  };

  for (let i = 0; i < chunks.length; i++) {
      try {
          const parsedChunk = await callHubAPI(chunks[i], token);
          if (parsedChunk.scriptSummary && !combinedScript.scriptSummary) {
              combinedScript.scriptSummary = parsedChunk.scriptSummary;
          }
          if (parsedChunk.characters) {
              for (const c of parsedChunk.characters) {
                  if (!combinedScript.characters.some(item => item.name.toLowerCase() === c.name.toLowerCase())) {
                      combinedScript.characters.push(c);
                  }
              }
          }
          if (parsedChunk.locations) {
              for (const l of parsedChunk.locations) {
                  if (!combinedScript.locations.some(item => item.name.toLowerCase() === l.name.toLowerCase())) {
                      combinedScript.locations.push(l);
                  }
              }
          }
          if (parsedChunk.props) {
              for (const pr of parsedChunk.props) {
                  if (!combinedScript.props?.some(item => item.name.toLowerCase() === pr.name.toLowerCase())) {
                      combinedScript.props?.push(pr);
                  }
              }
          }
          if (parsedChunk.scenes) {
              for (const s of parsedChunk.scenes) {
                  const currentSceneCount = combinedScript.scenes.length + 1;
                  s.id = `Scene ${currentSceneCount}`;
                  combinedScript.scenes.push(s);
              }
          }
      } catch (err) {
          console.error(`Error processing chunk ${i + 1}:`, err);
      }
  }

  combinedScript.totalScenes = combinedScript.scenes.length;
  combinedScript.estimatedDuration = `${combinedScript.totalScenes * 8} sec`;

  return combinedScript;
}

// Hàm Wrapper chính, quyết định gọi LLM nào
export async function parseScriptLLM(promptOrText: string, existingAssets?: any[]): Promise<ParsedScript> {
  const { llmProvider, geminiApiKey } = getLlmSettings();
  
  if ((llmProvider === 'google-native' || llmProvider === 'gemini') && !geminiApiKey) {
    throw new Error("Vui lòng thiết lập Gemini API Key trong phần Settings trước khi sử dụng.");
  }
  
  let assetsContext = "";
  if (existingAssets && existingAssets.length > 0) {
    const chars = existingAssets.filter((a: any) => a.entityType === 'character' || !a.entityType).map((a: any) => `- Character: "${a.name}" (${a.description || 'no description'})`);
    const locs = existingAssets.filter((a: any) => a.entityType === 'location').map((a: any) => `- Location: "${a.name}" (${a.description || 'no description'})`);
    const props = existingAssets.filter((a: any) => a.entityType === 'prop').map((a: any) => `- Prop: "${a.name}" (${a.description || 'no description'})`);
    
    assetsContext = `\nCRITICAL ASSET REUSABILITY RULES:\nHere is the list of existing assets in our World Asset Database:\n` + 
      [...chars, ...locs, ...props].join('\n') + 
      `\n\nWhenever the screenplay references a character, location, or prop that resembles or matches any items in this existing library, you MUST strictly use the EXACT name of the existing asset. Do NOT invent new names, spelling variations, or synonyms (e.g. if the list contains "Kính lúp của Kilo", do not name it "Kính lúp" or "Kính lúp nhỏ"; if the list contains "Quảng trường Thị Trấn", do not name it "Quảng trường nhỏ" or "Khu phố"). Reusing the exact names is critical for matching database references.\n\n`;
  }

  const systemPrompt = `You are a professional Screenwriter and AI Script Analyzer.
The user provides a raw story idea.${assetsContext}
CRITICAL RULES:
1. CONCISE: Focus only on extracting the main plot points.
2. STRICT ADHERENCE: DO NOT invent completely unrelated new characters. Stick exactly to the characters provided in the input.
3. FORMAT: Use exact screenplay format.
4. EXTRACT ALL LOCATIONS: Extract ALL locations (both INT. and EXT. settings, outdoor setups, e.g. EXT. BẦU TRỜI HÀ NỘI - CHIỀU GIÔNG, EXT. ĐƯỜNG PHỐ HÀ NỘI, INT. PHÒNG KHÁCH, etc.). Include details like weather (storm, giông bão, rain, vệt nước mưa), vehicles/xe cộ, and lighting.
5. DYNAMIC SCENE SPLITTING:
   - "scenes" contains narrative scenes (representing high-level settings and story segments).
   - Generate detailed "shots" array for each narrative scene, matching the provided schema.
   - For a 3-minute story (180s), you must generate about 6 to 10 narrative scenes.
   - Storyboard images are generated as a single 1x1 image frame, NOT a 2x2 grid.
Return ONLY valid JSON:
{
  "scriptSummary": "A 1-sentence story summary",
  "estimatedDuration": "X min Y sec",
  "totalScenes": 6,
  "characters": [
    { "name": "CHARACTER_NAME", "aliases": ["alias1", "alias2"], "description": "Visual description of species, appearance, clothing." }
  ],
  "locations": [
    { "name": "LOCATION_NAME", "aliases": ["alias1", "alias2"], "description": "Cinematic environmental description, weather, lighting, mood, vehicles, storm." }
  ],
  "props": [
    { "name": "PROP_NAME", "aliases": ["alias1", "alias2"], "description": "Visual description of the prop." }
  ],
  "scenes": [
    {
      "id": "S-1",
      "location": "LOCATION_NAME",
      "timeOfDay": "DAY",
      "sceneDescription": "One sentence summary of what happens.",
      "charactersInScene": ["CHARACTER_NAME"],
      "emotionIntensity": 40,
      "valence": "neutral",
      "arcPosition": "setup",
      "storyDirection": "Ý tưởng phát triển câu chuyện/hành động cho scene này (tiếng Việt).",
      "scenePurpose": "Mục tiêu & Hướng kịch tính chính của scene này (tiếng Việt).",
      "emotionHook": "early / middle / late / none (vị trí tạo điểm nhấn/hook cảm xúc)",
      "moodShift": "Mô tả sự chuyển tiếp cảm xúc đi vào scene từ scene trước đó (tiếng Việt).",
      "moodShiftOut": "Mô tả sự chuyển tiếp cảm xúc đi ra khỏi scene sang scene tiếp theo (tiếng Việt).",
      "moodShiftPurpose": "Mục đích của việc chuyển cảm xúc này (tiếng Việt).",
      "outerSetup": true // Đặt thành true nếu scene này cần mở đầu bằng một cảnh ngoại / B-roll thiết lập không gian, thời tiết, môi trường hoành tráng hoặc u ám trước khi có nhân vật xuất hiện
    }
  ],
  "shots": [
    {
      "sceneId": "S-1",
      "shotNumber": 1,
      "description": "Visual description of what the camera sees and character actions in this shot (in Vietnamese)",
      "dialogue": "Character spoken dialogue line (empty if none, in Vietnamese)",
      "duration": 4,
      "cameraMovement": "STATIC / PAN LEFT / ZOOM IN / TILT UP / TILT DOWN / DOLLY IN / CRANE SHOT",
      "framing": "CLOSE UP / MEDIUM SHOT / WIDE SHOT / EXTREME CLOSE UP / EXTREME WIDE SHOT",
      "angle": "EYE LEVEL / HIGH ANGLE / LOW ANGLE / OVER THE SHOULDER / DUTCH ANGLE",
      "firstFrameState": "Visual details of the first frame of the shot, keeping continuity (in Vietnamese)",
      "plannedLastFrame": "Visual details of the last frame of the shot, ensuring clean end with no text/logo/UI (in Vietnamese)",
      "physicalMotionDelta": "Physical motion changes and speed tempo from start to end (in Vietnamese)",
      "propState": "End state of key props and objects in this shot (in Vietnamese)",
      "visualBridge": "Transition mode and visual bridge to the next shot, e.g. Cut, Reaction Cut, Dissolve (in Vietnamese)"
    }
  ],
  "emotionArc": [
    {
      "sceneId": "S-1",
      "intensity": 40,
      "valence": "neutral",
      "emotion": "anticipation",
      "arcPosition": "setup",
      "transitionHint": "brief description of mood shift going into next scene",
      "lighting": "soft morning light",
      "weather": "clear",
      "soundCue": "ambient city sounds"
    }
  ],
  "bridgeHints": [
    {
      "afterSceneId": "S-1",
      "beforeSceneId": "S-2",
      "suggestedType": "mood_shift",
      "description": "Brief description of what needs to bridge these two scenes visually.",
      "urgency": "suggested",
      "timeSkip": ""
    }
  ]
}`;

  const userOverridePrompt = promptOrText + "\n\n(SYSTEM OVERRIDE: Phân chia các Cảnh (scenes) dựa theo độ dài câu chuyện của User. Tập trung phân tích các bối cảnh, các nhân vật, đạo cụ, tạo sơ đồ cảm xúc đầy đủ và tự động sinh mảng shots chi tiết cho từng phân cảnh dựa trên schema được yêu cầu.)";

  let rawContent = "";
  try {
    rawContent = await executePrompt(
      systemPrompt,
      userOverridePrompt,
      "text",
      "Parse full screenplay text into JSON components",
      "World Asset (Phân tích kịch bản)"
    );
  } catch (err) {
    console.error("LLM API execution failed:", err);
    throw err;
  }

  try {
    const parsedResult = cleanAndParseJSON(rawContent);
    return normalizeParsedScript(parsedResult, promptOrText);
  } catch (err) {
    console.error("JSON parsing or normalization failed:", err);
    throw err;
  }
}

export function getFallbackParsedScript(promptOrText: string): ParsedScript {
  const characters = [
    { name: "Kilo", description: "Mèo mướp vàng thông thái, mặc áo trench coat màu beige và đội mũ fedora cổ điển." },
    { name: "Bruno", description: "Chó Bulldog to béo nhưng nhút nhát, mặc áo gilê nâu và đeo nơ cổ màu đỏ." },
    { name: "Wolfie", description: "Sói xám quỷ quyệt với vết sẹo ngang mắt trái, mặc áo khoác da màu đen." },
    { name: "Chloe", description: "Hải ly nhỏ nhắn dễ thương, mặc váy yếm màu hồng phấn." }
  ];

  const locations = [
    { name: "Văn phòng Thám tử", description: "Văn phòng ấm cúng, tường gỗ, chứa đầy sổ sách cũ, kính lúp và đèn bàn dịu ấm." },
    { name: "Rừng Sương Mù", description: "Rừng đêm tối ẩm ướt, sương mù dày đặc, cơn mưa giông lất phất dưới ánh trăng mờ." },
    { name: "Phòng thí nghiệm bí mật", description: "Không gian công nghiệp tối tăm, bình hóa chất phát sáng neon lục và đỏ lập lòe." }
  ];

  const props = [
    { name: "Kính lúp đồng cổ", description: "Kính lúp của Kilo dùng để soi dấu vết." },
    { name: "Tấm bản đồ cũ", description: "Bản đồ da dê vẽ tay các lối đi ẩn trong rừng." },
    { name: "Nơ cài tóc màu đỏ", description: "Chiếc nơ vải màu đỏ bị rách của Chloe." }
  ];

  const scenes = [
    {
      id: "Scene 1",
      location: "Văn phòng Thám tử",
      timeOfDay: "DAY",
      sceneDescription: "Thám tử Kilo đang săm soi tấm bản đồ tìm dấu vết. Trợ lý Bruno hớt hải chạy vào báo tin Chloe bị mất tích bí ẩn.",
      action: "Thám tử Kilo đang săm soi tấm bản đồ tìm dấu vết. Trợ lý Bruno hớt hải chạy vào báo tin Chloe bị mất tích bí ẩn.",
      charactersInScene: ["Kilo", "Bruno"],
      emotionIntensity: 45,
      valence: "tense",
      arcPosition: "setup",
      moodShift: "Khởi đầu câu chuyện — không khí trinh thám hồi hộp.",
      moodShiftOut: "Không khí căng thẳng dâng cao khi bắt đầu cuộc tìm kiếm nguy hiểm.",
      moodShiftPurpose: "Thiết lập tình huống khẩn cấp, kích hoạt cuộc phiêu lưu."
    },
    {
      id: "Scene 2",
      location: "Rừng Sương Mù",
      timeOfDay: "NIGHT",
      sceneDescription: "Bruno và Kilo đi sâu vào rừng đêm dưới cơn mưa. Họ phát hiện nơ cài tóc màu đỏ bị rách của Chloe vướng trên bụi gai.",
      action: "Bruno và Kilo đi sâu vào rừng đêm dưới cơn mưa. Họ phát hiện nơ cài tóc màu đỏ bị rách của Chloe vướng trên bụi gai.",
      charactersInScene: ["Kilo", "Bruno"],
      emotionIntensity: 65,
      valence: "negative",
      arcPosition: "rising",
      moodShift: "Chuyển từ sự tò mò trong văn phòng sang sự sợ hãi, u ám của rừng đêm.",
      moodShiftOut: "Căng thẳng tột độ khi phát hiện ra manh mối bắt cóc trực diện.",
      moodShiftPurpose: "Đưa nhân vật vào môi trường thử thách, nâng tầm kịch tính."
    },
    {
      id: "Scene 3",
      location: "Phòng thí nghiệm bí mật",
      timeOfDay: "NIGHT",
      sceneDescription: "Wolfie cười nham hiểm bên lò phản ứng. Chloe bị nhốt trong lồng năng lượng xanh neon rực rỡ gào khóc.",
      action: "Wolfie cười nham hiểm bên lò phản ứng. Chloe bị nhốt trong lồng năng lượng xanh neon rực rỡ gào khóc.",
      charactersInScene: ["Wolfie", "Chloe"],
      emotionIntensity: 90,
      valence: "tense",
      arcPosition: "climax",
      moodShift: "Bước vào hang ổ kẻ thù — đối mặt trực tiếp với mối hiểm họa.",
      moodShiftOut: "Chuẩn bị cho cuộc đối đầu quyết định giải cứu con tin.",
      moodShiftPurpose: "Giải phóng toàn bộ áp lực câu chuyện, tạo đỉnh điểm kịch tính."
    }
  ];

  const shots = [
    // Scene 1 shots
    {
      beat: "Shot 1.1",
      sceneId: "Scene 1",
      location: "Văn phòng Thám tử",
      timeOfDay: "DAY",
      description: "Close-up of a magnifying glass scanning a dusty, hand-drawn map on a wooden desk.",
      diễn_tả: "Cận cảnh kính lúp đang quét qua một tấm bản đồ vẽ tay bụi bặm trên bàn gỗ.",
      thoại: "",
      kind: "Close-Up",
      function: "Establishing Setting",
      causalLink: "Zoom out to show the detective.",
      detectedCharacters: ["Kilo"],
      detectedProps: ["Kính lúp đồng cổ", "Tấm bản đồ cũ"],
      duration: 5
    },
    {
      beat: "Shot 1.2",
      sceneId: "Scene 1",
      location: "Văn phòng Thám tử",
      timeOfDay: "DAY",
      description: "Medium shot of Kilo the cat wearing a beige trench coat and fedora, looking intensely down at the map.",
      diễn_tả: "Cảnh trung Kilo chú mèo mặc trench coat beige và fedora đang đăm chiêu nhìn bản đồ.",
      thoại: "KILO: Có điều gì đó bất thường ở bìa rừng phía Tây...",
      kind: "Medium Shot",
      function: "Action",
      causalLink: "The door suddenly bursts open.",
      detectedCharacters: ["Kilo"],
      detectedProps: ["Tấm bản đồ cũ"],
      duration: 5
    },
    {
      beat: "Shot 1.3",
      sceneId: "Scene 1",
      location: "Văn phòng Thám tử",
      timeOfDay: "DAY",
      description: "Wide shot of Bruno the bulldog bursting into the room, gasping for air, pointing trembling fingers outward.",
      diễn_tả: "Cảnh rộng Bruno chú chó bulldog lao vào phòng thở hổn hển, ngón tay run rẩy chỉ ra ngoài.",
      thoại: "BRUNO: Thám tử Kilo! Nguy rồi! Bé Chloe biến mất rồi!",
      kind: "Wide Shot",
      function: "Action",
      causalLink: "Cut to Kilo in shock.",
      detectedCharacters: ["Bruno", "Kilo"],
      detectedProps: [],
      duration: 5
    },
    {
      beat: "Shot 1.4",
      sceneId: "Scene 1",
      location: "Văn phòng Thám tử",
      timeOfDay: "DAY",
      description: "Extreme close-up of Kilo's eyes widening in shock under his fedora shadow.",
      diễn_tả: "Cực cận cảnh mắt Kilo co rụt lại vì sửng sốt dưới bóng mũ fedora.",
      thoại: "KILO: Hộp nhạc của cô ấy vẫn còn ở đây... Chúng ta phải đi ngay!",
      kind: "Extreme Close-Up",
      function: "Character Reaction",
      causalLink: "Cut to the dark forest.",
      detectedCharacters: ["Kilo"],
      detectedProps: [],
      duration: 5
    },
    // Scene 2 shots
    {
      beat: "Shot 2.1",
      sceneId: "Scene 2",
      location: "Rừng Sương Mù",
      timeOfDay: "NIGHT",
      description: "Wide shot of a dark mist-filled forest at night. Rain falls heavily as two figures walk with flashlights.",
      diễn_tả: "Cảnh rộng rừng đêm đầy sương mù u tối. Mưa rơi nặng hạt khi hai bóng người dò dẫm đi cùng đèn pin.",
      thoại: "",
      kind: "Wide Shot",
      function: "Establishing Setting",
      causalLink: "Camera pans down to wet mud.",
      detectedCharacters: ["Kilo", "Bruno"],
      detectedProps: [],
      duration: 5
    },
    {
      beat: "Shot 2.2",
      sceneId: "Scene 2",
      location: "Rừng Sương Mù",
      timeOfDay: "NIGHT",
      description: "Medium shot of Bruno shivering in the cold rain, holding a flashlight that trembles in his hand.",
      diễn_tả: "Cảnh trung Bruno run lẩy bẩy dưới mưa lạnh, tay cầm đèn pin run rẩy soi đường.",
      thoại: "BRUNO: K-Kilo... Tớ thấy sợ quá. Nơi này quá u ám...",
      kind: "Medium Shot",
      function: "Character Reaction",
      causalLink: "Flashlight beams illuminate a red object on a thorny bush.",
      detectedCharacters: ["Bruno"],
      detectedProps: [],
      duration: 5
    },
    {
      beat: "Shot 2.3",
      sceneId: "Scene 2",
      location: "Rừng Sương Mù",
      timeOfDay: "NIGHT",
      description: "Close-up of a torn red hair ribbon caught on a wet thorny branch, dripping water.",
      diễn_tả: "Cận cảnh chiếc nơ cài tóc màu đỏ bị rách vướng trên cành gai ướt sũng nước mưa.",
      thoại: "KILO: Nhìn kìa! Nơ cài tóc của Chloe!",
      kind: "Close-Up",
      function: "Detail Shot",
      causalLink: "Kilo grabs the ribbon.",
      detectedCharacters: ["Kilo"],
      detectedProps: ["Nơ cài tóc màu đỏ"],
      duration: 5
    },
    {
      beat: "Shot 2.4",
      sceneId: "Scene 2",
      location: "Rừng Sương Mù",
      timeOfDay: "NIGHT",
      description: "Medium shot of Kilo holding the wet red ribbon, looking up into the dark path ahead determinedly.",
      diễn_tả: "Cảnh trung Kilo cầm chiếc nơ đỏ ướt, ngẩng đầu nhìn con đường tối phía trước đầy quyết tâm.",
      thoại: "KILO: Dấu chân dẫn sâu vào hang đá phía trước. Hắn ở rất gần.",
      kind: "Medium Shot",
      function: "Action",
      causalLink: "Cut to the laboratory interior.",
      detectedCharacters: ["Kilo"],
      detectedProps: ["Nơ cài tóc màu đỏ"],
      duration: 5
    },
    // Scene 3 shots
    {
      beat: "Shot 3.1",
      sceneId: "Scene 3",
      location: "Phòng thí nghiệm bí mật",
      timeOfDay: "NIGHT",
      description: "Wide shot of a dark industrial lab. Glowing green chemical tubes line the walls.",
      diễn_tả: "Cảnh rộng phòng thí nghiệm công nghiệp tối tăm. Các ống hóa chất phát sáng xanh lục chạy dọc bức tường.",
      thoại: "",
      kind: "Wide Shot",
      function: "Establishing Setting",
      causalLink: "Pan to the villain.",
      detectedCharacters: ["Wolfie"],
      detectedProps: [],
      duration: 5
    },
    {
      beat: "Shot 3.2",
      sceneId: "Scene 3",
      location: "Phòng thí nghiệm bí mật",
      timeOfDay: "NIGHT",
      description: "Medium shot of Wolfie the wolf grinning wickedly, pulling a giant steel power lever.",
      diễn_tả: "Cảnh trung Wolfie chú sói cười gian tà, gạt một cần gạt điện bằng thép khổng lồ.",
      thoại: "WOLFIE: Cuối cùng, nguồn năng lượng này sẽ là của ta!",
      kind: "Medium Shot",
      function: "Climax",
      causalLink: "Lever activates a cage of neon energy.",
      detectedCharacters: ["Wolfie"],
      detectedProps: [],
      duration: 5
    },
    {
      beat: "Shot 3.3",
      sceneId: "Scene 3",
      location: "Phòng thí nghiệm bí mật",
      timeOfDay: "NIGHT",
      description: "Medium shot of Chloe inside a glowing blue neon energy cage, looking terrified and crying for help.",
      diễn_tả: "Cảnh trung Chloe bên trong lồng năng lượng xanh neon sáng rực, khóc lóc cầu cứu trong hoảng sợ.",
      thoại: "CHLOE: Thám tử Kilo! Cứu em với!",
      kind: "Medium Shot",
      function: "Character Reaction",
      causalLink: "The steel doors crash open in the background.",
      detectedCharacters: ["Chloe"],
      detectedProps: [],
      duration: 5
    },
    {
      beat: "Shot 3.4",
      sceneId: "Scene 3",
      location: "Phòng thí nghiệm bí mật",
      timeOfDay: "NIGHT",
      description: "Wide shot of Kilo and Bruno standing at the entrance, backlit by the hallway light, pointing forward.",
      diễn_tả: "Cảnh rộng Kilo và Bruno đứng ở lối vào, ngược sáng từ hành lang, chỉ tay quyết liệt về phía trước.",
      thoại: "KILO: Hãy dừng tay lại, Wolfie! Trò chơi kết thúc rồi!",
      kind: "Wide Shot",
      function: "Resolution",
      causalLink: "Freeze frame on confrontation.",
      detectedCharacters: ["Kilo", "Bruno", "Wolfie"],
      detectedProps: [],
      duration: 5
    }
  ];

  const emotionArc = scenes.map((sc) => ({
    sceneId: sc.id,
    intensity: sc.emotionIntensity,
    valence: sc.valence as any,
    emotion: sc.id === "Scene 1" ? "suspense" : sc.id === "Scene 2" ? "dread" : "climax",
    arcPosition: sc.arcPosition as any,
    transitionHint: sc.moodShiftOut,
    lighting: sc.id === "Scene 1" ? "soft warm indoor" : sc.id === "Scene 2" ? "dark dim moonlight" : "glowing green neon lights",
    weather: sc.id === "Scene 2" ? "stormy rain" : "clear",
    soundCue: sc.id === "Scene 1" ? "ticking clock" : sc.id === "Scene 2" ? "thunder and rain" : "humming machinery"
  }));

  const bridgeHints = [
    {
      afterSceneId: "Scene 1",
      beforeSceneId: "Scene 2",
      suggestedType: "location_shift" as const,
      description: "Chuyển cảnh từ Văn phòng ấm cúng sang khu Rừng Sương Mù lạnh lẽo dông bão.",
      urgency: "required" as const,
      timeSkip: "Đêm đó"
    },
    {
      afterSceneId: "Scene 2",
      beforeSceneId: "Scene 3",
      suggestedType: "location_shift" as const,
      description: "Chuyển cảnh đột ngột từ rừng sâu tối tăm vào Phòng thí nghiệm bí mật phát sáng neon.",
      urgency: "required" as const,
      timeSkip: ""
    }
  ];

  return {
    scriptText: promptOrText || "Kịch bản trinh thám phiêu lưu giải cứu Chloe.",
    scriptSummary: "Thám tử Kilo và trợ lý Bruno truy tìm dấu vết của Chloe mất tích, phát hiện hang ổ của sói Wolfie.",
    estimatedDuration: "60 sec",
    totalScenes: 3,
    totalShots: 12,
    characters,
    locations,
    props,
    scenes,
    shots,
    emotionArc,
    bridgeHints,
    scriptQuality: "rich"
  };
}

export async function generateSingleScenePrompt(
  sceneAction: string,
  characters: string,
  location: string,
  dialogs?: string[],
  panelGrid?: string,
  primaryCharacters?: string[],
  secondaryCharacters?: string[],
  props?: string[],
  globalStyle?: string
): Promise<any> {
  const gridLabel = panelGrid || '2x2';
  const dialogContext = dialogs && dialogs.length > 0
    ? dialogs.join('\n')
    : '(no dialog in this scene)';

  const primaryHint = primaryCharacters && primaryCharacters.length > 0
    ? `\\n- PRIMARY CHARACTERS (${primaryCharacters.join(', ')}): Must have dominant framing, close-up priority as they are speaking.`
    : '';
  const secondaryHint = secondaryCharacters && secondaryCharacters.length > 0
    ? `\\n- SECONDARY CHARACTERS (${secondaryCharacters.join(', ')}): Present in background, do not dominate the frame.`
    : '';
  const propsHint = props && props.length > 0
    ? `\\n- KEY PROPS (${props.join(', ')}): Must be clearly visible in relevant panels.`
    : '';

  const styleHint = globalStyle ? globalStyle : "3D Pixar style, cinematic lighting, textless";

  const systemPrompt = `You are an expert Storyboard Director. You are given a scene's action breakdown, explicit dialog lines, a list of characters, and a location.
Your task is to generate ONE cinematic prompt for generating a storyboard image grid.

CRITICAL RULES FOR STORYBOARD GRID PROMPT:
1. Start the prompt EXACTLY with:
"**STORYBOARD ${gridLabel} GRID - CHARACTER CONSISTENCY**\\nCreate a single 16:9 image divided into a ${gridLabel} storyboard grid with perfect visual continuity.\\n"
2. **CHARACTERS:** list each character with a FIXED visual descriptor (e.g., "a 4-year-old girl with short brown hair wearing a yellow raincoat"). Replace proper names with visual descriptors.
3. **CHARACTER PLACEMENT RULES:**${primaryHint}${secondaryHint}${propsHint}
4. **CRITICAL:** "Strictly follow the provided image references. DO NOT introduce generic or extra human characters."
5. **SCENE ACTION:** Punchy sequential actions mapping to each panel cell (under 30 words total).
6. **DIALOGUE CONTEXT:** use the EXACT dialog lines provided in the input, do NOT paraphrase.
7. **VISUAL STYLE:** Art style, rendering quality, lighting, textless.

Use ENGLISH ONLY. Return ONLY valid JSON:
{
  "storyboardPrompt": "**STORYBOARD ${gridLabel} GRID - CHARACTER CONSISTENCY**\\nCreate a single 16:9 image divided into a ${gridLabel} storyboard grid with perfect visual continuity.\\n**CHARACTERS:**\\n1. CHARACTER_NAME (Primary focus): VISUAL_DESCRIPTOR.\\n**CRITICAL:** Strictly follow the provided image references. DO NOT introduce generic or extra human characters.\\n**SCENE ACTION:** Panel-by-panel action.\\n**DIALOGUE CONTEXT:** \\"EXACT_DIALOG_LINE\\"\\n**VISUAL STYLE:** ${styleHint}",
  "dialogs": ["CHARACTER: Line."],
  "transitions": ["CUT TO:"]
}`;

  const userPrompt = `Location: ${location}\nCharacters: ${characters}\nAction:\n${sceneAction}\nDialog Lines:\n${dialogContext}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "storyboard_director",
    "Generate storyboard grid prompt",
    "Storyboard Workflow (Scene Prompt)"
  );
  return cleanAndParseJSON(rawContent);
}

export async function generateLocationPrompt(baseName: string, globalStyle: string, originalDescription?: string): Promise<any> {
  const systemPrompt = `You are a cinematic Environment/Concept Artist. The user will provide a location name, an overall art style, and a basic description.
Your task is to generate a highly detailed, immersive architectural and environmental description (around 30-50 words). Focus on lighting, atmosphere, textures, and spatial layout, expanding on the provided basic description.
CRITICAL RULE: DO NOT include any characters or people. Empty environment only.

Return ONLY valid JSON:
{
  "name": "An engaging name for the location",
  "description": "The detailed cinematic environmental description."
}`;

  const userPrompt = `Location: ${baseName}\nStyle: ${globalStyle}\nBasic Description: ${originalDescription || 'None'}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "text",
    "Split script scene into action panel prompts",
    "Storyboard Workflow (Chia Scene)"
  );
  return cleanAndParseJSON(rawContent);
}

export async function generateStylePrompt(baseKeyword: string): Promise<any> {
  const systemPrompt = `You are a top-tier Art Director. The user will provide a short style keyword (or nothing).
Expand it into a highly descriptive, professional cinematic art style prompt (around 20-30 words).
Example: "DreamWorks-inspired stylized 3D animated feature film, premium family animation, warm emotional storytelling, cinematic realism..."

Return ONLY valid JSON:
{
  "stylePrompt": "The expanded cinematic style description"
}`;

  const userPrompt = `Base Keyword: ${baseKeyword || "Surprise me with a high-quality 3D animation style"}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "style_analysis",
    "Expand art style keyword into visual style prompt",
    "World Asset (Style Guide)"
  );
  return cleanAndParseJSON(rawContent);
}

export async function generateVideoScriptPrompt(storyboardPrompt: string, durationSeconds: number = 8): Promise<any> {
  const systemPrompt = `You are an expert Storyboard Director. The user will provide a storyboard image prompt for a scene.
Your task is to generate a highly detailed cinematic video script prompt based on the provided storyboard.

CRITICAL RULES FOR VIDEO PROMPT:
1. Break down the scene into short, sequential video shots.
2. DURATION CONSTRAINT (MAX ${durationSeconds}s TOTAL): The total duration of all shots combined MUST sum up to EXACTLY ${durationSeconds} seconds (matching the maximum length of a single video). The shots do NOT need to be of equal length. You should dynamically allocate durations based on the pacing and action of each shot. For example, if the total duration is 8s: SHOT 1 could be 3s [00:00-00:03], SHOT 2 could be 1s [00:03-00:04], SHOT 3 could be 4s [00:04-00:08]. If the total duration is 4s: SHOT 1 could be 2s [00:00-00:02], SHOT 2 could be 2s [00:02-00:04]. The only hard rule is that the final shot's end timestamp must be exactly [00:${String(durationSeconds).padStart(2, '0')}].
3. The format MUST include timestamps and shot numbers, e.g., "[00:00-00:02] SHOT 1" followed by the detailed action and camera movement.
4. Use character names normally (DO NOT genericize them).
5. Use ENGLISH ONLY.
6. NO FADE OR CROSS-DISSOLVE TRANSITIONS: Absolutely avoid cross-fading, blending, or dissolving between angles, as it causes uncinematic visual blending artifacts. Instead, strictly describe clean camera cuts ("CUT TO:"), sudden shifts in angle, close-up cuts for facial expression and emotion, or dynamic zoom cuts.

Return ONLY valid JSON:
{
  "videoPrompt": "[00:00-00:03] SHOT 1\\nMica stands beside the balcony railing, holding out her hand to catch raindrops.\\nCamera: medium profile shot, clean cut, slow push-in.\\n\\n[00:03-00:04] SHOT 2\\nA soaked green blur crashes onto the wet balcony floor...\\nCamera: close-up reaction cut, fast impact shot."
}`;

  const userPrompt = `Storyboard Grid Prompt: ${storyboardPrompt}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "text",
    "Generate detailed motion instructions for video model",
    "Storyboard Workflow (Video Script)"
  );
  return cleanAndParseJSON(rawContent);
}

export async function generateCharacterPrompt(baseName: string, globalStyle: string, originalDescription?: string): Promise<any> {
  const systemPrompt = `You are a premier Character Concept Artist. The user will provide a character name, an overall art style, and a basic description.
Your task is to generate a highly detailed visual descriptor for a character concept design sheet. Direct the AI to generate a clean character design sheet, featuring the character from multiple angles (front view, 3/4 view, and back view turnaround) on a pure white background. Describe the physical appearance, clothing, species, colors, and distinct features in detail (around 35-50 words).
CRITICAL RULE: Always specify "character design turnaround sheet, front view, side view, and back view on a clean, solid white background". Focus ONLY on the character's design. Do not describe any background/environment scenery.

Return ONLY valid JSON:
{
  "name": "The character's name",
  "description": "The detailed visual descriptor of the character design sheet."
}`;

  const userPrompt = `Character Name: ${baseName}\nStyle: ${globalStyle}\nBasic Description: ${originalDescription || 'None'}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "text",
    "Generate consistent character description",
    "World Asset (Character Concept)"
  );
  return cleanAndParseJSON(rawContent);
}

export async function generatePropPrompt(baseName: string, globalStyle: string, originalDescription?: string): Promise<any> {
  const systemPrompt = `You are a premier Prop/Object Concept Artist. The user will provide a prop name, an overall art style, and a basic description.
Your task is to generate a highly detailed, visual descriptor for the prop (around 20-30 words). Focus on materials, textures, colors, age, and distinct features, expanding on the provided basic description.
CRITICAL RULE: Focus ONLY on the prop's design. Do not describe any characters or background/environment.

Return ONLY valid JSON:
{
  "name": "The prop's name",
  "description": "The detailed visual descriptor of the prop."
}`;

  const userPrompt = `Prop Name: ${baseName}\nStyle: ${globalStyle}\nBasic Description: ${originalDescription || 'None'}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "text",
    "Generate consistent prop description",
    "World Asset (Prop Concept)"
  );
  return cleanAndParseJSON(rawContent);
}

export function normalizeParsedScript(parsed: any, rawInputText: string): ParsedScript {
  if (!parsed) parsed = {};
  
  if (!parsed.characters) parsed.characters = [];
  else if (parsed.characters.length > 0) {
    parsed.characters = parsed.characters.map((c: any) => {
      if (typeof c === 'string') {
        return { name: c, description: 'Auto-detected character', aliases: '' };
      }
      return {
        ...c,
        name: c.name || 'Nhân vật',
        description: c.description || 'Auto-detected character',
        aliases: Array.isArray(c.aliases) ? c.aliases.join(', ') : (c.aliases || '')
      };
    });
  }
  
  if (!parsed.locations) parsed.locations = [];
  else if (parsed.locations.length > 0) {
    parsed.locations = parsed.locations.map((l: any) => {
      const cleanName = cleanLocationName(typeof l === 'string' ? l : (l.name || ''));
      if (typeof l === 'string') {
        return { name: cleanName, description: 'Auto-detected location', aliases: '' };
      }
      return {
        ...l,
        name: cleanName,
        description: l.description || 'Auto-detected location',
        aliases: Array.isArray(l.aliases) ? l.aliases.join(', ') : (l.aliases || '')
      };
    }).filter((l: any) => l.name && l.name !== 'Bối cảnh');
  }

  if (!parsed.props) parsed.props = [];
  else if (parsed.props.length > 0) {
    parsed.props = parsed.props.map((p: any) => {
      if (typeof p === 'string') {
        return { name: p, description: 'Auto-detected prop', aliases: '' };
      }
      return {
        ...p,
        name: p.name || 'Đạo cụ',
        description: p.description || 'Auto-detected prop',
        aliases: Array.isArray(p.aliases) ? p.aliases.join(', ') : (p.aliases || '')
      };
    });
  }

  if (!parsed.scenes) parsed.scenes = [];
  if (!parsed.shots) parsed.shots = [];
  // Auto-recovery of locations from scenes/shots (important for outdoor setup locations, e.g. Bầu trời Hà Nội, Đường phố, vv)
  const existingLocNames = new Set(parsed.locations.map((l: any) => (l.name || '').toLowerCase().trim()));
  const addLocation = (name: string, desc: string = '') => {
    const cleaned = cleanLocationName(name);
    if (!cleaned || cleaned === 'Bối cảnh' || cleaned.toLowerCase() === 'unknown' || cleaned.toLowerCase() === 'không gian') return;
    const cleanName = cleaned.trim();
    if (!existingLocNames.has(cleanName.toLowerCase())) {
      existingLocNames.add(cleanName.toLowerCase());
      parsed.locations.push({
        name: cleanName,
        description: desc || `Cinematic location: ${cleanName}`
      });
    }
  };

  parsed.shots.forEach((sh: any) => {
    if (sh.location) addLocation(sh.location, sh.description || sh.diễn_tả);
    if (sh.bối_cảnh) addLocation(sh.bối_cảnh, sh.description || sh.diễn_tả);
  });

  parsed.scenes.forEach((sc: any) => {
    if (sc.location) addLocation(sc.location, sc.sceneDescription || sc.action);
  });

  // Auto-recovery of props from shots
  const existingPropNames = new Set(parsed.props.map((p: any) => (p.name || '').toLowerCase().trim()));
  const addProp = (name: string, desc: string = '') => {
    const cleanName = name.trim();
    if (!cleanName) return;
    if (!existingPropNames.has(cleanName.toLowerCase())) {
      existingPropNames.add(cleanName.toLowerCase());
      parsed.props.push({
        name: cleanName,
        description: desc || `Key prop: ${cleanName}`
      });
    }
  };

  parsed.shots.forEach((sh: any) => {
    if (sh.detectedProps) {
      sh.detectedProps.forEach((p: any) => {
        const pName = typeof p === 'string' ? p : p?.name;
        if (pName) addProp(pName, typeof p === 'object' ? p.description : '');
      });
    }
  });

  if (!parsed.scriptText && parsed.rawScript) {
    parsed.scriptText = parsed.rawScript;
  }
  if (!parsed.scriptText) {
    parsed.scriptText = rawInputText;
  }
  if (!parsed.rawScript) {
    parsed.rawScript = parsed.scriptText;
  }

  // ── Auto-compute scriptQuality from average words per scene ──────────────
  if (!parsed.scriptQuality) {
    const avgWords = parsed.scenes.length > 0
      ? parsed.scenes.reduce((sum: number, sc: any) => sum + ((sc.sceneDescription || sc.action || '').split(/\s+/).filter(Boolean).length), 0) / parsed.scenes.length
      : 0;
    parsed.scriptQuality = avgWords >= 30 ? 'rich' : avgWords >= 12 ? 'medium' : 'sparse';
  }

  // ── Auto-build emotionArc from scene fields if LLM didn't return it or if length mismatch ──────
  if (!parsed.emotionArc || parsed.emotionArc.length !== parsed.scenes.length) {
    const arcPositions = ['setup', 'inciting', 'rising', 'climax', 'falling', 'resolution'];
    const oldArc = parsed.emotionArc || [];
    parsed.emotionArc = parsed.scenes.map((sc: any, idx: number) => {
      const existingBeat = oldArc.find((b: any) => b.sceneId === sc.id);
      if (existingBeat) return existingBeat;
      
      return {
        sceneId: sc.id,
        intensity: sc.emotionIntensity ?? Math.round(20 + (idx / Math.max(1, parsed.scenes.length - 1)) * 60),
        valence: sc.valence || 'neutral',
        emotion: sc.emotion || 'anticipation',
        arcPosition: sc.arcPosition || arcPositions[Math.min(idx, arcPositions.length - 1)],
        transitionHint: sc.transitionHint || '',
        lighting: sc.lighting || '',
        weather: sc.weather || '',
        soundCue: sc.soundCue || ''
      };
    });
  }

  // ── Auto-build bridgeHints if missing ────────────────────────────────────
  if (!parsed.bridgeHints || parsed.bridgeHints.length === 0) {
    parsed.bridgeHints = [];
    for (let i = 0; i < parsed.scenes.length - 1; i++) {
      const sc = parsed.scenes[i];
      const next = parsed.scenes[i + 1];
      const locChanged = (sc.location || '') !== (next.location || '');
      const timeChanged = (sc.timeOfDay || '') !== (next.timeOfDay || '');
      if (locChanged || timeChanged) {
        parsed.bridgeHints.push({
          afterSceneId: sc.id,
          beforeSceneId: next.id,
          suggestedType: locChanged ? 'location_shift' : 'time_skip',
          description: locChanged
            ? `Chuyển từ ${sc.location} sang ${next.location}`
            : `Nhảy thời gian: ${sc.timeOfDay} → ${next.timeOfDay}`,
          urgency: locChanged ? 'required' : 'suggested',
          timeSkip: timeChanged ? `${sc.timeOfDay} → ${next.timeOfDay}` : ''
        });
      }
    }
  }

  return parsed as ParsedScript;
}

export async function compileCopilotScreenplay(params: {
  rawPremise: string;
  totalDuration: number;
  avgShotDuration: number;
  selectedEmotion: string;
  selectedTwist: string;
  selectedRetention: string;
  customStyleInstructions: string;
  scenarioCharacters: string[];
  structure?: string;
  pacing?: string;
  bridgeRule?: string;
  visualDirectives?: string;
}): Promise<ParsedScript> {

  const targetShotCount = Math.round(params.totalDuration / params.avgShotDuration);
  const targetSceneCount = Math.max(1, Math.round(targetShotCount / 3.5));

  const systemPrompt = `You are a professional screenplay co-pilot. Create a detailed screenplay JSON structure.
Rules:
1. Ensure the total number of scenes is EXACTLY ${targetSceneCount}.
2. Ensure the total number of shots across all scenes is EXACTLY ${targetShotCount}.
3. Distribute the "duration" (in seconds) for each shot such that the sum of all shot durations equals EXACTLY ${params.totalDuration} seconds.
4. Extract ALL locations from the screenplay (both interior and exterior, e.g. EXT. BẦU TRỜI HÀ NỘI - CHIỀU GIÔNG, EXT. ĐƯỜNG PHỐ HÀ NỘI, INT. BAN CÔNG, etc.). Describe them with full atmospheric details such as weather (storm, giông bão, rain, vệt nước mưa), lighting, and environment setups.
5. In the "shots" array, you MUST populate the technical fields ("firstFrameState", "plannedLastFrame", "physicalMotionDelta", "propState", "visualBridge") with detailed, professional, cinematic descriptions in Vietnamese. Do not leave them empty or use placeholder generic text.
6. Narrative Structure: Apply the story structure "${params.structure || '3-Act Structure (Cấu trúc 3 hồi)'}" to organize the progression of the scenes.
7. Narrative Pacing: Apply the pacing style "${params.pacing || 'Balanced (Cân bằng & Nhịp nhàng)'}" to control the shot flow, action details, and dramatic beats.
8. Continuity & Visual Bridge Rule: Strict adherence to the rule "${params.bridgeRule || 'Strictly Continuous (Khớp hành động & Liên tục tuyệt đối - Action Match, Eyeline Match)'}".
   - Under this continuity style, ensure the planned last frame ("plannedLastFrame") of shot N logically connects, transitions, or visually matches with the first frame state ("firstFrameState") of shot N+1.
   - Use professional visual bridges (cầu nối thị giác) tailored to the continuity style (e.g., Match Cut hành động, Eyeline Match góc nhìn, Reaction Cut cảm xúc, Cut-in cận cảnh đạo cụ, Graphic Match tương đồng thị giác, v.v.). Explain specifically how shot N bridges into shot N+1.
${params.visualDirectives ? `9. Director's Visual Directives: Incorporate the following directives seamlessly into the shots' visual description and camera details: "${params.visualDirectives}".` : ''}
10. Return ONLY valid JSON matching format:
{
  "rawScript": "The complete screenplay text in Vietnamese",
  "scriptSummary": "A 1-sentence story summary",
  "estimatedDuration": "${params.totalDuration} sec",
  "totalScenes": ${targetSceneCount},
  "characters": [
    { "name": "CHARACTER_NAME", "aliases": ["alias1", "alias2"], "description": "Visual description of species, appearance, clothing." }
  ],
  "locations": [
    { "name": "LOCATION_NAME", "aliases": ["alias1", "alias2"], "description": "Cinematic environmental description, weather, lighting, mood." }
  ],
  "props": [
    { "name": "PROP_NAME", "aliases": ["alias1", "alias2"], "description": "Visual description of the prop." }
  ],
  "scenes": [
    {
      "id": "S-1",
      "sceneNumber": 1,
      "location": "LOCATION_NAME",
      "timeOfDay": "DAY",
      "sceneDescription": "One sentence summary of what happens.",
      "charactersInScene": ["CHARACTER_NAME"],
      "storyDirection": "Ý tưởng phát triển câu chuyện/hành động cho scene này (tiếng Việt).",
      "scenePurpose": "Mục tiêu & Hướng kịch tính chính của scene này (tiếng Việt).",
      "emotionHook": "early / middle / late / none (vị trí tạo điểm nhấn/hook cảm xúc)",
      "moodShift": "Mô tả sự chuyển tiếp cảm xúc đi vào scene từ scene trước đó (tiếng Việt).",
      "moodShiftOut": "Mô tả sự chuyển tiếp cảm xúc đi ra khỏi scene sang scene tiếp theo (tiếng Việt).",
      "moodShiftPurpose": "Mục đích của việc chuyển cảm xúc này (tiếng Việt).",
      "outerSetup": true // Đặt thành true nếu scene này cần mở đầu bằng một cảnh ngoại / B-roll thiết lập không gian, thời tiết, môi trường hoành tráng hoặc u ám trước khi có nhân vật xuất hiện
    }
  ],
  "shots": [
    {
      "sceneId": "S-1",
      "shotNumber": 1,
      "description": "Visual description of what the camera sees and character actions in this shot (in Vietnamese)",
      "dialogue": "Character spoken dialogue line (empty if none, in Vietnamese)",
      "duration": 4,
      "cameraMovement": "STATIC",
      "framing": "MEDIUM SHOT",
      "angle": "EYE LEVEL",
      "firstFrameState": "Trạng thái khung hình đầu tiên chi tiết để đảm bảo tính liên tục (bằng tiếng Việt)",
      "plannedLastFrame": "Trạng thái khung hình cuối cùng được định hướng rõ ràng, không dính văn bản/UI/logo (bằng tiếng Việt)",
      "physicalMotionDelta": "Sự thay đổi chuyển động vật lý và nhịp độ từ đầu tới cuối shot (bằng tiếng Việt)",
      "propState": "Trạng thái cuối cùng của các đạo cụ và vật thể chính trong shot này (bằng tiếng Việt)",
      "visualBridge": "Phương thức chuyển cảnh và cầu nối thị giác tới shot tiếp theo, vd: Cut, Reaction Cut, Dissolve (bằng tiếng Việt)"
    }
  ]
}`;

  const userPrompt = `Premise: ${params.rawPremise}
Emotion: ${params.selectedEmotion || 'Neutral'}
Characters: ${params.scenarioCharacters.join(', ')}
Settings: ${params.customStyleInstructions || ''}
Twist: ${params.selectedTwist || 'None'}
Return Rate Retention: ${params.selectedRetention || 'None'}
Story Structure: ${params.structure || '3-Act Structure'}
Pacing: ${params.pacing || 'Balanced'}
Continuity Rule: ${params.bridgeRule || 'Strictly Continuous'}
${params.visualDirectives ? `Director's Visual Directives: ${params.visualDirectives}` : ''}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "text",
    "Compile Scenario Screenplay",
    "World Asset (Scenario Co-pilot)"
  );

  let parsedResponse = cleanAndParseJSON(rawContent);

  return normalizeParsedScript(parsedResponse, params.rawPremise);
}

export function getHeuristicEmotionFallback(scenes: any[]): any {
  console.log("Applying local heuristic fallback for screenplay analysis...");
  const mappedScenes = scenes.map((s, idx) => {
    const text = ((s.action || s.sceneDescription || s.location || '') + '').toLowerCase();
    
    // 1. Phân tích bối cảnh (location)
    let location = "Phòng khách";
    if (text.includes("sofa") || text.includes("phòng khách")) {
      location = "Phòng khách";
    } else if (text.includes("hành lang") || text.includes("ngoài cửa") || text.includes("vắng")) {
      location = "Hành lang";
    } else if (text.includes("ban công") || text.includes("lan can")) {
      location = "Ban công";
    } else if (text.includes("bếp") || text.includes("nấu ăn")) {
      location = "Bếp";
    } else if (s.location && !s.location.toLowerCase().includes("scene")) {
      location = s.location;
    }

    // 2. Cảm xúc dựa trên từ khóa kịch tính
    let emotion = "anticipation";
    let valence = "neutral";
    let emotionIntensity = 50;
    let lighting = "soft morning light";
    let weather = "clear";
    let soundCue = "ambient room sounds";
    
    if (text.includes("dồn vào góc") || text.includes("hoảng loạn") || text.includes("sợ") || text.includes("sát khí") || text.includes("lan can")) {
      emotion = "fear";
      valence = "tense";
      emotionIntensity = 85;
      lighting = "dim dramatic backlight";
      weather = "overcast";
      soundCue = "tense horror ambient pad";
    } else if (text.includes("đứng thẳng") || text.includes("ve vẫy") || text.includes("vui") || text.includes("tự hào")) {
      emotion = "joy";
      valence = "positive";
      emotionIntensity = 65;
      lighting = "warm cozy sunset glow";
      weather = "clear";
      soundCue = "cheerful birds chirping";
    } else if (text.includes("bóng") || text.includes("lướt") || text.includes("bí ẩn") || text.includes("rình rập")) {
      emotion = "anticipation";
      valence = "tense";
      emotionIntensity = 75;
      lighting = "dim shadows with neon highlights";
      weather = "light rain";
      soundCue = "suspenseful low cello drone";
    }

    // 3. Phân bố vị trí trong mạch truyện (arcPosition) dựa trên vị trí index
    const total = scenes.length;
    let arcPosition = "setup";
    if (idx === 0) arcPosition = "setup";
    else if (idx === 1) arcPosition = "inciting";
    else if (idx === Math.floor(total / 2)) arcPosition = "rising";
    else if (idx === total - 2) arcPosition = "climax";
    else if (idx === total - 1) arcPosition = "resolution";
    else arcPosition = "falling";

    return {
      id: s.id,
      location: location,
      emotionIntensity: emotionIntensity,
      valence: valence,
      arcPosition: arcPosition,
      emotion: emotion,
      lighting: lighting,
      weather: weather,
      soundCue: soundCue,
      moodShift: `Chuyển tiếp tâm trạng vào phân cảnh ${s.id} (Tĩnh)`,
      moodShiftOut: `Chuyển tiếp tâm trạng ra phân cảnh ${s.id} (Tĩnh)`,
      moodShiftPurpose: `Tăng cường độ kịch tính và nhịp độ cho phân cảnh ${s.id}`
    };
  });

  return { scenes: mappedScenes };
}

export async function analyzeImportedScriptEmotion(
  scriptText: string,
  scenes: any[]
): Promise<any> {
  const sceneListStr = scenes.map(s => `- Scene ID: "${s.id}", Location: "${s.location}", Action/Summary: "${s.action || s.sceneDescription || ''}"`).join('\n');

  const systemPrompt = `You are a professional Creative Director and AI Screenplay Analyzer.
The user provides a full screenplay and a list of existing scenes (already mapped out).
Your job is to analyze the emotional flow, mood, atmospheric settings, and narrative arc based ON the screenplay, and fill in the missing creative metadata for EACH existing scene.

CRITICAL RULES:
1. Preserve the EXACT scene IDs. Do NOT add new scenes or remove any. Automatically extract the true location name (e.g. "Phòng khách", "Ban công", "Bếp", "Hành lang") for each scene based on the screenplay text.
2. For each scene, analyze:
   - "location": true location name in Vietnamese, e.g. "Phòng khách", "Ban công", "Hành lang", "Bếp".
   - "emotionIntensity": 0 to 100 (level of drama, fear, tension, joy, etc.)
   - "valence": "positive", "negative", "tense", or "neutral"
   - "emotion": "anticipation", "fear", "anger", "joy", "sadness", "surprise", "disgust", "trust", etc.
   - "arcPosition": "setup", "inciting", "rising", "climax", "falling", or "resolution"
   - "lighting": e.g. "warm Hanoi ambient light", "dim neon green and red", etc.
   - "weather": e.g. "clear", "stormy", "light rain", "overcast", etc.
   - "soundCue": sound design hints, e.g. "ambient city noise", "tense strings swelling", etc.
   - "moodShift": describe the transition of mood going into this scene (in Vietnamese).
   - "moodShiftOut": describe the transition of mood leaving this scene (in Vietnamese).
   - "moodShiftPurpose": why this mood shift is key to the story pacing (in Vietnamese).

Return ONLY valid JSON format:
{
  "scenes": [
    {
      "id": "Scene ID (matching the input)",
      "location": "Phòng khách",
      "emotionIntensity": 50,
      "valence": "tense",
      "arcPosition": "setup",
      "emotion": "anticipation",
      "lighting": "soft morning light",
      "weather": "clear",
      "soundCue": "ambient city sounds",
      "moodShift": "transition into this scene",
      "moodShiftOut": "transition out of this scene",
      "moodShiftPurpose": "purpose of this shift"
    }
  ]
}`;

  const userPrompt = `Screenplay Text:\n${scriptText}\n\nList of Scenes to Analyze:\n${sceneListStr}`;

  try {
    const rawContent = await executePrompt(
      systemPrompt,
      userPrompt,
      "text",
      "Analyze Imported Script Emotion",
      "World Asset (Emotion Analyzer)"
    );

    if (rawContent && (rawContent.includes("không an toàn") || rawContent.includes("Bé ơi") || rawContent.includes("ý tưởng này"))) {
      console.warn("Safety block detected in prompt execution. Switching to heuristic fallback.");
      return getHeuristicEmotionFallback(scenes);
    }

    return cleanAndParseJSON(rawContent);
  } catch (err) {
    console.warn("Error in analyzeImportedScriptEmotion, using heuristic fallback:", err);
    return getHeuristicEmotionFallback(scenes);
  }
}



/**
 * Trợ lý AI sinh Shotlist tự động từ kịch bản thô sử dụng LLM
 */
export async function generateShotlistFromScript(
  scriptText: string,
  existingAssets?: any[],
  preset?: string
): Promise<ParsedScript> {
  const assetChars = existingAssets?.filter((c: any) => c.entityType === 'character' || !c.entityType) || [];
  const assetLocs = existingAssets?.filter((l: any) => l.entityType === 'location') || [];

  const charListStr = assetChars.length > 0 
    ? assetChars.map((c: any) => `- ${c.name} (${c.description || 'nhân vật'})`).join('\n')
    : 'Không có thông tin cụ thể, hãy tự động phát hiện nhân vật.';
  const locListStr = assetLocs.length > 0
    ? assetLocs.map((l: any) => `- ${l.name} (${l.description || 'bối cảnh'})`).join('\n')
    : 'Không có thông tin cụ thể, hãy tự động phát hiện bối cảnh.';

  let systemPrompt = `You are a professional Screenplay Director and AI Cinematic Analyst.
Your task is to analyze the user's raw screenplay text and convert it into a complete, structured JSON shotlist format in Vietnamese.

CRITICAL RULES:
1. Make sure to capture ALL scenes and segment them properly.
2. Keep the scene IDs starting from "S-1", "S-2", etc.
3. For each shot, you MUST populate all cinematic fields based on the screenplay flow. 
4. The output MUST match this exact schema format:
{
  "scriptSummary": "A 1-sentence story summary",
  "estimatedDuration": "Total estimated duration, e.g. '120 sec'",
  "characters": [
    { "name": "CHARACTER_NAME", "aliases": ["alias1"], "description": "Visual appearance details." }
  ],
  "locations": [
    { "name": "LOCATION_NAME", "aliases": ["alias1"], "description": "Environmental/lighting/weather details." }
  ],
  "scenes": [
    {
      "id": "S-1",
      "location": "LOCATION_NAME (must match a name in locations list)",
      "timeOfDay": "DAY or NIGHT",
      "action": "Brief summary of the action in this scene",
      "charactersInScene": ["CHARACTER_NAME"]
    }
  ],
  "shots": [
    {
      "sceneId": "S-1",
      "shotNumber": 1,
      "description": "Visual description of what the camera sees and character actions in this shot (in Vietnamese)",
      "dialogue": "Character spoken dialogue line (empty if none, in Vietnamese)",
      "duration": 4,
      "cameraMovement": "STATIC / PAN LEFT / ZOOM IN / TILT UP / TILT DOWN / DOLLY IN / CRANE SHOT",
      "framing": "CLOSE UP / MEDIUM SHOT / WIDE SHOT / EXTREME CLOSE UP / EXTREME WIDE SHOT",
      "angle": "EYE LEVEL / HIGH ANGLE / LOW ANGLE / OVER THE SHOULDER / DUTCH ANGLE",
      "firstFrameState": "Visual details of the first frame of the shot, keeping continuity (in Vietnamese)",
      "plannedLastFrame": "Visual details of the last frame of the shot, ensuring clean end with no text/logo/UI (in Vietnamese)",
      "physicalMotionDelta": "Physical motion changes and speed tempo from start to end (in Vietnamese)",
      "propState": "End state of key props and objects in this shot (in Vietnamese)",
      "visualBridge": "Transition mode and visual bridge to the next shot, e.g. Cut, Reaction Cut, Dissolve (in Vietnamese)"
    }
  ]
}

EXISTING PROJECTS WORLD ASSETS FOR MAPPING REFERENCE:
Characters:
${charListStr}

Locations:
${locListStr}

Ensure that you match names with the reference assets where possible.
Return ONLY valid raw JSON block. No explanation outside.`;

  if (preset === 'paco_production') {
    systemPrompt = `You are a professional Screenplay Director and AI Cinematic Analyst.
Your task is to analyze the user's raw screenplay text and convert it into a structured JSON format.
For Paco Production, each paragraph in the input text corresponds to 1 independent Shot. 
You do NOT need to group them into Scenes (just use S-1 for all or assign each a unique ID).
Each shot MUST have 4 fields: camera, background, characters, action.

CRITICAL RULES:
1. Each paragraph in the text is a separate shot.
2. The output MUST match this exact schema format:
{
  "scriptSummary": "A 1-sentence story summary",
  "estimatedDuration": "Total estimated duration",
  "characters": [],
  "locations": [],
  "scenes": [
    {
      "id": "S-1",
      "location": "Paco Location",
      "timeOfDay": "DAY",
      "action": "Overall action",
      "charactersInScene": []
    }
  ],
  "shots": [
    {
      "sceneId": "S-1",
      "shotNumber": 1,
      "camera": "Góc máy (ví dụ: Cận cảnh, Toàn cảnh, ...)",
      "background": "Mô tả bối cảnh",
      "characters": "Mô tả nhân vật",
      "action": "Hành động diễn ra",
      "description": "Combine the fields above briefly for fallback"
    }
  ]
}

EXISTING PROJECTS WORLD ASSETS FOR MAPPING REFERENCE:
Characters:
${charListStr}

Locations:
${locListStr}

Return ONLY valid raw JSON block. No explanation outside.`;
  }

  const userPrompt = `Screenplay Text:\n${scriptText}`;

  const rawContent = await executePrompt(
    systemPrompt,
    userPrompt,
    "text",
    "Generate Shotlist From Script",
    "World Asset (Shotlist Generator)"
  );

  const parsed = cleanAndParseJSON(rawContent);
  return normalizeParsedScript(parsed, scriptText);
}


