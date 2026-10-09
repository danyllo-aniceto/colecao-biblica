import { shuffled, type Outcome, type Random } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Linha do tempo: aparece uma carta por vez (personagem, cenário ou acontecimento) e o jogador a coloca na linha, entre as que já estão lá,
 * do mais antigo ao mais recente. Acertou a posição, continua; errou, perde uma vida e a carta vai para o lugar certo.
 * Fácil: datas bem espaçadas e 5 vidas; difícil: datas próximas e 3 vidas. As datas são aproximadas.
 */
export type TimelineEvent = {
  id: string;
  label: string;
  /** Ano aproximado (negativo = antes de Cristo). */
  year: number;
  emoji: string;
  /** Nomes de personagens ou cenários cadastrados cuja imagem ilustra a carta. */
  match?: string[];
};

export const TIMELINE: TimelineEvent[] = [
  { id: "adao", label: "Adão e Eva no Éden", year: -4000, emoji: "🍎", match: ["Adão", "Eva"] },
  { id: "caim", label: "Caim e Abel", year: -3900, emoji: "🌾", match: ["Caim", "Abel"] },
  { id: "noe", label: "Noé e o dilúvio", year: -2350, emoji: "🌈", match: ["Noé"] },
  { id: "babel", label: "Torre de Babel", year: -2200, emoji: "🧱", match: ["Babel", "Babilônia"] },
  { id: "abraao", label: "Abraão sai de Ur", year: -2000, emoji: "⭐", match: ["Abraão"] },
  { id: "isaque", label: "O nascimento de Isaque", year: -1900, emoji: "👶", match: ["Isaque", "Sara"] },
  { id: "jaco", label: "Jacó e a escada em Betel", year: -1850, emoji: "🪜", match: ["Jacó", "Betel"] },
  { id: "jose", label: "José governa o Egito", year: -1750, emoji: "🧥", match: ["José", "Egito"] },
  { id: "exodo", label: "Moisés e o Êxodo", year: -1450, emoji: "🌊", match: ["Moisés"] },
  { id: "jerico", label: "Josué e Jericó", year: -1400, emoji: "📯", match: ["Josué", "Jericó"] },
  { id: "debora", label: "Débora, juíza de Israel", year: -1200, emoji: "🌴", match: ["Débora"] },
  { id: "gideao", label: "Gideão vence os midianitas", year: -1150, emoji: "🏺", match: ["Gideão"] },
  { id: "sansao", label: "Sansão", year: -1100, emoji: "💪", match: ["Sansão"] },
  { id: "rute", label: "Rute e Boaz", year: -1075, emoji: "🌾", match: ["Rute", "Boaz"] },
  { id: "samuel", label: "Samuel unge Saul", year: -1050, emoji: "🫗", match: ["Samuel"] },
  { id: "saul", label: "Saul, o primeiro rei", year: -1040, emoji: "👑", match: ["Saul"] },
  { id: "davi", label: "Davi, rei em Jerusalém", year: -1000, emoji: "🎵", match: ["Davi", "Jerusalém"] },
  { id: "templo", label: "Salomão constrói o Templo", year: -960, emoji: "🕎", match: ["Salomão"] },
  { id: "divisao", label: "O reino se divide", year: -930, emoji: "🪓", match: ["Jeroboão", "Roboão"] },
  { id: "elias", label: "Elias no Monte Carmelo", year: -860, emoji: "🔥", match: ["Elias", "Carmelo"] },
  { id: "eliseu", label: "Eliseu e o poder de Deus", year: -840, emoji: "🧂", match: ["Eliseu"] },
  { id: "jonas", label: "Jonas em Nínive", year: -780, emoji: "🐋", match: ["Jonas", "Nínive"] },
  { id: "isaias", label: "O profeta Isaías", year: -740, emoji: "📜", match: ["Isaías"] },
  { id: "ezequias", label: "O rei Ezequias", year: -700, emoji: "🙏", match: ["Ezequias"] },
  { id: "josias", label: "O rei Josias", year: -630, emoji: "📖", match: ["Josias"] },
  { id: "jeremias", label: "O profeta Jeremias", year: -600, emoji: "😢", match: ["Jeremias"] },
  { id: "exilio", label: "A queda de Jerusalém e o exílio", year: -586, emoji: "🏛️", match: ["Babilônia"] },
  { id: "daniel", label: "Daniel na cova dos leões", year: -540, emoji: "🦁", match: ["Daniel"] },
  { id: "ester", label: "Ester, rainha da Pérsia", year: -480, emoji: "👑", match: ["Ester"] },
  { id: "esdras", label: "Esdras volta a Jerusalém", year: -458, emoji: "📚", match: ["Esdras"] },
  { id: "neemias", label: "Neemias reconstrói os muros", year: -445, emoji: "🧱", match: ["Neemias"] },
  { id: "natal", label: "O nascimento de Jesus", year: -5, emoji: "⭐", match: ["Jesus", "Belém"] },
  { id: "batismo", label: "O batismo de Jesus", year: 27, emoji: "🕊️", match: ["João Batista", "Jordão"] },
  { id: "cruz", label: "A morte e a ressurreição de Jesus", year: 30, emoji: "✝️", match: ["Jesus"] },
  { id: "estevao", label: "Estêvão, o primeiro mártir", year: 34, emoji: "🪨", match: ["Estêvão"] },
  { id: "paulo", label: "A conversão de Paulo", year: 35, emoji: "💡", match: ["Paulo", "Damasco"] },
  { id: "cornelio", label: "Pedro visita Cornélio", year: 40, emoji: "🏠", match: ["Pedro", "Cornélio"] },
  { id: "concilio", label: "O Concílio de Jerusalém", year: 49, emoji: "🤝", match: ["Tiago", "Jerusalém"] },
  { id: "roma", label: "Paulo chega a Roma", year: 60, emoji: "🛣️", match: ["Roma"] },
  { id: "templo70", label: "A destruição do Templo", year: 70, emoji: "🏚️", match: [] },
  { id: "apocalipse", label: "João recebe o Apocalipse", year: 95, emoji: "📜", match: ["João", "Patmos"] },
];

export const TIMELINE_LEVELS: Record<Level, { lives: number; gap: number; hints: number }> = {
  facil: { lives: 5, gap: 150, hints: 3 },
  medio: { lives: 4, gap: 60, hints: 2 },
  dificil: { lives: 3, gap: 25, hints: 1 },
};
export const COUNT_CHOICES = [8, 12, 16, 20] as const;
export const TIME_CHOICES = [10, 15, 20, 30] as const;
/** Cada dica usada numa carta tira esta parte dos pontos dela. */
export const HINT_COST = 0.2;

export type ItemKind = "character" | "place" | "event";
export type TimelineItem = { id: string; label: string; emoji: string; year: number; imageUrl: string | null; kind: ItemKind };
/** Imagem de cada carta, descoberta pelo servidor a partir dos personagens e cenários cadastrados (o painel já guarda as imagens). */
export type ImageLookup = (event: TimelineEvent) => { imageUrl: string | null; kind: ItemKind };

export type TimelineGameState = {
  seed: number;
  level: Level;
  maxLives: number;
  lives: number;
  clock: Clock;
  /** Na ordem em que aparecem; a primeira já começa na linha. */
  items: TimelineItem[];
  index: number;
  /** Ids na linha, do mais antigo ao mais recente. */
  placed: string[];
  hinted: number;
  results: TurnResult[];
};

/** "cerca de 1450 a.C." */
export const yearLabel = (year: number) => (year < 0 ? `${-year} a.C.` : `${year} d.C.`);

/** Dicas de época, da mais vaga à mais precisa. */
export function eraHints(year: number): string[] {
  const bc = year < 0;
  const abs = Math.abs(year);
  const millennium = Math.ceil(abs / 1000);
  const century = Math.ceil(abs / 100);
  const low = Math.floor(abs / 100) * 100;
  return [
    bc ? `Aconteceu antes de Cristo, no ${millennium}º milênio a.C.` : `Aconteceu depois de Cristo, no ${millennium}º milênio d.C.`,
    `Foi no século ${century} ${bc ? "a.C." : "d.C."}`,
    `Entre os anos ${bc ? `${low + 100} e ${low} a.C.` : `${low} e ${low + 100} d.C.`}`,
  ];
}

/** Sorteia as cartas respeitando a distância mínima entre as datas do nível; se faltarem, diminui a distância até completar. */
export function pickTimelineItems(random: Random, lookup: ImageLookup, level: Level, count: number, avoid: readonly string[]): TimelineItem[] {
  const recent = new Set(avoid);
  const pool = [...shuffled(random, TIMELINE.filter((event) => !recent.has(event.id))), ...shuffled(random, TIMELINE.filter((event) => recent.has(event.id)))];
  let gap = TIMELINE_LEVELS[level].gap;
  let chosen: TimelineEvent[] = [];
  while (gap >= 5) {
    chosen = [];
    for (const event of pool) {
      if (chosen.length === count) break;
      if (chosen.every((other) => Math.abs(other.year - event.year) >= gap)) chosen.push(event);
    }
    if (chosen.length >= count) break;
    gap = Math.floor(gap / 2);
  }
  return chosen.map((event) => ({ id: event.id, label: event.label, emoji: event.emoji, year: event.year, ...lookup(event) }));
}

export function newTimeline(seed: number, items: TimelineItem[], level: Level, timePerItem: number | null, now: number): TimelineGameState {
  const config = TIMELINE_LEVELS[level];
  return { seed, level, maxLives: config.lives, lives: config.lives, clock: newClock(timePerItem, now), items, index: 1, placed: items.length > 0 ? [items[0].id] : [], hinted: 0, results: [] };
}

export type PublicCard = { id: string; label: string; emoji: string; imageUrl: string | null; kind: ItemKind };
export type PlacedCard = PublicCard & { yearLabel: string };
export type TimelinePuzzle = {
  index: number;
  total: number;
  lives: number;
  maxLives: number;
  /** A carta da vez (sem a data). */
  card: PublicCard;
  placed: PlacedCard[];
  hints: string[];
  hintsLeft: number;
  timePerItem: number | null;
  level: Level;
  maxScore: number;
};

const byId = (state: TimelineGameState, id: string) => state.items.find((item) => item.id === id)!;
const toPlaced = (item: TimelineItem): PlacedCard => ({ id: item.id, label: item.label, emoji: item.emoji, imageUrl: item.imageUrl, kind: item.kind, yearLabel: `cerca de ${yearLabel(item.year)}` });

export function publicTimeline(state: TimelineGameState): TimelinePuzzle {
  const item = state.items[state.index];
  return {
    index: state.index,
    total: state.items.length,
    lives: state.lives,
    maxLives: state.maxLives,
    card: { id: item.id, label: item.label, emoji: item.emoji, imageUrl: item.imageUrl, kind: item.kind },
    placed: state.placed.map((id) => toPlaced(byId(state, id))),
    hints: eraHints(item.year).slice(0, state.hinted),
    hintsLeft: TIMELINE_LEVELS[state.level].hints - state.hinted,
    timePerItem: state.clock.timePerTurn,
    level: state.level,
    maxScore: maxScoreOf(state.level),
  };
}

/** Pontos de uma carta certa (antes do fator da dificuldade): 70% por acertar e 30% pela rapidez (8 s de folga), menos 20% por dica usada nela. */
export function timelinePoints(cards: number, hinted: number, seconds: number, timed: boolean): number {
  return Math.max(0, Math.round(turnShare(Math.max(cards, 1), timed) * (0.7 + 0.3 * speedFactor(seconds, 8) - HINT_COST * hinted)));
}

export type TimelineAction = { type: "place"; slot: number } | { type: "hint" } | { type: "giveup" } | { type: "timeout" } | { type: "begin" };
export type TimelineEnd = { right: boolean; timedOut: boolean; correctSlot: number; points: number; card: PlacedCard };
export type TimelineEvent2 =
  | { kind: "begin" }
  | { kind: "hint"; hints: string[]; hintsLeft: number }
  | { kind: "end"; end: TimelineEnd; lives: number; placed: PlacedCard[]; next: TimelinePuzzle | null; gameOver: boolean };

export function playTimeline(state: TimelineGameState, action: TimelineAction, now: number): { state: TimelineGameState; event: TimelineEvent2; done: boolean } {
  const item = state.items[state.index];
  if (!item || state.lives <= 0) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || (action.type !== "giveup" && clockExpired(state.clock, now));

  if (action.type === "hint" && !timedOut) {
    if (state.hinted >= TIMELINE_LEVELS[state.level].hints) throw new TurnError("Acabaram as dicas desta carta");
    const hinted = state.hinted + 1;
    return { state: { ...state, hinted }, event: { kind: "hint", hints: eraHints(item.year).slice(0, hinted), hintsLeft: TIMELINE_LEVELS[state.level].hints - hinted }, done: false };
  }

  const years = state.placed.map((id) => byId(state, id).year);
  // Posições certas: logo antes de quem é mais novo e logo depois de quem é mais velho (datas iguais valem nos dois lados).
  const low = years.filter((year) => year < item.year).length;
  const high = years.filter((year) => year <= item.year).length;

  if (action.type === "giveup") {
    return { state: { ...state, lives: 0 }, event: { kind: "end", end: { right: false, timedOut: false, correctSlot: low, points: 0, card: toPlaced(item) }, lives: 0, placed: state.placed.map((id) => toPlaced(byId(state, id))), next: null, gameOver: true }, done: true };
  }

  let right = false;
  if (!timedOut && action.type === "place") {
    if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot > state.placed.length) throw new TurnError("Posição inválida");
    right = action.slot >= low && action.slot <= high;
  }
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const points = right ? timelinePoints(state.items.length - 1, state.hinted, seconds, state.clock.timePerTurn !== null) : 0;
  const placed = [...state.placed.slice(0, low), item.id, ...state.placed.slice(low)];
  const lives = right ? state.lives : state.lives - 1;
  const index = state.index + 1;
  const results = [...state.results, { label: item.label, solved: right, timedOut, points, seconds: Math.round(seconds) }];
  const next: TimelineGameState = { ...state, lives, index, placed, hinted: 0, results, clock: endClock(state.clock, now) };
  const done = lives <= 0 || index >= state.items.length;
  return {
    state: next,
    event: { kind: "end", end: { right, timedOut, correctSlot: low, points, card: toPlaced(item) }, lives, placed: placed.map((id) => toPlaced(byId(state, id))), next: done ? null : publicTimeline(next), gameOver: lives <= 0 },
    done,
  };
}

/** Resultado: a soma das cartas certas vezes o fator da dificuldade. Vence quem põe todas na linha sem perder todas as vidas. */
export function timelineOutcome(state: TimelineGameState): Outcome {
  const played = state.results.length;
  const right = state.results.filter((result) => result.solved).length;
  const total = state.items.length - 1;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  const solved = state.lives > 0 && played >= total;
  return { solved, score, detail: `${right} de ${total} cartas certas · ${state.lives} ${state.lives === 1 ? "vida" : "vidas"} · ${LEVEL_LABEL[state.level]}`, reveal: state.placed.map((id) => toPlaced(byId(state, id))) };
}
