# Milestone-based Development Cycle (End-to-End)

This plan is designed to be handed to an implementation agent.

## Milestone 0 — Repo + Build/Run Baseline
**Goal:** reproducible local dev + GH Pages deploy path.

Deliverables:
- Decide tooling: Vite (recommended) OR minimal TS build scripts.
- `public/index.html` renders a placeholder app.
- Local dev command.
- Production build command.
- GH Pages deploy guide validated.

Acceptance:
- `npm run dev` works locally.
- `npm run build` outputs static assets.
- Deploy to Pages shows the app.

---

## Milestone 1 — Editor + Preview Rendering
**Goal:** markdown -> sanitized HTML preview.

Deliverables:
- Basic two-pane UI (editor + preview).
- `markdown-it` rendering with HTML disabled.
- `DOMPurify` sanitation.
- Live update with debounce.
- Basic typography CSS.

Acceptance:
- Markdown edits update preview quickly.
- No raw HTML appears in preview even if typed.

---

## Milestone 2 — Page Layout + Dashed Page-1 Marker
**Goal:** A4 page layout model and visible page-1 boundary.

Deliverables:
- A4 page settings (portrait, margins default).
- Preview container sized to page width.
- Overlay dashed line indicating page 1 end inside preview.
- Aggressive wrapping rules applied globally.

Acceptance:
- Content wraps to avoid horizontal overflow (except tables/code crop mode).
- Dashed marker is stable while scrolling.

---

## Milestone 3 — Themes + Typography Controls
**Goal:** CSS-variable theme system + essential controls.

Deliverables:
- Theme registry (4 themes: Light/Dark/Paper/Terminal).
- Controls: font size, line height, max width (page-constrained), paragraph spacing.
- Persist settings in localStorage.

Acceptance:
- Theme switching is instantaneous.
- Refresh restores state.

---

## Milestone 4 — Images via Paste and Drag & Drop (Offline-safe)
**Goal:** insert images into markdown and persist locally.

Deliverables:
- Paste handler for image clipboard payloads.
- Drag & drop handler for image files.
- Store in IndexedDB (id -> blob/data).
- Insert markdown references (e.g., `![alt](appimg://<id>)`).
- Custom image resolver to render those images in preview/export.

Acceptance:
- Dropped/pasted images appear in preview.
- Refresh preserves images and references.
- Works offline after initial insertion.

---

## Milestone 5 — Pagination + Rasterizer
**Goal:** deterministic page slicing and rendering to PNG.

Deliverables:
- `pageMetrics` implementation converts A4 + margins to px.
- `paginate` computes slice offsets and page count.
- `rasterize` renders each page slice to PNG at chosen scale.
- Enforce default max pages (10) with advanced toggle override.

Acceptance:
- PNG for each page matches preview pagination.
- Long docs produce multiple pages without overlap artifacts.

---

## Milestone 6 — PNG ZIP Export (Default)
**Goal:** one-click ZIP containing per-page PNGs.

Deliverables:
- `exportPngZip`:
  - rasterize pages
  - zip with `page-01.png`, ...
  - download zip
- UI button + progress indicator.

Acceptance:
- Clicking export downloads a zip that opens correctly.
- Page images are in correct order and size.

---

## Milestone 7 — One-click PDF Export + Page-1 Confirmation
**Goal:** programmatic PDF export and confirmation dialog.

Deliverables:
- If content exceeds page 1, show confirm dialog.
- Generate PDF via jsPDF using the per-page PNGs.
- Download `document.pdf` (name can be improved later).

Acceptance:
- One click yields a PDF download.
- Confirmation triggers only when page count > 1.

---

## Milestone 8 — Google Fonts + Offline Caching + Export Notice
**Goal:** font selector + cache strategy + user warnings.

Deliverables:
- Font selector (subset list or search).
- Fetch font CSS and binaries; cache via service worker.
- UI status:
  - cached / not cached / error
- Export warning if selected font not available offline.
  - Note: migrate to Cache Storage for fonts; keep current caching behavior for now.

Acceptance:
- When online: selecting a Google font applies it.
- After reload offline: cached fonts still work.
- Warning appears if font not cached.

---

## Milestone 9 — Offline Hardening
**Goal:** app works offline as a PWA-like static site.

Deliverables:
- Service worker precaches app shell.
- Cache strategy for fonts and any internal assets.
- “Offline ready” indicator.

Acceptance:
- Load once online; then disconnect; app still loads and exports PNG/PDF.
- Existing documents (state + images) remain available.

---

## Milestone 10 — QA + Polishing
**Goal:** stabilize output and edge cases.

Deliverables:
- Manual QA checklist executed.
- Fix: image loading timing for exports, font readiness, large memory spikes.
- Basic error handling / user-facing messages.

Acceptance:
- Passes `docs/09-test-plan.md` MVP cases.
