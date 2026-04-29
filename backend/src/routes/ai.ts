import { Hono } from "hono";
import sharp from "sharp";
import type { auth } from "../auth";
import { env } from "../env";
import {
  DetectSubjectsRequestSchema,
  GenerateLineworkRequestSchema,
  type Subject,
  type OutputMode,
  type DetailLevel,
  type DetectSubjectsResponse,
  type GenerateLineworkResponse,
  type LineworkResult,
} from "../types";
import { releaseProcessAccess, reserveProcessAccess } from "../services/processAccess";
import {
  getOrCreateTrialDeviceToken,
  hashTrialDeviceToken,
} from "../services/trialDevice";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

const aiRouter = new Hono<{ Variables: Variables }>();

// ─── Gemini API helpers ─────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  // snake_case used in requests; camelCase returned in responses
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
  role?: string;
}

interface GeminiCandidate {
  content: GeminiContent;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message: string; code: number };
}

function getApiKey(): string | null {
  return env.GEMINI_API_KEY ?? null;
}

function getImageGenerationModel(): string {
  return env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3-pro-image-preview";
}

const LINEWORK_INPUT_MAX_DIMENSION = 1536;
const LINEWORK_OUTPUT_MAX_DIMENSION = 2048;
const LINEWORK_INK_LUMA_THRESHOLD = 170;
const LINEWORK_COLOR_CHROMA_TOLERANCE = 55;
const LINEWORK_DARK_INK_LUMA_THRESHOLD = 55;

async function prepareImageForLineworkGeneration(imageBase64: string): Promise<{
  base64: string;
  mimeType: "image/jpeg";
  inputBytes: number;
  outputBytes: number;
  width: number;
  height: number;
}> {
  const inputBuffer = Buffer.from(imageBase64, "base64");
  const { data, info } = await sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize(LINEWORK_INPUT_MAX_DIMENSION, LINEWORK_INPUT_MAX_DIMENSION, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    base64: data.toString("base64"),
    mimeType: "image/jpeg",
    inputBytes: inputBuffer.length,
    outputBytes: data.length,
    width: info.width,
    height: info.height,
  };
}

async function finalizeGeneratedLinework(imageBase64: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, "base64");
  const { data, info } = await sharp(buffer, { failOn: "none" })
    .flatten({ background: "#ffffff" })
    .resize(LINEWORK_OUTPUT_MAX_DIMENSION, LINEWORK_OUTPUT_MAX_DIMENSION, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const cleaned = Buffer.allocUnsafe(data.length);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 255;
    const g = data[i + 1] ?? 255;
    const b = data[i + 2] ?? 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    const isNeutralInk =
      luma < LINEWORK_INK_LUMA_THRESHOLD && chroma < LINEWORK_COLOR_CHROMA_TOLERANCE;
    const isVeryDarkInk = luma < LINEWORK_DARK_INK_LUMA_THRESHOLD;
    const value = isNeutralInk || isVeryDarkInk ? 0 : 255;

    cleaned[i] = value;
    cleaned[i + 1] = value;
    cleaned[i + 2] = value;
    cleaned[i + 3] = 255;
  }

  const normalized = await sharp(cleaned, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return normalized.toString("base64");
}

async function callGemini(
  model: string,
  contents: GeminiContent[],
  generationConfig?: Record<string, unknown>,
  apiVersion = "v1beta",
  signal?: AbortSignal
): Promise<GeminiResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

  const body: Record<string, unknown> = { contents };
  if (generationConfig) {
    body.generationConfig = generationConfig;
  }

  console.log(`[gemini] Calling model: ${model}`);
  const startedAt = Date.now();

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[gemini] API error (${response.status}): ${errorText}`);
    throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  console.log(`[gemini] Model ${model} completed in ${Date.now() - startedAt}ms`);

  if (data.error) {
    console.error(`[gemini] Response error: ${data.error.message}`);
    throw new Error(`Gemini API error: ${data.error.message}`);
  }

  return data;
}

// ─── Prompt builder helpers ────────────────────────────────────────────────

// Prompt profile IDs make prompt iterations traceable in logs and easy to
// compare against Desktop snapshots or revert by commit if output quality drops.
const PROMPT_PROFILE_IDS = {
  illustration: "illustration-source-locked-bw-v8",
  vectorworksCenterline: "vectorworks-centerline-source-locked-bw-v9",
} as const;

const PEOPLE_SCENE_TERMS = [
  "person",
  "people",
  "human",
  "man",
  "men",
  "woman",
  "women",
  "child",
  "children",
  "rider",
  "riders",
  "pedestrian",
  "pedestrians",
  "figure",
  "figures",
  "group",
  "crowd",
];

function getPromptProfileId(outputMode: OutputMode): string {
  return outputMode === "vectorworks_centerline"
    ? PROMPT_PROFILE_IDS.vectorworksCenterline
    : PROMPT_PROFILE_IDS.illustration;
}

function isPeopleSceneDescription(description: string): boolean {
  const lower = description.toLowerCase();
  return PEOPLE_SCENE_TERMS.some((term) => new RegExp(`\\b${term}\\b`, "i").test(lower));
}

function isLikelyPeopleGroup(descriptions: string[]): boolean {
  const peopleDescriptions = descriptions.filter(isPeopleSceneDescription);
  return (
    peopleDescriptions.length >= 2 ||
    descriptions.some((description) => /\b(group|crowd|people|men|women|children|figures)\b/i.test(description))
  );
}

function buildSourceLockedPeopleGroupBlock(enabled: boolean): string {
  if (!enabled) return "";

  return `

SOURCE-LOCKED PEOPLE/GROUP TRACE MODE (mandatory):
- Treat the source photo as a fixed underlay. This is tracing, not illustration, redesign, or character generation.
- Preserve the exact number of visible people, including partially visible people.
- Preserve each person's original left-to-right order, relative spacing, scale, crop, overlap, and facing direction.
- Preserve each person's observed pose: seated, crouching, standing, leaning, arm angles, hand positions, leg bends, foot positions, head tilt, and torso angle.
- Do not substitute different people, different clothing silhouettes, different body proportions, different head shapes, different ages, or different poses.
- Do not move people closer together, spread them out, rotate them, mirror them, turn profiles into front views, or turn seated figures into standing figures.
- If clothing, limbs, hands, feet, or overlapping bodies are complex, simplify by deleting interior detail only. Never simplify by changing the outer silhouette, pose, placement, or overlap.
- For faces, remove small interior face marks if needed, but keep the observed head outline, face direction, hair/headwear boundary, and profile/back-view contour.
- For fabrics and patterned clothing, remove printed patterns and texture, but keep the garment boundary and major wrap/fold silhouette that defines the pose.
- Output remains only black lines on pure white. No colored fills, no grey fills, no colored accessories, no clothing color regions.`;
}

function buildDetailPromptBlock(detailLevel: DetailLevel): string {
  switch (detailLevel) {
    case "low":
      return `DETAIL LEVEL: LOW
- Aggressively simplify the image before vectorization.
- Keep only silhouette and the most important structural lines.
- Remove optional folds, secondary overlaps, minor accessories, and decorative internal marks.
- Prefer lighter CAD output even if that means omitting subtle visual detail.
- Simplify by deleting interior detail, not by changing subject count, pose, position, scale, or outer silhouette.`;
    case "high":
      return `DETAIL LEVEL: HIGH
- Keep more of the important internal structure while still staying vector-ready.
- Allow a few more meaningful overlaps and interior contours when they improve readability.
- Do not reintroduce texture, sketch detail, or dense clusters of short marks.
- Higher detail may lead to heavier export files, so only keep lines that still feel essential.
- Extra detail must remain source-locked; never add invented anatomy, clothing, object parts, or pose changes.`;
    case "mid":
    default:
      return `DETAIL LEVEL: MEDIUM
- Balance clean vector-ready output with readable internal structure.
- Keep major overlaps and attachment lines, but still remove minor texture and decorative detail.
- For mechanical subjects, keep enough structural detail to identify the object, but remove any ambiguous connector-like interior strokes.
- Prefer simpler linework when uncertain.
- Simplify by deleting interior detail, not by changing subject count, pose, position, scale, or outer silhouette.`;
  }
}

/**
 * Category-aware simplification hints for vectorworks_centerline mode.
 * Returns aggressive guidance tuned for cleaner downstream CAD vectorization.
 */
function getSubjectHints(description: string): string[] {
  const lower = description.toLowerCase();
  const hints: string[] = [];

  const hasAny = (terms: string[]) => terms.some((t) => lower.includes(t));

  if (hasAny(["person", "people", "human", "rider", "riders", "man", "woman", "child", "cyclist", "skier"])) {
    hints.push(
      "People/riders: preserve the observed silhouette, limb contours, hand and shoe positions, and only the main clothing or gear boundaries needed to read the pose; keep only prominent identity-defining face accessories or outlines such as glasses, beard outline, mustache outline, or strong headwear boundaries; omit eyes, pupils, nostrils, lips, teeth, eyebrows, wrinkles, and other interior facial detail unless they are unusually large and structurally obvious in the source; remove shoelaces, stitching, zipper teeth, drawstrings, pocket creases, quilt lines, seam texture, and secondary backpack strap fragments; if a strap, lace, or cord is essential for readability, reduce it to one clean long contour or one simple stroke only; keep the same apparent line thickness for silhouette, hair, face accessories, garment overlaps, straps, and shoe lines."
    );
    hints.push(
      "Groups of people: preserve the exact number of visible people, their left-to-right order, relative spacing, overlaps, seated or standing poses, facing directions, limb angles, head positions, clothing silhouettes, and relative scale; do not remove, duplicate, merge, replace, turn, restage, or reposition any person; simplify each observed person in place instead of inventing a cleaner generic group."
    );
  }

  if (hasAny(["walk", "walking", "pedestrian", "standing", "strolling", "profile", "side view", "entourage"])) {
    hints.push(
      "Entourage / walking figures: treat hair as one outer mass with at most one interior separation line; for side-view, rear-view, or distant walking figures use zero interior face lines unless glasses are large and dominant; simplify coats, jackets, trousers, and sleeves to the silhouette plus at most two major opening or overlap lines total; simplify shoes to the outer contour plus at most one sole line; remove cuff lines, hem lines, seam lines, layered shoe construction, and minor garment folds; keep every remaining contour at the same apparent line thickness with no heavier outer outline and no thinner interior detail; all stroke ends must be blunt and uniform, never tapered, pointed, brush-like, or calligraphic."
    );
  }

  if (hasAny(["chairlift", "mechanical", "assembly", "machine", "vehicle", "engine", "gear", "bicycle", "motorcycle", "car", "truck", "train", "aircraft", "helicopter", "drone", "robot"])) {
    hints.push(
      "Mechanical/vehicle subjects: draw only observed physical edges, panel gaps, windows, wheels, wheel arches, bumpers, bull bars, mirrors, handles, grille bars, and major attachments; remove shadows, reflections, tire tread, sand/ground texture, bolts, fasteners, wires, repeated tiny parts, and dense linkage detail; do not invent diagonal construction lines, connector strokes, support axes, or lines that cross open body areas unless they are clearly visible physical edges in the source; long body, window, bumper, grille, and roof edges should be clean straight segments; wheels, tire rings, mirrors, lamps, and wheel arches should be smooth circular or elliptical curves with no wobble; preserve object identity through large structural geometry rather than micro-detail."
    );
  }

  if (hasAny(["building", "architecture", "house", "tower", "bridge", "ship", "boat", "vessel", "tall ship", "facade", "dock"])) {
    hints.push(
      "Architecture/ships: keep silhouette and major divisions only; remove tiny windows, trim, rigging, repeated ornament, and micro-segmentation."
    );
  }

  if (hasAny(["plant", "flower", "leaf", "tree", "branch", "foliage", "bush", "grass"])) {
    hints.push(
      "Plants/foliage: keep outer contour and only a few major internal lines; remove vein texture and small petal/fold detail."
    );
  }

  if (hasAny(["animal", "dog", "cat", "horse", "bird", "deer", "cow", "sheep", "bear", "fish", "insect"])) {
    hints.push(
      "Animals: keep silhouette plus minimal defining lines only; remove fur/feather/scale texture and fine anatomical detailing."
    );
  }

  if (hints.length === 0) {
    hints.push(
      "Generic simplification: preserve the outer contour plus important internal structural lines; remove texture marks, repeated tiny features, and detail that does not change object identity."
    );
  }

  return hints;
}

/**
 * Build prompt for "illustration" mode — faithful contour tracing.
 * This is the original behavior.
 */
function buildIllustrationPrompt(opts: {
  viewDescription: string;
  subjectFilter?: string;
  isolateSubject?: string;
  detailLevel: DetailLevel;
  sourceLockedPeopleGroup?: boolean;
}): string {
  const {
    viewDescription,
    subjectFilter,
    isolateSubject,
    detailLevel,
    sourceLockedPeopleGroup,
  } = opts;

  const focusLine = isolateSubject
    ? `\n\nFocus ONLY on this subject: "${isolateSubject}". Trace only that subject from the photo, leave everything else pure white.`
    : (subjectFilter ?? "");

  return `Produce a minimal black-and-white line drawing of this image — like a clean vector-ready trace.

CRITICAL CONSTRAINTS — you must obey every one:
1. ONLY two tones: pure black (#000000) lines and pure white (#FFFFFF) background. No grey, no colour, no anti-aliased edges.
2. Uniform thin stroke weight throughout — every line the same thickness, including silhouette, hair, facial accessories, garment overlaps, straps, and shoe soles.
3. ZERO shading, fills, gradients, hatching, crosshatch, stippling, dot textures, or colored clothing/accessory regions.
4. ZERO grey tones or soft edges — every pixel is either solid black or solid white.
5. Faithfully reproduce the silhouette, proportions, and spatial layout of the original image. Do NOT invent, rearrange, or reimagine anything.
6. Draw only the essential outlines and major structural edges. Omit fine surface detail, texture marks, and decorative complexity.
7. Prefer long, continuous, unbroken strokes. Avoid clusters of tiny lines.
8. Leave large interior areas completely white — do not fill them with texture or pattern.
9. For human faces, keep only prominent identity-defining external features such as glasses, beard outline, mustache outline, or major headwear boundaries. Omit eyes, pupils, nostrils, lips, teeth, eyebrows, wrinkles, and other small interior facial marks.
10. For clothing and wearable gear, keep only the main outer contour and a few major openings or overlaps. Omit shoelaces, seams, stitching, zipper teeth, drawstrings, pocket creases, quilt lines, small wrinkles, and secondary backpack straps. If one of those elements is necessary, represent it with one clean long contour only.
11. For standing or walking people used as entourage, treat hair as one outer mass with a maximum of one interior hair line, use zero interior face lines in side or rear views, keep garments to the silhouette plus a maximum of two interior overlap lines total, and keep shoes to outer contour plus a maximum of one sole line.
12. Every stroke must keep blunt, uniform ends. Do not taper lines to points and do not use brush-like or calligraphic terminals. If uncertain, omit the detail instead of drawing a thin pointed ending.
13. If multiple people or objects appear, preserve the exact count, left-to-right order, relative positions, overlaps, scale, pose, and facing direction from the source. Do not restage the scene into a cleaner or more generic composition.

${buildDetailPromptBlock(detailLevel)}
${buildSourceLockedPeopleGroupBlock(!!sourceLockedPeopleGroup)}

The result must look like it could be directly auto-traced into clean vector paths with no cleanup needed.

View angle: ${viewDescription}${focusLine}`;
}

/**
 * Build prompt for "vectorworks_centerline" mode — simplified architectural
 * linework optimized for single-line CAD vectorization.
 */
function buildVectorworksCenterlinePrompt(opts: {
  viewDescription: string;
  selectedDescs?: string[];
  enforceSelectedOnly?: boolean;
  isolateSubject?: string;
  subjectHints?: string[];
  detailLevel: DetailLevel;
}): string {
  const {
    viewDescription,
    selectedDescs,
    enforceSelectedOnly,
    isolateSubject,
    subjectHints,
    detailLevel,
  } = opts;

  const selectedScopeConstraint = isolateSubject
    ? ""
    : selectedDescs && selectedDescs.length > 0
      ? enforceSelectedOnly
        ? `

SUBJECT ENFORCEMENT (STRICT): ONLY draw these subjects: ${selectedDescs.join(", ")}. Remove everything else (all other objects, background, clutter) to pure white.`
        : `

SUBJECT SCOPE: Keep these subjects together in the scene: ${selectedDescs.join(", ")}. Preserve their relationships while removing background clutter and micro-detail.`
      : `

SUBJECT SCOPE: Keep all major visible subjects in the scene, but still remove background clutter and micro-detail.`;

  const isolateConstraint = isolateSubject
    ? `

SUBJECT ENFORCEMENT (STRICT): Isolate ONLY this subject: "${isolateSubject}". Remove everything else to pure white.`
    : "";

  const hintBlock =
    subjectHints && subjectHints.length > 0
      ? `

Subject-specific simplification hints:
- ${subjectHints.join("\n- ")}`
      : "";
  const sourceLockedPeopleGroup = isLikelyPeopleGroup([
    ...(isolateSubject ? [isolateSubject] : []),
    ...(selectedDescs ?? []),
  ]);

  return `Convert this image into faithful, centerline-ready black linework for CAD vectorization.

This IS a tracing-style simplification pass. The output must stay geometrically anchored to the source image while removing only non-essential detail.

VIEW REQUIREMENT:
- Render from this view/context: ${viewDescription}
- Preserve silhouette, pose, proportions, and perspective from that view.

ABSOLUTE VECTORIZATION CONSTRAINTS (mandatory):
1. Pure black lines (#000000) on pure white background (#FFFFFF) only.
2. No grayscale, no color, no soft edges, no anti-aliased edges.
3. Use one global stroke width everywhere. Do not intentionally vary line thickness by importance, depth, material, contour role, or whether a line is interior or exterior.
4. No shading, no fills, no colored clothing/accessory regions, no hatching, no texture, no sketch marks.
5. Prefer clean, separable, continuous strokes over realism.
6. No dense clusters of tiny lines, no overlapping short strokes.
7. Keep clear white space between nearby lines.
8. If two nearby texture details would crowd linework, replace them with one cleaner representative contour.
9. Keep details that define object identity, pose, attachment points, or functional structure; omit only tiny noise and texture.
10. Remove all unselected or out-of-scope objects.
11. Prefer sparse pre-CAD contour drawing over illustrative richness. If a detail would create several short strokes, remove it or replace it with one cleaner contour.
12. All stroke terminals must stay blunt and uniform. Never taper a line into a pointed tip.
13. Every stroke must correspond to a visible physical boundary, panel edge, contour, opening, attachment, or structural seam in the source. Do not add construction strokes, connector strokes, guide lines, imagined diagonals, or lines that merely link separate parts.

${buildDetailPromptBlock(detailLevel)}

TRACING FIDELITY RULES (strict):
- Treat the source image like a tracing underlay. Follow the observed outer contour and observed internal structure directly.
- Do not invent, redesign, straighten, beautify, rebalance, or restage the subject.
- Preserve the exact count, order, spacing, crop, overlap, and relative scale of all selected subjects.
- Keep the real position, scale, tilt, and bend of the head, torso, limbs, joints, and major object parts.
- If simplification conflicts with source shape, preserve source shape.
- Keep overlap, contact points, and attachment points exactly where they appear in the source.
- Do not convert an observed object into a generic icon, mannequin, symbol, or stock pose.
- Do not turn a group scene into a new group scene. Do not move people closer together, rotate them, change seated poses, swap clothing shapes, or replace observed bodies with cleaner invented figures.

SCALE-AWARE SIMPLIFICATION:
- Large objects: keep major silhouette and major structural lines only.
- Medium objects: keep silhouette plus a few internal lines.
- Small objects: silhouette-only or near-silhouette-only.
- Distant figures and tiny mechanical detail must be simplified aggressively.

THIN-STRUCTURE CENTERLINE RULES (strict):
- Use a single centerline only for extremely thin wire-like parts whose thickness is barely visible in the source.
- Cables, wires, and threadlike supports may be represented by one center stroke.
- Bars, rails, handles, tubular exercise frames, walking canes, and other members with clearly visible thickness must keep their observed outer edges and must NOT get an interior center line.
- Never add a longitudinal centerline inside a closed tubular contour.
- Do not replace a clearly visible thick shape with a single symbolic line.

TOPOLOGY AND OBSERVATION RULES (strict):
- Do not add guide lines, center axes, construction lines, or symbolic strokes that are not visibly present in the source image.
- Do not let a single stroke pass through unrelated parts of the object.
- Do not draw a line across an open white area unless the source clearly contains a real physical edge there.
- Preserve the real attachment points and connectivity seen in the source image.
- Thin-structure centerline rules apply only to narrow visible members, not as abstract diagram axes.
- Keep the object readable as an observed scene object, not as an icon or schematic symbol.

MECHANICAL CAD GEOMETRY RULES (strict):
- For vehicles and machines, prioritize clean CAD geometry over sketchy realism.
- Long vehicle body, roof, window, bumper, grille, and side-panel edges should be straight or gently curved as appropriate, not wavy.
- Wheels, tire rings, wheel arches, lamps, mirrors, and rounded bull-bar corners should be smooth arcs, circles, or ellipses where possible.
- Do not draw diagonal underbody connector lines, shadow lines, perspective helper lines, or decorative crossing strokes unless they are clearly visible physical rods, seams, or edges in the source.
- Remove tire tread, ground contact texture, reflections, and small repeated mechanical marks unless they are essential for recognition.
- Keep grille bars, window frames, bull bars, tires, doors, mirrors, and handles as readable large geometry with uniform stroke thickness.

HUMAN FIGURE RULES (strict):
- Simplify people as observed silhouettes and observed contour lines, not stick figures, mannequins, or pictograms.
- For groups, preserve every visible person separately in their original left-to-right order and original pose.
- Do not replace heads with simple circles unless that shape is actually supported by the source.
- Preserve the observed head shape, shoulder slope, arm bend, hand position, leg bend, garment outline, and shoe placement.
- Do not reduce a person to a gesture-only drawing when a clear outer contour is visible in the source.
- Closed outer contours are allowed and preferred when needed to preserve the observed silhouette faithfully.
- Keep interior human detail minimal and only when essential for recognition, but do not lose the real body proportions or pose.
- For faces, default to contour-only treatment with no eyes, pupils, nostrils, lips, teeth, eyebrows, wrinkles, or other interior facial drawing.
- Only keep prominent identity-defining face features or accessories when they are large and obvious in the source, such as glasses, beard outline, mustache outline, or major headwear boundaries.
- Do not invent portrait detail, expression lines, makeup detail, eyelashes, or stylized face rendering.
- Simplify clothing to the outer garment silhouette plus only a few major openings, overlaps, and attachment points.
- Remove shoelaces, zipper teeth, seam texture, quilting, stitching, drawstrings, tiny pocket folds, cuff wrinkles, and other short garment marks that do not change silhouette or pose.
- Remove secondary backpack straps and fragmented strap details unless they materially clarify attachment; if a strap or cord must remain, render it as one clean long contour or one simple stroke, never as a cluster of short marks.
- For walking, standing, or entourage-style figures, treat hair as one outer mass with a maximum of one interior separation line.
- For side-view, rear-view, or distant entourage figures, use zero interior face lines unless glasses or another accessory is unusually large and essential.
- Simplify coats, jackets, trousers, and sleeves to the silhouette plus a maximum of two major opening or overlap lines total.
- Simplify shoes to the outer contour plus a maximum of one sole line; remove layered sole construction and lace detail entirely.
- Keep the same apparent line thickness across outer contour, hair, overlap lines, and shoe lines; never use a heavier silhouette or a finer interior line.
- All visible stroke ends must remain blunt and uniform. No pointed line endings, no tapered brush behavior, and no hairline tips.

MICRO-DETAIL REMOVAL (strict):
- No tiny texture lines, decorative noise, repeated micro-parts, or surface marks.
- Keep small parts only when they define attachment, function, recognizable silhouette, or pose.
- No decorative detail that does not change recognizable silhouette, function, or pose.
- Prefer deleting tiny folds and accessory fragments rather than approximating them with several broken mini-strokes.
- If a detail cannot be rendered with the same stroke thickness and blunt line ending as the rest of the drawing, omit it.

${buildSourceLockedPeopleGroupBlock(sourceLockedPeopleGroup)}
${isolateConstraint}${selectedScopeConstraint}${hintBlock}`;
}

// ─── POST /detect-subjects ──────────────────────────────────────────────────

aiRouter.post("/detect-subjects", async (c) => {
  try {
    const rawBody = await c.req.json();
    const parseResult = DetectSubjectsRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      console.log("[detect-subjects] Validation error:", parseResult.error.issues);
      return c.json(
        { error: { message: "Invalid request body", code: "VALIDATION_ERROR" } },
        400
      );
    }

    const { imageBase64, description } = parseResult.data;

    console.log(
      `[detect-subjects] Image base64 length: ${imageBase64.length}, description: ${description ?? "none"}`
    );

    // Resize image to max 1024px before sending to Gemini to avoid timeouts
    const inputBuffer = Buffer.from(imageBase64, "base64");
    const resizedBuffer = await sharp(inputBuffer)
      .resize(1024, 1024, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const resizedBase64 = resizedBuffer.toString("base64");
    console.log(`[detect-subjects] Resized image base64 length: ${resizedBase64.length}`);

    const apiKey = getApiKey();
    if (!apiKey) {
      return c.json(
        { error: { message: "GEMINI_API_KEY is not configured", code: "MISSING_API_KEY" } },
        500
      );
    }

    const descriptionContext = description
      ? `The user describes this image as: "${description}". Use this context to better identify subjects.`
      : "";

    const prompt = `Analyze this image and list distinct, user-selectable subjects that are large enough to extract as clean linework assets. ${descriptionContext}

Return a numbered list using short labels (2-4 words):
1. subject
2. subject

Rules:
- Prefer coarse, substantial objects only.
- Ignore tiny sub-parts, micro-components, hardware, and clutter.
- Good examples: "chairlift", "two riders", "cable".
- Bad examples: "tiny clamp parts", "helmet strap", "seat bar joint".
- Do not list texture regions, shadows, reflections, or background scenery unless they are major standalone subjects.
- Keep the list practical for extraction (usually 2-8 subjects).`;

    const geminiResponse = await callGemini("gemini-2.5-flash", [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: "image/jpeg",
              data: resizedBase64,
            },
          },
        ],
      },
    ]);

    // Extract text from response
    const textPart = geminiResponse.candidates?.[0]?.content?.parts?.find(
      (p) => p.text
    );
    const responseText = textPart?.text ?? "";

    console.log(`[detect-subjects] Gemini response text: ${responseText}`);

    // Parse numbered list: "1. description", "2. description", etc.
    const subjects: Subject[] = [];
    const lines = responseText.split("\n");
    for (const line of lines) {
      const match = line.match(/^\s*(\d+)\.\s*(.+)/);
      if (match && match[1] && match[2]) {
        const id = parseInt(match[1], 10);
        const desc = match[2].trim();
        if (id > 0 && desc.length > 0) {
          subjects.push({ id, description: desc });
        }
      }
    }

    console.log(`[detect-subjects] Parsed ${subjects.length} subjects`);

    const responseData: DetectSubjectsResponse = { subjects };
    return c.json({ data: responseData });
  } catch (err) {
    console.error("[detect-subjects] Error:", err);
    const message = err instanceof Error ? err.message : "Failed to detect subjects";
    return c.json(
      { error: { message, code: "DETECT_SUBJECTS_ERROR" } },
      500
    );
  }
});

// ─── POST /generate-linework ────────────────────────────────────────────────

aiRouter.post("/generate-linework", async (c) => {
  const requestStartedAt = Date.now();
  const signal = c.req.raw.signal;
  const logStep = (message: string) => {
    console.log(`[generate-linework] ${message} (${Date.now() - requestStartedAt}ms)`);
  };
  const throwIfAborted = () => {
    if (signal.aborted) {
      throw new Error("The generation request was cancelled before it finished.");
    }
  };

  const user = c.get("user");
  let reservedUserId: string | null = null;
  let reservedMode: "admin" | "credit" | "free_trial" | null = null;
  let trialConsumed = false;
  let reservedDeviceHash: string | undefined;

  try {
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const rawBody = await c.req.json();
    const parseResult = GenerateLineworkRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      console.log("[generate-linework] Validation error:", parseResult.error.issues);
      return c.json(
        { error: { message: "Invalid request body", code: "VALIDATION_ERROR" } },
        400
      );
    }

    const {
      imageBase64,
      subjects,
      selectedSubjects,
      viewAngle,
      customViewDescription,
      processingMode,
      outputMode,
      detailLevel,
    } = parseResult.data;

    console.log(
      `[generate-linework] mode=${processingMode}, outputMode=${outputMode}, detailLevel=${detailLevel}, viewAngle=${viewAngle}, subjects=${subjects?.length ?? 0}, selected=${selectedSubjects?.length ?? 0}`
    );
    console.log(
      `[generate-linework] promptProfile=${getPromptProfileId(outputMode)}`
    );

    const apiKey = getApiKey();
    if (!apiKey) {
      return c.json(
        { error: { message: "GEMINI_API_KEY is not configured", code: "MISSING_API_KEY" } },
        500
      );
    }

    const preparedImage = await prepareImageForLineworkGeneration(imageBase64);
    logStep(
      `Prepared AI input ${preparedImage.inputBytes} bytes -> ${preparedImage.outputBytes} bytes (${preparedImage.width}x${preparedImage.height})`
    );
    throwIfAborted();

    const deviceToken = getOrCreateTrialDeviceToken(c);
    const deviceHash = hashTrialDeviceToken(deviceToken);
    const reservation = await reserveProcessAccess(user.id, "ai", deviceHash);
    if (!reservation.allowed) {
      return c.json({ error: reservation.error }, reservation.status as 401 | 402 | 403 | 500);
    }

    reservedUserId = user.id;
    reservedMode = reservation.mode;
    trialConsumed = reservation.trialConsumed;
    reservedDeviceHash = deviceHash;

    const viewDescription = customViewDescription || viewAngle;

    const model = getImageGenerationModel();
    const apiVersion = "v1beta";
    const generationConfig = {
      responseModalities: ["IMAGE"],
      temperature: 0,
    };

    logStep(`Using image model: ${model}`);

    const results: LineworkResult[] = [];

    if (processingMode === "keep_together") {
      // Build selected subject descriptions for prompt control.
      // - Strict enforcement when selected is a subset
      // - Softer keep-together guidance when all subjects are selected
      let selectedDescs: string[] | undefined;
      let enforceSelectedOnly = false;

      if (subjects && selectedSubjects && selectedSubjects.length > 0) {
        const selectedList: string[] = [];
        for (const id of selectedSubjects) {
          const selected = subjects.find((sub) => sub.id === id);
          if (selected) selectedList.push(selected.description);
        }

        if (selectedList.length > 0) {
          selectedDescs = selectedList;
          enforceSelectedOnly = selectedSubjects.length < subjects.length;
        }
      } else if (subjects && subjects.length > 0) {
        selectedDescs = subjects.map((subject) => subject.description);
      }

      const prompt = buildPromptForMode(outputMode, {
        viewDescription,
        selectedDescs,
        enforceSelectedOnly,
        detailLevel,
      });

      logStep("Sending keep_together request");

      const geminiResponse = await callGemini(
        model,
        [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: preparedImage.mimeType,
                  data: preparedImage.base64,
                },
              },
            ],
          },
        ],
        generationConfig,
        apiVersion,
        signal
      );
      logStep("keep_together AI response received");
      throwIfAborted();

      // Extract generated image from response (API returns camelCase inlineData)
      const parts = geminiResponse.candidates?.[0]?.content?.parts ?? [];
      console.log("[generate-linework] keep_together parts:", JSON.stringify(parts).slice(0, 300));
      const imagePart = parts.find((p) => p.inlineData ?? p.inline_data);

      if (imagePart) {
        const imageData = imagePart.inlineData?.data ?? imagePart.inline_data?.data ?? "";
        const finalizeStartedAt = Date.now();
        const finalizedImageData = await finalizeGeneratedLinework(imageData);
        logStep(
          `Finalized keep_together image in ${Date.now() - finalizeStartedAt}ms (${finalizedImageData.length} base64 chars)`
        );
        throwIfAborted();
        results.push({
          subjectId: 0,
          imageBase64: finalizedImageData,
        });
        console.log("[generate-linework] Got image result for keep_together");
      } else {
        console.log("[generate-linework] No image in response. Full response:", JSON.stringify(geminiResponse).slice(0, 500));
      }
    } else {
      // extract_all mode: one request per selected subject
      const subjectsToProcess: Subject[] = [];

      if (subjects && selectedSubjects && selectedSubjects.length > 0) {
        for (const id of selectedSubjects) {
          const subject = subjects.find((s) => s.id === id);
          if (subject) {
            subjectsToProcess.push(subject);
          }
        }
      } else if (subjects) {
        subjectsToProcess.push(...subjects);
      }

      console.log(
        `[generate-linework] Processing ${subjectsToProcess.length} subjects individually`
      );

      for (const subject of subjectsToProcess) {
        const prompt = buildPromptForMode(outputMode, {
          viewDescription,
          isolateSubject: subject.description,
          detailLevel,
        });

        logStep(`Sending request for subject ${subject.id}: ${subject.description}`);

        try {
          const geminiResponse = await callGemini(
            model,
            [
              {
                parts: [
                  { text: prompt },
                  {
                    inline_data: {
                      mime_type: preparedImage.mimeType,
                      data: preparedImage.base64,
                    },
                  },
                ],
              },
            ],
            generationConfig,
            apiVersion,
            signal
          );
          logStep(`AI response received for subject ${subject.id}`);
          throwIfAborted();

          const parts = geminiResponse.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find((p) => p.inlineData ?? p.inline_data);

          if (imagePart) {
            const imageData = imagePart.inlineData?.data ?? imagePart.inline_data?.data ?? "";
            const finalizeStartedAt = Date.now();
            const finalizedImageData = await finalizeGeneratedLinework(imageData);
            logStep(
              `Finalized subject ${subject.id} image in ${Date.now() - finalizeStartedAt}ms (${finalizedImageData.length} base64 chars)`
            );
            throwIfAborted();
            results.push({
              subjectId: subject.id,
              imageBase64: finalizedImageData,
            });
            console.log(
              `[generate-linework] Got image result for subject ${subject.id}`
            );
          } else {
            console.log(
              `[generate-linework] No image for subject ${subject.id}. Response:`,
              JSON.stringify(geminiResponse).slice(0, 300)
            );
          }
        } catch (subjectErr) {
          if (signal.aborted) {
            throw subjectErr;
          }

          console.error(
            `[generate-linework] Error processing subject ${subject.id}:`,
            subjectErr
          );
          // Continue with other subjects even if one fails
        }
      }
    }

    logStep(
      `Returning ${results.length} results (${results.reduce((sum, item) => sum + item.imageBase64.length, 0)} base64 chars)`
    );

    if (results.length === 0) {
      throw new Error("No image was generated. The model may not have returned an image output.");
    }

    const responseData: GenerateLineworkResponse = { results, trialConsumed };
    return c.json({ data: responseData });
  } catch (err) {
    if (reservedUserId && reservedMode) {
      try {
        await releaseProcessAccess(reservedUserId, reservedMode, reservedDeviceHash);
      } catch (releaseErr) {
        console.error("[generate-linework] Failed to release reserved access:", releaseErr);
      }
    }

    console.error("[generate-linework] Error:", err);
    const message =
      err instanceof Error ? err.message : "Failed to generate linework";
    return c.json(
      { error: { message, code: "GENERATE_LINEWORK_ERROR" } },
      500
    );
  }
});

/**
 * Build the appropriate prompt based on output mode.
 * Keeps prompt construction in one place for both keep_together and extract_all.
 */
function buildPromptForMode(
  outputMode: OutputMode,
  opts: {
    viewDescription: string;
    selectedDescs?: string[];
    enforceSelectedOnly?: boolean;
    isolateSubject?: string;
    detailLevel: DetailLevel;
  }
): string {
  if (outputMode === "vectorworks_centerline") {
    const hintSources = opts.isolateSubject
      ? [opts.isolateSubject]
      : (opts.selectedDescs ?? []);

    const subjectHints = Array.from(
      new Set(hintSources.flatMap((desc) => getSubjectHints(desc)))
    );

    return buildVectorworksCenterlinePrompt({
      viewDescription: opts.viewDescription,
      selectedDescs: opts.selectedDescs,
      enforceSelectedOnly: opts.enforceSelectedOnly,
      isolateSubject: opts.isolateSubject,
      detailLevel: opts.detailLevel,
      subjectHints: subjectHints.length > 0 ? subjectHints : undefined,
    });
  }

  // illustration mode (default) — faithful tracing
  const subjectFilter =
    opts.selectedDescs && opts.selectedDescs.length > 0
      ? `

IMPORTANT: ONLY trace these subjects: ${opts.selectedDescs.join(", ")}. Remove everything else (background, other objects) — leave those areas pure white.`
      : "";

  return buildIllustrationPrompt({
    viewDescription: opts.viewDescription,
    subjectFilter,
    isolateSubject: opts.isolateSubject,
    detailLevel: opts.detailLevel,
    sourceLockedPeopleGroup: isLikelyPeopleGroup([
      ...(opts.isolateSubject ? [opts.isolateSubject] : []),
      ...(opts.selectedDescs ?? []),
    ]),
  });
}

export { aiRouter, buildPromptForMode, getPromptProfileId };
