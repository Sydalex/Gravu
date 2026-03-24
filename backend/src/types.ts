import { z } from "zod";

// ─── Trace API Schemas ─────────────────────────────────────────────────────

/** Turn policy options supported by potrace */
export const TurnPolicyEnum = z.enum([
  "black",
  "white",
  "left",
  "right",
  "minority",
  "majority",
]);
export type TurnPolicy = z.infer<typeof TurnPolicyEnum>;

/** Settings for the potrace vectorizer */
export const VectorizeSettingsSchema = z.object({
  threshold: z.number().min(-1).max(255).default(128),
  turnPolicy: TurnPolicyEnum.default("minority"),
  turdSize: z.number().min(0).max(100).default(2),
  optCurve: z.boolean().default(true),
  alphaMax: z.number().min(0).max(4).default(1),
  color: z.string().default("auto"),
});
export type VectorizeSettings = z.infer<typeof VectorizeSettingsSchema>;

/** Request body for POST /api/trace/vectorize */
export const VectorizeRequestSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  settings: VectorizeSettingsSchema,
});
export type VectorizeRequest = z.infer<typeof VectorizeRequestSchema>;

/** Response data for POST /api/trace/upload */
export const UploadResponseSchema = z.object({
  imageBase64: z.string(),
  width: z.number(),
  height: z.number(),
  originalName: z.string(),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

/** Response data for POST /api/trace/vectorize */
export const VectorizeResponseSchema = z.object({
  svg: z.string(),
  width: z.number(),
  height: z.number(),
});
export type VectorizeResponse = z.infer<typeof VectorizeResponseSchema>;

/** Request body for POST /api/trace/export-dxf */
export const ExportDxfRequestSchema = z.object({
  svg: z.string().min(1, "svg is required"),
});
export type ExportDxfRequest = z.infer<typeof ExportDxfRequestSchema>;

// ─── AI API Schemas ─────────────────────────────────────────────────────────

/** A detected subject from an image */
export const SubjectSchema = z.object({
  id: z.number(),
  description: z.string(),
});
export type Subject = z.infer<typeof SubjectSchema>;

/** Request body for POST /api/ai/detect-subjects */
export const DetectSubjectsRequestSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  description: z.string().optional(),
});
export type DetectSubjectsRequest = z.infer<typeof DetectSubjectsRequestSchema>;

/** Response data for POST /api/ai/detect-subjects */
export const DetectSubjectsResponseSchema = z.object({
  subjects: z.array(SubjectSchema),
});
export type DetectSubjectsResponse = z.infer<typeof DetectSubjectsResponseSchema>;

/** Processing mode for linework generation */
export const ProcessingModeEnum = z.enum(["extract_all", "keep_together"]);
export type ProcessingMode = z.infer<typeof ProcessingModeEnum>;

/** Output mode: illustration (faithful trace) vs vectorworks_centerline (simplified CAD) */
export const OutputModeEnum = z.enum(["illustration", "vectorworks_centerline"]);
export type OutputMode = z.infer<typeof OutputModeEnum>;

/** Request body for POST /api/ai/generate-linework */
export const GenerateLineworkRequestSchema = z.object({
  imageBase64: z.string().min(1, "imageBase64 is required"),
  subjects: z.array(SubjectSchema).optional(),
  selectedSubjects: z.array(z.number()).optional(),
  viewAngle: z.string(),
  customViewDescription: z.string().optional(),
  processingMode: ProcessingModeEnum,
  outputMode: OutputModeEnum.optional().default("illustration"),
});
export type GenerateLineworkRequest = z.infer<typeof GenerateLineworkRequestSchema>;

/** A single linework result */
export const LineworkResultSchema = z.object({
  subjectId: z.number(),
  imageBase64: z.string(),
});
export type LineworkResult = z.infer<typeof LineworkResultSchema>;

/** Response data for POST /api/ai/generate-linework */
export const GenerateLineworkResponseSchema = z.object({
  results: z.array(LineworkResultSchema),
  trialConsumed: z.boolean().optional(),
});
export type GenerateLineworkResponse = z.infer<typeof GenerateLineworkResponseSchema>;

// ─── SVG to DXF Schema ──────────────────────────────────────────────────────

/** Request body for POST /api/convert/svg-to-dxf */
export const SvgToDxfRequestSchema = z.object({
  svg: z.string().min(1),
});
export type SvgToDxfRequest = z.infer<typeof SvgToDxfRequestSchema>;

// ─── Convert API Schemas ────────────────────────────────────────────────────

/** Request body for POST /api/convert/dxf-to-svg */
export const DxfToSvgRequestSchema = z.object({
  dxf: z.string().min(1, "dxf content is required"),
});
export type DxfToSvgRequest = z.infer<typeof DxfToSvgRequestSchema>;

/** Response data for POST /api/convert/dxf-to-svg */
export const DxfToSvgResponseSchema = z.object({
  svg: z.string(),
});
export type DxfToSvgResponse = z.infer<typeof DxfToSvgResponseSchema>;

/** Request body for POST /api/convert/compose (parsed from form data) */
export const ComposeRequestSchema = z.object({
  images: z.array(z.string().min(1)),
  spacing: z.number().min(0).default(0),
  padding: z.number().min(0).default(0),
});
export type ComposeRequest = z.infer<typeof ComposeRequestSchema>;

/** Response data for POST /api/convert/compose */
export const ComposeResponseSchema = z.object({
  imageBase64: z.string(),
  width: z.number(),
  height: z.number(),
});
export type ComposeResponse = z.infer<typeof ComposeResponseSchema>;

// ─── Conversions API Schemas ─────────────────────────────────────────────────

/** A single asset included when creating a conversion */
export const ConversionAssetInputSchema = z.object({
  subjectId: z.number(),
  imageBase64: z.string().optional(),
  svgContent: z.string().optional(),
  dxfContent: z.string().optional(),
});
export type ConversionAssetInput = z.infer<typeof ConversionAssetInputSchema>;

/** Request body for POST /api/conversions */
export const CreateConversionRequestSchema = z.object({
  flowType: z.string().min(1, "flowType is required"),
  name: z.string().optional(),
  originalImageBase64: z.string().optional(),
  assets: z.array(ConversionAssetInputSchema),
});
export type CreateConversionRequest = z.infer<typeof CreateConversionRequestSchema>;

/** A full ConversionAsset record (including large data fields) */
export const ConversionAssetSchema = z.object({
  id: z.string(),
  conversionId: z.string(),
  subjectId: z.number(),
  imageBase64: z.string().nullable(),
  svgContent: z.string().nullable(),
  dxfContent: z.string().nullable(),
  marketplaceStatus: z.string(),
  marketplaceTitle: z.string().nullable(),
  marketplaceCategory: z.string().nullable(),
  marketplaceDownloadCount: z.number(),
  createdAt: z.string(),
});
export type ConversionAsset = z.infer<typeof ConversionAssetSchema>;

/** A ConversionAsset record stripped of large data fields (for list view) */
export const ConversionAssetSummarySchema = z.object({
  id: z.string(),
  conversionId: z.string(),
  subjectId: z.number(),
  createdAt: z.string(),
});
export type ConversionAssetSummary = z.infer<typeof ConversionAssetSummarySchema>;

/** A full Conversion record with assets (for GET /api/conversions/:id) */
export const ConversionDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  flowType: z.string(),
  name: z.string().nullable(),
  originalImageBase64: z.string().nullable(),
  createdAt: z.string(),
  assets: z.array(ConversionAssetSchema),
});
export type ConversionDetail = z.infer<typeof ConversionDetailSchema>;

/** A Conversion summary (for GET /api/conversions list) */
export const ConversionSummarySchema = z.object({
  id: z.string(),
  userId: z.string(),
  flowType: z.string(),
  name: z.string().nullable(),
  originalImageBase64: z.string().nullable(),
  createdAt: z.string(),
  thumbnailBase64: z.string().nullable(),
  assets: z.array(ConversionAssetSummarySchema),
});
export type ConversionSummary = z.infer<typeof ConversionSummarySchema>;

/** Response data for POST /api/conversions */
export const CreateConversionResponseSchema = z.object({
  id: z.string(),
  flowType: z.string(),
  name: z.string().nullable(),
  createdAt: z.string(),
  assets: z.array(ConversionAssetSchema),
});
export type CreateConversionResponse = z.infer<typeof CreateConversionResponseSchema>;

/** Request body for PATCH /api/conversions/:id/assets/:assetId */
export const UpdateAssetRequestSchema = z.object({
  svgContent: z.string().optional(),
  dxfContent: z.string().optional(),
});
export type UpdateAssetRequest = z.infer<typeof UpdateAssetRequestSchema>;

export const MarketplaceSubmissionRequestSchema = z.object({
  title: z.string().min(2, "title is required"),
  category: z.string().min(2, "category is required"),
});
export type MarketplaceSubmissionRequest = z.infer<typeof MarketplaceSubmissionRequestSchema>;

export const MarketplaceAssetSummarySchema = z.object({
  id: z.string(),
  conversionId: z.string(),
  subjectId: z.number(),
  title: z.string(),
  category: z.string(),
  previewBase64: z.string().nullable(),
  svgContent: z.string().nullable(),
  dxfContent: z.string().nullable(),
  flowType: z.string(),
  createdAt: z.string(),
  hasSvg: z.boolean(),
  hasDxf: z.boolean(),
  downloadCount: z.number(),
});
export type MarketplaceAssetSummary = z.infer<typeof MarketplaceAssetSummarySchema>;

// ─── Payments API Schemas ────────────────────────────────────────────────────

export const SubscriptionStatusSchema = z.object({
  plan: z.enum(["free", "lite", "pro", "expert"]),
  status: z.string().nullable(),
  currentPeriodEnd: z.string().nullable(),
  cancelAtPeriodEnd: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  credits: z.number(),
  freeTrialUsed: z.boolean(),
  deviceTrialUsed: z.boolean(),
  isAdmin: z.boolean(),
  billingEnabled: z.boolean(),
  activeProPriceId: z.string().nullable(),
  activeCreditsPackPriceId: z.string().nullable(),
  activeCreditsPackAmount: z.number().nullable(),
});
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const BuyCreditsRequestSchema = z.object({
  credits: z.number().int().positive(),
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type BuyCreditsRequest = z.infer<typeof BuyCreditsRequestSchema>;

export const CreateCheckoutSessionRequestSchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
export type CreateCheckoutSessionRequest = z.infer<typeof CreateCheckoutSessionRequestSchema>;

export const CreateCheckoutSessionResponseSchema = z.object({
  url: z.string(),
});
export type CreateCheckoutSessionResponse = z.infer<typeof CreateCheckoutSessionResponseSchema>;

export const CreatePortalSessionResponseSchema = z.object({
  url: z.string(),
});
export type CreatePortalSessionResponse = z.infer<typeof CreatePortalSessionResponseSchema>;

// ─── Engine Comparison ───────────────────────────────────────────────────────

export const VectoriseAllResponseSchema = z.object({
  vtracer: z.string().nullable(),
  potrace: z.string().nullable(),
  vectoriser: z.string().nullable(),
  errors: z.object({
    vtracer: z.string().nullable(),
    potrace: z.string().nullable(),
    vectoriser: z.string().nullable(),
  }),
});
export type VectoriseAllResponse = z.infer<typeof VectoriseAllResponseSchema>;
