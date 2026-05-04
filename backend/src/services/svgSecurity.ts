const MAX_SVG_LENGTH = 2_000_000;

const BLOCKED_ELEMENTS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
  "canvas",
  "image",
  "use",
  "animate",
  "set",
];

const URL_ATTR_PATTERN = /\s(?:href|xlink:href|src)\s*=\s*(["'])(.*?)\1/gi;
const UNSAFE_URL_PATTERN = /^\s*(?:javascript|data|vbscript):/i;

export function sanitizeSvgContent(svg: string): string {
  if (svg.length > MAX_SVG_LENGTH) {
    throw new Error("SVG content is too large");
  }

  let sanitized = svg.replace(/<\?xml[\s\S]*?\?>/gi, "");
  sanitized = sanitized.replace(/<!doctype[\s\S]*?>/gi, "");
  sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, "");

  for (const element of BLOCKED_ELEMENTS) {
    const paired = new RegExp(`<${element}\\b[\\s\\S]*?<\\/${element}>`, "gi");
    const selfClosing = new RegExp(`<${element}\\b[^>]*\\/?>`, "gi");
    sanitized = sanitized.replace(paired, "").replace(selfClosing, "");
  }

  sanitized = sanitized
    .replace(/\s+on[a-z]+\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s+style\s*=\s*(["'])[\s\S]*?\1/gi, "")
    .replace(URL_ATTR_PATTERN, (match, quote: string, value: string) =>
      UNSAFE_URL_PATTERN.test(value) ? "" : match
    );

  if (!/^\s*<svg[\s>]/i.test(sanitized)) {
    throw new Error("Invalid SVG content");
  }

  return sanitized;
}
