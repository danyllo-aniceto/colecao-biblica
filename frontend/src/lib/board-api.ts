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

/** Sorteia as perguntas da partida (como no quiz geral). Não conta nas estatísticas nem no perfil. */
export const fetchBoardQuestions = (input: { scenarioId?: number | null; count: number }) =>
  apiRequest<{ questions: BoardQuestion[] }>(
    '/board/questions',
    { method: 'POST', body: JSON.stringify(input) },
    'Não foi possível sortear as perguntas do tabuleiro.',
  ).then((response) => response.questions);
