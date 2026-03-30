import { prisma } from "../prisma";
import { normalizeLegacyCredits } from "./credits";

export type ProcessKind = "ai" | "vectorize";
export type ProcessReservationMode =
  | "admin"
  | "credit"
  | "free_trial";

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

export async function reserveProcessAccess(
  userId: string,
  _processKind: ProcessKind,
  deviceHash?: string
): Promise<ProcessReservation> {
  await normalizeLegacyCredits(userId);

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      isAdmin: true,
      credits: true,
      freeTrialUsed: true,
      emailVerified: true,
    },
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

  if (!dbUser.emailVerified) {
    return {
      allowed: false,
      status: 403,
      error: {
        message: "Verify your email before using the free process.",
        code: "EMAIL_NOT_VERIFIED",
      },
    };
  }

  if (!deviceHash) {
    return {
      allowed: false,
      status: 500,
      error: {
        message: "Missing trial device information.",
        code: "MISSING_TRIAL_DEVICE",
      },
    };
  }

  const claimedTrial = await prisma.$transaction(async (tx) => {
    const existingDevice = await tx.trialDevice.findUnique({
      where: { deviceHash },
    });

    if (existingDevice?.freeTrialUsed) {
      return false;
    }

    const consumedTrial = await tx.user.updateMany({
      where: {
        id: userId,
        isAdmin: false,
        credits: { lte: 0 },
        freeTrialUsed: false,
        emailVerified: true,
      },
      data: { freeTrialUsed: true },
    });

    if (consumedTrial.count === 0) {
      return false;
    }

    await tx.trialDevice.upsert({
      where: { deviceHash },
      update: {
        freeTrialUsed: true,
        firstUserId: userId,
      },
      create: {
        deviceHash,
        firstUserId: userId,
        freeTrialUsed: true,
      },
    });

    return true;
  });

  if (claimedTrial) {
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
      message: "Free trial unavailable for this account or device. Upgrade or buy credits to continue.",
      code: "FREE_TRIAL_EXHAUSTED",
    },
  };
}

export async function releaseProcessAccess(
  userId: string,
  mode: ProcessReservationMode,
  deviceHash?: string
): Promise<void> {
  if (mode === "admin") return;

  if (mode === "credit") {
    await prisma.user.update({
      where: { id: userId },
      data: { credits: { increment: 1 } },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: userId, freeTrialUsed: true },
      data: { freeTrialUsed: false },
    });

    if (deviceHash) {
      await tx.trialDevice.updateMany({
        where: { deviceHash, firstUserId: userId, freeTrialUsed: true },
        data: { freeTrialUsed: false },
      });
    }
  });
}
