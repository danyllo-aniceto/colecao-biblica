import { useEffect, useState } from 'react';
import type { CalloutTone } from '@board/callouts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { ActiveCallout } from '@/components/user/board/use-callouts';

const TONE: Record<CalloutTone, { card: string; bar: string }> = {
  good: { card: 'border-success bg-success/15', bar: 'var(--success)' },
  bad: { card: 'border-danger bg-danger/10', bar: 'var(--danger)' },
  info: { card: 'border-info bg-info/10', bar: 'var(--info)' },
  special: { card: 'border-primary bg-primary/15', bar: 'var(--primary)' },
};

/**
 * O momento da jogada: o que acabou de acontecer, em destaque, no lugar do dado e da pergunta. Sai sozinho depois de um
 * tempo (a barra mostra quanto falta) ou com um toque em "Continuar".
 */
export function MomentCard({ callout, onSkip }: { callout: ActiveCallout; onSkip: () => void }) {
  const tone = TONE[callout.tone];
  const [running, setRunning] = useState(false);
  useEffect(() => {
    // A barra esvazia durante o tempo do aviso (começa cheia e anima na pintura seguinte).
    const frame = window.requestAnimationFrame(() => setRunning(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <section className={cn('panel mx-2 animate-fade-up space-y-3 rounded-b-none border-2 p-4', tone.card)} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="animate-pop-in text-5xl leading-none" aria-hidden="true">
          {callout.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold leading-tight text-ink">{callout.title}</p>
          <p className="mt-1 text-sm font-semibold leading-snug text-ink/80">{callout.text}</p>
        </div>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: running ? '0%' : '100%', background: tone.bar, transition: `width ${callout.ms}ms linear` }} />
      </div>
      <Button size="lg" variant="secondary" className="w-full" onClick={onSkip} data-autofocus>
        Continuar
      </Button>
    </section>
  );
}
