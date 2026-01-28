export type Pagination = {
  pageCount: number;
  pageContentHeightPx: number;
  totalContentHeightPx: number;
  offsets: number[];
  clamped: boolean;
};

export const paginate = (
  totalContentHeightPx: number,
  pageContentHeightPx: number,
  maxPages: number
): Pagination => {
  const safePageHeight = Math.max(1, pageContentHeightPx);
  const rawCount = Math.max(1, Math.ceil(totalContentHeightPx / safePageHeight));
  const safeMax = Math.max(1, Math.floor(maxPages));
  const pageCount = Math.min(rawCount, safeMax);
  const offsets = Array.from({ length: pageCount }, (_, index) => index * safePageHeight);

  return {
    pageCount,
    pageContentHeightPx: safePageHeight,
    totalContentHeightPx,
    offsets,
    clamped: rawCount !== pageCount,
  };
};
