import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Mostra uma pose do personagem: tira horizontal de `frames` quadros quadrados; passa de quadro em quadro (`fps`) quando tem mais de um.
 * Sem imagem, desenha um quadrado na cor de reserva (é o que o jogo também desenha).
 */
export function SpriteView({ url, frames = 1, color = '#94a3b8', size = 64, fps = 8, className }: { url?: string | null; frames?: number; color?: string; size?: number; fps?: number; className?: string }) {
  const [frame, setFrame] = useState(0);
  const count = Math.max(1, Math.floor(frames));
  useEffect(() => {
    setFrame(0);
    if (!url || count <= 1) return undefined;
    const id = window.setInterval(() => setFrame((current) => (current + 1) % count), 1000 / fps);
    return () => window.clearInterval(id);
  }, [url, count, fps]);

  if (!url) {
    return (
      <span className={cn('inline-flex items-center justify-center', className)} style={{ width: size, height: size }} aria-hidden>
        <span className="rounded-lg" style={{ width: size * 0.55, height: size * 0.55, background: color }} />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-hidden
      className={cn('inline-block shrink-0 bg-no-repeat', className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url("${url}")`,
        backgroundSize: `${count * 100}% 100%`,
        backgroundPosition: `${count <= 1 ? 0 : (frame / (count - 1)) * 100}% 0`,
      }}
    />
  );
}
