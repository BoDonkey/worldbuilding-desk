import path from 'node:path';

/*
 * SagaSpine's data folder (Slice 5.2). Builds before 0.1 kept the author's
 * projects, settings, and saved keys in a folder named "desktop" (the package
 * name). On first launch this moves that folder to "SagaSpine" in one rename,
 * so nothing is copied and nothing is left half-moved. The app name itself
 * stays the same, so keys saved with the system keychain still decrypt.
 */

export const DATA_FOLDER_NAME = 'SagaSpine';
export const LEGACY_DATA_FOLDER_NAME = 'desktop';
/** Written once the folder is settled, so later launches never move anything. */
export const DATA_FOLDER_MARKER = '.sagaspine-data-folder';

export interface DataFolderFs {
  existsSync(target: string): boolean;
  renameSync(from: string, to: string): void;
  mkdirSync(target: string, options: {recursive: true}): unknown;
  writeFileSync(target: string, data: string): void;
}

export interface DataFolderChoice {
  directory: string;
  /** What happened, for the log. */
  outcome: 'ready' | 'created' | 'moved' | 'kept-legacy';
  /** A folder that was already at the new path before the move, kept under this name. */
  setAside?: string;
}

/**
 * Picks the data folder, moving the legacy one when needed. A folder already
 * at the new path without the marker (left by a test build, for example) is
 * renamed out of the way, never deleted. If a move fails, the app keeps using
 * the legacy folder and tries again next launch.
 */
export function resolveDataFolder(params: {appData: string; fs: DataFolderFs; now?: () => Date}): DataFolderChoice {
  const {appData, fs} = params;
  const directory = path.join(appData, DATA_FOLDER_NAME);
  const legacy = path.join(appData, LEGACY_DATA_FOLDER_NAME);
  const marker = path.join(directory, DATA_FOLDER_MARKER);
  const markSettled = () => {
    try {
      fs.writeFileSync(marker, '1');
    } catch {
      // A missing marker only means the check runs again next launch.
    }
  };

  if (fs.existsSync(marker)) return {directory, outcome: 'ready'};

  if (!fs.existsSync(legacy)) {
    fs.mkdirSync(directory, {recursive: true});
    markSettled();
    return {directory, outcome: 'created'};
  }

  let setAside: string | undefined;
  try {
    if (fs.existsSync(directory)) {
      const stamp = (params.now?.() ?? new Date()).toISOString().replace(/[:.]/g, '-');
      setAside = path.join(appData, `${DATA_FOLDER_NAME} (set aside ${stamp})`);
      fs.renameSync(directory, setAside);
    }
    fs.renameSync(legacy, directory);
  } catch {
    return {directory: legacy, outcome: 'kept-legacy', setAside};
  }
  markSettled();
  return {directory, outcome: 'moved', setAside};
}

/**
 * Packaged-app tests start from a temporary app-data folder. Only an absolute
 * path is accepted, and the variable is ignored when `--user-data-dir` is set.
 */
export function testAppDataFolder(value: string | undefined): string | null {
  return value && path.isAbsolute(value) ? value : null;
}
