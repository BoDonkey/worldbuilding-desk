import {contextBridge, ipcRenderer} from 'electron';

type Listener<T> = (data: T) => void;

function subscribe<T>(channel: string, listener: Listener<T>) {
  const handler = (_event: Electron.IpcRendererEvent, payload: T) => listener(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('electronAPI', {
  llmStream: (payload: unknown) => ipcRenderer.invoke('llm:stream', payload),
  onLLMChunk: (callback: Listener<{requestId: string; text: string}>) =>
    subscribe('llm:stream:chunk', callback),
  onLLMComplete: (callback: Listener<{requestId: string}>) =>
    subscribe('llm:stream:complete', callback),
  onLLMError: (callback: Listener<{requestId: string; message: string}>) =>
    subscribe('llm:stream:error', callback)
});
