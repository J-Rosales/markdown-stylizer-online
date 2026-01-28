import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

const starterText = `# Markdown Stylizer Online

Type Markdown on the left.

- Live preview on the right
- HTML is disabled
- Output is sanitized

\`\`\`ts
console.log("Hello, world!");
\`\`\`
`;

const debounce = (fn: () => void, waitMs: number) => {
  let handle: number | undefined;
  return () => {
    if (handle !== undefined) {
      window.clearTimeout(handle);
    }
    handle = window.setTimeout(fn, waitMs);
  };
};

if (app) {
  app.innerHTML = `
    <header class="app-header">
      <h1>Markdown Stylizer Online</h1>
      <p>Milestone 1: editor + preview rendering</p>
    </header>
    <main class="workspace">
      <section class="pane">
        <label class="pane-title" for="editor">Markdown</label>
        <textarea id="editor" spellcheck="false"></textarea>
      </section>
      <section class="pane">
        <div class="pane-title">Preview</div>
        <div class="preview-scroll">
          <div class="page-shell">
            <div class="page-marker" aria-hidden="true"></div>
            <div id="preview" class="preview-content"></div>
          </div>
        </div>
      </section>
    </main>
  `;

  const editor = app.querySelector<HTMLTextAreaElement>("#editor");
  const preview = app.querySelector<HTMLDivElement>("#preview");

  if (!editor || !preview) {
    throw new Error("Editor or preview element missing.");
  }

  const render = () => {
    const rawHtml = md.render(editor.value);
    preview.innerHTML = DOMPurify.sanitize(rawHtml);
  };

  const renderDebounced = debounce(render, 120);

  editor.value = starterText;
  render();

  editor.addEventListener("input", renderDebounced);
}
