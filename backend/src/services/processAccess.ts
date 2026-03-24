import { prisma } from "../prisma";

export type ProcessReservationMode = "admin" | "credit" | "free_trial";

export type ProcessReservation =
  | {
      allowed: true;
      mode: ProcessReservationMode;
      trialConsumed: boolean;
    }
  | {
      allowed: false;
      status: number;
      error: {
        message: string;
        code: string;
      };
    };

export async function reserveProcessAccess(userId: string): Promise<ProcessReservation> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isAdmin: true, credits: true, freeTrialUsed: true },
  });

  if (!dbUser) {
    return {
      allowed: false,
      status: 401,
      error: { message: "Unauthorized", code: "UNAUTHORIZED" },
    };
  }

  if (dbUser.isAdmin) {
    return {
      allowed: true,
      mode: "admin",
      trialConsumed: false,
    };
  }

  const usedCredit = await prisma.user.updateMany({
    where: {
      id: userId,
      isAdmin: false,
      credits: { gt: 0 },
    },
    data: { credits: { decrement: 1 } },
  });

  if (usedCredit.count > 0) {
    return {
      allowed: true,
      mode: "credit",
      trialConsumed: false,
    };
  }

  const consumedTrial = await prisma.user.updateMany({
    where: {
      id: userId,
      isAdmin: false,
      credits: { lte: 0 },
      freeTrialUsed: false,
    },
    data: { freeTrialUsed: true },
  });

  if (consumedTrial.count > 0) {
    return {
      allowed: true,
      mode: "free_trial",
      trialConsumed: true,
    };
  }

  return {
    allowed: false,
    status: 402,
    error: {
      message: "Your free process has been used. Upgrade or buy credits to continue.",
      code: "FREE_TRIAL_EXHAUSTED",
    },
  };
}

export async function releaseProcessAccess(
  userId: string,
  mode: ProcessReservationMode
): Promise<void> {
  if (mode === "admin") return;

  if (mode === "credit") {
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: 1 } },
    });
    return;
  }

  await prisma.user.updateMany({
    where: { id: userId, freeTrialUsed: true },
    data: { freeTrialUsed: false },
  });
}
