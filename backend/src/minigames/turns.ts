/**
 * Peças comuns dos mini games em turnos: dificuldade, relógio de cada turno (conferido no servidor) e a conta de rapidez.
 * Puro e sem dependências, como o resto de `minigames/`.
 */
export type Level = "facil" | "medio" | "dificil";
export const LEVEL_IDS: readonly Level[] = ["facil", "medio", "dificil"];
export const LEVEL_LABEL: Record<Level, string> = { facil: "Fácil", medio: "Médio", dificil: "Difícil" };
/** Quanto da pontuação máxima (1.000) cada dificuldade vale: o ranking premia quem joga o difícil. */
export const LEVEL_SCALE: Record<Level, number> = { facil: 0.6, medio: 0.8, dificil: 1 };
/** Pontuação de partida cheia, antes do fator da dificuldade. */
export const FULL_SCORE = 1000;
/** Sem contar o tempo, cada turno vale um pouco menos. */
export const UNTIMED_FACTOR = 0.85;
/** Folga (segundos) para a rede: o tempo só vence no servidor depois disto. */
export const TIME_GRACE = 3;

export const maxScoreOf = (level: Level) => Math.round(FULL_SCORE * LEVEL_SCALE[level]);

/** Relógio de um turno: `roundStartedAt` é null enquanto o jogador vê o resultado do turno anterior (o tempo fica parado). */
export type Clock = { timePerTurn: number | null; roundStartedAt: number | null; lastEndedAt: number };

export const newClock = (timePerTurn: number | null, now: number): Clock => ({ timePerTurn, roundStartedAt: now, lastEndedAt: now });

/** Segundos do turno atual. Se a tela nunca avisou que começou, conta desde o fim do turno anterior. */
export const elapsedSeconds = (clock: Clock, now: number) => (now - (clock.roundStartedAt ?? clock.lastEndedAt)) / 1000;

/** O tempo do turno já venceu (com a folga de rede)? */
export const clockExpired = (clock: Clock, now: number) => clock.timePerTurn !== null && elapsedSeconds(clock, now) > clock.timePerTurn + TIME_GRACE;

/** O pedido de "tempo esgotado" só vale se o tempo está mesmo acabando. */
export const clockAlmostOver = (clock: Clock, now: number) => clock.timePerTurn !== null && elapsedSeconds(clock, now) >= clock.timePerTurn - TIME_GRACE;

export const beginClock = (clock: Clock, now: number): Clock => (clock.roundStartedAt === null ? { ...clock, roundStartedAt: now } : clock);
export const endClock = (clock: Clock, now: number): Clock => ({ ...clock, roundStartedAt: null, lastEndedAt: now });

/** 1 enquanto o turno é mais rápido que `par` segundos e cai até 0 em mais 2 × `par`. */
export const speedFactor = (seconds: number, par: number) => Math.min(1, Math.max(0, 1 - Math.max(0, seconds - par) / (par * 2)));

/** Fatia de pontos de cada turno: 1.000 dividido pelo número de turnos, mais 15% de desconto sem relógio. */
export const turnShare = (turns: number, timed: boolean) => (FULL_SCORE / turns) * (timed ? 1 : UNTIMED_FACTOR);

export class TurnError extends Error {}

export type TurnResult = { label: string; solved: boolean; timedOut: boolean; points: number; seconds: number };

/**
 * Lê as palavras de uma partida antiga para o sorteio evitar repeti-las. Partidas guardadas antes de uma atualização podem ter outro formato
 * (o banco guarda 2 dias): nesse caso devolve lista vazia em vez de derrubar o início do jogo.
 */
export function safeWords(read: (state: never) => string[], state: unknown): string[] {
  try {
    const words = read(state as never);
    return Array.isArray(words) ? words.filter((word): word is string => typeof word === "string") : [];
  } catch {
    return [];
  }
}
