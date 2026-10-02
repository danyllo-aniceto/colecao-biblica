import { useSyncExternalStore } from 'react';

/**
 * Preferências de som do jogador (ficam neste aparelho): efeitos dos botões e ações,
 * música dos temas, volumes e a música escolhida para fora do quiz.
 */
export type SoundSettings = {
  sfxEnabled: boolean;
  /** 0 a 1. */
  sfxVolume: number;
  musicEnabled: boolean;
  /** 0 a 1. */
  musicVolume: number;
  /** 'auto' segue o tema do nível; senão, o identificador (slug) do cenário escolhido. */
  track: string;
};

const KEY = 'colecao-biblica:sound';

const DEFAULTS: SoundSettings = { sfxEnabled: true, sfxVolume: 0.7, musicEnabled: true, musicVolume: 0.4, track: 'auto' };

const clamp = (value: unknown, fallback: number) => (typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback);

function read(): SoundSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) ?? 'null') as Partial<SoundSettings> | null;
    if (!saved) return DEFAULTS;
    return {
      sfxEnabled: typeof saved.sfxEnabled === 'boolean' ? saved.sfxEnabled : DEFAULTS.sfxEnabled,
      sfxVolume: clamp(saved.sfxVolume, DEFAULTS.sfxVolume),
      musicEnabled: typeof saved.musicEnabled === 'boolean' ? saved.musicEnabled : DEFAULTS.musicEnabled,
      musicVolume: clamp(saved.musicVolume, DEFAULTS.musicVolume),
      track: typeof saved.track === 'string' && saved.track ? saved.track : DEFAULTS.track,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: SoundSettings = typeof window === 'undefined' ? DEFAULTS : read();
const listeners = new Set<() => void>();

export const getSoundSettings = () => current;

export function updateSoundSettings(patch: Partial<SoundSettings>) {
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Sem armazenamento (modo privado): vale só nesta sessão.
  }
  listeners.forEach((listener) => listener());
}

export function subscribeSoundSettings(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSoundSettings() {
  return useSyncExternalStore(subscribeSoundSettings, getSoundSettings, () => DEFAULTS);
}
