declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void; }
}

const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const portfolioSite = (import.meta.env.VITE_PORTFOLIO_SITE_ID as string | undefined) || 'dropfable';

export function trackEvent(name: string, parameters: Record<string, string | number> = {}) {
  window.gtag?.('event', name, { portfolio_site: portfolioSite, ...parameters });
}

export function initializeAnalytics() {
  if (!measurementId || typeof document === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag('js', new Date());
  window.gtag('config', measurementId, { portfolio_site: portfolioSite });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  document.addEventListener('click', (event) => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
    if (!anchor) return;
    const url = new URL(anchor.href, window.location.href);
    trackEvent(url.origin === window.location.origin ? 'internal_recirculation' : 'outbound_click', {
      destination: url.origin === window.location.origin ? url.pathname : url.hostname,
    });
  });
}
