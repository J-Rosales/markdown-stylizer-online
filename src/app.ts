import DOMPurify from "dompurify";
import MarkdownIt from "markdown-it";
import {
  MAX_IMAGE_BYTES,
  insertAtCursor,
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
      <h1>Markdown Stylizer Online</h1>
      <p>Milestone 3: themes + typography controls</p>
    </header>
    <main class="workspace">
      <section class="pane">
        <div class="pane-title-row">
          <label class="pane-title" for="editor">Markdown</label>
        </div>
        <div class="controls">
          <div class="controls-section">
            <div class="controls-section-title">Appearance</div>
          <label class="control">
            Theme
            <select id="theme-select">
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="paper">Paper</option>
              <option value="terminal">Terminal</option>
            </select>
          </label>
          <label class="control">
            Font size
            <input id="font-size" type="range" min="12" max="20" step="1" />
            <span class="control-value" id="font-size-value"></span>
          </label>
          <label class="control">
            Line height
            <input id="line-height" type="range" min="1.3" max="2.0" step="0.05" />
            <span class="control-value" id="line-height-value"></span>
          </label>
          <label class="control">
            Max width (mm)
            <input id="max-width" type="range" min="120" max="210" step="5" />
            <span class="control-value" id="max-width-value"></span>
          </label>
          <label class="control">
            Paragraph spacing
            <input id="para-spacing" type="range" min="6" max="24" step="2" />
            <span class="control-value" id="para-spacing-value"></span>
          </label>
          <label class="control control-toggle">
            <span>Allow large images</span>
            <input id="allow-large" type="checkbox" />
            <span class="control-hint">
              Default limit: ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))} MB
            </span>
          </label>
          <label class="control">
            Font
            <select id="font-select"></select>
          </label>
          <div class="font-status" id="font-status">Font status: unknown</div>
          <label class="control control-toggle">
            <span>Show guides</span>
            <input id="show-guides" type="checkbox" />
            <span class="control-hint">Margin + padding</span>
          </label>
          <div class="control-group">
            <span class="control-label">Margins</span>
            <button class="preset-button" type="button" data-margin="12">Compact</button>
            <button class="preset-button" type="button" data-margin="20">Default</button>
            <button class="preset-button" type="button" data-margin="28">Spacious</button>
          </div>
          <div class="control-group">
            <span class="control-label">Padding</span>
            <button class="preset-button" type="button" data-padding="12">Compact</button>
            <button class="preset-button" type="button" data-padding="24">Default</button>
            <button class="preset-button" type="button" data-padding="36">Spacious</button>
          </div>
          </div>
          <div class="controls-section">
            <div class="controls-section-title">Export</div>
          <label class="control control-toggle">
            <span>Advanced pages</span>
            <input id="advanced-pages" type="checkbox" />
            <span class="control-hint">Default limit: 10 pages</span>
          </label>
          <label class="control">
            Max pages
            <input id="max-pages" type="number" min="1" max="50" step="1" />
          </label>
          <label class="control">
            PDF method
            <select id="pdf-method">
              <option value="html2pdf">html2pdf.js</option>
              <option value="jspdf" disabled>jsPDF (future)</option>
              <option value="pdflib" disabled>pdf-lib (future)</option>
            </select>
          </label>
          <label class="control">
            File name
            <input id="file-name" type="text" placeholder="document" />
          </label>
          <button id="export-png" class="action-button" type="button">
            Export PNG ZIP
          </button>
          <button id="export-first-page" class="action-button" type="button">
            Download first page PNG
          </button>
          <button id="export-pdf" class="action-button" type="button">
            Export PDF
          </button>
          <div id="export-status" class="status" role="status" aria-live="polite"></div>
          </div>
        </div>
        <div id="image-status" class="status" role="status" aria-live="polite"></div>
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

  const editor = app.querySelector<HTMLTextAreaElement>("#editor");
  const preview = app.querySelector<HTMLDivElement>("#preview");
  const themeSelect = app.querySelector<HTMLSelectElement>("#theme-select");
  const fontSize = app.querySelector<HTMLInputElement>("#font-size");
  const lineHeight = app.querySelector<HTMLInputElement>("#line-height");
  const maxWidth = app.querySelector<HTMLInputElement>("#max-width");
  const paraSpacing = app.querySelector<HTMLInputElement>("#para-spacing");
  const allowLarge = app.querySelector<HTMLInputElement>("#allow-large");
  const fontSelect = app.querySelector<HTMLSelectElement>("#font-select");
  const fontStatus = app.querySelector<HTMLDivElement>("#font-status");
  const showGuides = app.querySelector<HTMLInputElement>("#show-guides");
  const marginPresets = app.querySelectorAll<HTMLButtonElement>(
    "[data-margin]"
  );
  const paddingPresets = app.querySelectorAll<HTMLButtonElement>(
    "[data-padding]"
  );
  const advancedPages = app.querySelector<HTMLInputElement>("#advanced-pages");
  const maxPages = app.querySelector<HTMLInputElement>("#max-pages");
  const pdfMethod = app.querySelector<HTMLSelectElement>("#pdf-method");
  const fileNameInput = app.querySelector<HTMLInputElement>("#file-name");
  const exportPng = app.querySelector<HTMLButtonElement>("#export-png");
  const exportFirstPage = app.querySelector<HTMLButtonElement>(
    "#export-first-page"
  );
  const exportPdfButton = app.querySelector<HTMLButtonElement>("#export-pdf");
  const exportStatus = app.querySelector<HTMLDivElement>("#export-status");
  const imageStatus = app.querySelector<HTMLDivElement>("#image-status");
  const offlineStatus = app.querySelector<HTMLDivElement>("#offline-status");
  const charCount = app.querySelector<HTMLSpanElement>("#char-count");
  const wordCount = app.querySelector<HTMLSpanElement>("#word-count");
  const lineCount = app.querySelector<HTMLSpanElement>("#line-count");
  const settingsButton = app.querySelector<HTMLButtonElement>("#settings-button");
  const fontSizeValue = app.querySelector<HTMLSpanElement>("#font-size-value");
  const lineHeightValue =
    app.querySelector<HTMLSpanElement>("#line-height-value");
  const maxWidthValue = app.querySelector<HTMLSpanElement>("#max-width-value");
  const paraSpacingValue =
    app.querySelector<HTMLSpanElement>("#para-spacing-value");

  if (
    !editor ||
    !preview ||
    !themeSelect ||
    !fontSize ||
    !lineHeight ||
    !maxWidth ||
    !paraSpacing ||
    !allowLarge ||
    !fontSelect ||
    !fontStatus ||
    !showGuides ||
    !advancedPages ||
    !maxPages ||
    !pdfMethod ||
    !fileNameInput ||
    !exportPng ||
    !exportFirstPage ||
    !exportPdfButton ||
    !exportStatus ||
    !imageStatus ||
    !offlineStatus ||
    !charCount ||
    !wordCount ||
    !lineCount ||
    !settingsButton ||
    !fontSizeValue ||
    !lineHeightValue ||
    !maxWidthValue ||
    !paraSpacingValue
  ) {
    throw new Error("Editor or preview element missing.");
  }

  const settings = loadSettings();
  applySettings(settings);

  themeSelect.value = settings.theme;
  fontSize.value = settings.fontSize.toString();
  lineHeight.value = settings.lineHeight.toString();
  maxWidth.value = settings.maxWidth.toString();
  paraSpacing.value = settings.paragraphSpacing.toString();
  allowLarge.checked = settings.allowLargeImages;
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
  advancedPages.checked = settings.advancedPages;
  maxPages.value = settings.maxPages.toString();
  maxPages.disabled = !settings.advancedPages;
  pdfMethod.value = settings.pdfMethod;

  const refreshLabels = () => {
    fontSizeValue.textContent = `${settings.fontSize}px`;
    lineHeightValue.textContent = settings.lineHeight.toFixed(2);
    maxWidthValue.textContent = `${settings.maxWidth}mm`;
    paraSpacingValue.textContent = `${settings.paragraphSpacing}px`;
  };

  refreshLabels();

  const render = () => {
    const rawHtml = md.render(editor.value);
    preview.innerHTML = DOMPurify.sanitize(rawHtml, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|appimg):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
    void resolveAppImages(preview);
  };

  const renderDebounced = debounce(render, 120);

  const updateSettings = (next: Partial<AppSettings>) => {
    Object.assign(settings, next);
    applySettings(settings);
    saveSettings(settings);
    refreshLabels();
  };

  editor.value = starterText;
  render();

  editor.addEventListener("input", renderDebounced);

  themeSelect.addEventListener("change", () => {
    updateSettings({ theme: themeSelect.value as ThemeId });
  });
  fontSize.addEventListener("input", () => {
    updateSettings({ fontSize: Number(fontSize.value) });
  });
  lineHeight.addEventListener("input", () => {
    updateSettings({ lineHeight: Number(lineHeight.value) });
  });
  maxWidth.addEventListener("input", () => {
    updateSettings({ maxWidth: Number(maxWidth.value) });
  });
  paraSpacing.addEventListener("input", () => {
    updateSettings({ paragraphSpacing: Number(paraSpacing.value) });
  });
  allowLarge.addEventListener("change", () => {
    updateSettings({ allowLargeImages: allowLarge.checked });
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
  showGuides.addEventListener("change", () => {
    setGuideVisibility(showGuides.checked);
  });
  marginPresets.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.margin;
      if (value) {
        document.documentElement.style.setProperty("--page-margin", `${value}mm`);
      }
    });
  });
  paddingPresets.forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.padding;
      if (value) {
        document.documentElement.style.setProperty(
          "--preview-container-padding",
          `${value}px`
        );
      }
    });
  });
  advancedPages.addEventListener("change", () => {
    maxPages.disabled = !advancedPages.checked;
    updateSettings({ advancedPages: advancedPages.checked });
  });
  maxPages.addEventListener("change", () => {
    updateSettings({ maxPages: Math.max(1, Number(maxPages.value)) });
  });
  pdfMethod.addEventListener("change", () => {
    updateSettings({ pdfMethod: pdfMethod.value as AppSettings["pdfMethod"] });
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
        insertAtCursor(editor, result.markdown);
      } else {
        errors.push(`${result.name}: ${result.reason}`);
      }
    });

    if (errors.length > 0) {
      setStatus(errors.join(" "));
    } else if (inserted > 0) {
      setStatus(`Inserted ${inserted} image${inserted > 1 ? "s" : ""}.`);
    }
  };

  editor.addEventListener("paste", (event) => {
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

  editor.addEventListener("dragover", (event) => {
    event.preventDefault();
  });

  editor.addEventListener("drop", (event) => {
    event.preventDefault();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      void handleImageFiles(files);
    }
  });

  const updateFooterStats = () => {
    const text = editor.value;
    charCount.textContent = `Chars: ${text.length}`;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    wordCount.textContent = `Words: ${words}`;
    const lines = text.split("\n").length;
    lineCount.textContent = `Lines: ${lines}`;
  };

  updateFooterStats();
  editor.addEventListener("input", updateFooterStats);

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
    const headerValue = fallbackFromMarkdown(editor.value);
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
