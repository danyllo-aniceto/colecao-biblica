/**
 * Mapa simplificado do Oriente Médio e do Mediterrâneo para o mini game "Mapa bíblico": mares (água) e ilhas (terra) como polígonos
 * [longitude, latitude]. O desenho é aproximado (serve para se orientar); a pontuação usa as coordenadas reais.
 * Limites do mapa: veja `MAP_BOUNDS` em `backend/src/minigames/places.ts` (viewBox: 10 unidades por grau).
 */
export const SEAS: Array<Array<[number, number]>> = [
  // Mar Mediterrâneo (da Espanha à Síria e ao Egito, voltando pela costa da África)
  [[-6, 36], [-2, 36.7], [0, 38.7], [3, 42], [6, 43], [8.5, 44.3], [10, 43.5], [12, 42], [13.5, 41.2], [15.5, 40], [15.7, 38], [16.9, 39.1], [17, 40.4], [18.3, 40.2], [19.4, 40.3], [20, 39.5], [21, 38.5], [21.5, 37], [22.5, 36.4], [23, 37], [24, 38], [24, 39.5], [22.8, 40.6], [24.5, 40.9], [26, 40.8], [26.4, 40.2], [26.2, 39.3], [26.8, 38.4], [27.2, 37.7], [27.8, 37], [28.3, 36.7], [29.5, 36.2], [30.5, 36.6], [32, 36.2], [33.8, 36.2], [35, 36.7], [36, 36.6], [35.9, 35.9], [35.8, 34.8], [35.5, 33.9], [35.1, 33.2], [34.9, 32.5], [34.5, 31.8], [34.3, 31.3], [33, 31.1], [31.5, 31.4], [30, 31.2], [29, 30.9], [25, 31.7], [20, 32.2], [19, 30.3], [18, 30.3], [15, 32.3], [11, 33], [10.2, 34.2], [10.8, 35.5], [11, 37], [10.2, 37.3], [9.8, 37.1], [8, 36.9], [5, 36.8], [2, 36.6], [-2, 35.5], [-5.3, 35.9]],
  // Mar Negro
  [[28, 41.9], [28.5, 43.4], [30, 45], [33, 46.2], [36, 45.2], [37.5, 44.5], [40, 43.5], [41.5, 41.7], [39, 41], [36, 41.8], [33, 42], [31, 41.1], [29, 41.2]],
  // Mar Vermelho (golfos de Suez e de Ácaba)
  [[32.5, 30], [33, 28.7], [33.9, 27.7], [35.4, 24.5], [37, 24], [36.5, 24], [34.4, 27.8], [35, 29.5], [34.9, 28.2], [34.6, 28.0]],
  // Golfo Pérsico
  [[48, 30], [49.5, 30.2], [50.6, 29.2], [52, 27.9], [56, 26.5], [56, 24], [50, 24], [50, 26], [48.8, 28.5]],
];

/** Ilhas (terra sobre o mar). */
export const ISLANDS: Array<Array<[number, number]>> = [
  [[12.4, 38.0], [15.6, 38.3], [15.1, 36.7], [12.5, 37.6]], // Sicília
  [[8.2, 41], [9.7, 41.1], [9.5, 39.2], [8.4, 39.0]], // Sardenha
  [[23.5, 35.5], [26.3, 35.3], [26, 35], [23.6, 35.2]], // Creta
  [[32.3, 35], [34.6, 35.7], [34, 34.9], [32.5, 34.6]], // Chipre
];

/** Lagos e mares fechados da Terra Santa (mapas aproximados, só para se orientar). */
export const LAKES: Array<Array<[number, number]>> = [
  [[35.5, 32.89], [35.65, 32.85], [35.62, 32.72], [35.52, 32.7]], // Mar da Galileia
  [[35.4, 31.77], [35.56, 31.76], [35.5, 31.15], [35.38, 31.2], [35.39, 31.55]], // Mar Morto
];

/** Rio Jordão (da Galileia ao Mar Morto). */
export const RIVERS: Array<Array<[number, number]>> = [[[35.62, 32.7], [35.57, 32.45], [35.55, 32.2], [35.52, 31.95], [35.5, 31.77]]];
