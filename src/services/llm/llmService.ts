import type { LlmConfig, LlmProvider, LlmRequestOptions } from './types';
import { HubProvider } from './providers/hubProvider';
import { GeminiProvider } from './providers/geminiProvider';
import { SdkProvider } from './providers/sdkProvider';
import { getApiBaseUrl } from '../../utils/apiConfig';

class LlmService {
  private providers: Map<string, LlmProvider> = new Map();

  constructor() {
    this.registerProvider(new HubProvider());
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new SdkProvider());
  }

  registerProvider(provider: LlmProvider) {
    this.providers.set(provider.id, provider);
  }

  private getSettings(): LlmConfig {
    try {
      const state = (window as any).__flow_store__?.getState();
      if (state) {
        return {
          llmProvider: state.llmProvider || 'hub',
          geminiApiKey: state.geminiApiKey || '',
          hubApiKey: state.hubApiKey || (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || "",
          hubUrl: state.hubUrl || '',
          hubLlmModel: state.hubLlmModel || 'gpt-5.4-mini',
          sdkUrl: state.sdkUrl || 'https://bapi.vidtory.net',
          sdkApiKey: state.sdkApiKey || '',
          sdkLlmModel: state.sdkLlmModel || 'gemini-3-flash-preview',
          googleLlmModel: state.googleLlmModel || 'gemini-2.5-flash'
        };
      }
    } catch (e) {}

    return {
      llmProvider: 'hub',
      geminiApiKey: '',
      hubApiKey: (typeof window !== 'undefined' ? localStorage.getItem('STORYMEE_HUB_API_KEY') : null) || import.meta.env.VITE_HUB_API_KEY || "",
      hubUrl: getApiBaseUrl(),
      hubLlmModel: 'gpt-5.4-mini',
      sdkUrl: 'https://bapi.vidtory.net',
      sdkApiKey: '',
      sdkLlmModel: 'gemini-3-flash-preview',
      googleLlmModel: 'gemini-2.5-flash'
    };
  }

  async execute(
    systemPrompt: string, 
    userPrompt: string, 
    options?: LlmRequestOptions
  ): Promise<string> {
    const settings = this.getSettings();
    let providerId = settings.llmProvider;

    if (providerId === 'google-native') providerId = 'gemini';

    const provider = this.providers.get(providerId) || this.providers.get('hub')!;
    
    try {
      return await provider.executePrompt(systemPrompt, userPrompt, settings, options);
    } catch (error: any) {
      console.warn(`[LlmService] Provider '${providerId}' failed: ${error.message}. Attempting fallback to Hub...`);
      if (providerId !== 'hub') {
        const hubProvider = this.providers.get('hub')!;
        return await hubProvider.executePrompt(systemPrompt, userPrompt, settings, options);
      }
      throw error;
    }
  }
}

export const llmService = new LlmService();
