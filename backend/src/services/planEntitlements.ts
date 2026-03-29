import { prisma } from "../prisma";

export type AppPlan = "free" | "lite" | "pro" | "expert";

type BillingConfigShape = {
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
  aiCreditsOnInvoicePaid: number;
  vectorizeCreditsOnInvoicePaid: number;
  marketplaceDownloadLimit: number | null;
  autoSubmitToMarketplace: boolean;
};

const PLAN_ENTITLEMENTS: Record<AppPlan, PlanEntitlement> = {
  free: {
    aiCreditsOnInvoicePaid: 0,
    vectorizeCreditsOnInvoicePaid: 0,
    marketplaceDownloadLimit: 5,
    autoSubmitToMarketplace: true,
  },
  lite: {
    aiCreditsOnInvoicePaid: 0,
    vectorizeCreditsOnInvoicePaid: 0,
    marketplaceDownloadLimit: 5,
    autoSubmitToMarketplace: true,
  },
  pro: {
    aiCreditsOnInvoicePaid: 40,
    vectorizeCreditsOnInvoicePaid: 30,
    marketplaceDownloadLimit: 30,
    autoSubmitToMarketplace: true,
  },
  expert: {
    aiCreditsOnInvoicePaid: 150,
    vectorizeCreditsOnInvoicePaid: 150,
    marketplaceDownloadLimit: null,
    autoSubmitToMarketplace: false,
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
  liteActivatedAt,
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
      billingConfig.activeExpertPriceId &&
      subscriptionPriceId === billingConfig.activeExpertPriceId
    ) {
      return "expert";
    }

    return "pro";
  }

  if (liteActivatedAt) {
    return "lite";
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
    aiCredits: entitlements.aiCreditsOnInvoicePaid,
    vectorizeCredits: entitlements.vectorizeCreditsOnInvoicePaid,
  };
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
