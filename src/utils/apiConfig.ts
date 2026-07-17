/**
 * API Host configuration helper for hybrid local/production routing
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const match = document.cookie.match(new RegExp('(^| )hub_connection_url=([^;]+)'));
    const cookieUrl = match ? decodeURIComponent(match[2]) : null;
    const customUrl = cookieUrl || localStorage.getItem('STORYMEE_CUSTOM_API_URL');
    if (customUrl) {
      let url = customUrl.trim();
      url = url.replace(/\/$/, ''); // Remove trailing slash
      url = url.replace(/\/api$/, ''); // Remove trailing /api
      
      // Fix fallback: Nếu customUrl đang lưu là dev-core cũ, ép về VPS chuẩn
      if (url.includes('dev-hub.storymee.com') || url.includes('dev-hub.storymee.com')) {
        return import.meta.env.VITE_CORE_API_URL || 'https://dev-hub.storymee.com';
      }
      // Khắc phục lỗi Network/CORS khi fetch qua localhost (chuyển IPv6 sang IPv4)
      if (url.includes('localhost')) {
        return url.replace('localhost', '127.0.0.1');
      }
      return url;
    }
  }
  const envUrl = import.meta.env.VITE_CORE_API_URL;
  if (envUrl) {
    let cleanEnv = envUrl.replace(/\/$/, '').replace(/\/api$/, '');
    // Fix fallback: Đảm bảo mặc định luôn là VPS nếu env đang trỏ nhầm vào dev-core
    if (cleanEnv.includes('dev-hub.storymee.com') || cleanEnv.includes('dev-hub.storymee.com')) {
      return import.meta.env.VITE_CORE_API_URL || 'https://dev-hub.storymee.com';
    }
    return cleanEnv;
  }
  
  // Mặc định kết nối trực tiếp đến VPS Production Core API
  return import.meta.env.VITE_CORE_API_URL || 'https://dev-hub.storymee.com';
};

/**
 * Robust fetch wrapper with timeout support to prevent indefinite hanging on network/server failures
 */
export async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 8000, ...fetchOptions } = options; // Default to 8s timeout
  
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error: any) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Mạng kết nối bị treo (Timeout > ${timeout}ms) khi truy cập: ${url}`);
    }
    throw error;
  }
}

/**
 * Sanitizes docker-internal hub URLs to prevent browser fetch failures
 */
export const sanitizeHubUrl = (url: string | undefined | null): string => {
  if (!url) return import.meta.env.VITE_CORE_API_URL || 'https://dev-hub.storymee.com';
  const cleaned = url.trim();
  
  // ƯU TIÊN 1: Nếu user nhập localhost/IP local, thì KHÔNG ĐƯỢC FALLBACK, giữ nguyên cho user test
  const isLocal = 
    cleaned.includes('localhost') || 
    cleaned.includes('127.0.0.1') || 
    cleaned.includes('.local') || 
    /(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.\d{1,3}\.\d{1,3}\.\d{1,3})/.test(cleaned);

  if (isLocal) {
    let result = cleaned;
    if (!result.startsWith('http://') && !result.startsWith('https://')) {
      result = 'http://' + result;
    }
    return result;
  }
  
  // ƯU TIÊN 2: Bắt các hostname nội bộ docker hoặc domain cũ bị lỗi để Fallback về VPS
  // Chỉ bắt chính xác các tên miền nội bộ docker hoặc dev-core
  if (
    cleaned === 'http://storymee-hub' || 
    cleaned === 'http://hub-gateway' || 
    cleaned === 'http://core-api' || 
    cleaned === 'http://omni-core-api' ||
    cleaned.includes('dev-hub.storymee.com')
  ) {
    // Mặc định kết nối trực tiếp đến VPS Production Core API Gateway
    return import.meta.env.VITE_CORE_API_URL || 'https://dev-hub.storymee.com';
  }
  
  let result = cleaned;
  if (result && !result.startsWith('http://') && !result.startsWith('https://')) {
    result = 'https://' + result;
  }
  return result;
};


import { CoreApiClient } from '@storymee/api-client';

export const coreApi = new CoreApiClient({
  baseURL: getApiBaseUrl(),
});

export async function coreRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { method = 'GET', body, headers } = options;
  const HUB_API_KEY = localStorage.getItem('STORYMEE_HUB_API_KEY') || import.meta.env.VITE_HUB_API_KEY || '';
  
  const config = {
    baseURL: getApiBaseUrl(),
    headers: {
      'Authorization': `Bearer ${HUB_API_KEY}`,
      ...headers as any
    }
  };

  let data = body;
  if (typeof body === 'string') {
    try { data = JSON.parse(body); } catch(e) {}
  }

  let cleanPath = path;
  if (cleanPath.startsWith('/api/')) cleanPath = cleanPath.substring(4);
  else if (cleanPath.startsWith('api/')) cleanPath = cleanPath.substring(3);

  switch (method.toUpperCase()) {
    case 'POST': return await coreApi.post<T>(cleanPath, data, config);
    case 'PUT': return await coreApi.put<T>(cleanPath, data, config);
    case 'DELETE': return await coreApi.delete<T>(cleanPath, config);
    case 'PATCH': return await coreApi.patch<T>(cleanPath, data, config);
    default: return await coreApi.get<T>(cleanPath, config);
  }
}
