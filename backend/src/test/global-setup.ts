import { execSync } from "node:child_process";

/** Recria o banco de teste do zero com as migrações. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL!;
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_URL_UNPOOLED: url },
  });
}
