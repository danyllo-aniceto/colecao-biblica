import type { Db } from "../db/prisma";

type ScenarioForAvatar = { id: number; slug: string; name: string; color: string | null; iconImageUrl: string | null; sortOrder: number; avatarCosmeticId: number | null };

/** Arte padrão do ícone (pasta public/campaign/<slug>/icon.png), usada quando nada foi enviado no painel. */
export const defaultScenarioIcon = (slug: string) => `/campaign/${slug}/icon.png`;

/**
 * Garante o ícone de perfil (AVATAR) do cenário e o mantém com a mesma arte do ícone do cenário.
 * Fica ligado ao cenário e é entregue com a relíquia.
 */
export async function ensureScenarioAvatar(db: Db, scenario: ScenarioForAvatar): Promise<number> {
  const imageUrl = scenario.iconImageUrl ?? defaultScenarioIcon(scenario.slug);
  if (scenario.avatarCosmeticId) {
    await db.cosmetic.updateMany({ where: { id: scenario.avatarCosmeticId }, data: { imageUrl } });
    return scenario.avatarCosmeticId;
  }
  const name = `Ícone: ${scenario.name}`;
  const found = await db.cosmetic.findFirst({ where: { type: "AVATAR", name }, select: { id: true } });
  const id =
    found?.id ??
    (
      await db.cosmetic.create({
        data: {
          type: "AVATAR",
          name,
          description: `Ícone de perfil do cenário ${scenario.name}.`,
          rarity: "EPIC",
          imageUrl,
          color: scenario.color,
          unlock: "REWARD",
          system: true,
          sortOrder: 850 + scenario.sortOrder / 10,
        },
      })
    ).id;
  if (found) await db.cosmetic.update({ where: { id }, data: { imageUrl } });
  await db.scenario.update({ where: { id: scenario.id }, data: { avatarCosmeticId: id } });
  return id;
}
