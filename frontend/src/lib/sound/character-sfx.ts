import { getSoundSettings } from '@/lib/sound/settings';
import { playSfx, type SfxName } from '@/lib/sound/sfx';
import { pickVariant, shouldSpeak, type SoundKey, type Sounds } from '@runner/characters';

const audios = new Map<string, HTMLAudioElement>();
/** Última fala tocada de cada ação (para não repetir a mesma duas vezes seguidas), por lista de falas. */
const lastPick = new Map<string, number>();
let lastVoiceAt = 0;
/** Intervalo mínimo entre duas falas (ms): evita o personagem falar por cima de si mesmo. */
const VOICE_GAP_MS = 1200;

function audioOf(url: string) {
  let base = audios.get(url);
  if (!base) {
    base = new Audio(url);
    base.preload = 'auto';
    audios.set(url, base);
  }
  return base;
}

/**
 * Fala do personagem (arquivos enviados pelo painel). Cada ação tem várias falas: sorteia uma (sem repetir a anterior) e só fala em parte das vezes
 * (`SOUND_INFO[key].chance`); quando fica quieto, não toca nada. Sem nenhuma fala cadastrada para a ação, vale o som padrão do modo (`fallback`, se houver).
 * Segue a configuração de efeitos do jogador.
 */
export function playCharacterSound(sounds: Sounds | undefined, key: SoundKey, fallback: SfxName | null) {
  const urls = sounds?.[key];
  if (!urls || urls.length === 0) {
    if (fallback) playSfx(fallback);
    return;
  }
  const settings = getSoundSettings();
  if (!settings.sfxEnabled || settings.sfxVolume <= 0) return;
  if (!shouldSpeak(key)) return;
  const now = Date.now();
  // A vitória e a queda sempre passam; as outras esperam a fala anterior sair.
  if (key !== 'win' && key !== 'death' && now - lastVoiceAt < VOICE_GAP_MS) return;
  const listKey = `${key}|${urls.join('|')}`;
  const index = pickVariant(urls.length, lastPick.get(listKey) ?? -1);
  lastPick.set(listKey, index);
  lastVoiceAt = now;
  try {
    // Cópia para o mesmo som poder tocar duas vezes seguidas sem cortar.
    const audio = audioOf(urls[index]).cloneNode() as HTMLAudioElement;
    audio.volume = Math.min(1, settings.sfxVolume);
    void audio.play().catch(() => (fallback ? playSfx(fallback) : undefined));
  } catch {
    if (fallback) playSfx(fallback);
  }
}

/** Aquece os arquivos de som do personagem. */
export function preloadCharacterSounds(sounds: Sounds | undefined) {
  for (const urls of Object.values(sounds ?? {})) for (const url of urls ?? []) audioOf(url);
}
