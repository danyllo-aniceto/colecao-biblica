import { getAudioContext, unlockAudio } from '@/lib/sound/context';
import { getSoundSettings, subscribeSoundSettings } from '@/lib/sound/settings';

/**
 * Música de fundo: um único <audio> em loop passando por um ganho (WebAudio), que faz o fade
 * entre temas e deixa o volume funcionar também no iPhone (onde o volume do <audio> é fixo).
 */
const FADE = 0.6;

let audio: HTMLAudioElement | null = null;
let gain: GainNode | null = null;
let wanted: string | null = null;
let loaded: string | null = null;
let switching = 0;

function ensure() {
  if (audio && gain) return true;
  const ctx = getAudioContext() ?? unlockAudio();
  if (!ctx) return false;
  audio = new Audio();
  audio.loop = true;
  audio.preload = 'auto';
  gain = ctx.createGain();
  gain.gain.value = 0;
  ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
  return true;
}

const level = () => {
  const settings = getSoundSettings();
  return settings.musicEnabled ? settings.musicVolume * 0.7 : 0;
};

function fadeTo(value: number, seconds = FADE) {
  const ctx = getAudioContext();
  if (!ctx || !gain) return;
  gain.gain.cancelScheduledValues(ctx.currentTime);
  gain.gain.setTargetAtTime(value, ctx.currentTime, seconds / 3);
}

async function start() {
  if (!audio || !wanted) return;
  const run = ++switching;
  try {
    if (loaded !== wanted) {
      // Sai suave do tema antigo antes de trocar.
      if (loaded) {
        fadeTo(0, 0.4);
        await new Promise((resolve) => window.setTimeout(resolve, 450));
        if (run !== switching) return;
      }
      audio.pause();
      // Link de outro domínio precisa liberar CORS para o volume (WebAudio) funcionar.
      const external = /^https?:\/\//.test(wanted) && new URL(wanted).origin !== window.location.origin;
      if (external) audio.crossOrigin = 'anonymous';
      else audio.removeAttribute('crossorigin');
      audio.src = wanted;
      loaded = wanted;
    }
    await audio.play();
    if (run === switching) fadeTo(level());
  } catch {
    // Bloqueado pelo navegador (ainda sem toque) ou arquivo inválido: tenta de novo no próximo gesto.
  }
}

/** Define a música que deve tocar (null = silêncio). Pode ser chamado a qualquer momento. */
export function setMusicTrack(src: string | null) {
  wanted = src;
  if (!src) {
    switching += 1;
    if (audio && !audio.paused) {
      fadeTo(0, 0.5);
      const stopping = audio;
      window.setTimeout(() => {
        if (!wanted) stopping.pause();
      }, 600);
    }
    return;
  }
  if (ensure() && !document.hidden) void start();
}

let wired = false;

/** Liga os avisos globais: primeiro toque, volume, aba em segundo plano. */
export function wireMusic() {
  if (wired || typeof window === 'undefined') return;
  wired = true;

  const retry = () => {
    unlockAudio();
    if (wanted && ensure() && (audio?.paused || loaded !== wanted)) void start();
  };
  window.addEventListener('pointerdown', retry, { passive: true });
  window.addEventListener('keydown', retry);

  subscribeSoundSettings(() => {
    if (!gain) return;
    fadeTo(level(), 0.2);
  });

  document.addEventListener('visibilitychange', () => {
    if (!audio) return;
    if (document.hidden) {
      audio.pause();
    } else if (wanted) {
      void start();
    }
  });
}
