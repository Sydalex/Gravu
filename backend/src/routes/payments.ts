import { Hono } from "hono";
import type { Context, Next } from "hono";
import { zValidator } from "@hono/zod-validator";
import { stripe } from "../stripe";
import { prisma } from "../prisma";
import { env } from "../env";
import { getBillingConfig } from "../billingConfig";
import type { auth } from "../auth";
import {
  getDeviceTrialUsed,
  getOrCreateTrialDeviceToken,
  hashTrialDeviceToken,
} from "../services/trialDevice";
import {
  getMarketplaceDownloadLimit,
  getMarketplaceDownloadsRemaining,
  getMonthlyPlanGrants,
  resolveAppPlan,
  syncMarketplaceDownloadWindow,
} from "../services/planEntitlements";
import {
  CreateCheckoutSessionRequestSchema,
  BuyCreditsRequestSchema,
  type SubscriptionStatus,
} from "../types";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const paymentsRouter = new Hono<{ Variables: Variables }>();

// Auth guard middleware
paymentsRouter.use("*", async (c, next) => {
  // Skip auth guard for webhook endpoint
  if (c.req.path.endsWith("/webhook")) {
    await next();
    return;
  }
  const user = c.get("user");
  if (!user) return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  await next();
});

// Billing guard – returns 503 when STRIPE_SECRET is not configured
async function requireStripe(c: Context, next: Next) {
  if (!stripe) {
    return c.json(
      { error: { message: "Billing features are disabled. Configure STRIPE_SECRET in your environment to enable subscription and credit purchases.", code: "BILLING_NOT_CONFIGURED" } },
      503
    );
  }
  return next();
}

paymentsRouter.use("/checkout", requireStripe);
paymentsRouter.use("/buy-credits", requireStripe);
paymentsRouter.use("/portal", requireStripe);
paymentsRouter.use("/webhook", requireStripe);

// GET /api/payments/subscription — get current user's subscription status
paymentsRouter.get("/subscription", async (c) => {
  const user = c.get("user")!;
  const billingConfig = await getBillingConfig();
  const deviceToken = getOrCreateTrialDeviceToken(c);
  const deviceHash = hashTrialDeviceToken(deviceToken);

  const [dbUser, subscription, syncedDownloads] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeCustomerId: true,
        credits: true,
        vectorizeCredits: true,
        freeTrialUsed: true,
        isAdmin: true,
        manualPlan: true,
        liteActivatedAt: true,
        marketplaceDownloadsUsed: true,
      },
    }),
    prisma.subscription.findUnique({
      where: { userId: user.id },
    }),
    syncMarketplaceDownloadWindow(user.id),
  ]);

  const deviceTrialUsed = await getDeviceTrialUsed(deviceHash);
  const plan = resolveAppPlan({
    manualPlan: dbUser?.manualPlan,
    liteActivatedAt: dbUser?.liteActivatedAt,
    subscriptionStatus: subscription?.status,
    subscriptionPriceId: subscription?.stripePriceId,
    billingConfig,
  });
  const marketplaceDownloadsUsed =
    syncedDownloads?.marketplaceDownloadsUsed ??
    dbUser?.marketplaceDownloadsUsed ??
    0;
  const marketplaceDownloadsLimit = dbUser?.isAdmin
    ? null
    : getMarketplaceDownloadLimit(plan);

  const status: SubscriptionStatus = {
    plan,
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    stripeCustomerId: dbUser?.stripeCustomerId ?? null,
    credits: dbUser?.credits ?? 0,
    aiCredits: dbUser?.credits ?? 0,
    vectorizeCredits: dbUser?.vectorizeCredits ?? 0,
    marketplaceDownloadsUsed,
    marketplaceDownloadsRemaining:
      dbUser?.isAdmin
        ? null
        : getMarketplaceDownloadsRemaining(plan, marketplaceDownloadsUsed),
    marketplaceDownloadsLimit,
    freeTrialUsed: dbUser?.freeTrialUsed ?? false,
    deviceTrialUsed,
    isAdmin: dbUser?.isAdmin ?? false,
    billingEnabled: !!stripe,
    activeProPriceId: billingConfig.activeProPriceId ?? null,
    activeExpertPriceId: billingConfig.activeExpertPriceId ?? null,
    activeCreditsPackPriceId: billingConfig.activeCreditsPackPriceId ?? null,
    activeCreditsPackAmount: billingConfig.activeCreditsPackPriceId
      ? billingConfig.activeCreditsPackAmount
      : null,
  };

  return c.json({ data: status });
});

// POST /api/payments/checkout — create Stripe checkout session
paymentsRouter.post(
  "/checkout",
  zValidator("json", CreateCheckoutSessionRequestSchema),
  async (c) => {
    const user = c.get("user")!;
    const { priceId, successUrl, cancelUrl } = c.req.valid("json");

    // Get or create Stripe customer
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        stripeCustomerId: true,
        email: true,
        name: true,
      },
    });

    let customerId = dbUser?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe!.customers.create({
        email: dbUser?.email ?? user.email,
        name: dbUser?.name ?? user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe!.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId: user.id },
      },
    });

    if (!session.url) {
      return c.json({ error: { message: "Failed to create checkout session", code: "STRIPE_ERROR" } }, 500);
    }

    return c.json({ data: { url: session.url } });
  }
);

// POST /api/payments/buy-credits — create one-time Stripe checkout session for credit packs
paymentsRouter.post(
  "/buy-credits",
  zValidator("json", BuyCreditsRequestSchema),
  async (c) => {
    const user = c.get("user")!;
    const { credits, priceId, successUrl, cancelUrl } = c.req.valid("json");

    // Get or create Stripe customer
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeCustomerId: true, email: true, name: true },
    });

    let customerId = dbUser?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe!.customers.create({
        email: dbUser?.email ?? user.email,
        name: dbUser?.name ?? user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe!.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        userId: user.id,
        creditAmount: String(credits),
      },
    });

    if (!session.url) {
      return c.json({ error: { message: "Failed to create checkout session", code: "STRIPE_ERROR" } }, 500);
    }

    return c.json({ data: { url: session.url } });
  }
);

// POST /api/payments/portal — create Stripe billing portal session
paymentsRouter.post("/portal", async (c) => {
  const user = c.get("user")!;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true },
  });

  if (!dbUser?.stripeCustomerId) {
    return c.json({ error: { message: "No billing account found", code: "NO_CUSTOMER" } }, 400);
  }

  const body = await c.req.json().catch(() => ({})) as { returnUrl?: string };

  const portalSession = await stripe!.billingPortal.sessions.create({
    customer: dbUser.stripeCustomerId,
    return_url: body.returnUrl ?? `${c.req.url.split("/api")[0]}/account`,
  });

  return c.json({ data: { url: portalSession.url } });
});

// POST /api/payments/webhook — handle Stripe webhooks
paymentsRouter.post("/webhook", async (c) => {
  const body = await c.req.text();
  const sig = c.req.header("stripe-signature");

  let event: import("stripe").Stripe.Event;

  if (env.STRIPE_WEBHOOK_SECRET && sig) {
    try {
      event = stripe!.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      return c.json({ error: { message: "Webhook signature verification failed" } }, 400);
    }
  } else {
    // Dev mode: skip signature verification
    try {
      event = JSON.parse(body) as import("stripe").Stripe.Event;
    } catch {
      return c.json({ error: { message: "Invalid JSON body" } }, 400);
    }
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;

      const firstItem = sub.items.data[0];
      const priceId = firstItem?.price?.id ?? "";
      const periodStart = firstItem?.current_period_start ?? sub.billing_cycle_anchor;
      const periodEnd = firstItem?.current_period_end ?? sub.billing_cycle_anchor;
      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status,
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
        update: {
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status,
          currentPeriodStart: new Date(periodStart * 1000),
          currentPeriodEnd: new Date(periodEnd * 1000),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        },
      });
      break;
    }
    case "customer.subscription.deleted": {
      const sub = event.data.object as import("stripe").Stripe.Subscription;
      const userId = sub.metadata?.userId;
      if (!userId) break;
      await prisma.subscription.updateMany({
        where: { userId },
        data: { status: "canceled" },
      });
      break;
    }
    case "invoice.paid": {
      const invoice = event.data.object as import("stripe").Stripe.Invoice;
      // Only handle subscription invoices (not one-time purchases)
      const subscriptionRef = invoice.parent?.subscription_details?.subscription ?? null;
      if (!subscriptionRef) break;
      const customerId = invoice.customer as string;
      const dbUser = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!dbUser) break;
      const stripeSubscription = await stripe!.subscriptions.retrieve(subscriptionRef);
      const subscriptionPriceId = stripeSubscription.items.data[0]?.price?.id ?? null;
      const billingConfig = await getBillingConfig();
      const plan = resolveAppPlan({
        manualPlan: dbUser.manualPlan,
        liteActivatedAt: dbUser.liteActivatedAt,
        subscriptionStatus: stripeSubscription.status,
        subscriptionPriceId,
        billingConfig,
      });
      const grants = getMonthlyPlanGrants(plan);
      if (grants.aiCredits <= 0 && grants.vectorizeCredits <= 0) {
        break;
      }
      await prisma.user.update({
        where: { id: dbUser.id },
        data: {
          credits: { increment: grants.aiCredits },
          vectorizeCredits: { increment: grants.vectorizeCredits },
        },
      });
      console.log(
        `[webhook] Granted ${grants.aiCredits} AI credits and ${grants.vectorizeCredits} vectorize credits to user ${dbUser.id} for invoice ${invoice.id}`
      );
      break;
    }
    case "checkout.session.completed": {
      const session = event.data.object as import("stripe").Stripe.Checkout.Session;
      const customerId = session.customer as string;

      // Handle one-time credit pack purchases
      if (session.mode === "payment" && session.metadata?.creditAmount) {
        const creditAmount = parseInt(session.metadata.creditAmount, 10);
        if (!isNaN(creditAmount) && creditAmount > 0) {
          const dbUser = await prisma.user.findFirst({
            where: { stripeCustomerId: customerId },
            select: {
              id: true,
              liteActivatedAt: true,
            },
          });
          if (dbUser) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                credits: { increment: creditAmount },
                liteActivatedAt: dbUser.liteActivatedAt ?? new Date(),
              },
            });
            console.log(`[webhook] Granted ${creditAmount} credits to user ${dbUser.id} for one-time purchase`);
          }
        }
        break;
      }

      // Handle subscription checkout completion
      const subscriptionId = session.subscription as string;
      if (customerId && subscriptionId) {
        const dbUser = await prisma.user.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (dbUser) {
          const stripeSub = await stripe!.subscriptions.retrieve(subscriptionId);
          const firstItem = stripeSub.items.data[0];
          const priceId = firstItem?.price?.id ?? "";
          const periodStart = firstItem?.current_period_start ?? stripeSub.billing_cycle_anchor;
          const periodEnd = firstItem?.current_period_end ?? stripeSub.billing_cycle_anchor;
          await prisma.subscription.upsert({
            where: { userId: dbUser.id },
            create: {
              userId: dbUser.id,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              status: stripeSub.status,
              currentPeriodStart: new Date(periodStart * 1000),
              currentPeriodEnd: new Date(periodEnd * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            },
            update: {
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              status: stripeSub.status,
              currentPeriodStart: new Date(periodStart * 1000),
              currentPeriodEnd: new Date(periodEnd * 1000),
              cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
            },
          });
        }
      }
      break;
    }
  }

  return c.json({ data: { received: true } });
});
