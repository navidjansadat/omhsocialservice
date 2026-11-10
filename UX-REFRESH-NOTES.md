# OMH Social Services — UX refresh

## What changed
- Rebuilt the public homepage around service discovery, search, categories, transparent service details, and direct support.
- Rebuilt the services listing page with a simpler search/filter flow and mobile-first layout.
- Introduced a light, clean digital visual system with OMH green accents, clearer typography, reduced clutter, and responsive cards.
- Removed the injected ticker and desktop clock/foreign-exchange widget from the shared shell; these distracted from service discovery.
- Preserved the existing service, category, post, settings, and admin API integration hooks.
- Recovered CSS accidentally stored in `public/admin/script.js` into the admin stylesheet and left a compatibility stub.

## Checks performed
- Node syntax check passed for server.js and the public/admin JavaScript files.
- These checks do not verify live Supabase credentials, deployed Render behavior, browser visual fidelity, or real database policies.
- Before deployment, test admin sign-in, service CRUD, category filters, WhatsApp order links, image/PDF upload, and mobile navigation with the actual environment.
