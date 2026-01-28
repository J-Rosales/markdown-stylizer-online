# Security Notes (Strict Markdown)

## Requirement
- No raw HTML allowed in markdown.
- Sanitization still applied.

## Parser configuration
- Configure markdown-it/marked to disallow HTML:
  - markdown-it: `html: false`
- Disallow potentially dangerous link protocols:
  - block `javascript:`, `data:` in user-entered links (except internal image scheme like `appimg://`)

## Sanitization
- Sanitize final HTML via DOMPurify.
- Explicitly allow only needed tags/attrs:
  - headings, paragraphs, lists, code/pre, blockquote, strong/em, a[href], img[src/alt], table tags
- Disallow `style` attributes to prevent CSS injection.
- Disallow event handler attributes.

## Threat model
- The user may paste untrusted markdown.
- App must not execute scripts through injected HTML.
- Exports must not embed active content.

## Notes
- Since this is a static client-only app, risk is primarily XSS within the app context.
