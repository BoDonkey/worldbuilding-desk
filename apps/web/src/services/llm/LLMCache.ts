export class LLMCache {
  private readonly ttlMs: number;
  private readonly cache = new Map<string, {value: string; expiresAt: number}>();

  constructor(ttlMinutes = 5) {
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string): void {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs
    });
  }

  serialize(providerId: string, payload: unknown): string {
    const normalised = JSON.stringify(payload);
    return `${providerId}:${this.hash(normalised)}`;
  }

  private hash(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
}

export const llmCache = new LLMCache();
