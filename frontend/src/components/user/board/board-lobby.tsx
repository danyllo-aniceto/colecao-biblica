import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { BOT_SKILLS, MAX_PLAYERS, MIN_PLAYERS, PUSH_BACK, type BotSkill } from '@board/engine';
import { boardRulesFor } from '@board/scenarios';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { errorMessage, useToast } from '@/components/ui/toast';
import { ScenarioIcon } from '@/components/user/campaign/scenario-art';
import { Pawn } from '@/components/user/board/board-track';
import { usePawnOptions } from '@/components/user/board/use-pawn-options';
import { FriendInviteModal } from '@/components/user/board/friend-invite-modal';
import { cn } from '@/lib/cn';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import { quizBackgroundStyle } from '@/lib/quiz-background';
import { roomLink, type RoomView } from '@/lib/board-room-api';

export type LobbyActions = {
  onLeave: () => void;
  onStart: () => void;
  onEditRules: () => void;
  onAddBot: (skill: BotSkill) => void;
  onBotSkill: (slot: number, skill: BotSkill) => void;
  onRemove: (slot: number) => void;
  onPawn: (pawn: string) => void;
};

/** Copia (ou compartilha) o link da sala; é o jeito de chamar quem ainda não está nos amigos. */
export async function shareRoom(code: string, toast: ReturnType<typeof useToast>) {
  const url = roomLink(code);
  const text = `Vem jogar Tabuleiro Bíblico comigo! Código da sala: ${code}`;
  try {
    if (typeof navigator.share === 'function') {
      await navigator.share({ title: 'Coleção Bíblica', text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast.success('Link da sala copiado!', { description: 'Cole numa conversa para chamar a turma.' });
  } catch (reason) {
    // Fechar a janela de compartilhar não é erro.
    if (reason instanceof DOMException && reason.name === 'AbortError') return;
    toast.error(errorMessage(reason, 'Não foi possível copiar o link.'));
  }
}

/** Sala reunindo gente: código, regras, jogadores (com bots e convites) e o botão de começar. */
export function BoardLobby({ view, busy, actions, connectionLost }: { view: RoomView; busy: boolean; actions: LobbyActions; connectionLost: boolean }) {
  const toast = useToast();
  const [inviting, setInviting] = useState(false);
  const pawns = usePawnOptions(true);
  const isHost = Boolean(view.me?.isHost);
  const full = view.players.length >= MAX_PLAYERS;
  const rules = boardRulesFor(view.scenario.slug);
  const taken = new Set(view.players.map((player) => player.pawn));
  const slots = Array.from({ length: MAX_PLAYERS }, (_, slot) => view.players.find((player) => player.slot === slot) ?? null);
  const firstEmpty = slots.findIndex((player) => player === null);
  const humanIds = view.players.flatMap((player) => (player.userId ? [player.userId] : []));
  const canStart = view.players.length >= MIN_PLAYERS;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" style={{ ...scenarioThemeVars(view.scenario.color), ...quizBackgroundStyle(view.scenario.quizBackgroundUrl) }} role="dialog" aria-modal="true" aria-label={`Sala ${view.code}`}>
      <div className="mx-auto flex min-h-full w-full max-w-2xl flex-col gap-4 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button type="button" onClick={actions.onLeave} aria-label="Sair da sala" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
            <CloseRoundedIcon />
          </button>
          <h2 className="font-display text-xl font-bold text-ink">Sala de espera</h2>
        </div>

        {connectionLost ? <Alert tone="danger">Sem conexão com o servidor. Tentando reconectar...</Alert> : null}

        <section className="panel space-y-3 p-4 text-center" aria-label="Código da sala">
          <p className="text-sm font-bold text-muted">Código da sala</p>
          <p className="font-display text-5xl font-bold tracking-[0.3em] text-ink" aria-label={`Código ${view.code.split('').join(' ')}`}>
            {view.code}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void shareRoom(view.code, toast)}>
              {typeof navigator.share === 'function' ? <ShareRoundedIcon fontSize="small" /> : <ContentCopyRoundedIcon fontSize="small" />}
              {typeof navigator.share === 'function' ? 'Compartilhar link' : 'Copiar link'}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setInviting(true)} disabled={full}>
              <PersonAddRoundedIcon fontSize="small" /> Convidar amigo
            </Button>
          </div>
          <p className="text-xs font-semibold text-muted">Quem não tem conta abre o link, cria uma e já entra na sala.</p>
        </section>

        <section className="panel flex items-center gap-3 p-4" aria-label="Cenário e regras">
          <ScenarioIcon scenario={view.scenario} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold text-ink">{view.scenario.name}</p>
            <p className="text-xs font-semibold text-muted">
              {view.config.size} casas · {view.config.timeSeconds}s por pergunta · {view.config.powerUps ? 'power-ups' : 'sem power-ups'} · {view.config.push ? `empurrão (${PUSH_BACK})` : 'sem empurrão'} · {view.config.catchUp ? 'ajuda ao último' : 'sem ajuda'}
            </p>
            {rules.event ? <p className="mt-0.5 text-xs font-semibold text-muted">✨ {rules.event.name}: {rules.event.description}</p> : null}
          </div>
          {isHost ? (
            <Tooltip content="Mudar cenário e regras">
              <button type="button" onClick={actions.onEditRules} aria-label="Mudar cenário e regras" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
                <SettingsRoundedIcon />
              </button>
            </Tooltip>
          ) : null}
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
                    {player.userId === view.me?.userId ? (
                      <div className="w-36 shrink-0">
                        <Select
                          aria-label="Seu peão"
                          value={player.pawn}
                          onChange={actions.onPawn}
                          options={pawns.map((option) => ({
                            value: option.value,
                            label: option.name,
                            icon: <Pawn emoji={option.value} className="text-xl" />,
                            disabled: option.value !== player.pawn && taken.has(option.value),
                          }))}
                        />
                      </div>
                    ) : (
                      <Pawn emoji={player.pawn} className="w-10 text-center text-3xl" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-display text-base font-bold text-ink">
                        <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', player.connected ? 'bg-success' : 'bg-muted/50')} aria-label={player.connected ? 'Conectado' : 'Sem conexão'} />
                        <span className="truncate">{player.name}</span>
                        {player.bot ? <SmartToyRoundedIcon fontSize="small" className="shrink-0 text-muted" /> : null}
                      </p>
                      <p className="text-xs font-semibold text-muted">
                        {player.isHost ? '👑 Anfitrião' : player.bot ? `Bot ${BOT_SKILLS[player.bot].name}` : 'Jogador'}
                        {player.userId === view.me?.userId ? ' · você' : ''}
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
                      onChange={(skill) => actions.onBotSkill(player.slot, skill)}
                      options={(Object.keys(BOT_SKILLS) as BotSkill[]).map((skill) => ({ value: skill, label: BOT_SKILLS[skill].name }))}
                    />
                  ) : null}
                </li>
              ) : (
                <li key={slot} className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-dashed border-edge-strong p-3">
                  <span className="mr-auto text-sm font-semibold text-muted">Vaga livre</span>
                  {slot === firstEmpty ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setInviting(true)}>
                        <AddRoundedIcon fontSize="small" /> Amigo
                      </Button>
                      {isHost ? (
                        <Button size="sm" variant="secondary" onClick={() => actions.onAddBot('STUDENT')} disabled={busy}>
                          <SmartToyRoundedIcon fontSize="small" /> Bot
                        </Button>
                      ) : null}
                    </>
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
                Começar partida
              </Button>
              {!canStart ? <p className="text-center text-xs font-semibold text-muted">Falta gente: chame um amigo ou coloque um bot na mesa.</p> : null}
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-surface-3 p-4 text-sm font-bold text-muted">
              <Spinner size="sm" /> Aguardando {view.hostName} começar a partida...
            </p>
          )}
        </div>
      </div>

      <FriendInviteModal open={inviting} code={view.code} inRoomUserIds={humanIds} onClose={() => setInviting(false)} />
    </div>
  );
}
