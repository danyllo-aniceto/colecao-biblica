import { randomInt } from "node:crypto";
import { prisma, lockUser, transaction } from "../db/prisma";
import { env } from "../lib/env";
import { badRequest, notFound } from "../lib/errors";
import { z } from "../lib/validation";
import { applyGuess, guessLetter, hangmanOutcome, isLost, isWon, maskHint, pattern, HANGMAN_ERRORS, type HangmanState } from "../minigames/hangman";
import { lettersOnly, shuffled, rng, type Outcome } from "../minigames/common";
import { ANAGRAM_ATTEMPTS, anagramMatches, anagramOutcome, generateAnagram, type AnagramState } from "../minigames/anagram";
import { checkBookOrder, checkTestament, generateBookOrder, generateTestament, type BookOrder, type TestamentItem } from "../minigames/books";
import { checkBlitz, generateBlitz, type BlitzState } from "../minigames/blitz";
import { checkBlanks, generateBlanks, usableForBlanks, type BlanksState } from "../minigames/verse-blanks";
import { generateWhoAmI, whoAmIOutcome, type WhoAmIState } from "../minigames/whoami";
import { checkCrossword, generateCrossword, type CrosswordState } from "../minigames/crossword";
import { checkChain, generateChain, type ChainState } from "../minigames/graph";
import { checkLineage, generateLineage, type LineageState } from "../minigames/lineage";
import { checkMap, generateMap, type MapState } from "../minigames/places";
import { checkTimeline, generateTimeline, type TimelineState } from "../minigames/timeline";
import { checkMaze, generateMaze, type Maze } from "../minigames/maze";
import { checkMemory, generateMemory, MEMORY_PAIRS, type Memory } from "../minigames/memory";
import { checkSwapPuzzle, generateSwapPuzzle, type SwapPuzzle } from "../minigames/swap-puzzle";
import { checkVerse, generateVerse, usableVerse, type VersePuzzle } from "../minigames/verse";
import { checkWordSearch, generateWordSearch, wordSearchCandidates, WORDSEARCH_WORDS, type WordSearch } from "../minigames/wordsearch";
import { dayKeyInTimeZone, MINI_GAME_DAILY_COIN_WINS, MINI_GAME_WIN_COINS } from "./game-rules";
import { getMiniGames, recordMiniGameScore } from "./minigames";
import { visibleCharacter } from "./visibility";

const COIN_KIND = "MINIGAME";
/** Uma partida parada há mais que isto não pode mais ser terminada. */
const MAX_RUN_MS = 3 * 60 * 60 * 1000;

type RunState =
  | { game: "caca-palavras"; puzzle: WordSearch }
  | { game: "forca"; hangman: HangmanState; hint: string; testament: string | null }
  | { game: "quebra-cabeca"; puzzle: SwapPuzzle }
  | { game: "memoria"; memory: Memory }
  | { game: "versiculo"; puzzle: VersePuzzle; words: string[] }
  | { game: "labirinto"; maze: Maze }
  | { game: "anagrama"; state: AnagramState }
  | { game: "testamento"; items: TestamentItem[] }
  | { game: "livros"; puzzle: BookOrder }
  | { game: "relampago"; state: BlitzState }
  | { game: "lacunas"; state: BlanksState }
  | { game: "quem-sou-eu"; state: WhoAmIState }
  | { game: "linha-do-tempo"; state: TimelineState }
  | { game: "mapa"; state: MapState }
  | { game: "arvore"; state: LineageState }
  | { game: "interconexao"; state: ChainState }
  | { game: "palavras-cruzadas"; state: CrosswordState };

const found = z.object({ word: z.string().min(1).max(20), from: z.tuple([z.number().int(), z.number().int()]), to: z.tuple([z.number().int(), z.number().int()]) });
const answers = {
  "caca-palavras": z.object({ found: z.array(found).max(20) }),
  "quebra-cabeca": z.object({ swaps: z.array(z.tuple([z.number().int(), z.number().int()])).max(400) }),
  memoria: z.object({ flips: z.array(z.number().int()).max(400) }),
  versiculo: z.object({ taps: z.array(z.number().int()).max(400) }),
  labirinto: z.object({ moves: z.string().max(2000) }),
  livros: z.object({ order: z.array(z.string().max(40)).max(20) }),
  testamento: z.object({ choices: z.array(z.enum(["OLD", "NEW"])).max(20) }),
  relampago: z.object({ answers: z.array(z.boolean()).max(20) }),
  lacunas: z.object({ fills: z.array(z.string().max(40)).max(10) }),
  "linha-do-tempo": z.object({ order: z.array(z.string().max(20)).max(20) }),
  mapa: z.object({ guesses: z.array(z.object({ lat: z.number(), lon: z.number() })).max(10) }),
  arvore: z.object({ fathers: z.array(z.string().max(30)).max(10), links: z.array(z.string().max(30)).max(10) }),
  interconexao: z.object({ path: z.array(z.string().max(40)).max(40) }),
  "palavras-cruzadas": z.object({ rows: z.array(z.string().max(30)).max(30) }),
} as const;

/** O que a tela recebe ao começar: o jogo sem o gabarito (a forca nunca manda a palavra). */
export type StartedRun = { runId: string; game: string; puzzle: unknown };

/** Conteúdo vindo do banco: personagens publicados e cenários ativos. */
async function loadContent() {
  const [characters, scenarios] = await Promise.all([
    prisma.biblicalCharacter.findMany({ where: visibleCharacter(), orderBy: { id: "asc" }, select: { name: true, shortSummary: true, imageUrl: true, testament: true, historicalPeriod: true, bibleBooks: true, narrativeRole: true, keywords: true, importantEvents: true, curiosities: true } }),
    prisma.scenario.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" }, select: { name: true, description: true, verse: true, verseReference: true, mapImageUrl: true } }),
  ]);
  return { characters, scenarios };
}

/** Perguntas do quiz (só para o Relâmpago): texto, alternativa certa e as erradas. */
async function loadBlitzQuestions() {
  const rows = await prisma.question.findMany({ where: { active: true }, take: 400, select: { text: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOption: true } });
  return rows.map((row) => {
    const options: Record<string, string> = { A: row.optionA, B: row.optionB, C: row.optionC, D: row.optionD };
    return { text: row.text, correct: options[row.correctOption], wrong: Object.entries(options).filter(([letter]) => letter !== row.correctOption).map(([, text]) => text) };
  });
}

function build(game: string, seed: number, content: Awaited<ReturnType<typeof loadContent>>, questions: Awaited<ReturnType<typeof loadBlitzQuestions>>): { state: RunState; puzzle: unknown } {
  const random = rng(seed ^ 0x9e3779b9);
  switch (game) {
    case "caca-palavras": {
      // Personagens e lugares: com poucos personagens publicados o jogo ainda funciona.
      const names = [...content.characters.map((character) => character.name), ...content.scenarios.map((scenario) => scenario.name)];
      if (wordSearchCandidates(names).length < WORDSEARCH_WORDS) throw badRequest("Ainda não há personagens suficientes para este jogo");
      const puzzle = generateWordSearch(seed, names);
      return { state: { game, puzzle }, puzzle };
    }
    case "forca": {
      const options = [
        ...content.characters.map((character) => ({ name: character.name, shortSummary: character.shortSummary, testament: character.testament as string | null })),
        ...content.scenarios.map((scenario) => ({ name: scenario.name, shortSummary: scenario.description ?? "Um lugar da campanha.", testament: null as string | null })),
      ].filter((option) => lettersOnly(option.name).length >= 3 && option.name.length <= 18);
      if (options.length === 0) throw badRequest("Ainda não há personagens para este jogo");
      const pick = shuffled(random, options)[0];
      const hangman: HangmanState = { word: pick.name, guessed: [], errors: 0 };
      const hint = maskHint(pick.shortSummary, pick.name);
      const testament = pick.testament === "OLD" ? "Antigo Testamento" : pick.testament === "NEW" ? "Novo Testamento" : null;
      return { state: { game, hangman, hint, testament }, puzzle: { pattern: pattern(hangman), errors: 0, maxErrors: HANGMAN_ERRORS, hint, testament } };
    }
    case "quebra-cabeca": {
      const sources = [
        ...content.characters.filter((character) => character.imageUrl).map((character) => ({ imageUrl: character.imageUrl, title: character.name })),
        ...content.scenarios.filter((scenario) => scenario.mapImageUrl).map((scenario) => ({ imageUrl: scenario.mapImageUrl, title: scenario.name })),
      ];
      const source = sources.length > 0 ? shuffled(random, sources)[0] : { imageUrl: null, title: "Quebra-cabeça" };
      const puzzle = generateSwapPuzzle(seed, source);
      return { state: { game, puzzle }, puzzle };
    }
    case "memoria": {
      const pairs = content.scenarios.filter((scenario) => scenario.verseReference).map((scenario) => ({ name: scenario.name, match: scenario.verseReference! }));
      if (pairs.length < MEMORY_PAIRS) throw badRequest("Ainda não há cenários suficientes para este jogo");
      const memory = generateMemory(seed, pairs);
      return { state: { game, memory }, puzzle: memory };
    }
    case "versiculo": {
      const sources = content.scenarios.filter((scenario) => scenario.verse && scenario.verseReference).map((scenario) => ({ verse: scenario.verse!, reference: scenario.verseReference! })).filter(usableVerse);
      if (sources.length === 0) throw badRequest("Ainda não há versículos para este jogo");
      const { puzzle, words } = generateVerse(seed, shuffled(random, sources)[0]);
      // A ordem certa vai junto para a tela dar o retorno de cada toque; o servidor confere tudo de novo no fim.
      return { state: { game, puzzle, words }, puzzle: { ...puzzle, words } };
    }
    case "labirinto": {
      const maze = generateMaze(seed);
      return { state: { game, maze }, puzzle: maze };
    }
    case "anagrama": {
      const options = [
        ...content.characters.map((character) => ({ name: character.name, summary: character.shortSummary })),
        ...content.scenarios.map((scenario) => ({ name: scenario.name, summary: scenario.description ?? "Um lugar da campanha." })),
      ].filter((option) => lettersOnly(option.name).length >= 4 && lettersOnly(option.name).length <= 10);
      if (options.length === 0) throw badRequest("Ainda não há nomes para este jogo");
      const pick = shuffled(random, options)[0];
      const letters = generateAnagram(seed, pick.name);
      return { state: { game, state: { word: pick.name, attempts: 0 } }, puzzle: { letters, length: letters.length, hint: maskHint(pick.summary, pick.name), attempts: ANAGRAM_ATTEMPTS } };
    }
    case "testamento": {
      const people = content.characters.flatMap((character) => (character.testament ? [{ text: character.name, answer: character.testament as "OLD" | "NEW" }] : []));
      const { puzzle, items } = generateTestament(seed, people);
      return { state: { game, items }, puzzle };
    }
    case "livros": {
      const puzzle = generateBookOrder(seed);
      return { state: { game, puzzle }, puzzle };
    }
    case "relampago": {
      if (questions.length < 5) throw badRequest("Ainda não há perguntas suficientes para este jogo");
      const { state, puzzle } = generateBlitz(seed, questions);
      return { state: { game, state }, puzzle };
    }
    case "lacunas": {
      const sources = content.scenarios.filter((scenario) => scenario.verse && scenario.verseReference && usableForBlanks(scenario.verse)).map((scenario) => ({ verse: scenario.verse!, reference: scenario.verseReference! }));
      if (sources.length === 0) throw badRequest("Ainda não há versículos para este jogo");
      const decoys = content.scenarios.flatMap((scenario) => (scenario.verse ?? "").split(/\s+/)).map((word) => word.replace(/[^\p{L}'’-]/gu, ""));
      const { state, puzzle } = generateBlanks(seed, shuffled(random, sources)[0], decoys);
      return { state: { game, state }, puzzle };
    }
    case "linha-do-tempo": {
      const { state, puzzle } = generateTimeline(seed);
      return { state: { game, state }, puzzle };
    }
    case "mapa": {
      const { state, puzzle } = generateMap(seed);
      return { state: { game, state }, puzzle };
    }
    case "arvore": {
      const { state, puzzle } = generateLineage(seed);
      return { state: { game, state }, puzzle };
    }
    case "interconexao": {
      const { state, puzzle } = generateChain(seed);
      return { state: { game, state }, puzzle };
    }
    case "palavras-cruzadas": {
      // Personagens e lugares: a dica é a descrição com o nome trocado por traços.
      const entries = [
        ...content.characters.map((character) => ({ word: lettersOnly(character.name), clue: maskHint(character.shortSummary, character.name) })),
        ...content.scenarios.map((scenario) => ({ word: lettersOnly(scenario.name), clue: `Lugar: ${maskHint(scenario.description ?? "um cenário da campanha", scenario.name)}` })),
      ].filter((entry, index, all) => entry.word.length >= 3 && all.findIndex((other) => other.word === entry.word) === index);
      const generated = generateCrossword(seed, entries);
      if (!generated) throw badRequest("Ainda não há nomes suficientes para este jogo");
      return { state: { game, state: generated.state }, puzzle: generated.puzzle };
    }
    case "quem-sou-eu": {
      if (content.characters.length < 4) throw badRequest("Ainda não há personagens suficientes para este jogo");
      const { state, puzzle } = generateWhoAmI(seed, content.characters);
      return { state: { game, state }, puzzle };
    }
    default:
      throw notFound("Mini game não encontrado");
  }
}

/** Começa uma partida: sorteia o jogo, guarda o gabarito no servidor e devolve só o que a tela precisa. */
export async function startMiniGame(userId: number, gameId: string): Promise<StartedRun> {
  const { games } = await getMiniGames(prisma, userId);
  const game = games.find((item) => item.id === gameId);
  if (!game) throw notFound("Mini game não encontrado");
  if (!game.unlocked) throw badRequest("Esse mini game ainda não foi liberado");
  if (!game.ready) throw badRequest("Esse mini game ainda não está disponível");
  await prisma.miniGameRun.deleteMany({ where: { OR: [{ userId, gameId, finishedAt: null }, { startedAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }] } });
  const { state, puzzle } = build(gameId, randomInt(1, 2 ** 31 - 1), await loadContent(), gameId === "relampago" ? await loadBlitzQuestions() : []);
  const run = await prisma.miniGameRun.create({ data: { userId, gameId, state: state as object } });
  return { runId: run.id, game: gameId, puzzle };
}

/** Moedas da primeira vitória do dia neste jogo, até `MINI_GAME_DAILY_COIN_WINS` jogos por dia. */
async function awardCoins(userId: number, gameId: string): Promise<{ coins: number; userCoins: number | null }> {
  const day = dayKeyInTimeZone(new Date(), env.timezone);
  return transaction(async (tx) => {
    await lockUser(tx, userId);
    const todays = await tx.userClaim.findMany({ where: { userId, kind: COIN_KIND, periodKey: day }, select: { code: true } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } });
    if (todays.length >= MINI_GAME_DAILY_COIN_WINS || todays.some((claim) => claim.code === gameId)) return { coins: 0, userCoins: user.coins };
    await tx.userClaim.create({ data: { userId, kind: COIN_KIND, code: gameId, periodKey: day } });
    const saved = await tx.user.update({ where: { id: userId }, data: { coins: { increment: MINI_GAME_WIN_COINS } }, select: { coins: true } });
    return { coins: MINI_GAME_WIN_COINS, userCoins: saved.coins };
  });
}

export type MiniGameResult = Outcome & { best: number; recorded: boolean; rankingUnlocked: boolean; weekKey: string; coins: number; userCoins: number | null };

/** Fecha a partida (uma vez só): pontos no ranking semanal (quem completou o Peitoral) e moedas na primeira vitória do dia. */
async function settle(userId: number, gameId: string, outcome: Outcome): Promise<MiniGameResult> {
  const { rankingUnlocked, weekKey } = await getMiniGames(prisma, userId);
  const recorded = outcome.score > 0 ? await recordMiniGameScore(prisma, userId, gameId, outcome.score) : { recorded: false, best: 0, weekKey };
  const prize = outcome.solved ? await awardCoins(userId, gameId) : { coins: 0, userCoins: null };
  return { ...outcome, best: recorded.best, recorded: recorded.recorded, rankingUnlocked, weekKey, ...prize };
}

async function openRun(userId: number, runId: string) {
  const run = await prisma.miniGameRun.findFirst({ where: { id: runId, userId } });
  if (!run) throw notFound("Partida não encontrada");
  if (run.finishedAt) throw badRequest("Esta partida já terminou");
  if (Date.now() - run.startedAt.getTime() > MAX_RUN_MS) throw badRequest("Esta partida expirou. Comece outra.");
  return run;
}

/** Fecha a linha da partida; se outra chamada fechou primeiro, não conta de novo. */
async function closeRun(runId: string, state?: object) {
  const closed = await prisma.miniGameRun.updateMany({ where: { id: runId, finishedAt: null }, data: { finishedAt: new Date(), ...(state ? { state } : {}) } });
  if (closed.count === 0) throw badRequest("Esta partida já terminou");
}

/** Termina o jogo conferindo no servidor a resposta que a tela mandou. Não vale para a forca (cada palpite é conferido na hora). */
export async function finishMiniGame(userId: number, runId: string, body: unknown): Promise<MiniGameResult> {
  const run = await openRun(userId, runId);
  const state = run.state as unknown as RunState;
  const seconds = (Date.now() - run.startedAt.getTime()) / 1000;
  let outcome: Outcome;
  switch (state.game) {
    case "caca-palavras":
      outcome = checkWordSearch(state.puzzle, answers["caca-palavras"].parse(body).found, seconds);
      break;
    case "quebra-cabeca":
      outcome = checkSwapPuzzle(state.puzzle, answers["quebra-cabeca"].parse(body).swaps, seconds);
      break;
    case "memoria":
      outcome = checkMemory(state.memory, answers.memoria.parse(body).flips, seconds);
      break;
    case "versiculo":
      outcome = checkVerse(state.puzzle, state.words, answers.versiculo.parse(body).taps, seconds);
      break;
    case "labirinto":
      outcome = checkMaze(state.maze, answers.labirinto.parse(body).moves, seconds);
      break;
    case "livros":
      outcome = checkBookOrder(state.puzzle, answers.livros.parse(body).order, seconds);
      break;
    case "testamento":
      outcome = checkTestament(state.items, answers.testamento.parse(body).choices, seconds);
      break;
    case "relampago":
      outcome = checkBlitz(state.state, answers.relampago.parse(body).answers, seconds);
      break;
    case "lacunas":
      outcome = checkBlanks(state.state, answers.lacunas.parse(body).fills, seconds);
      break;
    case "linha-do-tempo":
      outcome = checkTimeline(state.state, answers["linha-do-tempo"].parse(body).order, seconds);
      break;
    case "mapa":
      outcome = checkMap(state.state, answers.mapa.parse(body).guesses, seconds);
      break;
    case "arvore": {
      const answer = answers.arvore.parse(body);
      outcome = checkLineage(state.state, answer.fathers, answer.links, seconds);
      break;
    }
    case "interconexao":
      outcome = checkChain(state.state, answers.interconexao.parse(body).path, seconds);
      break;
    case "palavras-cruzadas":
      outcome = checkCrossword(state.state, answers["palavras-cruzadas"].parse(body).rows, seconds);
      break;
    default:
      throw badRequest("Este jogo termina palpite a palpite");
  }
  await closeRun(run.id);
  return settle(userId, run.gameId, outcome);
}

export type GuessResult = { pattern: Array<string | null>; errors: number; maxErrors: number; status: "playing" | "won" | "lost"; word?: string; result?: MiniGameResult };

/** Forca: aplica um palpite no servidor (a palavra não sai dele). Ao ganhar ou perder, fecha a partida. */
export async function guessHangman(userId: number, runId: string, letterInput: string): Promise<GuessResult> {
  const letter = guessLetter(letterInput);
  if (!letter) throw badRequest("Escolha uma letra");
  const next = await transaction(async (tx) => {
    await lockUser(tx, userId);
    const run = await tx.miniGameRun.findFirst({ where: { id: runId, userId } });
    if (!run) throw notFound("Partida não encontrada");
    if (run.finishedAt) throw badRequest("Esta partida já terminou");
    if (Date.now() - run.startedAt.getTime() > MAX_RUN_MS) throw badRequest("Esta partida expirou. Comece outra.");
    const state = run.state as unknown as RunState;
    if (state.game !== "forca") throw badRequest("Esta partida não é de forca");
    const hangman = applyGuess(state.hangman, letter);
    const over = isWon(hangman) || isLost(hangman);
    await tx.miniGameRun.update({ where: { id: run.id }, data: { state: { ...state, hangman } as object, ...(over ? { finishedAt: new Date() } : {}) } });
    return { hangman, over, seconds: (Date.now() - run.startedAt.getTime()) / 1000 };
  });
  const { hangman } = next;
  const base = { pattern: pattern(hangman), errors: hangman.errors, maxErrors: HANGMAN_ERRORS };
  if (!next.over) return { ...base, status: "playing" };
  const result = await settle(userId, "forca", hangmanOutcome(hangman, next.seconds));
  return isWon(hangman) ? { ...base, status: "won", result } : { ...base, status: "lost", word: hangman.word, result };
}

export type ActResult = {
  status: "playing" | "won" | "lost";
  /** Anagrama: tentativas que restam. */
  attemptsLeft?: number;
  /** Quem sou eu?: a nova dica (quando pediu mais uma). */
  clue?: string;
  shown?: number;
  total?: number;
  /** Ao perder, a resposta certa. */
  answer?: string;
  result?: MiniGameResult;
};

const actBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), word: z.string().max(40) }),
  z.object({ action: z.literal("hint") }),
  z.object({ action: z.literal("answer"), choice: z.number().int().min(0).max(3) }),
]);

/** Jogos que se resolvem passo a passo no servidor (anagrama: cada palpite; quem sou eu?: cada dica e a resposta). */
export async function actMiniGame(userId: number, runId: string, body: unknown): Promise<ActResult> {
  const input = actBody.parse(body);
  const step = await transaction(async (tx) => {
    await lockUser(tx, userId);
    const run = await tx.miniGameRun.findFirst({ where: { id: runId, userId } });
    if (!run) throw notFound("Partida não encontrada");
    if (run.finishedAt) throw badRequest("Esta partida já terminou");
    if (Date.now() - run.startedAt.getTime() > MAX_RUN_MS) throw badRequest("Esta partida expirou. Comece outra.");
    const state = run.state as unknown as RunState;
    const seconds = (Date.now() - run.startedAt.getTime()) / 1000;
    const save = (next: RunState, over: boolean) => tx.miniGameRun.update({ where: { id: run.id }, data: { state: next as object, ...(over ? { finishedAt: new Date() } : {}) } });

    if (state.game === "anagrama" && input.action === "check") {
      const attempts = state.state.attempts + 1;
      const next = { ...state.state, attempts };
      const right = anagramMatches(next, input.word);
      const over = right || attempts >= ANAGRAM_ATTEMPTS;
      await save({ game: "anagrama", state: next }, over);
      return { game: "anagrama" as const, over, right, outcome: over ? anagramOutcome(next, right, seconds) : null, attemptsLeft: ANAGRAM_ATTEMPTS - attempts, answer: next.word };
    }
    if (state.game === "quem-sou-eu" && input.action === "hint") {
      if (state.state.shown >= state.state.clues.length) throw badRequest("Não há mais dicas");
      const next = { ...state.state, shown: state.state.shown + 1 };
      await save({ game: "quem-sou-eu", state: next }, false);
      return { game: "quem-sou-eu" as const, over: false, right: false, outcome: null, clue: next.clues[next.shown - 1], shown: next.shown, total: next.clues.length, answer: "" };
    }
    if (state.game === "quem-sou-eu" && input.action === "answer") {
      const outcome = whoAmIOutcome(state.state, input.choice, seconds);
      await save(state, true);
      return { game: "quem-sou-eu" as const, over: true, right: outcome.solved, outcome, answer: state.state.options[state.state.answer] };
    }
    throw badRequest("Ação inválida para este jogo");
  });
  if (!step.over) return { status: "playing", attemptsLeft: "attemptsLeft" in step ? step.attemptsLeft : undefined, clue: "clue" in step ? step.clue : undefined, shown: "shown" in step ? step.shown : undefined, total: "total" in step ? step.total : undefined };
  const result = await settle(userId, step.game, step.outcome!);
  return step.right ? { status: "won", result } : { status: "lost", answer: step.answer, result };
}
