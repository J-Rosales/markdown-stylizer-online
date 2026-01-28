export type PageMetrics = {
  pageWidthPx: number;
  pageHeightPx: number;
  marginPx: number;
  contentWidthPx: number;
  contentHeightPx: number;
  pxPerMm: number;
};

const measurePxPerMm = (): number => {
  const probe = document.createElement("div");
  probe.style.width = "1mm";
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const px = probe.getBoundingClientRect().width;
  probe.remove();
  return px || 3.78;
};

const readMmVar = (name: string, fallback: number): number => {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : fallback;
};

export const getPageMetrics = (): PageMetrics => {
  const pxPerMm = measurePxPerMm();
  const pageWidthMm = readMmVar("--page-width", 210);
  const pageHeightMm = readMmVar("--page-height", 297);
  const marginMm = readMmVar("--page-margin", 20);
  const pageWidthPx = pageWidthMm * pxPerMm;
  const pageHeightPx = pageHeightMm * pxPerMm;
  const marginPx = marginMm * pxPerMm;
  const contentWidthPx = pageWidthPx - marginPx * 2;
  const contentHeightPx = pageHeightPx - marginPx * 2;

  return {
    pageWidthPx,
    pageHeightPx,
    marginPx,
    contentWidthPx,
    contentHeightPx,
    pxPerMm,
  };
};
