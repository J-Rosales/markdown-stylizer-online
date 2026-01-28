# Spec — Markdown Stylizer Online (MVP)

## 1. Goal
A static single-page web app that:
- styles Markdown into a page-bounded preview (A4 default),
- supports themes/typography controls,
- exports to:
  - **PDF (one click, programmatic)**, and
  - **PNG** as a **ZIP** containing **one image per page**,
- works **fully offline** (no CDN runtime dependencies).

Repository: `markdown-stylizer-online`  
Brand: "Markdown Stylizer Online"  
Hosting: GitHub Pages

---

## 2. Core UX Requirements

### 2.1 Editor + Preview
- Left: Markdown editor (textarea or code editor later).
- Right: Preview rendered as a print layout.
- Preview uses an **A4 page model** with margins and fixed width.
- Preview shows a **dashed horizontal line** indicating the end of **page 1**.

### 2.2 Export triggers
- Export **PDF** button:
  - One click -> downloads a PDF file.
  - If content exceeds page 1, show a confirmation dialog before export.
- Export **PNG** button:
  - By default creates and downloads a **ZIP** with **one PNG per page**.
  - The PNG export uses the same pagination rules as PDF.

### 2.3 Page count limits
- Default maximum: **10 pages**.
- “Advanced settings” toggle can raise the limit (with warning about perf/memory).

---

## 3. Content & Formatting Rules

### 3.1 Horizontal fit
- Content must fit horizontally to the page width.
- System behavior: **wrap aggressively** to avoid horizontal overflow.

### 3.2 Tables
- Tables may **overflow and be clipped** horizontally.
- No automatic scaling-to-fit.
- (Optional later) provide a “table wrap” mode; MVP may clip.

### 3.3 Code blocks
User option:
- **Wrap** inside code blocks (page-fit oriented), OR
- **Crop** (no wrap; clipped to page width).

### 3.4 Markdown safety
- Strict Markdown: **no raw HTML passthrough**.
- Sanitize rendered output before injecting into DOM.

### 3.5 Images
Images are inserted via:
- Paste from clipboard, or
- Drag-and-drop from another window.

Images are stored in app state (recommended: IndexedDB) and referenced in the rendered document such that:
- the project remains offline-capable,
- exports can embed images reliably.

---

## 4. Export Requirements

### 4.1 PDF (programmatic)
- PDF must paginate vertically; page size A4.
- PDF generation is programmatic (no print dialog).
- Confirm if content exceeds page 1.

**Known tradeoff for MVP**: if PDF is assembled from page bitmaps, text will not be selectable. This is acceptable for MVP given the “one click” requirement.

### 4.2 PNG (ZIP, one per page)
- Create N page images based on pagination and zip them.
- Naming: `page-01.png`, `page-02.png`, ...
- Default scale: 2x device pixel ratio equivalent (configurable).

---

## 5. Offline Requirement
Must work fully offline:
- app shell precached by service worker,
- chosen fonts cached when online,
- no external runtime CDN links.

---

## 6. Browser Support
- MVP target: **Chrome / Edge**.
- Others later.

---

## 7. Non-goals (MVP)
- Collaboration.
- Server-side rendering.
- Full project management (import/export project bundles) beyond local persistence.
- Advanced WYSIWYG editing.
- Multi-document workspace.

---

## 8. Deliverables (MVP)
- GitHub Pages deployable static build.
- Working editor/preview.
- Themes & typography controls (small set).
- Programmatic PDF export.
- ZIP-per-page PNG export.
- Offline support.
