import { apiRequest } from '@/lib/http';
import type { Difficulty, OptionLetter } from '@board/engine';

/** Pergunta do tabuleiro: a partida local confere a resposta no aparelho, por isso vem a alternativa certa. */
export type BoardQuestion = {
  id: number;
  text: string;
  difficulty: Difficulty;
  timeLimitSeconds: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  explanation: string | null;
  bibleReference: string | null;
};

const PACK_KEY = 'colecao-biblica:tabuleiro-perguntas';
const PACK_LIMIT = 300;
const PACK_REFRESH_MS = 12 * 60 * 60 * 1000;

type QuestionPack = { savedAt: number; byScenario: Record<string, BoardQuestion[]> };

function readPack(): QuestionPack {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PACK_KEY) ?? 'null') as QuestionPack | null;
    if (parsed && typeof parsed.savedAt === 'number' && parsed.byScenario) return parsed;
  } catch {
    // Dados ilegíveis: começa um pacote novo.
  }
  return { savedAt: 0, byScenario: {} };
}

function mergeIntoPack(scenarioId: number | null | undefined, questions: BoardQuestion[]) {
  try {
    const pack = readPack();
    const key = String(scenarioId ?? 'any');
    const byId = new Map<number, BoardQuestion>();
    // As mais novas primeiro: ao passar do limite, saem as mais antigas.
    for (const question of [...questions, ...(pack.byScenario[key] ?? [])]) if (!byId.has(question.id)) byId.set(question.id, question);
    pack.byScenario[key] = [...byId.values()].slice(0, PACK_LIMIT);
    pack.savedAt = Date.now();
    window.localStorage.setItem(PACK_KEY, JSON.stringify(pack));
  } catch {
    // Sem espaço ou bloqueado: a partida online segue, só não haverá reserva offline.
  }
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Perguntas guardadas no aparelho: as do cenário primeiro, completando com as dos outros. */
function questionsFromPack(scenarioId: number | null | undefined, count: number) {
  const { byScenario } = readPack();
  const own = byScenario[String(scenarioId ?? 'any')] ?? [];
  const seen = new Set(own.map((question) => question.id));
  const others = Object.entries(byScenario)
    .filter(([key]) => key !== String(scenarioId ?? 'any'))
    .flatMap(([, list]) => list)
    .filter((question) => (seen.has(question.id) ? false : (seen.add(question.id), true)));
  return [...shuffle(own), ...shuffle(others)].slice(0, count);
}

const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

/**
 * Sorteia as perguntas da partida (como no quiz geral). Não conta nas estatísticas nem no perfil.
 * Cada resposta do servidor também fica guardada no aparelho; sem internet a partida local usa esse pacote.
 */
export async function fetchBoardQuestions(input: { scenarioId?: number | null; count: number }): Promise<BoardQuestion[]> {
  try {
    const { questions } = await apiRequest<{ questions: BoardQuestion[] }>(
      '/board/questions',
      { method: 'POST', body: JSON.stringify(input) },
      'Não foi possível sortear as perguntas do tabuleiro.',
    );
    mergeIntoPack(input.scenarioId, questions);
    return questions;
  } catch (reason) {
    // Só a falta de conexão cai para o pacote; erro do servidor (ex.: poucas perguntas) continua sendo erro.
    if (!isOffline() && !(reason instanceof Error && reason.message.startsWith('Sem conexão'))) throw reason;
    const offline = questionsFromPack(input.scenarioId, input.count);
    if (offline.length === 0) throw new Error('Sem internet e sem perguntas guardadas. Abra o Tabuleiro uma vez com internet para baixar o pacote offline.');
    return offline;
  }
}

/** Baixa um pacote de perguntas em segundo plano (no máximo a cada 12 h) para o Tabuleiro funcionar offline. */
export async function prefetchBoardQuestionPack() {
  if (isOffline() || Date.now() - readPack().savedAt < PACK_REFRESH_MS) return;
  try {
    await fetchBoardQuestions({ scenarioId: null, count: 120 });
  } catch {
    // Sem pacote novo, vale o que já está guardado.
  }
}
