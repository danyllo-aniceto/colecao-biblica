import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Árvore genealógica: ligue cada pai ao seu filho (Gênesis 5, Mateus 1 e Lucas 3). */
export const LINEAGE_PAIRS = 5;

/** Duas linhagens: de Adão a Noé e de Terá a Zorobabel (cada nome gerou o seguinte). */
export const LINEAGES: string[][] = [
  ["Adão", "Sete", "Enos", "Cainã", "Maalalel", "Jarede", "Enoque", "Matusalém", "Lameque", "Noé"],
  ["Terá", "Abraão", "Isaque", "Jacó", "Judá", "Perez", "Esrom", "Rão", "Aminadabe", "Naassom", "Salmom", "Boaz", "Obede", "Jessé", "Davi", "Salomão", "Roboão", "Abias", "Asa", "Josafá", "Jorão", "Uzias", "Jotão", "Acaz", "Ezequias", "Manassés", "Amom", "Josias", "Jeconias", "Salatiel", "Zorobabel"],
];

export type LineagePair = { father: string; son: string };
export type LineagePuzzle = { fathers: string[]; sons: string[] };
export type LineageState = { pairs: LineagePair[] };

const allPairs = (): Array<LineagePair & { chain: number; index: number }> =>
  LINEAGES.flatMap((chain, c) => chain.slice(0, -1).map((father, index) => ({ father, son: chain[index + 1], chain: c, index })));

export function generateLineage(seed: number): { puzzle: LineagePuzzle; state: LineageState } {
  const random = rng(seed);
  const chosen: Array<LineagePair & { chain: number; index: number }> = [];
  // Pares que não se encostam (ninguém é pai num par e filho em outro), para a ligação ter uma única resposta.
  for (const pair of shuffled(random, allPairs())) {
    if (chosen.length === LINEAGE_PAIRS) break;
    if (chosen.every((other) => other.chain !== pair.chain || Math.abs(other.index - pair.index) >= 2)) chosen.push(pair);
  }
  const pairs = chosen.map(({ father, son }) => ({ father, son }));
  return { puzzle: { fathers: shuffled(random, pairs.map((pair) => pair.father)), sons: shuffled(random, pairs.map((pair) => pair.son)) }, state: { pairs } };
}

/** `links[i]` é o filho ligado ao i-ésimo pai de `puzzle.fathers`. */
export function checkLineage(state: LineageState, fathers: string[], links: string[], seconds: number): Outcome {
  const sons = new Set(state.pairs.map((pair) => pair.son));
  if (links.length !== fathers.length || fathers.length !== state.pairs.length || new Set(links).size !== links.length || links.some((son) => !sons.has(son))) return { solved: false, score: 0, detail: "Resposta inválida" };
  const right = fathers.filter((father, index) => state.pairs.find((pair) => pair.father === father)?.son === links[index]).length;
  const solved = right === state.pairs.length;
  return { solved, score: Math.round((right / state.pairs.length) * ACCURACY_MAX) + (solved ? timeBonus(seconds, 25) : 0), detail: `${right} de ${state.pairs.length} ligações certas` };
}
