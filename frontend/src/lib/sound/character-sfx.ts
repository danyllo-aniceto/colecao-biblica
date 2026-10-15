import { getSoundSettings } from '@/lib/sound/settings';
import { playSfx, type SfxName } from '@/lib/sound/sfx';
import type { SoundKey, Sounds } from '@runner/characters';

const audios = new Map<string, HTMLAudioElement>();

/** Som do personagem (arquivo enviado pelo painel); sem arquivo, ou se falhar ao tocar, vale o som padrão do modo. Segue a configuração de efeitos do jogador. */
export function playCharacterSound(sounds: Sounds | undefined, key: SoundKey, fallback: SfxName) {
  const url = sounds?.[key];
  if (!url) {
    playSfx(fallback);
    return;
  }
  const settings = getSoundSettings();
  if (!settings.sfxEnabled || settings.sfxVolume <= 0) return;
  try {
    let base = audios.get(url);
    if (!base) {
      base = new Audio(url);
      base.preload = 'auto';
      audios.set(url, base);
    }
    // Cópia para o mesmo som poder tocar duas vezes seguidas sem cortar.
    const audio = base.cloneNode() as HTMLAudioElement;
    audio.volume = Math.min(1, settings.sfxVolume);
    void audio.play().catch(() => playSfx(fallback));
  } catch {
    playSfx(fallback);
  }
}

/** Aquece os arquivos de som do personagem. */
export function preloadCharacterSounds(sounds: Sounds | undefined) {
  for (const url of Object.values(sounds ?? {})) {
    if (url && !audios.has(url)) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audios.set(url, audio);
    }
  }
}
