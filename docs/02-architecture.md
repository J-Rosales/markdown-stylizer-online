# Architecture — Modules and Data Flow

## 1. High-level pipeline
1. Markdown input -> parse to HTML
2. Sanitize HTML
3. Inject into preview container
4. Apply theme + page layout CSS
5. Export pipeline:
   - paginate
   - rasterize per page
   - PDF: assemble pages
   - PNG: zip and download

## 2. Recommended module boundaries (TypeScript)
- `src/app.ts`
  - wires UI, state, events, initializes app
- `src/markdown/render.ts`
  - parse markdown -> sanitized HTML string
- `src/preview/preview.ts`
  - applies HTML to preview root, post-processing hooks (anchors, etc.)
- `src/layout/pageMetrics.ts`
  - computes A4 page content dimensions in px based on CSS + current settings
- `src/export/paginate.ts`
  - computes per-page slice offsets based on measured DOM heights
- `src/export/rasterize.ts`
  - renders a DOM slice to PNG (html-to-image/dom-to-image-more)
- `src/export/exportPdf.ts`
  - consumes per-page PNGs -> jsPDF -> downloads PDF
- `src/export/exportPngZip.ts`
  - consumes per-page PNGs -> JSZip -> downloads ZIP
- `src/assets/images.ts`
  - paste/drop handlers -> store in IndexedDB -> create markdown refs
- `src/fonts/fonts.ts`
  - Google Fonts selection -> fetch CSS -> cache fonts -> apply
- `src/state/state.ts`
  - in-memory app state + persistence adapters (localStorage, IndexedDB)
- `src/sw/register.ts`
  - service worker registration and update notifications

## 3. State model (minimal)
- markdownText: string
- themeId: string
- page:
  - size: 'A4'
  - orientation: 'portrait'|'landscape'
  - marginMm: number
- codeBlocks:
  - mode: 'wrap'|'crop'
- export:
  - scale: 1|2|3
  - maxPages: number
  - advancedEnabled: boolean
- fonts:
  - family: string (Google font name or system)
  - status: 'cached'|'not_cached'|'error'
- images:
  - index of stored images (id -> metadata), actual binary in IndexedDB

## 4. Pagination strategy
- Render full content once in an offscreen/export root with identical CSS.
- Measure total content height.
- Page content height = A4 page height - margins (converted to px).
- Page count = ceil(totalHeight / pageContentHeight), clamped by maxPages.
- Each page slice uses a clipped wrapper:
  - wrapper has fixed height = pageContentHeight
  - inner content translated upward by offset = pageIndex * pageContentHeight
- Rasterize wrapper to PNG.

## 5. Export confirmation rule
- If totalHeight > pageContentHeight (page 1), show confirmation dialog for PDF export.

## 6. Security model
- Markdown parser configured to disable HTML.
- Sanitize rendered HTML anyway (defense in depth).
- Do not allow user-specified script URLs or inline event handlers.
