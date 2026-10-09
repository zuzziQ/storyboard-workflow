/**
 * STORYMEE Unified Media Generation Gateway
 * Seamless hybrid routing: Local Extension <-> VPS Cloud Worker Queue <-> Vidtory SDK <-> Google Native
 */

import { getApiBaseUrl, fetchWithTimeout, sanitizeHubUrl } from './apiConfig';

export interface MediaGenerationPayload {
  prompt: string;
  projectId?: string;
  projectName?: string;
  numOutputs?: number;
  mediaIds?: string[];
  videoModelKey?: string;
  ratio?: string;
  duration?: string;
  mediaType: 'image' | 'video';
  sceneIndex?: number;
  ipId?: string;
  linkedEntities?: Array<{ entityId: string; role: string }>; // NEW!
  entityType?: string; // NEW!
  generatorMode?: 'standard' | 'xray';
  storyboardFrameUrl?: string;
  cameraMovement?: string;
  renderMode?: 'combined' | 'location_only' | 'character_only';
  gridFormat?: '1x1' | '2x2' | '2x3';
  modelId?: string;
}

export interface GatewayResult {
  success: boolean;
  images?: Array<{ url: string; mediaId: string; id?: string }>;
  operationIds?: string[];
  projectId?: string;
  url?: string;
  error?: string;
}

/**
 * Helper function to retrieve the synchronized media settings from the persisted Zustand store
 */
function getMediaSettings() {
  try {
    const persisted = localStorage.getItem('flow-architect-storage');
    if (persisted) {
      const parsed = JSON.parse(persisted);
      if (parsed.state) {
        const state = parsed.state;
        return {
          imageProvider: state.imageProvider || 'hub',
          imageModel: state.imageProvider === 'hub' 
            ? (state.hubImageModel || 'auto') 
            : state.imageProvider === 'sdk' 
              ? (state.sdkImageModel || 'imagen-3') 
              : state.imageProvider === 'dreamina'
                ? (state.dreaminaImageModel || 'high_aes_general_v50')
                : (state.googleImageModel || 'imagen-3.0-fast-002'),
          videoProvider: state.videoProvider || 'hub',
          videoModel: state.videoProvider === 'hub' 
            ? (state.hubVideoModel || 'auto') 
            : state.videoProvider === 'sdk' 
              ? (state.sdkVideoModel || 'veo-3.1-fast-generate-001') 
              : state.videoProvider === 'dreamina'
                ? (state.dreaminaVideoModel || 'dreamina_seedance_40')
                : (state.googleVideoModel || 'veo-2.0-generate-001'),

          hubUrl: (state.hubConnectionMode === 'local') 
            ? `http://${state.localIp || 'storymee-pc.local'}:5100` 
            : 'https://dev-hub.storymee.com',
          hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || state.hubApiKey || state.hubToken || import.meta.env.VITE_HUB_API_KEY || '',

          sdkUrl: state.sdkUrl || 'https://bapi.vidtory.net',
          sdkApiKey: state.sdkApiKey || '',

          geminiApiKey: state.geminiApiKey || state.geminiKey || '',
          universalNegativePrompt: state.universalNegativePrompt || ''
        };
      }
    }
  } catch (e) {
    console.error("Error reading persisted settings in mediaGateway:", e);
  }
  return {
    imageProvider: 'hub',
    imageModel: 'auto',
    videoProvider: 'hub',
    videoModel: 'auto',
    hubUrl: '',
    hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || '',
    sdkUrl: 'https://bapi.vidtory.net',
    sdkApiKey: '',
    geminiApiKey: '',
    universalNegativePrompt: ''
  };
}

/**
 * Helper to fetch with automatic retries for transient network/CORS/PgBouncer connection failures
 */
async function fetchWithRetry(url: string, options?: RequestInit & { timeoutMs?: number }, retries = 3, delay = 1000): Promise<Response> {
  const { timeoutMs = 15000, ...fetchOptions } = options || {};
  try {
    const res = await fetchWithTimeout(url, { ...fetchOptions, timeout: timeoutMs });
    if (!res.ok && res.status >= 500 && retries > 0) {
      console.warn(`[fetchWithRetry] Server error ${res.status}. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    return res;
  } catch (err: any) {
    if (retries > 0) {
      console.warn(`[fetchWithRetry] Network error: ${err.message || err}. Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, retries - 1, delay * 1.5);
    }
    throw err;
  }
}

/**
 * Uploads a reference image to World Asset API
 */
export async function uploadReferenceImage(
  fileOrBlob: Blob | File | string,
  filename = 'reference_image.jpg'
): Promise<string | null> {
  const baseUrl = getApiBaseUrl();
  const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
  
  try {
    let blob: Blob;
    if (typeof fileOrBlob === 'string') {
      if (fileOrBlob.startsWith('data:image/')) {
        const parts = fileOrBlob.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        blob = new Blob([uInt8Array], { type: contentType });
      } else {
        return fileOrBlob;
      }
    } else {
      blob = fileOrBlob;
    }

    const formData = new FormData();
    formData.append('file', blob, filename);

    const headers: any = {};
    if (HUB_API_KEY) headers['Authorization'] = `Bearer ${HUB_API_KEY}`;

    const res = await fetch(`${baseUrl}/internal/v1/asset/world/upload`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (res.ok) {
      const data = await res.json();
      return data.url || data.data?.url || null;
    }
  } catch (err) {
    console.error('[MediaGateway] uploadReferenceImage error:', err);
  }
  return null;
}

/**
 * Polls the job status from StoryMee core-api
 */
async function pollHubJobStatus(
  jobId: string,
  baseUrl: string,
  apiKey: string,
  mediaType: 'image' | 'video',
  onProgress?: (status: string) => void
): Promise<GatewayResult> {
  let attempts = 0;
  const maxAttempts = mediaType === 'video' ? 180 : 90; // Up to 12 minutes for slow video generation, 6 minutes for images (90 * 4s)
  const startTime = Date.now();

  while (attempts < maxAttempts) {
    attempts++;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    
    await new Promise(r => setTimeout(r, 4000));

    try {
      const headers: any = {};
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      let job: any = null;

      // 1. Thử endpoint chuẩn của core-job-api: /internal/v1/jobs/${jobId}
      let res = await fetchWithTimeout(`${baseUrl}/internal/v1/jobs/${jobId}`, { headers, timeout: 10000 });
      if (res.ok) {
        const data = await res.json();
        job = data.data || data.job || data;
      } else if (res.status === 401 || res.status === 403) {
        return { success: false, error: `Lỗi xác thực (Status ${res.status}). Vui lòng kiểm tra lại API Key.` };
      } else {
        // Fallback 1: /v1/media/tasks/${jobId}
        res = await fetchWithTimeout(`${baseUrl}/v1/media/tasks/${jobId}`, { headers, timeout: 10000 });
        if (res.ok) {
          const data = await res.json();
          job = data.data || data.task || data;
        } else {
          // Fallback 2: /v1/jobs/${jobId}/status
          res = await fetchWithTimeout(`${baseUrl}/v1/jobs/${jobId}/status`, { headers, timeout: 10000 });
          if (res.ok) {
            const data = await res.json();
            job = data.data || data;
          }
        }
      }

      if (!job) continue;

      // Cập nhật trạng thái job realtime cho UI tracking
      const jobStatus = (job.status || 'queued').toLowerCase();
      if (onProgress) {
        if (jobStatus === 'queued' || jobStatus === 'pending') {
          onProgress(`QUEUED (${elapsedSeconds}s)`);
        } else if (jobStatus === 'processing' || jobStatus === 'running') {
          onProgress(`PROCESSING (${elapsedSeconds}s)`);
        } else {
          onProgress(`Đang vẽ (${jobStatus}... ${elapsedSeconds}s)`);
        }
      }

      const status = String(job.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'DONE' || status === 'SUCCESS') {
        const outputUrls = job.outputUrls || job.output_urls || [];
        const resultUrl = typeof job.result === 'string' ? job.result : (job.result?.url || job.result?.outputUrl || (Array.isArray(job.result) ? job.result[0] : null));
        const rawOutput = job.output_url || job.outputUrl || (outputUrls.length > 0 ? outputUrls[0] : null) || resultUrl;
        if (rawOutput) {
          const firstUrl = typeof rawOutput === 'string' ? rawOutput : (Array.isArray(rawOutput) ? rawOutput[0] : String(rawOutput));
          return {
            success: true,
            images: [{ url: firstUrl, mediaId: firstUrl }], // For images compatibility
            url: firstUrl,
            operationIds: [jobId]
          };
        }
      }

      if (status === 'FAILED' || status === 'ERROR') {
        let errorMsg = job.errorMessage || job.error || (typeof job.result?.error === 'string' ? job.result.error : "Cloud worker task failed.");
        if (typeof errorMsg === 'object') errorMsg = JSON.stringify(errorMsg);
        if (errorMsg.includes("reCAPTCHA") || errorMsg.includes("403")) {
          errorMsg = `Lỗi xác thực Google reCAPTCHA (PERMISSION_DENIED: PUBLIC_ERROR_UNUSUAL_ACTIVITY). Hãy đổi IP VPS hoặc thử sinh lại.`;
        }
        return {
          success: false,
          error: errorMsg,
          operationIds: [jobId]
        };
      }
    } catch (e: any) {
      console.warn("[MediaGateway] Poll error:", e.message);
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      if (e.message?.includes("refused") || e.message?.includes("connection")) {
        if (onProgress) onProgress(`Đang kết nối lại Hub VPS (Đã chờ ${elapsedSeconds}s)...`);
      }
    }
  }

  const timeoutMinutes = mediaType === 'video' ? 12 : 6;
  return {
    success: false,
    error: `Hết thời gian chờ (Polling Timeout > ${timeoutMinutes} phút) phản hồi từ Cloud Worker.`,
    operationIds: [jobId]
  };
}

/**
 * Polls the job status from Vidtory SDK
 */
async function pollSdkJobStatus(
  jobId: string,
  sdkUrl: string,
  headers: Record<string, string>,
  onProgress?: (status: string) => void
): Promise<GatewayResult> {
  let attempts = 0;
  const maxAttempts = 180; // Up to 12 minutes
  const startTime = Date.now();

  while (attempts < maxAttempts) {
    attempts++;
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
    if (onProgress) {
      onProgress(`Đang vẽ SDK (${elapsedSeconds}s)...`);
    }

    await new Promise(r => setTimeout(r, 4000));

    try {
      // Use 10s timeout without retries for polling status
      const res = await fetchWithTimeout(`${sdkUrl}/generative-core/jobs/${jobId}/status`, { headers, timeout: 10000 });
      if (!res.ok) continue;

      const data = await res.json();
      const job = data.data;

      if (!job) continue;

      const status = String(job.status).toUpperCase();
      if (status === 'COMPLETED' || status === 'DONE' || status === 'SUCCESS') {
        const resultUrl = job.result?.url || job.result;
        if (resultUrl) {
          return {
            success: true,
            images: [{ url: resultUrl, mediaId: resultUrl }],
            url: resultUrl,
            operationIds: [jobId]
          };
        }
      }

      if (status === 'FAILED' || status === 'ERROR') {
        let errorMsg = typeof job.error === 'object' ? JSON.stringify(job.error) : (job.error || "Vidtory SDK task failed.");
        if (errorMsg.includes("reCAPTCHA") || errorMsg.includes("403")) {
          errorMsg = `Lỗi xác thực Google reCAPTCHA trên SDK (PERMISSION_DENIED). Hãy sinh lại hoặc kiểm tra IP.`;
        }
        return {
          success: false,
          error: errorMsg,
          operationIds: [jobId]
        };
      }
    } catch (e: any) {
      console.warn("[MediaGateway] SDK Poll error:", e.message);
    }
  }

  return {
    success: false,
    error: "Hết thời gian chờ (Polling Timeout > 12 phút) phản hồi từ Vidtory SDK.",
    operationIds: [jobId]
  };
}

/**
 * Generates media by automatically choosing between Local Chrome Extension, Cloud VPS worker, Vidtory SDK or Gemini Native Imagen.
 */
export async function generateMediaViaGateway(
  payload: MediaGenerationPayload,
  onProgress?: (status: string) => void
): Promise<GatewayResult> {
  const settings = getMediaSettings();
  const provider = payload.mediaType === 'video' ? settings.videoProvider : settings.imageProvider;
  const sanitizedMediaIds = (payload.mediaIds || []).filter((url: string) => url && (url.startsWith('http://') || url.startsWith('https://')));


  // 2. Vidtory SDK Generation Route (Proxy via backend to prevent CORS & protect API keys, fallback to client-side direct call)
  if (provider === 'sdk') {
    if (onProgress) {
      onProgress("Đang gửi yêu cầu sinh Media qua Vidtory SDK (Server Gateway Proxy)...");
    }

    try {
      const baseUrl = settings.hubUrl ? settings.hubUrl.replace(/\/$/, '') : getApiBaseUrl();
      const endpoint = payload.mediaType === 'video' ? `${baseUrl}/v1/media/video` : `${baseUrl}/v1/media/image`;
      
      const durationSeconds = payload.duration ? parseInt(payload.duration.replace('s', '')) : (payload.mediaType === 'video' ? 5 : 0);

      const modelId = payload.mediaType === 'video' 
        ? (payload.videoModelKey && payload.videoModelKey !== 'default' ? payload.videoModelKey : settings.videoModel)
        : (payload.videoModelKey && payload.videoModelKey !== 'default' ? payload.videoModelKey : settings.imageModel);

      const isDreamina = modelId && modelId.toLowerCase().includes('dreamina');

      const requestBody = {
        ipId: payload.ipId || "00000000-0000-0000-0000-000000000000",
        linkedEntities: payload.linkedEntities,
        inputParams: {
          prompt: payload.prompt,
          project_name: payload.projectId || "default",
          reference_image_urls: sanitizedMediaIds,
          provider: "sdk", // Tells backend to route to Vidtory SDK

          entityType: payload.entityType,
          num_outputs: payload.numOutputs || 1,
          renderMode: payload.renderMode,
          gridFormat: payload.gridFormat,
          config: {
            aspect_ratio: payload.ratio || "16:9",
            model_id: modelId,
            duration_seconds: durationSeconds,
            generator_mode: payload.generatorMode || 'standard',
            storyboard_frame_url: payload.storyboardFrameUrl,
            camera_movement: payload.cameraMovement,
            renderMode: payload.renderMode,
            gridFormat: payload.gridFormat
          }
        }
      };

      const headers: any = { 'Content-Type': 'application/json' };
      if (settings.hubApiKey) {
        headers['Authorization'] = `Bearer ${settings.hubApiKey}`;
      }

      console.log(`[MediaGateway] Routing SDK job via backend gateway: ${endpoint}`);
      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        timeoutMs: 30000
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`[MediaGateway] Backend SDK Proxy failed (${res.status}): ${errorText}. Falling back to direct client-side call...`);
        return await generateMediaDirectSdk(payload, settings, onProgress);
      }

      const resData = await res.json();
      if (!resData.data || !resData.data.job_id) {
        console.warn("[MediaGateway] Backend SDK Proxy did not return job_id. Falling back to direct client-side call...");
        return await generateMediaDirectSdk(payload, settings, onProgress);
      }

      const jobId = resData.data.job_id;
      return await pollHubJobStatus(jobId, baseUrl, settings.hubApiKey, payload.mediaType, onProgress);

    } catch (err: any) {
      console.warn("[MediaGateway] Backend SDK Proxy encountered error:", err.message, "Trying client-side fallback...");
      return await generateMediaDirectSdk(payload, settings, onProgress);
    }
  }

  // 3. StoryMee Go Gateway/Hub Route (Default)
  if (onProgress) {
    onProgress("Đang gửi yêu cầu sinh Media lên Cloud Worker (VPS Hub Queue)...");
  }

  try {
    const baseUrl = settings.hubUrl ? settings.hubUrl.replace(/\/$/, '') : getApiBaseUrl();
    const endpoint = payload.mediaType === 'video' ? `${baseUrl}/v1/media/video` : `${baseUrl}/v1/media/image`;
    
    const durationSeconds = payload.duration ? parseInt(payload.duration.replace('s', '')) : (payload.mediaType === 'video' ? 5 : 0);

    const modelId = payload.mediaType === 'video' 
      ? (payload.videoModelKey && payload.videoModelKey !== 'default' ? payload.videoModelKey : (payload.modelId || settings.videoModel))
      : (payload.modelId && payload.modelId !== 'default' ? payload.modelId : (payload.videoModelKey || settings.imageModel));

    // Determine target provider and clean model ID based on settings & model selection
    let targetProvider = provider; // 'hub', 'sdk', 'google-native', 'dreamina' from settings
    let actualModelId = modelId;

    // Perform smart model mapping for google-native and sdk providers
    if (provider === 'dreamina') {
      targetProvider = "dreamina";
      actualModelId = modelId || (payload.mediaType === 'video' ? "dreamina_seedance_40" : "high_aes_general_v50");
    } else if (provider === 'google-native') {
      if (payload.mediaType === 'video') {
        if (!modelId || !modelId.toLowerCase().includes('veo')) {
          actualModelId = settings.videoModel || "veo-2.0-generate-001";
        }
      } else {
        if (!modelId || !modelId.toLowerCase().includes('imagen')) {
          actualModelId = settings.imageModel || "imagen-3.0-fast-002";
        }
      }
    } else if (provider === 'sdk') {
      if (payload.mediaType === 'video') {
        if (!modelId || !modelId.toLowerCase().includes('veo')) {
          actualModelId = settings.videoModel || "veo-3.1-fast-generate-001";
        }
      } else {
        if (!modelId || !modelId.toLowerCase().includes('imagen')) {
          actualModelId = settings.imageModel || "imagen-3";
        }
      }
    } else {
      // Legacy backwards-compatible routing for Hub
      if (payload.mediaType === 'video') {
        if (modelId === 'luma' || modelId === 'kling' || modelId === 'runway') {
          targetProvider = "iilabs";
        } else if (modelId && (modelId.includes('veo_3_1') || modelId === 'veo_3_1')) {
          targetProvider = "gflow";
        } else if (modelId === 'dreamina') {
          targetProvider = "dreamina";
          actualModelId = "dreamina";
        } else {
          targetProvider = "auto";
        }
      } else {
        if (modelId === 'google-flow' || modelId === 'narwhal') {
          targetProvider = "gflow";
          actualModelId = "narwhal";
        } else if (modelId === 'iilabs' || modelId === 'banana2') {
          targetProvider = "iilabs";
          actualModelId = "banana2";
        } else if (modelId === 'omni-flash-3') {
          targetProvider = "gflow";
          actualModelId = "omni-flash-3";
        } else if (modelId === 'dreamina') {
          targetProvider = "dreamina";
          actualModelId = "dreamina";
        } else {
          targetProvider = "auto";
        }
      }
    }

    const requestBody = {
      ipId: payload.ipId || "00000000-0000-0000-0000-000000000000",
      linkedEntities: payload.linkedEntities,
      inputParams: {
        prompt: payload.prompt,
        project_name: payload.projectId || "default",
        reference_image_urls: sanitizedMediaIds,
        provider: targetProvider,

        entityType: payload.entityType,
        num_outputs: payload.numOutputs || 1,
        renderMode: payload.renderMode,
        gridFormat: payload.gridFormat,
        config: {
          aspect_ratio: payload.ratio || "16:9",
          model_id: actualModelId,
          duration_seconds: durationSeconds,
          generator_mode: payload.generatorMode || 'standard',
          storyboard_frame_url: payload.storyboardFrameUrl,
          camera_movement: payload.cameraMovement,
          renderMode: payload.renderMode,
          gridFormat: payload.gridFormat
        }
      }
    };

    const headers: any = { 'Content-Type': 'application/json' };
    if (settings.hubApiKey) {
      headers['Authorization'] = `Bearer ${settings.hubApiKey}`;
    }

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      timeoutMs: 30000
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `API Gateway Error: ${errorText}` };
    }

    const resData = await res.json();
    if (!resData.data || !resData.data.job_id) {
      return { success: false, error: "Không nhận được Job ID từ Cổng API" };
    }

    const jobId = resData.data.job_id;
    return await pollHubJobStatus(jobId, baseUrl, settings.hubApiKey, payload.mediaType, onProgress);

  } catch (err: any) {
    let errorMsg = err.message || "Lỗi kết nối tới API Gateway.";
    const errUrl = settings.hubUrl || getApiBaseUrl();
    if (errorMsg.includes("refused") || errorMsg.includes("ECONNREFUSED")) {
      errorMsg = `Không thể kết nối đến Hub Gateway (Server VPS Core API đang Offline hoặc sập). ${errorMsg}`;
    } else if (errorMsg.toLowerCase().includes("failed to fetch") || errorMsg.toLowerCase().includes("fetch")) {
      errorMsg = `Lỗi kết nối mạng (Failed to fetch). Vui lòng kiểm tra kết nối mạng/VPN hoặc cấu hình CORS của Server Gateway (${errUrl}).`;
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Fallback to direct client-side SDK generation (in case the local server proxy is not reachable/supported)
 */
async function generateMediaDirectSdk(
  payload: MediaGenerationPayload,
  settings: ReturnType<typeof getMediaSettings>,
  onProgress?: (status: string) => void
): Promise<GatewayResult> {
  if (!settings.sdkApiKey) {
    return { success: false, error: "Vui lòng thiết lập Vidtory SDK API Key trong phần Settings." };
  }

  const sdkUrl = settings.sdkUrl ? settings.sdkUrl.replace(/\/$/, '') : 'https://bapi.vidtory.net';
  const endpoint = payload.mediaType === 'video' ? `${sdkUrl}/generative-core/video` : `${sdkUrl}/generative-core/image`;

  if (onProgress) {
    onProgress(`[Direct SDK Fallback] Đang gửi yêu cầu sinh ${payload.mediaType === 'video' ? 'Video' : 'Ảnh'} tới Vidtory SDK...`);
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': settings.sdkApiKey,
      'X-Request-ID': `vid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      'X-SDK-Version': '1.1.0'
    };
    if (settings.sdkApiKey && !settings.sdkApiKey.startsWith('vidtory_')) {
      headers['Authorization'] = `Bearer ${settings.sdkApiKey}`;
    }

    const body: any = {
      modelId: payload.mediaType === 'video'
        ? (settings.videoModel && settings.videoModel !== 'auto' ? settings.videoModel : "veo-3.1-fast-generate-001")
        : (settings.imageModel && settings.imageModel !== 'auto' ? settings.imageModel : "gemini-3.1-flash-image-preview"),
      prompt: payload.prompt
    };

    // Phân tích và gán ảnh reference cho Direct SDK
    let sampleCharacterUrl: string | undefined = undefined;
    let refImageUrl: string | undefined = undefined;
    const refUrls = payload.mediaIds || [];
    const linkedEntities = payload.linkedEntities || [];

    if (refUrls.length > 0) {
      if (linkedEntities.length > 0) {
        const charIndex = linkedEntities.findIndex(e => e.role === 'character');
        if (charIndex !== -1 && refUrls[charIndex]) {
          sampleCharacterUrl = refUrls[charIndex];
        }
        const locIndex = linkedEntities.findIndex(e => e.role === 'location');
        if (locIndex !== -1 && refUrls[locIndex]) {
          refImageUrl = refUrls[locIndex];
        }
      }
      if (!sampleCharacterUrl) {
        sampleCharacterUrl = refUrls[0];
      }
      if (!refImageUrl) {
        refImageUrl = refUrls[1] || refUrls[0];
      }
    }

    if (sampleCharacterUrl) {
      body.sampleCharacterUrl = sampleCharacterUrl;
    }
    if (refImageUrl) {
      body.refImageUrl = refImageUrl;
    }

    if (payload.mediaType === 'video') {
      const durationSeconds = payload.duration ? parseInt(payload.duration.replace('s', '')) : 5;
      body.duration = durationSeconds;
      body.durationSeconds = durationSeconds;
      body.aspectRatio = payload.ratio || "16:9";
    } else {
      body.aspectRatio = payload.ratio || "16:9";
    }

    const res = await fetchWithRetry(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, error: `Vidtory SDK Error (Direct): ${errorText}` };
    }

    const resData = await res.json();
    if (!resData.data || !resData.data.generationHistoryId) {
      return { success: false, error: "Không nhận được generationHistoryId từ Vidtory SDK (Direct)" };
    }

    const jobId = resData.data.generationHistoryId;
    return await pollSdkJobStatus(jobId, sdkUrl, headers, onProgress);
  } catch (err: any) {
    return { success: false, error: err.message || "Lỗi kết nối tới Vidtory SDK (Direct)." };
  }
}


