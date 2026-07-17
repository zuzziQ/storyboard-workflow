export interface LlmConfig {
  llmProvider: string;
  geminiApiKey: string;
  hubApiKey: string;
  hubUrl: string;
  hubLlmModel: string;
  sdkUrl: string;
  sdkApiKey: string;
  sdkLlmModel: string;
  googleLlmModel: string;
}

export interface LlmRequestOptions {
  jobType?: string;
  purpose?: string;
  projectName?: string;
}

export interface LlmProvider {
  id: string; // 'hub' | 'gemini' | 'sdk'
  executePrompt(
    systemPrompt: string, 
    userPrompt: string, 
    settings: LlmConfig, 
    options?: LlmRequestOptions
  ): Promise<string>;
}
