import { Hono } from "hono";
import sharp from "sharp";
import type { auth } from "../auth";
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
  return process.env.GEMINI_API_KEY ?? null;
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
      "People/riders: reduce to sparse silhouette/pose lines only; no face detail, fingers, clothing structure/folds, straps, or buckles; avoid closed outline loops when a single gesture line or single contour is sufficient."
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
      "Generic simplification: preserve only outer contour and a small number of major internal structural lines; remove micro-detail, texture marks, and repeated tiny features."
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

  return `Convert this image into extremely simplified centerline-ready black linework for CAD vectorization.

This is NOT a photo trace. It is a strict structural simplification pass.

VIEW REQUIREMENT:
- Render from this view/context: ${viewDescription}
- Preserve silhouette, pose, proportions, and perspective from that view.

ABSOLUTE VECTORIZATION CONSTRAINTS (mandatory):
1. Pure black lines (#000000) on pure white background (#FFFFFF) only.
2. No grayscale, no color, no soft edges, no anti-aliased edges.
3. Uniform thin stroke weight for all strokes.
4. No shading, no fills, no hatching, no texture, no sketch marks.
5. Prefer clean, separable, continuous strokes over realism.
6. No dense clusters of tiny lines, no overlapping short strokes.
7. Keep clear white space between nearby lines.
8. If two nearby details would crowd linework, replace them with one cleaner representative contour.
9. If a detail is smaller than about 4 stroke widths, omit it.
10. Remove all unselected or out-of-scope objects.

SCALE-AWARE SIMPLIFICATION:
- Large objects: keep major silhouette and major structural lines only.
- Medium objects: keep silhouette plus a few internal lines.
- Small objects: silhouette-only or near-silhouette-only.
- Distant figures and tiny mechanical detail must be simplified aggressively.

THIN-STRUCTURE CENTERLINE RULES (strict):
- Draw thin structural elements as single-stroke centerlines, not double-edge outlined shapes.
- Use single-stroke centerlines only for very thin wire-like members where thickness is barely visible in the source.
- Cables, wires, and extremely thin supports may be represented by one center stroke.
- Bars, rails, handles, tubular exercise frames, and other members with clearly visible thickness must keep only their outer contour and must NOT get an interior center line.
- Do not draw tube/rail thickness for narrow members.
- Do not use parallel contour lines to describe narrow objects.
- Use a monoline schematic style for thin structures.
- If a part is narrow, represent it with one line, not two borders.
- When a narrow structural part bends, keep one continuous centerline through the bend (not two boundary contours).
- For narrow closed shapes, prefer opening them into a single representative stroke when recognition is preserved.
- Never add a longitudinal centerline inside a closed tubular contour.

TOPOLOGY AND OBSERVATION RULES (strict):
- Do not add guide lines, center axes, construction lines, or symbolic strokes that are not visibly present in the source image.
- Do not let a single stroke pass through unrelated parts of the object.
- Preserve the real attachment points and connectivity seen in the source image.
- Thin-structure centerline rules apply only to narrow visible members, not as abstract diagram axes.
- Keep the object readable as an observed scene object, not as an icon or schematic symbol.

HUMAN FIGURE RULES (strict):
- Simplify people as observed silhouettes and pose contours, not stick figures or pictograms.
- Do not replace heads with simple circles unless that shape is actually supported by the source.
- Keep only the minimum real contours needed for recognition from the source image.
- Prefer one gesture line or one contour when sufficient for recognition.
- Do not use closed outline loops when one gesture line or one contour is enough.
- Keep interior human detail minimal and only when essential for recognition.

MICRO-DETAIL REMOVAL (strict):
- No tiny fasteners, straps, clamps, seams, cutouts, rigging filigree, texture lines, or repetitive micro-parts.
- No decorative detail that does not change recognizable silhouette/pose.

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

    const apiKey = getApiKey();
    if (!apiKey) {
      return c.json(
        { error: { message: "GEMINI_API_KEY is not configured", code: "MISSING_API_KEY" } },
        500
      );
    }

    const reservation = await reserveProcessAccess(user.id);
    if (!reservation.allowed) {
      return c.json({ error: reservation.error }, reservation.status as 401 | 402);
    }

    reservedUserId = user.id;
    reservedMode = reservation.mode;
    trialConsumed = reservation.trialConsumed;

    const viewDescription = customViewDescription || viewAngle;

    const model = "gemini-3-pro-image-preview";
    const apiVersion = "v1beta";
    const generationConfig = {
      responseModalities: ["IMAGE", "TEXT"],
    };

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
        results.push({
          subjectId: 0,
          imageBase64: imageData,
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
            results.push({
              subjectId: subject.id,
              imageBase64: imageData,
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
        await releaseProcessAccess(reservedUserId, reservedMode);
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
