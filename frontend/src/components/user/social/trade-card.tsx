import { useState } from 'react';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { cn } from '@/lib/cn';
import { respondTrade, type Trade, type TradeCharacter, type TradeResponse, type TradeStatus } from '@/lib/social-api';

const STATUS: Record<TradeStatus, { label: string; tone: 'primary' | 'success' | 'danger' | 'neutral' }> = {
  PENDING: { label: 'Aguardando', tone: 'primary' },
  ACCEPTED: { label: 'Concluída', tone: 'success' },
  DECLINED: { label: 'Recusada', tone: 'danger' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
  EXPIRED: { label: 'Expirou', tone: 'neutral' },
};

function Side({ label, character }: { label: string; character: TradeCharacter | null }) {
  return (
    <div className="flex w-24 flex-col items-center gap-1 text-center">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</span>
      {character ? (
        <StickerCard name={character.name} rarity={character.rarity} imageUrl={character.imageUrl} owned size="sm" />
      ) : (
        <span className="flex aspect-[3/4] w-full items-center justify-center rounded-2xl border-2 border-dashed border-edge text-xs font-semibold text-muted">nada</span>
      )}
    </div>
  );
}

/** Proposta de troca vista por quem propôs ou por quem recebeu, com as ações de cada um. */
export function TradeCard({ trade, meId, otherName, onChanged, compact = false }: { trade: Trade; meId: number; otherName: string; onChanged: (result: TradeResponse) => void; compact?: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const mine = trade.proposerId === meId;
  // Do meu ponto de vista: o que eu dou e o que eu recebo.
  const give = mine ? trade.offered : trade.requested;
  const get = mine ? trade.requested : trade.offered;
  const isSale = Boolean(trade.priceCoins);
  const kind = trade.offered && trade.requested ? 'Troca' : isSale ? 'Venda' : trade.offered ? 'Presente' : 'Pedido';
  const title = mine ? `${kind} para ${otherName}` : `${kind} de ${otherName}`;

  async function act(action: 'accept' | 'decline' | 'cancel') {
    setBusy(action);
    try {
      const result = await respondTrade(trade.id, action);
      if (action === 'accept') {
        toast.success(kind === 'Pedido' ? 'Figurinha enviada!' : kind === 'Venda' ? 'Compra concluída!' : 'Troca concluída!', {
          description: result.received ? `Você recebeu ${result.received.name}${result.received.unlocked ? ' (nova!)' : ' (foi para as repetidas)'}.` : undefined,
        });
      } else {
        toast.info(action === 'decline' ? 'Proposta recusada.' : 'Proposta cancelada.');
      }
      onChanged(result);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={cn('space-y-3 rounded-3xl border-2 bg-surface p-3', trade.status === 'PENDING' ? 'border-primary/60' : 'border-edge', compact ? 'max-w-xs' : '')}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 font-display text-sm font-bold text-ink">
          {kind === 'Presente' || kind === 'Venda' ? <CardGiftcardRoundedIcon fontSize="small" className="text-violet" /> : <SwapHorizRoundedIcon fontSize="small" className="text-primary-strong dark:text-primary" />}
          {title}
        </p>
        <Badge tone={STATUS[trade.status].tone}>{STATUS[trade.status].label}</Badge>
      </div>
      <div className="flex items-center justify-center gap-2">
        <Side label="Você dá" character={give} />
        <SwapHorizRoundedIcon className="text-muted" />
        <Side label="Você recebe" character={get} />
      </div>
      {isSale ? (
        <p className="flex flex-wrap items-center justify-center gap-1 rounded-2xl bg-primary/15 px-3 py-2 text-sm font-bold text-ink">
          {mine ? (
            <>
              Você recebe <CoinIcon className="h-4 w-4" /> {trade.sellerCoins} <span className="font-semibold text-muted">(preço {trade.priceCoins}, menos a taxa)</span>
            </>
          ) : (
            <>
              Você paga <CoinIcon className="h-4 w-4" /> {trade.priceCoins}
            </>
          )}
        </p>
      ) : null}
      {trade.message ? <p className="rounded-2xl bg-surface-2 px-3 py-2 text-sm text-ink">“{trade.message}”</p> : null}
      {trade.status === 'PENDING' ? (
        <div className="flex flex-wrap justify-end gap-2">
          {mine ? (
            <Button size="sm" variant="ghost" onClick={() => void act('cancel')} loading={busy === 'cancel'} disabled={busy !== null}>
              Cancelar proposta
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={() => void act('decline')} loading={busy === 'decline'} disabled={busy !== null}>
                Recusar
              </Button>
              <Button size="sm" onClick={() => void act('accept')} loading={busy === 'accept'} disabled={busy !== null}>
                {kind === 'Pedido' ? 'Enviar figurinha' : kind === 'Venda' ? `Comprar (${trade.priceCoins})` : 'Aceitar'}
              </Button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
