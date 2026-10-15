import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import {
  addRunnerRoomBot,
  getRunnerRoom,
  leaveRunnerRoom,
  removeRunnerRoomPlayer,
  runnerRoomLink,
  setRunnerRoomBotSkill,
  setRunnerRoomCharacter,
  setRunnerRoomLevel,
  startRunnerRace,
  type RunnerRoomView,
} from '@/lib/runner-room-api';
import { BOT_LEVELS } from '@runner/bots';
import { BOT_SKILLS, MIN_ROOM_RUNNERS, type RoomBotSkill } from '@runner/room';
import type { Level } from '@runner/types';
import { portraitOf, type RunnerCharacter } from '@/components/user/corrida/corrida-characters';
import { CorridaOnlineRace } from '@/components/user/corrida/corrida-online-race';
import { SpriteView } from '@/components/user/corrida/sprite-view';

const POLL_MS = 2000;
const SKILL_LABEL: Record<RoomBotSkill, string> = {
  APPRENTICE: BOT_LEVELS.APPRENTICE.label,
  STUDENT: BOT_LEVELS.STUDENT.label,
  MASTER: BOT_LEVELS.MASTER.label,
};

/**
 * Sala da corrida online: lobby (código e link de convite, jogadores, bots, fase e personagem) e, ao largar, a corrida. Sem WebSocket: no lobby a sala é
 * consultada a cada 2 s e só baixa quando a versão muda; correndo, quem sincroniza é a própria tela da corrida (`CorridaOnlineRace`).
 */
export function CorridaRoom({
  initial,
  levels,
  allCharacters,
  choices,
  onExit,
}: {
  initial: RunnerRoomView;
  levels: Level[];
  /** Todos os personagens ativos: serve para desenhar quem está na sala. */
  allCharacters: RunnerCharacter[];
  /** Os que a pessoa já abriu (os que ela pode escolher). */
  choices: RunnerCharacter[];
  /** Sai da tela da sala (sem sair dela: dá para voltar). */
  onExit: () => void;
}) {
  const toast = useToast();
  const [view, setView] = useState(initial);
  const [busy, setBusy] = useState(false);
  const viewRef = useRef(view);
  viewRef.current = view;
  const code = view.code;
  const level = levels.find((item) => item.id === view.levelSlug);

  const adopt = useCallback((next: RunnerRoomView) => setView(next), []);

  // Lobby e placar: consulta de tempos em tempos (só baixa a sala quando a versão muda).
  useEffect(() => {
    if (view.status === 'RACING') return undefined;
    let alive = true;
    const id = window.setInterval(() => {
      getRunnerRoom(code, viewRef.current.version)
        .then((found) => {
          if (alive && found.changed) setView(found);
        })
        .catch(() => undefined);
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [code, view.status]);

  async function act(action: () => Promise<RunnerRoomView>) {
    setBusy(true);
    try {
      setView(await action());
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    try {
      await leaveRunnerRoom(code);
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
    onExit();
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error('Não foi possível copiar. Anote o código.');
    }
  }

  async function share() {
    const link = runnerRoomLink(code);
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Corrida Bíblica',
          text: `Vem correr comigo! Sala ${code}`,
          url: link,
        });
        return;
      } catch {
        // Cancelou ou não deu: copia.
      }
    }
    await copy(link, 'Link copiado!');
  }

  const me = view.me;
  const isHost = Boolean(me?.isHost);
  const levelOptions = useMemo(() => levels.map((item) => ({ value: item.id, label: item.name })), [levels]);
  const myRow = view.players.find((player) => player.slot === me?.slot);
  const slots = Array.from({ length: view.maxPlayers }, (_, slot) => view.players.find((player) => player.slot === slot) ?? null);
  const enough = view.players.length >= MIN_ROOM_RUNNERS;

  if (view.status === 'RACING' || (view.status === 'FINISHED' && view.startAt !== null)) {
    if (!level) {
      return (
        <div className="space-y-4">
          <Alert tone="danger">Esta fase não está neste aparelho. Atualize o app e entre de novo na sala.</Alert>
          <Button onClick={() => void leave()}>Sair da sala</Button>
        </div>
      );
    }
    return <CorridaOnlineRace code={code} level={level} view={view} onView={adopt} characters={allCharacters} onLeave={() => void leave()} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onExit}>
          <ArrowBackRoundedIcon fontSize="small" /> Voltar
        </Button>
        <p className="ml-auto text-sm font-semibold text-muted">Anfitrião: {view.hostName}</p>
      </div>

      <section className="panel space-y-3 p-4 text-center">
        <p className="text-sm font-bold text-muted">Código da sala</p>
        <p className="font-display text-4xl font-bold tracking-[0.3em] text-ink">{code}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void copy(code, 'Código copiado!')}>
            <ContentCopyRoundedIcon fontSize="small" /> Copiar código
          </Button>
          <Button size="sm" onClick={() => void share()}>
            <ShareRoundedIcon fontSize="small" /> Convidar por link
          </Button>
        </div>
        <p className="text-xs font-semibold text-muted">Quem tem o link ou o código entra na sala (até {view.maxPlayers} corredores, com bots).</p>
      </section>

      <section className="panel space-y-3 p-4">
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Fase</p>
          {isHost ? (
            <Select value={view.levelSlug} onChange={(levelSlug) => void act(() => setRunnerRoomLevel(code, levelSlug))} options={levelOptions} aria-label="Fase da corrida" searchable />
          ) : (
            <p className="rounded-2xl bg-surface-3 px-3 py-2 text-sm font-bold text-ink">{view.levelName ?? view.levelSlug}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Seu personagem</p>
          <Select
            value={myRow?.characterSlug ?? ''}
            onChange={(slug) => void act(() => setRunnerRoomCharacter(code, slug || null))}
            options={[{ value: '', label: 'Corredor padrão' }, ...choices.map((item) => ({ value: item.id, label: item.name }))]}
            aria-label="Seu personagem"
            searchable
          />
        </div>
      </section>

      <section className="space-y-2" aria-label="Corredores">
        <h3 className="font-display text-base font-bold text-ink">
          Corredores ({view.players.length}/{view.maxPlayers})
        </h3>
        <ul className="space-y-2">
          {slots.map((player, slot) => {
            if (!player) {
              return (
                <li key={slot} className="flex flex-wrap items-center gap-2 rounded-3xl border-2 border-dashed border-edge-strong p-3">
                  <span className="mr-auto text-sm font-semibold text-muted">Vaga livre</span>
                  {isHost ? (
                    <Button size="sm" variant="secondary" onClick={() => void act(() => addRunnerRoomBot(code, 'STUDENT'))} disabled={busy}>
                      <AddRoundedIcon fontSize="small" /> <SmartToyRoundedIcon fontSize="small" /> Bot
                    </Button>
                  ) : null}
                </li>
              );
            }
            const found = allCharacters.find((item) => item.id === player.characterSlug);
            const sheet = portraitOf(found?.sprites ?? {});
            return (
              <li key={player.key} className="space-y-2 rounded-3xl border-2 border-edge bg-surface p-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${found?.color ?? '#94a3b8'}33` }}>
                    <SpriteView url={sheet?.url} frames={sheet?.frames} fps={sheet?.fps} color={found?.color ?? '#94a3b8'} size={44} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-display text-base font-bold text-ink">
                      <span
                        className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', player.connected ? 'bg-success' : 'bg-muted/50')}
                        aria-label={player.connected ? 'Conectado' : 'Sem conexão'}
                      />
                      <span className="truncate">{player.name}</span>
                      {player.bot ? <SmartToyRoundedIcon fontSize="small" className="shrink-0 text-muted" /> : null}
                    </p>
                    <p className="text-xs font-semibold text-muted">
                      {player.isHost ? '👑 Anfitrião' : player.bot ? `Bot ${SKILL_LABEL[player.bot]}` : 'Jogador'}
                      {player.userId === me?.userId ? ' · você' : ''}
                      {found ? ` · ${found.name}` : ''}
                    </p>
                  </div>
                  {isHost && player.userId !== me?.userId ? (
                    <Tooltip content={player.bot ? 'Tirar o bot' : 'Retirar da sala'}>
                      <button
                        type="button"
                        onClick={() => void act(() => removeRunnerRoomPlayer(code, player.slot))}
                        disabled={busy}
                        aria-label={player.bot ? `Tirar ${player.name} (bot) da sala` : `Retirar ${player.name} da sala`}
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
                    onChange={(skill: RoomBotSkill) => void act(() => setRunnerRoomBotSkill(code, player.slot, skill))}
                    options={BOT_SKILLS.map((skill) => ({
                      value: skill,
                      label: SKILL_LABEL[skill],
                    }))}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {view.players.some((player) => player.bot) && view.players.length >= view.maxPlayers ? (
          <p className="text-xs font-semibold text-muted">Com a sala cheia, quem chegar toma o lugar de um bot.</p>
        ) : null}
      </section>

      <div className="space-y-2">
        {isHost ? (
          <>
            <Button size="xl" className="w-full" onClick={() => void act(() => startRunnerRace(code))} loading={busy} disabled={!enough || !level}>
              Largar!
            </Button>
            {!enough ? (
              <p className="text-center text-xs font-semibold text-muted">Falta gente: chame um amigo pelo link ou coloque um bot.</p>
            ) : !level ? (
              <p className="text-center text-xs font-semibold text-muted">Esta fase não está neste aparelho: escolha outra.</p>
            ) : (
              <p className="text-center text-xs font-semibold text-muted">A largada tem uma contagem de 6 segundos para todos se prepararem. Use o celular deitado.</p>
            )}
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-surface-3 p-4 text-sm font-bold text-muted">
            <Spinner size="sm" /> Aguardando {view.hostName} largar...
          </p>
        )}
        <Button variant="ghost" className="w-full" onClick={() => void leave()}>
          Sair da sala
        </Button>
      </div>
    </div>
  );
}
