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

  /** Mirrors the desktop main process `UpdateSnapshot` (Slice 5.1). */
  type ElectronUpdateStatus =
    | {state: 'idle'}
    | {state: 'checking'}
    | {state: 'up-to-date'}
    | {state: 'available'; version: string; releaseUrl: string}
    | {state: 'downloading'; version: string; percent: number}
    | {state: 'downloaded'; version: string}
    | {state: 'error'; message: string};

  interface ElectronUpdateSnapshot {
    supported: boolean;
    currentVersion: string;
    checkAutomatically: boolean | null;
    installMode: 'in-app' | 'release-page';
    status: ElectronUpdateStatus;
  }

  interface ElectronUpdatesAPI {
    get: () => Promise<ElectronUpdateSnapshot>;
    check: () => Promise<ElectronUpdateSnapshot>;
    download: () => Promise<ElectronUpdateSnapshot>;
    install: () => Promise<boolean>;
    setCheckAutomatically: (value: boolean) => Promise<ElectronUpdateSnapshot>;
    openReleasePage: () => Promise<void>;
    onChange: (callback: (snapshot: ElectronUpdateSnapshot) => void) => () => void;
  }

  /** Mirrors the desktop main process backup types (slice 4.94). */
  type ElectronBackupSchedule = 'off' | 'daily' | 'on-close';

  interface ElectronBackupRunItem {
    projectName: string;
    fileName?: string;
    message?: string;
  }

  interface ElectronBackupRunResult {
    finishedAt: number;
    status: 'completed' | 'folder-missing';
    written: ElectronBackupRunItem[];
    skipped: ElectronBackupRunItem[];
    failed: ElectronBackupRunItem[];
    unchanged: number;
  }

  interface ElectronBackupSnapshot {
    folder: string | null;
    folderAvailable: boolean;
    schedule: ElectronBackupSchedule;
    keep: number;
    lastRun: ElectronBackupRunResult | null;
  }

  type ElectronBackupWriteResult =
    | {ok: true; fileName: string; pruned: string[]}
    | {ok: false; reason: 'no-folder' | 'folder-missing'};

  /** Scheduled backups to a folder the author picks; the renderer never names a path. */
  interface ElectronBackupsAPI {
    get: () => Promise<ElectronBackupSnapshot>;
    chooseFolder: () => Promise<{snapshot: ElectronBackupSnapshot; error?: string}>;
    setPreferences: (patch: {schedule?: ElectronBackupSchedule; keep?: number}) => Promise<ElectronBackupSnapshot>;
    write: (request: {fileName: string; bytes: Uint8Array}) => Promise<ElectronBackupWriteResult>;
    recordRun: (result: ElectronBackupRunResult) => Promise<ElectronBackupSnapshot>;
    closeRunFinished: () => Promise<void>;
    onChange: (callback: (snapshot: ElectronBackupSnapshot) => void) => () => void;
    onRunBeforeClose: (callback: () => void) => () => void;
  }

  interface ElectronAPI {
    /** Scheduled backups (4.94); older desktop builds lack it. */
    backups?: ElectronBackupsAPI;
    /** App updates; older desktop builds lack it. */
    updates?: ElectronUpdatesAPI;
    /** Older desktop builds lack it. */
    providerKeys?: ElectronProviderKeysAPI;
    llmComplete: (payload: unknown) => Promise<string>;
    llmStream: (payload: unknown) => Promise<string>;
    /** Reads a loopback local model server's context in the main process, outside renderer CORS. */
    llmLocalContextSize?: (payload: {baseUrl?: string}) => Promise<number | null>;
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
