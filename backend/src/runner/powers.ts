/**
 * Poderes no meio do caminho da Corrida (itens coloridos que o personagem pega correndo). Regras puras; o motor (`engine.ts`) aplica os efeitos
 * e a tela usa os mesmos nomes e tempos. Todos valem para qualquer personagem (a física continua única).
 */
export const POWER_KINDS = ["TURBO", "SHIELD", "TRIPLE", "MAGNET"] as const;
export type PowerKind = (typeof POWER_KINDS)[number];

/** Passos (60 por segundo) de cada efeito. O Escudo não tem tempo: vale até absorver um erro. */
export const TURBO_TICKS = 240;
export const TRIPLE_TICKS = 600;
export const MAGNET_TICKS = 600;
/** Imunidade curta depois que o Escudo absorve um erro (atravessa o que causou o erro sem cair). */
export const GRACE_TICKS = 75;
/** Multiplicador da velocidade durante o Turbo. */
export const TURBO_SPEED = 1.5;
/** Alcance do Ímã (px do mundo) em volta do personagem. */
export const MAGNET_RANGE = 100;

export const POWER_INFO: Record<PowerKind, { label: string; hint: string; color: string; symbol: string; ticks: number | null }> = {
  TURBO: { label: "Turbo", hint: "Mais rápido e imune a tudo por 4 segundos: atravessa espetos e blocos.", color: "#f97316", symbol: "T", ticks: TURBO_TICKS },
  SHIELD: { label: "Escudo", hint: "Absorve o próximo erro (espeto ou parede) e deixa você passar por ele.", color: "#38bdf8", symbol: "E", ticks: null },
  TRIPLE: { label: "Pulo triplo", hint: "Um pulo extra no ar por 10 segundos.", color: "#a78bfa", symbol: "3", ticks: TRIPLE_TICKS },
  MAGNET: { label: "Ímã", hint: "Puxa as palavras do versículo que estiverem por perto, por 10 segundos.", color: "#f43f5e", symbol: "Í", ticks: MAGNET_TICKS },
};

/** Efeitos ativos de um corredor: passos que faltam (Escudo: 1 = ligado; `grace` = imunidade curta depois de o Escudo agir). */
export type Effects = { turbo: number; shield: number; triple: number; magnet: number; grace: number };

export const emptyEffects = (): Effects => ({ turbo: 0, shield: 0, triple: 0, magnet: 0, grace: 0 });

/** Liga o efeito do poder que acabou de ser pego (pegar de novo renova o tempo). */
export function applyPower(effects: Effects, power: PowerKind): Effects {
  const next = { ...effects };
  if (power === "TURBO") next.turbo = TURBO_TICKS;
  else if (power === "SHIELD") next.shield = 1;
  else if (power === "TRIPLE") next.triple = TRIPLE_TICKS;
  else next.magnet = MAGNET_TICKS;
  return next;
}

/** Imune a espetos e paredes agora (Turbo ou imunidade curta depois do Escudo). */
export const isImmune = (effects: Effects) => effects.turbo > 0 || effects.grace > 0;

/** Passa um passo: os tempos diminuem. */
export function tickEffects(effects: Effects): Effects {
  return {
    turbo: Math.max(0, effects.turbo - 1),
    shield: effects.shield,
    triple: Math.max(0, effects.triple - 1),
    magnet: Math.max(0, effects.magnet - 1),
    grace: Math.max(0, effects.grace - 1),
  };
}
