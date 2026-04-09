export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Safari can abort downloads if the blob URL is revoked synchronously.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadTextFile(content: string, filename: string, mimeType: string) {
  triggerBlobDownload(new Blob([content], { type: mimeType }), filename);
}

export function downloadBase64File(base64: string, filename: string, mimeType: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  triggerBlobDownload(new Blob([bytes], { type: mimeType }), filename);
}

function parseNumericViewBox(viewBox: string | null) {
  if (!viewBox) return null;
  const parts = viewBox
    .trim()
    .split(/[\s,]+/)
    .map((value) => Number(value));

  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
    return null;
  }

  const [x, y, width, height] = parts;
  return { x, y, width, height };
}

function serializeSvgForPngExport(
  svgMarkup: string,
  options: {
    paddingRatio?: number;
    targetLongestEdge?: number;
  } = {},
) {
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svgMarkup, 'image/svg+xml');
  const svgElement = svgDocument.documentElement as SVGSVGElement;

  if (svgElement.nodeName.toLowerCase() !== 'svg') {
    throw new Error('Invalid SVG export');
  }

  svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgElement.setAttribute('shape-rendering', 'geometricPrecision');

  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.left = '-99999px';
  host.style.top = '0';
  host.style.width = '0';
  host.style.height = '0';
  host.style.overflow = 'hidden';
  host.style.opacity = '0';
  host.style.pointerEvents = 'none';

  const measurableSvg = document.importNode(svgElement, true) as SVGSVGElement;
  host.appendChild(measurableSvg);
  document.body.appendChild(host);

  let bounds:
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | null = null;

  try {
    const target = measurableSvg.querySelector('g') ?? measurableSvg;
    const box = target.getBBox();
    if (box.width > 0 && box.height > 0) {
      bounds = {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      };
    }
  } finally {
    document.body.removeChild(host);
  }

  const fallbackViewBox = parseNumericViewBox(svgElement.getAttribute('viewBox'));
  const width = bounds?.width ?? fallbackViewBox?.width ?? 1000;
  const height = bounds?.height ?? fallbackViewBox?.height ?? 1000;
  const x = bounds?.x ?? fallbackViewBox?.x ?? 0;
  const y = bounds?.y ?? fallbackViewBox?.y ?? 0;

  const paddingRatio = options.paddingRatio ?? 0.04;
  const padding = Math.max(8, Math.max(width, height) * paddingRatio);
  const exportWidth = width + padding * 2;
  const exportHeight = height + padding * 2;
  const targetLongestEdge = options.targetLongestEdge ?? 2400;
  const scale = targetLongestEdge / Math.max(exportWidth, exportHeight, 1);
  const rasterWidth = Math.max(1, Math.round(exportWidth * scale));
  const rasterHeight = Math.max(1, Math.round(exportHeight * scale));

  svgElement.setAttribute(
    'viewBox',
    `${x - padding} ${y - padding} ${exportWidth} ${exportHeight}`,
  );
  svgElement.setAttribute('width', String(rasterWidth));
  svgElement.setAttribute('height', String(rasterHeight));

  return {
    serialized: new XMLSerializer().serializeToString(svgElement),
    rasterWidth,
    rasterHeight,
  };
}

export async function renderSvgToPngBlob(
  svgMarkup: string,
  options: {
    background?: string;
    paddingRatio?: number;
    targetLongestEdge?: number;
  } = {},
) {
  const { serialized, rasterWidth, rasterHeight } = serializeSvgForPngExport(
    svgMarkup,
    options,
  );
  const svgUrl = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml' }));

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error('Failed to rasterize SVG export'));
      nextImage.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = rasterWidth;
    canvas.height = rasterHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas export is unavailable');
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.fillStyle = options.background ?? '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result) {
          resolve(result);
          return;
        }
        reject(new Error('Failed to create PNG blob'));
      }, 'image/png');
    });

    return blob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
