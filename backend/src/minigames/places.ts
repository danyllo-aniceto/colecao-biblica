import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";
import { LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, TIME_GRACE, type Level } from "./turns";

/**
 * Mapa bíblico: o jogador toca no mapa onde fica cada lugar; vale a distância. A dificuldade escolhe a região do mapa (Terra Santa, Oriente Médio
 * e Egito, ou todo o mundo bíblico), quantos lugares há e a tolerância do erro. No fim o mapa mostra onde cada lugar fica de verdade.
 */
export type Bounds = { west: number; east: number; south: number; north: number };
/** O mapa inteiro (nível difícil). */
export const MAP_BOUNDS: Bounds = { west: 8, east: 50, south: 24, north: 45 };
export const MAP_LEVELS: Record<Level, { region: string; bounds: Bounds; places: number; maxErrorKm: number; hints: number; par: number }> = {
  facil: { region: "Terra Santa", bounds: { west: 33.8, east: 36.8, south: 30.8, north: 33.8 }, places: 5, maxErrorKm: 120, hints: 3, par: 90 },
  medio: { region: "Oriente Médio e Egito", bounds: { west: 29, east: 49, south: 26, north: 38 }, places: 7, maxErrorKm: 400, hints: 2, par: 150 },
  dificil: { region: "Todo o mundo bíblico", bounds: MAP_BOUNDS, places: 10, maxErrorKm: 800, hints: 1, par: 240 },
};
export const TIME_CHOICES = [90, 150, 240, 360] as const;
export const HINT_PENALTY = 40;
/** Compat: tolerância do mapa inteiro. */
export const MAX_ERROR_KM = 800;

export type Place = { name: string; lat: number; lon: number };

export const PLACES: Place[] = [
  { name: "Jerusalém", lat: 31.78, lon: 35.22 },
  { name: "Belém", lat: 31.7, lon: 35.2 },
  { name: "Nazaré", lat: 32.7, lon: 35.3 },
  { name: "Cafarnaum", lat: 32.88, lon: 35.57 },
  { name: "Jericó", lat: 31.87, lon: 35.44 },
  { name: "Monte Sinai", lat: 28.54, lon: 33.97 },
  { name: "Egito (Gósen)", lat: 30.9, lon: 31.8 },
  { name: "Babilônia", lat: 32.54, lon: 44.42 },
  { name: "Nínive", lat: 36.36, lon: 43.15 },
  { name: "Ur dos Caldeus", lat: 30.96, lon: 46.1 },
  { name: "Susã", lat: 32.19, lon: 48.25 },
  { name: "Damasco", lat: 33.51, lon: 36.29 },
  { name: "Antioquia da Síria", lat: 36.2, lon: 36.16 },
  { name: "Tarso", lat: 36.92, lon: 34.89 },
  { name: "Éfeso", lat: 37.94, lon: 27.34 },
  { name: "Corinto", lat: 37.91, lon: 22.88 },
  { name: "Atenas", lat: 37.98, lon: 23.73 },
  { name: "Filipos", lat: 41.01, lon: 24.29 },
  { name: "Roma", lat: 41.9, lon: 12.5 },
  { name: "Malta", lat: 35.9, lon: 14.4 },
  { name: "Ilha de Patmos", lat: 37.31, lon: 26.55 },
  { name: "Cesareia Marítima", lat: 32.5, lon: 34.89 },
  { name: "Samaria", lat: 32.28, lon: 35.19 },
  { name: "Monte Carmelo", lat: 32.74, lon: 35.04 },
  { name: "Betel", lat: 31.94, lon: 35.22 },
  { name: "Hebrom", lat: 31.53, lon: 35.1 },
];

export type MapState = { seed: number; level: Level; places: Place[]; timeLimit: number | null; hints: number; hinted: number[] };
export type MapPuzzle = {
  places: string[];
  bounds: Bounds;
  region: string;
  level: Level;
  timeLimit: number | null;
  hintsLeft: number;
  hintPenalty: number;
  maxErrorKm: number;
  par: number;
  maxScore: number;
};
export type Guess = { lat: number; lon: number };

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanceKm(a: Guess, b: Guess): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

const inside = (place: Place, bounds: Bounds) => place.lon >= bounds.west && place.lon <= bounds.east && place.lat >= bounds.south && place.lat <= bounds.north;

/** Sorteia os lugares da região (os que saíram nas últimas partidas ficam por último), longe o bastante uns dos outros para ninguém ser injustiçado. */
export function generateMap(seed: number, level: Level = "dificil", timeLimit: number | null = null, avoid: readonly string[] = []): { puzzle: MapPuzzle; state: MapState } {
  const config = MAP_LEVELS[level];
  const random = rng(seed);
  const recent = new Set(avoid);
  const pool = PLACES.filter((place) => inside(place, config.bounds));
  const order = [...shuffled(random, pool.filter((place) => !recent.has(place.name))), ...shuffled(random, pool.filter((place) => recent.has(place.name)))];
  const gap = config.maxErrorKm / 6;
  const chosen: Place[] = [];
  for (const place of order) {
    if (chosen.length === config.places) break;
    if (chosen.every((other) => distanceKm(other, place) >= gap)) chosen.push(place);
  }
  const puzzle: MapPuzzle = {
    places: chosen.map((place) => place.name),
    bounds: config.bounds,
    region: config.region,
    level,
    timeLimit,
    hintsLeft: config.hints,
    hintPenalty: HINT_PENALTY,
    maxErrorKm: config.maxErrorKm,
    par: config.par,
    maxScore: maxScoreOf(level),
  };
  return { puzzle, state: { seed, level, places: chosen, timeLimit, hints: 0, hinted: [] } };
}

/**
 * A dica de um lugar: um círculo grande que o contém (o centro não é o lugar, para não entregar o ponto).
 * É sempre o mesmo para o mesmo lugar da partida.
 */
export function placeHint(state: MapState, index: number): { lat: number; lon: number; radiusKm: number } | null {
  const place = state.places[index];
  if (!place) return null;
  const config = MAP_LEVELS[state.level];
  const random = rng((state.seed + index * 7919) >>> 0);
  const radiusKm = config.maxErrorKm * 1.2;
  const offset = radiusKm * 0.45 * random();
  const angle = random() * 2 * Math.PI;
  const lat = place.lat + ((offset * Math.sin(angle)) / 111);
  const lon = place.lon + ((offset * Math.cos(angle)) / (111 * Math.cos((place.lat * Math.PI) / 180)));
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, radiusKm: Math.round(radiusKm) };
}

const placePoints = (km: number, places: number, maxErrorKm: number) => Math.round((ACCURACY_MAX / places) * Math.max(0, 1 - km / maxErrorKm));

/**
 * Pontos: cada lugar vale uma fatia de 700 que cai com a distância até zerar na tolerância do nível; se somou 60% ou mais, vence e ganha
 * até 300 de rapidez; menos 40 por dica; tudo vezes o fator do nível. Lugar sem marca não pontua.
 */
export function checkMap(input: MapState, guesses: Array<Guess | null>, seconds: number): Outcome {
  // Partidas começadas antes desta versão não têm nível, tempo nem dicas: valem como o mapa inteiro.
  const state: MapState = { ...input, level: input.level ?? "dificil", timeLimit: input.timeLimit ?? null, hinted: input.hinted ?? [] };
  const valid = (guess: Guess | null) => guess === null || (Number.isFinite(guess.lat) && Number.isFinite(guess.lon) && Math.abs(guess.lat) <= 90 && Math.abs(guess.lon) <= 180);
  if (guesses.length !== state.places.length || !guesses.every(valid)) return { solved: false, score: 0, detail: "Resposta inválida" };
  const config = MAP_LEVELS[state.level];
  const errors = guesses.map((guess, index) => (guess ? distanceKm(guess, state.places[index]) : null));
  const accuracy = errors.reduce<number>((sum, km) => sum + (km === null ? 0 : placePoints(km, state.places.length, config.maxErrorKm)), 0);
  const late = state.timeLimit !== null && seconds > state.timeLimit + TIME_GRACE;
  const solved = accuracy >= ACCURACY_MAX * 0.6 && !late;
  const marked = errors.filter((km): km is number => km !== null);
  const average = marked.length === 0 ? 0 : Math.round(marked.reduce((sum, km) => sum + km, 0) / marked.length);
  const raw = accuracy + (solved ? timeBonus(seconds, config.par) : 0) - state.hinted.length * HINT_PENALTY;
  const score = marked.length === 0 ? 0 : Math.max(0, Math.round(raw * LEVEL_SCALE[state.level]));
  return {
    solved,
    score,
    detail: `${late ? "Tempo esgotado · " : ""}${marked.length === 0 ? "Nada marcado" : `Erro médio de ${average} km`} · ${LEVEL_LABEL[state.level]}${state.hinted.length > 0 ? ` · ${state.hinted.length} ${state.hinted.length === 1 ? "dica" : "dicas"}` : ""}`,
    reveal: state.places.map((place, index) => ({ name: place.name, lat: place.lat, lon: place.lon, km: errors[index] === null ? null : Math.round(errors[index]!) })),
  };
}
