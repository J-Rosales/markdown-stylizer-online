import html2pdf from "html2pdf.js";
import { resolveAppImages } from "../assets/images";
import { getPageMetrics } from "../layout/pageMetrics";
import { paginate, Pagination } from "./paginate";

type ExportProgress = {
  step: "measure" | "render" | "done";
  pageCount?: number;
  clamped?: boolean;
};

export type ExportPdfOptions = {
  previewContent: HTMLElement;
  pageShell: HTMLElement;
  maxPages: number;
  fileName?: string;
  onProgress?: (progress: ExportProgress) => void;
};

export type ExportPdfResult = {
  pagination: Pagination;
  cancelled: boolean;
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

export const exportPdf = async ({
  previewContent,
  pageShell,
  maxPages,
  fileName,
  onProgress,
}: ExportPdfOptions): Promise<ExportPdfResult> => {
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
  onProgress?.({
    step: "measure",
    pageCount: pagination.pageCount,
    clamped: pagination.clamped,
  });

  if (pagination.pageCount > 1) {
    const shouldContinue = window.confirm(
      "Content exceeds one page. Continue exporting to PDF?"
    );
    if (!shouldContinue) {
      exportRoot.remove();
      return { pagination, cancelled: true };
    }
  }

  const exportNode = pageShell.cloneNode(true) as HTMLElement;
  const marker = exportNode.querySelector(".page-marker");
  marker?.remove();
  exportNode.style.boxShadow = "none";
  exportNode.style.width = `${pageWidthPx}px`;
  exportNode.style.background = getComputedStyle(pageShell).backgroundColor;

  const content = cloneContent(previewContent, contentWidthPx);
  await resolveAppImages(content);
  await waitForImages(content);
  exportNode.innerHTML = "";
  exportNode.appendChild(content);

  if (pagination.clamped) {
    const maxHeightPx = pagination.pageCount * contentHeightPx + marginPx * 2;
    exportNode.style.maxHeight = `${maxHeightPx}px`;
    exportNode.style.overflow = "hidden";
  }

  exportRoot.appendChild(exportNode);

  onProgress?.({ step: "render", pageCount: pagination.pageCount });
  await html2pdf()
    .set({
      margin: 0,
      filename: fileName ?? "document.pdf",
      image: { type: "png", quality: 1 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(exportNode)
    .save();

  exportRoot.remove();
  onProgress?.({ step: "done" });
  return { pagination, cancelled: false };
};
