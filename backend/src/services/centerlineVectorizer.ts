/**
 * Centerline Vectorizer Service
 *
 * Integrates with the standalone `raster-dxf-centerline` Python vectorizer service
 * to convert raster images to centerline DXF format.
 *
 * Expected environment variable:
 * - CENTERLINE_VECTORIZER_URL: Base URL of the centerline vectorizer service
 *   Example: "http://localhost:5000" or "http://vectorizer-service:5000"
 */

function getCenterlineVectorizerUrl(): string {
  const url = process.env.CENTERLINE_VECTORIZER_URL;
  if (!url) {
    throw new Error(
      "CENTERLINE_VECTORIZER_URL is not configured. Please set this environment variable to point to your raster-dxf-centerline service."
    );
  }
  return url;
}

export type SimplificationLevel = "low" | "mid" | "high";

/**
 * Convert a raster image to centerline DXF format.
 *
 * @param imageBuffer - PNG/JPG image buffer
 * @returns Promise resolving to { dxf: string } containing the DXF content
 * @throws Error if vectorizer service is unavailable or returns invalid data
 */
export async function vectorizeCenterline(
  imageBuffer: Buffer,
  options: { simplification?: SimplificationLevel } = {},
): Promise<{ dxf: string }> {
  const baseUrl = getCenterlineVectorizerUrl();
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/vectorize/dxf?include_fill=false`;
  const simplification = options.simplification ?? "mid";

  // Build multipart form data with the image
  const formData = new FormData();
  const blob = new Blob([imageBuffer], { type: "image/png" });
  formData.append("file", blob, "image.png");
  formData.append("simplification", simplification);
  formData.append("export_mode", "hybrid");

  try {
    console.log(`[centerlineVectorizer] Calling ${endpoint} with simplification=${simplification}`);

    const response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "(unknown error)");
      console.error(
        `[centerlineVectorizer] Service returned ${response.status}: ${errorText}`
      );
      throw new Error(
        `Centerline vectorizer service failed with status ${response.status}`
      );
    }

    const raw = await response.text();
    const dxf = raw.trim();

    if (!dxf.length || !dxf.includes("SECTION") || !dxf.includes("ENTITIES")) {
      console.error(
        "[centerlineVectorizer] Response does not contain valid DXF content"
      );
      throw new Error("Centerline vectorizer returned invalid DXF content");
    }

    return { dxf };
  } catch (err) {
    if (err instanceof Error) {
      console.error(`[centerlineVectorizer] Error: ${err.message}`);
      throw err;
    }
    throw new Error(`[centerlineVectorizer] Unexpected error: ${String(err)}`);
  }
}
