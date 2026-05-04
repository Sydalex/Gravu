import { prisma } from "../prisma";
import { vectorizeLineworkWithCenterline } from "./centerlineLinework";
import { convertDxfToSvgString } from "./dxfSvg";
import {
  DEFAULT_OUTLINE_SETTINGS,
  convertSvgToDxfString,
  traceOutlineSvgFromBuffer,
} from "./outlineVectorizer";
import { sanitizeSvgContent } from "./svgSecurity";

export type MarketplaceVectorAsset = {
  id: string;
  imageBase64: string | null;
  svgContent: string | null;
  dxfContent: string | null;
  conversion?: {
    flowType: string;
  } | null;
};

export function canGenerateMarketplaceVectors(asset: MarketplaceVectorAsset) {
  return !!asset.svgContent || !!asset.dxfContent || !!asset.imageBase64;
}

async function generateFromImage(asset: MarketplaceVectorAsset) {
  if (!asset.imageBase64) {
    throw new Error("Asset has no PNG source for automatic vector export");
  }

  const imageBuffer = Buffer.from(asset.imageBase64, "base64");

  if (asset.conversion?.flowType === "full") {
    const centerline = await vectorizeLineworkWithCenterline(imageBuffer, {
      simplification: "mid",
      logPrefix: "marketplace-centerline",
    });

    return {
      svgContent: sanitizeSvgContent(convertDxfToSvgString(centerline.dxf)),
      dxfContent: centerline.dxf,
    };
  }

  const outlined = await traceOutlineSvgFromBuffer(imageBuffer, DEFAULT_OUTLINE_SETTINGS);
  return {
    svgContent: sanitizeSvgContent(outlined.svg),
    dxfContent: convertSvgToDxfString(outlined.svg),
  };
}

export async function ensureMarketplaceVectorFormats(asset: MarketplaceVectorAsset) {
  if (asset.svgContent && asset.dxfContent) {
    return {
      svgContent: sanitizeSvgContent(asset.svgContent),
      dxfContent: asset.dxfContent,
    };
  }

  let svgContent = asset.svgContent ? sanitizeSvgContent(asset.svgContent) : null;
  let dxfContent = asset.dxfContent;

  if (!svgContent && dxfContent) {
    svgContent = convertDxfToSvgString(dxfContent);
  }

  if (svgContent && !dxfContent) {
    try {
      dxfContent = convertSvgToDxfString(svgContent);
    } catch (error) {
      if (!asset.imageBase64) throw error;
      console.warn("[marketplace-vector-formats] Could not derive DXF from SVG, regenerating:", error);
      const generated = await generateFromImage(asset);
      svgContent = svgContent ?? generated.svgContent;
      dxfContent = generated.dxfContent;
    }
  }

  if (!svgContent || !dxfContent) {
    const generated = await generateFromImage(asset);
    svgContent = svgContent ?? generated.svgContent;
    dxfContent = dxfContent ?? generated.dxfContent;
  }

  const updateData: { svgContent?: string; dxfContent?: string } = {};
  if (!asset.svgContent && svgContent) updateData.svgContent = svgContent;
  if (!asset.dxfContent && dxfContent) updateData.dxfContent = dxfContent;

  if (Object.keys(updateData).length > 0) {
    const updated = await prisma.conversionAsset.update({
      where: { id: asset.id },
      data: updateData,
      select: {
        svgContent: true,
        dxfContent: true,
      },
    });

    return {
      svgContent: updated.svgContent ?? svgContent,
      dxfContent: updated.dxfContent ?? dxfContent,
    };
  }

  if (!svgContent || !dxfContent) {
    throw new Error("Could not generate marketplace vector formats");
  }

  return { svgContent, dxfContent };
}
