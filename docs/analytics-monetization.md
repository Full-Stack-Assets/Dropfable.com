# Analytics and deployment activation

The static build loads GA4 only when `VITE_GA_MEASUREMENT_ID` is configured. `tool_start`, `tool_complete`, and `tool_error` describe the asset-manufacturing funnel; `kit_downloaded`, `product_listed`, and seller-reported `purchase` capture the listing-to-sale path. Internal and outbound links use the portfolio click contract. Set `VITE_PORTFOLIO_SITE_ID=dropfable`.

GitHub Pages must use the repository's Actions workflow. The workflow verifies that the deployed artifact contains compiled `/assets/` references and cannot accidentally publish the development `/src/main.tsx` entry again.

Create and verify the `dropfable.com` Search Console domain property, register GA4 custom dimensions, and treat `generate_lead`, `product_cta`, `checkout_start`, and `purchase` as reserved event names for future public commerce. Do not enable advertising until the working product path, consent requirements, and traffic quality are verified.
