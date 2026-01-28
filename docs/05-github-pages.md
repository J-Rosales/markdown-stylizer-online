# GitHub Pages Hosting Notes

Repo: `markdown-stylizer-online`  
Target: GitHub Pages (static hosting)

## Recommended approach
Use a build that outputs static assets to a folder GitHub Pages can serve:
- `dist/` (common for Vite), or
- `public/` if no build step.

## SPA routing
This app can be a single page with no client-side routes. If routes are added later, add the standard Pages SPA fallback:
- A `404.html` that redirects to `index.html` (optional for MVP).

## Base path
On GitHub Pages, your app is served at:
- `https://<user>.github.io/markdown-stylizer-online/`

If using Vite:
- set `base: '/markdown-stylizer-online/'` in `vite.config.ts`.

Service worker paths must also respect the base path; prefer registration using relative URLs derived from `import.meta.env.BASE_URL` (Vite) or `document.baseURI`.

## Deployment options
- GitHub Actions deploy (recommended)
- Or manual deploy to `gh-pages` branch

Keep runtime dependencies local (no CDN) to satisfy offline requirement.
