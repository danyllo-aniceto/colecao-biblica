import type { Db } from "../db/prisma";

/** Evento acontecendo agora (o primeiro a terminar, se houver mais de um). */
export async function activeEvent(db: Db, now = new Date()) {
  return db.gameEvent.findFirst({ where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } }, orderBy: { endsAt: "asc" } });
}
