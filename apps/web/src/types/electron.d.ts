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
    llmStream: (payload: unknown) => Promise<string>;
    onLLMChunk?: (callback: (payload: ElectronLLMChunkEvent) => void) => () => void;
    onLLMComplete?: (callback: (payload: ElectronLLMCompleteEvent) => void) => () => void;
    onLLMError?: (callback: (payload: ElectronLLMErrorEvent) => void) => () => void;
  }

  interface Window {
    electronAPI?: ElectronAPI;
  }
}
