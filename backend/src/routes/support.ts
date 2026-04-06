import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../prisma";
import { auth } from "../auth";
import {
  CreateSupportTicketMessageRequestSchema,
  CreateSupportTicketRequestSchema,
} from "../types";
import { mapSupportTicket, supportTicketInclude } from "../services/supportTickets";

type Variables = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};

export const supportRouter = new Hono<{ Variables: Variables }>();

supportRouter.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: { message: "Unauthorized", code: "UNAUTHORIZED" } }, 401);
  }

  await next();
});

supportRouter.get("/", async (c) => {
  const user = c.get("user")!;

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: supportTicketInclude,
  });

  return c.json({ data: tickets.map(mapSupportTicket) });
});

supportRouter.post(
  "/",
  zValidator("json", CreateSupportTicketRequestSchema),
  async (c) => {
    const user = c.get("user")!;
    const { subject, category, message } = c.req.valid("json");

    const ticket = await prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject,
        category,
        messages: {
          create: {
            authorUserId: user.id,
            authorRole: "user",
            body: message,
          },
        },
      },
      include: supportTicketInclude,
    });

    return c.json({ data: mapSupportTicket(ticket) });
  }
);

supportRouter.post(
  "/:id/messages",
  zValidator("json", CreateSupportTicketMessageRequestSchema),
  async (c) => {
    const user = c.get("user")!;
    const { id } = c.req.param();
    const { message } = c.req.valid("json");

    const existing = await prisma.supportTicket.findFirst({
      where: {
        id,
        userId: user.id,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!existing) {
      return c.json({ error: { message: "Support ticket not found", code: "NOT_FOUND" } }, 404);
    }

    await prisma.$transaction([
      prisma.supportMessage.create({
        data: {
          ticketId: existing.id,
          authorUserId: user.id,
          authorRole: "user",
          body: message,
        },
      }),
      prisma.supportTicket.update({
        where: { id: existing.id },
        data: {
          status: existing.status === "resolved" ? "open" : existing.status,
          updatedAt: new Date(),
        },
      }),
    ]);

    const ticket = await prisma.supportTicket.findUnique({
      where: { id: existing.id },
      include: supportTicketInclude,
    });

    if (!ticket) {
      return c.json({ error: { message: "Support ticket not found", code: "NOT_FOUND" } }, 404);
    }

    return c.json({ data: mapSupportTicket(ticket) });
  }
);
