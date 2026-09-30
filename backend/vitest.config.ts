import { defineConfig } from "vitest/config";

// Testes de integração da API só rodam com um banco de teste descartável:
//   TEST_DATABASE_URL="postgresql://.../colecao_biblica_test" npm test
const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    fileParallelism: false,
    globalSetup: testDatabaseUrl ? ["./src/test/global-setup.ts"] : [],
    env: {
      JWT_SECRET: "segredo-de-teste-com-mais-de-32-caracteres",
      APP_TIMEZONE: "America/Sao_Paulo",
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl, DATABASE_URL_UNPOOLED: testDatabaseUrl } : {}),
    },
  },
});
