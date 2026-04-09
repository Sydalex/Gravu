import { prisma } from "../prisma";

export type AppPlan = "free" | "lite" | "pro" | "expert";

type BillingConfigShape = {
  activeLitePriceId?: string | null;
  activeProPriceId?: string | null;
  activeExpertPriceId?: string | null;
};

type ResolvePlanInput = {
  manualPlan?: string | null;
  liteActivatedAt?: Date | string | null;
  subscriptionStatus?: string | null;
  subscriptionPriceId?: string | null;
  billingConfig: BillingConfigShape;
};

type PlanEntitlement = {
  creditsOnInvoicePaid: number;
  marketplaceDownloadLimit: number | null;
  autoSubmitToMarketplace: boolean;
  featureFlags: {
    multiAngleBeta: boolean;
    aiPromptRefinementBeta: boolean;
  };
};

const PLAN_ENTITLEMENTS: Record<AppPlan, PlanEntitlement> = {
  free: {
    creditsOnInvoicePaid: 0,
    marketplaceDownloadLimit: 0,
    autoSubmitToMarketplace: true,
    featureFlags: {
      multiAngleBeta: false,
      aiPromptRefinementBeta: false,
    },
  },
  lite: {
    creditsOnInvoicePaid: 20,
    marketplaceDownloadLimit: 20,
    autoSubmitToMarketplace: true,
    featureFlags: {
      multiAngleBeta: false,
      aiPromptRefinementBeta: false,
    },
  },
  pro: {
    creditsOnInvoicePaid: 70,
    marketplaceDownloadLimit: 50,
    autoSubmitToMarketplace: true,
    featureFlags: {
      multiAngleBeta: false,
      aiPromptRefinementBeta: false,
    },
  },
  expert: {
    creditsOnInvoicePaid: 300,
    marketplaceDownloadLimit: null,
    autoSubmitToMarketplace: false,
    featureFlags: {
      multiAngleBeta: true,
      aiPromptRefinementBeta: true,
    },
  },
};

export function normalizePlan(plan?: string | null): AppPlan | null {
  if (plan === "free" || plan === "lite" || plan === "pro" || plan === "expert") {
    return plan;
  }

  return null;
}

export function resolveAppPlan({
  manualPlan,
  subscriptionStatus,
  subscriptionPriceId,
  billingConfig,
}: ResolvePlanInput): AppPlan {
  const normalizedManualPlan = normalizePlan(manualPlan);
  if (normalizedManualPlan) {
    return normalizedManualPlan;
  }

  if (subscriptionStatus === "active" || subscriptionStatus === "trialing") {
    if (
      billingConfig.activeLitePriceId &&
      subscriptionPriceId === billingConfig.activeLitePriceId
    ) {
      return "lite";
    }

    if (
      billingConfig.activeExpertPriceId &&
      subscriptionPriceId === billingConfig.activeExpertPriceId
    ) {
      return "expert";
    }

    return "pro";
  }

  return "free";
}

export function getPlanEntitlements(plan: AppPlan): PlanEntitlement {
  return PLAN_ENTITLEMENTS[plan];
}

export function getMarketplaceDefaultStatus(plan: AppPlan) {
  return PLAN_ENTITLEMENTS[plan].autoSubmitToMarketplace ? "pending_review" : "private";
}

export function getMarketplaceDownloadLimit(plan: AppPlan) {
  return PLAN_ENTITLEMENTS[plan].marketplaceDownloadLimit;
}

export function getMarketplaceDownloadsRemaining(plan: AppPlan, used: number) {
  const limit = getMarketplaceDownloadLimit(plan);
  if (limit === null) {
    return null;
  }

  return Math.max(limit - used, 0);
}

export function getMonthlyPlanGrants(plan: AppPlan) {
  const entitlements = getPlanEntitlements(plan);
  return {
    credits: entitlements.creditsOnInvoicePaid,
  };
}

export function getPlanFeatureFlags(plan: AppPlan) {
  return getPlanEntitlements(plan).featureFlags;
}

function isSameCalendarMonth(a: Date, b: Date) {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth();
}

export async function syncMarketplaceDownloadWindow(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      marketplaceDownloadsUsed: true,
      marketplaceDownloadsPeriodStart: true,
    },
  });

  if (!user) {
    return null;
  }

  const now = new Date();
  if (isSameCalendarMonth(user.marketplaceDownloadsPeriodStart, now)) {
    return user;
  }

  return prisma.user.update({
    where: { id: userId },
    data: {
      marketplaceDownloadsUsed: 0,
      marketplaceDownloadsPeriodStart: now,
    },
    select: {
      marketplaceDownloadsUsed: true,
      marketplaceDownloadsPeriodStart: true,
    },
  });
}
