import type { CalloutTone } from '@board/callouts';
import { cn } from '@/lib/cn';
import type { ActiveCallout } from '@/components/user/board/use-callouts';

const TONE: Record<CalloutTone, string> = {
  good: 'border-success bg-success/20',
  bad: 'border-danger bg-danger/15',
  info: 'border-info bg-info/15',
  special: 'border-primary bg-primary/20',
};

/** Cartaz por cima do tabuleiro: o que acabou de acontecer e por quê. Não pega toques (o jogo segue por baixo). */
export function CalloutBanner({ callout }: { callout: ActiveCallout | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-3" role="status" aria-live="polite">
      {callout ? (
        <div
          // A key reinicia a animação a cada aviso novo.
          key={callout.key}
          className={cn('board-callout flex w-full max-w-md items-center gap-3 rounded-2xl border-2 bg-surface px-3.5 py-2.5 shadow-lg backdrop-blur-sm', TONE[callout.tone])}
          style={{ ['--dur' as string]: `${callout.ms}ms` }}
        >
          <span className="animate-pop-in text-4xl leading-none" aria-hidden="true">
            {callout.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight text-ink">{callout.title}</p>
            <p className="text-sm font-semibold leading-snug text-muted">{callout.text}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
