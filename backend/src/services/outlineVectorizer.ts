import sharp from "sharp";
import potrace from "potrace";
import Drawing from "dxf-writer";
import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";
import { tmpdir } from "os";
import type { VectorizeSettings } from "../types";

export const DEFAULT_OUTLINE_SETTINGS: VectorizeSettings = {
  threshold: -1,
  turnPolicy: "minority",
  turdSize: 1,
  optCurve: true,
  alphaMax: 0.85,
  color: "#000000",
};

export async function normalizeOutlineInput(inputBuffer: Buffer) {
  return sharp(inputBuffer)
    .flatten({ background: "#ffffff" })
    .resize(2048, 2048, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer();
}

export async function traceOutlineSvgFromBuffer(
  inputBuffer: Buffer,
  settings: VectorizeSettings = DEFAULT_OUTLINE_SETTINGS,
) {
  const normalizedBuffer = await normalizeOutlineInput(inputBuffer);
  const metadata = await sharp(normalizedBuffer).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const tempPath = join(tmpdir(), `potrace-${randomUUID()}.png`);
  await writeFile(tempPath, normalizedBuffer);

  const svg = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Potrace timed out after 30 seconds"));
    }, 30000);

    potrace.trace(
      tempPath,
      {
        threshold:
          settings.threshold === -1
            ? (potrace as { Potrace: { THRESHOLD_AUTO: number } }).Potrace.THRESHOLD_AUTO
            : settings.threshold,
        turnPolicy: settings.turnPolicy,
        turdSize: settings.turdSize,
        optCurve: settings.optCurve,
        alphaMax: settings.alphaMax,
        color: settings.color,
      },
      (err: Error | null, svgContent: string) => {
        clearTimeout(timeout);
        if (err) {
          reject(err);
        } else {
          resolve(svgContent);
        }
      },
    );
  }).finally(async () => {
    try {
      await unlink(tempPath);
    } catch {
      // Ignore temp cleanup failures.
    }
  });

  return {
    svg,
    width,
    height,
    previewBase64: normalizedBuffer.toString("base64"),
  };
}

export function convertSvgToDxfString(svg: string) {
  const pathRegex = /<path[^>]*\bd="([^"]+)"[^>]*>/gi;
  const paths: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pathRegex.exec(svg)) !== null) {
    if (match[1]) paths.push(match[1]);
  }

  if (paths.length === 0) {
    throw new Error("No path data found in SVG");
  }

  const drawing = new Drawing();
  drawing.addLayer("Vectors", Drawing.ACI.WHITE, "CONTINUOUS");
  drawing.setActiveLayer("Vectors");

  for (const pathData of paths) {
    const polylines = parseSvgPathToPolylines(pathData);
    for (const points of polylines) {
      if (points.length >= 2) {
        drawing.drawPolyline(points, true);
      }
    }
  }

  return drawing.toDxfString();
}

function parseSvgPathToPolylines(d: string): Array<[number, number][]> {
  const polylines: Array<[number, number][]> = [];
  let currentPolyline: [number, number][] = [];

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  const rawTokens = d.match(/[a-zA-Z]|-?\d+\.?\d*(?:e[+-]?\d+)?/g);
  if (!rawTokens) return polylines;
  const tokens: string[] = rawTokens;

  let i = 0;

  function nextNum(): number {
    if (i < tokens.length) {
      const val = parseFloat(tokens[i]!);
      if (!isNaN(val)) {
        i++;
        return val;
      }
    }
    return 0;
  }

  function isNumber(idx: number): boolean {
    if (idx >= tokens.length) return false;
    return !isNaN(parseFloat(tokens[idx]!));
  }

  function finishPolyline(): void {
    if (currentPolyline.length > 0) {
      polylines.push([...currentPolyline]);
      currentPolyline = [];
    }
  }

  while (i < tokens.length) {
    const cmd = tokens[i]!;
    if (/^[a-zA-Z]$/.test(cmd)) {
      i++;
    } else {
      if (currentPolyline.length > 0) {
        const x = nextNum();
        const y = nextNum();
        curX = x;
        curY = y;
        currentPolyline.push([curX, curY]);
        continue;
      }
      i++;
      continue;
    }

    switch (cmd) {
      case "M": {
        finishPolyline();
        curX = nextNum();
        curY = nextNum();
        startX = curX;
        startY = curY;
        currentPolyline.push([curX, curY]);
        while (i < tokens.length && isNumber(i)) {
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "m": {
        finishPolyline();
        curX += nextNum();
        curY += nextNum();
        startX = curX;
        startY = curY;
        currentPolyline.push([curX, curY]);
        while (i < tokens.length && isNumber(i)) {
          curX += nextNum();
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "L": {
        while (i < tokens.length && isNumber(i)) {
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "l": {
        while (i < tokens.length && isNumber(i)) {
          curX += nextNum();
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "H": {
        while (i < tokens.length && isNumber(i)) {
          curX = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "h": {
        while (i < tokens.length && isNumber(i)) {
          curX += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "V": {
        while (i < tokens.length && isNumber(i)) {
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "v": {
        while (i < tokens.length && isNumber(i)) {
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "C": {
        while (i < tokens.length && isNumber(i)) {
          nextNum();
          nextNum();
          nextNum();
          nextNum();
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "c": {
        while (i < tokens.length && isNumber(i)) {
          nextNum();
          nextNum();
          nextNum();
          nextNum();
          const dx = nextNum();
          const dy = nextNum();
          curX += dx;
          curY += dy;
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "S": {
        while (i < tokens.length && isNumber(i)) {
          nextNum();
          nextNum();
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "s": {
        while (i < tokens.length && isNumber(i)) {
          nextNum();
          nextNum();
          curX += nextNum();
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "Q": {
        while (i < tokens.length && isNumber(i)) {
          nextNum();
          nextNum();
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "q": {
        while (i < tokens.length && isNumber(i)) {
          nextNum();
          nextNum();
          curX += nextNum();
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "T": {
        while (i < tokens.length && isNumber(i)) {
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "t": {
        while (i < tokens.length && isNumber(i)) {
          curX += nextNum();
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "Z":
      case "z": {
        if (currentPolyline.length > 0) {
          curX = startX;
          curY = startY;
        }
        finishPolyline();
        break;
      }
      default:
        break;
    }
  }

  finishPolyline();
  return polylines;
}
