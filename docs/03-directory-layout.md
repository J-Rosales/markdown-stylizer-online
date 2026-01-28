# Recommended Starting Directory Layout

This is the suggested directory structure for `markdown-stylizer-online`.

```
markdown-stylizer-online/
  README.md
  docs/
    01-spec.md
    02-architecture.md
    03-directory-layout.md
    04-milestones.md
    05-github-pages.md
    06-offline.md
    07-fonts.md
    08-security.md
    09-test-plan.md
    10-codex-brief.md
  public/
    index.html
    favicon.svg
    icons/
      icon-192.png
      icon-512.png
    sw.js              # built or handwritten; for MVP can be handwritten
    manifest.webmanifest
  src/
    app.ts
    ui/
      controls.ts
      dialogs.ts
      editor.ts
      previewPane.ts
    markdown/
      render.ts
    preview/
      preview.ts
      dashedLineOverlay.ts
    layout/
      pageMetrics.ts
      units.ts
    export/
      paginate.ts
      rasterize.ts
      exportPdf.ts
      exportPngZip.ts
      download.ts
    assets/
      images.ts
      clipboard.ts
      dnd.ts
      idb.ts
    fonts/
      fonts.ts
    state/
      state.ts
      persist.ts
    sw/
      register.ts
  tools/
    build.mjs          # optional: simple copy/build pipeline
    dev-server.mjs     # optional: tiny local server
  package.json
  tsconfig.json
```

## Notes
- Prefer a small build step (TypeScript -> `public/dist/`) to keep GitHub Pages simple.
- If you avoid a bundler, ensure:
  - service worker pathing works on Pages
  - hashed assets are either avoided or handled explicitly
- If you use Vite, GitHub Pages base path must match `/markdown-stylizer-online/`.
