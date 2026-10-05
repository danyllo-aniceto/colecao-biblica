import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { PlayerAvatar } from '@/components/game/player-look';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { inviteToRoom } from '@/lib/board-room-api';
import { listFriends, type Friend } from '@/lib/social-api';

const PAGE_SIZE = 6;

/** Lista de amigos (paginada no servidor) para mandar o convite da sala. */
export function FriendInviteModal({ open, code, inRoomUserIds, onClose, invite: sendInvite = inviteToRoom }: { open: boolean; code: string; inRoomUserIds: number[]; onClose: () => void; /** Como mandar o convite (padrão: sala do Tabuleiro). */ invite?: (code: string, friendId: number) => Promise<unknown> }) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [sent, setSent] = useState<Set<number>>(new Set());

  const load = useCallback((target: number) => {
    setFriends(null);
    setError(null);
    listFriends(target, PAGE_SIZE)
      .then((result) => {
        setFriends(result.content);
        setTotalPages(result.totalPages);
        setTotal(result.totalElements);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, []);

  useEffect(() => {
    if (open) load(page);
  }, [open, page, load]);

  async function invite(friend: Friend) {
    setSending(friend.userId);
    try {
      await sendInvite(code, friend.userId);
      setSent((current) => new Set(current).add(friend.userId));
      toast.success(`Convite enviado para ${friend.name}.`);
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível enviar o convite.'));
    } finally {
      setSending(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Convidar amigo" description="Ele recebe o convite no app e entra com um toque." size="md" footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}>
      <div className="space-y-3">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {!friends && !error ? <LoadingState label="Buscando seus amigos..." /> : null}
        {friends && friends.length === 0 ? <Alert tone="info">Você ainda não tem amigos no app. Compartilhe o link da sala para chamar quem quiser.</Alert> : null}
        {friends && friends.length > 0 ? (
          <ul className="space-y-2">
            {friends.map((friend) => {
              const inside = inRoomUserIds.includes(friend.userId);
              const done = sent.has(friend.userId);
              return (
                <li key={friend.userId} className="flex items-center gap-3 rounded-2xl border-2 border-edge bg-surface-2 p-2.5">
                  <PlayerAvatar look={friend.look} name={friend.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold text-ink">{friend.name}</p>
                    <p className="text-xs font-semibold text-muted">Nível {friend.level}</p>
                  </div>
                  <Button size="sm" variant={done || inside ? 'secondary' : 'primary'} disabled={inside || done} loading={sending === friend.userId} onClick={() => void invite(friend)}>
                    {inside ? 'Na sala' : done ? 'Convidado' : 'Convidar'}
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {total > PAGE_SIZE ? <Pagination page={page} totalPages={totalPages} totalElements={total} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="amigos" /> : null}
      </div>
    </Modal>
  );
}
