import { useEffect, useState } from 'react';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import { Button } from '@/components/ui/button';
import { getActiveEvent, type GameEvent } from '@/lib/rewards-api';

function timeLeft(iso: string) {
  const hours = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000));
  return hours >= 48 ? `${Math.round(hours / 24)} dias` : `${hours} h`;
}

/** Faixa do evento ativo (multiplicadores e itens limitados na loja). */
export function EventBanner({ onOpenShop }: { onOpenShop: () => void }) {
  const [event, setEvent] = useState<GameEvent | null>(null);

  useEffect(() => {
    getActiveEvent()
      .then(setEvent)
      .catch(() => setEvent(null));
  }, []);

  if (!event) return null;
  const perks = [event.xpMultiplier > 1 ? `XP x${event.xpMultiplier}` : null, event.coinMultiplier > 1 ? `moedas x${event.coinMultiplier}` : null].filter(Boolean);
  const color = event.color ?? 'var(--violet)';

  return (
    <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-lg" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))` }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <CelebrationRoundedIcon sx={{ fontSize: 40 }} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-white/80">Evento · termina em {timeLeft(event.endsAt)}</p>
          <h3 className="font-display text-2xl font-bold">{event.name}</h3>
          {event.description ? <p className="text-sm text-white/90">{event.description}</p> : null}
          {perks.length ? <p className="mt-1 text-sm font-bold">Todas as partidas: {perks.join(' e ')}</p> : null}
        </div>
        {event.cosmetics?.length ? (
          <Button variant="secondary" onClick={onOpenShop}>
            Itens do evento
          </Button>
        ) : null}
      </div>
    </section>
  );
}
