import { BOT_SKILLS, currentPlayer, usablePowerUps, type BoardState, type Difficulty, type PowerUpKind, type QuestionBank } from "./engine";

/** O que o bot decide fazer agora (uma ação por vez; quem controla repete até a vez passar). */
export type BotAction =
  | { type: "ROLL" }
  | { type: "POWER"; kind: PowerUpKind }
  | { type: "TRIAL"; accept: boolean }
  | { type: "ANSWER"; correct: boolean };

const DIFFICULTY_ADJUST: Record<Difficulty, number> = { EASY: 0.05, MEDIUM: 0, HARD: -0.1, VERY_HARD: -0.2 };

/** Chance do bot acertar a pergunta: depende do nível dele e da dificuldade (50/50 ajuda). */
export function botAccuracy(state: BoardState, bank: QuestionBank): number {
  const player = currentPlayer(state);
  const skill = player.bot ? BOT_SKILLS[player.bot.skill].accuracy : 0.7;
  const question = bank.pool.find((item) => item.id === state.pending?.questionId);
  const adjust = question ? DIFFICULTY_ADJUST[question.difficulty] : 0;
  const fifty = (state.pending?.removed.length ?? 0) > 0 ? 0.15 : 0;
  return Math.max(0.05, Math.min(0.97, skill + adjust + fifty));
}

/** Decide a próxima ação do bot da vez. `random` entra de fora para ficar testável. */
export function botAction(state: BoardState, bank: QuestionBank, random: () => number = Math.random): BotAction {
  const player = currentPlayer(state);
  const usable = usablePowerUps(state);
  const skill = player.bot ? BOT_SKILLS[player.bot.skill].accuracy : 0.7;

  switch (state.phase) {
    case "ROLL":
      // Dado dobrado quando está folgado na pista (longe do portão), às vezes.
      if (usable.includes("DOUBLE") && player.position < state.config.size - 12 && random() < 0.5) {
        return { type: "POWER", kind: "DOUBLE" };
      }
      return { type: "ROLL" };

    case "TRIAL_OFFER": {
      const protectedByShield = player.powerUps.includes("SHIELD") || player.powerUps.includes("TREE");
      return { type: "TRIAL", accept: protectedByShield || skill >= 0.7 || random() < 0.5 };
    }

    default: {
      const question = bank.pool.find((item) => item.id === state.pending?.questionId);
      const hard = question ? question.difficulty === "HARD" || question.difficulty === "VERY_HARD" : false;
      // Ajuda quando a pergunta é difícil ou o bot é fraco, uma por vez.
      if (!state.powerUsed) {
        if (usable.includes("FIFTY") && (hard || skill < 0.7) && random() < 0.8) return { type: "POWER", kind: "FIFTY" };
        if (usable.includes("SWAP") && hard && random() < 0.5) return { type: "POWER", kind: "SWAP" };
      }
      return { type: "ANSWER", correct: random() < botAccuracy(state, bank) };
    }
  }
}
