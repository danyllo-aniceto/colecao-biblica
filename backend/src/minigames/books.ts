import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Os 66 livros da Bíblia (protestante), na ordem canônica; os 39 primeiros são do Antigo Testamento. */
export const BOOKS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas",
  "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oseias",
  "Joel", "Amós", "Obadias", "Jonas", "Miqueias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos",
  "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo",
  "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
] as const;

export const OLD_TESTAMENT_BOOKS = 39;
export const bookTestament = (book: string): "OLD" | "NEW" | null => {
  const index = BOOKS.indexOf(book as (typeof BOOKS)[number]);
  return index < 0 ? null : index < OLD_TESTAMENT_BOOKS ? "OLD" : "NEW";
};

/** Livros em ordem: 6 livros embaralhados para pôr na ordem em que aparecem na Bíblia. */
export const ORDER_BOOKS = 6;
export type BookOrder = { books: string[] };

export function generateBookOrder(seed: number): BookOrder {
  const random = rng(seed);
  const chosen = shuffled(random, BOOKS).slice(0, ORDER_BOOKS);
  let books = shuffled(random, chosen);
  const sorted = [...chosen].sort((a, b) => BOOKS.indexOf(a as (typeof BOOKS)[number]) - BOOKS.indexOf(b as (typeof BOOKS)[number]));
  while (books.every((book, index) => book === sorted[index])) books = shuffled(random, chosen);
  return { books };
}

/** Pontua cada posição certa; completa e rápido ganha o bônus de tempo. */
export function checkBookOrder(puzzle: BookOrder, order: string[], seconds: number): Outcome {
  const expected = [...puzzle.books].sort((a, b) => BOOKS.indexOf(a as (typeof BOOKS)[number]) - BOOKS.indexOf(b as (typeof BOOKS)[number]));
  if (order.length !== expected.length || new Set(order).size !== order.length || order.some((book) => !puzzle.books.includes(book))) return { solved: false, score: 0, detail: "Resposta inválida" };
  const right = order.filter((book, index) => book === expected[index]).length;
  const solved = right === expected.length;
  return { solved, score: Math.round((right / expected.length) * ACCURACY_MAX) + (solved ? timeBonus(seconds, 20) : 0), detail: `${right} de ${expected.length} no lugar certo` };
}

/** Antigo ou Novo Testamento: 10 itens (livros e personagens) para classificar. */
export const TESTAMENT_ITEMS = 10;
export type TestamentItem = { text: string; answer: "OLD" | "NEW" };
export type TestamentQuiz = { items: string[] };

export function generateTestament(seed: number, people: TestamentItem[]): { puzzle: TestamentQuiz; items: TestamentItem[] } {
  const random = rng(seed);
  const books: TestamentItem[] = BOOKS.map((book) => ({ text: book, answer: bookTestament(book)! }));
  const pool = [...shuffled(random, people).slice(0, 4), ...shuffled(random, books)].slice(0, TESTAMENT_ITEMS);
  const items = shuffled(random, pool);
  return { puzzle: { items: items.map((item) => item.text) }, items };
}

export function checkTestament(items: TestamentItem[], choices: Array<"OLD" | "NEW">, seconds: number): Outcome {
  if (choices.length !== items.length) return { solved: false, score: 0, detail: "Resposta inválida" };
  const right = choices.filter((choice, index) => choice === items[index].answer).length;
  const solved = right >= items.length - 1;
  return { solved, score: Math.round((right / items.length) * ACCURACY_MAX) + (solved ? timeBonus(seconds, 25) : 0), detail: `${right} de ${items.length} certos` };
}
