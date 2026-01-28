const APP_CACHE = "mso-app-v1";
const FONT_CACHE = "mso-fonts-v1";
const METADATA_URL = "https://fonts.google.com/metadata/fonts";

const APP_SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

const allowedNameRegex = /^[a-z0-9 '\-]{1,80}$/i;

const jsonResponse = (status, payload) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const normalizeFamily = (input) => {
  if (!input) {
    return null;
  }
  const trimmed = input.trim().replace(/\s+/g, " ");
  if (!allowedNameRegex.test(trimmed)) {
    return null;
  }
  return trimmed;
};

const parseMetadata = (text) => {
  const cleaned = text.replace(/^\)\]\}'\s*/, "");
  return JSON.parse(cleaned);
};

const mapFilesToVariants = (files) => {
  return Object.entries(files)
    .map(([key, url]) => {
      if (typeof url !== "string") {
        return null;
      }
      const lower = key.toLowerCase();
      const style = lower.includes("italic") ? "italic" : "normal";
      const weightMatch = lower.match(/\d+/);
      const weight = weightMatch ? Number(weightMatch[0]) : lower === "regular" || lower === "italic" ? 400 : 400;
      return { url, weight, style };
    })
    .filter(Boolean);
};

const resolveVariants = async (familyName) => {
  const response = await fetch(METADATA_URL, { redirect: "error" });
  if (!response.ok) {
    throw new Error("LOOKUP_FAILED");
  }
  const text = await response.text();
  const data = parseMetadata(text);
  const list = data.familyMetadataList || data.items || [];
  const entry = list.find(
    (item) => item.family && item.family.toLowerCase() === familyName.toLowerCase()
  );
  if (!entry) {
    return null;
  }
  const files = entry.files || entry.fonts || {};
  const variants = mapFilesToVariants(files).filter((variant) => {
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
  return variants;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.pathname === "/api/google-fonts/resolve") {
    event.respondWith(
      (async () => {
        const familyName = normalizeFamily(url.searchParams.get("family"));
        if (!familyName) {
          return jsonResponse(400, {
            code: "INVALID_FAMILY",
            message:
              "Invalid font name. Enter a Google Fonts family name (e.g. Montserrat).",
          });
        }
        try {
          const variants = await resolveVariants(familyName);
          if (!variants || variants.length === 0) {
            return jsonResponse(404, { code: "FONT_NOT_FOUND", message: "Font not found" });
          }
          return jsonResponse(200, variants);
        } catch {
          return jsonResponse(504, { code: "LOOKUP_TIMEOUT", message: "Lookup timed out" });
        }
      })()
    );
    return;
  }

  if (url.origin === "https://fonts.gstatic.com") {
    event.respondWith(
      caches.open(FONT_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) {
          return cached;
        }
        try {
          const response = await fetch(request, { redirect: "error" });
          if (response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return cached || new Response("", { status: 504 });
        }
      })
    );
    return;
  }
});
