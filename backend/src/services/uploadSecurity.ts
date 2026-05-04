import sharp from "sharp";

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 25_000_000;

const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
]);

export function assertSupportedImageFile(file: File) {
  if (file.size <= 0) {
    throw new Error("Uploaded file is empty");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Uploaded file is too large");
  }

  if (file.type && !ALLOWED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error("Unsupported image type");
  }
}

export async function assertSafeImageBuffer(buffer: Buffer) {
  const metadata = await sharp(buffer, {
    failOn: "none",
    limitInputPixels: MAX_IMAGE_PIXELS,
  }).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid image");
  }

  if (width * height > MAX_IMAGE_PIXELS) {
    throw new Error("Image dimensions are too large");
  }

  return metadata;
}
