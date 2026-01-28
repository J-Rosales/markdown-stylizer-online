import { getImage, putImage } from "./idb";

export const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const blobUrlCache = new Map<string, string>();

const getBlobUrl = async (id: string): Promise<string | null> => {
  if (blobUrlCache.has(id)) {
    return blobUrlCache.get(id) ?? null;
  }
  const record = await getImage(id);
  if (!record) {
    return null;
  }
  const url = URL.createObjectURL(record.blob);
  blobUrlCache.set(id, url);
  return url;
};

const sanitizeAlt = (alt: string) => alt.replace(/[\[\]]/g, "").trim();

const fallbackAlt = (fileName: string) => {
  const trimmed = fileName.trim();
  if (!trimmed) {
    return "image";
  }
  const noExtension = trimmed.replace(/\.[^.]+$/, "");
  return sanitizeAlt(noExtension || trimmed);
};

export type StoreImageResult = {
  id: string;
  markdown: string;
  name: string;
  alt: string;
  src: string;
};

export type StoreImageError = {
  name: string;
  reason: string;
};

export const storeImageFile = async (
  file: File,
  allowLarge: boolean
): Promise<StoreImageResult | StoreImageError> => {
  if (!ALLOWED_TYPES.has(file.type)) {
    return { name: file.name || "image", reason: "Unsupported file type." };
  }
  if (!allowLarge && file.size > MAX_IMAGE_BYTES) {
    return {
      name: file.name || "image",
      reason: "Image exceeds 16 MB limit.",
    };
  }

  const id = crypto.randomUUID();
  const alt = fallbackAlt(file.name);
  const src = `appimg://${id}`;
  await putImage({
    id,
    name: file.name || "image",
    mime: file.type,
    size: file.size,
    createdAt: Date.now(),
    blob: file,
  });

  return {
    id,
    name: file.name || "image",
    markdown: `![${alt}](${src})`,
    alt,
    src,
  };
};

export const resolveAppImages = async (
  container: HTMLElement
): Promise<void> => {
  const images = Array.from(container.querySelectorAll("img"));
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src") ?? "";
      if (!src.startsWith("appimg://")) {
        return;
      }
      const id = src.slice("appimg://".length);
      const url = await getBlobUrl(id);
      if (!url) {
        img.classList.add("image-missing");
        if (!img.getAttribute("alt")) {
          img.setAttribute("alt", "Missing image");
        }
        return;
      }
      img.src = url;
    })
  );
};

const parseTitleOptions = (title: string) => {
  const options: Record<string, string> = {};
  title
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [key, value] = part.split("=");
      if (key && value) {
        options[key.toLowerCase()] = value;
      }
    });
  return options;
};

export const applyImageOptions = (container: HTMLElement): void => {
  const images = Array.from(container.querySelectorAll("img"));
  images.forEach((img) => {
    const title = img.getAttribute("title") ?? "";
    if (!title) {
      return;
    }
    const options = parseTitleOptions(title);
    img.classList.remove("align-left", "align-right", "align-center");
    img.style.width = "";
    img.style.float = "";
    img.style.marginLeft = "";
    img.style.marginRight = "";
    if (options.width) {
      const widthValue = options.width.endsWith("%")
        ? options.width
        : `${Number(options.width)}px`;
      if (!Number.isNaN(Number(options.width)) || options.width.endsWith("%")) {
        img.style.width = widthValue;
      }
    }
    const align = options.align?.toLowerCase();
    if (align === "left") {
      img.classList.add("align-left");
    } else if (align === "right") {
      img.classList.add("align-right");
    } else if (align === "center") {
      img.classList.add("align-center");
    }
  });
};

export const insertAtCursor = (
  textarea: HTMLTextAreaElement,
  text: string
): void => {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const prefix = textarea.value.slice(0, start);
  const suffix = textarea.value.slice(end);
  const needsLeadingNewline = prefix.length > 0 && !prefix.endsWith("\n");
  const needsTrailingNewline = suffix.length > 0 && !suffix.startsWith("\n");
  const insert = `${needsLeadingNewline ? "\n" : ""}${text}${
    needsTrailingNewline ? "\n" : ""
  }`;
  textarea.value = `${prefix}${insert}${suffix}`;
  const cursor = prefix.length + insert.length;
  textarea.selectionStart = cursor;
  textarea.selectionEnd = cursor;
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
};
