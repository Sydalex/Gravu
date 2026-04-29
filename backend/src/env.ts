import { z } from "zod";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),

  // Custom allowed CORS/auth origin for your production domain
  // e.g. https://app.example.com  (leave blank for localhost-only dev)
  ALLOWED_ORIGIN: z.string().optional(),

  // Gemini AI API
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_IMAGE_MODEL: z.string().optional().default("gemini-3-pro-image-preview"),

  // OpenAI image generation/editing API
  AI_IMAGE_PROVIDER: z.enum(["auto", "openai", "gemini"]).optional().default("auto"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_IMAGE_MODEL: z.string().optional().default("gpt-image-2"),
  OPENAI_IMAGE_QUALITY: z.enum(["low", "medium", "high", "auto"]).optional().default("medium"),
  OPENAI_IMAGE_SIZE: z
    .enum(["auto", "1024x1024", "1536x1024", "1024x1536"])
    .optional()
    .default("auto"),
  OPENAI_IMAGE_INPUT_FIDELITY: z.enum(["high", "low"]).optional().default("high"),

  // Vectoriser.AI API
  VECTORISER_AI_API_ID: z.string().optional(),
  VECTORISER_AI_API_SECRET: z.string().optional(),

  // Centerline vectorizer
  // Base URL for the Python raster-to-DXF centerline service (e.g. http://127.0.0.1:8001)
  CENTERLINE_VECTORIZER_URL: z.string().optional(),

  // Database
  DATABASE_URL: z.string().default("file:./dev.db"),

  // Better Auth
  BETTER_AUTH_SECRET: z.string().min(1, "BETTER_AUTH_SECRET is required"),
  // Base URL of the backend (used by Better Auth for callbacks/redirects)
  // Defaults to http://localhost:3000 in development
  BETTER_AUTH_URL: z.string().optional(),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),

  // SMTP – optional; if not set, OTP codes are printed to the server console
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),

  // Stripe (optional – only required when billing features are enabled)
  STRIPE_SECRET: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_LITE_PRICE_ID: z.string().default("price_placeholder_lite"),
  STRIPE_PRO_PRICE_ID: z.string().default("price_placeholder_pro"),
  STRIPE_EXPERT_PRICE_ID: z.string().default("price_placeholder_expert"),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = z.infer<typeof envSchema>;

/**
 * Extend process.env with our environment variables
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line import/namespace
    interface ProcessEnv extends z.infer<typeof envSchema> {}
  }
}
