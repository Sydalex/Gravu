import { Hono } from "hono";
import sharp from "sharp";
import potrace from "potrace";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const vtracer = require("vtracer") as { convertImageToSvg: (opts: Record<string, unknown>) => void };
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import {
  DxfToSvgRequestSchema,
  ComposeRequestSchema,
  SvgToDxfRequestSchema,
  type DxfToSvgResponse,
  type ComposeResponse,
} from "../types";
import type { auth } from "../auth";
import { prisma } from "../prisma";
import { env } from "../env";
import {
  vectorizeCenterline,
  type SimplificationLevel,
} from "../services/centerlineVectorizer";
import {
  DEFAULT_OUTLINE_SETTINGS,
  convertSvgToDxfString,
  traceOutlineSvgFromBuffer,
} from "../services/outlineVectorizer";
import { releaseProcessAccess, reserveProcessAccess } from "../services/processAccess";
import {
  getOrCreateTrialDeviceToken,
  hashTrialDeviceToken,
} from "../services/trialDevice";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const simplificationLevels: SimplificationLevel[] = ["low", "mid", "high"];

const convertRouter = new Hono<{ Variables: Variables }>();

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number };
}

function getGeminiApiKey() {
  return env.GEMINI_API_KEY ?? null;
}

function getVectorizePreprocessModel() {
  return env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3-pro-image-preview";
}

async function callGeminiImageTransform(
  model: string,
  prompt: string,
  imageBase64: string,
): Promise<string> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/png",
                  data: imageBase64,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
          temperature: 0.05,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => "(unknown error)");
    throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  if (data.error) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData ?? part.inline_data);
  const outputBase64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data ?? "";

  if (!outputBase64) {
    throw new Error("Gemini did not return an image output.");
  }

  return outputBase64;
}

async function prepareBinaryLinework(inputBuffer: Buffer) {
  return sharp(inputBuffer)
    .flatten({ background: "#ffffff" })
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .sharpen()
    .threshold(145)
    .png()
    .toBuffer();
}

async function prepareConservativeCenterlineInput(inputBuffer: Buffer) {
  return sharp(inputBuffer)
    .flatten({ background: "#ffffff" })
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .png()
    .toBuffer();
}

async function thinBinaryLinework(inputBuffer: Buffer) {
  return sharp(inputBuffer)
    .flatten({ background: "#ffffff" })
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .normalize()
    .threshold(145)
    .erode(1)
    .png()
    .toBuffer();
}

async function mergeBinaryLinework(primaryBuffer: Buffer, secondaryBuffer: Buffer) {
  const primary = await sharp(primaryBuffer)
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const secondary = await sharp(secondaryBuffer)
    .resize(primary.info.width, primary.info.height, {
      fit: "fill",
      kernel: sharp.kernel.nearest,
    })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const merged = Buffer.alloc(primary.data.length);
  for (let i = 0; i < primary.data.length; i += 1) {
    // Preserve any stroke that exists in either image. Black wins.
    merged[i] = Math.min(primary.data[i]!, secondary.data[i]!);
  }

  return sharp(merged, {
    raw: {
      width: primary.info.width,
      height: primary.info.height,
      channels: primary.info.channels,
    },
  })
    .png()
    .toBuffer();
}

async function analyzeLineworkCharacteristics(inputBuffer: Buffer) {
  const { data } = await sharp(inputBuffer)
    .flatten({ background: "#ffffff" })
    .resize(1200, 1200, { fit: "inside", withoutEnlargement: true })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let sum = 0;
  let midDarkPixels = 0;
  let darkPixels = 0;

  for (const value of data) {
    sum += value;
    if (value < 245) midDarkPixels += 1;
    if (value < 220) darkPixels += 1;
  }

  const total = Math.max(1, data.length);
  const mean = sum / total;
  const midDarkRatio = midDarkPixels / total;
  const darkRatio = darkPixels / total;

  return {
    mean,
    midDarkRatio,
    darkRatio,
    // Already-clean line art: very bright background with a small amount of
    // sparse stroke pixels. Gemini is too destructive for this case.
    isCleanLineArt: mean > 248 && midDarkRatio < 0.08 && darkRatio < 0.05,
  };
}

async function preprocessLineworkForCenterline(inputBuffer: Buffer) {
  const resizedPng = await prepareConservativeCenterlineInput(inputBuffer);
  const fallbackBuffer = await prepareBinaryLinework(resizedPng);
  const analysis = await analyzeLineworkCharacteristics(resizedPng);
  const apiKey = getGeminiApiKey();

  if (analysis.isCleanLineArt) {
    console.log(
      `[vectorise-ai] Skipping AI preprocess for clean line art (mean=${analysis.mean.toFixed(
        1,
      )}, midDarkRatio=${analysis.midDarkRatio.toFixed(4)}, darkRatio=${analysis.darkRatio.toFixed(4)})`,
    );
    return {
      vectorizerBuffer: resizedPng,
      previewBase64: resizedPng.toString("base64"),
      aiUsed: false,
      vectorizerOptions: {
        simplification: "low" as const,
        exportMode: "polyline" as const,
        preserveDetail: true,
      },
    };
  }

  const thinnedFallbackBuffer = await thinBinaryLinework(resizedPng);

  if (!apiKey) {
    console.warn("[vectorise-ai] GEMINI_API_KEY missing, using non-AI line cleanup fallback");
    return {
      vectorizerBuffer: fallbackBuffer,
      previewBase64: fallbackBuffer.toString("base64"),
      aiUsed: false,
    };
  }

  const prompt = `Redraw this existing line drawing into centerline-ready source artwork for downstream CAD vectorization.

You are tracing and cleaning the provided line drawing, not inventing a new image.

Mandatory rules:
1. Keep the exact silhouette, pose, proportions, wing shape, tail shape, overlaps, and line placement from the source image.
2. Do not restage, redesign, beautify, simplify into an icon, or change the geometry.
3. Convert every visible stroke into one single thin centered black line.
4. Pure black lines on a pure white background only.
5. No grayscale, transparency, glow, antialiasing, fills, shading, texture, sketch strokes, or soft edges.
6. If a source mark appears as a thick ribbon, outlined stroke, or band with two visible edges, replace it with one medial line only.
7. Never preserve both outer edges of one thick source stroke. No parallel double rails for one mark.
8. Keep the same major contours and internal structure, but express each mark as a single-stroke centerline version.
9. Preserve open versus closed intent, but do not create closed loops only because the original stroke had thickness.
10. Remove accidental roughness, uneven stroke thickness, fuzzy edges, and inconsistent rendering.
11. The result must look like the same drawing cleaned into single-stroke technical linework, not like a new illustration.
12. Do not omit, shorten, or merge source marks. If a mark exists in the input, keep it.
13. Preserve all endpoints, joins, beak/head contours, feather starts, and tail starts exactly where they appear.
14. If uncertain, keep the source mark rather than deleting it.

Important examples:
- Each feather rib should become one stroke, not a pair of edge lines.
- The bird body contour should become one thin path per drawn mark, not a hollow or doubled outline.
- No doubled contours caused by stroke thickness.
- Do not collapse multiple adjacent feathers into one wing mass.
- Do not drop the front of the head, neck line, or small interior marks if they exist in the source.`;

  try {
    const aiBase64 = await callGeminiImageTransform(
      getVectorizePreprocessModel(),
      prompt,
      resizedPng.toString("base64"),
    );
    const cleanedBuffer = await prepareBinaryLinework(Buffer.from(aiBase64, "base64"));
    const mergedBuffer = await mergeBinaryLinework(cleanedBuffer, thinnedFallbackBuffer);

    return {
      vectorizerBuffer: mergedBuffer,
      previewBase64: mergedBuffer.toString("base64"),
      aiUsed: true,
      vectorizerOptions: {
        simplification: "mid" as const,
        exportMode: "hybrid" as const,
        preserveDetail: false,
      },
    };
  } catch (error) {
    console.warn("[vectorise-ai] AI line cleanup failed, falling back to binary cleanup:", error);
    return {
      vectorizerBuffer: fallbackBuffer,
      previewBase64: fallbackBuffer.toString("base64"),
      aiUsed: false,
      vectorizerOptions: {
        simplification: "low" as const,
        exportMode: "polyline" as const,
        preserveDetail: true,
      },
    };
  }
}

// ─── DXF Parsing Helpers ────────────────────────────────────────────────────

interface DxfEntity {
  type: string;
  // LINE
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  // CIRCLE
  cx?: number;
  cy?: number;
  radius?: number;
  // ARC
  startAngle?: number;
  endAngle?: number;
  // POLYLINE / LWPOLYLINE
  vertices?: Array<{ x: number; y: number }>;
  closed?: boolean;
}

/** Safely get a line from the array, returning empty string if out of bounds */
function getLine(lines: string[], idx: number): string {
  return lines[idx] ?? "";
}

/** Read a group code/value pair at index i. Returns the code and value. */
function readPair(lines: string[], i: number): { code: number; value: string } {
  const code = parseInt(getLine(lines, i).trim(), 10);
  const value = getLine(lines, i + 1).trim();
  return { code, value };
}

/**
 * Basic DXF parser that handles LINE, POLYLINE, LWPOLYLINE, CIRCLE, ARC entities.
 * DXF files use group code / value pairs. We parse the ENTITIES section.
 */
function parseDxfEntities(dxfContent: string): DxfEntity[] {
  const entities: DxfEntity[] = [];
  const lines = dxfContent.split(/\r?\n/);

  // Find the ENTITIES section
  let i = 0;
  while (i < lines.length) {
    if (getLine(lines, i).trim() === "ENTITIES") {
      i++;
      break;
    }
    i++;
  }

  if (i >= lines.length) {
    console.log("[dxf-parser] No ENTITIES section found");
    return entities;
  }

  // Parse entities until ENDSEC
  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);

    if (code === 0 && value === "ENDSEC") {
      break;
    }

    if (code === 0) {
      // Start of a new entity
      const entityType = value;

      if (entityType === "LINE") {
        const result = parseLine(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (entityType === "CIRCLE") {
        const result = parseCircle(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (entityType === "ARC") {
        const result = parseArc(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (entityType === "LWPOLYLINE") {
        const result = parseLwPolyline(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else if (entityType === "POLYLINE") {
        const result = parsePolyline(lines, i + 2);
        entities.push(result.entity);
        i = result.nextIndex;
      } else {
        i += 2;
      }
    } else {
      i += 2;
    }
  }

  console.log(`[dxf-parser] Parsed ${entities.length} entities`);
  return entities;
}

function parseLine(
  lines: string[],
  startIdx: number
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = { type: "LINE", x1: 0, y1: 0, x2: 0, y2: 0 };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 10: entity.x1 = parseFloat(value); break;
      case 20: entity.y1 = parseFloat(value); break;
      case 11: entity.x2 = parseFloat(value); break;
      case 21: entity.y2 = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parseCircle(
  lines: string[],
  startIdx: number
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = { type: "CIRCLE", cx: 0, cy: 0, radius: 0 };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 10: entity.cx = parseFloat(value); break;
      case 20: entity.cy = parseFloat(value); break;
      case 40: entity.radius = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parseArc(
  lines: string[],
  startIdx: number
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = {
    type: "ARC",
    cx: 0,
    cy: 0,
    radius: 0,
    startAngle: 0,
    endAngle: 360,
  };
  let i = startIdx;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 10: entity.cx = parseFloat(value); break;
      case 20: entity.cy = parseFloat(value); break;
      case 40: entity.radius = parseFloat(value); break;
      case 50: entity.startAngle = parseFloat(value); break;
      case 51: entity.endAngle = parseFloat(value); break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parseLwPolyline(
  lines: string[],
  startIdx: number
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = {
    type: "LWPOLYLINE",
    vertices: [],
    closed: false,
  };
  let i = startIdx;
  let currentX: number | null = null;

  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    switch (code) {
      case 70: {
        const flags = parseInt(value, 10);
        entity.closed = (flags & 1) === 1;
        break;
      }
      case 10:
        currentX = parseFloat(value);
        break;
      case 20:
        if (currentX !== null) {
          entity.vertices!.push({ x: currentX, y: parseFloat(value) });
          currentX = null;
        }
        break;
    }
    i += 2;
  }

  return { entity, nextIndex: i };
}

function parsePolyline(
  lines: string[],
  startIdx: number
): { entity: DxfEntity; nextIndex: number } {
  const entity: DxfEntity = {
    type: "POLYLINE",
    vertices: [],
    closed: false,
  };
  let i = startIdx;

  // Parse POLYLINE header flags
  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);
    if (code === 0) break;

    if (code === 70) {
      const flags = parseInt(value, 10);
      entity.closed = (flags & 1) === 1;
    }
    i += 2;
  }

  // Parse VERTEX entities until SEQEND
  while (i < lines.length - 1) {
    const { code, value } = readPair(lines, i);

    if (code === 0 && value === "SEQEND") {
      i += 2;
      break;
    }

    if (code === 0 && value === "VERTEX") {
      i += 2;
      let vx = 0;
      let vy = 0;
      while (i < lines.length - 1) {
        const vPair = readPair(lines, i);
        if (vPair.code === 0) break;
        if (vPair.code === 10) vx = parseFloat(vPair.value);
        if (vPair.code === 20) vy = parseFloat(vPair.value);
        i += 2;
      }
      entity.vertices!.push({ x: vx, y: vy });
    } else {
      i += 2;
    }
  }

  return { entity, nextIndex: i };
}

/**
 * Convert parsed DXF entities to SVG string
 */
function entitiesToSvg(entities: DxfEntity[]): string {
  if (entities.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>';
  }

  // Calculate bounding box
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function updateBounds(x: number, y: number) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  for (const e of entities) {
    switch (e.type) {
      case "LINE":
        updateBounds(e.x1 ?? 0, e.y1 ?? 0);
        updateBounds(e.x2 ?? 0, e.y2 ?? 0);
        break;
      case "CIRCLE":
        updateBounds((e.cx ?? 0) - (e.radius ?? 0), (e.cy ?? 0) - (e.radius ?? 0));
        updateBounds((e.cx ?? 0) + (e.radius ?? 0), (e.cy ?? 0) + (e.radius ?? 0));
        break;
      case "ARC":
        updateBounds((e.cx ?? 0) - (e.radius ?? 0), (e.cy ?? 0) - (e.radius ?? 0));
        updateBounds((e.cx ?? 0) + (e.radius ?? 0), (e.cy ?? 0) + (e.radius ?? 0));
        break;
      case "LWPOLYLINE":
      case "POLYLINE":
        for (const v of e.vertices ?? []) {
          updateBounds(v.x, v.y);
        }
        break;
    }
  }

  // Add margin
  const margin = 10;
  const width = maxX - minX || 100;
  const height = maxY - minY || 100;
  const vbX = minX - margin;
  const vbY = minY - margin;
  const vbW = width + margin * 2;
  const vbH = height + margin * 2;

  const svgParts: string[] = [];
  svgParts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vbX} ${vbY} ${vbW} ${vbH}">`
  );
  // DXF Y-axis is flipped relative to SVG, apply transform
  svgParts.push(
    `<g transform="scale(1,-1) translate(0,${-(minY + maxY)})" stroke="black" stroke-width="1" fill="none">`
  );

  for (const e of entities) {
    switch (e.type) {
      case "LINE":
        svgParts.push(
          `<line x1="${e.x1 ?? 0}" y1="${e.y1 ?? 0}" x2="${e.x2 ?? 0}" y2="${e.y2 ?? 0}" />`
        );
        break;

      case "CIRCLE":
        svgParts.push(
          `<circle cx="${e.cx ?? 0}" cy="${e.cy ?? 0}" r="${e.radius ?? 0}" />`
        );
        break;

      case "ARC": {
        const r = e.radius ?? 0;
        const startRad = ((e.startAngle ?? 0) * Math.PI) / 180;
        const endRad = ((e.endAngle ?? 360) * Math.PI) / 180;
        const cx = e.cx ?? 0;
        const cy = e.cy ?? 0;
        const sx = cx + r * Math.cos(startRad);
        const sy = cy + r * Math.sin(startRad);
        const ex = cx + r * Math.cos(endRad);
        const ey = cy + r * Math.sin(endRad);

        // Determine if arc is > 180 degrees
        let sweep = (e.endAngle ?? 360) - (e.startAngle ?? 0);
        if (sweep < 0) sweep += 360;
        const largeArcFlag = sweep > 180 ? 1 : 0;

        svgParts.push(
          `<path d="M ${sx} ${sy} A ${r} ${r} 0 ${largeArcFlag} 1 ${ex} ${ey}" />`
        );
        break;
      }

      case "LWPOLYLINE":
      case "POLYLINE": {
        const verts = e.vertices ?? [];
        if (verts.length >= 2) {
          const points = verts.map((v) => `${v.x},${v.y}`).join(" ");
          if (e.closed) {
            svgParts.push(`<polygon points="${points}" />`);
          } else {
            svgParts.push(`<polyline points="${points}" />`);
          }
        }
        break;
      }
    }
  }

  svgParts.push("</g>");
  svgParts.push("</svg>");

  return svgParts.join("\n");
}

// ─── POST /dxf-to-svg ──────────────────────────────────────────────────────

convertRouter.post("/dxf-to-svg", async (c) => {
  try {
    const rawBody = await c.req.json();
    const parseResult = DxfToSvgRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      console.log("[dxf-to-svg] Validation error:", parseResult.error.issues);
      return c.json(
        { error: { message: "Invalid request body", code: "VALIDATION_ERROR" } },
        400
      );
    }

    const { dxf } = parseResult.data;

    console.log(`[dxf-to-svg] DXF input length: ${dxf.length}`);

    const entities = parseDxfEntities(dxf);
    const svg = entitiesToSvg(entities);

    console.log(`[dxf-to-svg] Generated SVG length: ${svg.length}`);

    const responseData: DxfToSvgResponse = { svg };
    return c.json({ data: responseData });
  } catch (err) {
    console.error("[dxf-to-svg] Error:", err);
    return c.json(
      { error: { message: "Failed to convert DXF to SVG", code: "DXF_TO_SVG_ERROR" } },
      500
    );
  }
});

// ─── POST /compose ──────────────────────────────────────────────────────────

convertRouter.post("/compose", async (c) => {
  try {
    const body = await c.req.parseBody({ all: true });

    console.log("[compose] Received form body keys:", Object.keys(body));

    // Parse images from form data - could be a JSON string of base64 images
    let images: string[] = [];
    const imagesField = body["images"];
    if (typeof imagesField === "string") {
      try {
        images = JSON.parse(imagesField);
      } catch {
        return c.json(
          { error: { message: "images must be a valid JSON array of base64 strings", code: "VALIDATION_ERROR" } },
          400
        );
      }
    } else if (Array.isArray(imagesField)) {
      images = imagesField.filter((v): v is string => typeof v === "string");
    }

    const spacing = parseInt(String(body["spacing"] ?? "0"), 10) || 0;
    const padding = parseInt(String(body["padding"] ?? "0"), 10) || 0;

    // Validate with Zod
    const parseResult = ComposeRequestSchema.safeParse({ images, spacing, padding });
    if (!parseResult.success) {
      console.log("[compose] Validation error:", parseResult.error.issues);
      return c.json(
        { error: { message: "Invalid request: images array is required", code: "VALIDATION_ERROR" } },
        400
      );
    }

    const validated = parseResult.data;

    if (validated.images.length === 0) {
      return c.json(
        { error: { message: "At least one image is required", code: "VALIDATION_ERROR" } },
        400
      );
    }

    console.log(
      `[compose] Composing ${validated.images.length} images, spacing=${validated.spacing}, padding=${validated.padding}`
    );

    // Decode all images and get their dimensions
    const imageBuffers: Buffer[] = [];
    const imageMetas: Array<{ width: number; height: number }> = [];

    for (const imageStr of validated.images) {
      const buf = Buffer.from(imageStr, "base64");
      const meta = await sharp(buf).metadata();
      imageBuffers.push(buf);
      imageMetas.push({
        width: meta.width ?? 0,
        height: meta.height ?? 0,
      });
      console.log(`[compose] Image: ${meta.width}x${meta.height}`);
    }

    // Calculate total canvas size (side-by-side layout)
    const maxHeight = Math.max(...imageMetas.map((m) => m.height));
    const totalWidth =
      validated.padding * 2 +
      imageMetas.reduce((sum, m) => sum + m.width, 0) +
      validated.spacing * (validated.images.length - 1);
    const totalHeight = maxHeight + validated.padding * 2;

    console.log(`[compose] Canvas size: ${totalWidth}x${totalHeight}`);

    // Build composite operations
    const composites: Array<{
      input: Buffer;
      left: number;
      top: number;
    }> = [];

    let xOffset = validated.padding;
    for (let idx = 0; idx < imageBuffers.length; idx++) {
      const meta = imageMetas[idx]!;
      const buf = imageBuffers[idx]!;
      const yOffset =
        validated.padding +
        Math.floor((maxHeight - meta.height) / 2);

      composites.push({
        input: buf,
        left: xOffset,
        top: yOffset,
      });

      xOffset += meta.width + validated.spacing;
    }

    // Create the composed image
    const composedBuffer = await sharp({
      create: {
        width: totalWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(composites)
      .png()
      .toBuffer();

    const composedBase64 = composedBuffer.toString("base64");

    console.log(
      `[compose] Output image: ${totalWidth}x${totalHeight}, base64 length: ${composedBase64.length}`
    );

    const responseData: ComposeResponse = {
      imageBase64: composedBase64,
      width: totalWidth,
      height: totalHeight,
    };

    return c.json({ data: responseData });
  } catch (err) {
    console.error("[compose] Error:", err);
    return c.json(
      { error: { message: "Failed to compose images", code: "COMPOSE_ERROR" } },
      500
    );
  }
});

// ─── POST /vectorise-potrace ─────────────────────────────────────────────────
// Free local vectorisation using potrace (node module, no API cost)

convertRouter.post("/vectorise-potrace", async (c) => {
  try {
    const body = await c.req.parseBody();
    const imageFile = body["image"] ?? body["file"];

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: { message: "No image file provided. Send an 'image' field.", code: "MISSING_FILE" } }, 400);
    }

    console.log(`[potrace] Tracing image: ${imageFile.name}, size: ${imageFile.size}`);

    // Convert incoming image to B&W PNG via sharp then trace with potrace
    const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
    const pngBuffer = await sharp(inputBuffer)
      .flatten({ background: "#ffffff" })
      .greyscale()
      .png()
      .toBuffer();

    const svg = await new Promise<string>((resolve, reject) => {
      potrace.trace(pngBuffer, {
        color: "#000000",
        background: "#ffffff",
        threshold: 128,
        optTolerance: 0.4,
        turdSize: 2,
        turnPolicy: "minority" as const,
      }, (err: Error | null, svg: string) => {
        if (err) reject(err);
        else resolve(svg);
      });
    });

    console.log(`[potrace] Done, svg length: ${svg.length}`);
    c.header("Content-Type", "image/svg+xml");
    return c.body(svg);
  } catch (err) {
    console.error("[potrace] Error:", err);
    return c.json({ error: { message: "Potrace vectorisation failed", code: "POTRACE_ERROR" } }, 500);
  }
});

// ─── POST /vectorise-vtracer ─────────────────────────────────────────────────
// Free local vectorisation using vtracer (high quality, no API cost)

convertRouter.post("/vectorise-vtracer", async (c) => {
  let tmpIn: string | null = null;
  let tmpOut: string | null = null;
  try {
    const body = await c.req.parseBody();
    const imageFile = body["image"] ?? body["file"];

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: { message: "No image file provided. Send an 'image' field.", code: "MISSING_FILE" } }, 400);
    }

    console.log(`[vtracer] Tracing image: ${imageFile.name}, size: ${imageFile.size}`);

    // Write input PNG to temp file (vtracer works on file paths)
    const tmpDir = os.tmpdir();
    tmpIn = path.join(tmpDir, `vtracer-in-${Date.now()}.png`);
    tmpOut = path.join(tmpDir, `vtracer-out-${Date.now()}.svg`);

    const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
    // Normalize to B&W PNG first
    const pngBuffer = await sharp(inputBuffer)
      .flatten({ background: "#ffffff" })
      .greyscale()
      .png()
      .toBuffer();

    await fs.writeFile(tmpIn, pngBuffer);

    // Run vtracer
    vtracer.convertImageToSvg({
      inputPath: tmpIn,
      outputPath: tmpOut,
      colormode: "binary",       // black and white
      hierarchical: "stacked",
      mode: "spline",
      filterSpeckle: 4,
      colorPrecision: 6,
      layerDifference: 16,
      cornerThreshold: 60,
      lengthThreshold: 4.0,
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 3,
    });

    const svg = await fs.readFile(tmpOut, "utf8");
    console.log(`[vtracer] Done, svg length: ${svg.length}`);

    c.header("Content-Type", "image/svg+xml");
    return c.body(svg);
  } catch (err) {
    console.error("[vtracer] Error:", err);
    return c.json({ error: { message: "VTracer vectorisation failed", code: "VTRACER_ERROR" } }, 500);
  } finally {
    // Clean up temp files
    if (tmpIn) fs.unlink(tmpIn).catch(() => {});
    if (tmpOut) fs.unlink(tmpOut).catch(() => {});
  }
});

// ─── SVG to DXF Converter ────────────────────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

/** Tokenise an SVG path `d` attribute into command tokens */
function tokenisePath(d: string): string[] {
  // Insert spaces around command letters, then split
  return d
    .replace(/([MmLlHhVvCcSsQqTtAaZz])/g, " $1 ")
    .trim()
    .split(/[\s,]+/)
    .filter((t) => t.length > 0);
}

/** Parse a number from the token list at position i */
function parseNum(tokens: string[], i: number): number {
  return parseFloat(tokens[i] ?? "0");
}

/**
 * Flatten a single SVG `d` attribute into an array of line segments [{x1,y1,x2,y2}].
 * Handles M, L, H, V, Z, C (cubic bezier), Q (quadratic bezier) — both abs and rel.
 */
function flattenPathToSegments(d: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  const tokens = tokenisePath(d);

  let cx = 0; // current x
  let cy = 0; // current y
  let subpathStartX = 0;
  let subpathStartY = 0;
  let i = 0;

  /** Emit a line segment */
  function line(x1: number, y1: number, x2: number, y2: number) {
    if (Math.abs(x2 - x1) > 1e-6 || Math.abs(y2 - y1) > 1e-6) {
      segments.push({ x1, y1, x2, y2 });
    }
  }

  /** Approximate cubic bezier with N line segments */
  function cubicBezier(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    n = 12
  ) {
    let px = x0;
    let py = y0;
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const mt = 1 - t;
      const qx = mt * mt * mt * x0 + 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t * x3;
      const qy = mt * mt * mt * y0 + 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t * y3;
      line(px, py, qx, qy);
      px = qx;
      py = qy;
    }
  }

  /** Approximate quadratic bezier with N line segments */
  function quadBezier(
    x0: number, y0: number,
    x1: number, y1: number,
    x2: number, y2: number,
    n = 8
  ) {
    let px = x0;
    let py = y0;
    for (let s = 1; s <= n; s++) {
      const t = s / n;
      const mt = 1 - t;
      const qx = mt * mt * x0 + 2 * mt * t * x1 + t * t * x2;
      const qy = mt * mt * y0 + 2 * mt * t * y1 + t * t * y2;
      line(px, py, qx, qy);
      px = qx;
      py = qy;
    }
  }

  while (i < tokens.length) {
    const cmd = tokens[i];
    if (!cmd || !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(cmd)) {
      i++;
      continue;
    }
    i++;

    switch (cmd) {
      // Moveto
      case "M":
        cx = parseNum(tokens, i); cy = parseNum(tokens, i + 1); i += 2;
        subpathStartX = cx; subpathStartY = cy;
        // Subsequent coordinate pairs are implicit L
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = parseNum(tokens, i); const ny = parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;
      case "m":
        cx += parseNum(tokens, i); cy += parseNum(tokens, i + 1); i += 2;
        subpathStartX = cx; subpathStartY = cy;
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = cx + parseNum(tokens, i); const ny = cy + parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;

      // Lineto
      case "L":
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = parseNum(tokens, i); const ny = parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;
      case "l":
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = cx + parseNum(tokens, i); const ny = cy + parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;

      // Horizontal lineto
      case "H":
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = parseNum(tokens, i); i++;
          line(cx, cy, nx, cy); cx = nx;
        }
        break;
      case "h":
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = cx + parseNum(tokens, i); i++;
          line(cx, cy, nx, cy); cx = nx;
        }
        break;

      // Vertical lineto
      case "V":
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const ny = parseNum(tokens, i); i++;
          line(cx, cy, cx, ny); cy = ny;
        }
        break;
      case "v":
        while (i < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const ny = cy + parseNum(tokens, i); i++;
          line(cx, cy, cx, ny); cy = ny;
        }
        break;

      // Cubic bezier
      case "C":
        while (i + 5 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const x1 = parseNum(tokens, i); const y1 = parseNum(tokens, i + 1);
          const x2 = parseNum(tokens, i + 2); const y2 = parseNum(tokens, i + 3);
          const x3 = parseNum(tokens, i + 4); const y3 = parseNum(tokens, i + 5);
          i += 6;
          cubicBezier(cx, cy, x1, y1, x2, y2, x3, y3);
          cx = x3; cy = y3;
        }
        break;
      case "c":
        while (i + 5 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const x1 = cx + parseNum(tokens, i); const y1 = cy + parseNum(tokens, i + 1);
          const x2 = cx + parseNum(tokens, i + 2); const y2 = cy + parseNum(tokens, i + 3);
          const x3 = cx + parseNum(tokens, i + 4); const y3 = cy + parseNum(tokens, i + 5);
          i += 6;
          cubicBezier(cx, cy, x1, y1, x2, y2, x3, y3);
          cx = x3; cy = y3;
        }
        break;

      // Smooth cubic bezier — treat control point as reflection, approximate
      case "S":
        while (i + 3 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const x2 = parseNum(tokens, i); const y2 = parseNum(tokens, i + 1);
          const x3 = parseNum(tokens, i + 2); const y3 = parseNum(tokens, i + 3);
          i += 4;
          // Reflect last control point (use cx,cy as both control points for simplicity)
          cubicBezier(cx, cy, cx, cy, x2, y2, x3, y3);
          cx = x3; cy = y3;
        }
        break;
      case "s":
        while (i + 3 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const x2 = cx + parseNum(tokens, i); const y2 = cy + parseNum(tokens, i + 1);
          const x3 = cx + parseNum(tokens, i + 2); const y3 = cy + parseNum(tokens, i + 3);
          i += 4;
          cubicBezier(cx, cy, cx, cy, x2, y2, x3, y3);
          cx = x3; cy = y3;
        }
        break;

      // Quadratic bezier
      case "Q":
        while (i + 3 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const x1 = parseNum(tokens, i); const y1 = parseNum(tokens, i + 1);
          const x2 = parseNum(tokens, i + 2); const y2 = parseNum(tokens, i + 3);
          i += 4;
          quadBezier(cx, cy, x1, y1, x2, y2);
          cx = x2; cy = y2;
        }
        break;
      case "q":
        while (i + 3 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const x1 = cx + parseNum(tokens, i); const y1 = cy + parseNum(tokens, i + 1);
          const x2 = cx + parseNum(tokens, i + 2); const y2 = cy + parseNum(tokens, i + 3);
          i += 4;
          quadBezier(cx, cy, x1, y1, x2, y2);
          cx = x2; cy = y2;
        }
        break;

      // Smooth quadratic bezier — approximate as straight line
      case "T":
        while (i + 1 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = parseNum(tokens, i); const ny = parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;
      case "t":
        while (i + 1 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          const nx = cx + parseNum(tokens, i); const ny = cy + parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;

      // Elliptical arc — approximate with straight line to endpoint
      case "A":
        while (i + 6 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          i += 5; // skip rx, ry, x-rotation, large-arc-flag, sweep-flag
          const nx = parseNum(tokens, i); const ny = parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;
      case "a":
        while (i + 6 < tokens.length && !/^[MmLlHhVvCcSsQqTtAaZz]$/.test(tokens[i] ?? "")) {
          i += 5;
          const nx = cx + parseNum(tokens, i); const ny = cy + parseNum(tokens, i + 1); i += 2;
          line(cx, cy, nx, ny); cx = nx; cy = ny;
        }
        break;

      // Close path
      case "Z":
      case "z":
        line(cx, cy, subpathStartX, subpathStartY);
        cx = subpathStartX;
        cy = subpathStartY;
        break;
    }
  }

  return segments;
}

/**
 * Parse SVG `<line>`, `<polyline>`, `<polygon>` and `<path>` elements from SVG text,
 * handling an optional transform="translate(tx,ty) scale(sx,sy)" on the root <g>.
 * Returns all segments as {x1,y1,x2,y2}.
 */
function parseSvgToSegments(svgContent: string): Array<{ x1: number; y1: number; x2: number; y2: number }> {
  const allSegments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];

  // Detect a global <g transform="translate(tx,ty) scale(sx,sy)"> for Y-axis flip
  let translateX = 0;
  let translateY = 0;
  let scaleX = 1;
  let scaleY = 1;

  const gTransformMatch = svgContent.match(/<g[^>]+transform="([^"]+)"/);
  if (gTransformMatch) {
    const tfm = gTransformMatch[1] ?? "";
    const translateMatch = tfm.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)\s*\)/);
    if (translateMatch) {
      translateX = parseFloat(translateMatch[1] ?? "0");
      translateY = parseFloat(translateMatch[2] ?? "0");
    }
    const scaleMatch = tfm.match(/scale\(\s*([-\d.]+)(?:[,\s]+([-\d.]+))?\s*\)/);
    if (scaleMatch) {
      scaleX = parseFloat(scaleMatch[1] ?? "1");
      scaleY = scaleMatch[2] !== undefined ? parseFloat(scaleMatch[2]) : scaleX;
    }
  }

  function applyTransform(x: number, y: number): Point {
    return { x: scaleX * x + translateX, y: scaleY * y + translateY };
  }

  // Extract all path d attributes
  const pathRegex = /<path[^>]+d="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = pathRegex.exec(svgContent)) !== null) {
    const segs = flattenPathToSegments(m[1] ?? "");
    for (const s of segs) {
      const p1 = applyTransform(s.x1, s.y1);
      const p2 = applyTransform(s.x2, s.y2);
      allSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }

  // Extract <line> elements
  const lineRegex = /<line[^>]*>/g;
  while ((m = lineRegex.exec(svgContent)) !== null) {
    const tag = m[0];
    const x1m = tag.match(/\bx1="([-\d.]+)"/); const y1m = tag.match(/\by1="([-\d.]+)"/);
    const x2m = tag.match(/\bx2="([-\d.]+)"/); const y2m = tag.match(/\by2="([-\d.]+)"/);
    if (x1m && y1m && x2m && y2m) {
      const p1 = applyTransform(parseFloat(x1m[1] ?? "0"), parseFloat(y1m[1] ?? "0"));
      const p2 = applyTransform(parseFloat(x2m[1] ?? "0"), parseFloat(y2m[1] ?? "0"));
      allSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }

  // Extract <polyline> and <polygon> elements
  const polyRegex = /<poly(?:line|gon)[^>]+points="([^"]+)"/g;
  while ((m = polyRegex.exec(svgContent)) !== null) {
    const pointsStr = m[1] ?? "";
    const nums = pointsStr.trim().split(/[\s,]+/).map(Number).filter((n) => !isNaN(n));
    for (let j = 0; j + 3 < nums.length; j += 2) {
      const p1 = applyTransform(nums[j] ?? 0, nums[j + 1] ?? 0);
      const p2 = applyTransform(nums[j + 2] ?? 0, nums[j + 3] ?? 0);
      allSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
    // Close polygon
    if (svgContent.slice(m.index, m.index + 8).includes("polygon") && nums.length >= 4) {
      const p1 = applyTransform(nums[nums.length - 2] ?? 0, nums[nums.length - 1] ?? 0);
      const p2 = applyTransform(nums[0] ?? 0, nums[1] ?? 0);
      allSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
    }
  }

  return allSegments;
}

/**
 * Convert an SVG string to a minimal valid DXF string.
 * Parses path/line/polyline/polygon elements and writes LINE entities.
 */
function svgToDxf(svgContent: string): string {
  const segments = parseSvgToSegments(svgContent);
  console.log(`[svg-to-dxf] Parsed ${segments.length} line segments from SVG`);

  // SVG Y-axis points down, DXF Y-axis points up — negate all Y values
  const lines: string[] = [];

  // DXF header
  lines.push("0", "SECTION", "2", "HEADER", "0", "ENDSEC");
  lines.push("0", "SECTION", "2", "ENTITIES");

  for (const seg of segments) {
    lines.push(
      "0", "LINE",
      "8", "0",        // layer 0
      "10", seg.x1.toFixed(6),
      "20", (-seg.y1).toFixed(6),
      "30", "0.000000",
      "11", seg.x2.toFixed(6),
      "21", (-seg.y2).toFixed(6),
      "31", "0.000000",
    );
  }

  lines.push("0", "ENDSEC", "0", "EOF");
  return lines.join("\n");
}

// ─── POST /svg-to-dxf ───────────────────────────────────────────────────────
// Free local conversion: takes SVG text and returns DXF text.
// No auth/credit check — no external API involved.

convertRouter.post("/svg-to-dxf", async (c) => {
  try {
    const rawBody = await c.req.json();
    const parseResult = SvgToDxfRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      console.log("[svg-to-dxf] Validation error:", parseResult.error.issues);
      return c.json(
        { error: { message: "Invalid request body", code: "VALIDATION_ERROR" } },
        400
      );
    }

    const { svg } = parseResult.data;
    console.log(`[svg-to-dxf] SVG input length: ${svg.length}`);

    const dxf = svgToDxf(svg);
    console.log(`[svg-to-dxf] Generated DXF length: ${dxf.length}`);

    return c.json({ data: { dxf } });
  } catch (err) {
    console.error("[svg-to-dxf] Error:", err);
    return c.json(
      { error: { message: "Failed to convert SVG to DXF", code: "SVG_TO_DXF_ERROR" } },
      500
    );
  }
});

// ─── POST /vectorise ────────────────────────────────────────────────────────
// Uses local VTracer engine for centerline-quality vectorization.
// No external API call, no credits needed, no double-line issues.

convertRouter.post("/vectorise", async (c) => {
  let tmpIn: string | null = null;
  let tmpOut: string | null = null;
  try {
    // Auth check (no credit deduction — local processing is free)
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const format = c.req.query("format") || "svg";
    console.log(`[vectorise] Local VTracer vectorization, format=${format}`);

    const body = await c.req.parseBody();
    const imageFile = body["image"];

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json(
        { error: { message: "No image file provided. Send an 'image' field.", code: "MISSING_FILE" } },
        400
      );
    }

    console.log(`[vectorise] Image: ${imageFile.name}, size: ${imageFile.size}`);

    // Pre-process to clean B&W
    const rawBuffer = Buffer.from(await imageFile.arrayBuffer());
    const bwBuffer = await sharp(rawBuffer)
      .flatten({ background: "#ffffff" })
      .greyscale()
      .threshold(200)
      .png()
      .toBuffer();

    // Run VTracer (local, free, produces centerline-quality paths)
    const tmpDir = os.tmpdir();
    tmpIn = path.join(tmpDir, `vtracer-v-${Date.now()}.png`);
    tmpOut = path.join(tmpDir, `vtracer-v-${Date.now()}.svg`);
    await fs.writeFile(tmpIn, bwBuffer);

    vtracer.convertImageToSvg({
      inputPath: tmpIn,
      outputPath: tmpOut,
      colormode: "binary",
      hierarchical: "stacked",
      mode: "spline",
      filterSpeckle: 4,
      colorPrecision: 6,
      layerDifference: 16,
      cornerThreshold: 60,
      lengthThreshold: 4.0,
      maxIterations: 10,
      spliceThreshold: 45,
      pathPrecision: 3,
    });

    const svg = await fs.readFile(tmpOut, "utf8");
    console.log(`[vectorise] VTracer SVG output: ${svg.length} chars`);

    if (format === "dxf") {
      const dxfText = svgToDxf(svg);
      console.log(`[vectorise] Converted to DXF: ${dxfText.length} chars`);
      c.header("Content-Type", "application/dxf");
      c.header("Content-Disposition", 'attachment; filename="output.dxf"');
      return c.body(dxfText);
    }

    c.header("Content-Type", "image/svg+xml");
    return c.body(svg);
  } catch (err) {
    console.error("[vectorise] Error:", err);
    return c.json(
      { error: { message: "Failed to vectorise image", code: "VECTORISE_ERROR" } },
      500
    );
  } finally {
    if (tmpIn) fs.unlink(tmpIn).catch(() => {});
    if (tmpOut) fs.unlink(tmpOut).catch(() => {});
  }
});

// ─── POST /vectorise-all ─────────────────────────────────────────────────────
// Run all three engines in parallel, return SVG from each.
// Used for side-by-side quality comparison on the Result page.

convertRouter.post("/vectorise-all", async (c) => {
  try {
    // Auth + credit check
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { credits: true, isAdmin: true },
    });

    if (!dbUser?.isAdmin && (dbUser?.credits ?? 0) <= 0) {
      return c.json({ error: { message: "No credits remaining. Please purchase more credits.", code: "NO_CREDITS" } }, 402);
    }

    // Deduct credit BEFORE calling API (admins skip deduction)
    if (!dbUser?.isAdmin) {
      await prisma.user.update({
        where: { id: user.id },
        data: { credits: { decrement: 1 } },
      });
    }

    const body = await c.req.parseBody();
    const imageFile = body["image"] ?? body["file"];

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: { message: "No image file provided.", code: "MISSING_FILE" } }, 400);
    }

    console.log(`[vectorise-all] Processing ${imageFile.name}, size: ${imageFile.size}`);

    // Pre-process to thinned B&W PNG — erode strokes to ~1px to avoid double-line tracing
    const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
    const thresholdedBuffer = await sharp(inputBuffer)
      .flatten({ background: "#ffffff" })
      .greyscale()
      .threshold(200)
      .png()
      .toBuffer();
    const bwPngBuffer = await sharp(thresholdedBuffer)
      .blur(1.5)
      .threshold(240)
      .png()
      .toBuffer();
    const bwPngFile = new File([bwPngBuffer], "image.png", { type: "image/png" });

    // Run all three in parallel
    const results = await Promise.allSettled([
      // VTracer
      (async () => {
        let tmpIn: string | null = null;
        let tmpOut: string | null = null;
        try {
          tmpIn = path.join(os.tmpdir(), `vtracer-all-in-${Date.now()}.png`);
          tmpOut = path.join(os.tmpdir(), `vtracer-all-out-${Date.now()}.svg`);
          await fs.writeFile(tmpIn, bwPngBuffer);
          vtracer.convertImageToSvg({
            inputPath: tmpIn,
            outputPath: tmpOut,
            colormode: "binary",
            hierarchical: "stacked",
            mode: "spline",
            filterSpeckle: 4,
            colorPrecision: 6,
            layerDifference: 16,
            cornerThreshold: 60,
            lengthThreshold: 4.0,
            maxIterations: 10,
            spliceThreshold: 45,
            pathPrecision: 3,
          });
          return await fs.readFile(tmpOut, "utf8");
        } finally {
          if (tmpIn) fs.unlink(tmpIn).catch(() => {});
          if (tmpOut) fs.unlink(tmpOut).catch(() => {});
        }
      })(),

      // Potrace
      new Promise<string>((resolve, reject) => {
        potrace.trace(bwPngBuffer, {
          color: "#000000",
          background: "#ffffff",
          threshold: 128,
          optTolerance: 0.4,
          turdSize: 2,
          turnPolicy: "minority" as const,
        }, (err: Error | null, svg: string) => {
          if (err) reject(err); else resolve(svg);
        });
      }),

      // Vectoriser.AI (only if credentials available, returns SVG directly)
      (async () => {
        const apiId = process.env.VECTORISER_AI_API_ID;
        const apiSecret = process.env.VECTORISER_AI_API_SECRET;
        if (!apiId || !apiSecret) throw new Error("Vectoriser.AI not configured");

        const formData = new FormData();
        formData.append("image", bwPngFile);
        formData.append("output.file_format", "svg");
        formData.append("output.group_by", "none");
        formData.append("output.draw_style", "stroke_edges");
        formData.append("output.stroke_width", "1.0");
        formData.append("processing.max_colors", "2");
        formData.append("processing.palette", "#000000 ~ 0.5; #ffffff ~ 0.5;");
        formData.append("output.stroke_color", "000000");
        formData.append("output.background_color", "ffffff");

        const authString = Buffer.from(`${apiId}:${apiSecret}`).toString("base64");
        const response = await fetch("https://api.vectorizer.ai/api/v1/vectorize", {
          method: "POST",
          headers: { Authorization: `Basic ${authString}` },
          body: formData,
        });
        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Vectorizer.AI error: ${errText}`);
        }
        return response.text();
      })(),
    ]);

    const [vtracerResult, potraceResult, vectoriserResult] = results;

    console.log(`[vectorise-all] vtracer: ${vtracerResult.status}, potrace: ${potraceResult.status}, vectoriser: ${vectoriserResult.status}`);

    return c.json({
      data: {
        vtracer: vtracerResult.status === "fulfilled" ? vtracerResult.value : null,
        potrace: potraceResult.status === "fulfilled" ? potraceResult.value : null,
        vectoriser: vectoriserResult.status === "fulfilled" ? vectoriserResult.value : null,
        errors: {
          vtracer: vtracerResult.status === "rejected" ? String(vtracerResult.reason) : null,
          potrace: potraceResult.status === "rejected" ? String(potraceResult.reason) : null,
          vectoriser: vectoriserResult.status === "rejected" ? String(vectoriserResult.reason) : null,
        },
      },
    });
  } catch (err) {
    console.error("[vectorise-all] Error:", err);
    return c.json({ error: { message: "Failed to run engine comparison", code: "COMPARE_ERROR" } }, 500);
  }
});

// ─── POST /vectorise-ai ──────────────────────────────────────────────────────
// Production DXF path backed by the raster-dxf-centerline service.

convertRouter.post("/vectorise-outline", async (c) => {
  const user = c.get("user");
  let reservedUserId: string | null = null;
  let reservedMode: "admin" | "credit" | "free_trial" | null = null;
  let trialConsumed = false;
  let reservedDeviceHash: string | undefined;

  try {
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const body = await c.req.parseBody();
    const imageFile = (body["image"] ?? body["file"]) as File | undefined;

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: { message: "No image file provided.", code: "MISSING_FILE" } }, 400);
    }

    const deviceToken = getOrCreateTrialDeviceToken(c);
    const deviceHash = hashTrialDeviceToken(deviceToken);
    const reservation = await reserveProcessAccess(user.id, "vectorize", deviceHash);
    if (!reservation.allowed) {
      return c.json({ error: reservation.error }, reservation.status as 401 | 402 | 403 | 500);
    }

    reservedUserId = user.id;
    reservedMode = reservation.mode;
    trialConsumed = reservation.trialConsumed;
    reservedDeviceHash = deviceHash;

    console.log(`[vectorise-outline] Processing ${imageFile.name}, size: ${imageFile.size}`);

    const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
    const outlined = await traceOutlineSvgFromBuffer(inputBuffer, DEFAULT_OUTLINE_SETTINGS);
    const dxf = convertSvgToDxfString(outlined.svg);

    console.log(`[vectorise-outline] Success, SVG length: ${outlined.svg.length}, DXF length: ${dxf.length}`);
    return c.json({
      data: {
        svg: outlined.svg,
        dxf,
        previewBase64: outlined.previewBase64,
        trialConsumed,
      },
    });
  } catch (err) {
    if (reservedUserId && reservedMode) {
      try {
        await releaseProcessAccess(reservedUserId, reservedMode, reservedDeviceHash);
      } catch (releaseErr) {
        console.error("[vectorise-outline] Failed to release reserved access:", releaseErr);
      }
    }

    console.error("[vectorise-outline] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to vectorise image";
    return c.json(
      { error: { message, code: "VECTORISE_OUTLINE_ERROR" } },
      500
    );
  }
});

convertRouter.post("/vectorise-ai", async (c) => {
  const user = c.get("user");
  let reservedUserId: string | null = null;
  let reservedMode: "admin" | "credit" | "free_trial" | null = null;
  let trialConsumed = false;
  let reservedDeviceHash: string | undefined;

  try {
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const body = await c.req.parseBody();
    const imageFile = (body["image"] ?? body["file"]) as File | undefined;
    const rawSimplification = body["simplification"];
    const simplification = simplificationLevels.includes(
      rawSimplification as SimplificationLevel,
    )
      ? (rawSimplification as SimplificationLevel)
      : "mid";

    if (!imageFile || !(imageFile instanceof File)) {
      return c.json({ error: { message: "No image file provided.", code: "MISSING_FILE" } }, 400);
    }

    const deviceToken = getOrCreateTrialDeviceToken(c);
    const deviceHash = hashTrialDeviceToken(deviceToken);
    const reservation = await reserveProcessAccess(user.id, "vectorize", deviceHash);
    if (!reservation.allowed) {
      return c.json({ error: reservation.error }, reservation.status as 401 | 402 | 403 | 500);
    }

    reservedUserId = user.id;
    reservedMode = reservation.mode;
    trialConsumed = reservation.trialConsumed;
    reservedDeviceHash = deviceHash;

    console.log(
      `[vectorise-ai] Processing ${imageFile.name}, size: ${imageFile.size} using centerline vectorizer service (${simplification})`
    );

    const inputBuffer = Buffer.from(await imageFile.arrayBuffer());
    const preprocessed = await preprocessLineworkForCenterline(inputBuffer);
    console.log(
      `[vectorise-ai] Line cleanup path: ${preprocessed.aiUsed ? "ai_preprocess" : "binary_fallback"}`
    );

    // Call centerline vectorizer service (raster-dxf-centerline)
    const result = await vectorizeCenterline(preprocessed.vectorizerBuffer, {
      simplification: preprocessed.vectorizerOptions?.simplification ?? simplification,
      exportMode: preprocessed.vectorizerOptions?.exportMode,
      preserveDetail: preprocessed.vectorizerOptions?.preserveDetail,
    });

    console.log(`[vectorise-ai] Success, DXF length: ${result.dxf.length}`);
    return c.json({
      data: {
        dxf: result.dxf,
        preprocessedImageBase64: preprocessed.previewBase64,
        trialConsumed,
      },
    });
  } catch (err) {
    if (reservedUserId && reservedMode) {
      try {
        await releaseProcessAccess(reservedUserId, reservedMode, reservedDeviceHash);
      } catch (releaseErr) {
        console.error("[vectorise-ai] Failed to release reserved access:", releaseErr);
      }
    }

    console.error("[vectorise-ai] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to vectorise image";
    return c.json(
      { error: { message, code: "VECTORISE_AI_ERROR" } },
      500
    );
  }
});

export { convertRouter };
