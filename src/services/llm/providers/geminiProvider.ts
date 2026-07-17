import type { LlmProvider, LlmConfig, LlmRequestOptions } from '../types';
import { getApiBaseUrl } from '../../../utils/apiConfig';

export class GeminiProvider implements LlmProvider {
  id = 'gemini';

  async executePrompt(
    systemPrompt: string, 
    userPrompt: string, 
    settings: LlmConfig,
    options?: LlmRequestOptions
  ): Promise<string> {
    const hubToken = settings.hubApiKey || import.meta.env.VITE_HUB_API_KEY || "";
    const hubUrl = settings.hubUrl ? settings.hubUrl.replace(/\/$/, '') : getApiBaseUrl();
    const HUB_API_URL = `${hubUrl}/api/media/prompt`;
    const model = settings.googleLlmModel || 'gemini-2.5-flash';

    console.log(`[GeminiProvider] Routing call via Gemini Proxy: ${HUB_API_URL}`);

    const response = await fetch(HUB_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${hubToken}` 
      },
      body: JSON.stringify({
        prompt: systemPrompt + "\n\nUser Input:\n" + userPrompt,
        config: {
          provider: 'gemini',
          model_id: model,
          projectName: options?.projectName || 'Flow Architect',
          purpose: options?.purpose || 'AI Analysis',
          jobType: options?.jobType || 'text',
          async: false
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lỗi Gemini API thông qua proxy (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textResult = resData.text || resData.data?.text || resData.data?.result || resData.result || resData.data || "";
    if (!textResult) {
      throw new Error("Không nhận được phản hồi từ Gemini API thông qua proxy.");
    }
    return typeof textResult === 'string' ? textResult : JSON.stringify(textResult);
  }
}
