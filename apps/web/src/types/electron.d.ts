export {};

declare global {
  interface ElectronLLMChunkEvent {
    requestId: string;
    text: string;
  }

  interface ElectronLLMCompleteEvent {
    requestId: string;
  }

  interface ElectronLLMErrorEvent {
    requestId: string;
    message: string;
  }

  type ElectronProviderKeyStatus = Record<'anthropic' | 'openai' | 'gemini', boolean>;

  /** Keys live in the desktop main process; the renderer can never read one back. */
  interface ElectronProviderKeysAPI {
    status: () => Promise<ElectronProviderKeyStatus>;
    set: (provider: 'anthropic' | 'openai' | 'gemini', key: string) => Promise<ElectronProviderKeyStatus>;
    clear: (provider: 'anthropic' | 'openai' | 'gemini') => Promise<ElectronProviderKeyStatus>;
  }

  interface ElectronAPI {
    /** Older desktop builds lack it. */
    providerKeys?: ElectronProviderKeysAPI;
    llmComplete: (payload: unknown) => Promise<string>;
    llmStream: (payload: unknown) => Promise<string>;
    /** Stops an in-flight stream in the main process. Older desktop builds lack it. */
    llmCancelStream?: (requestId: string) => Promise<boolean>;
    onLLMChunk?: (callback: (payload: ElectronLLMChunkEvent) => void) => () => void;
    onLLMComplete?: (callback: (payload: ElectronLLMCompleteEvent) => void) => () => void;
    onLLMError?: (callback: (payload: ElectronLLMErrorEvent) => void) => () => void;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
