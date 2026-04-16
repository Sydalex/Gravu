import sharp from "sharp";
import { env } from "../env";
import {
  vectorizeCenterline,
  type CenterlineExportMode,
  type SimplificationLevel,
} from "./centerlineVectorizer";

const CENTERLINE_PREPROCESS_MAX_DIMENSION = 2048;

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

type CenterlinePreprocessResult = {
  vectorizerBuffer: Buffer;
  previewBase64: string;
  aiUsed: boolean;
  vectorizerOptions?: {
    simplification?: SimplificationLevel;
    exportMode?: CenterlineExportMode;
    preserveDetail?: boolean;
  };
};

export type CenterlineLineworkResult = {
  dxf: string;
  preprocessedImageBase64: string;
  aiUsed: boolean;
};

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
    .resize(CENTERLINE_PREPROCESS_MAX_DIMENSION, CENTERLINE_PREPROCESS_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
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
    .resize(CENTERLINE_PREPROCESS_MAX_DIMENSION, CENTERLINE_PREPROCESS_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .grayscale()
    .png()
    .toBuffer();
}

async function thinBinaryLinework(inputBuffer: Buffer) {
  return sharp(inputBuffer)
    .flatten({ background: "#ffffff" })
    .resize(CENTERLINE_PREPROCESS_MAX_DIMENSION, CENTERLINE_PREPROCESS_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
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
    // Already-clean line art: very bright background with sparse stroke pixels.
    // Gemini preprocessing is too destructive for this case.
    isCleanLineArt: mean > 248 && midDarkRatio < 0.08 && darkRatio < 0.05,
  };
}

export async function preprocessLineworkForCenterline(
  inputBuffer: Buffer,
  logPrefix = "centerline-linework",
): Promise<CenterlinePreprocessResult> {
  const resizedPng = await prepareConservativeCenterlineInput(inputBuffer);
  const fallbackBuffer = await prepareBinaryLinework(resizedPng);
  const analysis = await analyzeLineworkCharacteristics(resizedPng);
  const apiKey = getGeminiApiKey();

  if (analysis.isCleanLineArt) {
    console.log(
      `[${logPrefix}] Skipping AI preprocess for clean line art (mean=${analysis.mean.toFixed(
        1,
      )}, midDarkRatio=${analysis.midDarkRatio.toFixed(4)}, darkRatio=${analysis.darkRatio.toFixed(4)})`,
    );
    return {
      vectorizerBuffer: resizedPng,
      previewBase64: resizedPng.toString("base64"),
      aiUsed: false,
      vectorizerOptions: {
        simplification: "low",
        exportMode: "polyline",
        preserveDetail: true,
      },
    };
  }

  const thinnedFallbackBuffer = await thinBinaryLinework(resizedPng);

  if (!apiKey) {
    console.warn(`[${logPrefix}] GEMINI_API_KEY missing, using non-AI line cleanup fallback`);
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
        simplification: "mid",
        exportMode: "hybrid",
        preserveDetail: false,
      },
    };
  } catch (error) {
    console.warn(`[${logPrefix}] AI line cleanup failed, falling back to binary cleanup:`, error);
    return {
      vectorizerBuffer: fallbackBuffer,
      previewBase64: fallbackBuffer.toString("base64"),
      aiUsed: false,
      vectorizerOptions: {
        simplification: "low",
        exportMode: "polyline",
        preserveDetail: true,
      },
    };
  }
}

export async function vectorizeLineworkWithCenterline(
  inputBuffer: Buffer,
  options: {
    simplification?: SimplificationLevel;
    logPrefix?: string;
  } = {},
): Promise<CenterlineLineworkResult> {
  const preprocessed = await preprocessLineworkForCenterline(
    inputBuffer,
    options.logPrefix,
  );

  console.log(
    `[${options.logPrefix ?? "centerline-linework"}] Line cleanup path: ${
      preprocessed.aiUsed ? "ai_preprocess" : "binary_fallback"
    }`,
  );

  const result = await vectorizeCenterline(preprocessed.vectorizerBuffer, {
    simplification: preprocessed.vectorizerOptions?.simplification ?? options.simplification ?? "mid",
    exportMode: preprocessed.vectorizerOptions?.exportMode,
    preserveDetail: preprocessed.vectorizerOptions?.preserveDetail,
  });

  return {
    dxf: result.dxf,
    preprocessedImageBase64: preprocessed.previewBase64,
    aiUsed: preprocessed.aiUsed,
  };
}
