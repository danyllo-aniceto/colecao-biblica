import { getAudioContext } from '@/lib/sound/context';
import { getSoundSettings } from '@/lib/sound/settings';

/**
 * Efeitos sonoros sintetizados na hora (osciladores e ruído): não há arquivos para baixar
 * e funcionam offline. Cada som é curto e discreto.
 */
export type SfxName = 'click' | 'soft' | 'toggleOn' | 'toggleOff' | 'open' | 'close' | 'flip' | 'swipe' | 'success' | 'error' | 'correct' | 'wrong' | 'coin' | 'reward';

let noise: AudioBuffer | null = null;

function noiseBuffer(ctx: AudioContext) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }
  return noise;
}

type Out = { ctx: AudioContext; out: GainNode; at: number };

/** Nota com ataque rápido e queda suave. */
function tone({ ctx, out, at }: Out, type: OscillatorType, from: number, to: number, start: number, length: number, peak: number) {
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
};

let lastPlayed = new Map<SfxName, number>();

/** Toca o efeito se estiver ligado e o áudio já tiver sido liberado por um toque. */
export function playSfx(name: SfxName) {
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
    RECIPES[name]({ ctx, out, at: ctx.currentTime + 0.005 });
    window.setTimeout(() => out.disconnect(), 1200);
  } catch {
    // Som é enfeite: nunca atrapalha o jogo.
  }
}
