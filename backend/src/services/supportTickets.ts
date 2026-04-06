import type { Prisma } from "@prisma/client";

export const supportTicketInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  messages: {
    orderBy: {
      createdAt: "asc",
    },
    include: {
      authorUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
} satisfies Prisma.SupportTicketInclude;

export type SupportTicketWithRelations = Prisma.SupportTicketGetPayload<{
  include: typeof supportTicketInclude;
}>;

export function mapSupportTicket(ticket: SupportTicketWithRelations) {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    user: {
      id: ticket.user.id,
      name: ticket.user.name,
      email: ticket.user.email,
    },
    messages: ticket.messages.map((message) => ({
      id: message.id,
      ticketId: message.ticketId,
      body: message.body,
      authorRole: message.authorRole,
      authorName: message.authorUser?.name ?? null,
      authorEmail: message.authorUser?.email ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
  };
}
