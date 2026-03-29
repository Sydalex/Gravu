import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import { CreateConversionRequestSchema, UpdateAssetRequestSchema } from "../types";
import { getBillingConfig } from "../billingConfig";
import { getMarketplaceDefaultStatus, resolveAppPlan } from "../services/planEntitlements";

const conversionsRouter = new Hono<{
  Variables: {
    user: typeof auth.$Infer.Session.user | null;
    session: typeof auth.$Infer.Session.session | null;
  };
}>();

// POST /api/conversions — create a new conversion with its assets
conversionsRouter.post(
  "/",
  zValidator("json", CreateConversionRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { flowType, name, originalImageBase64, assets } = c.req.valid("json");
    const [billingConfig, dbUser, activeSubscription] = await Promise.all([
      getBillingConfig(),
      prisma.user.findUnique({
        where: { id: user.id },
        select: {
          manualPlan: true,
          liteActivatedAt: true,
        },
      }),
      prisma.subscription.findUnique({
        where: { userId: user.id },
        select: {
          status: true,
          stripePriceId: true,
        },
      }),
    ]);
    const plan = resolveAppPlan({
      manualPlan: dbUser?.manualPlan,
      liteActivatedAt: dbUser?.liteActivatedAt,
      subscriptionStatus: activeSubscription?.status,
      subscriptionPriceId: activeSubscription?.stripePriceId,
      billingConfig,
    });
    const marketplaceStatus = getMarketplaceDefaultStatus(plan);

    const conversion = await prisma.$transaction(async (tx) => {
      const created = await tx.conversion.create({
        data: {
          userId: user.id,
          flowType,
          name: name ?? null,
          originalImageBase64: originalImageBase64 ?? null,
          assets: {
            create: assets.map((a) => ({
              subjectId: a.subjectId,
              imageBase64: a.imageBase64 ?? null,
              svgContent: a.svgContent ?? null,
              dxfContent: a.dxfContent ?? null,
              marketplaceStatus,
              marketplaceTitle: a.title?.trim() || name?.trim() || `Asset ${a.subjectId}`,
              marketplaceCategory: marketplaceStatus === "private" ? null : "Uncategorized",
            })),
          },
        },
        include: { assets: true },
      });
      return created;
    });

    return c.json({
      data: {
        id: conversion.id,
        flowType: conversion.flowType,
        name: conversion.name,
        createdAt: conversion.createdAt.toISOString(),
        assets: conversion.assets.map((a) => ({
          id: a.id,
          conversionId: a.conversionId,
          subjectId: a.subjectId,
          title: a.marketplaceTitle,
          imageBase64: a.imageBase64,
          svgContent: a.svgContent,
          dxfContent: a.dxfContent,
          marketplaceStatus: a.marketplaceStatus,
          marketplaceTitle: a.marketplaceTitle,
          marketplaceCategory: a.marketplaceCategory,
          marketplaceDownloadCount: a.marketplaceDownloadCount,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    });
  }
);

// GET /api/conversions — list all conversions for the current user (no large fields)
conversionsRouter.get("/", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const conversions = await prisma.conversion.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      assets: {
        select: {
          id: true,
          conversionId: true,
          subjectId: true,
          marketplaceTitle: true,
          createdAt: true,
          // Fetch imageBase64 only for the first asset thumbnail — handled below
          imageBase64: true,
        },
      },
    },
  });

  const data = conversions.map((conv) => {
    const thumbnailBase64 = conv.assets[0]?.imageBase64 ?? null;

    return {
        id: conv.id,
        userId: conv.userId,
        flowType: conv.flowType,
        name: conv.name,
      originalImageBase64: conv.originalImageBase64,
      createdAt: conv.createdAt.toISOString(),
      thumbnailBase64,
      assets: conv.assets.map((a) => ({
        id: a.id,
        conversionId: a.conversionId,
        subjectId: a.subjectId,
        title: a.marketplaceTitle,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });

  return c.json({ data });
});

// GET /api/conversions/:id — get a single conversion with all asset data
conversionsRouter.get("/:id", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { id } = c.req.param();

  const conversion = await prisma.conversion.findFirst({
    where: { id, userId: user.id },
    include: { assets: true },
  });

  if (!conversion) {
    return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  }

  return c.json({
    data: {
      id: conversion.id,
      userId: conversion.userId,
      flowType: conversion.flowType,
      name: conversion.name,
      originalImageBase64: conversion.originalImageBase64,
      createdAt: conversion.createdAt.toISOString(),
      assets: conversion.assets.map((a) => ({
        id: a.id,
        conversionId: a.conversionId,
        subjectId: a.subjectId,
        title: a.marketplaceTitle,
        imageBase64: a.imageBase64,
        svgContent: a.svgContent,
        dxfContent: a.dxfContent,
        marketplaceStatus: a.marketplaceStatus,
        marketplaceTitle: a.marketplaceTitle,
        marketplaceCategory: a.marketplaceCategory,
        marketplaceDownloadCount: a.marketplaceDownloadCount,
        createdAt: a.createdAt.toISOString(),
      })),
    },
  });
});

// PATCH /api/conversions/:id/assets/:assetId — update svgContent and/or dxfContent on an asset
conversionsRouter.patch(
  "/:id/assets/:assetId",
  zValidator("json", UpdateAssetRequestSchema),
  async (c) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
    }

    const { id, assetId } = c.req.param();
    const { svgContent, dxfContent } = c.req.valid("json");

    // Verify the conversion exists and belongs to the current user
    const conversion = await prisma.conversion.findFirst({
      where: { id, userId: user.id },
    });

    if (!conversion) {
      return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
    }

    // Build update payload — only include fields that were provided
    const updateData: { svgContent?: string; dxfContent?: string } = {};
    if (svgContent !== undefined) updateData.svgContent = svgContent;
    if (dxfContent !== undefined) updateData.dxfContent = dxfContent;

    const asset = await prisma.conversionAsset.update({
      where: { id: assetId, conversionId: id },
      data: updateData,
      select: { id: true, svgContent: true, dxfContent: true },
    });

    return c.json({
      data: {
        id: asset.id,
        svgContent: asset.svgContent,
        dxfContent: asset.dxfContent,
      },
    });
  }
);

// DELETE /api/conversions/:id — delete a conversion (and its assets via cascade)
conversionsRouter.delete("/:id", async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const { id } = c.req.param();

  const conversion = await prisma.conversion.findFirst({
    where: { id, userId: user.id },
  });

  if (!conversion) {
    return c.json({ error: { message: "Not found", code: "NOT_FOUND" } }, 404);
  }

  await prisma.conversion.delete({ where: { id } });

  return new Response(null, { status: 204 });
});

export { conversionsRouter };
