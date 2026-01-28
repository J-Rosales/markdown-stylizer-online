export const registerServiceWorker = (): void => {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  window.addEventListener("load", () => {
    const baseUrl =
      typeof import.meta !== "undefined" && import.meta.env?.BASE_URL
        ? import.meta.env.BASE_URL
        : "/";
    const swUrl = new URL("sw.js", `${window.location.origin}${baseUrl}`);
    navigator.serviceWorker.register(swUrl, { scope: baseUrl }).catch(() => {
      // registration failures are non-fatal
    });
  });
};
