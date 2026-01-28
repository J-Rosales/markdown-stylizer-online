# Feature: Import fonts from Google Fonts (secure implementation)

## Threat model (what we prevent)
- SSRF / arbitrary fetch: user input must not cause requests to attacker-controlled hosts
- HTML/CSS execution: never fetch or execute Google Fonts HTML or CSS
- Untrusted binary ingestion: only fetch known font binaries from trusted origin
- Resource exhaustion: cap request sizes and count; avoid huge fonts / too many variants
- Persistent poisoning: if you cache, cache by content hash; isolate per-user/project

## Supported user inputs
A) Font family name (preferred for UX):
- Example: "Montserrat"

B) Google Fonts specimen URL:
- Example: https://fonts.google.com/specimen/Montserrat

Both inputs are normalized to a single value:
- `familyName` (string)

## High-level approach (current implementation)
We DO NOT scrape `https://fonts.google.com/specimen/...` or run CSS.
We only:
1) Normalize input -> `familyName`
2) Resolve variants via a structured metadata endpoint implemented in the service worker
3) Select safe variants (e.g. 400 regular, optionally 700, and italic if requested)
4) Fetch font binaries ONLY from `https://fonts.gstatic.com/` and ONLY in `woff2` (fallback `woff`)
5) Register in browser via `FontFace` with ArrayBuffer (no CSS injection)
6) Fail with a clear user-facing message if:
   - font family not found
   - resolve request times out
   - binary download times out / fails validation

## Input normalization rules (client)

### Case 1: User typed a name
- Trim whitespace
- Collapse internal whitespace to single spaces
- Length bounds: 1..80
- Allowed chars: letters, numbers, space, hyphen, apostrophe (strict allowlist; reject others)
- Result is `familyName`

If invalid -> show:
- "Invalid font name. Enter a Google Fonts family name (e.g. Montserrat)."

### Case 2: User pasted a URL
- Parse with URL constructor
- Accept only origin exactly `https://fonts.google.com`
- Accept only pathname matching `/specimen/<slug>` (ignore query/fragment)
- Extract `<slug>`, decode, replace `+` with space (best-effort)
- Result is `familyName`

If invalid -> show:
- "Invalid Google Fonts URL. Use a specimen URL like https://fonts.google.com/specimen/Montserrat."

## Resolve step: get font variant URLs (service worker)

### Client -> Service worker
Call:
- `GET /api/google-fonts/resolve?family=<familyName>` (handled by `public/sw.js`)

Timeout handling:
- Client sets an explicit timeout (e.g. 8s). If exceeded -> show:
  - "Font lookup timed out. Try again."

### Service worker behavior (hardening)
- Validate `family` length/charset (same allowlist as client)
- Query Google metadata from a fixed Google endpoint (no user-controlled URLs)
- Disallow redirects
- Extract ONLY:
  - URLs whose origin is exactly `https://fonts.gstatic.com`
  - formats `woff2` (preferred) or `woff` (fallback)
- Return a sanitized list:
  - `[{ url, weight, style }]`

If family not found -> service worker returns 404 with payload:
- `{ code: "FONT_NOT_FOUND", message: "Font not found" }`

If outbound timeout -> service worker returns 504 with payload:
- `{ code: "LOOKUP_TIMEOUT", message: "Lookup timed out" }`

### Client failure messages (resolve step)
- If 404/FONT_NOT_FOUND -> show:
  - "Font not found on Google Fonts. Check the name/URL and try again."
- If 504/LOOKUP_TIMEOUT or client timeout -> show:
  - "Font lookup timed out. Try again."
- Else generic -> show:
  - "Could not look up that font. Try again."

## Binary fetch rules (client)

When fetching each font file:
- Fetch as ArrayBuffer
- Enforce limits:
  - Max bytes per font (e.g. 2–5 MB)
  - Max number of variants per import (e.g. 4)
- Enforce timeouts per file (e.g. 10s)
- Validate response:
  - status 200
  - `response.url` origin is still `https://fonts.gstatic.com` (no redirect escape)
  - content-type matches expected (be strict)
  - optional: validate magic bytes:
    - woff: starts with 'wOFF'
    - woff2: starts with 'wOF2'

Binary failure messages:
- If a font file download times out -> show:
  - "Font download timed out. Try again."
- If validation fails -> show:
  - "Downloaded font failed validation and was blocked."
- If any network error -> show:
  - "Could not download the font. Try again."

## Registration (client)
- Use `new FontFace(familyName, arrayBuffer, { weight, style })`
- `await fontFace.load()`
- `document.fonts.add(fontFace)`
- Add `familyName` to editor font dropdown (local only)
- Apply via editor CSS using the family name only (do not inject remote CSS)

If registration fails -> show:
- "Font could not be loaded in the browser. Try a different font."

## Caching & offline handling (current implementation)
- Cache font binaries in Cache Storage (by URL) for offline rehydration.
- Persist resolved variants in `localStorage` to reload fonts after refresh.
- On reload, attempt to load fonts from Cache Storage; fall back to network if missing.

**Cache-by-hash rationale:** We do not cache by content hash because the client fetches
and validates binaries directly from `https://fonts.gstatic.com` with strict origin,
format, and magic-byte checks. Using URL-based Cache Storage keeps the implementation
simple for a static app while still preventing untrusted sources. Hash-based caching is
recommended for multi-tenant/server scenarios and may be added later if a backend exists.

## Do NOT do any of the following
- DO NOT fetch `fonts.google.com/specimen/...` HTML
- DO NOT inject `<link rel="stylesheet" href="https://fonts.googleapis.com/...">` based on user input
- DO NOT accept user-provided CSS
- DO NOT accept non-gstatic font URLs
- DO NOT allow redirects or non-https
- DO NOT store fonts globally/shared across tenants without hashing and isolation

## Minimal pseudocode outline

Client:
1) userInput -> normalize:
   - if looks like URL: validate + extract familyName
   - else: validate as name -> familyName
2) resolve variants (timeout 8s):
   - GET /api/google-fonts/resolve?family=familyName
   - handle 404 -> "Font not found..."
   - handle timeout -> "Font lookup timed out..."
3) for each variant (timeout 10s each):
   - validate url origin == fonts.gstatic.com
   - fetch ArrayBuffer with size limits + timeout
   - validate mime + magic bytes
   - register FontFace
4) on success: update editor font list + select it

Service worker:
- validate family
- query fixed Google metadata endpoint (no redirects)
- if not found -> 404 FONT_NOT_FOUND
- if timeout -> 504 LOOKUP_TIMEOUT
- return sanitized gstatic woff2/woff URLs

## Operational safeguards (future)
- Per-user rate limiting (imports/minute)
- Cache by content hash (sha256) to dedupe
- Store per-user/project if persistence is needed
- Telemetry: log blocked URLs/redirect attempts for abuse detection
