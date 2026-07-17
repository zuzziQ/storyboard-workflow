import type { LlmProvider, LlmConfig, LlmRequestOptions } from '../types';

export class SdkProvider implements LlmProvider {
  id = 'sdk';

  async executePrompt(
    systemPrompt: string, 
    userPrompt: string, 
    settings: LlmConfig,
    options?: LlmRequestOptions
  ): Promise<string> {
    const sdkUrl = settings.sdkUrl ? settings.sdkUrl.replace(/\/$/, '') : 'https://bapi.vidtory.net';
    const sdkApiKey = settings.sdkApiKey || '';
    if (!sdkApiKey) {
      throw new Error("Vui lòng thiết lập Vidtory SDK API Key trong phần Settings.");
    }
    const SDK_API_URL = `${sdkUrl}/generative-core/text`;
    const model = settings.sdkLlmModel || 'gemini-3-flash-preview';

    console.log(`[SdkProvider] Routing Vidtory SDK call DIRECTLY to: ${SDK_API_URL}`);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': sdkApiKey
    };
    if (sdkApiKey && !sdkApiKey.startsWith('vidtory_')) {
      headers['Authorization'] = `Bearer ${sdkApiKey}`;
    }

    const response = await fetch(SDK_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        modelId: model,
        prompt: systemPrompt + "\n\nUser Input:\n" + userPrompt
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Lỗi Vidtory SDK trực tiếp (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    const isPending = resData.data?.status === 'PENDING' || resData.status === 'PENDING' || resData.data?.status === 'processing';
    const jobId = resData.data?.generationHistoryId || resData.data?.jobId || resData.generationHistoryId || resData.jobId;

    if (isPending && jobId) {
      console.log(`[SdkProvider] Polling Async Job ID: ${jobId}`);
      let attempts = 0;
      const maxAttempts = 60; // 2 mins

      while (attempts < maxAttempts) {
        attempts++;
        await new Promise(r => setTimeout(r, 2000));

        try {
          const pollRes = await fetch(`${sdkUrl}/generative-core/jobs/${jobId}/status`, { headers });
          if (!pollRes.ok) continue;

          const pollData = await pollRes.json();
          const job = pollData.data;
          if (!job) continue;

          const status = (job.status || '').toUpperCase();
          if (status === 'COMPLETED' || status === 'SUCCESS' || status === 'DONE') {
            const textVal = job.result?.text || job.result?.result || job.result || job.output || "";
            if (!textVal) throw new Error("Không nhận được phản hồi text từ kết quả SDK.");
            return typeof textVal === 'string' ? textVal : JSON.stringify(textVal);
          }

          if (status === 'FAILED' || status === 'ERROR') {
            throw new Error(job.error || "Thao tác sinh text thất bại trên SDK.");
          }
        } catch (pollErr: any) {
          console.warn(`[SdkProvider Poll] Attempt ${attempts} failed:`, pollErr.message);
          if (pollErr.message && !pollErr.message.includes("fetch")) {
            throw pollErr;
          }
        }
      }
      throw new Error("Quá thời gian sinh prompt trên Vidtory SDK (Timeout direct polling).");
    }

    const textResult = resData.text || resData.data?.text || resData.data?.result || resData.result || resData.data || "";
    if (!textResult) {
      throw new Error("Không nhận được phản hồi từ Vidtory SDK.");
    }
    return typeof textResult === 'string' ? textResult : JSON.stringify(textResult);
  }
}
