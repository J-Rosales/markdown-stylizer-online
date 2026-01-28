# Offline Strategy

## Goals
- App loads offline after the first successful load.
- User data persists:
  - markdown + settings (localStorage)
  - images (IndexedDB)
- Exports function offline.

## Service worker cache plan (MVP)
1. Precache app shell:
   - `index.html`, CSS, JS bundles, icons, manifest
2. Runtime caching:
   - Google Fonts CSS and font binaries (cache-first with revalidate)
3. Ensure updates:
   - SW update prompt or silent refresh policy

## Implementation notes
- Prefer Workbox in build pipeline OR a minimal custom SW for MVP.
- Avoid CDN scripts/styles.
- Use versioned cache names.

## IndexedDB storage
- Store images as Blobs with metadata table:
  - id, mime, createdAt, name, size
- Provide cleanup utilities later; MVP can omit.

## Export stability
Before export, ensure:
- `await document.fonts.ready`
- all images are loaded (resolve promises for image elements)
- rasterization uses an export-only DOM to avoid UI artifacts
