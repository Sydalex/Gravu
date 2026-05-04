import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import {
  MarketplaceDownloadRequestSchema,
  MarketplaceSubmissionRequestSchema,
} from "../types";
import { getBillingConfig } from "../billingConfig";
import {
  getMarketplaceDownloadsRemaining,
  resolveAppPlan,
  syncMarketplaceDownloadWindow,
} from "../services/planEntitlements";
import {
  canGenerateMarketplaceVectors,
  ensureMarketplaceVectorFormats,
} from "../services/marketplaceVectorFormats";
import { sanitizeSvgContent } from "../services/svgSecurity";

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
      flowType: asset.conversion.flowType,
      createdAt: asset.createdAt.toISOString(),
      hasSvg: !!asset.svgContent || canGenerateMarketplaceVectors(asset),
      hasDxf: !!asset.dxfContent || canGenerateMarketplaceVectors(asset),
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

marketplaceRouter.post(
  "/assets/:assetId/download",
  zValidator("json", MarketplaceDownloadRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { assetId } = c.req.param();
    const { format } = c.req.valid("json");

    const [billingConfig, dbUser, activeSubscription, asset, syncedDownloads] = await Promise.all([
      getBillingConfig(),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          isAdmin: true,
          manualPlan: true,
          liteActivatedAt: true,
          marketplaceDownloadsUsed: true,
          marketplaceDownloadsPeriodStart: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId: user.id },
        select: { status: true, stripePriceId: true },
      }),
      prisma.conversionAsset.findFirst({
        where: {
          id: assetId,
          marketplaceStatus: "listed",
        },
        include: {
          conversion: {
            select: {
              flowType: true,
            },
          },
        },
      }),
      syncMarketplaceDownloadWindow(user.id),
    ]);

    if (!dbUser) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    if (!asset) {
      return c.json({ error: { message: "Asset not found", code: "NOT_FOUND" } }, 404);
    }

    const plan = resolveAppPlan({
      manualPlan: dbUser.manualPlan,
      liteActivatedAt: dbUser.liteActivatedAt,
      subscriptionStatus: activeSubscription?.status,
      subscriptionPriceId: activeSubscription?.stripePriceId,
      billingConfig,
    });
    const downloadsUsed =
      syncedDownloads?.marketplaceDownloadsUsed ?? dbUser.marketplaceDownloadsUsed;
    const downloadsPeriodStart =
      syncedDownloads?.marketplaceDownloadsPeriodStart ?? dbUser.marketplaceDownloadsPeriodStart;
    const downloadsRemaining = dbUser.isAdmin
      ? null
      : getMarketplaceDownloadsRemaining(plan, downloadsUsed);
    const alreadyDownloadedThisPeriod =
      dbUser.isAdmin || downloadsRemaining === null
        ? false
        : !!(await prisma.marketplaceAssetDownload.findUnique({
            where: {
              userId_assetId_periodStart: {
                userId: dbUser.id,
                assetId: asset.id,
                periodStart: downloadsPeriodStart,
              },
            },
            select: { id: true },
          }));

    if (
      !dbUser.isAdmin &&
      downloadsRemaining !== null &&
      downloadsRemaining <= 0 &&
      !alreadyDownloadedThisPeriod
    ) {
      return c.json(
        {
          error: {
            message: "Marketplace download limit reached for this month. Upgrade to continue downloading.",
            code: "MARKETPLACE_DOWNLOAD_LIMIT",
          },
        },
        402
      );
    }

    let svgContent = asset.svgContent ? sanitizeSvgContent(asset.svgContent) : null;
    let dxfContent = asset.dxfContent;

    if ((format === "svg" && !svgContent) || (format === "dxf" && !dxfContent)) {
      try {
        const ensured = await ensureMarketplaceVectorFormats(asset);
        svgContent = ensured.svgContent;
        dxfContent = ensured.dxfContent;
      } catch (error) {
        console.error("[marketplace-download] Failed to auto-generate vector formats:", error);
        return c.json(
          {
            error: {
              message: "Could not generate this marketplace format automatically.",
              code: "FORMAT_GENERATION_FAILED",
            },
          },
          500,
        );
      }
    }

    if (format === "png" && !asset.imageBase64) {
      return c.json({ error: { message: "PNG unavailable", code: "FORMAT_UNAVAILABLE" } }, 404);
    }

    if (format === "svg" && !svgContent) {
      return c.json({ error: { message: "SVG unavailable", code: "FORMAT_UNAVAILABLE" } }, 404);
    }

    if (format === "dxf" && !dxfContent) {
      return c.json({ error: { message: "DXF unavailable", code: "FORMAT_UNAVAILABLE" } }, 404);
    }

    await prisma.$transaction([
      prisma.conversionAsset.update({
        where: { id: asset.id },
        data: {
          marketplaceDownloadCount: { increment: 1 },
        },
      }),
      ...(dbUser.isAdmin || downloadsRemaining === null || alreadyDownloadedThisPeriod
        ? []
        : [
            prisma.marketplaceAssetDownload.create({
              data: {
                userId: dbUser.id,
                assetId: asset.id,
                periodStart: downloadsPeriodStart,
              },
            }),
            prisma.user.update({
              where: { id: dbUser.id },
              data: {
                marketplaceDownloadsUsed: { increment: 1 },
              },
            }),
          ]),
    ]);

    const payload =
      format === "png"
        ? {
            mimeType: "image/png",
            content: asset.imageBase64!,
          }
        : format === "svg"
          ? {
              mimeType: "image/svg+xml",
              content: sanitizeSvgContent(svgContent!),
            }
          : {
              mimeType: "application/dxf",
              content: dxfContent!,
            };

    return c.json({
      data: {
        title: asset.marketplaceTitle ?? `Asset ${asset.subjectId}`,
        format,
        mimeType: payload.mimeType,
        content: payload.content,
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
