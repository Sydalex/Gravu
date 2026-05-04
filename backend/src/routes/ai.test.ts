import { describe, expect, test } from "bun:test";
import { buildPromptForMode, getPromptProfileId } from "./ai";

describe("linework prompt profiles", () => {
  test("uses current faceless source-locked profile IDs", () => {
    expect(getPromptProfileId("illustration")).toBe("illustration-faceless-source-locked-bw-v10");
    expect(getPromptProfileId("vectorworks_centerline")).toBe(
      "vectorworks-faceless-source-locked-bw-v11"
    );
  });

  test("locks architectural entourage to blank faces and source pose", () => {
    const prompt = buildPromptForMode("vectorworks_centerline", {
      viewDescription: "front view",
      selectedDescs: ["architectural entourage group of walking figures"],
      enforceSelectedOnly: true,
      detailLevel: "mid",
    });

    expect(prompt).toContain("blank contour areas");
    expect(prompt).toContain("Never use generic face placeholders");
    expect(prompt).toContain("two dots");
    expect(prompt).toContain("dash mouth");
    expect(prompt).toContain("Preserve the exact number of visible people");
    expect(prompt).toContain("left-to-right order");
    expect(prompt).toContain("original pose");
  });

  test("illustration mode also bans symbolic facial shorthand", () => {
    const prompt = buildPromptForMode("illustration", {
      viewDescription: "side view",
      selectedDescs: ["two pedestrians"],
      detailLevel: "low",
    });

    expect(prompt).toContain("Never substitute facial placeholders");
    expect(prompt).toContain("dots");
    expect(prompt).toContain("dash mouths");
    expect(prompt).toContain("Preserve the exact number of visible people");
  });
});
