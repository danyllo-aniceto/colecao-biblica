import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import type { BotSkill } from '@duel/bots';
import { SERIES_FORMATS, type SeriesFormat } from '@duel/series';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { errorMessage, useToast } from '@/components/ui/toast';
import { FriendInviteModal } from '@/components/user/board/friend-invite-modal';
import { cn } from '@/lib/cn';
import { duelRoomLink, inviteToDuelRoom, TURN_OPTIONS, type DuelRoomConfig, type DuelRoomView } from '@/lib/duel-room-api';
import type { DuelDeck } from '@/lib/duel-api';

const MAX_PLAYERS = 2;
const SKILL_NAMES: Record<BotSkill, string> = { APPRENTICE: 'Aprendiz', STUDENT: 'Estudante', MASTER: 'Mestre' };

export type DuelLobbyActions = {
  onLeave: () => void;
  onStart: () => void;
  onAddBot: (skill: BotSkill) => void;
  onBotSkill: (slot: number, skill: BotSkill) => void;
  onRemove: (slot: number) => void;
  onDeck: (slot: number) => void;
  onConfig: (config: Partial<DuelRoomConfig>) => void;
};

/** Copia (ou compartilha) o link da sala; é o jeito de chamar quem ainda não está nos amigos. */
export async function shareDuelRoom(code: string, toast: ReturnType<typeof useToast>) {
  const url = duelRoomLink(code);
  const text = `Vem jogar Duelo de Cartas comigo! Código da sala: ${code}`;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'Coleção Bíblica', text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success('Link da sala copiado!', { description: 'Cole numa conversa para chamar seu amigo.' });
  } catch (reason) {
    // Fechar a janela de compartilhar não é erro.
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    toast.error(errorMessage(reason, 'Não foi possível copiar o link.'));
  }
}

/** Sala do Duelo reunindo gente: código, jogadores (amigo ou bot), Time de cada um, regras e o botão de começar. */
export function DuelLobby({ view, decks, busy, actions, connectionLost }: { view: DuelRoomView; decks: DuelDeck[]; busy: boolean; actions: DuelLobbyActions; connectionLost: boolean }) {
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const isHost = Boolean(view.me?.isHost);
  const full = view.players.length >= MAX_PLAYERS;
  const slots = Array.from({ length: MAX_PLAYERS }, (_, slot) => view.players.find((player) => player.slot === slot) ?? null);
  const humanIds = view.players.flatMap((player) => (player.userId ? [player.userId] : []));
  const everyoneHasDeck = view.players.every((player) => player.hasDeck);
  const canStart = full && everyoneHasDeck;
  const formatText = SERIES_FORMATS.find((entry) => entry.id === view.config.format)?.text;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label={`Sala de duelo ${view.code}`}>
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={actions.onLeave} aria-label="Sair da sala" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
            <CloseRoundedIcon />
          </button>
          <h2 className="font-display text-xl font-bold text-ink">Sala de Duelo</h2>
        </div>

        {connectionLost ? <Alert tone="danger">Sem conexão com o servidor. Tentando reconectar...</Alert> : null}

        <section className="panel space-y-3 p-4 text-center" aria-label="Código da sala">
          <p className="text-sm font-bold text-muted">Código da sala</p>
          <p className="font-display text-5xl font-bold tracking-[0.3em] text-ink" aria-label={`Código ${view.code.split('').join(' ')}`}>
            {view.code}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void shareDuelRoom(view.code, toast)}>
              {typeof navigator.share === 'function' ? <ShareRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
              {typeof navigator.share === 'function' ? 'Compartilhar link' : 'Copiar link'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setInviting(true)} disabled={full}>
              <PersonAddRoundedIcon fontSize="small" /> Convidar amigo
            </Button>
          </div>
          <p className="text-xs font-semibold text-muted">Quem não tem conta abre o link, cria uma e já entra na sala.</p>
        </section>

        <section className="panel space-y-3 p-4" aria-label="Seu Time">
          <h3 className="font-display text-base font-bold text-ink">Seu Time</h3>
          {decks.length === 0 ? (
            <Alert tone="info">Você ainda não montou um Time. Saia da sala, monte um Time de 12 cartas no Duelo e volte com o código.</Alert>
          ) : (
            <Select
              aria-label="Time que você vai usar"
              value={view.me?.deckSlot ? String(view.me.deckSlot) : ''}
              placeholder="Escolha um Time"
              onChange={(value) => actions.onDeck(Number(value))}
              options={decks.map((deck) => ({ value: String(deck.slot), label: deck.name, description: `${deck.cards.length} cartas` }))}
            />
          )}
          {view.me && view.me.deckSlot === null && decks.length > 0 ? <p className="text-xs font-semibold text-danger">Escolha o Time para o anfitrião poder começar.</p> : null}
        </section>

        <section className="panel space-y-3 p-4" aria-label="Regras da partida">
          <h3 className="font-display text-base font-bold text-ink">Regras</h3>
          {isHost ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <span className="text-sm font-bold text-muted">Partida</span>
                <Segmented aria-label="Tipo de partida" value={view.config.format} onChange={(format: SeriesFormat) => actions.onConfig({ format })} options={SERIES_FORMATS.map((entry) => ({ value: entry.id, label: entry.name }))} />
                {formatText ? <p className="text-xs font-semibold text-muted">{formatText}</p> : null}
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-bold text-muted">Tempo por turno</span>
                <Segmented aria-label="Tempo por turno" value={String(view.config.turnSeconds)} onChange={(value) => actions.onConfig({ turnSeconds: Number(value) })} options={TURN_OPTIONS.map((seconds) => ({ value: String(seconds), label: `${seconds}s` }))} />
              </div>
              <Switch checked={view.config.levels} onChange={(levels) => actions.onConfig({ levels })} label="Valer o nível das figurinhas" description="Ligado, cartas de nível 2 a 5 ficam um pouco mais fortes. Desligado, todas valem como nível 1." />
            </div>
          ) : (
            <p className="text-sm font-semibold text-ink">
              {SERIES_FORMATS.find((entry) => entry.id === view.config.format)?.name} · {view.config.turnSeconds}s por turno · {view.config.levels ? 'com nível das figurinhas' : 'todas no nível 1'}
            </p>
          )}
        </section>

        <section className="space-y-2" aria-label="Jogadores">
          <h3 className="font-display text-base font-bold text-ink">
            Jogadores · {view.players.length}/{MAX_PLAYERS}
          </h3>
          <ul className="space-y-2">
            {slots.map((player, slot) =>
              player ? (
                <li key={slot} className="panel space-y-2 p-3">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-display text-base font-bold text-ink">
                        <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', player.connected ? 'bg-success' : 'bg-muted/50')} aria-label={player.connected ? 'Conectado' : 'Sem conexão'} />
                        <span className="truncate">{player.name}</span>
                        {player.bot ? <SmartToyRoundedIcon fontSize="small" className="shrink-0 text-muted" /> : null}
                      </p>
                      <p className="text-xs font-semibold text-muted">
                        {player.isHost ? '👑 Anfitrião' : player.bot ? `Bot ${SKILL_NAMES[player.bot]}` : 'Jogador'}
                        {player.userId === view.me?.userId ? ' · você' : ''}
                        {player.bot ? '' : player.hasDeck ? ' · Time escolhido ✓' : ' · escolhendo o Time...'}
                      </p>
                    </div>
                    {isHost && player.userId !== view.me?.userId ? (
                      <Tooltip content={player.bot ? 'Tirar o bot' : 'Retirar da sala'}>
                        <button
                          type="button"
                          onClick={() => actions.onRemove(player.slot)}
                          disabled={busy}
                          aria-label={player.bot ? `Tirar ${player.name} (bot) da mesa` : `Retirar ${player.name} da sala`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-3 hover:text-danger disabled:opacity-40"
                        >
                          <CloseRoundedIcon />
                        </button>
                      </Tooltip>
                    ) : null}
                  </div>
                  {isHost && player.bot ? (
                    <Segmented
                      aria-label={`Nível de ${player.name}`}
                      value={player.bot}
                      onChange={(skill: BotSkill) => actions.onBotSkill(player.slot, skill)}
                      options={(Object.keys(SKILL_NAMES) as BotSkill[]).map((skill) => ({ value: skill, label: SKILL_NAMES[skill] }))}
                    />
                  ) : null}
                </li>
              ) : (
                <li key={slot} className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-dashed border-edge-strong p-3">
                  <span className="mr-auto text-sm font-semibold text-muted">Vaga livre</span>
                  <Button size="sm" variant="secondary" onClick={() => setInviting(true)}>
                    <AddRoundedIcon fontSize="small" /> Amigo
                  </Button>
                  {isHost ? (
                    <Button size="sm" variant="secondary" onClick={() => actions.onAddBot('STUDENT')} disabled={busy}>
                      <SmartToyRoundedIcon fontSize="small" /> Bot
                    </Button>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </section>

        <div className="mt-auto space-y-2 pb-[env(safe-area-inset-bottom)]">
          {isHost ? (
            <>
              <Button size="xl" className="w-full" onClick={actions.onStart} loading={busy} disabled={!canStart}>
                Começar duelo
              </Button>
              {!full ? <p className="text-center text-xs font-semibold text-muted">Falta gente: chame um amigo ou coloque um bot na mesa.</p> : !everyoneHasDeck ? <p className="text-center text-xs font-semibold text-muted">Todos precisam escolher o Time antes de começar.</p> : null}
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-surface-3 p-4 text-sm font-bold text-muted">
              <Spinner size="sm" /> Aguardando {view.hostName} começar o duelo...
            </p>
          )}
        </div>
      </div>

      <FriendInviteModal open={inviting} code={view.code} inRoomUserIds={humanIds} onClose={() => setInviting(false)} invite={inviteToDuelRoom} />
    </div>
  );
}
