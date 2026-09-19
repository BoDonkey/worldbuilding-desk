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

  interface ElectronAPI {
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
