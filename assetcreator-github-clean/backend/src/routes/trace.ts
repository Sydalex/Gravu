import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import sharp from "sharp";
import potrace from "potrace";
import Drawing from "dxf-writer";
import { writeFile, unlink } from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";
import { tmpdir } from "os";
import {
  VectorizeRequestSchema,
  ExportDxfRequestSchema,
  type UploadResponse,
  type VectorizeResponse,
} from "../types";

const traceRouter = new Hono();

// ─── POST /upload ───────────────────────────────────────────────────────────
// Accepts multipart form data with an image file.
// Resizes to max 2048px, converts to PNG, returns base64 + metadata.
traceRouter.post("/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return c.json(
        { error: { message: "No file uploaded. Send a 'file' field.", code: "MISSING_FILE" } },
        400
      );
    }

    console.log(`[upload] Received file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Process with Sharp: resize to max 2048px on longest side, convert to PNG
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    const maxDim = 2048;
    let resizeOpts: sharp.ResizeOptions | undefined;
    if (metadata.width && metadata.height) {
      if (metadata.width > maxDim || metadata.height > maxDim) {
        resizeOpts =
          metadata.width > metadata.height
            ? { width: maxDim, withoutEnlargement: true }
            : { height: maxDim, withoutEnlargement: true };
      }
    }

    const processed = resizeOpts ? image.resize(resizeOpts) : image;
    const pngBuffer = await processed.png().toBuffer();
    const pngMetadata = await sharp(pngBuffer).metadata();

    const base64 = pngBuffer.toString("base64");

    const responseData: UploadResponse = {
      imageBase64: base64,
      width: pngMetadata.width ?? 0,
      height: pngMetadata.height ?? 0,
      originalName: file.name,
    };

    console.log(
      `[upload] Processed image: ${responseData.width}x${responseData.height}, base64 length: ${base64.length}`
    );

    return c.json({ data: responseData });
  } catch (err) {
    console.error("[upload] Error processing image:", err);
    return c.json(
      { error: { message: "Failed to process image", code: "PROCESSING_ERROR" } },
      500
    );
  }
});

// ─── POST /vectorize ────────────────────────────────────────────────────────
// Traces a base64 PNG image into SVG using potrace.
traceRouter.post(
  "/vectorize",
  zValidator("json", VectorizeRequestSchema),
  async (c) => {
    try {
      const { imageBase64, settings } = c.req.valid("json");

      console.log("[vectorize] Settings:", JSON.stringify(settings));

      // Decode base64 to buffer
      const imageBuffer = Buffer.from(imageBase64, "base64");

      // Get dimensions from the image
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width ?? 0;
      const height = metadata.height ?? 0;

      console.log(`[vectorize] Image dimensions: ${width}x${height}`);

      // Write buffer to a temp file since potrace's Jimp may have issues with buffers in Bun
      const tempPath = join(tmpdir(), `potrace-${randomUUID()}.png`);
      await writeFile(tempPath, imageBuffer);

      // Wrap potrace.trace in a Promise
      const svg = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Potrace timed out after 30 seconds"));
        }, 30000);

        potrace.trace(
          tempPath,
          {
            threshold: settings.threshold === -1 ? (potrace as any).Potrace.THRESHOLD_AUTO : settings.threshold,
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
          }
        );
      }).finally(async () => {
        // Clean up temp file
        try {
          await unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      });

      const responseData: VectorizeResponse = {
        svg,
        width,
        height,
      };

      console.log(`[vectorize] SVG generated, length: ${svg.length}`);

      return c.json({ data: responseData });
    } catch (err) {
      console.error("[vectorize] Error tracing image:", err);
      return c.json(
        { error: { message: "Failed to vectorize image", code: "VECTORIZE_ERROR" } },
        500
      );
    }
  }
);

// ─── POST /export-dxf ──────────────────────────────────────────────────────
// Converts SVG path data to DXF format using dxf-writer.
traceRouter.post(
  "/export-dxf",
  zValidator("json", ExportDxfRequestSchema),
  async (c) => {
    try {
      const { svg } = c.req.valid("json");

      console.log("[export-dxf] SVG input length:", svg.length);

      // Extract all SVG path d attributes
      const pathRegex = /<path[^>]*\bd="([^"]+)"[^>]*>/gi;
      const paths: string[] = [];
      let match: RegExpExecArray | null;
      while ((match = pathRegex.exec(svg)) !== null) {
        if (match[1]) paths.push(match[1]);
      }

      console.log(`[export-dxf] Found ${paths.length} path(s) in SVG`);

      if (paths.length === 0) {
        return c.json(
          { error: { message: "No path data found in SVG", code: "NO_PATHS" } },
          400
        );
      }

      // Create DXF drawing
      const drawing = new Drawing();
      drawing.addLayer("Vectors", Drawing.ACI.WHITE, "CONTINUOUS");
      drawing.setActiveLayer("Vectors");

      // Parse SVG path commands and convert to DXF polylines
      for (const pathData of paths) {
        const polylines = parseSvgPathToPolylines(pathData);
        for (const points of polylines) {
          if (points.length >= 2) {
            drawing.drawPolyline(points, true);
          }
        }
      }

      const dxfString = drawing.toDxfString();

      console.log(`[export-dxf] DXF generated, length: ${dxfString.length}`);

      c.header("Content-Type", "application/dxf");
      c.header("Content-Disposition", 'attachment; filename="export.dxf"');
      return c.text(dxfString);
    } catch (err) {
      console.error("[export-dxf] Error generating DXF:", err);
      return c.json(
        { error: { message: "Failed to generate DXF", code: "DXF_ERROR" } },
        500
      );
    }
  }
);

// ─── SVG path parser ────────────────────────────────────────────────────────
// Parses SVG path `d` attribute and returns arrays of [x, y] polyline points.
// Handles M, L, H, V, C, S, Q, T, Z commands (absolute and relative).
function parseSvgPathToPolylines(d: string): Array<[number, number][]> {
  const polylines: Array<[number, number][]> = [];
  let currentPolyline: [number, number][] = [];

  let curX = 0;
  let curY = 0;
  let startX = 0;
  let startY = 0;

  // Tokenize the path data
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
      i++; // consume command letter
    } else {
      // Implicit lineTo if we get numbers without a command
      // Treat as 'L' if we have an active polyline
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
        // Subsequent coordinate pairs are treated as implicit L
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
        // Cubic bezier: we sample endpoints only (simple conversion)
        while (i < tokens.length && isNumber(i)) {
          const _cp1x = nextNum();
          const _cp1y = nextNum();
          const _cp2x = nextNum();
          const _cp2y = nextNum();
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "c": {
        while (i < tokens.length && isNumber(i)) {
          const _cp1x = nextNum();
          const _cp1y = nextNum();
          const _cp2x = nextNum();
          const _cp2y = nextNum();
          const dx = nextNum();
          const dy = nextNum();
          curX += dx;
          curY += dy;
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "S": {
        // Smooth cubic bezier: skip control points, take endpoint
        while (i < tokens.length && isNumber(i)) {
          const _cpx = nextNum();
          const _cpy = nextNum();
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "s": {
        while (i < tokens.length && isNumber(i)) {
          const _cpx = nextNum();
          const _cpy = nextNum();
          curX += nextNum();
          curY += nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "Q": {
        // Quadratic bezier: skip control point, take endpoint
        while (i < tokens.length && isNumber(i)) {
          const _cpx = nextNum();
          const _cpy = nextNum();
          curX = nextNum();
          curY = nextNum();
          currentPolyline.push([curX, curY]);
        }
        break;
      }
      case "q": {
        while (i < tokens.length && isNumber(i)) {
          const _cpx = nextNum();
          const _cpy = nextNum();
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
        // Close path: return to start
        if (currentPolyline.length > 0) {
          curX = startX;
          curY = startY;
          // Don't add duplicate close point; DXF closed flag handles it
        }
        finishPolyline();
        break;
      }
      default: {
        // Skip unknown commands
        console.log(`[svg-parser] Unknown SVG command: ${cmd}`);
        break;
      }
    }
  }

  finishPolyline();
  return polylines;
}

export { traceRouter };
