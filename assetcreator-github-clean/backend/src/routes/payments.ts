import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { stripe } from "../stripe";
import { prisma } from "../prisma";
import { env } from "../env";
import type { auth } from "../auth";
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

// GET /api/payments/subscription — get current user's subscription status
paymentsRouter.get("/subscription", async (c) => {
  const user = c.get("user")!;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { stripeCustomerId: true, credits: true, isAdmin: true },
  });

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
  });

  const status: SubscriptionStatus = {
    plan: subscription?.status === "active" || subscription?.status === "trialing" ? "pro" : "free",
    status: subscription?.status ?? null,
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    stripeCustomerId: dbUser?.stripeCustomerId ?? null,
    credits: dbUser?.credits ?? 0,
    isAdmin: dbUser?.isAdmin ?? false,
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
      select: { stripeCustomerId: true, email: true, name: true },
    });

    let customerId = dbUser?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
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

    const session = await stripe.checkout.sessions.create({
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
      const customer = await stripe.customers.create({
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

    const session = await stripe.checkout.sessions.create({
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

  const portalSession = await stripe.billingPortal.sessions.create({
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
      event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET);
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
      // Grant 30 credits on each successful subscription payment
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { credits: { increment: 30 } },
      });
      console.log(`[webhook] Granted 30 credits to user ${dbUser.id} for invoice ${invoice.id}`);
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
          });
          if (dbUser) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: { credits: { increment: creditAmount } },
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
          const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
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
