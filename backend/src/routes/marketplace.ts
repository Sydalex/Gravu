import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { MarketplaceSubmissionRequestSchema } from "../types";

const marketplaceRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

marketplaceRouter.get("/", async (c) => {
  const assets = await prisma.conversionAsset.findMany({
    where: {
      marketplaceStatus: "listed",
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      conversion: {
        select: {
          id: true,
          flowType: true,
          createdAt: true,
        },
      },
    },
  });

  return c.json({
    data: assets.map((asset) => ({
      id: asset.id,
      conversionId: asset.conversionId,
      subjectId: asset.subjectId,
      title: asset.marketplaceTitle ?? `Asset ${asset.subjectId}`,
      category: asset.marketplaceCategory ?? "Uncategorized",
      previewBase64: asset.imageBase64,
      svgContent: asset.svgContent,
      dxfContent: asset.dxfContent,
      flowType: asset.conversion.flowType,
      createdAt: asset.createdAt.toISOString(),
      hasSvg: !!asset.svgContent,
      hasDxf: !!asset.dxfContent,
      downloadCount: asset.marketplaceDownloadCount,
    })),
  });
});

marketplaceRouter.post(
  "/assets/:assetId/list",
  zValidator("json", MarketplaceSubmissionRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { assetId } = c.req.param();
    const { title, category } = c.req.valid("json");

    const asset = await prisma.conversionAsset.findFirst({
      where: {
        id: assetId,
        conversion: {
          userId: user.id,
        },
      },
      include: {
        conversion: {
          select: {
            flowType: true,
          },
        },
      },
    });

    if (!asset) {
      return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
    }

    const updated = await prisma.conversionAsset.update({
      where: { id: assetId },
      data: {
        marketplaceStatus: "pending_review",
        marketplaceTitle: title.trim(),
        marketplaceCategory: category.trim(),
      },
    });

    return c.json({
      data: {
        id: updated.id,
        title: updated.marketplaceTitle,
        category: updated.marketplaceCategory,
        marketplaceStatus: updated.marketplaceStatus,
        flowType: asset.conversion.flowType,
      },
    });
  }
);

marketplaceRouter.post("/assets/:assetId/unlist", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { assetId } = c.req.param();

  const asset = await prisma.conversionAsset.findFirst({
    where: {
      id: assetId,
      conversion: {
        userId: user.id,
      },
    },
  });

  if (!asset) {
    return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  }

  const updated = await prisma.conversionAsset.update({
    where: { id: assetId },
    data: {
      marketplaceStatus: "private",
    },
  });

  return c.json({
    data: {
      id: updated.id,
      marketplaceStatus: updated.marketplaceStatus,
    },
  });
});

export { marketplaceRouter };
