import { getAudioContext, unlockAudio } from '@/lib/sound/context';
import { getSoundSettings } from '@/lib/sound/settings';
import { playSfx, type SfxName } from '@/lib/sound/sfx';
import { pickVariant, shouldSpeak, type SoundKey, type Sounds } from '@runner/characters';

const audios = new Map<string, HTMLAudioElement>();
/** Última fala tocada de cada ação (para não repetir a mesma duas vezes seguidas), por lista de falas. */
const lastPick = new Map<string, number>();
let lastVoiceAt = 0;
/** Intervalo mínimo entre duas falas (ms): evita o personagem falar por cima de si mesmo. */
const VOICE_GAP_MS = 1200;

/**
 * Falas já decodificadas na memória (Web Audio): tocam na hora, sem o atraso de abrir o arquivo a cada vez (o `new Audio().play()` espera carregar e
 * a fala saía depois da ação). Enquanto não ficam prontas, ou se o arquivo não puder ser lido por fetch (CORS), vale o `Audio` comum.
 */
const buffers = new Map<string, AudioBuffer>();
const decoding = new Set<string>();

function decode(url: string) {
  const ctx = getAudioContext() ?? unlockAudio();
  if (!ctx || buffers.has(url) || decoding.has(url)) return;
  decoding.add(url);
  fetch(url)
    .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error('fala indisponível'))))
    .then((data) => ctx.decodeAudioData(data))
    .then((buffer) => buffers.set(url, buffer))
    .catch(() => undefined)
    .finally(() => decoding.delete(url));
}

function playBuffer(url: string, volume: number): boolean {
  const ctx = getAudioContext();
  const buffer = buffers.get(url);
  if (!ctx || !buffer) return false;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain).connect(ctx.destination);
    source.start();
    return true;
  } catch {
    return false;
  }
}

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
  const volume = Math.min(1, settings.sfxVolume);
  if (playBuffer(urls[index], volume)) return;
  // Ainda não decodificada: toca pelo Audio comum e aproveita para decodificar para as próximas vezes.
  decode(urls[index]);
  try {
    // Cópia para o mesmo som poder tocar duas vezes seguidas sem cortar.
    const audio = audioOf(urls[index]).cloneNode() as HTMLAudioElement;
    audio.volume = volume;
    void audio.play().catch(() => (fallback ? playSfx(fallback) : undefined));
  } catch {
    if (fallback) playSfx(fallback);
  }
}

/** Aquece os arquivos de som do personagem. */
export function preloadCharacterSounds(sounds: Sounds | undefined) {
  for (const urls of Object.values(sounds ?? {})) {
    for (const url of urls ?? []) {
      audioOf(url);
      decode(url);
    }
  }
}
