import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import type { auth } from "../auth";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const adminRouter = new Hono<{ Variables: Variables }>();

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
    plan:
      u.subscription?.status === "active" || u.subscription?.status === "trialing"
        ? "pro"
        : "free",
    conversionCount: u._count.conversions,
  }));

  return c.json({ data });
});

// POST /api/admin/users/:id/credits — adjust user credits
const AdjustCreditsSchema = z.object({
  amount: z.number(),
  operation: z.enum(["add", "set"]),
});

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
