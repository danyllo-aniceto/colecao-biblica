import { BOT_SKILLS, currentPlayer, powerTargets, usablePowerUps, type BoardState, type Difficulty, type PowerUpKind, type QuestionBank } from "./engine";

/** O que o bot decide fazer agora (uma ação por vez; quem controla repete até a vez passar). */
export type BotAction =
  | { type: "ROLL" }
  | { type: "POWER"; kind: PowerUpKind; targetId?: string }
  | { type: "TRIAL"; accept: boolean }
  | { type: "ANSWER"; correct: boolean };

const DIFFICULTY_ADJUST: Record<Difficulty, number> = { EASY: 0.05, MEDIUM: 0, HARD: -0.1, VERY_HARD: -0.2 };
/** Quanto ajuda ter alternativas eliminadas (0 a 3). */
const REMOVED_BONUS = [0, 0.1, 0.2, 0.8];

/** Chance do bot acertar a pergunta: depende do nível dele, da dificuldade e das alternativas já eliminadas. */
export function botAccuracy(state: BoardState, bank: QuestionBank): number {
  const player = currentPlayer(state);
  const skill = player.bot ? BOT_SKILLS[player.bot.skill].accuracy : 0.7;
  const question = bank.pool.find((item) => item.id === state.pending?.questionId);
  const adjust = question ? DIFFICULTY_ADJUST[question.difficulty] : 0;
  const removed = REMOVED_BONUS[Math.min(state.pending?.removed.length ?? 0, 3)];
  return Math.max(0.05, Math.min(0.97, skill + adjust + removed));
}

/** Rival mais adiantado entre os alvos possíveis. */
function leaderAmong(state: BoardState, ids: string[]) {
  return state.players.filter((player) => ids.includes(player.id)).sort((left, right) => right.position - left.position)[0];
}

/** Decide a próxima ação do bot da vez. `random` entra de fora para ficar testável. */
export function botAction(state: BoardState, bank: QuestionBank, random: () => number = Math.random): BotAction {
  const player = currentPlayer(state);
  const usable = usablePowerUps(state);
  const skill = player.bot ? BOT_SKILLS[player.bot.skill].accuracy : 0.7;

  switch (state.phase) {
    case "ROLL": {
      // Quem está bem atrás tenta virar o jogo com o Cajado ou a Rede.
      if (usable.includes("STAFF")) {
        const leader = leaderAmong(state, powerTargets(state, "STAFF"));
        if (leader && leader.position - player.position >= 6) return { type: "POWER", kind: "STAFF", targetId: leader.id };
      }
      if (usable.includes("NET")) {
        const leader = leaderAmong(state, powerTargets(state, "NET"));
        if (leader && leader.position - player.position >= 3) return { type: "POWER", kind: "NET", targetId: leader.id };
      }
      if (usable.includes("FOURTH") && random() < 0.35) return { type: "POWER", kind: "FOURTH" };
      // Dado dobrado quando está folgado na pista (longe do portão), às vezes.
      if (usable.includes("DOUBLE") && player.position < state.config.size - 12 && random() < 0.5) {
        return { type: "POWER", kind: "DOUBLE" };
      }
      return { type: "ROLL" };
    }

    case "TRIAL_OFFER": {
      const protectedByShield = player.powerUps.some((kind) => kind === "SHIELD" || kind === "TREE" || kind === "TENT");
      return { type: "TRIAL", accept: protectedByShield || skill >= 0.7 || random() < 0.5 };
    }

    default: {
      const question = bank.pool.find((item) => item.id === state.pending?.questionId);
      const hard = question ? question.difficulty === "HARD" || question.difficulty === "VERY_HARD" : false;
      if (usable.includes("TRUMPET")) return { type: "POWER", kind: "TRUMPET" };
      // Ajudas gratuitas primeiro; as demais, uma por vez, quando a pergunta é difícil ou o bot é fraco.
      if (usable.includes("WISDOM") && hard && random() < 0.7) return { type: "POWER", kind: "WISDOM" };
      if (!state.powerUsed) {
        const needsHelp = hard || skill < 0.7;
        for (const kind of ["LIGHT", "FIFTY", "DOVE"] as const) {
          if (usable.includes(kind) && needsHelp && random() < 0.8) return { type: "POWER", kind };
        }
        if (usable.includes("SWAP") && hard && random() < 0.5) return { type: "POWER", kind: "SWAP" };
      }
      return { type: "ANSWER", correct: random() < botAccuracy(state, bank) };
    }
  }
}
