import { ACCURACY_MAX, lettersOnly, type Outcome } from "./common";

/** Forca: 6 erros e acabou. A palavra nunca sai do servidor; cada palpite volta com o que foi revelado. */
export const HANGMAN_ERRORS = 6;

export type HangmanState = { word: string; guessed: string[]; errors: number };

/** Letra sem acento: "Á" → "A". Qualquer outra coisa (número, símbolo) não vale como palpite. */
export function guessLetter(input: string): string | null {
  const letter = lettersOnly(input);
  return letter.length === 1 ? letter : null;
}

/** O que o jogador vê: cada posição com a letra original (com acento) ou null; espaços e hífens aparecem sempre. */
export function pattern(state: HangmanState): Array<string | null> {
  return [...state.word].map((char) => {
    const base = lettersOnly(char);
    if (base === "") return char;
    return state.guessed.includes(base) ? char : null;
  });
}

export const isWon = (state: HangmanState) => pattern(state).every((char) => char !== null);
export const isLost = (state: HangmanState) => state.errors >= HANGMAN_ERRORS;

/** Aplica um palpite (repetido não conta). */
export function applyGuess(state: HangmanState, letter: string): HangmanState {
  if (isWon(state) || isLost(state) || state.guessed.includes(letter)) return state;
  const hit = lettersOnly(state.word).includes(letter);
  return { ...state, guessed: [...state.guessed, letter], errors: state.errors + (hit ? 0 : 1) };
}

/** Pontos da vitória: precisão (menos erros) e rapidez. Derrota não pontua. */
export function hangmanOutcome(state: HangmanState, seconds: number): Outcome {
  if (!isWon(state)) return { solved: false, score: 0, detail: `Era ${state.word}` };
  const accuracy = Math.round(ACCURACY_MAX * ((HANGMAN_ERRORS - state.errors) / HANGMAN_ERRORS) * 0.7 + ACCURACY_MAX * 0.3);
  const speed = Math.max(0, 300 - Math.max(0, Math.floor(seconds) - 20));
  return { solved: true, score: accuracy + speed, detail: `${state.errors} ${state.errors === 1 ? "erro" : "erros"}` };
}

/** Dica sem entregar a resposta: troca cada pedaço do nome por traços. */
export function maskHint(hint: string, name: string): string {
  let text = hint;
  for (const part of [name, ...name.split(/\s+/)].filter((piece) => piece.length >= 3)) {
    text = text.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "___");
  }
  return text;
}
