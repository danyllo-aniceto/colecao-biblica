import { CAMPAIGN_LEVELS } from "./campaign";
import { buildJourney } from "./journey";
import { flyTunnel, gap, gravitySpikes, platform, portal, spikeRow, wordAt } from "./segments";
import type { Level, LevelObject } from "./types";

/**
 * Treino rápido: uma fase curta que passa pelas 3 formas, escrita à mão, para sentir cada uma delas.
 * As fases bíblicas de verdade (docs/modo-corrida.md) são jornadas de minutos, cada uma com a sua trilha e o seu versículo.
 */
function quickTraining(): Level {
  const objects: LevelObject[] = [];
  let x = 14;
  // Corrida.
  x = spikeRow(objects, x, 1);
  x = gap(x, 8);
  x = spikeRow(objects, x, 2);
  x = gap(x, 8);
  x = platform(objects, x, 4, 1, 0);
  x = gap(x, 7);
  objects.push({ kind: "checkpoint", x: x - 3 });
  x = spikeRow(objects, x, 2);
  wordAt(objects, x - 1, 2, 1);
  x = gap(x, 8);
  x = platform(objects, x, 3, 1);
  x = platform(objects, x, 3, 2);
  x = gap(x, 6);
  x = spikeRow(objects, x, 1);
  x = gap(x, 10);
  // Voo.
  x = portal(objects, x, "FLY");
  x = gap(x, 8);
  objects.push({ kind: "checkpoint", x: x - 4 });
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
  objects.push({ kind: "checkpoint", x: x - 4 });
  x = gravitySpikes(objects, x, ["floor", "ceiling", "floor", "floor", "ceiling", "ceiling", "floor"]);
  x = gap(x, 6);
  return { id: "treino", name: "Treino rápido: as 3 formas", verse: { ref: "Treino", words: ["Corra", "voe", "inverta", "venha!"] }, form: "RUN", length: x, objects };
}

/** Protótipo da jornada: ~2 min 30 s alternando corrida, voo e gravidade, com o Salmo 23:1 escondido em palavras. */
function journey(): Level {
  return buildJourney({
    id: "jornada",
    name: "Jornada de teste (2 min 30 s)",
    seed: 23,
    seconds: 150,
    verse: { ref: "Salmos 23:1", words: ["O", "Senhor", "é", "o", "meu", "pastor;", "nada", "me", "faltará."] },
  });
}

export const LEVELS: Level[] = [journey(), quickTraining(), ...CAMPAIGN_LEVELS];

export function levelById(id: string): Level | undefined {
  return LEVELS.find((level) => level.id === id);
}
