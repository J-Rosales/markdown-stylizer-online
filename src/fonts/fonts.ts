const CACHE_NAME = "mso-fonts-v1";
const RESOLVE_ENDPOINT = "/api/google-fonts/resolve";
const MAX_VARIANTS = 4;
const MAX_FONT_BYTES = 5 * 1024 * 1024;
const VARIANT_STORE_KEY = "mso-font-variants";

export type FontVariant = {
  url: string;
  weight: number;
  style: "normal" | "italic";
};

export type FontStatus = "cached" | "not_cached" | "error";

export const popularFonts = [
  "Inter",
  "Roboto",
  "Open Sans",
  "Lato",
  "Montserrat",
  "Source Sans 3",
  "Poppins",
  "Merriweather",
  "Playfair Display",
  "Nunito Sans",
  "Roboto Slab",
  "Ubuntu",
];

type VariantStore = Record<string, FontVariant[]>;

const allowedNameRegex = /^[a-z0-9 '\-]{1,80}$/i;

const normalizeName = (input: string): string | null => {
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!allowedNameRegex.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const normalizeFromUrl = (input: string): string | null => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.origin !== "https://fonts.google.com") {
    return null;
  }
  const match = url.pathname.match(/^\/specimen\/(.+)$/);
  if (!match) {
    return null;
  }
  const slug = decodeURIComponent(match[1]).replace(/\+/g, " ");
  return normalizeName(slug);
};

export const normalizeFontInput = (
  input: string
): { familyName: string } | { error: string } => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "Invalid font name. Enter a Google Fonts family name (e.g. Montserrat)." };
  }
  if (trimmed.startsWith("http")) {
    const familyName = normalizeFromUrl(trimmed);
    if (!familyName) {
      return {
        error:
          "Invalid Google Fonts URL. Use a specimen URL like https://fonts.google.com/specimen/Montserrat.",
      };
    }
    return { familyName };
  }
  const familyName = normalizeName(trimmed);
  if (!familyName) {
    return { error: "Invalid font name. Enter a Google Fonts family name (e.g. Montserrat)." };
  }
  return { familyName };
};

const fetchWithTimeout = async (input: RequestInfo, timeoutMs: number) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
};

const selectVariants = (variants: FontVariant[]): FontVariant[] => {
  const wanted = [
    { weight: 400, style: "normal" as const },
    { weight: 700, style: "normal" as const },
    { weight: 400, style: "italic" as const },
    { weight: 700, style: "italic" as const },
  ];
  const chosen: FontVariant[] = [];
  wanted.forEach((target) => {
    const match = variants.find(
      (variant) =>
        variant.weight === target.weight && variant.style === target.style
    );
    if (match) {
      chosen.push(match);
    }
  });
  if (chosen.length === 0) {
    return variants.slice(0, MAX_VARIANTS);
  }
  return chosen.slice(0, MAX_VARIANTS);
};

export const resolveFontVariants = async (
  familyName: string
): Promise<FontVariant[]> => {
  const response = await fetchWithTimeout(
    `${RESOLVE_ENDPOINT}?family=${encodeURIComponent(familyName)}`,
    8000
  );

  if (response.status === 404) {
    throw new Error(
      "Font not found on Google Fonts. Check the name/URL and try again."
    );
  }
  if (response.status === 504) {
    throw new Error("Font lookup timed out. Try again.");
  }
  if (!response.ok) {
    throw new Error("Could not look up that font. Try again.");
  }

  const payload = (await response.json()) as FontVariant[];
  const sanitized = payload.filter((variant) => {
    try {
      const url = new URL(variant.url);
      return (
        url.origin === "https://fonts.gstatic.com" &&
        (url.pathname.endsWith(".woff2") || url.pathname.endsWith(".woff"))
      );
    } catch {
      return false;
    }
  });

  if (sanitized.length === 0) {
    throw new Error("Font not found on Google Fonts. Check the name/URL and try again.");
  }

  return selectVariants(sanitized);
};

export const storeFontVariants = (
  familyName: string,
  variants: FontVariant[]
): void => {
  const raw = localStorage.getItem(VARIANT_STORE_KEY);
  const store = raw ? (JSON.parse(raw) as VariantStore) : {};
  store[familyName] = variants;
  localStorage.setItem(VARIANT_STORE_KEY, JSON.stringify(store));
};

export const getStoredVariants = (familyName: string): FontVariant[] | null => {
  const raw = localStorage.getItem(VARIANT_STORE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const store = JSON.parse(raw) as VariantStore;
    return store[familyName] ?? null;
  } catch {
    return null;
  }
};

const validateFontBuffer = (buffer: ArrayBuffer): void => {
  if (buffer.byteLength > MAX_FONT_BYTES) {
    throw new Error("Downloaded font failed validation and was blocked.");
  }
  const magic = new TextDecoder().decode(new Uint8Array(buffer.slice(0, 4)));
  if (magic !== "wOF2" && magic !== "wOFF") {
    throw new Error("Downloaded font failed validation and was blocked.");
  }
};

const validateFontResponse = async (response: Response): Promise<ArrayBuffer> => {
  const url = new URL(response.url);
  if (url.origin !== "https://fonts.gstatic.com") {
    throw new Error("Downloaded font failed validation and was blocked.");
  }
  if (!response.ok) {
    throw new Error("Could not download the font. Try again.");
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("font/woff2") && !contentType.includes("font/woff")) {
    throw new Error("Downloaded font failed validation and was blocked.");
  }
  const buffer = await response.arrayBuffer();
  validateFontBuffer(buffer);
  return buffer;
};

const cacheFont = async (url: string, response: Response): Promise<void> => {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(url, response);
};

export const loadFontFamily = async (
  familyName: string,
  variants: FontVariant[]
): Promise<void> => {
  for (const variant of variants) {
    const response = await fetchWithTimeout(variant.url, 10000);
    const clone = response.clone();
    const buffer = await validateFontResponse(response);
    const face = new FontFace(familyName, buffer, {
      weight: String(variant.weight),
      style: variant.style,
    });
    await face.load();
    document.fonts.add(face);
    await cacheFont(variant.url, clone);
  }
};

export const loadFontFamilyFromCache = async (
  familyName: string,
  variants: FontVariant[]
): Promise<void> => {
  const cache = await caches.open(CACHE_NAME);
  for (const variant of variants) {
    const cached = await cache.match(variant.url);
    if (!cached) {
      throw new Error("Font not cached.");
    }
    const buffer = await cached.arrayBuffer();
    validateFontBuffer(buffer);
    const face = new FontFace(familyName, buffer, {
      weight: String(variant.weight),
      style: variant.style,
    });
    await face.load();
    document.fonts.add(face);
  }
};

export const getFontCacheStatus = async (
  variants: FontVariant[]
): Promise<FontStatus> => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const matches = await Promise.all(
      variants.map((variant) => cache.match(variant.url))
    );
    const cached = matches.filter(Boolean).length;
    if (cached === 0) {
      return "not_cached";
    }
    return cached === variants.length ? "cached" : "not_cached";
  } catch {
    return "error";
  }
};
