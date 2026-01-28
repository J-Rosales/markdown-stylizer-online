import { toPng } from "html-to-image";
import { resolveAppImages } from "../assets/images";
import { getPageMetrics } from "../layout/pageMetrics";
import { paginate, Pagination } from "./paginate";

export type RasterizeOptions = {
  previewContent: HTMLElement;
  pageShell: HTMLElement;
  maxPages: number;
  scale?: number;
};

export type RasterizeResult = {
  pages: string[];
  pagination: Pagination;
  pageWidthPx: number;
  pageHeightPx: number;
};

const waitForImages = async (container: HTMLElement): Promise<void> => {
  const images = Array.from(container.querySelectorAll("img"));
  if (images.length === 0) {
    return;
  }
  await Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        })
    )
  );
};

const createExportRoot = (): HTMLDivElement => {
  const root = document.createElement("div");
  root.style.position = "fixed";
  root.style.left = "-100000px";
  root.style.top = "0";
  root.style.pointerEvents = "none";
  document.body.appendChild(root);
  return root;
};

const cloneContent = (source: HTMLElement, widthPx: number): HTMLElement => {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.style.padding = "0";
  clone.style.margin = "0";
  clone.style.boxSizing = "border-box";
  clone.style.width = `${widthPx}px`;
  return clone;
};

export const rasterizePages = async ({
  previewContent,
  pageShell,
  maxPages,
  scale = 2,
}: RasterizeOptions): Promise<RasterizeResult> => {
  const { pageWidthPx, pageHeightPx, marginPx, contentWidthPx, contentHeightPx } =
    getPageMetrics();
  const exportRoot = createExportRoot();

  const measureNode = cloneContent(previewContent, contentWidthPx);
  exportRoot.appendChild(measureNode);
  await resolveAppImages(measureNode);
  await waitForImages(measureNode);
  const totalContentHeightPx = measureNode.scrollHeight;
  measureNode.remove();

  const pagination = paginate(
    totalContentHeightPx,
    contentHeightPx,
    maxPages
  );
  const backgroundColor = getComputedStyle(pageShell).backgroundColor;
  const pages: string[] = [];

  const contentTemplate = cloneContent(previewContent, contentWidthPx);
  await resolveAppImages(contentTemplate);
  await waitForImages(contentTemplate);

  for (const offset of pagination.offsets) {
    const page = document.createElement("div");
    page.className = "page-shell";
    page.style.width = `${pageWidthPx}px`;
    page.style.height = `${pageHeightPx}px`;
    page.style.padding = `${marginPx}px`;
    page.style.boxSizing = "border-box";
    page.style.overflow = "hidden";
    page.style.boxShadow = "none";
    page.style.background = backgroundColor;

    const content = contentTemplate.cloneNode(true) as HTMLElement;
    content.style.transform = `translateY(-${offset}px)`;
    content.style.willChange = "transform";
    page.appendChild(content);
    exportRoot.appendChild(page);

    const dataUrl = await toPng(page, { pixelRatio: scale });
    pages.push(dataUrl);
    page.remove();
  }

  exportRoot.remove();

  return {
    pages,
    pagination,
    pageWidthPx,
    pageHeightPx,
  };
};
