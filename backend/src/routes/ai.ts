import { Hono } from "hono";
import sharp from "sharp";
import type { auth } from "../auth";
import { env } from "../env";
import {
  DetectSubjectsRequestSchema,
  GenerateLineworkRequestSchema,
  type Subject,
  type OutputMode,
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

async function finalizeGeneratedLinework(imageBase64: string): Promise<string> {
  const buffer = Buffer.from(imageBase64, "base64");
  const normalized = await sharp(buffer)
    .flatten({ background: "#ffffff" })
    .resize(2048, 2048, { fit: "inside" })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return normalized.toString("base64");
}

async function callGemini(
  model: string,
  contents: GeminiContent[],
  generationConfig?: Record<string, unknown>,
  apiVersion = "v1beta"
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

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[gemini] API error (${response.status}): ${errorText}`);
    throw new Error(`Gemini API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;

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
  illustration: "illustration-sparse-prevector-v3",
  vectorworksCenterline: "vectorworks-centerline-entourage-v4",
} as const;

function getPromptProfileId(outputMode: OutputMode): string {
  return outputMode === "vectorworks_centerline"
    ? PROMPT_PROFILE_IDS.vectorworksCenterline
    : PROMPT_PROFILE_IDS.illustration;
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
      "People/riders: preserve the observed silhouette, limb contours, hand and shoe positions, and only the main clothing or gear boundaries needed to read the pose; keep only prominent identity-defining face accessories or outlines such as glasses, beard outline, mustache outline, or strong headwear boundaries; omit eyes, pupils, nostrils, lips, teeth, eyebrows, wrinkles, and other interior facial detail unless they are unusually large and structurally obvious in the source; remove shoelaces, stitching, zipper teeth, drawstrings, pocket creases, quilt lines, seam texture, and secondary backpack strap fragments; if a strap, lace, or cord is essential for readability, reduce it to one clean long contour or one simple stroke only."
    );
  }

  if (hasAny(["walk", "walking", "pedestrian", "standing", "strolling", "profile", "side view", "entourage"])) {
    hints.push(
      "Entourage / walking figures: treat hair as one outer mass with at most one interior separation line; for side-view, rear-view, or distant walking figures use no interior face lines unless glasses are large and dominant; simplify coats, jackets, trousers, and sleeves to the silhouette plus only one or two major opening or overlap lines; simplify shoes to the outer contour plus at most one sole line; remove cuff lines, hem lines, seam lines, layered shoe construction, and minor garment folds."
    );
  }

  if (hasAny(["chairlift", "mechanical", "assembly", "machine", "vehicle", "engine", "gear", "bicycle", "motorcycle", "car", "truck", "train", "aircraft", "helicopter", "drone", "robot"])) {
    hints.push(
      "Mechanical/vehicle subjects: keep only major contours and major structural members; remove bolts, clamps, fasteners, wires, repeated small parts, tiny cutouts, and dense linkage detail."
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
}): string {
  const { viewDescription, subjectFilter, isolateSubject } = opts;

  const focusLine = isolateSubject
    ? `\n\nFocus ONLY on this subject: "${isolateSubject}". Trace only that subject from the photo, leave everything else pure white.`
    : (subjectFilter ?? "");

  return `Produce a minimal black-and-white line drawing of this image — like a clean vector-ready trace.

CRITICAL CONSTRAINTS — you must obey every one:
1. ONLY two tones: pure black (#000000) lines and pure white (#FFFFFF) background. No grey, no colour, no anti-aliased edges.
2. Uniform thin stroke weight throughout — every line the same thickness.
3. ZERO shading, fills, gradients, hatching, crosshatch, stippling, or dot textures.
4. ZERO grey tones or soft edges — every pixel is either solid black or solid white.
5. Faithfully reproduce the silhouette, proportions, and spatial layout of the original image. Do NOT invent, rearrange, or reimagine anything.
6. Draw only the essential outlines and major structural edges. Omit fine surface detail, texture marks, and decorative complexity.
7. Prefer long, continuous, unbroken strokes. Avoid clusters of tiny lines.
8. Leave large interior areas completely white — do not fill them with texture or pattern.
9. For human faces, keep only prominent identity-defining external features such as glasses, beard outline, mustache outline, or major headwear boundaries. Omit eyes, pupils, nostrils, lips, teeth, eyebrows, wrinkles, and other small interior facial marks.
10. For clothing and wearable gear, keep only the main outer contour and a few major openings or overlaps. Omit shoelaces, seams, stitching, zipper teeth, drawstrings, pocket creases, quilt lines, small wrinkles, and secondary backpack straps. If one of those elements is necessary, represent it with one clean long contour only.
11. For standing or walking people used as entourage, treat hair as one outer mass, use no interior face lines in side or rear views, keep garments to silhouette plus one or two major overlap lines, and keep shoes to outer contour plus at most one sole line.

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
}): string {
  const {
    viewDescription,
    selectedDescs,
    enforceSelectedOnly,
    isolateSubject,
    subjectHints,
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

  return `Convert this image into faithful, centerline-ready black linework for CAD vectorization.

This IS a tracing-style simplification pass. The output must stay geometrically anchored to the source image while removing only non-essential detail.

VIEW REQUIREMENT:
- Render from this view/context: ${viewDescription}
- Preserve silhouette, pose, proportions, and perspective from that view.

ABSOLUTE VECTORIZATION CONSTRAINTS (mandatory):
1. Pure black lines (#000000) on pure white background (#FFFFFF) only.
2. No grayscale, no color, no soft edges, no anti-aliased edges.
3. Use one global stroke width everywhere. Do not intentionally vary line thickness by importance, depth, or material.
4. No shading, no fills, no hatching, no texture, no sketch marks.
5. Prefer clean, separable, continuous strokes over realism.
6. No dense clusters of tiny lines, no overlapping short strokes.
7. Keep clear white space between nearby lines.
8. If two nearby texture details would crowd linework, replace them with one cleaner representative contour.
9. Keep details that define object identity, pose, attachment points, or functional structure; omit only tiny noise and texture.
10. Remove all unselected or out-of-scope objects.
11. Prefer sparse pre-CAD contour drawing over illustrative richness. If a detail would create several short strokes, remove it or replace it with one cleaner contour.

TRACING FIDELITY RULES (strict):
- Treat the source image like a tracing underlay. Follow the observed outer contour and observed internal structure directly.
- Do not invent, redesign, straighten, beautify, rebalance, or restage the subject.
- Keep the real position, scale, tilt, and bend of the head, torso, limbs, joints, and major object parts.
- If simplification conflicts with source shape, preserve source shape.
- Keep overlap, contact points, and attachment points exactly where they appear in the source.
- Do not convert an observed object into a generic icon, mannequin, symbol, or stock pose.

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
- Preserve the real attachment points and connectivity seen in the source image.
- Thin-structure centerline rules apply only to narrow visible members, not as abstract diagram axes.
- Keep the object readable as an observed scene object, not as an icon or schematic symbol.

HUMAN FIGURE RULES (strict):
- Simplify people as observed silhouettes and observed contour lines, not stick figures, mannequins, or pictograms.
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
- For walking, standing, or entourage-style figures, treat hair as one outer mass with at most one interior separation line.
- For side-view, rear-view, or distant entourage figures, use no interior face lines unless glasses or another accessory is unusually large and essential.
- Simplify coats, jackets, trousers, and sleeves to the silhouette plus only one or two major opening or overlap lines.
- Simplify shoes to the outer contour plus at most one sole line; remove layered sole construction and lace detail entirely.

MICRO-DETAIL REMOVAL (strict):
- No tiny texture lines, decorative noise, repeated micro-parts, or surface marks.
- Keep small parts only when they define attachment, function, recognizable silhouette, or pose.
- No decorative detail that does not change recognizable silhouette, function, or pose.
- Prefer deleting tiny folds and accessory fragments rather than approximating them with several broken mini-strokes.

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
    } = parseResult.data;

    console.log(
      `[generate-linework] mode=${processingMode}, outputMode=${outputMode}, viewAngle=${viewAngle}, subjects=${subjects?.length ?? 0}, selected=${selectedSubjects?.length ?? 0}`
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
      temperature: 0.1,
    };

    console.log(`[generate-linework] Using image model: ${model}`);

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
      }

      const prompt = buildPromptForMode(outputMode, {
        viewDescription,
        selectedDescs,
        enforceSelectedOnly,
      });

      console.log("[generate-linework] Sending keep_together request");

      const geminiResponse = await callGemini(
        model,
        [
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
        generationConfig,
        apiVersion
      );

      // Extract generated image from response (API returns camelCase inlineData)
      const parts = geminiResponse.candidates?.[0]?.content?.parts ?? [];
      console.log("[generate-linework] keep_together parts:", JSON.stringify(parts).slice(0, 300));
      const imagePart = parts.find((p) => p.inlineData ?? p.inline_data);

      if (imagePart) {
        const imageData = imagePart.inlineData?.data ?? imagePart.inline_data?.data ?? "";
        const finalizedImageData = await finalizeGeneratedLinework(imageData);
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
        });

        console.log(
          `[generate-linework] Sending request for subject ${subject.id}: ${subject.description}`
        );

        try {
          const geminiResponse = await callGemini(
            model,
            [
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
            generationConfig,
            apiVersion
          );

          const parts = geminiResponse.candidates?.[0]?.content?.parts ?? [];
          const imagePart = parts.find((p) => p.inlineData ?? p.inline_data);

          if (imagePart) {
            const imageData = imagePart.inlineData?.data ?? imagePart.inline_data?.data ?? "";
            const finalizedImageData = await finalizeGeneratedLinework(imageData);
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
          console.error(
            `[generate-linework] Error processing subject ${subject.id}:`,
            subjectErr
          );
          // Continue with other subjects even if one fails
        }
      }
    }

    console.log(`[generate-linework] Returning ${results.length} results`);

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
  });
}

export { aiRouter };
