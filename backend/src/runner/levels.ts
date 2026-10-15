import { flyTunnel, gap, gravitySpikes, platform, portal, spikeRow, wordAt } from "./segments";
import type { Level, LevelObject } from "./types";

/**
 * Protótipo: uma fase curta que passa pelas 3 formas (corrida, voo, gravidade) para testar o toque.
 * As fases bíblicas de verdade entram depois (docs/modo-corrida.md); cada uma com a sua trilha e o seu versículo.
 */
function prototype(): Level {
  const objects: LevelObject[] = [];
  let x = 14;
  // Corrida.
  x = spikeRow(objects, x, 1);
  x = gap(x, 8);
  x = spikeRow(objects, x, 2);
  x = gap(x, 8);
  x = platform(objects, x, 4, 1, 0);
  x = gap(x, 7);
  x = spikeRow(objects, x, 3);
  wordAt(objects, x - 2, 2, 1);
  x = gap(x, 8);
  x = platform(objects, x, 3, 1);
  x = platform(objects, x, 3, 2);
  x = gap(x, 6);
  x = spikeRow(objects, x, 1);
  x = gap(x, 10);
  // Voo.
  x = portal(objects, x, "FLY");
  x = gap(x, 8);
  x = flyTunnel(objects, x, [
    { floor: 1, ceil: 2, word: 2 },
    { floor: 2, ceil: 2 },
    { floor: 3, ceil: 1 },
    { floor: 1, ceil: 3 },
    { floor: 2, ceil: 1, word: 3 },
    { floor: 0, ceil: 2 },
  ]);
  x = gap(x, 4);
  // Gravidade.
  x = portal(objects, x, "GRAVITY");
  x = gap(x, 8);
  x = gravitySpikes(objects, x, ["floor", "ceiling", "floor", "floor", "ceiling", "ceiling", "floor"]);
  x = gap(x, 6);
  return { id: "prototipo", name: "Protótipo: as 3 formas", form: "RUN", length: x, objects };
}

export const LEVELS: Level[] = [prototype()];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}
