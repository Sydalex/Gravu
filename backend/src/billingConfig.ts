import { prisma } from "./prisma";
import { env } from "./env";

function configuredEnvProPriceId() {
  return env.STRIPE_PRO_PRICE_ID !== "price_placeholder_pro"
    ? env.STRIPE_PRO_PRICE_ID
    : null;
}

export async function getBillingConfig() {
  const config = await prisma.billingConfig.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      activeProPriceId: configuredEnvProPriceId(),
      activeCreditsPackAmount: 10,
    },
  });

  return {
    ...config,
    activeProPriceId: config.activeProPriceId ?? configuredEnvProPriceId(),
  };
}
