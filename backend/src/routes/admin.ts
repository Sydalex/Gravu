import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { stripe } from "../stripe";
import { getBillingConfig } from "../billingConfig";
import { env } from "../env";
import type { auth } from "../auth";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const adminRouter = new Hono<{ Variables: Variables }>();

const AdjustCreditsSchema = z.object({
  amount: z.number(),
  operation: z.enum(["add", "set"]),
});

const CreatePromoCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(32)
      .regex(/^[a-zA-Z0-9_-]+$/, "Use only letters, numbers, dashes, or underscores"),
    percentOff: z.number().positive().max(100),
    duration: z.enum(["once", "forever", "repeating"]).default("once"),
    durationInMonths: z.number().int().positive().max(24).optional(),
    maxRedemptions: z.number().int().positive().max(10_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.duration === "repeating" && !value.durationInMonths) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["durationInMonths"],
        message: "Duration in months is required for repeating promo codes",
      });
    }
  });

const CreateProductSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
});

const CreatePriceSchema = z
  .object({
    productId: z.string().min(1),
    amount: z.number().positive(),
    currency: z.string().trim().min(3).max(3).default("eur"),
    mode: z.enum(["recurring", "one_time"]),
    interval: z.enum(["day", "week", "month", "year"]).optional(),
    nickname: z.string().trim().max(80).optional(),
    creditsAmount: z.number().int().positive().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "recurring" && !value.interval) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["interval"],
        message: "Recurring prices require an interval",
      });
    }
  });

const UpdateBillingConfigSchema = z.object({
  activeProPriceId: z.string().min(1).nullable().optional(),
  activeCreditsPackPriceId: z.string().min(1).nullable().optional(),
  activeCreditsPackAmount: z.number().int().positive().max(10_000).optional(),
});

const CreateRefundSchema = z.object({
  chargeId: z.string().min(1),
  amount: z.number().int().positive().optional(),
});

function requireStripeConfigured() {
  return !!stripe;
}

function formatStripeError(error: unknown) {
  return error instanceof Error ? error.message : "Stripe request failed";
}

function mapPromotionCode(promo: any) {
  const legacyCoupon = typeof promo.coupon === "string" ? null : promo.coupon;
  const promotionCoupon =
    typeof promo.promotion?.coupon === "string"
      ? null
      : promo.promotion?.coupon ?? null;
  const coupon = promotionCoupon ?? legacyCoupon;
  return {
    id: promo.id,
    code: promo.code,
    active: promo.active,
    percentOff: coupon?.percent_off ?? null,
    duration: coupon?.duration ?? null,
    durationInMonths: coupon?.duration_in_months ?? null,
    timesRedeemed: promo.times_redeemed ?? 0,
    maxRedemptions: promo.max_redemptions ?? null,
    expiresAt: promo.expires_at ? new Date(promo.expires_at * 1000).toISOString() : null,
  };
}

function mapProduct(product: any) {
  return {
    id: product.id,
    name: product.name,
    description: product.description ?? null,
    active: product.active,
    defaultPriceId:
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price?.id ?? null,
    createdAt: product.created ? new Date(product.created * 1000).toISOString() : null,
  };
}

function mapPrice(price: any) {
  const product = typeof price.product === "string" ? null : price.product;
  return {
    id: price.id,
    productId: product?.id ?? (typeof price.product === "string" ? price.product : null),
    productName: product?.name ?? null,
    active: price.active,
    unitAmount: price.unit_amount ?? null,
    currency: price.currency,
    type: price.recurring ? "recurring" : "one_time",
    interval: price.recurring?.interval ?? null,
    nickname: price.nickname ?? null,
    creditsAmount: price.metadata?.creditsAmount ? Number(price.metadata.creditsAmount) : null,
  };
}

async function clearArchivedPricesFromBillingConfig(priceIds: string[]) {
  if (!priceIds.length) return;

  const config = await prisma.billingConfig.findUnique({
    where: { id: "default" },
  });

  if (!config) return;

  const update: {
    activeProPriceId?: string | null;
    activeCreditsPackPriceId?: string | null;
  } = {};

  if (config.activeProPriceId && priceIds.includes(config.activeProPriceId)) {
    update.activeProPriceId = null;
  }

  if (
    config.activeCreditsPackPriceId &&
    priceIds.includes(config.activeCreditsPackPriceId)
  ) {
    update.activeCreditsPackPriceId = null;
  }

  if (Object.keys(update).length > 0) {
    await prisma.billingConfig.update({
      where: { id: "default" },
      data: update,
    });
  }
}

async function getUserBillingDetails(userId: string) {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true,
      subscription: true,
    },
  });

  if (!dbUser) return null;

  if (!stripe || !dbUser.stripeCustomerId) {
    return {
      customerId: dbUser.stripeCustomerId,
      portalAvailable: false,
      subscriptions: [],
      charges: [],
    };
  }

  const [subscriptions, charges] = await Promise.all([
    stripe.subscriptions.list({
      customer: dbUser.stripeCustomerId,
      status: "all",
      limit: 5,
    }),
    stripe.charges.list({
      customer: dbUser.stripeCustomerId,
      limit: 8,
    }),
  ]);

  return {
    customerId: dbUser.stripeCustomerId,
    portalAvailable: true,
    subscriptions: subscriptions.data.map((subscription) => ({
      id: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
        : null,
      priceId: subscription.items.data[0]?.price?.id ?? null,
    })),
    charges: charges.data.map((charge) => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      paid: charge.paid,
      refunded: charge.refunded,
      amountRefunded: charge.amount_refunded,
      createdAt: new Date(charge.created * 1000).toISOString(),
      receiptUrl: charge.receipt_url,
    })),
  };
}

// Admin guard — every route requires isAdmin
adminRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  await next();
});

// GET /api/admin/stats — dashboard statistics
adminRouter.get("/stats", async (c) => {
  const [totalUsers, proSubscribers, totalConversions] = await Promise.all([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: { in: ["active", "trialing"] } },
    }),
    prisma.conversion.count(),
  ]);

  const mrr = proSubscribers * 9;

  return c.json({
    data: { totalUsers, proSubscribers, totalConversions, mrr },
  });
});

// GET /api/admin/users — list all users with plan + conversion count
adminRouter.get("/users", async (c) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      subscription: true,
      _count: { select: { conversions: true } },
    },
  });

  const data = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.createdAt.toISOString(),
    isAdmin: u.isAdmin,
    credits: u.credits,
    stripeCustomerId: u.stripeCustomerId,
    subscriptionStatus: u.subscription?.status ?? null,
    currentPeriodEnd: u.subscription?.currentPeriodEnd?.toISOString() ?? null,
    plan:
      u.subscription?.status === "active" || u.subscription?.status === "trialing"
        ? "pro"
        : "free",
    conversionCount: u._count.conversions,
  }));

  return c.json({ data });
});

// POST /api/admin/users/:id/credits — adjust user credits
adminRouter.post(
  "/users/:id/credits",
  zValidator("json", AdjustCreditsSchema),
  async (c) => {
    const { id } = c.req.param();
    const { amount, operation } = c.req.valid("json");

    const updated = await prisma.user.update({
      where: { id },
      data: {
        credits: operation === "add" ? { increment: amount } : amount,
      },
      select: { id: true, credits: true },
    });

    return c.json({ data: updated });
  }
);

// GET /api/admin/billing — Stripe status, prices, promo codes, and active config
adminRouter.get("/billing", async (c) => {
  const config = await getBillingConfig();

  if (!requireStripeConfigured()) {
    return c.json({
      data: {
        stripeEnabled: false,
        liveMode: env.STRIPE_SECRET?.startsWith("sk_live_") ?? false,
        activeConfig: config,
        recentPromotionCodes: [],
        products: [],
        prices: [],
      },
    });
  }

  const [promotionCodes, products, prices] = await Promise.all([
    stripe!.promotionCodes.list({
      limit: 20,
      expand: ["data.promotion.coupon"],
    }),
    stripe!.products.list({
      limit: 50,
    }),
    stripe!.prices.list({
      limit: 50,
      expand: ["data.product"],
    }),
  ]);

  return c.json({
      data: {
        stripeEnabled: true,
        liveMode: env.STRIPE_SECRET?.startsWith("sk_live_") ?? false,
        activeConfig: config,
        recentPromotionCodes: promotionCodes.data.map(mapPromotionCode),
        products: products.data.map(mapProduct),
        prices: prices.data.map(mapPrice),
    },
  });
});

// POST /api/admin/billing/products — create a Stripe product
adminRouter.post(
  "/billing/products",
  zValidator("json", CreateProductSchema),
  async (c) => {
    if (!requireStripeConfigured()) {
      return c.json(
        {
          error: {
            message: "Stripe is not configured for this environment",
            code: "BILLING_NOT_CONFIGURED",
          },
        },
        503
      );
    }

    const { name, description } = c.req.valid("json");

    try {
      const product = await stripe!.products.create({
        name,
        description,
      });

      return c.json({ data: mapProduct(product) });
    } catch (error) {
      return c.json(
        {
          error: {
            message: formatStripeError(error),
            code: "STRIPE_ERROR",
          },
        },
        400
      );
    }
  }
);

// POST /api/admin/billing/products/:id/archive — archive a Stripe product
adminRouter.post("/billing/products/:id/archive", async (c) => {
  if (!requireStripeConfigured()) {
    return c.json(
      {
        error: {
          message: "Stripe is not configured for this environment",
          code: "BILLING_NOT_CONFIGURED",
        },
      },
      503
    );
  }

  const { id } = c.req.param();

  try {
    const productPrices = await stripe!.prices.list({
      product: id,
      limit: 100,
    });

    await clearArchivedPricesFromBillingConfig(productPrices.data.map((price) => price.id));

    const product = await stripe!.products.update(id, {
      active: false,
    });

    return c.json({ data: mapProduct(product) });
  } catch (error) {
    return c.json(
      {
        error: {
          message: formatStripeError(error),
          code: "STRIPE_ERROR",
        },
      },
      400
    );
  }
});

// POST /api/admin/billing/prices — create a Stripe price
adminRouter.post(
  "/billing/prices",
  zValidator("json", CreatePriceSchema),
  async (c) => {
    if (!requireStripeConfigured()) {
      return c.json(
        {
          error: {
            message: "Stripe is not configured for this environment",
            code: "BILLING_NOT_CONFIGURED",
          },
        },
        503
      );
    }

    const { productId, amount, currency, mode, interval, nickname, creditsAmount } =
      c.req.valid("json");

    try {
      const price = await stripe!.prices.create({
        product: productId,
        unit_amount: amount,
        currency: currency.toLowerCase(),
        nickname,
        recurring: mode === "recurring" ? { interval: interval! } : undefined,
        metadata: creditsAmount ? { creditsAmount: String(creditsAmount) } : undefined,
      });

      const hydrated = await stripe!.prices.retrieve(price.id, { expand: ["product"] });
      return c.json({ data: mapPrice(hydrated) });
    } catch (error) {
      return c.json(
        {
          error: {
            message: formatStripeError(error),
            code: "STRIPE_ERROR",
          },
        },
        400
      );
    }
  }
);

// POST /api/admin/billing/prices/:id/archive — archive a Stripe price
adminRouter.post("/billing/prices/:id/archive", async (c) => {
  if (!requireStripeConfigured()) {
    return c.json(
      {
        error: {
          message: "Stripe is not configured for this environment",
          code: "BILLING_NOT_CONFIGURED",
        },
      },
      503
    );
  }

  const { id } = c.req.param();

  try {
    const price = await stripe!.prices.update(id, {
      active: false,
    });

    await clearArchivedPricesFromBillingConfig([id]);

    const hydrated = await stripe!.prices.retrieve(price.id, { expand: ["product"] });
    return c.json({ data: mapPrice(hydrated) });
  } catch (error) {
    return c.json(
      {
        error: {
          message: formatStripeError(error),
          code: "STRIPE_ERROR",
        },
      },
      400
    );
  }
});

// POST /api/admin/billing/config — set active app billing prices
adminRouter.post(
  "/billing/config",
  zValidator("json", UpdateBillingConfigSchema),
  async (c) => {
    const { activeProPriceId, activeCreditsPackPriceId, activeCreditsPackAmount } =
      c.req.valid("json");

    const updated = await prisma.billingConfig.upsert({
      where: { id: "default" },
      update: {
        ...(activeProPriceId !== undefined ? { activeProPriceId } : {}),
        ...(activeCreditsPackPriceId !== undefined
          ? { activeCreditsPackPriceId }
          : {}),
        ...(activeCreditsPackAmount !== undefined
          ? { activeCreditsPackAmount }
          : {}),
      },
      create: {
        id: "default",
        activeProPriceId: activeProPriceId ?? null,
        activeCreditsPackPriceId: activeCreditsPackPriceId ?? null,
        activeCreditsPackAmount: activeCreditsPackAmount ?? 10,
      },
    });

    return c.json({ data: updated });
  }
);

// POST /api/admin/billing/promo-codes/:id/deactivate — deactivate a promotion code
adminRouter.post("/billing/promo-codes/:id/deactivate", async (c) => {
  if (!requireStripeConfigured()) {
    return c.json(
      {
        error: {
          message: "Stripe is not configured for this environment",
          code: "BILLING_NOT_CONFIGURED",
        },
      },
      503
    );
  }

  const { id } = c.req.param();

  try {
    const promotionCode = await stripe!.promotionCodes.update(id, {
      active: false,
    });

    const expandedPromotionCode = await stripe!.promotionCodes.retrieve(
      promotionCode.id,
      {
        expand: ["promotion.coupon"],
      }
    );

    return c.json({ data: mapPromotionCode(expandedPromotionCode) });
  } catch (error) {
    return c.json(
      {
        error: {
          message: formatStripeError(error),
          code: "STRIPE_ERROR",
        },
      },
      400
    );
  }
});

// POST /api/admin/billing/promo-codes — create a new Stripe promotion code
adminRouter.post(
  "/billing/promo-codes",
  zValidator("json", CreatePromoCodeSchema),
  async (c) => {
    if (!requireStripeConfigured()) {
      return c.json(
        {
          error: {
            message: "Stripe is not configured for this environment",
            code: "BILLING_NOT_CONFIGURED",
          },
        },
        503
      );
    }

    const { code, percentOff, duration, durationInMonths, maxRedemptions } =
      c.req.valid("json");

    try {
      const coupon = await stripe!.coupons.create({
        percent_off: percentOff,
        duration,
        duration_in_months:
          duration === "repeating" ? durationInMonths : undefined,
        name: `Admin promo ${code.toUpperCase()}`,
      });

      const promotionCode = await stripe!.promotionCodes.create({
        promotion: {
          type: "coupon",
          coupon: coupon.id,
        },
        code: code.toUpperCase(),
        max_redemptions: maxRedemptions,
      });

      const expandedPromotionCode = await stripe!.promotionCodes.retrieve(
        promotionCode.id,
        {
          expand: ["promotion.coupon"],
        }
      );

      return c.json({ data: mapPromotionCode(expandedPromotionCode) });
    } catch (error) {
      return c.json(
        {
          error: {
            message: formatStripeError(error),
            code: "STRIPE_ERROR",
          },
        },
        400
      );
    }
  }
);

// GET /api/admin/billing/users/:id — selected user billing details
adminRouter.get("/billing/users/:id", async (c) => {
  const { id } = c.req.param();
  const details = await getUserBillingDetails(id);

  if (!details) {
    return c.json(
      { error: { message: "User not found", code: "NOT_FOUND" } },
      404
    );
  }

  return c.json({ data: details });
});

// POST /api/admin/billing/users/:id/portal — open billing portal for a customer
adminRouter.post("/billing/users/:id/portal", async (c) => {
  if (!requireStripeConfigured()) {
    return c.json(
      {
        error: {
          message: "Stripe is not configured for this environment",
          code: "BILLING_NOT_CONFIGURED",
        },
      },
      503
    );
  }

  const { id } = c.req.param();
  const user = await prisma.user.findUnique({
    where: { id },
    select: { stripeCustomerId: true },
  });

  if (!user?.stripeCustomerId) {
    return c.json(
      {
        error: {
          message: "No Stripe customer found for this user",
          code: "NO_CUSTOMER",
        },
      },
      400
    );
  }

  const body = (await c.req.json().catch(() => ({}))) as { returnUrl?: string };
  const returnUrl = body.returnUrl ?? `${new URL(c.req.url).origin}/admin`;

  const session = await stripe!.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: returnUrl,
  });

  return c.json({ data: { url: session.url } });
});

// POST /api/admin/billing/users/:id/refunds — create a refund for a charge
adminRouter.post(
  "/billing/users/:id/refunds",
  zValidator("json", CreateRefundSchema),
  async (c) => {
    if (!requireStripeConfigured()) {
      return c.json(
        {
          error: {
            message: "Stripe is not configured for this environment",
            code: "BILLING_NOT_CONFIGURED",
          },
        },
        503
      );
    }

    const { id } = c.req.param();
    const { chargeId, amount } = c.req.valid("json");

    const user = await prisma.user.findUnique({
      where: { id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return c.json(
        {
          error: {
            message: "No Stripe customer found for this user",
            code: "NO_CUSTOMER",
          },
        },
        400
      );
    }

    const charge = await stripe!.charges.retrieve(chargeId);
    if (charge.customer !== user.stripeCustomerId) {
      return c.json(
        {
          error: {
            message: "Charge does not belong to this user",
            code: "INVALID_CHARGE",
          },
        },
        400
      );
    }

    try {
      const refund = await stripe!.refunds.create({
        charge: chargeId,
        amount,
      });

      return c.json({
        data: {
          id: refund.id,
          status: refund.status,
          amount: refund.amount,
          currency: refund.currency,
        },
      });
    } catch (error) {
      return c.json(
        {
          error: {
            message: formatStripeError(error),
            code: "STRIPE_ERROR",
          },
        },
        400
      );
    }
  }
);
