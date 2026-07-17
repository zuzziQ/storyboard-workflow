import { useFlowStore } from "../store/useFlowStore";
import { getApiBaseUrl } from "../utils/apiConfig";

export interface JobPayload {
  prompt: string;
  config: {
    model_id: string;
    aspect_ratio?: string;
    image_size?: string;
    duration?: string;
    num_outputs?: number;
    webhook_url?: string;
  };
}

export interface JobResponse {
  job_id: string;
  status: string;
  message?: string;
}

const getAuthToken = () => {
  return (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || useFlowStore.getState().hubToken || import.meta.env.VITE_HUB_API_KEY || '';
};

export const createMediaJob = async (type: 'image' | 'video', payload: JobPayload): Promise<JobResponse> => {
  const token = getAuthToken();

  const API_URL = getApiBaseUrl();
  const endpoint = `${API_URL}/api/media/${type}`;

  const durationSeconds = payload.config?.duration 
    ? parseInt(payload.config.duration.replace('s', '')) 
    : (type === 'video' ? 5 : 0);

  const formattedPayload = {
    ipId: "00000000-0000-0000-0000-000000000000",
    inputParams: {
      prompt: payload.prompt,
      config: {
        model_id: payload.config?.model_id,
        aspect_ratio: payload.config?.aspect_ratio || '16:9',
        duration_seconds: durationSeconds,
        num_outputs: payload.config?.num_outputs || 1,
        webhook_url: payload.config?.webhook_url
      }
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(formattedPayload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || `HTTP Error ${response.status}: Failed to create ${type} job`);
  }

  const data = await response.json();
  
  // OMNI Core API trả về format: { status: 'success', data: { job_id: "..." } } hoặc { success: true, data: { job_id: "..." } }
  if ((data.success || data.status === 'success') && data.data?.job_id) {
    return {
      job_id: data.data.job_id,
      status: 'pending'
    };
  }

  // Fallback cho format cũ
  return data;
};

// Hàm kiểm tra trạng thái Job (dành cho Webhook-less)
export const checkJobStatus = async (jobId: string) => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();
  
  const response = await fetch(`${API_URL}/api/media/status/${jobId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to check status for job ${jobId}`);
  }

  return response.json();
};

// Đồng bộ kịch bản và phân cảnh trực tiếp về World Asset DB chung
export const syncEpisodeToDB = async (payload: { projectId?: string; universeId?: string; title: string; scriptText: string; scenes: any[]; shots?: any[]; gflowProjectId?: string; canvasState?: any }) => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();
  const finalPayload = {
    ...payload,
    projectId: payload.projectId || payload.universeId,
    universeId: payload.projectId || payload.universeId
  };
  const response = await fetch(`${API_URL}/api/world-asset/episodes/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(finalPayload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error || 'Failed to sync episode to DB');
  }
  return response.json();
};

// Lấy thông tin Episode cụ thể từ DB chung (Backward compatibility)
export const fetchEpisodeFromDB = async (universeId: string, episodeId: string) => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();
  const response = await fetch(`${API_URL}/api/world-asset/episodes?projectId=${universeId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch episodes');
  }
  const eps = await response.json();
  return eps.find((e: any) => e.id === episodeId);
};

// Lấy trọn bộ tài sản storyboard (Episode, characters, locations, assets) bằng 1 API duy nhất
export const fetchStoryboardAssetsFromDB = async (episodeId: string) => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();
  const response = await fetch(`${API_URL}/api/world-asset/episodes/${episodeId}/storyboard-assets`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!response.ok) {
    throw new Error('Failed to fetch storyboard assets');
  }
  return response.json();
};

export const uploadFileToDB = async (file: Blob, filename = 'slice.jpg'): Promise<{ url: string }> => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();
  
  const formData = new FormData();
  formData.append('file', file, filename);

  const response = await fetch(`${API_URL}/api/world-asset/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error || 'Failed to upload file');
  }

  return response.json();
};

export const createAssetInDB = async (payload: { ipId?: string | null; assetType: string; driveUrl: string; tags: string[]; projectId?: string; episodeId?: string; sceneId?: string }) => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();

  const response = await fetch(`${API_URL}/api/world-asset/assets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.error || 'Failed to create asset');
  }

  return response.json();
};

export const refinePromptWithAI = async (
  projectId: string,
  originalPrompt: string,
  feedback: string,
  type: 'storyboard' | 'video' | 'variant'
): Promise<string> => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();

  const response = await fetch(`${API_URL}/api/agent/refine-prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ projectId, originalPrompt, feedback, type })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    throw new Error(err?.message || 'Tinh chỉnh prompt thất bại.');
  }

  const res = await response.json();
  return res.data?.refinedPrompt || originalPrompt;
};

// ============================================================
// World Asset MCP v2.0.0 Integration
// Gọi trước khi gen ảnh để inject Character/Location/Prop DNA
// ============================================================

export interface ResolvePromptResult {
  rawPrompt: string;
  resolvedPrompt: string;
  dbDNAUsed: number;
  memoriesUsed: number;
  detectedNames: string[];
  totalContextChars: number;
  isOptimized?: boolean;
}

/**
 * resolvePromptWithAssetDNA
 * Enriches a raw shot prompt with Visual DNA from World Asset DB + Letta semantic memory.
 * Gọi hàm này TRƯỚC mỗi lần gọi createMediaJob() để đảm bảo nhân vật nhất quán.
 *
 * @param projectId  UUID của Universe (Paco = '9e53ff1c-...')
 * @param rawPrompt  Shot description thô từ shotlist
 * @param characterNames  Tên nhân vật/location/prop xuất hiện trong shot (optional, auto-detect nếu thiếu)
 * @param optimize  Tự động tổng hợp và tối ưu hóa prompt qua LLM (default: true)
 * @returns ResolvePromptResult với resolvedPrompt đã inject DNA
 */
export const resolvePromptWithAssetDNA = async (
  projectId: string,
  rawPrompt: string,
  characterNames?: string[],
  optimize: boolean = true
): Promise<ResolvePromptResult> => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();

  const response = await fetch(`${API_URL}/api/world-asset/resolve-prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, rawPrompt, characterNames, optimize }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => null);
    // Fallback graceful: trả về rawPrompt nếu backend lỗi, không crash workflow gen ảnh
    console.warn('[resolvePromptWithAssetDNA] Failed, using rawPrompt as fallback:', err?.error);
    return {
      rawPrompt,
      resolvedPrompt: rawPrompt,
      dbDNAUsed: 0,
      memoriesUsed: 0,
      detectedNames: [],
      totalContextChars: rawPrompt.length,
      isOptimized: false,
    };
  }

  const res = await response.json();
  return res.data as ResolvePromptResult;
};

export interface ConsistencyCheckResult {
  status: 'pass' | 'violations_found';
  violationCount: number;
  violations: Array<{
    character: string;
    rule: string;
    violation: string;
    suggestion: string;
  }>;
  checkedCharacters: string[];
}

/**
 * checkPromptConsistency
 * Kiểm tra prompt có vi phạm Do's & Dont's của nhân vật không.
 * Gọi sau resolvePromptWithAssetDNA, trước khi submit gen ảnh.
 *
 * @returns ConsistencyCheckResult — status 'pass' hoặc 'violations_found' kèm danh sách lỗi
 */
export const checkPromptConsistency = async (
  projectId: string,
  prompt: string,
  characterNames: string[]
): Promise<ConsistencyCheckResult> => {
  const token = getAuthToken();
  const API_URL = getApiBaseUrl();

  const response = await fetch(`${API_URL}/api/world-asset/check-consistency`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ projectId, prompt, characterNames }),
  });

  if (!response.ok) {
    // Graceful fallback: nếu check consistency lỗi, coi như pass để không block workflow
    return { status: 'pass', violationCount: 0, violations: [], checkedCharacters: characterNames };
  }

  const res = await response.json();
  return res.data as ConsistencyCheckResult;
};
