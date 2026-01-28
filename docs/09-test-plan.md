# MVP Test Plan

## Functional tests
1. Markdown rendering
- Headings, lists, code, tables render correctly.
- Raw HTML is not rendered.

2. Page boundary overlay
- Dashed line at end of page 1 is visible and stable.

3. Aggressive wrapping
- Long words wrap in paragraphs.
- Links wrap.
- Code blocks:
  - wrap mode wraps
  - crop mode clips

4. Tables
- Wide tables clip (expected).
- No horizontal scrollbars in export output.

5. Images
- Paste an image from clipboard -> appears.
- Drag/drop image file -> appears.
- Refresh -> image persists and renders.
- Offline -> image still renders.

6. PNG ZIP export
- Produces zip with correct page count and `page-XX.png` files.
- Pages are in order.
- Visual matches preview.

7. PDF export
- If one page: no confirm dialog.
- If multiple pages: confirm dialog shows.
- PDF downloads, page size A4.
- Page breaks align with PNG pages.

8. Offline
- Load once online.
- Go offline.
- Reload -> app still loads.
- Export PNG/PDF works offline.
- Cached fonts remain usable offline.

## Performance tests (MVP)
- 10-page document export completes without crashing.
- Memory does not spike uncontrollably (monitor in Chrome Task Manager).
