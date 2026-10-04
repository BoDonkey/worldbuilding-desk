/**
 * Wraps a fetch stub so Ollama's installed-model lookup (`/api/tags`) answers
 * with locally installed models, as the private-local request policy requires,
 * and every other call goes to `inner`.
 */
export function answerOllamaTags<T extends (url: string, init?: RequestInit) => unknown>(
  inner: T,
  models: string[] = ['qwen3:latest', 'cache-test-model:latest']
) {
  return (url: string, init?: RequestInit) =>
    String(url).endsWith('/api/tags')
      ? Promise.resolve(new Response(JSON.stringify({models: models.map((name) => ({name}))})))
      : inner(url, init);
}

/** The calls a fetch mock received, minus the installed-model lookups. */
export function withoutTagLookups<C extends unknown[]>(calls: C[]): C[] {
  return calls.filter((call) => !String(call[0]).endsWith('/api/tags'));
}
