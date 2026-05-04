import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import sharp from "sharp";
import {
  VectorizeRequestSchema,
  ExportDxfRequestSchema,
  type UploadResponse,
  type VectorizeResponse,
} from "../types";
import type { auth } from "../auth";
import {
  convertSvgToDxfString,
  traceOutlineSvgFromBuffer,
} from "../services/outlineVectorizer";
import {
  MAX_IMAGE_PIXELS,
  assertSafeImageBuffer,
  assertSupportedImageFile,
} from "../services/uploadSecurity";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const traceRouter = new Hono<{ Variables: Variables }>();

traceRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }
  await next();
});

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
    assertSupportedImageFile(file);

    console.log(`[upload] Received file: ${file.name}, size: ${file.size}, type: ${file.type}`);

    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);
    const metadata = await assertSafeImageBuffer(inputBuffer);

    // Process with Sharp: resize to max 2048px on longest side, convert to PNG
    const image = sharp(inputBuffer, { failOn: "none", limitInputPixels: MAX_IMAGE_PIXELS });

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
      await assertSafeImageBuffer(imageBuffer);
      const { svg, width, height } = await traceOutlineSvgFromBuffer(imageBuffer, settings);

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

      const dxfString = convertSvgToDxfString(svg);

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

export { traceRouter };
