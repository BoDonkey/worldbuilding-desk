export type ExternalUrlOpener = (url: string) => Promise<void>;

const allowedExternalProtocols = new Set(['https:', 'http:']);

export function isSafeExternalUrl(url: string): boolean {
  try {
    return allowedExternalProtocols.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function openExternalIfSafe(
  url: string,
  openExternal: ExternalUrlOpener
): boolean {
  if (!isSafeExternalUrl(url)) {
    console.warn(`Blocked unsafe external URL: ${url}`);
    return false;
  }

  try {
    void openExternal(url).catch((error: unknown) => {
      console.warn(`Failed to open external URL: ${url}`, error);
    });
    return true;
  } catch (error) {
    console.warn(`Failed to open external URL: ${url}`, error);
    return false;
  }
}
