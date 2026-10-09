import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Mapa bíblico: o jogador toca no mapa onde fica cada lugar; vale a distância. */
export const MAP_BOUNDS = { west: 8, east: 50, south: 24, north: 45 } as const;
export const MAP_PLACES = 5;
/** Erro (km) a partir do qual o lugar não pontua. */
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

export type MapPuzzle = { places: string[]; bounds: typeof MAP_BOUNDS };
export type MapState = { places: Place[] };
export type Guess = { lat: number; lon: number };

/** Distância em km entre dois pontos (fórmula de haversine). */
export function distanceKm(a: Guess, b: Guess): number {
  const rad = (degrees: number) => (degrees * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function generateMap(seed: number): { puzzle: MapPuzzle; state: MapState } {
  const random = rng(seed);
  const chosen: Place[] = [];
  // Lugares que ficam a menos de 40 km um do outro não entram juntos (Jerusalém e Belém, por exemplo): ficaria injusto.
  for (const place of shuffled(random, PLACES)) {
    if (chosen.length === MAP_PLACES) break;
    if (chosen.every((other) => distanceKm(other, place) >= 40)) chosen.push(place);
  }
  return { puzzle: { places: chosen.map((place) => place.name), bounds: MAP_BOUNDS }, state: { places: chosen } };
}

const placePoints = (km: number) => Math.round((ACCURACY_MAX / MAP_PLACES) * Math.max(0, 1 - km / MAX_ERROR_KM));

export function checkMap(state: MapState, guesses: Guess[], seconds: number): Outcome {
  if (guesses.length !== state.places.length || guesses.some((guess) => !Number.isFinite(guess.lat) || !Number.isFinite(guess.lon) || Math.abs(guess.lat) > 90 || Math.abs(guess.lon) > 180)) {
    return { solved: false, score: 0, detail: "Resposta inválida" };
  }
  const errors = guesses.map((guess, index) => distanceKm(guess, state.places[index]));
  const accuracy = errors.reduce((sum, km) => sum + placePoints(km), 0);
  const solved = accuracy >= ACCURACY_MAX * 0.6;
  const average = Math.round(errors.reduce((sum, km) => sum + km, 0) / errors.length);
  return { solved, score: accuracy + (solved ? timeBonus(seconds, 30) : 0), detail: `Erro médio de ${average} km` };
}
