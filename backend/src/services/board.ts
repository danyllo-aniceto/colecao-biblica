import { prisma } from "../db/prisma";
import { badRequest } from "../lib/errors";
import { pickGeneralQuestionIds } from "./game-rules";

export const BOARD_MIN_QUESTIONS = 20;
export const BOARD_MAX_QUESTIONS = 200;

/**
 * Perguntas de uma partida do tabuleiro, sorteadas como no quiz geral (metade do cenário escolhido,
 * quando há, e o resto do banco inteiro). Não conta como resposta: o modo é só diversão com amigos,
 * então não mexe nas estatísticas das perguntas nem no perfil de ninguém.
 *
 * A alternativa certa vai junto porque a partida local confere as respostas no aparelho.
 */
export async function getBoardQuestions(input: { scenarioId?: number | null; count: number }) {
  const count = Math.max(BOARD_MIN_QUESTIONS, Math.min(input.count, BOARD_MAX_QUESTIONS));

  const available = await prisma.question.findMany({ where: { active: true }, select: { id: true, scenarioId: true } });
  if (available.length === 0) {
    throw badRequest("Ainda não há perguntas cadastradas para jogar");
  }

  const scenarioIds = input.scenarioId ? available.filter((question) => question.scenarioId === input.scenarioId).map((question) => question.id) : [];
  const scenarioSet = new Set(scenarioIds);
  const ids = pickGeneralQuestionIds(
    scenarioIds,
    available.filter((question) => !scenarioSet.has(question.id)).map((question) => question.id),
    count,
  );

  const rows = await prisma.question.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      text: true,
      difficulty: true,
      timeLimitSeconds: true,
      optionA: true,
      optionB: true,
      optionC: true,
      optionD: true,
      correctOption: true,
      explanation: true,
      bibleReference: true,
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return { questions: ids.flatMap((id) => byId.get(id) ?? []) };
}

export type BoardPoolItem = { id: number; difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD"; correct: "A" | "B" | "C" | "D" };

/**
 * Perguntas de uma sala online, sorteadas como no quiz geral. Só o servidor guarda a alternativa certa.
 * O texto fica no banco de perguntas e é lido pergunta a pergunta, quando ela entra em jogo.
 */
export async function pickBoardPool(input: { scenarioId?: number | null; count: number }): Promise<BoardPoolItem[]> {
  const count = Math.max(BOARD_MIN_QUESTIONS, Math.min(input.count, BOARD_MAX_QUESTIONS));
  const available = await prisma.question.findMany({ where: { active: true }, select: { id: true, scenarioId: true } });
  if (available.length === 0) {
    throw badRequest("Ainda não há perguntas cadastradas para jogar");
  }
  const scenarioIds = input.scenarioId ? available.filter((question) => question.scenarioId === input.scenarioId).map((question) => question.id) : [];
  const scenarioSet = new Set(scenarioIds);
  const ids = pickGeneralQuestionIds(
    scenarioIds,
    available.filter((question) => !scenarioSet.has(question.id)).map((question) => question.id),
    count,
  );
  const rows = await prisma.question.findMany({ where: { id: { in: ids } }, select: { id: true, difficulty: true, correctOption: true } });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [{ id, difficulty: row.difficulty, correct: row.correctOption as BoardPoolItem["correct"] }] : [];
  });
}
