import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ScreenRotationRoundedIcon from '@mui/icons-material/ScreenRotationRounded';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '@/lib/sound/context';
import { playCharacterSound, preloadCharacterSounds } from '@/lib/sound/character-sfx';
import { useBoardMusic } from '@/lib/sound/board-music';
import { playSfx } from '@/lib/sound/sfx';
import type { Pose, SoundKey, Sounds, Sprites } from '@runner/characters';
import { createBot, BOT_RESPAWN_TICKS, type Bot } from '@runner/bots';
import { newPlayer, prepareLevel, progressOf, respawnAt, stepPlayer } from '@runner/engine';
import { TICKS_PER_SECOND, type Level, type PlayerState, type PreparedLevel } from '@runner/types';
import { drawScene, type Note, type RivalView } from '@/components/user/corrida/corrida-draw';
import { preloadArt, preloadSprites } from '@/components/user/corrida/corrida-sprites';
import { SpriteView } from '@/components/user/corrida/sprite-view';

const STEP_MS = 1000 / TICKS_PER_SECOND;
/** Cor do corredor quando nenhum personagem foi escolhido. */
const DEFAULT_COLOR = '#38bdf8';

/** O que a tela precisa do personagem escolhido: cor de reserva, sprites por pose e sons. */
export type CorridaCharacter = { color: string; sprites?: Sprites; sounds?: Sounds };

type Phase = 'ready' | 'playing' | 'dead' | 'finished';
type Summary = { progress: number; words: number; total: number };

export type CorridaResult = { progress: number; words: number; finished: boolean; /** Concluída sem voltar a nenhum checkpoint. */ clean: boolean };
/** Um rival da corrida contra bots. `skill` e `lag` vêm de `BOT_LEVELS`. */
export type CorridaRival = { name: string; color: string; sprites?: Sprites; skill: number; lag: number };
export type Standing = { name: string; color: string; progress: number; finished: boolean; deaths: number; isPlayer: boolean; ticks: number };

const formatTime = (ticks: number) => {
  const seconds = Math.round(ticks / TICKS_PER_SECOND);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

type Props = {
  level: Level;
  /** Personagem escolhido (cor, sprites e sons); sem ele, o corredor é um quadrado azul. */
  character?: CorridaCharacter;
  /** Treino: não conta para o melhor resultado. */
  practice?: boolean;
  /** Um bot joga no seu lugar (para assistir): o jogador só olha. */
  autopilot?: { skill: number; lag: number };
  /** Corrida contra bots: rivais ao vivo na mesma tela; ao cair, todos voltam ao último checkpoint sozinhos; vence quem cruzar a linha primeiro. */
  rivals?: CorridaRival[];
  /** Resultado da partida (fora do treino, do piloto automático e da corrida). */
  onResult?: (result: CorridaResult) => void;
  onExit: () => void;
};

/**
 * Tela da partida em tela cheia. Passo fixo de 60 por segundo (o mesmo motor que o servidor repete para conferir).
 * Todo checkpoint (bandeira) salva o ponto e, ao cair, dá para voltar a ele (sempre num estado limpo: `respawnAt`).
 */
export function CorridaGame({ level, character, practice = false, autopilot, rivals: rivalSpecs, onResult, onExit }: Props) {
  const prepared = useRef<PreparedLevel>(prepareLevel(level));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holdRef = useRef(false);
  const playerRef = useRef<PlayerState>(newPlayer(prepared.current));
  const phaseRef = useRef<Phase>('ready');
  const flashRef = useRef(0);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const checkpointRef = useRef<{ count: number; collected: number[]; powers: number[]; tick: number } | null>(null);
  const usedCheckpointRef = useRef(false);
  const noteRef = useRef<{ text: string; until: number } | null>(null);
  const botRef = useRef<Bot | null>(null);
  const rivalsRef = useRef<Array<{ bot: Bot; spec: CorridaRival }>>([]);
  const raceRef = useRef({ ticks: 0, deaths: 0, deadFor: 0 });
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [standings, setStandings] = useState<Standing[] | null>(null);
  // O jogo é só para a tela deitada: em pé, pausa e pede para girar o celular.
  const portraitRef = useRef(false);
  const [portrait, setPortrait] = useState(false);
  const race = Boolean(rivalSpecs && rivalSpecs.length > 0);
  const color = character?.color ?? DEFAULT_COLOR;
  const sprites = character?.sprites;
  const sounds = character?.sounds;
  const deadForRef = useRef(0);
  const clockRef = useRef(0);
  const soundsRef = useRef(sounds);
  soundsRef.current = sounds;
  /** Som do personagem (se enviado pelo painel) ou o padrão do modo. */
  const sound = useCallback((key: SoundKey, fallback: Parameters<typeof playSfx>[0]) => playCharacterSound(soundsRef.current, key, fallback), []);

  // A trilha do cenário toca no lugar da música do app enquanto a fase estiver aberta (segue os ajustes de som do jogador).
  useBoardMusic(level.music);
  useEffect(() => preloadArt(level.art), [level.art]);

  // Aquece sprites e sons antes de a corrida começar (nada de "piscar" a forma colorida no primeiro quadro).
  useEffect(() => {
    preloadSprites(sprites);
    preloadCharacterSounds(sounds);
    for (const rival of rivalSpecs ?? []) preloadSprites(rival.sprites);
  }, [sprites, sounds, rivalSpecs]);

  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)');
    const sync = () => {
      portraitRef.current = query.matches;
      setPortrait(query.matches);
      if (query.matches) holdRef.current = false;
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  /** Recomeça do início, ou do último checkpoint (sempre num estado limpo). */
  const restart = useCallback(
    (fromCheckpoint = false) => {
      const saved = fromCheckpoint ? checkpointRef.current : null;
      usedCheckpointRef.current = saved !== null;
      noteRef.current = null;
      if (saved) {
        playerRef.current = respawnAt(prepared.current, saved.count, saved.collected, saved.tick, saved.powers);
      } else {
        playerRef.current = newPlayer(prepared.current);
        checkpointRef.current = null;
        setHasCheckpoint(false);
        raceRef.current = { ticks: 0, deaths: 0, deadFor: 0 };
        rivalsRef.current = (rivalSpecs ?? []).map((spec, index) => ({
          spec,
          bot: createBot(prepared.current, { skill: spec.skill, lag: spec.lag, seed: Math.floor(Math.random() * 1e6) + index, phase: (index + 1) * 3, respawn: true }),
        }));
        if (autopilot) {
          botRef.current = createBot(prepared.current, { skill: autopilot.skill, lag: autopilot.lag, seed: 1, respawn: false });
          playerRef.current = botRef.current.player;
        }
      }
      holdRef.current = false;
      flashRef.current = 0;
      deadForRef.current = 0;
      setSummary(null);
      setStandings(null);
      setPhaseBoth(autopilot ? 'playing' : 'ready');
    },
    [autopilot, rivalSpecs, setPhaseBoth],
  );

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
    if (autopilot) return undefined;
    const press = () => {
      unlockAudio();
      if (phaseRef.current === 'ready') setPhaseBoth('playing');
      holdRef.current = true;
    };
    const release = () => {
      holdRef.current = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault();
        if (!event.repeat) press();
      } else if (event.code === 'Escape') onExit();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') release();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const canvas = canvasRef.current;
    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      press();
    };
    canvas?.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas?.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', release);
      window.removeEventListener('pointercancel', release);
    };
  }, [autopilot, onExit, setPhaseBoth]);

  // Laço do jogo: passo fixo com acumulador; desenha a cada quadro.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let dpr = 1;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      dpr = ratio;
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(box.width * ratio));
      canvas.height = Math.max(1, Math.round(box.height * ratio));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    /** Quem cruzou a linha primeiro vence; os demais ficam pela posição. Termina a corrida. */
    const finishRace = () => {
      const level = prepared.current;
      const racers: Standing[] = [
        { name: 'Você', color, progress: progressOf(level, playerRef.current), finished: playerRef.current.status === 'finished', deaths: raceRef.current.deaths, isPlayer: true, ticks: raceRef.current.ticks },
        ...rivalsRef.current.map(({ bot, spec }) => ({ name: spec.name, color: spec.color, progress: progressOf(level, bot.player), finished: bot.player.status === 'finished', deaths: bot.deaths, isPlayer: false, ticks: bot.elapsed })),
      ];
      racers.sort((a, b) => Number(b.finished) - Number(a.finished) || (a.finished && b.finished ? a.ticks - b.ticks : b.progress - a.progress));
      setStandings(racers);
      const me = playerRef.current;
      setSummary({ progress: progressOf(level, me), words: me.collected.length, total: level.wordCount });
      setPhaseBoth('finished');
      sound(racers[0].isPlayer ? 'win' : 'death', racers[0].isPlayer ? 'rnWin' : 'rnDeath');
    };

    const frame = (now: number) => {
      acc = Math.min(acc + (now - last), STEP_MS * 5);
      last = now;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        if (phaseRef.current !== 'playing' || portraitRef.current) continue;
        const before = playerRef.current;
        let after = before;
        if (race) {
          raceRef.current.ticks += 1;
          for (const { bot } of rivalsRef.current) bot.step();
        }
        if (autopilot && botRef.current) {
          botRef.current.step();
          after = botRef.current.player;
        } else if (race && before.status === 'dead') {
          // Na corrida o tempo não para: cai, espera um instante e volta sozinho ao último checkpoint.
          raceRef.current.deadFor += 1;
          if (raceRef.current.deadFor >= BOT_RESPAWN_TICKS) {
            const saved = checkpointRef.current;
            after = saved ? respawnAt(prepared.current, saved.count, saved.collected, before.tick, saved.powers) : { ...newPlayer(prepared.current), collected: before.collected, powers: before.powers, tick: before.tick };
            raceRef.current.deadFor = 0;
            holdRef.current = false;
            usedCheckpointRef.current = true;
          }
        } else {
          after = stepPlayer(prepared.current, before, holdRef.current);
        }
        playerRef.current = after;
        // Sons dos acontecimentos deste passo.
        if (after.status !== 'dead' && before.status !== 'dead') {
          if (after.airJumps < before.airJumps) sound('double', 'rnDouble');
          else if (before.grounded && after.form === 'RUN' && after.vy < -4) sound('jump', 'rnJump');
          if (after.collected.length > before.collected.length) sound('word', 'rnWord');
          if (after.powers.length > before.powers.length) playSfx('rnPower');
          if (before.effects.shield > 0 && after.effects.shield === 0) playSfx('rnShield');
          if (after.grav !== before.grav) sound('flip', 'rnFlip');
          if (after.portal > before.portal) playSfx('rnPortal');
        }
        if (after.checkpoint > before.checkpoint && !autopilot && after.status === 'running') {
          checkpointRef.current = { count: after.checkpoint, collected: after.collected, powers: after.powers, tick: after.tick };
          setHasCheckpoint(true);
          sound('checkpoint', 'rnCheckpoint');
          noteRef.current = { text: 'Checkpoint salvo', until: after.tick + 50 };
        }
        if (race) {
          if (after.status === 'finished' || rivalsRef.current.some(({ bot }) => bot.player.status === 'finished')) {
            finishRace();
            break;
          }
          if (after.status === 'dead' && before.status !== 'dead') {
            raceRef.current.deaths += 1;
            flashRef.current = 1;
            sound('death', 'rnDeath');
          }
          continue;
        }
        const status = after.status;
        if (status !== 'running') {
          flashRef.current = status === 'dead' ? 1 : 0;
          sound(status === 'dead' ? 'death' : 'win', status === 'dead' ? 'rnDeath' : 'rnWin');
          const result = { progress: progressOf(prepared.current, after), words: after.collected.length, finished: status === 'finished', clean: status === 'finished' && !usedCheckpointRef.current };
          setSummary({ progress: result.progress, words: result.words, total: prepared.current.wordCount });
          setPhaseBoth(status === 'dead' ? 'dead' : 'finished');
          if (!practice && !autopilot) onResultRef.current?.(result);
        }
      }
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.04);
      const player = playerRef.current;
      deadForRef.current = player.status === 'dead' ? deadForRef.current + 1 : 0;
      clockRef.current += 1;
      // Parado no lugar (antes da largada, esperando o toque ou pausado em pé): pose "Parado".
      const stopped = phaseRef.current === 'ready' || portraitRef.current;
      const left = noteRef.current ? noteRef.current.until - player.tick : 0;
      const note: Note | null = noteRef.current && left > 0 ? { text: noteRef.current.text, fade: Math.min(1, left / 15) } : null;
      const rivalViews: RivalView[] = rivalsRef.current.map(({ bot, spec }) => ({ name: spec.name, color: spec.color, sprites: spec.sprites, player: bot.player }));
      let rank: { position: number; total: number } | null = null;
      if (race) {
        const mine = progressOf(prepared.current, player);
        rank = { position: 1 + rivalViews.filter((rival) => progressOf(prepared.current, rival.player) > mine).length, total: rivalViews.length + 1 };
      }
      drawScene(ctx, prepared.current, player, canvas.width, canvas.height, { color, sprites, deadFor: Math.floor(deadForRef.current / 6), stopped, clock: clockRef.current, rivals: rivalViews, rank, flash: flashRef.current, note, dpr });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [autopilot, color, sprites, practice, race, setPhaseBoth, sound]);

  // Começa do zero ao abrir (e o piloto automático já começa correndo).
  useEffect(() => {
    restart();
  }, [restart]);

  const dead = phase === 'dead';
  const finished = phase === 'finished';
  const total = summary?.total ?? prepared.current.wordCount;
  const checkpointPercent = checkpointRef.current ? Math.floor(progressOf(prepared.current, respawnAt(prepared.current, checkpointRef.current.count)) * 100) : 0;
  const winner = standings?.[0];
  // Pose do personagem no resultado: vencendo (fase concluída ou corrida ganha) ou caindo.
  const overlayPose: Pose = finished && (!standings || winner?.isPlayer) ? 'win' : 'dead';
  const overlaySheet = sprites?.[overlayPose];

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Corrida: ${level.name}`} className="fixed inset-0 z-[60] flex flex-col bg-black">
      <div className="relative min-h-0 flex-1 select-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="Área do jogo" />
        <button type="button" onClick={onExit} aria-label="Sair da fase" className="absolute left-[max(0.5rem,env(safe-area-inset-left))] top-[max(0.5rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-2xl bg-black/50 text-white transition hover:bg-black/70">
          <CloseRoundedIcon />
        </button>
        {portrait ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center text-white">
            <ScreenRotationRoundedIcon sx={{ fontSize: 64 }} />
            <p className="font-display text-xl font-bold">Gire o celular para jogar na horizontal</p>
            <p className="text-sm font-semibold text-white/70">A Corrida usa a tela deitada para mostrar mais do caminho.</p>
            <Button variant="secondary" onClick={onExit}>
              Sair
            </Button>
          </div>
        ) : null}
        {phase === 'ready' && !portrait ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[18%] flex justify-center px-6">
            <p className="rounded-2xl bg-black/60 px-5 py-3 text-center font-display text-lg font-bold text-white">
              {playerRef.current.tick > 0 ? 'Toque na tela para continuar' : race ? 'Toque na tela para largar' : 'Toque na tela para começar'}
            </p>
          </div>
        ) : null}
        {(dead || finished) && !portrait ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-5">
            <div className="panel w-full max-w-md space-y-4 p-5 text-center">
              {overlaySheet ? <SpriteView url={overlaySheet.url} frames={overlaySheet.frames} size={96} className="mx-auto" /> : null}
              {standings ? (
                <>
                  <h3 className="font-display text-2xl font-bold text-ink">{winner?.isPlayer ? 'Você venceu a corrida!' : `${winner?.name} chegou primeiro`}</h3>
                  <ol className="space-y-1.5 text-left">
                    {standings.map((racer, index) => (
                      <li key={`${racer.name}-${index}`} className="flex items-center gap-2 rounded-xl bg-surface-3 px-3 py-2">
                        <span className="w-6 font-display text-lg font-bold text-muted">{index + 1}º</span>
                        <span className="h-4 w-4 shrink-0 rounded" style={{ background: racer.color }} aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-display font-bold text-ink">{racer.name}</span>
                        <span className="text-sm font-semibold text-muted">
                          {racer.finished ? `chegou em ${formatTime(racer.ticks)}` : `${Math.floor(racer.progress * 100)}%`}
                          {racer.deaths > 0 ? ` · ${racer.deaths} ${racer.deaths === 1 ? 'queda' : 'quedas'}` : ''}
                        </span>
                      </li>
                    ))}
                  </ol>
                </>
              ) : (
                <>
                  <h3 className="font-display text-2xl font-bold text-ink">{finished ? (practice ? 'Treino concluído!' : 'Fase concluída!') : 'Quase lá!'}</h3>
                  <p className="text-sm font-semibold text-muted">
                    {finished
                      ? `Você pegou ${summary?.words ?? 0} de ${total} palavras do versículo${level.verse ? ` (${level.verse.ref})` : ''}${usedCheckpointRef.current ? '.' : ' e não usou nenhum checkpoint!'}`
                      : `Você parou em ${Math.floor((summary?.progress ?? 0) * 100)}% e pegou ${summary?.words ?? 0} de ${total} palavras.${hasCheckpoint ? ` Seu último checkpoint está em ${checkpointPercent}%.` : ''}`}
                  </p>
                </>
              )}
              <div className="flex flex-col gap-2">
                {dead && hasCheckpoint ? (
                  <Button onClick={() => restart(true)} size="lg" className="w-full whitespace-nowrap">
                    Voltar ao último checkpoint ({checkpointPercent}%)
                  </Button>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => restart()} size="lg" variant={dead && hasCheckpoint ? 'secondary' : 'primary'} className="whitespace-nowrap">
                    {autopilot ? 'Ver de novo' : race ? 'Correr de novo' : finished ? 'Jogar de novo' : hasCheckpoint ? 'Do início' : 'Tentar de novo'}
                  </Button>
                  <Button onClick={onExit} variant="ghost" size="lg">
                    Sair
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
