import { Prisma, PrismaClient } from "@prisma/client";

// Reaproveitado entre invocações da função serverless enquanto a instância estiver quente.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/** Cliente normal ou o de uma transação em andamento. */
export type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Transação com folga de tempo: no Neon o banco pode estar "dormindo" e a
 * primeira conexão demora alguns segundos.
 */
export function transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn, { maxWait: 10_000, timeout: 20_000 });
}

/** Trava a linha do usuário até o fim da transação (moedas e bônus não ficam inconsistentes com cliques duplos). */
export async function lockUser(tx: Prisma.TransactionClient, userId: number) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}
