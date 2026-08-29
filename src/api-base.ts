function normalizeApiBase(value: string | undefined): string {
  const candidate = (value ?? '').trim().replace(/\/+$/, '');
  if (!candidate) return '';

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return '';
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    console.error('VITE_API_BASE_URL is invalid; using the in-browser factory.');
    return '';
  }
}

export const apiBase = normalizeApiBase(import.meta.env.VITE_API_BASE_URL);
export const hasRemoteApi = import.meta.env.DEV || Boolean(apiBase);

if (apiBase && typeof window !== 'undefined') {
  const nativeFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return nativeFetch(`${apiBase}${input}`, init);
    }

    if (input instanceof URL && input.pathname.startsWith('/api/') && input.origin === window.location.origin) {
      return nativeFetch(new URL(`${apiBase}${input.pathname}${input.search}`), init);
    }

    return nativeFetch(input, init);
  }) as typeof window.fetch;
}
