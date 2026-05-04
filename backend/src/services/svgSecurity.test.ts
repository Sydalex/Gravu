import { describe, expect, test } from "bun:test";
import { sanitizeSvgContent } from "./svgSecurity";

describe("sanitizeSvgContent", () => {
  test("removes executable SVG content", () => {
    const sanitized = sanitizeSvgContent(`
      <svg viewBox="0 0 10 10" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><div>bad</div></foreignObject>
        <path d="M0 0L10 10" onclick="alert(1)" style="background:url(javascript:alert(1))" />
        <a href="javascript:alert(1)"><path d="M1 1L2 2" /></a>
      </svg>
    `);

    expect(sanitized).toContain("<svg");
    expect(sanitized).toContain("<path");
    expect(sanitized).not.toContain("<script");
    expect(sanitized).not.toContain("foreignObject");
    expect(sanitized).not.toContain("onload");
    expect(sanitized).not.toContain("onclick");
    expect(sanitized).not.toContain("javascript:");
    expect(sanitized).not.toContain("style=");
  });

  test("rejects non-svg markup", () => {
    expect(() => sanitizeSvgContent("<div>not svg</div>")).toThrow("Invalid SVG content");
  });
});
