import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Switch } from '@/components/ui/switch';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { cn } from '@/lib/cn';
import { createTrade, getFriendAlbum, type AlbumCard, type FriendAlbum, type Trade } from '@/lib/social-api';

function Picker<T extends AlbumCard>({
  title,
  hint,
  items,
  selected,
  onSelect,
  flag,
  empty,
}: {
  title: string;
  hint: string;
  items: T[];
  selected: number | null;
  onSelect: (id: number | null) => void;
  flag: (item: T) => string | null;
  empty: string;
}) {
  const paging = usePagination(items, 8);
  return (
    <section className="space-y-2">
      <div>
        <h3 className="font-display font-bold text-ink">{title}</h3>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl bg-surface-2 p-3 text-sm text-muted">{empty}</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {paging.pageItems.map((item) => {
              const active = selected === item.characterId;
              const label = flag(item);
              return (
                <button
                  key={item.characterId}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onSelect(active ? null : item.characterId)}
                  className={cn('relative rounded-3xl transition', active ? 'ring-4 ring-primary ring-offset-2 ring-offset-surface' : 'opacity-80 hover:opacity-100')}
                >
                  <StickerCard name={item.name} rarity={item.rarity} imageUrl={item.imageUrl} owned size="sm" duplicates={item.duplicates} />
                  {label ? <span className="absolute inset-x-1 bottom-9 rounded-full bg-success px-1 text-[10px] font-bold text-white">{label}</span> : null}
                </button>
              );
            })}
          </div>
          {paging.totalPages > 1 ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="figurinhas" /> : null}
        </>
      )}
    </section>
  );
}

/** Montar uma proposta: oferecer uma repetida minha, pedir uma repetida do amigo, ou os dois. */
export function TradeComposer({ friendId, friendName, onClose, onSent }: { friendId: number; friendName: string; onClose: () => void; onSent: (trade: Trade) => void }) {
  const toast = useToast();
  const [album, setAlbum] = useState<FriendAlbum | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offered, setOffered] = useState<number | null>(null);
  const [requested, setRequested] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [sale, setSale] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getFriendAlbum(friendId)
      .then(setAlbum)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, [friendId]);

  // Venda: só oferecendo uma repetida (sem pedir nada). O preço é padrão por raridade e vem do servidor.
  const offeredCard = album?.myDuplicates.find((item) => item.characterId === offered) ?? null;
  const canSell = Boolean(offered && !requested && (offeredCard?.salePrice ?? 0) > 0);
  const selling = sale && canSell;
  const kind = offered && requested ? 'troca' : selling ? 'venda' : offered ? 'presente' : requested ? 'pedido' : null;

  async function send() {
    setSending(true);
    try {
      const trade = await createTrade({
        toUserId: friendId,
        offeredCharacterId: offered,
        requestedCharacterId: requested,
        message: message.trim() || undefined,
        sale: selling || undefined,
      });
      toast.success(kind === 'presente' ? 'Presente enviado! Seu amigo precisa aceitar.' : kind === 'venda' ? 'Venda oferecida! Seu amigo precisa aceitar.' : 'Proposta enviada!');
      onSent(trade);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title={`Trocar com ${friendName}`}
      description="Só cópias repetidas podem ser trocadas: ninguém perde a figurinha que já tem no álbum."
      onClose={sending ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button onClick={() => void send()} disabled={!kind} loading={sending}>
            {kind === 'troca' ? 'Propor troca' : kind === 'venda' ? 'Oferecer venda' : kind === 'presente' ? 'Enviar presente' : kind === 'pedido' ? 'Pedir figurinha' : 'Escolha uma figurinha'}
          </Button>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!album && !error ? <LoadingState label="Abrindo os álbuns..." /> : null}
      {album ? (
        <div className="space-y-5">
          <Picker
            title={`Pedir a ${friendName}`}
            hint="Repetidas do seu amigo. As marcadas com “falta pra você” completam seu álbum."
            items={album.theirDuplicates}
            selected={requested}
            onSelect={setRequested}
            flag={(item) => (item.iOwn ? null : 'falta pra você')}
            empty={`${friendName} ainda não tem figurinhas repetidas.`}
          />
          <Picker
            title="Oferecer"
            hint="Suas repetidas. As marcadas com “falta pro amigo” têm mais chance de ser aceitas."
            items={album.myDuplicates}
            selected={offered}
            onSelect={setOffered}
            flag={(item) => (item.theyOwn ? null : 'falta pro amigo')}
            empty="Você ainda não tem figurinhas repetidas para oferecer."
          />
          {canSell ? (
            <div className="rounded-2xl bg-surface-2 p-4">
              <Switch
                checked={sale}
                onChange={setSale}
                label="Vender esta figurinha"
                description={`Preço padrão da raridade: ${offeredCard?.salePrice} moedas. Quem vende recebe o valor menos a taxa do jogo.`}
              />
              {selling ? (
                <p className="mt-2 flex items-center gap-1 text-sm font-bold text-ink">
                  Seu amigo paga <CoinIcon className="h-4 w-4" /> {offeredCard?.salePrice}
                </p>
              ) : null}
            </div>
          ) : null}
          <Field label="Mensagem (opcional)">
            <Input value={message} onChange={(event) => setMessage(event.target.value)} maxLength={300} placeholder="Ex.: troca comigo? 😊" />
          </Field>
          <p className="text-xs text-muted">Só a figurinha marcada no topo: pedido. Só a de baixo: presente (ou venda, se ligar a opção). As duas: troca.</p>
        </div>
      ) : null}
    </Modal>
  );
}
