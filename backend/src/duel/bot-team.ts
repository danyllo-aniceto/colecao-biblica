import { shuffled } from "./rng";
import { TEAM_SIZE, type CardDef, type TeamCard } from "./types";

/**
 * Time do bot: 12 cartas sorteadas entre as disponíveis, com uma curva de Vigor razoável (ao menos 3 cartas baratas de Vigor
 * 1 a 2 e 2 de Vigor 4 ou mais, quando existirem), para o bot não travar a mão. `level` é o nível das figurinhas (1 a 5).
 */
export function botTeam(cards: CardDef[], seed: number, level = 1): TeamCard[] | null {
  const pool = cards.filter((card) => !card.token);
  if (pool.length < TEAM_SIZE) return null;
  const mixed = shuffled(pool, seed >>> 0);
  const picked: CardDef[] = [];
  const take = (matches: (card: CardDef) => boolean, count: number) => {
    for (const card of mixed.items) {
      if (picked.length >= TEAM_SIZE || count <= 0) return;
      if (!picked.includes(card) && matches(card)) {
        picked.push(card);
        count -= 1;
      }
    }
  };
  take((card) => card.cost <= 2, 3);
  take((card) => card.cost >= 4, 2);
  take(() => true, TEAM_SIZE - picked.length);
  return picked.map((def) => ({ def, level }));
}
