import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Linha do tempo: 6 personagens, cenários ou acontecimentos embaralhados para pôr do mais antigo ao mais recente. */
export const TIMELINE_ITEMS = 6;
/** Datas aproximadas (anos; negativo = antes de Cristo). Dois itens só entram juntos se estiverem a pelo menos `MIN_GAP` anos um do outro. */
export const MIN_GAP = 40;

export type TimelineEvent = { id: string; label: string; year: number; emoji: string };

export const TIMELINE: TimelineEvent[] = [
  { id: "noe", label: "Noé e o dilúvio", year: -2350, emoji: "🌈" },
  { id: "babel", label: "Torre de Babel", year: -2200, emoji: "🧱" },
  { id: "abraao", label: "Abraão sai de Ur", year: -2000, emoji: "⭐" },
  { id: "jaco", label: "Jacó e a escada em Betel", year: -1850, emoji: "🪜" },
  { id: "jose", label: "José governa o Egito", year: -1750, emoji: "🧥" },
  { id: "exodo", label: "Moisés e o Êxodo", year: -1450, emoji: "🌊" },
  { id: "jerico", label: "Josué e Jericó", year: -1400, emoji: "📯" },
  { id: "debora", label: "Débora, juíza de Israel", year: -1200, emoji: "🌴" },
  { id: "sansao", label: "Sansão", year: -1100, emoji: "💪" },
  { id: "samuel", label: "Samuel unge Saul", year: -1050, emoji: "🫗" },
  { id: "davi", label: "Davi, rei em Jerusalém", year: -1000, emoji: "🎵" },
  { id: "templo", label: "Salomão constrói o Templo", year: -960, emoji: "🕎" },
  { id: "elias", label: "Elias no Monte Carmelo", year: -860, emoji: "🔥" },
  { id: "jonas", label: "Jonas em Nínive", year: -780, emoji: "🐋" },
  { id: "isaias", label: "O profeta Isaías", year: -740, emoji: "📜" },
  { id: "josias", label: "O rei Josias", year: -630, emoji: "📖" },
  { id: "exilio", label: "A queda de Jerusalém e o exílio", year: -586, emoji: "🏛️" },
  { id: "ester", label: "Ester, rainha da Pérsia", year: -480, emoji: "👑" },
  { id: "neemias", label: "Neemias reconstrói os muros", year: -445, emoji: "🧱" },
  { id: "natal", label: "O nascimento de Jesus", year: -5, emoji: "⭐" },
  { id: "cruz", label: "A morte e a ressurreição de Jesus", year: 30, emoji: "✝️" },
  { id: "paulo", label: "A conversão de Paulo", year: 35, emoji: "💡" },
  { id: "concilio", label: "O Concílio de Jerusalém", year: 49, emoji: "🤝" },
  { id: "roma", label: "Paulo chega a Roma", year: 60, emoji: "🛣️" },
  { id: "templo70", label: "A destruição do Templo", year: 70, emoji: "🏚️" },
  { id: "apocalipse", label: "João recebe o Apocalipse", year: 95, emoji: "📜" },
];

export type TimelinePuzzle = { items: Array<{ id: string; label: string; emoji: string }> };
export type TimelineState = { order: string[] };

export function generateTimeline(seed: number): { puzzle: TimelinePuzzle; state: TimelineState } {
  const random = rng(seed);
  const chosen: TimelineEvent[] = [];
  for (const event of shuffled(random, TIMELINE)) {
    if (chosen.length === TIMELINE_ITEMS) break;
    if (chosen.every((other) => Math.abs(other.year - event.year) >= MIN_GAP)) chosen.push(event);
  }
  const sorted = [...chosen].sort((a, b) => a.year - b.year);
  let shown = shuffled(random, chosen);
  while (shown.every((event, index) => event.id === sorted[index].id)) shown = shuffled(random, chosen);
  return { puzzle: { items: shown.map(({ id, label, emoji }) => ({ id, label, emoji })) }, state: { order: sorted.map((event) => event.id) } };
}

/** Cada item vale mais quanto mais perto do lugar certo (erro de posições); tudo certo ganha o bônus de tempo. */
export function checkTimeline(state: TimelineState, order: string[], seconds: number): Outcome {
  const n = state.order.length;
  if (order.length !== n || new Set(order).size !== n || order.some((id) => !state.order.includes(id))) return { solved: false, score: 0, detail: "Resposta inválida" };
  const miss = order.map((id, index) => Math.abs(state.order.indexOf(id) - index));
  const worst = Math.floor((n * n) / 2); // soma máxima dos erros de posição (ordem invertida)
  const total = miss.reduce((sum, value) => sum + value, 0);
  const right = miss.filter((value) => value === 0).length;
  const solved = right === n;
  return { solved, score: Math.round(ACCURACY_MAX * (1 - total / worst)) + (solved ? timeBonus(seconds, 30) : 0), detail: `${right} de ${n} no lugar certo` };
}
