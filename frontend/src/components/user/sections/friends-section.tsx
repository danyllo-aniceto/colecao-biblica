import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Alert, EmptyState, LevelBadge, SectionHeading } from '@/components/game/game-ui';
import { ChatView } from '@/components/user/social/chat-view';
import { TradeCard } from '@/components/user/social/trade-card';
import { cn } from '@/lib/cn';
import type { PaginatedResponse } from '@/lib/admin-api';
import {
  cancelFriendRequest,
  getMyFriendCode,
  listFriendRequests,
  listFriends,
  listTrades,
  respondFriendRequest,
  sendFriendRequest,
  unblockUser,
  type Friend,
  type FriendRequests,
  type SocialSummary,
  type Trade,
  type TradeResponse,
} from '@/lib/social-api';
import type { UnlockedAchievement } from '@/lib/user-api';

type Tab = 'friends' | 'requests' | 'trades';
const FRIENDS_PAGE = 10;
const TRADES_PAGE = 5;

function Count({ value }: { value: number }) {
  if (!value) return null;
  return <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">{value > 99 ? '99+' : value}</span>;
}

function ago(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
  });
}

/** Amigos: código para adicionar, conversas, pedidos de amizade e propostas de troca de repetidas. */
export function FriendsSection({
  meId,
  summary,
  onSummaryChange,
  onTradeDone,
  onAchievements,
}: {
  meId: number;
  summary: SocialSummary | null;
  onSummaryChange: () => void;
  onTradeDone: (result: TradeResponse) => void;
  onAchievements: (achievements?: UnlockedAchievement[]) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('friends');
  const [code, setCode] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState('');
  const [adding, setAdding] = useState(false);
  const [chatWith, setChatWith] = useState<Friend | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    getMyFriendCode()
      .then((response) => setCode(response.friendCode))
      .catch(() => setCode(null));
  }, []);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
    onSummaryChange();
  }, [onSummaryChange]);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success('Código copiado!');
    } catch {
      toast.info(`Seu código: ${code}`);
    }
  }

  async function shareCode() {
    if (!code) return;
    const text = `Vamos trocar figurinhas na Coleção Bíblica? Meu código de amigo é ${code}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Coleção Bíblica',
          text,
          url: window.location.origin,
        });
      } catch {
        // Cancelar o compartilhamento não é erro.
      }
    } else {
      await copyCode();
    }
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = friendCode.trim().toUpperCase();
    if (!value) return;
    setAdding(true);
    try {
      const result = await sendFriendRequest(value);
      toast.success(result.status === 'ACCEPTED' ? `Agora você e ${result.friend.name} são amigos!` : `Pedido enviado para ${result.friend.name}.`);
      setFriendCode('');
      reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeading title="Amigos" subtitle="Converse, peça figurinhas e troque suas repetidas." />

      <div className="grid gap-3 lg:grid-cols-2">
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Seu código de amigo</p>
            {code ? <p className="font-display text-2xl font-bold tracking-[0.2em] text-ink">{code}</p> : <Spinner size="sm" />}
          </div>
          <Tooltip content="Copiar código">
            <Button variant="secondary" size="sm" onClick={() => void copyCode()} disabled={!code} aria-label="Copiar código">
              <ContentCopyRoundedIcon fontSize="small" />
            </Button>
          </Tooltip>
          <Button size="sm" onClick={() => void shareCode()} disabled={!code}>
            <ShareRoundedIcon fontSize="small" />
            Convidar
          </Button>
        </div>
        <form onSubmit={(event) => void add(event)} className="panel flex items-end gap-2 p-4">
          <label className="min-w-0 flex-1 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Adicionar pelo código</span>
            <Input value={friendCode} onChange={(event) => setFriendCode(event.target.value.toUpperCase())} maxLength={12} placeholder="Ex.: K7Q2MX" className="uppercase tracking-widest" />
          </label>
          <Button type="submit" loading={adding} disabled={!friendCode.trim()}>
            {adding ? null : <PersonAddRoundedIcon fontSize="small" />}
            Adicionar
          </Button>
        </form>
      </div>

      <Segmented
        aria-label="Seção de amigos"
        value={tab}
        onChange={setTab}
        options={[
          {
            value: 'friends',
            label: (
              <>
                Amigos
                <Count value={summary?.unreadMessages ?? 0} />
              </>
            ),
          },
          {
            value: 'requests',
            label: (
              <>
                Pedidos
                <Count value={summary?.pendingRequests ?? 0} />
              </>
            ),
          },
          {
            value: 'trades',
            label: (
              <>
                Trocas
                <Count value={summary?.pendingTrades ?? 0} />
              </>
            ),
          },
        ]}
      />

      {tab === 'friends' ? <FriendsList key={reloadKey} onOpen={setChatWith} /> : null}
      {tab === 'requests' ? (
        <RequestsPanel
          key={reloadKey}
          onChanged={(achievements) => {
            onAchievements(achievements);
            reload();
          }}
        />
      ) : null}
      {tab === 'trades' ? (
        <TradesPanel
          key={reloadKey}
          meId={meId}
          onChanged={(result) => {
            onTradeDone(result);
            onSummaryChange();
          }}
        />
      ) : null}

      {chatWith ? (
        <ChatView
          meId={meId}
          friend={chatWith}
          onClose={() => {
            setChatWith(null);
            reload();
          }}
          onFriendGone={() => {
            setChatWith(null);
            reload();
          }}
          onTradeDone={(result) => {
            onTradeDone(result);
            onSummaryChange();
          }}
        />
      ) : null}
    </div>
  );
}

function usePage<T>(load: (page: number) => Promise<PaginatedResponse<T>>) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginatedResponse<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    load(page)
      .then((response) => {
        if (ignore) return;
        // Se a página ficou vazia (ex.: aceitou a última proposta dela), volta uma.
        if (response.content.length === 0 && page > 0) setPage(page - 1);
        else setData(response);
        setError(null);
      })
      .catch((reason: unknown) => !ignore && setError(errorMessage(reason)))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [load, page, tick]);

  return {
    page,
    setPage,
    data,
    error,
    loading,
    reload: () => setTick((value) => value + 1),
  };
}

function FriendsList({ onOpen }: { onOpen: (friend: Friend) => void }) {
  const loader = useCallback((page: number) => listFriends(page, FRIENDS_PAGE), []);
  const { page, setPage, data, error, loading } = usePage(loader);

  if (loading && !data) return <LoadingState label="Carregando amigos..." />;
  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data || data.totalElements === 0) {
    return (
      <EmptyState icon={<GroupsRoundedIcon fontSize="large" />} title="Nenhum amigo ainda">
        Mande seu código para alguém ou adicione o código de um amigo para começar a trocar figurinhas.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-3">
      <ul className={cn('space-y-2 transition-opacity', loading && 'opacity-60')}>
        {data.content.map((friend) => (
          <li key={friend.userId}>
            <button type="button" onClick={() => onOpen(friend)} className="panel flex w-full items-center gap-3 p-3 text-left transition hover:border-primary/60">
              <LevelBadge level={friend.level} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-display font-bold text-ink">{friend.name}</span>
                  {friend.lastMessage ? <span className="shrink-0 text-xs text-muted">{ago(friend.lastMessage.createdAt)}</span> : null}
                </div>
                <p className={cn('truncate text-sm', friend.unread ? 'font-bold text-ink' : 'text-muted')}>
                  {friend.lastMessage ? `${friend.lastMessage.mine ? 'Você: ' : ''}${friend.lastMessage.text}` : `${friend.stickers} figurinhas · ${friend.duplicates} repetidas`}
                </p>
              </div>
              {friend.unread ? <Count value={friend.unread} /> : <ChatBubbleRoundedIcon className="text-muted" fontSize="small" />}
            </button>
          </li>
        ))}
      </ul>
      {data.totalPages > 1 ? <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="amigos" /> : null}
    </div>
  );
}

function RequestRow({ name, level, detail, children }: { name: string; level: number; detail: string; children: ReactNode }) {
  return (
    <li className="panel flex flex-wrap items-center gap-3 p-3">
      <LevelBadge level={level} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display font-bold text-ink">{name}</p>
        <p className="text-xs text-muted">{detail}</p>
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}

function RequestsPanel({ onChanged }: { onChanged: (achievements?: UnlockedAchievement[]) => void }) {
  const toast = useToast();
  const [data, setData] = useState<FriendRequests | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listFriendRequests()
      .then(setData)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, []);

  async function run(key: string, action: () => Promise<unknown>, message: string) {
    setBusy(key);
    try {
      const result = (await action()) as { unlockedAchievements?: UnlockedAchievement[] } | undefined;
      toast.success(message);
      onChanged(result?.unlockedAchievements);
    } catch (reason) {
      toast.error(errorMessage(reason));
      setBusy(null);
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!data) return <LoadingState label="Carregando pedidos..." />;
  const empty = data.incoming.length + data.outgoing.length + data.blocked.length === 0;
  if (empty) {
    return (
      <EmptyState icon={<PersonAddRoundedIcon fontSize="large" />} title="Nenhum pedido">
        Quando alguém usar seu código, o pedido aparece aqui.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <RequestGroup title="Recebidos" items={data.incoming}>
        {(item) => (
          <RequestRow key={item.id} name={item.user.name} level={item.user.level} detail={`Pediu amizade · ${ago(item.createdAt)}`}>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              loading={busy === `d${item.id}`}
              onClick={() => void run(`d${item.id}`, () => respondFriendRequest(item.id, false), 'Pedido recusado.')}
            >
              Recusar
            </Button>
            <Button
              size="sm"
              disabled={busy !== null}
              loading={busy === `a${item.id}`}
              onClick={() => void run(`a${item.id}`, () => respondFriendRequest(item.id, true), `Agora você e ${item.user.name} são amigos!`)}
            >
              Aceitar
            </Button>
          </RequestRow>
        )}
      </RequestGroup>
      <RequestGroup title="Enviados" items={data.outgoing}>
        {(item) => (
          <RequestRow key={item.id} name={item.user.name} level={item.user.level} detail={`Aguardando resposta · ${ago(item.createdAt)}`}>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              loading={busy === `c${item.id}`}
              onClick={() => void run(`c${item.id}`, () => cancelFriendRequest(item.id), 'Pedido cancelado.')}
            >
              Cancelar
            </Button>
          </RequestRow>
        )}
      </RequestGroup>
      <RequestGroup title="Bloqueados" items={data.blocked}>
        {(item) => (
          <RequestRow key={item.id} name={item.user.name} level={item.user.level} detail="Não pode te enviar pedidos">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null}
              loading={busy === `u${item.id}`}
              onClick={() => void run(`u${item.id}`, () => unblockUser(item.user.id), `${item.user.name} foi desbloqueado.`)}
            >
              Desbloquear
            </Button>
          </RequestRow>
        )}
      </RequestGroup>
    </div>
  );
}

function RequestGroup<T>({ title, items, children }: { title: string; items: T[]; children: (item: T) => ReactNode }) {
  const [page, setPage] = useState(0);
  if (items.length === 0) return null;
  const totalPages = Math.ceil(items.length / FRIENDS_PAGE);
  const current = Math.min(page, totalPages - 1);
  return (
    <section className="space-y-2">
      <h3 className="font-display font-bold text-ink">
        {title} <span className="text-muted">({items.length})</span>
      </h3>
      <ul className="space-y-2">{items.slice(current * FRIENDS_PAGE, current * FRIENDS_PAGE + FRIENDS_PAGE).map(children)}</ul>
      {totalPages > 1 ? <Pagination page={current} totalPages={totalPages} totalElements={items.length} onPageChange={setPage} itemLabel="pedidos" /> : null}
    </section>
  );
}

function TradesPanel({ meId, onChanged }: { meId: number; onChanged: (result: TradeResponse) => void }) {
  const [box, setBox] = useState<'received' | 'sent' | 'history'>('received');
  const loader = useCallback((page: number) => listTrades(box, page, TRADES_PAGE), [box]);
  const { page, setPage, data, error, loading, reload } = usePage<Trade>(loader);

  useEffect(() => setPage(0), [box, setPage]);

  return (
    <div className="space-y-3">
      <Segmented
        aria-label="Caixa de trocas"
        value={box}
        onChange={setBox}
        options={[
          { value: 'received', label: 'Recebidas' },
          { value: 'sent', label: 'Enviadas' },
          { value: 'history', label: 'Histórico' },
        ]}
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {loading && !data ? <LoadingState label="Carregando trocas..." /> : null}
      {data && data.totalElements === 0 ? (
        <EmptyState icon={<SwapHorizRoundedIcon fontSize="large" />} title={box === 'history' ? 'Nenhuma troca terminada' : 'Nenhuma proposta aberta'}>
          Abra a conversa com um amigo e toque em “Propor troca” para oferecer ou pedir repetidas.
        </EmptyState>
      ) : null}
      {data && data.totalElements > 0 ? (
        <>
          <div className={cn('grid gap-3 sm:grid-cols-2', loading && 'opacity-60')}>
            {data.content.map((trade) => {
              const other = trade.proposerId === meId ? trade.receiver : trade.proposer;
              return (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  meId={meId}
                  otherName={other?.name ?? 'amigo'}
                  onChanged={(result) => {
                    onChanged(result);
                    reload();
                  }}
                />
              );
            })}
          </div>
          {data.totalPages > 1 ? <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="trocas" /> : null}
        </>
      ) : null}
    </div>
  );
}
