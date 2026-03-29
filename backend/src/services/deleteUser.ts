import { prisma } from "../prisma";
import { stripe } from "../stripe";

async function cancelStripeSubscriptionForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      stripeSubscriptionId: true,
      status: true,
    },
  });

  if (!subscription?.stripeSubscriptionId || !stripe) {
    return;
  }

  if (["canceled", "incomplete_expired", "unpaid"].includes(subscription.status)) {
    return;
  }

  await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
}

export async function deleteUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
    },
  });

  if (!user) {
    return null;
  }

  await cancelStripeSubscriptionForUser(user.id);

  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: { identifier: user.email },
    }),
    prisma.user.delete({
      where: { id: user.id },
    }),
  ]);

  return user;
}
