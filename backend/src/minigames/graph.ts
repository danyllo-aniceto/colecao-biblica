import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Interconexão: chegue de um personagem ou lugar a outro por uma corrente de relações; menos elos, mais pontos. */
export type Edge = [from: string, to: string, forward: string, backward: string];

/** Relações bíblicas: `forward` lê de `from` para `to`; `backward` lê de `to` para `from`. */
export const EDGES: Edge[] = [
  ["Isaías", "Ezequias", "profetizou ao rei", "recebeu a profecia de"],
  ["Isaías", "Jesus", "anunciou a vinda de", "foi anunciado por"],
  ["Ezequias", "Jerusalém", "reinou em", "foi governada por"],
  ["Ezequias", "Davi", "descendia do rei", "foi antepassado de"],
  ["Jesus", "Jerusalém", "foi crucificado e ressuscitou em", "viu a morte e a ressurreição de"],
  ["Davi", "Jerusalém", "fez dela a sua capital:", "foi a capital de"],
  ["Davi", "Salomão", "foi pai de", "foi filho de"],
  ["Salomão", "Jerusalém", "construiu o Templo em", "teve o Templo construído por"],
  ["Davi", "Belém", "nasceu em", "viu nascer"],
  ["Jesus", "Belém", "nasceu em", "viu nascer"],
  ["Jesus", "Davi", "foi descendente de", "foi antepassado de"],
  ["Jesus", "Abraão", "foi descendente de", "foi antepassado de"],
  ["Jesus", "Maria", "foi filho de", "foi mãe de"],
  ["Jesus", "Nazaré", "cresceu em", "viu crescer"],
  ["Jesus", "João Batista", "foi batizado por", "batizou"],
  ["João Batista", "Rio Jordão", "batizava no", "viu os batismos de"],
  ["Jesus", "Cafarnaum", "ensinou e morou em", "recebeu o ensino de"],
  ["Jesus", "Pedro", "chamou", "foi chamado por"],
  ["Pedro", "Cafarnaum", "morava em", "era a cidade de"],
  ["Jesus", "Egito", "fugiu para o", "acolheu o menino"],
  ["Jesus", "Moisés", "apareceu com", "apareceu com"],
  ["Jesus", "Elias", "apareceu com", "apareceu com"],
  ["Jesus", "Jonas", "citou o sinal de", "foi lembrado como sinal por"],
  ["Paulo", "Damasco", "foi convertido perto de", "viu a conversão de"],
  ["Paulo", "Antioquia", "partiu em viagem missionária de", "enviou"],
  ["Paulo", "Roma", "chegou preso a", "recebeu"],
  ["Paulo", "Pedro", "se encontrou com", "se encontrou com"],
  ["Moisés", "Egito", "libertou o povo do", "foi libertado do cativeiro por"],
  ["Moisés", "Sinai", "recebeu a Lei no", "viu a entrega da Lei a"],
  ["Moisés", "Josué", "foi sucedido por", "sucedeu a"],
  ["Josué", "Jericó", "conquistou", "foi conquistada por"],
  ["Josué", "Canaã", "conduziu o povo a", "foi alcançada por"],
  ["Abraão", "Ur", "saiu de", "viu a saída de"],
  ["Abraão", "Canaã", "viveu em", "acolheu"],
  ["Abraão", "Isaque", "foi pai de", "foi filho de"],
  ["Isaque", "Jacó", "foi pai de", "foi filho de"],
  ["Jacó", "Betel", "sonhou com a escada em", "foi palco do sonho de"],
  ["Jacó", "José", "foi pai de", "foi filho de"],
  ["José", "Egito", "governou o", "foi governado por"],
  ["Elias", "Carmelo", "enfrentou os profetas de Baal no", "viu o fogo de"],
  ["Elias", "Eliseu", "foi sucedido por", "sucedeu a"],
  ["Jonas", "Nínive", "pregou em", "ouviu a pregação de"],
  ["Daniel", "Babilônia", "serviu na corte da", "teve a corte servida por"],
  ["Babilônia", "Jerusalém", "conquistou", "foi conquistada pela"],
  ["Ester", "Susã", "foi rainha em", "teve como rainha"],
  ["Susã", "Babilônia", "foi capital do império que sucedeu a", "foi sucedida pelo império de"],
  ["Rute", "Boaz", "casou-se com", "casou-se com"],
  ["Boaz", "Belém", "vivia em", "era a cidade de"],
  ["Rute", "Davi", "foi bisavó de", "foi bisneto de"],
  ["Samuel", "Davi", "ungiu", "foi ungido por"],
  ["Samuel", "Saul", "ungiu", "foi ungido por"],
  ["Saul", "Davi", "perseguiu", "foi perseguido por"],
  ["João", "Jesus", "foi discípulo de", "foi mestre de"],
  ["João", "Patmos", "foi exilado em", "recebeu o exílio de"],
];

export const NODES = [...new Set(EDGES.flatMap(([from, to]) => [from, to]))];

/** Vizinhos de um nó, com a frase da relação lida a partir dele. */
export function neighbors(node: string): Array<{ to: string; phrase: string }> {
  return EDGES.flatMap(([from, to, forward, backward]) => (from === node ? [{ to, phrase: forward }] : to === node ? [{ to: from, phrase: backward }] : []));
}

/** Menor número de passos entre dois nós (null se não houver caminho). */
export function shortestSteps(from: string, to: string): number | null {
  const distance = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    if (at === to) return distance.get(at)!;
    for (const { to: next } of neighbors(at)) {
      if (!distance.has(next)) {
        distance.set(next, distance.get(at)! + 1);
        queue.push(next);
      }
    }
  }
  return null;
}

export type ChainPuzzle = { from: string; to: string; edges: Edge[] };
export type ChainState = { from: string; to: string; shortest: number };

/** Sorteia dois nós a 3 ou 4 passos um do outro (nem tão perto que seja óbvio, nem tão longe que canse). */
export function generateChain(seed: number): { puzzle: ChainPuzzle; state: ChainState } {
  const random = rng(seed);
  const nodes = shuffled(random, NODES);
  for (const from of nodes) {
    for (const to of shuffled(random, NODES)) {
      const steps = from === to ? null : shortestSteps(from, to);
      if (steps !== null && steps >= 3 && steps <= 4) return { puzzle: { from, to, edges: EDGES }, state: { from, to, shortest: steps } };
    }
  }
  throw new Error("Sem par de nós a 3 ou 4 passos");
}

/** O caminho é a lista de nós visitados, do começo ao fim; cada passo precisa ser uma relação que existe. */
export function checkChain(state: ChainState, path: string[], seconds: number): Outcome {
  if (path.length < 2 || path.length > 40 || path[0] !== state.from || path.at(-1) !== state.to) return { solved: false, score: 0, detail: "O caminho não liga os dois" };
  for (let index = 0; index < path.length - 1; index += 1) {
    if (!neighbors(path[index]).some(({ to }) => to === path[index + 1])) return { solved: false, score: 0, detail: "Passo inválido" };
  }
  const steps = path.length - 1;
  const extra = Math.max(0, steps - state.shortest);
  return { solved: true, score: Math.max(100, ACCURACY_MAX - extra * 150) + timeBonus(seconds, 30), detail: `${steps} ${steps === 1 ? "elo" : "elos"} (o menor tem ${state.shortest})` };
}
