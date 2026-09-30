import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { prisma } from "../db/prisma";

// Cria (ou atualiza a senha/papel de) uma conta pelo terminal:
//   npm run create-user -- "Nome" email@exemplo.com senha ADMIN
// Sem argumentos, pergunta cada campo.
async function main() {
  const [argName, argEmail, argPassword, argRole] = process.argv.slice(2);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question: string, value?: string) => value ?? (await rl.question(question)).trim();

  const name = await ask("Nome: ", argName);
  const email = (await ask("E-mail: ", argEmail)).toLowerCase();
  const password = await ask("Senha (mínimo 8 caracteres): ", argPassword);
  const roleInput = (await ask("Papel (ADMIN/USER) [ADMIN]: ", argRole)).toUpperCase() || "ADMIN";
  rl.close();

  if (!name || !email || password.length < 8) {
    throw new Error("Informe nome, e-mail e uma senha com pelo menos 8 caracteres");
  }
  if (roleInput !== "ADMIN" && roleInput !== "USER") {
    throw new Error("Papel deve ser ADMIN ou USER");
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    create: { name, email, password: hash, role: roleInput, createdBy: "create-user", updatedBy: "create-user" },
    update: { name, password: hash, role: roleInput, deleted: false, deletedAt: null, deletedBy: null, updatedBy: "create-user" },
  });
  console.log(`Conta pronta: ${user.email} (${user.role})`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
