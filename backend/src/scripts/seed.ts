import "dotenv/config";
import { prisma } from "../db/prisma";
import { runSeed } from "../services/seed";

// Roda em todo deploy (npm run vercel-build) e pode ser executado à mão: npm run seed.
async function main() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  await runSeed(prisma, {
    demoData: process.env.SEED_DEMO_DATA === "true",
    admin: adminEmail
      ? { email: adminEmail, password: process.env.ADMIN_PASSWORD ?? "", name: process.env.ADMIN_NAME?.trim() || "Administrador" }
      : undefined,
    log: (message) => console.log(`[seed] ${message}`),
  });
  console.log("[seed] Dados iniciais conferidos");
}

main()
  .catch((error) => {
    console.error("[seed] Falhou:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
