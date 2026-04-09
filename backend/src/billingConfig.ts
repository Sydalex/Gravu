import { prisma } from "./prisma";
import { env } from "./env";

function configuredEnvLitePriceId() {
  return env.STRIPE_LITE_PRICE_ID !== "price_placeholder_lite"
    ? env.STRIPE_LITE_PRICE_ID
    : null;
}

function configuredEnvProPriceId() {
  return env.STRIPE_PRO_PRICE_ID !== "price_placeholder_pro"
    ? env.STRIPE_PRO_PRICE_ID
    : null;
}

function configuredEnvExpertPriceId() {
  return env.STRIPE_EXPERT_PRICE_ID !== "price_placeholder_expert"
    ? env.STRIPE_EXPERT_PRICE_ID
    : null;
}

export async function getBillingConfig() {
  const config = await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      activeLitePriceId: configuredEnvLitePriceId(),
      activeProPriceId: configuredEnvProPriceId(),
      activeExpertPriceId: configuredEnvExpertPriceId(),
      activeCreditsPackAmount: 10,
    },
  });

  return {
    ...config,
    activeLitePriceId: config.activeLitePriceId ?? configuredEnvLitePriceId(),
    activeProPriceId: config.activeProPriceId ?? configuredEnvProPriceId(),
    activeExpertPriceId: config.activeExpertPriceId ?? configuredEnvExpertPriceId(),
  };
}
