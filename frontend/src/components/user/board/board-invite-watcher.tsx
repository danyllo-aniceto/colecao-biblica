import { useEffect, useRef } from 'react';
import { useDialogs } from '@/components/ui/dialogs';
import { dismissRoomInvite, listRoomInvites } from '@/lib/board-room-api';

const CHECK_MS = 12_000;

/**
 * Fica de olho nos convites de amigos para salas do Tabuleiro enquanto o app está aberto
 * (sem websocket: consulta a cada poucos segundos) e pergunta se a pessoa quer entrar.
 */
export function BoardInviteWatcher({ onAccept }: { onAccept: (code: string) => void }) {
  const dialogs = useDialogs();
  const asking = useRef(false);
  const seen = useRef(new Set<number>());
  const acceptRef = useRef(onAccept);
  acceptRef.current = onAccept;
  const dialogsRef = useRef(dialogs);
  dialogsRef.current = dialogs;

  useEffect(() => {
    let alive = true;

    async function check() {
      if (document.visibilityState !== 'visible' || asking.current) return;
      try {
        const invites = await listRoomInvites();
        const fresh = invites.find((invite) => !seen.current.has(invite.id));
        if (!fresh || !alive) return;
        seen.current.add(fresh.id);
        asking.current = true;
        const accepted = await dialogsRef.current.confirm({
          title: `${fresh.fromName} chamou você para o Tabuleiro`,
          message: `Cenário: ${fresh.scenarioName} · ${fresh.players} ${fresh.players === 1 ? 'jogador' : 'jogadores'} na sala. Quer entrar?`,
          confirmLabel: 'Entrar na sala',
          cancelLabel: 'Agora não',
          tone: 'primary',
        });
        asking.current = false;
        if (accepted) acceptRef.current(fresh.code);
        else await dismissRoomInvite(fresh.id).catch(() => undefined);
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
