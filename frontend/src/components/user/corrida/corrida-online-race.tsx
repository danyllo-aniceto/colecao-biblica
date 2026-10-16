import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ScreenRotationRoundedIcon from '@mui/icons-material/ScreenRotationRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { errorMessage, useToast } from '@/components/ui/toast';
import { isNetworkError } from '@/lib/http';
import { unlockAudio } from '@/lib/sound/context';
import { playCharacterSound, preloadCharacterSounds } from '@/lib/sound/character-sfx';
import { useBoardMusic } from '@/lib/sound/board-music';
import { playSfx } from '@/lib/sound/sfx';
import { finishRunnerRace, getRunnerRoom, rematchRunnerRoom, reportRunnerProgress, type RaceReport, type RunnerRoomPlayer, type RunnerRoomView } from '@/lib/runner-room-api';
import type { SoundKey } from '@runner/characters';
import { BOT_LEVELS, BOT_RESPAWN_TICKS, createBot, type Bot } from '@runner/bots';
import { newPlayer, prepareLevel, progressOf, respawnAt, stepPlayer } from '@runner/engine';
import { TICKS_PER_SECOND, type Form, type Level, type PlayerState } from '@runner/types';
import type { RunSegment } from '@runner/verify';
import { drawScene, type RivalView } from '@/components/user/corrida/corrida-draw';
import type { RunnerCharacter } from '@/components/user/corrida/corrida-characters';
import { preloadArt, preloadSprites } from '@/components/user/corrida/corrida-sprites';

const STEP_MS = 1000 / TICKS_PER_SECOND;
const DEFAULT_COLOR = '#38bdf8';
const SYNC_MS = 1000;
const BOT_BY_SKILL = {
  APPRENTICE: BOT_LEVELS.APPRENTICE,
  STUDENT: BOT_LEVELS.STUDENT,
  MASTER: BOT_LEVELS.MASTER,
} as const;

const formatTime = (ticks: number) => {
  const seconds = ticks / TICKS_PER_SECOND;
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
};

type Snapshot = {
  count: number;
  collected: number[];
  powers: number[];
  tick: number;
};
type Own = {
  state: PlayerState;
  hold: boolean;
  checkpoint: Snapshot | null;
  deadFor: number;
  deaths: number;
  segments: RunSegment[];
  held: boolean;
  steps: number;
  flash: number;
};
type Ghost = { x: number; y: number; form: Form };

/**
 * A corrida online na tela: cada aparelho roda a própria física (a mesma de sempre), na hora marcada pelo servidor; a posição vai para a sala a cada
 * ~1 s e os outros corredores aparecem como fantasmas levemente atrasados. Ao chegar, a partida inteira (os toques de cada tentativa) vai para o servidor
 * repetir e conferir: o tempo oficial vem dele. O anfitrião joga pelos bots e manda a partida deles também. Cair volta sozinho ao último checkpoint
 * (ou ao início, se ainda não passou por nenhum).
 */
export function CorridaOnlineRace({
  code,
  level,
  view,
  onView,
  characters,
  onLeave,
}: {
  code: string;
  level: Level;
  view: RunnerRoomView;
  onView: (view: RunnerRoomView) => void;
  characters: RunnerCharacter[];
  onLeave: () => void;
}) {
  const toast = useToast();
  // As telas abaixo dependem de funções estáveis: o aviso vem por ref (a identidade do toast pode mudar a cada renderização).
  const toastRef = useRef(toast);
  toastRef.current = toast;
  const { confirm } = useDialogs();
  const prepared = useMemo(() => prepareLevel(level), [level]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const countdownRef = useRef<HTMLParagraphElement | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  // Diferença entre o relógio do servidor e o deste aparelho (acertada a cada resposta).
  const offsetRef = useRef(view.serverNow - Date.now());
  const ownRef = useRef<Own>({
    state: newPlayer(prepared),
    hold: false,
    checkpoint: null,
    deadFor: 0,
    deaths: 0,
    segments: [{ fromCheckpoint: false, toggles: [] }],
    held: false,
    steps: 0,
    flash: 0,
  });
  const botsRef = useRef(new Map<number, Bot>());
  const botFinishSent = useRef(new Set<number>());
  const ghostsRef = useRef(new Map<number, Ghost>());
  const startedRef = useRef(false);
  const finishSentRef = useRef(false);
  const portraitRef = useRef(false);
  const [portrait, setPortrait] = useState(false);
  const [busy, setBusy] = useState(false);

  const me = view.me;
  const meRow = view.players.find((player) => player.slot === me?.slot);
  const isHost = Boolean(me?.isHost);
  const charOf = useCallback((player: RunnerRoomPlayer) => characters.find((item) => item.id === player.characterSlug), [characters]);
  const myChar = meRow ? charOf(meRow) : undefined;
  const myCharRef = useRef(myChar);
  myCharRef.current = myChar;

  useBoardMusic(level.music);
  useEffect(() => preloadArt(level.art), [level.art]);
  useEffect(() => {
    for (const player of view.players) {
      const found = charOf(player);
      preloadSprites(found?.sprites);
      preloadCharacterSounds(found?.sounds);
    }
    // Só ao montar: os personagens da sala não mudam durante a corrida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adopt = useCallback((next: RunnerRoomView) => {
    offsetRef.current = next.serverNow - Date.now();
    onViewRef.current(next);
  }, []);

  // O jogo é na tela deitada (aviso, mas o relógio da corrida não para: é o mesmo para todos).
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const sync = () => {
      portraitRef.current = query.matches;
      setPortrait(query.matches);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Trava a rolagem da página por baixo do jogo.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Entrada: toque/mouse na tela e teclado.
  useEffect(() => {
    const canvas = canvasRef.current;
    const press = () => {
      unlockAudio();
      ownRef.current.hold = true;
    };
    const release = () => {
      ownRef.current.hold = false;
    };
    const isKey = (event: KeyboardEvent) => event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW';
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isKey(event)) return;
      event.preventDefault();
      if (!event.repeat) press();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (isKey(event)) release();
    };
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      press();
    };
    canvas?.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      canvas?.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Sincronia com o servidor: antes da largada e depois de chegar só consulta; correndo, manda a posição (e a dos bots, se for o anfitrião).
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const report = (state: PlayerState, deaths: number): RaceReport => ({
      x: Math.round(state.x),
      y: Math.round(state.y),
      form: state.form,
      dead: state.status === 'dead',
      deaths,
      words: state.collected.length,
    });
    const tick = async () => {
      if (!alive) return;
      const current = viewRef.current;
      try {
        const own = ownRef.current;
        const racing = startedRef.current && !finishSentRef.current && own.state.status !== 'finished';
        let next: RunnerRoomView;
        if (racing) {
          const bots = current.me?.isHost
            ? [...botsRef.current.entries()]
                .filter(([slot]) => !botFinishSent.current.has(slot))
                .map(([slot, bot]) => ({
                  slot,
                  report: report(bot.player, bot.deaths),
                }))
            : [];
          next = await reportRunnerProgress(code, report(own.state, own.deaths), bots);
        } else {
          const found = await getRunnerRoom(code);
          if (!found.changed) return;
          next = found;
        }
        if (alive) adopt(next);
      } catch (reason) {
        // Falta de conexão por um instante não derruba a corrida. Recusa do servidor (ex.: a corrida já acabou): ressincroniza com a sala; só se isso
        // também falhar (ex.: saiu da sala) o aviso aparece.
        if (!isNetworkError(reason) && alive) {
          try {
            const found = await getRunnerRoom(code);
            if (found.changed && alive) adopt(found);
          } catch (again) {
            if (!isNetworkError(again) && alive) toastRef.current.error(errorMessage(again));
          }
        }
      } finally {
        if (alive && viewRef.current.status === 'RACING') timer = window.setTimeout(() => void tick(), SYNC_MS);
        else if (alive && viewRef.current.status === 'FINISHED') timer = window.setTimeout(() => void tick(), 3000);
      }
    };
    timer = window.setTimeout(() => void tick(), 400);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [adopt, code]);

  // Chegada: manda a partida inteira para o servidor conferir (tenta de novo se a conexão falhar).
  const sendFinish = useCallback(
    async (segments: RunSegment[], slot?: number) => {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          adopt(await finishRunnerRace(code, segments, slot));
          return true;
        } catch (reason) {
          if (!isNetworkError(reason)) {
            toastRef.current.error(errorMessage(reason));
            return false;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }
      }
      return false;
    },
    [adopt, code],
  );

  // Laço do jogo.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let dpr = 1;
    let clock = 0;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(box.width * dpr));
      canvas.height = Math.max(1, Math.round(box.height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const sound = (key: SoundKey, fallback: Parameters<typeof playSfx>[0] | null) => playCharacterSound(myCharRef.current?.sounds, key, fallback);

    const startRace = () => {
      startedRef.current = true;
      ownRef.current = {
        state: newPlayer(prepared),
        hold: ownRef.current.hold,
        checkpoint: null,
        deadFor: 0,
        deaths: 0,
        segments: [{ fromCheckpoint: false, toggles: [] }],
        held: false,
        steps: 0,
        flash: 0,
      };
      // O aparelho do anfitrião joga pelos bots (cada um com a semente da sala, então o resultado é o mesmo se a corrida se repetir).
      if (viewRef.current.me?.isHost) {
        for (const player of viewRef.current.players) {
          if (!player.bot) continue;
          const level = BOT_BY_SKILL[player.bot];
          botsRef.current.set(
            player.slot,
            createBot(prepared, {
              skill: level.skill,
              lag: level.lag,
              seed: (player.slot + 1) * 7919,
              phase: player.slot * 3,
              respawn: true,
            }),
          );
        }
      }
    };

    const stepOwn = () => {
      const own = ownRef.current;
      const before = own.state;
      if (before.status === 'finished') return;
      if (before.status === 'dead') {
        own.deadFor += 1;
        if (own.deadFor >= BOT_RESPAWN_TICKS) {
          const saved = own.checkpoint;
          if (saved) {
            own.state = respawnAt(prepared, saved.count, saved.collected, saved.tick, saved.powers);
            own.segments.push({ fromCheckpoint: true, toggles: [] });
          } else {
            // Sem checkpoint ainda: recomeça do início (o tempo gasto continua contando).
            own.state = newPlayer(prepared);
            own.segments.push({ fromCheckpoint: false, toggles: [] });
          }
          own.held = false;
          own.steps = 0;
          own.deadFor = 0;
        }
        return;
      }
      if (own.hold !== own.held) {
        own.segments[own.segments.length - 1].toggles.push(own.steps);
        own.held = own.hold;
      }
      own.steps += 1;
      const after = stepPlayer(prepared, before, own.hold);
      own.state = after;
      if (after.status !== 'dead') {
        if (after.airJumps < before.airJumps) sound('double', 'rnDouble');
        else if (before.grounded && after.form === 'RUN' && after.vy < -4) sound('jump', 'rnJump');
        if (after.collected.length > before.collected.length) sound('word', 'rnWord');
        if (after.powers.length > before.powers.length) {
          playSfx('rnPower');
          sound('power', null);
        }
        if (before.effects.shield > 0 && after.effects.shield === 0) playSfx('rnShield');
        if (after.grav !== before.grav) sound('flip', 'rnFlip');
        if (after.portal > before.portal) {
          playSfx('rnPortal');
          sound(after.form === 'FLY' ? 'flyStart' : after.form === 'GRAVITY' ? 'gravityStart' : 'runStart', null);
        }
      }
      if (after.checkpoint > before.checkpoint && after.status === 'running')
        own.checkpoint = {
          count: after.checkpoint,
          collected: after.collected,
          powers: after.powers,
          tick: after.tick,
        };
      if (after.status === 'dead') {
        own.deaths += 1;
        own.flash = 1;
        sound('death', 'rnDeath');
      }
      if (after.status === 'finished' && !finishSentRef.current) {
        finishSentRef.current = true;
        sound('win', 'rnWin');
        void sendFinish(
          own.segments.map((segment) => ({
            fromCheckpoint: segment.fromCheckpoint,
            toggles: [...segment.toggles],
          })),
        );
      }
    };

    const frame = (now: number) => {
      const current = viewRef.current;
      const serverTime = Date.now() + offsetRef.current;
      const startAt = current.startAt;
      const raceOn = current.status === 'RACING' && startAt !== null && serverTime >= startAt;
      if (raceOn && !startedRef.current) {
        startRace();
        last = now;
        acc = 0;
      }
      if (startedRef.current && current.status === 'RACING') {
        acc = Math.min(acc + (now - last), STEP_MS * 5);
        while (acc >= STEP_MS) {
          acc -= STEP_MS;
          if (!meOut(current)) stepOwn();
          for (const [slot, bot] of botsRef.current) {
            if (botFinishSent.current.has(slot)) continue;
            bot.step();
            if (bot.player.status === 'finished') {
              botFinishSent.current.add(slot);
              void sendFinish(
                bot.segments.map((segment) => ({
                  fromCheckpoint: segment.fromCheckpoint,
                  toggles: [...segment.toggles],
                })),
                slot,
              );
            }
          }
        }
      }
      last = now;
      clock += 1;
      const own = ownRef.current;
      if (own.flash > 0) own.flash = Math.max(0, own.flash - 0.04);
      // Contagem na tela (pelo relógio do servidor).
      if (countdownRef.current) {
        const left = startAt === null ? 0 : startAt - serverTime;
        countdownRef.current.textContent = current.status !== 'RACING' ? '' : left > 0 ? String(Math.ceil(left / 1000)) : left > -900 ? 'Já!' : '';
      }
      // Fantasmas: chegam aos poucos à posição relatada (aparecem levemente atrasados).
      const rivals: RivalView[] = [];
      for (const player of current.players) {
        if (player.slot === current.me?.slot) continue;
        const found = characters.find((item) => item.id === player.characterSlug);
        const bot = botsRef.current.get(player.slot);
        let state: PlayerState;
        if (bot && !player.out) {
          state = bot.player;
        } else {
          const target = {
            x: player.x ?? 0,
            y: player.y ?? 0,
            form: (player.form as Form) ?? 'RUN',
          };
          const ghost = ghostsRef.current.get(player.slot) ?? { ...target };
          ghost.x = Math.abs(target.x - ghost.x) > 600 ? target.x : ghost.x + (target.x - ghost.x) * 0.12;
          ghost.y += (target.y - ghost.y) * 0.3;
          ghost.form = target.form;
          ghostsRef.current.set(player.slot, ghost);
          state = {
            ...newPlayer(prepared),
            x: ghost.x,
            y: ghost.y,
            form: ghost.form,
            status: player.dead ? 'dead' : 'running',
            tick: clock,
          };
        }
        if (player.out) continue;
        rivals.push({
          name: player.name,
          color: found?.color ?? '#94a3b8',
          sprites: found?.sprites,
          player: state,
        });
      }
      const mine = progressOf(prepared, own.state);
      const ahead = current.players.filter((player) => player.slot !== current.me?.slot && !player.out && (player.finished || (player.progress ?? 0) > mine)).length;
      const racers = current.players.filter((player) => !player.out).length;
      drawScene(ctx, prepared, own.state, canvas.width, canvas.height, {
        color: myCharRef.current?.color ?? DEFAULT_COLOR,
        sprites: myCharRef.current?.sprites,
        deadFor: Math.floor(own.deadFor / 6),
        stopped: !startedRef.current || own.state.status === 'finished',
        clock,
        rivals,
        rank: racers > 1 ? { position: 1 + ahead, total: racers } : null,
        flash: own.flash,
        note: null,
        dpr,
      });
      raf = requestAnimationFrame(frame);
    };
    const meOut = (current: RunnerRoomView) => current.players.find((player) => player.slot === current.me?.slot)?.out === true;
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [characters, prepared, sendFinish]);

  async function leave() {
    const ok = await confirm({
      title: 'Sair da corrida?',
      message: 'Você fica fora desta corrida.',
      confirmLabel: 'Sair',
      tone: 'danger',
    });
    if (ok) onLeave();
  }

  async function rematch() {
    setBusy(true);
    try {
      adopt(await rematchRunnerRoom(code));
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  const finishedView = view.status === 'FINISHED';
  const results = view.results;
  const myResult = results?.find((entry) => entry.slot === me?.slot);
  const out = meRow?.out === true;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Corrida online: ${level.name}`} className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1 select-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="Área do jogo" />
        <button
          type="button"
          onClick={() => void leave()}
          aria-label="Sair da corrida"
          className="absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-2xl bg-black/50 text-white transition hover:bg-black/70"
        >
          <CloseRoundedIcon />
        </button>
        <p
          ref={countdownRef}
          className="pointer-events-none absolute inset-x-0 top-[28%] text-center font-display text-7xl font-bold text-white drop-shadow-[0_3px_0_rgba(0,0,0,0.7)]"
          aria-live="polite"
        />
        {portrait && !finishedView ? (
          <div className="pointer-events-none absolute inset-x-0 top-[40%] flex justify-center px-6">
            <p className="flex items-center gap-2 rounded-2xl bg-black/70 px-4 py-3 text-center font-display text-base font-bold text-white">
              <ScreenRotationRoundedIcon /> Gire o celular: a corrida não espera!
            </p>
          </div>
        ) : null}
        {out && !finishedView ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[18%] flex justify-center px-6">
            <p className="rounded-2xl bg-black/70 px-4 py-3 text-center font-display text-base font-bold text-white">Você ficou fora desta corrida (sem conexão por muito tempo).</p>
          </div>
        ) : null}
        {meRow?.finished && !finishedView ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[18%] flex justify-center px-6">
            <p className="rounded-2xl bg-black/70 px-4 py-3 text-center font-display text-base font-bold text-white">Você chegou em {formatTime(meRow.finishTicks ?? 0)}! Aguardando os outros...</p>
          </div>
        ) : null}
        {finishedView && results && !portrait ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/50 p-3">
            <div className="panel max-h-full w-full max-w-md space-y-3 overflow-y-auto p-4 text-center">
              <h3 className="font-display text-xl font-bold text-ink sm:text-2xl">
                {results[0]?.finished ? (results[0].slot === me?.slot ? 'Você venceu a corrida!' : `${results[0].name} chegou primeiro`) : 'Fim da corrida'}
              </h3>
              <ol className="space-y-1.5 text-left">
                {results.map((entry) => (
                  <li key={entry.slot} className={`flex items-center gap-2 rounded-xl px-3 py-1.5 ${entry.slot === me?.slot ? 'bg-primary/20' : 'bg-surface-3'}`}>
                    <span className="w-6 font-display text-lg font-bold text-muted">{entry.place}º</span>
                    <span className="min-w-0 flex-1 truncate font-display font-bold text-ink">
                      {entry.name}
                      {entry.bot ? ' (bot)' : ''}
                    </span>
                    <span className="text-right text-xs font-semibold text-muted">
                      {entry.finished ? `${formatTime(entry.ticks ?? 0)} (oficial)` : entry.out ? 'saiu da corrida' : `${Math.floor(entry.progress * 100)}%`}
                      <br />
                      {entry.words} {entry.words === 1 ? 'palavra' : 'palavras'}
                      {entry.deaths > 0 ? ` · ${entry.deaths} ${entry.deaths === 1 ? 'queda' : 'quedas'}` : ''}
                    </span>
                  </li>
                ))}
              </ol>
              {myResult && myResult.finished ? <p className="text-xs font-semibold text-muted">O tempo oficial é conferido pelo servidor, que repete a sua partida.</p> : null}
              <div className="grid grid-cols-2 gap-2">
                {isHost ? (
                  <Button size="lg" onClick={() => void rematch()} loading={busy}>
                    Revanche
                  </Button>
                ) : (
                  <p className="flex items-center justify-center text-sm font-semibold text-muted">Aguardando o anfitrião...</p>
                )}
                <Button size="lg" variant="ghost" onClick={onLeave}>
                  Sair
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
