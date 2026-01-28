# Google Fonts Support + Limitations

## Requirement
- Provide Google Fonts selection.
- Work offline after fonts have been fetched at least once.
- Provide a notice of limitations when exporting.

## Practical plan
- Maintain a curated list for MVP (e.g., 20 common fonts) to avoid building a full search UI.
- When a font is selected:
  1. fetch the Google Fonts CSS
  2. parse the CSS for font URLs
  3. request the font binaries
  4. cache both CSS and binaries via service worker (or app-driven caching)
  5. apply the font family to CSS variables

## Offline semantics
- If the user selects a font while offline and it isn't cached:
  - show status “not cached”
  - fall back to a system font stack

## Export limitation notice
- Programmatic export relies on the browser having the font available.
- If the font is not cached/available, exports may fall back to a default font and cause line breaks to differ.

UI copy (suggested):
- “Font not cached for offline use. Exports may fall back to system fonts until you load this font online once.”

## Future improvements
- Full Google Fonts search
- Custom font upload (local file) stored in IndexedDB
