import type { LlmProvider, LlmConfig, LlmRequestOptions } from '../types';
import { getApiBaseUrl } from '../../../utils/apiConfig';

export class HubProvider implements LlmProvider {
  id = 'hub';

  async executePrompt(
    systemPrompt: string, 
    userPrompt: string, 
    settings: LlmConfig,
    options?: LlmRequestOptions
  ): Promise<string> {
    const hubToken = settings.hubApiKey || import.meta.env.VITE_HUB_API_KEY || "";
    const hubUrl = settings.hubUrl ? settings.hubUrl.replace(/\/$/, '') : getApiBaseUrl();
    const HUB_API_URL = `${hubUrl}/v1/media/prompt`;
    const model = settings.hubLlmModel || 'gpt-5.4-mini';

    console.log(`[HubProvider] Routing call via Hub Proxy: ${HUB_API_URL}`);
    
    const response = await fetch(HUB_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${hubToken}` 
      },
      body: JSON.stringify({
        prompt: systemPrompt + "\n\nUser Input:\n" + userPrompt,
        config: {
          provider: 'hub',
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
      throw new Error(`Lỗi StoryMee Hub Proxy (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const textResult = resData.text || resData.data?.text || resData.data?.result || resData.result || resData.data || "";
    if (!textResult) {
      throw new Error("Không nhận được phản hồi từ StoryMee Hub Proxy.");
    }
    return typeof textResult === 'string' ? textResult : JSON.stringify(textResult);
  }
}
