import { getAudioContext } from '@/lib/sound/context';
import { getSoundSettings } from '@/lib/sound/settings';

/**
 * Efeitos sonoros sintetizados na hora (osciladores e ruído): não há arquivos para baixar
 * e funcionam offline. Cada som é curto e discreto.
 */
export type SfxName = 'click' | 'soft' | 'toggleOn' | 'toggleOff' | 'open' | 'close' | 'flip' | 'swipe' | 'success' | 'error' | 'correct' | 'wrong' | 'coin' | 'reward' | ChestSfxName | MiniGameSfxName;

/** Sons dos mini games (hoje o caça-palavras): arrastar sobre as letras, achar, errar, dica, vitória e fim sem sucesso. */
export type MiniGameSfxName = 'wsPick' | 'wsTick' | 'wsFound' | 'wsMiss' | 'wsHint' | 'wsWin' | 'wsLose' | 'wsReveal' | 'anPick' | 'anRemove' | 'anRight' | 'anWrong' | 'anTick' | 'anTimeout';

/** Sons da abertura de baús: um por nível de baú, um por tipo de prêmio e os do suspense e do carretel. */
export type ChestSfxName =
  | 'chestBronze'
  | 'chestSilver'
  | 'chestGold'
  | 'chestDiamond'
  | 'chestEmerald'
  | 'stickerSpecial'
  | 'reelTick'
  | 'suspenseRare'
  | 'suspenseEpic'
  | 'suspenseLegendary'
  | 'prizeCoins'
  | 'prizeHelper'
  | 'prizeCosmetic'
  | 'stickerCommon'
  | 'stickerRare'
  | 'stickerEpic'
  | 'stickerLegendary';

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: AudioContext) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }
  return noise;
}

/** `rate` muda o tom de todo o som (1 = normal; 2 = uma oitava acima): o tique do arrastar sobe a cada letra. */
type Out = { ctx: AudioContext; out: GainNode; at: number; rate?: number };

/** Nota com ataque rápido e queda suave. */
function tone({ ctx, out, at, rate = 1 }: Out, type: OscillatorType, rawFrom: number, rawTo: number, start: number, length: number, peak: number) {
  const from = rawFrom * rate;
  const to = rawTo * rate;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at + start);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, at + start + length);
  gain.gain.setValueAtTime(0.0001, at + start);
  gain.gain.exponentialRampToValueAtTime(peak, at + start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + start + length);
  osc.connect(gain).connect(out);
  osc.start(at + start);
  osc.stop(at + start + length + 0.02);
}

/** Sopro filtrado (papel, vento): a faixa de frequência corre de `from` até `to`. */
function whoosh({ ctx, out, at }: Out, from: number, to: number, start: number, length: number, peak: number, q = 1.2) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at + start);
  filter.frequency.exponentialRampToValueAtTime(to, at + start + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at + start);
  gain.gain.exponentialRampToValueAtTime(peak, at + start + length * 0.35);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + start + length);
  source.connect(filter).connect(gain).connect(out);
  source.start(at + start, Math.random() * 0.5, length + 0.05);
}

/** Sequência de notas (arpejo ou acorde quando `step` é 0). */
function notes(o: Out, type: OscillatorType, frequencies: number[], step: number, length: number, peak: number, start = 0) {
  frequencies.forEach((frequency, index) => tone(o, type, frequency, frequency, start + index * step, length, peak));
}

/** Batida grave de madeira/pedra (o baú abrindo). */
function thud(o: Out, start = 0, from = 140, to = 55, peak = 0.5) {
  tone(o, 'sine', from, to, start, 0.22, peak);
  whoosh(o, 400, 120, start, 0.12, 0.25, 0.7);
}

const RECIPES: Record<SfxName, (o: Out) => void> = {
  click: (o) => tone(o, 'triangle', 620, 420, 0, 0.07, 0.35),
  soft: (o) => tone(o, 'sine', 480, 420, 0, 0.05, 0.25),
  toggleOn: (o) => {
    tone(o, 'triangle', 520, 520, 0, 0.07, 0.3);
    tone(o, 'triangle', 780, 780, 0.06, 0.09, 0.3);
  },
  toggleOff: (o) => {
    tone(o, 'triangle', 780, 780, 0, 0.07, 0.3);
    tone(o, 'triangle', 520, 520, 0.06, 0.09, 0.3);
  },
  open: (o) => {
    whoosh(o, 500, 1600, 0, 0.18, 0.35);
    tone(o, 'sine', 330, 440, 0.02, 0.12, 0.15);
  },
  close: (o) => {
    whoosh(o, 1500, 450, 0, 0.16, 0.3);
    tone(o, 'sine', 440, 300, 0.02, 0.1, 0.12);
  },
  // Folha de papel virando: sopro longo com um "estalo" no começo e outro no fim.
  flip: (o) => {
    whoosh(o, 2600, 900, 0, 0.32, 0.6, 0.8);
    whoosh(o, 4200, 3000, 0.0, 0.05, 0.35, 0.6);
    whoosh(o, 3000, 1800, 0.26, 0.08, 0.3, 0.7);
  },
  swipe: (o) => whoosh(o, 900, 2200, 0, 0.16, 0.35, 0.9),
  success: (o) => {
    tone(o, 'triangle', 523, 523, 0, 0.12, 0.3);
    tone(o, 'triangle', 659, 659, 0.09, 0.12, 0.3);
    tone(o, 'triangle', 784, 784, 0.18, 0.2, 0.3);
  },
  error: (o) => {
    tone(o, 'sawtooth', 220, 150, 0, 0.2, 0.18);
    tone(o, 'sawtooth', 165, 110, 0.12, 0.22, 0.18);
  },
  correct: (o) => {
    tone(o, 'triangle', 659, 659, 0, 0.1, 0.35);
    tone(o, 'triangle', 988, 988, 0.08, 0.22, 0.35);
  },
  wrong: (o) => {
    tone(o, 'square', 196, 140, 0, 0.28, 0.14);
  },
  coin: (o) => {
    tone(o, 'square', 988, 988, 0, 0.07, 0.16);
    tone(o, 'square', 1319, 1319, 0.07, 0.2, 0.16);
  },
  reward: (o) => {
    [523, 659, 784, 1047].forEach((frequency, index) => tone(o, 'triangle', frequency, frequency, index * 0.09, 0.22, 0.3));
    whoosh(o, 3000, 6000, 0.3, 0.35, 0.12, 2);
  },

  // ---- Baús: cada nível tem timbre e tamanho próprios (bronze simples, diamante cristalino e grandioso) ----
  chestBronze: (o) => {
    tone(o, 'sawtooth', 90, 150, 0, 0.18, 0.12); // ranger da tampa
    thud(o, 0.14);
    notes(o, 'triangle', [392, 523], 0.09, 0.2, 0.28, 0.2);
  },
  chestSilver: (o) => {
    tone(o, 'sawtooth', 110, 190, 0, 0.18, 0.12);
    thud(o, 0.14, 160, 60, 0.5);
    notes(o, 'sine', [784, 1175, 1568], 0.07, 0.4, 0.22, 0.2);
    whoosh(o, 2500, 6000, 0.22, 0.3, 0.1, 2);
  },
  chestGold: (o) => {
    tone(o, 'sawtooth', 120, 220, 0, 0.2, 0.14);
    thud(o, 0.16, 170, 60, 0.55);
    notes(o, 'triangle', [523, 659, 784, 1047], 0.08, 0.34, 0.3, 0.22);
    notes(o, 'sine', [2093, 2637], 0.07, 0.3, 0.1, 0.5);
    whoosh(o, 3000, 7000, 0.25, 0.45, 0.14, 2);
  },
  chestDiamond: (o) => {
    tone(o, 'sine', 55, 40, 0, 0.7, 0.45); // estrondo grave
    tone(o, 'sawtooth', 130, 260, 0, 0.25, 0.12);
    thud(o, 0.2, 180, 50, 0.6);
    [1047, 1319, 1568, 1976, 2349, 2794].forEach((frequency, index) => tone(o, 'sine', frequency, frequency, 0.3 + index * 0.07, 0.6, 0.2)); // glissando de cristal
    notes(o, 'triangle', [523, 659, 784, 1047], 0, 1.0, 0.18, 0.4); // acorde final
    whoosh(o, 3500, 9000, 0.3, 0.8, 0.16, 2.5);
  },
  // Esmeralda (figurinha especial): o mais solene e longo de todos, com coral de acordes que sobem.
  chestEmerald: (o) => {
    tone(o, 'sine', 50, 38, 0, 1.2, 0.5);
    thud(o, 0.05, 160, 45, 0.6);
    [262, 330, 392, 523].forEach((frequency, index) => notes(o, 'triangle', [frequency, frequency * 1.5], 0, 1.6, 0.14, 0.2 + index * 0.18));
    [1047, 1319, 1568, 1976, 2349, 2794, 3136].forEach((frequency, index) => tone(o, 'sine', frequency, frequency, 0.5 + index * 0.1, 0.8, 0.14));
    whoosh(o, 3000, 10000, 0.3, 1.4, 0.18, 2.5);
  },
  stickerSpecial: (o) => {
    tone(o, 'sine', 70, 30, 0, 1.2, 0.6);
    thud(o, 0.02, 230, 45, 0.65);
    [262, 392, 523, 659, 784, 1047].forEach((frequency, index) => tone(o, 'triangle', frequency, frequency, 0.1 + index * 0.12, 1.4, 0.24));
    notes(o, 'sawtooth', [196, 294], 0, 1.6, 0.06, 0.1);
    [1568, 1976, 2349, 2794, 3136, 3951].forEach((frequency, index) => tone(o, 'sine', frequency, frequency, 0.7 + index * 0.1, 0.8, 0.14));
    whoosh(o, 2000, 10000, 0.05, 1.6, 0.24, 2.5);
  },
  // Tique do carretel passando os prêmios (o app o repete cada vez mais devagar).
  reelTick: (o) => tone(o, 'triangle', 1100, 760, 0, 0.035, 0.2),
  // Suspense antes de abrir a figurinha: sobe de tensão conforme a raridade.
  suspenseRare: (o) => {
    whoosh(o, 300, 2200, 0, 0.5, 0.25, 1.5);
    tone(o, 'sine', 330, 660, 0, 0.5, 0.12);
  },
  suspenseEpic: (o) => {
    whoosh(o, 250, 3200, 0, 1.1, 0.3, 1.8);
    tone(o, 'sine', 220, 880, 0, 1.1, 0.16);
    tone(o, 'triangle', 330, 1320, 0.1, 1.0, 0.1);
  },
  suspenseLegendary: (o) => {
    tone(o, 'sine', 70, 45, 0, 1.9, 0.3); // coração do suspense
    whoosh(o, 200, 5000, 0, 1.9, 0.35, 2);
    tone(o, 'sine', 196, 1568, 0, 1.9, 0.18);
    tone(o, 'triangle', 294, 2349, 0.2, 1.7, 0.1);
    [880, 1109, 1319, 1760].forEach((frequency, index) => tone(o, 'sine', frequency, frequency, 1.2 + index * 0.12, 0.5, 0.1));
  },
  // Prêmios: cada tipo tem som próprio.
  prizeCoins: (o) => {
    [988, 1319, 988, 1319, 1568].forEach((frequency, index) => tone(o, 'square', frequency, frequency, index * 0.055, 0.12, 0.12));
    whoosh(o, 4000, 8000, 0, 0.3, 0.06, 2.5);
  },
  prizeHelper: (o) => {
    tone(o, 'triangle', 330, 880, 0, 0.2, 0.3);
    notes(o, 'triangle', [659, 880], 0.08, 0.2, 0.28, 0.18);
  },
  prizeCosmetic: (o) => {
    notes(o, 'sine', [1568, 1976, 2349, 2637], 0.07, 0.3, 0.2);
    whoosh(o, 4000, 9000, 0, 0.5, 0.1, 3);
  },
  stickerCommon: (o) => {
    tone(o, 'triangle', 523, 523, 0, 0.1, 0.3);
    tone(o, 'triangle', 784, 784, 0.07, 0.18, 0.3);
  },
  stickerRare: (o) => {
    notes(o, 'triangle', [659, 784, 988], 0.07, 0.24, 0.3);
    whoosh(o, 3500, 7000, 0.1, 0.35, 0.1, 2);
  },
  stickerEpic: (o) => {
    thud(o, 0, 200, 60, 0.45);
    notes(o, 'triangle', [392, 494, 587, 784], 0.09, 0.4, 0.3, 0.05);
    notes(o, 'sine', [1568, 1976], 0.08, 0.4, 0.12, 0.35);
    whoosh(o, 2500, 8000, 0.05, 0.6, 0.18, 2);
  },
  // ---- Caça-palavras ----
  wsPick: (o) => tone(o, 'triangle', 440, 560, 0, 0.07, 0.28),
  wsTick: (o) => tone(o, 'sine', 523, 523, 0, 0.06, 0.22),
  wsFound: (o) => {
    notes(o, 'triangle', [659, 784, 988], 0.07, 0.2, 0.3);
    whoosh(o, 3000, 7000, 0.1, 0.3, 0.1, 2);
  },
  wsMiss: (o) => {
    tone(o, 'sine', 330, 230, 0, 0.16, 0.2);
    whoosh(o, 900, 400, 0, 0.12, 0.12, 0.8);
  },
  wsHint: (o) => notes(o, 'sine', [1319, 1760], 0.09, 0.3, 0.2),
  wsWin: (o) => {
    notes(o, 'triangle', [523, 659, 784, 1047, 1319], 0.1, 0.34, 0.3);
    notes(o, 'sine', [2093, 2637], 0.09, 0.4, 0.1, 0.5);
    whoosh(o, 3000, 8000, 0.3, 0.6, 0.14, 2);
  },
  wsLose: (o) => notes(o, 'triangle', [392, 330, 262], 0.16, 0.34, 0.22),
  // Palavras que faltaram aparecem uma a uma no fim da partida.
  wsReveal: (o) => tone(o, 'sine', 392, 330, 0, 0.14, 0.2),
  // ---- Anagrama: peça de madeira encaixando, nome certo, erro suave, contagem e tempo esgotado ----
  anPick: (o) => {
    tone(o, 'triangle', 330, 260, 0, 0.06, 0.3);
    tone(o, 'sine', 880, 880, 0.01, 0.04, 0.08);
  },
  anRemove: (o) => tone(o, 'triangle', 260, 360, 0, 0.06, 0.22),
  anRight: (o) => {
    notes(o, 'triangle', [523, 659, 784, 1047], 0.075, 0.24, 0.3);
    whoosh(o, 3500, 8000, 0.15, 0.35, 0.1, 2.2);
  },
  anWrong: (o) => {
    tone(o, 'sine', 300, 200, 0, 0.18, 0.22);
    tone(o, 'sine', 250, 170, 0.12, 0.2, 0.18);
  },
  anTick: (o) => tone(o, 'square', 880, 880, 0, 0.04, 0.1),
  anTimeout: (o) => {
    tone(o, 'sawtooth', 330, 140, 0, 0.35, 0.16);
    thud(o, 0.05, 120, 50, 0.3);
  },
  stickerLegendary: (o) => {
    tone(o, 'sine', 80, 35, 0, 0.9, 0.55); // estrondo
    thud(o, 0.02, 220, 50, 0.6);
    notes(o, 'triangle', [392, 523, 659, 784, 1047], 0.1, 0.9, 0.28, 0.1); // sobe em camadas e fica soando
    notes(o, 'sawtooth', [196, 262], 0, 1.2, 0.07, 0.1);
    notes(o, 'sine', [1568, 1976, 2349, 2794, 3136], 0.09, 0.6, 0.14, 0.6); // brilho final
    whoosh(o, 2000, 9000, 0.05, 1.2, 0.22, 2.5);
  },
};

/** Sons mais longos que o padrão (a saída só é desligada depois que eles terminam). */
const LENGTH_MS: Partial<Record<SfxName, number>> = { chestGold: 1800, chestDiamond: 2400, chestEmerald: 3200, stickerSpecial: 3200, suspenseEpic: 1500, suspenseLegendary: 2500, stickerEpic: 1500, stickerLegendary: 2800, wsWin: 1800 };

let lastPlayed = new Map<SfxName, number>();

/** Toca o efeito se estiver ligado e o áudio já tiver sido liberado por um toque. */
export function playSfx(name: SfxName, rate = 1) {
  const settings = getSoundSettings();
  const ctx = getAudioContext();
  if (!settings.sfxEnabled || settings.sfxVolume <= 0 || !ctx || ctx.state !== 'running') return;
  // Evita rajadas (ex.: vários toques seguidos no mesmo instante).
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < 45) return;
  lastPlayed.set(name, now);
  try {
    const out = ctx.createGain();
    out.gain.value = settings.sfxVolume * 0.8;
    out.connect(ctx.destination);
    RECIPES[name]({ ctx, out, at: ctx.currentTime + 0.005, rate });
    window.setTimeout(() => out.disconnect(), LENGTH_MS[name] ?? 1200);
  } catch {
    // Som é enfeite: nunca atrapalha o jogo.
  }
}
