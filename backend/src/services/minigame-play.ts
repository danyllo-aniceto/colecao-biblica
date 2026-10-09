import { randomInt } from "node:crypto";
import { prisma, lockUser, transaction } from "../db/prisma";
import { env } from "../lib/env";
import { badRequest, notFound } from "../lib/errors";
import { z } from "../lib/validation";
import { hangmanGameOutcome, maskHint, newHangman, pickHangmanRounds, playHangman, publicHangman, ROUND_CHOICES as HANGMAN_ROUNDS, TIME_CHOICES as HANGMAN_TIMES, type HangmanGameState } from "../minigames/hangman";
import { lettersOnly, plainText, shuffled, rng, type Outcome } from "../minigames/common";
import { anagramOutcome, newAnagram, pickRounds, playAnagram, publicRound, ROUND_CHOICES as ANAGRAM_ROUNDS, TIME_CHOICES as ANAGRAM_TIMES, type AnagramState } from "../minigames/anagram";
import { bookOrderOutcome, BOOK_TIME_CHOICES, newBookOrder, playBookOrder, publicBookOrder, ROUND_CHOICES as BOOK_ROUNDS, type BookOrderState } from "../minigames/books";
import { COUNT_CHOICES as TESTAMENT_COUNTS, newTestament, pickTestamentItems, playTestament, publicTestament, testamentOutcome, TIME_CHOICES as TESTAMENT_TIMES, type TestamentState } from "../minigames/testament";
import { LEVEL_IDS, maxScoreOf, safeWords, TurnError, type Level } from "../minigames/turns";
import { blitzOutcome, COUNT_CHOICES as BLITZ_COUNTS, newBlitz, pickBlitzItems, playBlitz, publicBlitz, TIME_CHOICES as BLITZ_TIMES, type BlitzState } from "../minigames/blitz";
import { blanksOutcome, newBlanks, pickBlanksRounds, playBlanks, publicBlanks, ROUND_CHOICES as BLANKS_ROUNDS, TIME_CHOICES as BLANKS_TIMES, type BlanksState } from "../minigames/verse-blanks";
import { newWhoAmI, pickWhoAmIRounds, playWhoAmI, publicWhoAmI, ROUND_CHOICES as WHOAMI_ROUNDS, TIME_CHOICES as WHOAMI_TIMES, whoAmIOutcome, type WhoAmIState } from "../minigames/whoami";
import { checkCrossword, CHECK_PENALTY, CROSSWORD_LEVELS, generateCrossword, letterAt, PEEK_PENALTY, TIME_CHOICES as CROSSWORD_TIMES, wrongCells, type CrosswordState } from "../minigames/crossword";
import { checkChain, generateChain, type ChainState } from "../minigames/graph";
import { checkLineage, generateLineage, type LineageState } from "../minigames/lineage";
import { checkMap, generateMap, type MapState } from "../minigames/places";
import { checkTimeline, generateTimeline, type TimelineState } from "../minigames/timeline";
import { checkMaze, generateMaze, type Maze } from "../minigames/maze";
import { checkMemory, generateMemory, MEMORY_PAIRS, type Memory } from "../minigames/memory";
import { checkSwapPuzzle, generateSwapPuzzle, type SwapPuzzle } from "../minigames/swap-puzzle";
import { newVerse, pickVerseRounds, playVerse, publicVerse, ROUND_CHOICES as VERSE_ROUNDS, TIME_CHOICES as VERSE_TIMES, verseOutcome, type VerseState } from "../minigames/verse";
import { checkWordSearch, DIFFICULTY_IDS, generateWordSearch, THEME_IDS, wordSearchCandidates, type WordSearchState } from "../minigames/wordsearch";
import { dayKeyInTimeZone, MINI_GAME_DAILY_COIN_WINS, MINI_GAME_WIN_COINS } from "./game-rules";
import { getMiniGames, recordMiniGameScore } from "./minigames";
import { visibleCharacter } from "./visibility";

const COIN_KIND = "MINIGAME";
/** Uma partida parada há mais que isto não pode mais ser terminada. */
const MAX_RUN_MS = 3 * 60 * 60 * 1000;

type RunState =
  | ({ game: "caca-palavras" } & WordSearchState)
  | { game: "forca"; state: HangmanGameState }
  | { game: "quebra-cabeca"; puzzle: SwapPuzzle }
  | { game: "memoria"; memory: Memory }
  | { game: "versiculo"; state: VerseState }
  | { game: "labirinto"; maze: Maze }
  | { game: "anagrama"; state: AnagramState }
  | { game: "testamento"; state: TestamentState }
  | { game: "livros"; state: BookOrderState }
  | { game: "relampago"; state: BlitzState }
  | { game: "lacunas"; state: BlanksState }
  | { game: "quem-sou-eu"; state: WhoAmIState }
  | { game: "linha-do-tempo"; state: TimelineState }
  | { game: "mapa"; state: MapState }
  | { game: "arvore"; state: LineageState }
  | { game: "interconexao"; state: ChainState }
  | { game: "palavras-cruzadas"; state: CrosswordState };

/** Escolhas da tela de preparo (caça-palavras: dificuldade e tema; anagrama: dificuldade, turnos e tempo). */
const startOptions = z.object({
  difficulty: z.enum(DIFFICULTY_IDS as [string, ...string[]]).optional(),
  theme: z.enum(THEME_IDS as [string, ...string[]]).optional(),
  /** Turnos (anagrama, forca, livros em ordem) ou itens (antigo ou novo?). */
  rounds: z.number().int().min(1).max(30).optional(),
  /** Segundos por turno ou por item (null/ausente = sem tempo). Cada jogo aceita só as suas opções. */
  time: z.number().int().min(5).max(900).nullable().optional(),
});
type StartOptions = z.infer<typeof startOptions>;
/** Valor escolhido na tela de preparo, aceito só se estiver nas opções do jogo. */
function choose<T extends number>(value: number | null | undefined, allowed: readonly T[], fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (!allowed.includes(value as T)) throw badRequest("Opção inválida para este jogo");
  return value as T;
}
const chooseTime = (value: number | null | undefined, allowed: readonly number[]) => (value === undefined || value === null ? null : choose(value, allowed, allowed[0]));
const levelOf = (value: string | undefined): Level => (LEVEL_IDS.includes(value as Level) ? (value as Level) : "medio");

type Extras = { options: StartOptions; recentWords: string[] };

/** Jogos em turnos (anagrama, forca, livros em ordem, antigo ou novo?...): o motor puro recebe cada jogada e o servidor só guarda o estado. */
type TurnGame = {
  play: (state: never, action: never, now: number) => { state: unknown; event: unknown; done: boolean };
  outcome: (state: never) => Outcome;
  /** Palavras/itens da partida, para o sorteio evitar repetir nas próximas. */
  words: (state: never) => string[];
};
const turnGame = <S, A>(game: { play: (state: S, action: A, now: number) => { state: unknown; event: unknown; done: boolean }; outcome: (state: S) => Outcome; words: (state: S) => string[] }) => game as unknown as TurnGame;
const TURN_GAMES: Record<string, TurnGame> = {
  anagrama: turnGame<AnagramState, Parameters<typeof playAnagram>[1]>({ play: playAnagram, outcome: anagramOutcome, words: (state) => state.rounds.map((round) => round.word) }),
  forca: turnGame<HangmanGameState, Parameters<typeof playHangman>[1]>({ play: playHangman, outcome: hangmanGameOutcome, words: (state) => state.rounds.map((round) => round.word) }),
  testamento: turnGame<TestamentState, Parameters<typeof playTestament>[1]>({ play: playTestament, outcome: testamentOutcome, words: (state) => state.items.map((item) => item.text) }),
  relampago: turnGame<BlitzState, Parameters<typeof playBlitz>[1]>({ play: playBlitz, outcome: blitzOutcome, words: (state) => state.items.map((item) => item.question) }),
  versiculo: turnGame<VerseState, Parameters<typeof playVerse>[1]>({ play: playVerse, outcome: verseOutcome, words: (state) => state.rounds.map((round) => round.reference) }),
  lacunas: turnGame<BlanksState, Parameters<typeof playBlanks>[1]>({ play: playBlanks, outcome: blanksOutcome, words: (state) => state.rounds.map((round) => round.reference) }),
  "quem-sou-eu": turnGame<WhoAmIState, Parameters<typeof playWhoAmI>[1]>({ play: playWhoAmI, outcome: whoAmIOutcome, words: (state) => state.rounds.map((round) => round.name) }),
  livros: turnGame<BookOrderState, Parameters<typeof playBookOrder>[1]>({ play: playBookOrder, outcome: bookOrderOutcome, words: (state) => state.sets.flat() }),
};

const found = z.object({ word: z.string().min(1).max(20), from: z.tuple([z.number().int(), z.number().int()]), to: z.tuple([z.number().int(), z.number().int()]) });
const answers = {
  "caca-palavras": z.object({ found: z.array(found).max(20) }),
  "quebra-cabeca": z.object({ swaps: z.array(z.tuple([z.number().int(), z.number().int()])).max(400) }),
  memoria: z.object({ flips: z.array(z.number().int()).max(400) }),
  labirinto: z.object({ moves: z.string().max(2000) }),
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
  const rows = await prisma.question.findMany({ where: { active: true }, take: 600, select: { text: true, difficulty: true, optionA: true, optionB: true, optionC: true, optionD: true, correctOption: true, explanation: true, bibleReference: true } });
  return rows.map((row) => {
    const options: Record<string, string> = { A: row.optionA, B: row.optionB, C: row.optionC, D: row.optionD };
    return {
      text: row.text,
      correct: options[row.correctOption],
      wrong: Object.entries(options).filter(([letter]) => letter !== row.correctOption).map(([, text]) => text),
      difficulty: row.difficulty,
      explanation: row.explanation ? plainText(row.explanation) : null,
      reference: row.bibleReference,
    };
  });
}

function build(game: string, seed: number, content: Awaited<ReturnType<typeof loadContent>>, questions: Awaited<ReturnType<typeof loadBlitzQuestions>>, extras: Extras): { state: RunState; puzzle: unknown } {
  const random = rng(seed ^ 0x9e3779b9);
  switch (game) {
    case "caca-palavras": {
      // Personagens, lugares e livros da Bíblia; as palavras das últimas partidas ficam por último para não parecer repetido.
      const candidates = wordSearchCandidates({ characters: content.characters.map((character) => ({ name: character.name, imageUrl: character.imageUrl, testament: character.testament })), scenarios: content.scenarios });
      const generated = generateWordSearch(seed, candidates, { difficulty: extras.options.difficulty as never, theme: extras.options.theme as never, avoid: extras.recentWords });
      if (!generated) throw badRequest("Ainda não há palavras suficientes para esta dificuldade");
      return { state: { game, puzzle: generated.puzzle, placements: generated.placements, hinted: [] }, puzzle: generated.puzzle };
    }
    case "forca": {
      const sources = [
        ...content.characters.map((character) => ({ name: character.name, summary: character.shortSummary, testament: character.testament as string | null, imageUrl: character.imageUrl })),
        ...content.scenarios.map((scenario) => ({ name: scenario.name, summary: scenario.description ?? "Um lugar da campanha.", testament: null as string | null, imageUrl: scenario.mapImageUrl })),
      ];
      const level = levelOf(extras.options.difficulty);
      const rounds = pickHangmanRounds(random, sources, level, choose(extras.options.rounds, HANGMAN_ROUNDS, 3), extras.recentWords);
      if (rounds.length === 0) throw badRequest("Ainda não há palavras suficientes para esta dificuldade");
      const state = newHangman(seed, rounds, level, chooseTime(extras.options.time, HANGMAN_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicHangman(state) };
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
      const sources = content.scenarios.filter((scenario) => scenario.verse && scenario.verseReference).map((scenario) => ({ verse: scenario.verse!, reference: scenario.verseReference!, title: scenario.name, imageUrl: scenario.mapImageUrl }));
      const level = levelOf(extras.options.difficulty);
      const rounds = pickVerseRounds(random, sources, level, choose(extras.options.rounds, VERSE_ROUNDS, 3), extras.recentWords);
      if (rounds.length === 0) throw badRequest("Ainda não há versículos para esta dificuldade");
      const state = newVerse(seed, rounds, level, chooseTime(extras.options.time, VERSE_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicVerse(state) };
    }
    case "labirinto": {
      const maze = generateMaze(seed);
      return { state: { game, maze }, puzzle: maze };
    }
    case "anagrama": {
      const sources = [
        ...content.characters.map((character) => ({ name: character.name, summary: character.shortSummary, imageUrl: character.imageUrl })),
        ...content.scenarios.map((scenario) => ({ name: scenario.name, summary: scenario.description ?? "Um lugar da campanha.", imageUrl: scenario.mapImageUrl })),
      ];
      const difficulty = levelOf(extras.options.difficulty);
      const wanted = choose(extras.options.rounds, ANAGRAM_ROUNDS, 5);
      const rounds = pickRounds(random, sources, difficulty, wanted, extras.recentWords);
      // Poucos nomes no tamanho pedido: joga com os que há (ao menos 1).
      if (rounds.length === 0) throw badRequest("Ainda não há nomes suficientes para esta dificuldade");
      const state = newAnagram(seed, rounds, difficulty, chooseTime(extras.options.time, ANAGRAM_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicRound(state) };
    }
    case "testamento": {
      const people = content.characters.map((character) => ({ name: character.name, testament: character.testament as string | null, imageUrl: character.imageUrl }));
      const level = levelOf(extras.options.difficulty);
      const items = pickTestamentItems(random, people, level, choose(extras.options.rounds, TESTAMENT_COUNTS, 10), extras.recentWords);
      const state = newTestament(seed, items, level, chooseTime(extras.options.time, TESTAMENT_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicTestament(state) };
    }
    case "livros": {
      const state = newBookOrder(seed, levelOf(extras.options.difficulty), choose(extras.options.rounds, BOOK_ROUNDS, 3), chooseTime(extras.options.time, BOOK_TIME_CHOICES), Date.now());
      return { state: { game, state }, puzzle: publicBookOrder(state) };
    }
    case "relampago": {
      if (questions.length < 5) throw badRequest("Ainda não há perguntas suficientes para este jogo");
      const level = levelOf(extras.options.difficulty);
      const items = pickBlitzItems(random, questions, level, choose(extras.options.rounds, BLITZ_COUNTS, 10), extras.recentWords);
      const state = newBlitz(seed, items, level, chooseTime(extras.options.time, BLITZ_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicBlitz(state) };
    }
    case "lacunas": {
      const sources = content.scenarios.filter((scenario) => scenario.verse && scenario.verseReference).map((scenario) => ({ verse: scenario.verse!, reference: scenario.verseReference!, title: scenario.name, imageUrl: scenario.mapImageUrl }));
      const decoys = content.scenarios.flatMap((scenario) => (scenario.verse ?? "").split(/\s+/)).map((word) => word.replace(/[^\p{L}'’-]/gu, ""));
      const level = levelOf(extras.options.difficulty);
      const rounds = pickBlanksRounds(random, sources, level, choose(extras.options.rounds, BLANKS_ROUNDS, 3), extras.recentWords, decoys);
      if (rounds.length === 0) throw badRequest("Ainda não há versículos para esta dificuldade");
      const state = newBlanks(seed, rounds, level, chooseTime(extras.options.time, BLANKS_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicBlanks(state) };
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
      // Personagens e lugares: a dica é a descrição com o nome trocado por traços; a foto só aparece no fim.
      const entries = [
        ...content.characters.map((character) => ({ word: lettersOnly(character.name), clue: maskHint(character.shortSummary, character.name), label: character.name, imageUrl: character.imageUrl })),
        ...content.scenarios.map((scenario) => ({ word: lettersOnly(scenario.name), clue: `Lugar: ${maskHint(scenario.description ?? "um cenário da campanha", scenario.name)}`, label: scenario.name, imageUrl: scenario.mapImageUrl })),
      ].filter((entry, index, all) => entry.word.length >= 3 && all.findIndex((other) => other.word === entry.word) === index);
      const level = levelOf(extras.options.difficulty);
      const generated = generateCrossword(seed, entries, level);
      if (!generated) throw badRequest("Ainda não há nomes suficientes para esta dificuldade");
      const config = CROSSWORD_LEVELS[level];
      const timeLimit = chooseTime(extras.options.time, CROSSWORD_TIMES);
      const state: CrosswordState = { ...generated.state, level, timeLimit, checks: 0, peeks: 0 };
      return { state: { game, state }, puzzle: { ...generated.puzzle, level, timeLimit, checksLeft: config.checks, peeksLeft: config.peeks, par: config.par, maxScore: maxScoreOf(level), checkPenalty: CHECK_PENALTY, peekPenalty: PEEK_PENALTY } };
    }
    case "quem-sou-eu": {
      if (content.characters.length < 4) throw badRequest("Ainda não há personagens suficientes para este jogo");
      const level = levelOf(extras.options.difficulty);
      const rounds = pickWhoAmIRounds(random, content.characters, level, choose(extras.options.rounds, WHOAMI_ROUNDS, 3), extras.recentWords);
      const state = newWhoAmI(seed, rounds, level, chooseTime(extras.options.time, WHOAMI_TIMES), Date.now());
      return { state: { game, state }, puzzle: publicWhoAmI(state) };
    }
    default:
      throw notFound("Mini game não encontrado");
  }
}

/** Palavras das últimas partidas do jogador (as do banco guardam 2 dias): o sorteio as deixa por último. */
async function recentWords(userId: number, gameId: string): Promise<string[]> {
  const runs = await prisma.miniGameRun.findMany({ where: { userId, gameId }, orderBy: { startedAt: "desc" }, take: 8, select: { state: true } });
  const turn = TURN_GAMES[gameId];
  return runs.flatMap((run) => {
    const state = run.state as unknown as { puzzle?: { words?: string[] }; state?: unknown };
    if (turn && state.state) return safeWords(turn.words, state.state);
    return state.puzzle?.words ?? [];
  });
}

/** Começa uma partida: sorteia o jogo, guarda o gabarito no servidor e devolve só o que a tela precisa. */
export async function startMiniGame(userId: number, gameId: string, body: unknown = {}): Promise<StartedRun> {
  const { games } = await getMiniGames(prisma, userId);
  const game = games.find((item) => item.id === gameId);
  if (!game) throw notFound("Mini game não encontrado");
  if (!game.unlocked) throw badRequest("Esse mini game ainda não foi liberado");
  if (!game.ready) throw badRequest("Esse mini game ainda não está disponível");
  await prisma.miniGameRun.deleteMany({ where: { OR: [{ userId, gameId, finishedAt: null }, { startedAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } }] } });
  const options = startOptions.safeParse(body ?? {});
  if (!options.success) throw badRequest("Escolha de dificuldade ou tema inválida");
  const { state, puzzle } = build(gameId, randomInt(1, 2 ** 31 - 1), await loadContent(), gameId === "relampago" ? await loadBlitzQuestions() : [], { options: options.data, recentWords: gameId === "caca-palavras" || gameId in TURN_GAMES ? await recentWords(userId, gameId) : [] });
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
      outcome = checkWordSearch(state, answers["caca-palavras"].parse(body).found, seconds);
      break;
    case "quebra-cabeca":
      outcome = checkSwapPuzzle(state.puzzle, answers["quebra-cabeca"].parse(body).swaps, seconds);
      break;
    case "memoria":
      outcome = checkMemory(state.memory, answers.memoria.parse(body).flips, seconds);
      break;
    case "labirinto":
      outcome = checkMaze(state.maze, answers.labirinto.parse(body).moves, seconds);
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

export type ActResult = {
  status: "playing" | "won" | "lost";
  /** Jogos em turnos: o que aconteceu na jogada (palpite, fim do turno) e o próximo turno. O formato é de cada jogo. */
  turn?: unknown;
  /** Caça-palavras: onde a palavra da dica começa e quantas dicas ainda restam. */
  cell?: [number, number];
  hintsLeft?: number;
  /** Ao perder, a resposta certa. */
  answer?: string;
  result?: MiniGameResult;
};

const actBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("check"), word: z.string().max(40) }),
  z.object({ action: z.literal("skip") }),
  z.object({ action: z.literal("timeout") }),
  z.object({ action: z.literal("begin") }),
  z.object({ action: z.literal("hint"), word: z.string().max(20).optional() }),
  z.object({ action: z.literal("answer"), choice: z.number().int().min(0).max(7) }),
  z.object({ action: z.literal("guess"), letter: z.string().min(1).max(4) }),
  z.object({ action: z.literal("reveal") }),
  z.object({ action: z.literal("classify"), choice: z.enum(["OLD", "NEW"]) }),
  z.object({ action: z.literal("judge"), value: z.boolean() }),
  z.object({ action: z.literal("tap"), index: z.number().int() }),
  z.object({ action: z.literal("fill"), fills: z.array(z.string().max(40)).max(8) }),
  z.object({ action: z.literal("verify"), rows: z.array(z.string().max(30)).max(30) }),
  z.object({ action: z.literal("peek"), row: z.number().int().min(0).max(30), col: z.number().int().min(0).max(30) }),
  z.object({ action: z.literal("order"), order: z.array(z.string().max(40)).max(12) }),
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

    const turn = TURN_GAMES[state.game];
    if (turn) {
      const { action, ...rest } = input;
      let played: ReturnType<TurnGame["play"]>;
      try {
        played = turn.play((state as unknown as { state: never }).state, { type: action, ...rest } as never, Date.now());
      } catch (reason) {
        if (reason instanceof TurnError) throw badRequest(reason.message);
        throw reason;
      }
      await save({ game: state.game, state: played.state } as RunState, played.done);
      const outcome = played.done ? turn.outcome(played.state as never) : null;
      return { game: state.game, over: played.done, right: outcome?.solved ?? false, outcome, answer: "", turn: played.event };
    }
    if (state.game === "caca-palavras" && input.action === "hint") {
      const placement = state.placements.find((entry) => entry.word === input.word);
      if (!placement) throw badRequest("Escolha uma palavra da lista");
      const asked = state.hinted.includes(placement.word);
      if (!asked && state.hinted.length >= state.puzzle.hints) throw badRequest("Acabaram as dicas desta partida");
      const hinted = asked ? state.hinted : [...state.hinted, placement.word];
      if (!asked) await save({ ...state, hinted }, false);
      return { game: "caca-palavras" as const, over: false, right: false, outcome: null, answer: "", cell: placement.from, hintsLeft: state.puzzle.hints - hinted.length };
    }
    if (state.game === "palavras-cruzadas" && (input.action === "verify" || input.action === "peek")) {
      const config = CROSSWORD_LEVELS[state.state.level];
      if (input.action === "verify") {
        if (state.state.checks >= config.checks) throw badRequest("Acabaram as conferências desta partida");
        const next = { ...state.state, checks: state.state.checks + 1 };
        await save({ game: "palavras-cruzadas", state: next }, false);
        return { game: "palavras-cruzadas" as const, over: false, right: false, outcome: null, answer: "", turn: { kind: "verify", wrong: wrongCells(state.state, input.rows), left: config.checks - next.checks } };
      }
      const letter = letterAt(state.state, input.row, input.col);
      if (!letter) throw badRequest("Escolha uma casa da grade");
      if (state.state.peeks >= config.peeks) throw badRequest("Acabaram as letras reveladas desta partida");
      const next = { ...state.state, peeks: state.state.peeks + 1 };
      await save({ game: "palavras-cruzadas", state: next }, false);
      return { game: "palavras-cruzadas" as const, over: false, right: false, outcome: null, answer: "", turn: { kind: "peek", row: input.row, col: input.col, letter, left: config.peeks - next.peeks } };
    }
    throw badRequest("Ação inválida para este jogo");
  });
  if (!step.over) return { status: "playing", turn: "turn" in step ? step.turn : undefined, cell: "cell" in step ? step.cell : undefined, hintsLeft: "hintsLeft" in step ? step.hintsLeft : undefined };
  const result = await settle(userId, step.game, step.outcome!);
  const turnEvent = "turn" in step ? step.turn : undefined;
  return step.right ? { status: "won", turn: turnEvent, result } : { status: "lost", answer: step.answer, turn: turnEvent, result };
}
