import { useEffect, useRef } from 'react';
import { useDialogs } from '@/components/ui/dialogs';
import { dismissRoomInvite, listRoomInvites } from '@/lib/board-room-api';

const CHECK_MS = 6_000;

/**
 * Fica de olho nos convites de amigos para salas do Tabuleiro enquanto o app está aberto
 * (sem websocket: consulta a cada poucos segundos) e pergunta se a pessoa quer entrar.
 */
export function BoardInviteWatcher({ onAccept }: { onAccept: (code: string) => void }) {
  return (
    <RoomInviteWatcher
      list={async () => (await listRoomInvites()).map((invite) => ({ id: invite.id, code: invite.code, fromName: invite.fromName, title: `${invite.fromName} chamou você para o Tabuleiro`, message: `Cenário: ${invite.scenarioName} · ${invite.players} ${invite.players === 1 ? 'jogador' : 'jogadores'} na sala. Quer entrar?` }))}
      dismiss={dismissRoomInvite}
      onAccept={onAccept}
    />
  );
}

export type WatchedInvite = { id: number; code: string; fromName: string; title: string; message: string };

/** Pergunta se a pessoa quer entrar nos convites de sala (de qualquer jogo) que chegam enquanto o app está aberto. */
export function RoomInviteWatcher({ list, dismiss, onAccept }: { list: () => Promise<WatchedInvite[]>; dismiss: (id: number) => Promise<unknown>; onAccept: (code: string) => void }) {
  const dialogs = useDialogs();
  const asking = useRef(false);
  const seen = useRef(new Set<number>());
  const acceptRef = useRef(onAccept);
  acceptRef.current = onAccept;
  const dialogsRef = useRef(dialogs);
  dialogsRef.current = dialogs;
  const listRef = useRef(list);
  listRef.current = list;
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  useEffect(() => {
    let alive = true;

    async function check() {
      if (document.visibilityState !== 'visible' || asking.current) return;
      try {
        const invites = await listRef.current();
        const fresh = invites.find((invite) => !seen.current.has(invite.id));
        if (!fresh || !alive) return;
        seen.current.add(fresh.id);
        asking.current = true;
        const accepted = await dialogsRef.current.confirm({
          title: fresh.title,
          message: fresh.message,
          confirmLabel: 'Entrar na sala',
          cancelLabel: 'Agora não',
          tone: 'primary',
        });
        asking.current = false;
        if (accepted) acceptRef.current(fresh.code);
        else await Promise.resolve(dismissRef.current(fresh.id)).catch(() => undefined);
      } catch {
        // Sem rede ou sem convites: tenta de novo no próximo ciclo.
        asking.current = false;
      }
    }

    void check();
    const timer = window.setInterval(() => void check(), CHECK_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
