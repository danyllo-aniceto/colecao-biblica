/** Um único AudioContext para efeitos e música; só nasce depois do primeiro toque (regra dos navegadores). */
let context: AudioContext | null = null;

export const getAudioContext = () => context;

/** Cria/retoma o áudio. Chamado em qualquer gesto do jogador. */
export function unlockAudio() {
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
  } catch {
    return null;
  }
  return context;
}
