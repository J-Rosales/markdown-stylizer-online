import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "tiptap-markdown";
import {
  MAX_IMAGE_BYTES,
  applyImageOptions,
  resolveAppImages,
  storeImageFile,
} from "./assets/images";
import { downloadBlob } from "./export/download";
import {
  FontStatus,
  getStoredVariants,
  loadFontFamilyFromCache,
  loadFontFamily,
  normalizeFontInput,
  popularFonts,
  resolveFontVariants,
  getFontCacheStatus,
  storeFontVariants,
} from "./fonts/fonts";
import { exportPngZip } from "./export/exportPngZip";
import { exportPdf } from "./export/exportPdf";
import { rasterizePages } from "./export/rasterize";
import { registerServiceWorker } from "./sw/register";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
});

type ThemeId = "light" | "dark" | "paper" | "terminal";

type AppSettings = {
  theme: ThemeId;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  paragraphSpacing: number;
  allowLargeImages: boolean;
  maxPages: number;
  advancedPages: boolean;
  pdfMethod: "html2pdf";
  fontFamily: string;
  warnOnOfflineFont: boolean;
};

const themes: Record<ThemeId, Record<string, string>> = {
  light: {
    "--app-bg": "#f6f7f9",
    "--panel-bg": "#ffffff",
    "--panel-border": "#e5e7eb",
    "--text-primary": "#1f2937",
    "--text-muted": "#4b5563",
    "--shadow-color": "rgba(15, 23, 42, 0.08)",
    "--code-bg": "#0f172a",
    "--code-text": "#e2e8f0",
  },
  dark: {
    "--app-bg": "#0f172a",
    "--panel-bg": "#111827",
    "--panel-border": "#1f2937",
    "--text-primary": "#f9fafb",
    "--text-muted": "#9ca3af",
    "--shadow-color": "rgba(0, 0, 0, 0.35)",
    "--code-bg": "#111827",
    "--code-text": "#f9fafb",
  },
  paper: {
    "--app-bg": "#f3f0ea",
    "--panel-bg": "#fffdf8",
    "--panel-border": "#e7e2d9",
    "--text-primary": "#3f3a30",
    "--text-muted": "#6b6459",
    "--shadow-color": "rgba(63, 58, 48, 0.12)",
    "--code-bg": "#3f3a30",
    "--code-text": "#f9f6ef",
  },
  terminal: {
    "--app-bg": "#0b0f0c",
    "--panel-bg": "#0f1412",
    "--panel-border": "#1f2a25",
    "--text-primary": "#c7f9cc",
    "--text-muted": "#84cc9b",
    "--shadow-color": "rgba(0, 0, 0, 0.4)",
    "--code-bg": "#0b0f0c",
    "--code-text": "#c7f9cc",
  },
};

const defaultSettings: AppSettings = {
  theme: "light",
  fontSize: 15,
  lineHeight: 1.6,
  maxWidth: 170,
  paragraphSpacing: 14,
  allowLargeImages: false,
  maxPages: 10,
  advancedPages: false,
  pdfMethod: "html2pdf",
  fontFamily: "System",
  warnOnOfflineFont: true,
};

const settingsKey = "mso-settings";

const loadSettings = (): AppSettings => {
  const raw = localStorage.getItem(settingsKey);
  if (!raw) {
    return defaultSettings;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...defaultSettings, ...parsed };
  } catch {
    return defaultSettings;
  }
};

const saveSettings = (settings: AppSettings) => {
  localStorage.setItem(settingsKey, JSON.stringify(settings));
};

const applySettings = (settings: AppSettings) => {
  const themeVars = themes[settings.theme];
  Object.entries(themeVars).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  document.documentElement.style.setProperty(
    "--preview-font-size",
    `${settings.fontSize}px`
  );
  document.documentElement.style.setProperty(
    "--preview-line-height",
    settings.lineHeight.toString()
  );
  document.documentElement.style.setProperty(
    "--preview-max-width",
    `${settings.maxWidth}mm`
  );
  document.documentElement.style.setProperty(
    "--preview-paragraph-spacing",
    `${settings.paragraphSpacing}px`
  );
  document.documentElement.style.setProperty(
    "--preview-font-family",
    settings.fontFamily === "System"
      ? "system-ui, -apple-system, \"Segoe UI\", sans-serif"
      : `"${settings.fontFamily}", system-ui, -apple-system, "Segoe UI", sans-serif`
  );
};

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

registerServiceWorker();

if (app) {
  app.innerHTML = `
    <header class="app-header">
      <div class="app-header-row">
        <div class="app-header-text">
          <h1>Markdown Stylizer Online</h1>
          <p>Milestone 3: themes + typography controls</p>
        </div>
        <label class="header-control">
          Theme
          <select id="theme-select">
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="paper">Paper</option>
            <option value="terminal">Terminal</option>
          </select>
        </label>
      </div>
    </header>
    <main class="workspace">
      <section class="pane">
        <div class="pane-title-row">
          <label class="pane-title" for="editor">Markdown</label>
        </div>
        <div class="editor-toolbar" role="toolbar" aria-label="Editor toolbar">
          <div class="toolbar-group toolbar-grid" role="group" aria-label="Text style">
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="bold" aria-label="Bold" title="Bold">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M15.6 10.79c.78-.69 1.3-1.65 1.3-2.79 0-2.08-1.69-3.75-3.75-3.75H6v14h7.25c2.07 0 3.75-1.68 3.75-3.75 0-1.5-.86-2.8-2.1-3.46zM8.5 6.5h4.25c.69 0 1.25.56 1.25 1.25S13.44 9 12.75 9H8.5V6.5zm4.5 8H8.5v-3h4.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="italic" aria-label="Italic" title="Italic">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="underline" aria-label="Underline" title="Underline">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="strike" aria-label="Strikethrough" title="Strikethrough">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M6.85 7.76C7.64 6.09 9.36 5 11.64 5c1.94 0 3.39.75 4.02 1.82l1.74-1.01C16.3 4.37 14.3 3 11.64 3 8.74 3 6.35 4.43 5.56 6.53c-.21.53-.31 1.09-.31 1.68h2.05c0-.45.09-.88.26-1.25zM5 9v2h14V9H5zm6.64 8c-2.2 0-3.9-.93-4.66-2.25l-1.8 1.04C6.35 17.37 8.78 19 11.64 19c2.93 0 5.3-1.51 5.3-4.5 0-.6-.08-1.13-.23-1.6h-2.08c.17.43.26.88.26 1.36 0 1.67-1.36 2.74-3.25 2.74z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group toolbar-grid" role="group" aria-label="Headings">
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="paragraph">Normal</button>
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="h1">H1</button>
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="h2">H2</button>
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="h3">H3</button>
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="h4">H4</button>
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="h5">H5</button>
            <button type="button" class="toolbar-button toolbar-heading-button" data-heading="h6">H6</button>
          </div>
          <div class="toolbar-group toolbar-grid" role="group" aria-label="Lists">
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="bulletList" aria-label="Bulleted list" title="Bulleted list">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 10.5c-.83 0-1.5.67-1.5 1.5S3.17 13.5 4 13.5 5.5 12.83 5.5 12 4.83 10.5 4 10.5zm0-5c-.83 0-1.5.67-1.5 1.5S3.17 8.5 4 8.5 5.5 7.83 5.5 7 4.83 5.5 4 5.5zm0 10c-.83 0-1.5.67-1.5 1.5S3.17 18.5 4 18.5 5.5 17.83 5.5 17 4.83 15.5 4 15.5zM8 18h13v-2H8v2zm0-5h13v-2H8v2zm0-7v2h13V6H8z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="orderedList" aria-label="Numbered list" title="Numbered list">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm0-9h1V5H2v1h1v1H2v1h2V4H2v4zm0 4h1.8L2 14.1V15h3v-1H3.2L5 11.9V11H2v1zm6-1v2h13v-2H8zm0 6h13v-2H8v2zm0-10v2h13V7H8z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="taskList" aria-label="Checklist" title="Checklist">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M11 7h9v2h-9V7zm0 8h9v2h-9v-2zM4.5 7.5 3 6l-1 1 2.5 2.5 4-4-1-1-3 3zm0 8L3 14l-1 1 2.5 2.5 4-4-1-1-3 3z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group" role="group" aria-label="Blocks">
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="blockquote" aria-label="Blockquote" title="Blockquote">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M6 17h3l2-4V7H5v6h3l-2 4zm7 0h3l2-4V7h-6v6h3l-2 4z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="code" aria-label="Inline code" title="Inline code">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M9.4 16.6 8 18l-6-6 6-6 1.4 1.4L4.8 12l4.6 4.6zm5.2 0L19.2 12l-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="codeBlock" aria-label="Code block" title="Code block">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M20 5H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 12H4V7h16v10zM6 12l3.5-3.5-1.4-1.4L3.2 12l4.9 4.9 1.4-1.4L6 12zm4 3h6v-2h-6v2z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group toolbar-grid" role="group" aria-label="Alignment">
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="alignLeft" aria-label="Align left" title="Align left">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm0 4h12v2H3V7zm0 4h18v2H3v-2zm0 4h12v2H3v-2zm0 4h18v2H3v-2z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="alignCenter" aria-label="Align center" title="Align center">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm3 4h12v2H6V7zm-3 4h18v2H3v-2zm3 4h12v2H6v-2zm-3 4h18v2H3v-2z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="alignRight" aria-label="Align right" title="Align right">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm6 4h12v2H9V7zm-6 4h18v2H3v-2zm6 4h12v2H9v-2zm-6 4h18v2H3v-2z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button toolbar-grid-button" data-action="alignJustify" aria-label="Justify" title="Justify">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 3h18v2H3V3zm0 4h18v2H3V7zm0 4h18v2H3v-2zm0 4h18v2H3v-2zm0 4h18v2H3v-2z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group" role="group" aria-label="Insert">
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="link" aria-label="Link" title="Link">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3.9 12a5 5 0 0 1 5-5h3v2h-3a3 3 0 1 0 0 6h3v2h-3a5 5 0 0 1-5-5zm7-1h2v2h-2v-2zm4.1-4h-3V5h3a5 5 0 1 1 0 10h-3v-2h3a3 3 0 1 0 0-6z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="image" aria-label="Image" title="Image">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM5 5h14v9l-3.5-3.5-2.5 2.5-3.5-3.5L5 14V5zm0 14v-3l4-4 3.5 3.5 2.5-2.5L19 17v2H5z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group" role="group" aria-label="History">
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="undo" aria-label="Undo" title="Undo">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6 0 1.24-.38 2.39-1.02 3.34l1.46 1.46A7.962 7.962 0 0 0 20 13c0-4.42-3.58-8-8-8z"/></svg>
              </span>
            </button>
            <button type="button" class="toolbar-button toolbar-editor-button" data-action="redo" aria-label="Redo" title="Redo">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M12 5c-4.42 0-8 3.58-8 8 0 1.66.51 3.2 1.38 4.47l1.46-1.46A5.962 5.962 0 0 1 6 13c0-3.31 2.69-6 6-6v4l5-5-5-5v4z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group appearance-group" role="group" aria-label="Appearance">
            <span class="toolbar-label">Font</span>
            <select id="font-select" class="toolbar-select" aria-label="Font family"></select>
            <button type="button" id="allow-large-toggle" class="toolbar-button toolbar-toggle" aria-label="Allow large images" title="Allow large images">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2z"/><path d="M5 5h14v9l-3.5-3.5-2.5 2.5-3.5-3.5L5 14V5zm0 14v-3l4-4 3.5 3.5 2.5-2.5L19 17v2H5z"/></svg>
              </span>
            </button>
            <button type="button" id="show-guides-toggle" class="toolbar-button toolbar-toggle" aria-label="Show guides" title="Show guides">
              <span class="toolbar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M3 5h18v14H3V5zm2 2v10h14V7H5z"/><path d="M7 9h10v6H7z"/></svg>
              </span>
            </button>
          </div>
          <div class="toolbar-group toolbar-group-wide" role="group" aria-label="Typography">
            <div class="toolbar-dropdown" data-dropdown="font-size">
              <button type="button" id="font-size-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon text-size-icon" aria-hidden="true">
                  <span class="text-size-large">T</span>
                  <span class="text-size-small">t</span>
                </span>
                <span id="font-size-label">16 px</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="font-size-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="12">12 px</button>
                <button type="button" class="toolbar-menu-item" data-value="14">14 px</button>
                <button type="button" class="toolbar-menu-item" data-value="16">16 px</button>
                <button type="button" class="toolbar-menu-item" data-value="18">18 px</button>
                <button type="button" class="toolbar-menu-item" data-value="20">20 px</button>
                <button type="button" class="toolbar-menu-item" data-custom="font-size">Custom...</button>
              </div>
            </div>
            <div class="toolbar-dropdown" data-dropdown="line-height">
              <button type="button" id="line-height-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 3h2v18H7v-2H5v-2h2V7H5V5h2V3zm4 0h10v2H11V3zm0 6h10v2H11V9zm0 6h10v2H11v-2zm0 6h10v2H11v-2z"/></svg>
                </span>
                <span id="line-height-label">1.60</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="line-height-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="1.4">1.40</button>
                <button type="button" class="toolbar-menu-item" data-value="1.6">1.60</button>
                <button type="button" class="toolbar-menu-item" data-value="1.8">1.80</button>
                <button type="button" class="toolbar-menu-item" data-value="2.0">2.00</button>
                <button type="button" class="toolbar-menu-item" data-custom="line-height">Custom...</button>
              </div>
            </div>
            <div class="toolbar-dropdown" data-dropdown="max-width">
              <button type="button" id="max-width-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 5h16v2H4V5zm0 12h16v2H4v-2zm3-8h10v6H7V9z"/></svg>
                </span>
                <span id="max-width-label">170 mm</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="max-width-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="140">140 mm</button>
                <button type="button" class="toolbar-menu-item" data-value="170">170 mm</button>
                <button type="button" class="toolbar-menu-item" data-value="200">200 mm</button>
                <button type="button" class="toolbar-menu-item" data-custom="max-width">Custom...</button>
              </div>
            </div>
            <div class="toolbar-dropdown" data-dropdown="para-spacing">
              <button type="button" id="para-spacing-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 6h10v2H4V6zm0 4h16v2H4v-2zm0 4h10v2H4v-2zm12-7h4v2h-4V7zm0 8h4v2h-4v-2z"/></svg>
                </span>
                <span id="para-spacing-label">14 px</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="para-spacing-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="8">8 px</button>
                <button type="button" class="toolbar-menu-item" data-value="14">14 px</button>
                <button type="button" class="toolbar-menu-item" data-value="20">20 px</button>
                <button type="button" class="toolbar-menu-item" data-custom="para-spacing">Custom...</button>
              </div>
            </div>
          </div>
          <div class="toolbar-group toolbar-group-wide layout-group" role="group" aria-label="Layout">
            <div class="toolbar-dropdown" data-dropdown="margin">
              <button type="button" id="margin-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M3 5h18v14H3V5zm2 2v10h14V7H5z"/></svg>
                </span>
                <span id="margin-label">Margins: Default</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="margin-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="0">None</button>
                <button type="button" class="toolbar-menu-item" data-value="12">Compact</button>
                <button type="button" class="toolbar-menu-item" data-value="20">Default</button>
                <button type="button" class="toolbar-menu-item" data-value="28">Spacious</button>
              </div>
            </div>
            <div class="toolbar-dropdown" data-dropdown="padding">
              <button type="button" id="padding-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M5 5h14v14H5V5zm2 2v10h10V7H7z"/></svg>
                </span>
                <span id="padding-label">Padding: Default</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="padding-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="0">None</button>
                <button type="button" class="toolbar-menu-item" data-value="12">Compact</button>
                <button type="button" class="toolbar-menu-item" data-value="24">Default</button>
                <button type="button" class="toolbar-menu-item" data-value="36">Spacious</button>
              </div>
            </div>
          </div>
          <div class="toolbar-group toolbar-group-wide export-group" role="group" aria-label="Export">
            <span class="toolbar-label override-label">Override page limit</span>
            <button type="button" id="advanced-pages-toggle" class="toolbar-button toolbar-toggle" aria-label="Override page limit">
              <span class="toolbar-icon toolbar-checkbox-icon" aria-hidden="true">☐</span>
            </button>
            <button type="button" id="max-pages-button" class="toolbar-button toolbar-button-wide" aria-label="Max pages">
              <span id="max-pages-label">Max pages: 10</span>
            </button>
            <div class="toolbar-dropdown" data-dropdown="pdf-method">
              <button type="button" id="pdf-method-button" class="toolbar-button toolbar-button-wide" aria-haspopup="menu" aria-expanded="false">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm8 1.5V8h4.5L14 3.5z"/><path d="M7 12h10v2H7v-2zm0 4h6v2H7v-2zm0-8h10v2H7V8z"/></svg>
                </span>
                <span id="pdf-method-label">PDF method</span>
                <span class="toolbar-chevron" aria-hidden="true">▾</span>
              </button>
              <div id="pdf-method-menu" class="toolbar-menu" role="menu">
                <button type="button" class="toolbar-menu-item" data-value="html2pdf">html2pdf.js</button>
                <button type="button" class="toolbar-menu-item" data-value="jspdf" data-disabled="true">jsPDF (future)</button>
                <button type="button" class="toolbar-menu-item" data-value="pdflib" data-disabled="true">pdf-lib (future)</button>
              </div>
            </div>
            <label class="toolbar-input" aria-label="File name">
              <input id="file-name" type="text" placeholder="document" />
            </label>
            <div class="toolbar-export-buttons">
              <button id="export-png" class="toolbar-button toolbar-export-button" type="button" aria-label="Export PNG ZIP">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm8 1.5V8h4.5L14 3.5z"/><path d="M7 12h10v2H7v-2zm0 4h6v2H7v-2z"/><path d="M9 14h6v6H9v-6z"/></svg>
                </span>
                PNG ZIP
              </button>
              <button id="export-first-page" class="toolbar-button toolbar-export-button" type="button" aria-label="Download first page PNG">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm8 1.5V8h4.5L14 3.5z"/><path d="M8 12h8v2H8v-2z"/><path d="M12 14l4 4h-3v4h-2v-4H8l4-4z"/></svg>
                </span>
                First page PNG
              </button>
              <button id="export-pdf" class="toolbar-button toolbar-export-button" type="button" aria-label="Export PDF">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2zm8 1.5V8h4.5L14 3.5z"/><path d="M7 12h10v2H7v-2zm0 4h6v2H7v-2z"/><path d="M9 13h6v8H9v-8z"/></svg>
                </span>
                PDF
              </button>
              <button id="rasterize-preview" class="toolbar-button toolbar-export-button" type="button" aria-label="Rasterize preview">
                <span class="toolbar-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M4 5h16v14H4V5zm2 2v10h12V7H6z"/><path d="M8 9h8v6H8V9z"/></svg>
                </span>
                Rasterize
              </button>
            </div>
          </div>
        </div>
        <div class="toolbar-meta">
          <div class="font-status" id="font-status">Font status: unknown</div>
          <div id="image-status" class="status" role="status" aria-live="polite"></div>
          <div id="export-status" class="status" role="status" aria-live="polite"></div>
        </div>
        <details class="advanced-settings">
          <summary>Advanced Settings</summary>
        </details>
        <input id="toolbar-image-input" type="file" accept="image/*" hidden />
        <div id="editor" class="editor"></div>
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
    <footer class="app-footer">
      <div class="footer-stats">
        <span id="char-count">Chars: 0</span>
        <span id="word-count">Words: 0</span>
        <span id="line-count">Lines: 0</span>
      </div>
      <div class="footer-actions">
        <div id="offline-status" class="offline-status">Offline status: unknown</div>
        <button id="settings-button" class="action-button" type="button">
          Settings
        </button>
      </div>
    </footer>
  `;

  const editorRoot = app.querySelector<HTMLDivElement>("#editor");
  const preview = app.querySelector<HTMLDivElement>("#preview");
  const themeSelect = app.querySelector<HTMLSelectElement>("#theme-select");
  const fontSelect = app.querySelector<HTMLSelectElement>("#font-select");
  const fontStatus = app.querySelector<HTMLDivElement>("#font-status");
  const allowLargeToggle =
    app.querySelector<HTMLButtonElement>("#allow-large-toggle");
  const showGuidesToggle =
    app.querySelector<HTMLButtonElement>("#show-guides-toggle");
  const advancedPagesToggle =
    app.querySelector<HTMLButtonElement>("#advanced-pages-toggle");
  const fontSizeButton =
    app.querySelector<HTMLButtonElement>("#font-size-button");
  const lineHeightButton =
    app.querySelector<HTMLButtonElement>("#line-height-button");
  const maxWidthButton =
    app.querySelector<HTMLButtonElement>("#max-width-button");
  const paraSpacingButton =
    app.querySelector<HTMLButtonElement>("#para-spacing-button");
  const marginButton = app.querySelector<HTMLButtonElement>("#margin-button");
  const paddingButton =
    app.querySelector<HTMLButtonElement>("#padding-button");
  const maxPagesButton =
    app.querySelector<HTMLButtonElement>("#max-pages-button");
  const pdfMethodButton =
    app.querySelector<HTMLButtonElement>("#pdf-method-button");
  const fontSizeLabel = app.querySelector<HTMLSpanElement>("#font-size-label");
  const lineHeightLabel =
    app.querySelector<HTMLSpanElement>("#line-height-label");
  const maxWidthLabel =
    app.querySelector<HTMLSpanElement>("#max-width-label");
  const paraSpacingLabel =
    app.querySelector<HTMLSpanElement>("#para-spacing-label");
  const marginLabel = app.querySelector<HTMLSpanElement>("#margin-label");
  const paddingLabel = app.querySelector<HTMLSpanElement>("#padding-label");
  const maxPagesLabel = app.querySelector<HTMLSpanElement>("#max-pages-label");
  const pdfMethodLabel =
    app.querySelector<HTMLSpanElement>("#pdf-method-label");
  const fileNameInput = app.querySelector<HTMLInputElement>("#file-name");
  const exportPng = app.querySelector<HTMLButtonElement>("#export-png");
  const exportFirstPage = app.querySelector<HTMLButtonElement>(
    "#export-first-page"
  );
  const exportPdfButton = app.querySelector<HTMLButtonElement>("#export-pdf");
  const rasterizePreview =
    app.querySelector<HTMLButtonElement>("#rasterize-preview");
  const exportStatus = app.querySelector<HTMLDivElement>("#export-status");
  const imageStatus = app.querySelector<HTMLDivElement>("#image-status");
  const offlineStatus = app.querySelector<HTMLDivElement>("#offline-status");
  const charCount = app.querySelector<HTMLSpanElement>("#char-count");
  const wordCount = app.querySelector<HTMLSpanElement>("#word-count");
  const lineCount = app.querySelector<HTMLSpanElement>("#line-count");
  const settingsButton = app.querySelector<HTMLButtonElement>("#settings-button");
  const fontSizeMenu = app.querySelector<HTMLDivElement>("#font-size-menu");
  const lineHeightMenu = app.querySelector<HTMLDivElement>("#line-height-menu");
  const maxWidthMenu = app.querySelector<HTMLDivElement>("#max-width-menu");
  const paraSpacingMenu =
    app.querySelector<HTMLDivElement>("#para-spacing-menu");
  const marginMenu = app.querySelector<HTMLDivElement>("#margin-menu");
  const paddingMenu = app.querySelector<HTMLDivElement>("#padding-menu");
  const pdfMethodMenu = app.querySelector<HTMLDivElement>("#pdf-method-menu");
  const headingButtons = app.querySelectorAll<HTMLButtonElement>(
    ".toolbar-heading-button"
  );
  const toolbarButtons = app.querySelectorAll<HTMLButtonElement>(
    ".toolbar-editor-button"
  );

  if (
    !editorRoot ||
    !preview ||
    !themeSelect ||
    !fontSelect ||
    !fontStatus ||
    !allowLargeToggle ||
    !showGuidesToggle ||
    !advancedPagesToggle ||
    !fontSizeButton ||
    !lineHeightButton ||
    !maxWidthButton ||
    !paraSpacingButton ||
    !marginButton ||
    !paddingButton ||
    !maxPagesButton ||
    !pdfMethodButton ||
    !fontSizeLabel ||
    !lineHeightLabel ||
    !maxWidthLabel ||
    !paraSpacingLabel ||
    !marginLabel ||
    !paddingLabel ||
    !maxPagesLabel ||
    !pdfMethodLabel ||
    !fileNameInput ||
    !exportPng ||
    !exportFirstPage ||
    !exportPdfButton ||
    !rasterizePreview ||
    !exportStatus ||
    !imageStatus ||
    !offlineStatus ||
    !headingButtons.length ||
    !toolbarButtons.length ||
    !charCount ||
    !wordCount ||
    !lineCount ||
    !settingsButton ||
    !fontSizeMenu ||
    !lineHeightMenu ||
    !maxWidthMenu ||
    !paraSpacingMenu ||
    !marginMenu ||
    !paddingMenu ||
    !pdfMethodMenu
  ) {
    throw new Error("Editor or preview element missing.");
  }

  const settings = loadSettings();
  applySettings(settings);

  themeSelect.value = settings.theme;
  const updateFontStatusLabel = (status: FontStatus) => {
    const label =
      status === "cached"
        ? "Font status: cached"
        : status === "not_cached"
        ? "Font status: not cached"
        : "Font status: error";
    fontStatus.textContent = label;
    fontStatus.dataset.status = status;
  };

  let currentMargin = 20;
  let currentPadding = 24;
  let guidesEnabled = false;
  const pdfMethodLabels: Record<AppSettings["pdfMethod"], string> = {
    html2pdf: "html2pdf.js",
  };

  const refreshToolbarControls = () => {
    fontSizeLabel.textContent = settings.fontSize + " px";
    lineHeightLabel.textContent = settings.lineHeight.toFixed(2);
    maxWidthLabel.textContent = settings.maxWidth + " mm";
    paraSpacingLabel.textContent = settings.paragraphSpacing + " px";
    marginLabel.textContent =
      "Margins: " + (currentMargin === 0 ? "None" : currentMargin + " mm");
    paddingLabel.textContent =
      "Padding: " + (currentPadding === 0 ? "None" : currentPadding + " px");
    maxPagesLabel.textContent = "Max pages: " + settings.maxPages;
    pdfMethodLabel.textContent = "PDF: " + pdfMethodLabels[settings.pdfMethod];
    allowLargeToggle.classList.toggle("is-active", settings.allowLargeImages);
    showGuidesToggle.classList.toggle("is-active", guidesEnabled);
    advancedPagesToggle.classList.toggle("is-active", settings.advancedPages);
    const checkboxIcon = advancedPagesToggle.querySelector<HTMLSpanElement>(
      ".toolbar-checkbox-icon"
    );
    if (checkboxIcon) {
      checkboxIcon.textContent = settings.advancedPages ? "☑" : "☐";
    }
    maxPagesButton.disabled = !settings.advancedPages;
    maxPagesButton.setAttribute(
      "aria-disabled",
      settings.advancedPages ? "false" : "true"
    );
    document.documentElement.style.setProperty(
      "--page-margin",
      currentMargin + "mm"
    );
    document.documentElement.style.setProperty(
      "--preview-container-padding",
      currentPadding + "px"
    );
  };

  refreshToolbarControls();

  const populateFontOptions = () => {
    fontSelect.innerHTML = "";
    const systemOption = document.createElement("option");
    systemOption.value = "System";
    systemOption.textContent = "System";
    fontSelect.appendChild(systemOption);

    popularFonts.forEach((font) => {
      const option = document.createElement("option");
      option.value = font;
      option.textContent = font;
      fontSelect.appendChild(option);
    });

    const importOption = document.createElement("option");
    importOption.value = "__import__";
    importOption.textContent = "Import from Google Fonts...";
    fontSelect.appendChild(importOption);
  };

  populateFontOptions();
  fontSelect.value = settings.fontFamily;

  const setGuideVisibility = (enabled: boolean) => {
    const pageShell = app.querySelector<HTMLElement>(".page-shell");
    const previewScroll = app.querySelector<HTMLElement>(".preview-scroll");
    pageShell?.classList.toggle("show-guides", enabled);
    previewScroll?.classList.toggle("show-guides", enabled);
  };

  const ensureFontLoaded = async (familyName: string) => {
    if (familyName === "System") {
      updateFontStatusLabel("cached");
      return;
    }
    const stored = getStoredVariants(familyName);
    if (stored) {
      try {
        await loadFontFamilyFromCache(familyName, stored);
        updateFontStatusLabel("cached");
        return;
      } catch {
        // fall through to network load
      }
    }
    try {
      const variants = stored ?? (await resolveFontVariants(familyName));
      storeFontVariants(familyName, variants);
      const status = await getFontCacheStatus(variants);
      updateFontStatusLabel(status);
      await loadFontFamily(familyName, variants);
      updateFontStatusLabel("cached");
    } catch {
      updateFontStatusLabel("error");
    }
  };

  let currentMarkdown = starterText;

  const render = () => {
    const rawHtml = md.render(currentMarkdown);
    preview.innerHTML = DOMPurify.sanitize(rawHtml, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|appimg):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
    void resolveAppImages(preview);
    applyImageOptions(preview);
  };

  const renderDebounced = debounce(render, 120);

  const updateToolbarState = () => {
    toolbarButtons.forEach((button) => {
      const action = button.dataset.action;
      if (!action) {
        return;
      }
      let active = false;
      switch (action) {
        case "bold":
          active = editorInstance.isActive("bold");
          break;
        case "italic":
          active = editorInstance.isActive("italic");
          break;
        case "underline":
          active = editorInstance.isActive("underline");
          break;
        case "strike":
          active = editorInstance.isActive("strike");
          break;
        case "bulletList":
          active = editorInstance.isActive("bulletList");
          break;
        case "orderedList":
          active = editorInstance.isActive("orderedList");
          break;
        case "taskList":
          active = editorInstance.isActive("taskList");
          break;
        case "blockquote":
          active = editorInstance.isActive("blockquote");
          break;
        case "code":
          active = editorInstance.isActive("code");
          break;
        case "codeBlock":
          active = editorInstance.isActive("codeBlock");
          break;
        case "alignLeft":
          active = editorInstance.isActive({ textAlign: "left" });
          break;
        case "alignCenter":
          active = editorInstance.isActive({ textAlign: "center" });
          break;
        case "alignRight":
          active = editorInstance.isActive({ textAlign: "right" });
          break;
        case "alignJustify":
          active = editorInstance.isActive({ textAlign: "justify" });
          break;
        case "link":
          active = editorInstance.isActive("link");
          break;
        case "image":
          active = false;
          break;
        case "undo":
        case "redo":
          active = false;
          break;
        default:
          active = false;
      }
      button.classList.toggle("is-active", active);
    });
    headingButtons.forEach((button) => {
      const level = button.dataset.heading;
      if (!level) {
        return;
      }
      if (level === "paragraph") {
        const headingLevels = [1, 2, 3, 4, 5, 6];
        const anyHeadingActive = headingLevels.some((levelNum) =>
          editorInstance.isActive("heading", { level: levelNum })
        );
        button.classList.toggle("is-active", !anyHeadingActive);
      } else {
        const numericLevel = Number(level.replace("h", ""));
        button.classList.toggle(
          "is-active",
          editorInstance.isActive("heading", { level: numericLevel })
        );
      }
    });
  };

  const updateSettings = (next: Partial<AppSettings>) => {
    Object.assign(settings, next);
    applySettings(settings);
    saveSettings(settings);
    refreshToolbarControls();
  };

  const editorInstance = new Editor({
    element: editorRoot,
    extensions: [
      StarterKit,
      Image,
      Link.configure({ openOnClick: false }),
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Markdown,
    ],
    content: md.render(starterText),
    onUpdate: ({ editor }) => {
      currentMarkdown = editor.storage.markdown.getMarkdown();
      renderDebounced();
      updateFooterStats();
    },
    onSelectionUpdate: () => {
      updateToolbarState();
    },
  });

  render();
  updateToolbarState();

  const closeAllDropdowns = () => {
    app.querySelectorAll<HTMLElement>(".toolbar-dropdown.open").forEach((el) => {
      el.classList.remove("open");
      const button = el.querySelector<HTMLButtonElement>(".toolbar-button");
      if (button) {
        button.setAttribute("aria-expanded", "false");
      }
    });
  };

  const promptCustomNumber = (
    title: string,
    value: number,
    min: number,
    max: number,
    step: number,
    suffix: string
  ): Promise<number | null> =>
    new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <h3>${title}</h3>
          <label>
            <input id="custom-value-input" type="number" min="${min}" max="${max}" step="${step}" value="${value}" />
            <span class="modal-hint">Range: ${min}–${max} ${suffix}</span>
          </label>
          <div class="modal-actions">
            <button id="custom-cancel" type="button">Cancel</button>
            <button id="custom-confirm" type="button">Apply</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const input = overlay.querySelector<HTMLInputElement>(
        "#custom-value-input"
      );
      const cancel = overlay.querySelector<HTMLButtonElement>("#custom-cancel");
      const confirm = overlay.querySelector<HTMLButtonElement>(
        "#custom-confirm"
      );

      if (!input || !cancel || !confirm) {
        overlay.remove();
        resolve(null);
        return;
      }

      const close = (result: number | null) => {
        overlay.remove();
        resolve(result);
      };

      cancel.addEventListener("click", () => close(null));
      confirm.addEventListener("click", () => {
        const parsed = Number(input.value);
        if (Number.isNaN(parsed)) {
          close(null);
          return;
        }
        const clamped = Math.min(max, Math.max(min, parsed));
        close(clamped);
      });
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          close(null);
        }
      });
      input.focus();
      input.select();
    });

  const wireNumericDropdown = (options: {
    button: HTMLButtonElement;
    menu: HTMLDivElement;
    title: string;
    getValue: () => number;
    setValue: (value: number) => void;
    min: number;
    max: number;
    step: number;
    suffix: string;
  }) => {
    const { button, menu, title, getValue, setValue, min, max, step, suffix } =
      options;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const parent = button.closest(".toolbar-dropdown");
      if (!parent) {
        return;
      }
      const isOpen = parent.classList.toggle("open");
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    menu.addEventListener("click", async (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        ".toolbar-menu-item"
      );
      if (!target) {
        return;
      }
      if (target.dataset.custom) {
        const customValue = await promptCustomNumber(
          title,
          getValue(),
          min,
          max,
          step,
          suffix
        );
        if (customValue !== null) {
          setValue(customValue);
        }
      } else if (target.dataset.value) {
        const value = Number(target.dataset.value);
        if (!Number.isNaN(value)) {
          setValue(value);
        }
      }
      closeAllDropdowns();
    });
  };

  const wirePresetDropdown = (options: {
    button: HTMLButtonElement;
    menu: HTMLDivElement;
    setValue: (value: number) => void;
  }) => {
    const { button, menu, setValue } = options;
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const parent = button.closest(".toolbar-dropdown");
      if (!parent) {
        return;
      }
      const isOpen = parent.classList.toggle("open");
      button.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    menu.addEventListener("click", (event) => {
      const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
        ".toolbar-menu-item"
      );
      if (!target || !target.dataset.value) {
        return;
      }
      const value = Number(target.dataset.value);
      if (!Number.isNaN(value)) {
        setValue(value);
      }
      closeAllDropdowns();
    });
  };

  themeSelect.addEventListener("change", () => {
    updateSettings({ theme: themeSelect.value as ThemeId });
  });
  fontSelect.addEventListener("change", async () => {
    if (fontSelect.value === "__import__") {
      fontSelect.value = settings.fontFamily;
      const dialog = buildImportDialog();
      dialog?.input.focus();
      return;
    }
    updateSettings({ fontFamily: fontSelect.value });
    await ensureFontLoaded(fontSelect.value);
  });
  allowLargeToggle.addEventListener("click", () => {
    updateSettings({ allowLargeImages: !settings.allowLargeImages });
  });
  showGuidesToggle.addEventListener("click", () => {
    guidesEnabled = !guidesEnabled;
    setGuideVisibility(guidesEnabled);
    refreshToolbarControls();
  });
  advancedPagesToggle.addEventListener("click", () => {
    updateSettings({ advancedPages: !settings.advancedPages });
  });

  wireNumericDropdown({
    button: fontSizeButton,
    menu: fontSizeMenu!,
    title: "Custom font size",
    getValue: () => settings.fontSize,
    setValue: (value) => updateSettings({ fontSize: value }),
    min: 12,
    max: 20,
    step: 1,
    suffix: "px",
  });
  wireNumericDropdown({
    button: lineHeightButton,
    menu: lineHeightMenu!,
    title: "Custom line height",
    getValue: () => settings.lineHeight,
    setValue: (value) => updateSettings({ lineHeight: value }),
    min: 1.3,
    max: 2.0,
    step: 0.05,
    suffix: "",
  });
  wireNumericDropdown({
    button: maxWidthButton,
    menu: maxWidthMenu!,
    title: "Custom max width",
    getValue: () => settings.maxWidth,
    setValue: (value) => updateSettings({ maxWidth: value }),
    min: 120,
    max: 210,
    step: 5,
    suffix: "mm",
  });
  wireNumericDropdown({
    button: paraSpacingButton,
    menu: paraSpacingMenu!,
    title: "Custom paragraph spacing",
    getValue: () => settings.paragraphSpacing,
    setValue: (value) => updateSettings({ paragraphSpacing: value }),
    min: 6,
    max: 24,
    step: 2,
    suffix: "px",
  });

  wirePresetDropdown({
    button: marginButton,
    menu: marginMenu!,
    setValue: (value) => {
      currentMargin = value;
      refreshToolbarControls();
    },
  });
  wirePresetDropdown({
    button: paddingButton,
    menu: paddingMenu!,
    setValue: (value) => {
      currentPadding = value;
      refreshToolbarControls();
    },
  });

  pdfMethodButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const parent = pdfMethodButton.closest(".toolbar-dropdown");
    if (!parent) {
      return;
    }
    const isOpen = parent.classList.toggle("open");
    pdfMethodButton.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });
  pdfMethodMenu?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".toolbar-menu-item"
    );
    if (!target || target.dataset.disabled === "true") {
      return;
    }
    const value = target.dataset.value as AppSettings["pdfMethod"] | undefined;
    if (value) {
      updateSettings({ pdfMethod: value });
    }
    closeAllDropdowns();
  });

  maxPagesButton.addEventListener("click", async (event) => {
    event.stopPropagation();
    if (!settings.advancedPages) {
      return;
    }
    const custom = await promptCustomNumber(
      "Custom max pages",
      settings.maxPages,
      1,
      50,
      1,
      "pages"
    );
    if (custom !== null) {
      updateSettings({ maxPages: Math.max(1, custom) });
    }
  });

  headingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const level = button.dataset.heading;
      if (!level) return;
      if (level === "paragraph") {
        editorInstance.chain().focus().setParagraph().run();
      } else {
        const numericLevel = Number(level.replace("h", ""));
        editorInstance
          .chain()
          .focus()
          .toggleHeading({ level: numericLevel })
          .run();
      }
      updateToolbarState();
    });
  });

  document.addEventListener("click", () => {
    closeAllDropdowns();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllDropdowns();
    }
  });

  const setStatus = (message: string) => {
    imageStatus.textContent = message;
    if (!message) {
      imageStatus.classList.remove("status-visible");
      return;
    }
    imageStatus.classList.add("status-visible");
  };

  const setExportStatus = (message: string) => {
    exportStatus.textContent = message;
    if (!message) {
      exportStatus.classList.remove("status-visible");
      return;
    }
    exportStatus.classList.add("status-visible");
  };

  const confirmWarning = (message: string): Promise<boolean> =>
    new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal">
          <h3>Export warning</h3>
          <p>${message}</p>
          <label class="modal-checkbox">
            <input id="warn-disable" type="checkbox" />
            Do not show again
          </label>
          <div class="modal-actions">
            <button id="warn-cancel" type="button">Cancel</button>
            <button id="warn-confirm" type="button">Continue</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const checkbox = overlay.querySelector<HTMLInputElement>("#warn-disable");
      const cancel = overlay.querySelector<HTMLButtonElement>("#warn-cancel");
      const confirm = overlay.querySelector<HTMLButtonElement>("#warn-confirm");

      if (!checkbox || !cancel || !confirm) {
        overlay.remove();
        resolve(false);
        return;
      }

      const close = (value: boolean) => {
        if (checkbox.checked) {
          updateSettings({ warnOnOfflineFont: false });
        }
        overlay.remove();
        resolve(value);
      };

      cancel.addEventListener("click", () => close(false));
      confirm.addEventListener("click", () => close(true));
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          close(false);
        }
      });
    });

  const handleImageFiles = async (files: FileList | File[]) => {
    if (!files.length) {
      return;
    }
    const entries = Array.from(files);
    const results = await Promise.all(
      entries.map((file) => storeImageFile(file, settings.allowLargeImages))
    );

    let inserted = 0;
    const errors: string[] = [];

    results.forEach((result) => {
      if ("markdown" in result) {
        inserted += 1;
        editorInstance.commands.setImage({
          src: result.src,
          alt: result.alt,
          title: "",
        });
      } else {
        errors.push(`${result.name}: ${result.reason}`);
      }
    });
    void resolveAppImages(editorRoot);

    if (errors.length > 0) {
      setStatus(errors.join(" "));
    } else if (inserted > 0) {
      setStatus(`Inserted ${inserted} image${inserted > 1 ? "s" : ""}.`);
    }
  };

  editorRoot.addEventListener("paste", (event) => {
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }
    const files: File[] = [];
    Array.from(items).forEach((item) => {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    });
    if (files.length > 0) {
      event.preventDefault();
      void handleImageFiles(files);
    }
  });

  editorRoot.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  editorRoot.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleImageFiles(files);
    }
  });

  const updateFooterStats = () => {
    const text = currentMarkdown;
    charCount.textContent = `Chars: ${text.length}`;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCount.textContent = `Words: ${words}`;
    const lines = text.split("\n").length;
    lineCount.textContent = `Lines: ${lines}`;
  };

  updateFooterStats();

  const getEffectiveMaxPages = () =>
    settings.advancedPages ? settings.maxPages : 10;

  const runRasterize = async () => {
    const pageShell = app.querySelector<HTMLElement>(".page-shell");
    if (!pageShell) {
      throw new Error("Page shell missing.");
    }
    return rasterizePages({
      previewContent: preview,
      pageShell,
      maxPages: getEffectiveMaxPages(),
      scale: 2,
    });
  };

  const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
    const response = await fetch(dataUrl);
    return response.blob();
  };

  const sanitizeFileName = (value: string): string => {
    const cleaned = value
      .trim()
      .replace(/[^\w\s-]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return cleaned.slice(0, 60);
  };

  const fallbackFromMarkdown = (markdown: string): string | null => {
    const match = markdown.match(/^#\s+(.+)$/m);
    if (!match) {
      return null;
    }
    return sanitizeFileName(match[1]);
  };

  const getBaseFileName = (): string => {
    const inputValue = sanitizeFileName(fileNameInput.value);
    if (inputValue) {
      return inputValue;
    }
    const headerValue = fallbackFromMarkdown(currentMarkdown);
    if (headerValue) {
      return headerValue;
    }
    return `document-${Date.now().toString(36)}`;
  };

  exportPng.addEventListener("click", async () => {
    const pageShell = app.querySelector<HTMLElement>(".page-shell");
    if (!pageShell) {
      throw new Error("Page shell missing.");
    }
    const fontStatusValue = fontStatus.dataset.status;
    if (fontStatusValue === "not_cached" && settings.warnOnOfflineFont) {
      const proceed = await confirmWarning(
        "Selected font may not be cached for offline PNG export."
      );
      if (!proceed) {
        return;
      }
    }
    exportPng.disabled = true;
    setExportStatus("Preparing export...");
    try {
      await exportPngZip({
        previewContent: preview,
        pageShell,
        maxPages: getEffectiveMaxPages(),
        scale: 2,
        fileName: `${getBaseFileName()}.zip`,
        onProgress: ({ step, current, total }) => {
          if (step === "zip" && current && total) {
            setExportStatus(`Zipping page ${current} of ${total}...`);
            return;
          }
          if (step === "generate") {
            setExportStatus("Creating ZIP...");
            return;
          }
          if (step === "done") {
            setExportStatus("Download started.");
            return;
          }
          setExportStatus("Rasterizing pages...");
        },
      });
    } catch (error) {
      setExportStatus(
        error instanceof Error ? error.message : "Export failed."
      );
    } finally {
      exportPng.disabled = false;
    }
  });

  exportFirstPage.addEventListener("click", async () => {
    const pageShell = app.querySelector<HTMLElement>(".page-shell");
    if (!pageShell) {
      throw new Error("Page shell missing.");
    }
    const fontStatusValue = fontStatus.dataset.status;
    if (fontStatusValue === "not_cached" && settings.warnOnOfflineFont) {
      const proceed = await confirmWarning(
        "Selected font may not be cached for offline PNG export."
      );
      if (!proceed) {
        return;
      }
    }
    exportFirstPage.disabled = true;
    setExportStatus("Rendering first page...");
    try {
      const result = await rasterizePages({
        previewContent: preview,
        pageShell,
        maxPages: 1,
        scale: 2,
      });
      const first = result.pages[0];
      if (!first) {
        throw new Error("No page output generated.");
      }
      const blob = await dataUrlToBlob(first);
      downloadBlob(blob, `${getBaseFileName()}-page-01.png`);
      setExportStatus("Download started.");
    } catch (error) {
      setExportStatus(
        error instanceof Error ? error.message : "Export failed."
      );
    } finally {
      exportFirstPage.disabled = false;
    }
  });

  exportPdfButton.addEventListener("click", async () => {
    const pageShell = app.querySelector<HTMLElement>(".page-shell");
    if (!pageShell) {
      throw new Error("Page shell missing.");
    }
    const fontStatusValue = fontStatus.dataset.status;
    if (fontStatusValue === "not_cached" && settings.warnOnOfflineFont) {
      const proceed = await confirmWarning(
        "Selected font may not be cached for offline PDF export."
      );
      if (!proceed) {
        return;
      }
    }
    exportPdfButton.disabled = true;
    setExportStatus("Preparing PDF...");
    try {
      await exportPdf({
        previewContent: preview,
        pageShell,
        maxPages: getEffectiveMaxPages(),
        fileName: `${getBaseFileName()}.pdf`,
        onProgress: ({ step, pageCount, clamped }) => {
          if (step === "measure" && pageCount) {
            if (clamped) {
              setExportStatus(
                `Limiting export to ${pageCount} page${pageCount > 1 ? "s" : ""}...`
              );
              return;
            }
          }
          if (step === "render") {
            setExportStatus("Rendering PDF...");
            return;
          }
          if (step === "done") {
            setExportStatus("Download started.");
            return;
          }
          setExportStatus("Preparing PDF...");
        },
      });
    } catch (error) {
      setExportStatus(
        error instanceof Error ? error.message : "Export failed."
      );
    } finally {
      exportPdfButton.disabled = false;
    }
  });

  rasterizePreview.addEventListener("click", async () => {
    const pageShell = app.querySelector<HTMLElement>(".page-shell");
    if (!pageShell) {
      throw new Error("Page shell missing.");
    }
    rasterizePreview.disabled = true;
    setExportStatus("Rasterizing preview...");
    try {
      const result = await rasterizePages({
        previewContent: preview,
        pageShell,
        maxPages: getEffectiveMaxPages(),
        scale: 2,
      });
      if (result.pages[0]) {
        window.open(result.pages[0], "_blank", "noopener,noreferrer");
      }
      setExportStatus(
        `Rasterized ${result.pages.length} page${
          result.pages.length > 1 ? "s" : ""
        }.`
      );
    } catch (error) {
      setExportStatus(
        error instanceof Error ? error.message : "Rasterize failed."
      );
    } finally {
      rasterizePreview.disabled = false;
    }
  });

  (window as Window & { msoRasterizePages?: typeof runRasterize }).msoRasterizePages =
    runRasterize;

  const buildImportDialog = () => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <h3>Import from Google Fonts</h3>
        <p>Enter a family name or a Google Fonts specimen URL.</p>
        <input id="font-import-input" type="text" placeholder="Montserrat" />
        <div class="modal-actions">
          <button id="font-import-cancel" type="button">Cancel</button>
          <button id="font-import-confirm" type="button">Import</button>
        </div>
        <div id="font-import-status" class="status" role="status" aria-live="polite"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector<HTMLInputElement>("#font-import-input");
    const cancel = overlay.querySelector<HTMLButtonElement>(
      "#font-import-cancel"
    );
    const confirm = overlay.querySelector<HTMLButtonElement>(
      "#font-import-confirm"
    );
    const status = overlay.querySelector<HTMLDivElement>("#font-import-status");

    if (!input || !cancel || !confirm || !status) {
      overlay.remove();
      return null;
    }

    const setImportStatus = (message: string) => {
      status.textContent = message;
      if (!message) {
        status.classList.remove("status-visible");
        return;
      }
      status.classList.add("status-visible");
    };

    cancel.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });

    const handleImport = async () => {
      const normalized = normalizeFontInput(input.value);
      if ("error" in normalized) {
        setImportStatus(normalized.error);
        return;
      }
      setImportStatus("Looking up font...");
      confirm.disabled = true;
      try {
        const variants = await resolveFontVariants(normalized.familyName);
        storeFontVariants(normalized.familyName, variants);
        setImportStatus("Downloading font files...");
        await loadFontFamily(normalized.familyName, variants);
        updateSettings({ fontFamily: normalized.familyName });
        const statusValue = await getFontCacheStatus(variants);
        updateFontStatusLabel(statusValue);
        if (
          !Array.from(fontSelect.options).some(
            (option) => option.value === normalized.familyName
          )
        ) {
          const option = document.createElement("option");
          option.value = normalized.familyName;
          option.textContent = normalized.familyName;
          fontSelect.insertBefore(
            option,
            fontSelect.querySelector('option[value="__import__"]')
          );
        }
        fontSelect.value = normalized.familyName;
        setImportStatus("Font imported.");
        window.setTimeout(() => overlay.remove(), 600);
      } catch (error) {
        setImportStatus(
          error instanceof Error ? error.message : "Could not look up that font. Try again."
        );
      } finally {
        confirm.disabled = false;
      }
    };

    confirm.addEventListener("click", () => {
      void handleImport();
    });

    return { overlay, input };
  };

  updateFontStatusLabel("not_cached");
  void ensureFontLoaded(settings.fontFamily);
  setGuideVisibility(false);

  const updateOfflineStatus = async () => {
    const isOnline = navigator.onLine;
    const baseUrl =
      typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
        ? import.meta.env.BASE_URL
        : "/";
    const indexUrl = new URL("index.html", `${window.location.origin}${baseUrl}`)
      .toString();
    let cached = false;
    try {
      const match = await caches.match(indexUrl);
      cached = Boolean(match);
    } catch {
      cached = false;
    }
    const label = !isOnline
      ? cached
        ? "Offline ready"
        : "Offline (not cached)"
      : cached
      ? "Offline ready"
      : "Online";
    offlineStatus.textContent = `Offline status: ${label}`;
    offlineStatus.dataset.status = cached ? "ready" : isOnline ? "online" : "offline";
  };

  window.addEventListener("online", () => {
    void updateOfflineStatus();
  });
  window.addEventListener("offline", () => {
    void updateOfflineStatus();
  });
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    void updateOfflineStatus();
  });
  void updateOfflineStatus();

  const buildSettingsDialog = () => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal">
        <h3>Settings</h3>
        <button id="reset-warnings" type="button">Reset warning flags</button>
        <div class="modal-actions">
          <button id="settings-close" type="button">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const resetWarnings = overlay.querySelector<HTMLButtonElement>(
      "#reset-warnings"
    );
    const close = overlay.querySelector<HTMLButtonElement>("#settings-close");

    if (!resetWarnings || !close) {
      overlay.remove();
      return;
    }

    resetWarnings.addEventListener("click", () => {
      updateSettings({ warnOnOfflineFont: true });
    });
    close.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        overlay.remove();
      }
    });
  };

  settingsButton.addEventListener("click", buildSettingsDialog);
}
