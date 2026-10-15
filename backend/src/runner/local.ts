/**
 * Corrida no mesmo aparelho (2 a 4 na mesma tela): contas puras do layout, das vagas e do placar (a tela só desenha e lê os toques).
 * Cada jogador tem uma "faixa" (célula) da tela deitada: 2 jogadores = duas faixas empilhadas; 3 = duas em cima e uma embaixo; 4 = 2×2.
 */
export type Cell = { x: number; y: number; w: number; h: number };

export const MIN_LOCAL_PLAYERS = 2;
export const MAX_LOCAL_PLAYERS = 4;
/** Teclas dos jogadores humanos no computador (1º humano = tecla 1...). No celular vale o toque na própria faixa. */
export const LOCAL_KEYS = ["Digit1", "Digit2", "Digit3", "Digit4"] as const;
/** Contagem antes da largada, em passos (3 s). */
export const COUNTDOWN_TICKS = 180;

/** Células da tela (frações de 0 a 1) para `count` jogadores, em ordem de leitura. */
export function localLayout(count: number): Cell[] {
  if (!Number.isInteger(count) || count < MIN_LOCAL_PLAYERS || count > MAX_LOCAL_PLAYERS) throw new Error("De 2 a 4 jogadores");
  if (count === 2) return [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }];
  if (count === 3) return [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }];
  return [{ x: 0, y: 0, w: 0.5, h: 0.5 }, { x: 0.5, y: 0, w: 0.5, h: 0.5 }, { x: 0, y: 0.5, w: 0.5, h: 0.5 }, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }];
}

/** Qual faixa recebe o toque em (`fx`, `fy`) (frações da tela). `-1` fora de todas. */
export function cellAt(cells: Cell[], fx: number, fy: number): number {
  return cells.findIndex((cell) => fx >= cell.x && fx < cell.x + cell.w && fy >= cell.y && fy < cell.y + cell.h);
}

export type SlotKind = "human" | "bot";

/** Quem ocupa cada vaga: os humanos primeiro, os bots completam. */
export function planSlots(humans: number, total: number): SlotKind[] {
  const people = Math.max(1, Math.min(humans, total));
  return Array.from({ length: total }, (_, index) => (index < people ? "human" : "bot"));
}

export type LocalEntry = { name: string; color: string; progress: number; finished: boolean; /** Passo da chegada (menor = mais rápido). */ ticks: number; deaths: number; words: number; human: boolean };

/** Placar: quem chegou primeiro; depois quem foi mais longe; empate: mais palavras e menos quedas. Ordem de entrada desempata. */
export function rankLocal(entries: LocalEntry[]): LocalEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        Number(b.entry.finished) - Number(a.entry.finished) ||
        (a.entry.finished && b.entry.finished ? a.entry.ticks - b.entry.ticks : b.entry.progress - a.entry.progress) ||
        b.entry.words - a.entry.words ||
        a.entry.deaths - b.entry.deaths ||
        a.index - b.index,
    )
    .map((item) => item.entry);
}

/** Nomes sem repetição ("Davi", "Davi (2)"): dois jogadores podem escolher o mesmo personagem. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
}
