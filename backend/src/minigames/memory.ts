import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome, type Random } from "./common";
import { SIZE_LABEL, SIZE_SCALE, sizeMaxScore, TIME_GRACE, type SizeLevel } from "./turns";

/**
 * Memória: cartas viradas para baixo; ache os pares de imagens iguais: a foto de um personagem ou o mapa de um cenário (o nome aparece ao achar o par).
 * O nível define quantos pares (6, 8, 12 ou 18) e por quantos segundos as cartas aparecem no começo para memorizar.
 */
export const MEMORY_LEVELS: Record<SizeLevel, { pairs: number; peek: number; par: number }> = {
  facil: { pairs: 6, peek: 4, par: 60 },
  medio: { pairs: 8, peek: 3, par: 100 },
  dificil: { pairs: 12, peek: 2, par: 180 },
  mestre: { pairs: 18, peek: 2, par: 300 },
};
export const TIME_CHOICES = [90, 150, 240, 360] as const;
export const MIN_PAIRS = 4;
/** Sem achar todos os pares (tempo esgotado), cada par achado vale uma fatia disto. */
export const PARTIAL_MAX = 250;

export type MemoryKind = "personagens" | "cenarios" | "mix";
export const MEMORY_KINDS: readonly MemoryKind[] = ["personagens", "cenarios", "mix"];

/** Uma face de carta: a imagem, com o nome como descrição. */
export type CardFace = { text: string; imageUrl: string | null };
export type MemoryCard = { pair: number; text: string; imageUrl: string | null };
/** Dois lados de um par; `kind` diz de onde veio, `label` é o nome mostrado ao achar. */
export type MemoryPairInput = { key: string; kind: Exclude<MemoryKind, "mix">; a: CardFace; b: CardFace; label: string };
export type Memory = {
  cards: MemoryCard[];
  cols: number;
  level: SizeLevel;
  pairs: number;
  /** Nome de cada par (para mostrar ao achar). */
  labels: string[];
  /** Segundos com todas as cartas viradas para cima no começo. */
  peek: number;
  /** Segundos para a partida toda; null = sem tempo. */
  timeLimit: number | null;
  par: number;
  maxScore: number;
  /** Imagem do verso das cartas (enviada no painel); null usa o desenho padrão. */
  backUrl?: string | null;
};

const columnsFor = (cards: number) => (cards <= 12 ? 3 : cards <= 24 ? 4 : 6);

/** Sorteia os pares do tipo escolhido (os das últimas partidas ficam por último); completa com outros tipos se faltar. */
export function pickPairs(random: Random, pool: MemoryPairInput[], kind: MemoryKind, count: number, avoid: readonly string[]): MemoryPairInput[] {
  const recent = new Set(avoid);
  const order = (items: MemoryPairInput[]) => [...shuffled(random, items.filter((item) => !recent.has(item.key))), ...shuffled(random, items.filter((item) => recent.has(item.key)))];
  const wanted = kind === "mix" ? pool : pool.filter((item) => item.kind === kind);
  // Na mistura alterna os tipos para a mesa ter cara variada.
  if (kind === "mix") {
    const lanes = (["personagens", "cenarios"] as const).map((lane) => order(wanted.filter((item) => item.kind === lane)));
    const mixed: MemoryPairInput[] = [];
    for (let at = 0; mixed.length < count && lanes.some((lane) => lane.length > at); at += 1) for (const lane of lanes) if (lane[at] && mixed.length < count) mixed.push(lane[at]);
    return mixed;
  }
  const chosen = order(wanted).slice(0, count);
  if (chosen.length >= count) return chosen;
  const keys = new Set(chosen.map((item) => item.key));
  return [...chosen, ...order(pool.filter((item) => !keys.has(item.key)))].slice(0, count);
}

export function generateMemory(seed: number, pool: MemoryPairInput[], level: SizeLevel = "facil", kind: MemoryKind = "mix", timeLimit: number | null = null, avoid: readonly string[] = []): Memory | null {
  const config = MEMORY_LEVELS[level];
  const random = rng(seed);
  const chosen = pickPairs(random, pool, kind, config.pairs, avoid);
  if (chosen.length < MIN_PAIRS) return null;
  const cards = chosen.flatMap((pair, index) => [
    { pair: index, text: pair.a.text, imageUrl: pair.a.imageUrl },
    { pair: index, text: pair.b.text, imageUrl: pair.b.imageUrl },
  ]);
  return {
    cards: shuffled(random, cards),
    cols: columnsFor(cards.length),
    level,
    pairs: chosen.length,
    labels: chosen.map((pair) => pair.label),
    peek: config.peek,
    timeLimit,
    par: config.par,
    maxScore: sizeMaxScore(level),
  };
}

/**
 * Confere a partida pela lista de cartas viradas, de duas em duas: cada tentativa vira duas cartas diferentes e ainda fechadas;
 * se forem do mesmo par, ficam abertas. Achou todos no tempo: até 700 (cada tentativa a mais que o mínimo tira um pouco) + até 300 de rapidez;
 * senão só os pares achados (até 250). Tudo vezes o fator do nível.
 */
export function checkMemory(input: Memory, flips: number[], seconds: number): Outcome {
  // Partidas começadas antes desta versão não têm nível, tempo nem nomes: valem como fácil.
  const memory: Memory = { ...input, level: input.level ?? "facil", timeLimit: input.timeLimit ?? null, par: input.par ?? MEMORY_LEVELS.facil.par, labels: input.labels ?? [] };
  if (flips.length % 2 !== 0 || flips.length > 600) return { solved: false, score: 0, detail: "Jogadas inválidas" };
  const matched = new Set<number>();
  for (let index = 0; index < flips.length; index += 2) {
    const [a, b] = [flips[index], flips[index + 1]];
    if (![a, b].every((card) => Number.isInteger(card) && card >= 0 && card < memory.cards.length) || a === b || matched.has(a) || matched.has(b)) {
      return { solved: false, score: 0, detail: "Jogadas inválidas" };
    }
    if (memory.cards[a].pair === memory.cards[b].pair) {
      matched.add(a);
      matched.add(b);
    }
  }
  const attempts = flips.length / 2;
  const pairs = memory.cards.length / 2;
  const found = matched.size / 2;
  const late = memory.timeLimit !== null && seconds > memory.timeLimit + TIME_GRACE;
  const solved = found === pairs && !late;
  const scale = SIZE_SCALE[memory.level];
  const reveal = memory.labels;
  if (!solved) return { solved: false, score: Math.round((found / pairs) * PARTIAL_MAX * scale), detail: `${late ? "Tempo esgotado · " : ""}${found} de ${pairs} pares`, reveal };
  const accuracy = ACCURACY_MAX * Math.max(0.2, 1 - (attempts - pairs) / (pairs * 2.5));
  return { solved: true, score: Math.round((Math.round(accuracy) + timeBonus(seconds, memory.par)) * scale), detail: `${attempts} tentativas · ${SIZE_LABEL[memory.level]}`, reveal };
}
