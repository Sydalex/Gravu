import { prisma } from "../prisma";

type CreditLike = {
  credits?: number | null;
  vectorizeCredits?: number | null;
};

export function getUnifiedCredits(balance: CreditLike | null | undefined) {
  return (balance?.credits ?? 0) + (balance?.vectorizeCredits ?? 0);
}

export async function normalizeLegacyCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      credits: true,
      vectorizeCredits: true,
    },
  });

  if (!user) {
    return null;
  }

  if ((user.vectorizeCredits ?? 0) <= 0) {
    return user;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      credits: { increment: user.vectorizeCredits },
      vectorizeCredits: 0,
    },
    select: {
      credits: true,
      vectorizeCredits: true,
    },
  });
}
