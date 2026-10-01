/**
 * Moderação simples do chat: troca palavrões comuns por asteriscos. Não é
 * perfeita (ninguém é), mas evita o pior; o jogador também pode bloquear.
 */
const BLOCKED_WORDS = [
  "porra",
  "caralho",
  "merda",
  "bosta",
  "puta",
  "puto",
  "foda",
  "fodase",
  "foda-se",
  "fdp",
  "vsf",
  "pqp",
  "cacete",
  "buceta",
  "viado",
  "arrombado",
  "otario",
  "otária",
  "otaria",
  "idiota",
  "imbecil",
  "babaca",
  "desgraça",
  "desgraca",
];

const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const blocked = new Set(BLOCKED_WORDS.map(normalize));

/** Mascara palavras proibidas mantendo o resto do texto. */
export function moderateText(text: string): string {
  return text.replace(/[\p{L}\p{N}-]+/gu, (word) => (blocked.has(normalize(word)) ? "*".repeat(word.length) : word));
}
