const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

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
