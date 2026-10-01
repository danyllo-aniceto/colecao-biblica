import { useCallback, useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Alert } from '@/components/game/game-ui';
import { PlayerAvatar, PlayerName, ReactionGlyph } from '@/components/game/player-look';
import { useOpenProfile } from '@/components/user/rewards/player-profile-modal';
import EmojiEmotionsRoundedIcon from '@mui/icons-material/EmojiEmotionsRounded';
import { TradeCard } from '@/components/user/social/trade-card';
import { TradeComposer } from '@/components/user/social/trade-composer';
import { cn } from '@/lib/cn';
import { blockUser, getChat, listMyReactions, removeFriend, sendChatMessage, sendChatReaction, type ChatMessage, type ChatReaction, type Friend, type TradeResponse } from '@/lib/social-api';

const POLL_MS = 5000;

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });

/** Junta mensagens novas às já carregadas (a mesma id é substituída: a troca pode ter mudado de status). */
function merge(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

function IconAction({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn('flex h-10 w-10 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-3', danger ? 'hover:text-danger' : 'hover:text-ink')}
      >
        {children}
      </button>
    </Tooltip>
  );
}

/** Conversa com um amigo: mensagens, propostas de troca no meio da conversa e ações da amizade. */
export function ChatView({
  meId,
  friend,
  onClose,
  onFriendGone,
  onTradeDone,
}: {
  meId: number;
  friend: Pick<Friend, 'userId' | 'name' | 'level' | 'look'>;
  onClose: () => void;
  onFriendGone: () => void;
  onTradeDone: (result: TradeResponse) => void;
}) {
  const toast = useToast();
  const { confirm } = useDialogs();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [reactions, setReactions] = useState<ChatReaction[] | null>(null);
  const [picking, setPicking] = useState(false);
  const openProfile = useOpenProfile();
  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);
  const keepOffset = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const page = await getChat(friend.userId);
    setChatEnabled(page.chatEnabled);
    setMessages((current) => {
      if (current.length === 0) setHasMore(page.hasMore);
      return merge(current, page.messages);
    });
  }, [friend.userId]);

  useEffect(() => {
    let alive = true;
    refresh()
      .catch((reason: unknown) => alive && setError(errorMessage(reason)))
      .finally(() => alive && setLoading(false));
    // Sem websocket: busca mensagens novas a cada poucos segundos enquanto a conversa está aberta e visível.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh().catch(() => undefined);
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !composing && !document.querySelector('[role="dialog"][aria-modal="true"]')) onClose();
    }
    document.addEventListener('keydown', escape);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', escape);
      document.body.style.overflow = overflow;
    };
  }, [composing, onClose]);

  // Mantém a rolagem no fim quando chegam mensagens, e no mesmo lugar quando carrega as antigas.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (keepOffset.current !== null) {
      list.scrollTop = list.scrollHeight - keepOffset.current;
      keepOffset.current = null;
    } else if (stickToBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  async function loadOlder() {
    const oldest = messages[0];
    if (!oldest || !listRef.current) return;
    setLoadingOlder(true);
    try {
      const page = await getChat(friend.userId, oldest.id);
      keepOffset.current = listRef.current.scrollHeight - listRef.current.scrollTop;
      setHasMore(page.hasMore);
      setMessages((current) => merge(current, page.messages));
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setLoadingOlder(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setSending(true);
    try {
      const message = await sendChatMessage(friend.userId, value);
      stickToBottom.current = true;
      setMessages((current) => merge(current, [message]));
      setText('');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  async function togglePicker() {
    setPicking((current) => !current);
    if (reactions === null) {
      try {
        setReactions(await listMyReactions());
      } catch (reason) {
        toast.error(errorMessage(reason));
        setReactions([]);
      }
    }
  }

  async function react(reaction: ChatReaction) {
    setPicking(false);
    try {
      const message = await sendChatReaction(friend.userId, reaction.id);
      stickToBottom.current = true;
      setMessages((current) => merge(current, [message]));
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function unfriend() {
    const ok = await confirm({
      title: `Desfazer amizade com ${friend.name}?`,
      message: 'A conversa some da sua lista e as propostas abertas entre vocês são canceladas. Vocês podem voltar a ser amigos com o código.',
      confirmLabel: 'Desfazer amizade',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await removeFriend(friend.userId);
      toast.info(`Você e ${friend.name} não são mais amigos.`);
      onFriendGone();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function block() {
    const ok = await confirm({
      title: `Bloquear ${friend.name}?`,
      message: 'A amizade é desfeita e essa pessoa não consegue mais te enviar pedidos. Você pode desbloquear depois em Pedidos.',
      confirmLabel: 'Bloquear',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await blockUser(friend.userId);
      toast.info(`${friend.name} foi bloqueado.`);
      onFriendGone();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-stretch justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-label={`Conversa com ${friend.name}`}
        className="animate-pop-in flex h-dvh w-full flex-col bg-bg sm:h-[min(44rem,90dvh)] sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:border sm:border-edge"
      >
        <header className="flex items-center gap-2 border-b border-edge bg-surface px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <IconAction label="Voltar" onClick={onClose}>
            <ArrowBackRoundedIcon />
          </IconAction>
          <button type="button" onClick={() => openProfile(friend.userId)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-label={`Ver perfil de ${friend.name}`}>
            <PlayerAvatar look={friend.look} name={friend.name} size="sm" />
            <h2 className="min-w-0 flex-1">
              <PlayerName name={friend.name} look={friend.look} nameClassName="text-lg" />
            </h2>
          </button>
          <IconAction label="Propor troca" onClick={() => setComposing(true)}>
            <SwapHorizRoundedIcon />
          </IconAction>
          <IconAction label="Desfazer amizade" onClick={() => void unfriend()} danger>
            <PersonRemoveRoundedIcon />
          </IconAction>
          <IconAction label="Bloquear" onClick={() => void block()} danger>
            <BlockRoundedIcon />
          </IconAction>
        </header>

        <div
          ref={listRef}
          onScroll={(event) => {
            const list = event.currentTarget;
            stickToBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 80;
          }}
          className="flex-1 space-y-2 overflow-y-auto px-3 py-4"
        >
          {loading ? <LoadingState label="Abrindo a conversa..." /> : null}
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {hasMore ? (
            <div className="flex justify-center">
              <Button size="sm" variant="secondary" onClick={() => void loadOlder()} loading={loadingOlder}>
                Mensagens anteriores
              </Button>
            </div>
          ) : null}
          {!loading && messages.length === 0 && !error ? <p className="py-10 text-center text-sm text-muted">Diga oi para {friend.name} ou proponha uma troca de figurinhas!</p> : null}
          {messages.map((message, index) => {
            const mine = message.senderId === meId;
            const previous = messages[index - 1];
            const showDay = !previous || day(previous.createdAt) !== day(message.createdAt);
            // A proposta mostra o cartão da troca; as respostas seguintes da mesma troca viram um aviso curto.
            const isProposal = message.trade !== null && messages.findIndex((item) => item.trade?.id === message.trade?.id) === index;
            if (message.trade && !isProposal) {
              return (
                <div key={message.id}>
                  {showDay ? <p className="my-3 text-center text-xs font-bold uppercase tracking-wider text-muted">{day(message.createdAt)}</p> : null}
                  <p className="mx-auto w-fit rounded-full bg-surface-3 px-3 py-1 text-center text-xs font-semibold text-muted">
                    {message.text} · {time(message.createdAt)}
                  </p>
                </div>
              );
            }
            return (
              <div key={message.id}>
                {showDay ? <p className="my-3 text-center text-xs font-bold uppercase tracking-wider text-muted">{day(message.createdAt)}</p> : null}
                <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                  {message.reaction ? (
                    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
                      <ReactionGlyph reaction={message.reaction} size="lg" animate />
                      <p className="text-[11px] text-muted">{time(message.createdAt)}</p>
                    </div>
                  ) : message.trade ? (
                    <div className="w-full max-w-xs">
                      <TradeCard
                        trade={message.trade}
                        meId={meId}
                        otherName={friend.name}
                        onChanged={(result) => {
                          setMessages((current) => current.map((item) => (item.id === message.id ? { ...item, trade: result.trade } : item)));
                          onTradeDone(result);
                          void refresh();
                        }}
                      />
                      <p className={cn('mt-1 text-[11px] text-muted', mine ? 'text-right' : '')}>{time(message.createdAt)}</p>
                    </div>
                  ) : (
                    <div className={cn('max-w-[80%] rounded-3xl px-4 py-2', mine ? 'rounded-br-lg bg-primary text-on-primary' : 'rounded-bl-lg bg-surface-3 text-ink')}>
                      <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
                      <p className={cn('mt-0.5 text-right text-[10px]', mine ? 'text-on-primary/70' : 'text-muted')}>
                        {time(message.createdAt)}
                        {mine && message.readAt ? ' · lida' : ''}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <footer className="border-t border-edge bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {chatEnabled && picking ? (
            <div className="animate-pop-in mb-3 rounded-2xl border border-edge bg-surface-2 p-2" role="listbox" aria-label="Suas reações">
              {reactions === null ? <LoadingState label="Abrindo reações..." /> : null}
              {reactions?.length === 0 ? <p className="p-2 text-sm text-muted">Você ainda não tem reações. Compre na loja (aba Visual).</p> : null}
              <div className="flex flex-wrap gap-1">
                {reactions?.map((reaction) => (
                  <Tooltip key={reaction.id} content={reaction.name}>
                    <button type="button" role="option" aria-selected={false} aria-label={reaction.name} onClick={() => void react(reaction)} className="rounded-xl p-1 transition hover:scale-110 hover:bg-surface-3">
                      <ReactionGlyph reaction={reaction} size="md" />
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          ) : null}
          {chatEnabled ? (
            <form onSubmit={(event) => void send(event)} className="flex gap-2">
              <IconAction label="Reações" onClick={() => void togglePicker()}>
                <EmojiEmotionsRoundedIcon />
              </IconAction>
              <Input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder="Escreva uma mensagem" aria-label="Mensagem" className="flex-1" />
              <Button type="submit" loading={sending} disabled={!text.trim()} aria-label="Enviar">
                {sending ? null : <SendRoundedIcon fontSize="small" />}
              </Button>
            </form>
          ) : (
            <p className="text-center text-sm text-muted">A conversa está pausada pelos administradores. As trocas continuam funcionando.</p>
          )}
        </footer>
      </section>

      {composing ? (
        <TradeComposer
          friendId={friend.userId}
          friendName={friend.name}
          onClose={() => setComposing(false)}
          onSent={() => {
            setComposing(false);
            stickToBottom.current = true;
            void refresh();
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}
