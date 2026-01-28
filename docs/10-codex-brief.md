# Codex Brief — Implement Markdown Stylizer Online

You are implementing a static SPA hosted on GitHub Pages.

Repo name: `markdown-stylizer-online`  
Brand name: "Markdown Stylizer Online"  
MVP browser: Chrome/Edge  
Offline required (no CDN).

## MVP requirements (must implement)
1. Two-pane editor + preview.
2. Markdown parsing with **no raw HTML**; sanitize output.
3. A4 page layout preview with **dashed line marking end of page 1**.
4. Aggressive wrapping to fit page width.
5. Tables may overflow + clip.
6. Code blocks: user toggle wrap vs crop.
7. Images: paste from clipboard + drag/drop; persist offline (IndexedDB).
8. Export PNG: default **ZIP with one PNG per page** (page-01.png, ...).
9. Export PDF: **one click programmatic PDF**. If >1 page, show confirmation dialog.
10. Page limit: default 10 pages; advanced toggle to raise limit.
11. Google Fonts selection. Cache fonts for offline use. Show warning if font not cached.
12. Full offline: service worker precaches app shell; runtime caches fonts.

## Implementation preferences
- TypeScript + minimal framework (vanilla DOM is fine).
- Use `markdown-it` (HTML disabled) + DOMPurify.
- Use `html-to-image` (or dom-to-image-more) for rasterization.
- Use `JSZip` for ZIP.
- Use `jsPDF` for PDF assembled from per-page PNGs.
- Use Vite for build/dev; set base path for GitHub Pages to `/markdown-stylizer-online/`.

## Milestones
Implement in order from `docs/04-milestones.md`. After each milestone:
- update `CHANGELOG.md` (create it) with brief notes
- ensure `npm run build` works
- keep the app offline-capable

Start with Milestone 0 and proceed sequentially.
