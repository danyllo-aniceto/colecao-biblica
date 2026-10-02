import { useEffect } from 'react';
import { unlockAudio } from '@/lib/sound/context';
import { wireMusic } from '@/lib/sound/music';
import { playSfx } from '@/lib/sound/sfx';

const CLICKABLE = 'button, a[href], summary, [role="button"], [role="tab"], [role="radio"], [role="menuitem"], [role="option"], [role="switch"], [role="checkbox"]';

/**
 * Som de todo toque em botão, aba, opção ou interruptor, sem precisar mexer em cada tela.
 * Para mudar: `data-sound="off"` (silencia — a tela toca o próprio som), `data-sound="soft"` (mais leve).
 * Interruptores tocam "ligado/desligado" conforme o novo estado.
 */
export function SoundEffects() {
  useEffect(() => {
    wireMusic();

    // Libera o áudio no primeiro toque (exigência dos navegadores).
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock);

    function handleClick(event: MouseEvent) {
      const target = (event.target as Element | null)?.closest<HTMLElement>(CLICKABLE);
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      const mode = target.closest<HTMLElement>('[data-sound]')?.dataset.sound;
      if (mode === 'off') return;
      const role = target.getAttribute('role');
      if (role === 'switch' || role === 'checkbox') {
        // O estado ainda é o de antes do toque.
        playSfx(target.getAttribute('aria-checked') === 'true' ? 'toggleOff' : 'toggleOn');
        return;
      }
      playSfx(mode === 'soft' || role === 'tab' || role === 'radio' || role === 'option' ? 'soft' : 'click');
    }
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      document.removeEventListener('click', handleClick, true);
    };
  }, []);

  return null;
}
