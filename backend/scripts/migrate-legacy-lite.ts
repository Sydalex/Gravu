import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const apply = process.argv.includes("--apply");

async function main() {
  const candidates = await prisma.user.findMany({
    where: {
      liteActivatedAt: {
        not: null,
      },
      manualPlan: null,
      OR: [
        {
          subscription: {
            is: null,
          },
        },
        {
          subscription: {
            is: {
              status: {
                notIn: ["active", "trialing"],
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      email: true,
      liteActivatedAt: true,
      subscription: {
        select: {
          status: true,
          stripePriceId: true,
        },
      },
    },
    orderBy: {
      liteActivatedAt: "asc",
    },
  });

  console.log(
    `[legacy-lite] Found ${candidates.length} candidate account${candidates.length === 1 ? "" : "s"}`
  );

  if (!candidates.length) {
    return;
  }

  for (const candidate of candidates.slice(0, 20)) {
    console.log(
      [
        candidate.id,
        candidate.email,
        candidate.liteActivatedAt?.toISOString() ?? "no-lite-date",
        candidate.subscription?.status ?? "no-subscription",
        candidate.subscription?.stripePriceId ?? "no-price",
      ].join(" | ")
    );
  }

  if (!apply) {
    console.log(
      '[legacy-lite] Dry run only. Re-run with "--apply" to set manualPlan="lite" for these accounts.'
    );
    return;
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const result = await prisma.user.updateMany({
    where: {
      id: {
        in: candidateIds,
      },
      manualPlan: null,
    },
    data: {
      manualPlan: "lite",
    },
  });

  console.log(`[legacy-lite] Updated ${result.count} account${result.count === 1 ? "" : "s"}.`);
}

main()
  .catch((error) => {
    console.error("[legacy-lite] Migration failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
