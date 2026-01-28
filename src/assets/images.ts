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
    markdown: `![${alt}](appimg://${id})`,
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
