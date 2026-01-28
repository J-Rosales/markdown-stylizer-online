import JSZip from "jszip";
import { downloadBlob } from "./download";
import { rasterizePages, RasterizeResult } from "./rasterize";

type ExportProgress = {
  step: string;
  current?: number;
  total?: number;
};

export type ExportPngZipOptions = {
  previewContent: HTMLElement;
  pageShell: HTMLElement;
  maxPages: number;
  scale?: number;
  fileName?: string;
  onProgress?: (progress: ExportProgress) => void;
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

const toFileName = (index: number) =>
  `page-${String(index + 1).padStart(2, "0")}.png`;

export const exportPngZip = async (
  options: ExportPngZipOptions
): Promise<RasterizeResult> => {
  const { onProgress, fileName } = options;
  onProgress?.({ step: "rasterize" });
  const result = await rasterizePages(options);

  const zip = new JSZip();
  const total = result.pages.length;

  for (let index = 0; index < total; index += 1) {
    onProgress?.({ step: "zip", current: index + 1, total });
    const blob = await dataUrlToBlob(result.pages[index]);
    zip.file(toFileName(index), blob);
  }

  onProgress?.({ step: "generate" });
  const zipBlob = await zip.generateAsync({ type: "blob" });
  downloadBlob(zipBlob, fileName ?? "markdown-pages.zip");
  onProgress?.({ step: "done" });

  return result;
};
