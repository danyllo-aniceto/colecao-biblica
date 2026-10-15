import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ScreenRotationRoundedIcon from "@mui/icons-material/ScreenRotationRounded";
import { Button } from "@/components/ui/button";
import { unlockAudio } from "@/lib/sound/context";
import {
  playCharacterSound,
  preloadCharacterSounds,
} from "@/lib/sound/character-sfx";
import { useBoardMusic } from "@/lib/sound/board-music";
import { playSfx } from "@/lib/sound/sfx";
import type { SoundKey, Sounds, Sprites } from "@runner/characters";
import { BOT_RESPAWN_TICKS, createBot, type Bot } from "@runner/bots";
import {
  maxTicksOf,
  newPlayer,
  prepareLevel,
  progressOf,
  respawnAt,
  stepPlayer,
} from "@runner/engine";
import {
  cellAt,
  COUNTDOWN_TICKS,
  localLayout,
  LOCAL_KEYS,
  rankLocal,
  type LocalEntry,
} from "@runner/local";
import { TICKS_PER_SECOND, type Level, type PlayerState } from "@runner/types";
import { drawScene } from "@/components/user/corrida/corrida-draw";
import {
  preloadArt,
  preloadSprites,
} from "@/components/user/corrida/corrida-sprites";
import { SpriteView } from "@/components/user/corrida/sprite-view";

const STEP_MS = 1000 / TICKS_PER_SECOND;

/** Um jogador da partida no mesmo aparelho: humano toca na própria faixa; bot joga sozinho (`skill`/`lag` vêm de `BOT_LEVELS`). */
export type LocalPlayer = {
  name: string;
  color: string;
  sprites?: Sprites;
  sounds?: Sounds;
  human: boolean;
  skill: number;
  lag: number;
};

type Phase = "ready" | "countdown" | "playing" | "finished";
type Snapshot = {
  count: number;
  collected: number[];
  powers: number[];
  tick: number;
};
type Slot = {
  player: LocalPlayer;
  state: PlayerState;
  hold: boolean;
  ready: boolean;
  bot: Bot | null;
  checkpoint: Snapshot | null;
  deadFor: number;
  deaths: number;
  finishedAt: number | null;
  flash: number;
  /** Posição entre os humanos (tecla 1, 2, 3...). */
  humanIndex: number;
};

const formatTime = (ticks: number) => {
  const seconds = Math.round(ticks / TICKS_PER_SECOND);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function makeSlots(
  level: ReturnType<typeof prepareLevel>,
  players: LocalPlayer[],
): Slot[] {
  let humans = 0;
  return players.map((player, index) => {
    const bot = player.human
      ? null
      : createBot(level, {
          skill: player.skill,
          lag: player.lag,
          seed: Math.floor(Math.random() * 1e6) + index,
          phase: index * 3,
          respawn: true,
        });
    return {
      player,
      state: bot ? bot.player : newPlayer(level),
      hold: false,
      ready: !player.human,
      bot,
      checkpoint: null,
      deadFor: 0,
      deaths: 0,
      finishedAt: null,
      flash: 0,
      humanIndex: player.human ? humans++ : -1,
    };
  });
}

/**
 * Corrida no mesmo aparelho (2 a 4): a tela deitada é dividida em faixas, uma por jogador, cada uma com a mesma fase e o próprio personagem. Humanos tocam
 * na própria faixa (vários dedos ao mesmo tempo; no computador, as teclas 1 a 4); os bots completam as vagas. Cada um que cai volta sozinho ao seu último
 * checkpoint; vence quem cruzar a linha primeiro, e o placar mostra quem foi mais longe e as palavras. Nada do modo dá XP, moedas nem ranking.
 */
export function CorridaLocal({
  level,
  players,
  onExit,
}: {
  level: Level;
  players: LocalPlayer[];
  onExit: () => void;
}) {
  const prepared = useMemo(() => prepareLevel(level), [level]);
  const cells = useMemo(() => localLayout(players.length), [players.length]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const slotsRef = useRef<Slot[]>(makeSlots(prepared, players));
  const phaseRef = useRef<Phase>("ready");
  const ticksRef = useRef(0);
  const countdownRef = useRef(0);
  const portraitRef = useRef(false);
  const pointersRef = useRef(new Map<number, number>());
  const [portrait, setPortrait] = useState(false);
  const [standings, setStandings] = useState<LocalEntry[] | null>(null);

  useBoardMusic(level.music);
  useEffect(() => preloadArt(level.art), [level.art]);
  useEffect(() => {
    for (const player of players) {
      preloadSprites(player.sprites);
      preloadCharacterSounds(player.sounds);
    }
  }, [players]);

  const restart = useCallback(() => {
    slotsRef.current = makeSlots(prepared, players);
    phaseRef.current = "ready";
    ticksRef.current = 0;
    countdownRef.current = 0;
    pointersRef.current.clear();
    setStandings(null);
  }, [players, prepared]);

  // Só a tela deitada: em pé, pausa e pede para girar.
  useEffect(() => {
    const query = window.matchMedia("(orientation: portrait)");
    const sync = () => {
      portraitRef.current = query.matches;
      setPortrait(query.matches);
      if (query.matches) {
        for (const slot of slotsRef.current) slot.hold = false;
        pointersRef.current.clear();
      }
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  // Trava a rolagem da página por baixo do jogo.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Entrada: cada dedo vale para a faixa onde encostou (multitoque); teclado 1 a 4 para o computador.
  useEffect(() => {
    const canvas = canvasRef.current;
    const slotOfHuman = (humanIndex: number) =>
      slotsRef.current.find((slot) => slot.humanIndex === humanIndex);
    const press = (slot: Slot | undefined) => {
      if (!slot || portraitRef.current) return;
      unlockAudio();
      slot.hold = true;
      slot.ready = true;
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!canvas) return;
      event.preventDefault();
      const box = canvas.getBoundingClientRect();
      const index = cellAt(
        cells,
        (event.clientX - box.left) / box.width,
        (event.clientY - box.top) / box.height,
      );
      const slot = index >= 0 ? slotsRef.current[index] : undefined;
      if (!slot || !slot.player.human) return;
      pointersRef.current.set(event.pointerId, index);
      press(slot);
    };
    const release = (event: PointerEvent) => {
      const index = pointersRef.current.get(event.pointerId);
      if (index === undefined) return;
      pointersRef.current.delete(event.pointerId);
      // Outro dedo ainda na mesma faixa continua segurando.
      if (![...pointersRef.current.values()].includes(index))
        slotsRef.current[index].hold = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Escape") {
        onExit();
        return;
      }
      const humanIndex = LOCAL_KEYS.indexOf(
        event.code as (typeof LOCAL_KEYS)[number],
      );
      if (humanIndex < 0 || event.repeat) return;
      event.preventDefault();
      press(slotOfHuman(humanIndex));
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const humanIndex = LOCAL_KEYS.indexOf(
        event.code as (typeof LOCAL_KEYS)[number],
      );
      const slot = humanIndex >= 0 ? slotOfHuman(humanIndex) : undefined;
      if (slot) slot.hold = false;
    };
    canvas?.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      canvas?.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [cells, onExit]);

  // Laço do jogo: passo fixo com acumulador; cada faixa é desenhada com a câmera do seu jogador.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
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

    const finish = () => {
      phaseRef.current = "finished";
      const entries: LocalEntry[] = slotsRef.current.map((slot) => ({
        name: slot.player.name,
        color: slot.player.color,
        progress: progressOf(prepared, slot.state),
        finished: slot.state.status === "finished",
        ticks: slot.finishedAt ?? ticksRef.current,
        deaths: slot.bot ? slot.bot.deaths : slot.deaths,
        words: slot.state.collected.length,
        human: slot.player.human,
      }));
      const ranked = rankLocal(entries);
      setStandings(ranked);
      playSfx(ranked[0].human ? "rnWin" : "rnDeath");
    };

    const sound = (
      slot: Slot,
      key: SoundKey,
      fallback: Parameters<typeof playSfx>[0],
    ) => playCharacterSound(slot.player.sounds, key, fallback);

    /** Um passo de um humano: cai, espera um instante e volta sozinho ao último checkpoint. */
    const stepHuman = (slot: Slot) => {
      const before = slot.state;
      if (before.status === "dead") {
        slot.deadFor += 1;
        if (slot.deadFor >= BOT_RESPAWN_TICKS) {
          const saved = slot.checkpoint;
          slot.state = saved
            ? respawnAt(
                prepared,
                saved.count,
                saved.collected,
                before.tick,
                saved.powers,
              )
            : {
                ...newPlayer(prepared),
                collected: before.collected,
                powers: before.powers,
                tick: before.tick,
              };
          slot.deadFor = 0;
        }
        return;
      }
      const after = stepPlayer(prepared, before, slot.hold);
      slot.state = after;
      if (after.status !== "dead") {
        if (after.airJumps < before.airJumps) sound(slot, "double", "rnDouble");
        else if (before.grounded && after.form === "RUN" && after.vy < -4)
          sound(slot, "jump", "rnJump");
        if (after.collected.length > before.collected.length)
          sound(slot, "word", "rnWord");
        if (after.powers.length > before.powers.length) playSfx("rnPower");
        if (before.effects.shield > 0 && after.effects.shield === 0)
          playSfx("rnShield");
        if (after.grav !== before.grav) sound(slot, "flip", "rnFlip");
      }
      if (after.checkpoint > before.checkpoint && after.status === "running")
        slot.checkpoint = {
          count: after.checkpoint,
          collected: after.collected,
          powers: after.powers,
          tick: after.tick,
        };
      if (after.status === "dead") {
        slot.deaths += 1;
        slot.flash = 1;
        sound(slot, "death", "rnDeath");
      }
    };

    const frame = (now: number) => {
      acc = Math.min(acc + (now - last), STEP_MS * 5);
      last = now;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        if (portraitRef.current) continue;
        const slots = slotsRef.current;
        if (phaseRef.current === "ready") {
          if (slots.every((slot) => slot.ready)) {
            phaseRef.current = "countdown";
            countdownRef.current = COUNTDOWN_TICKS;
          }
        } else if (phaseRef.current === "countdown") {
          countdownRef.current -= 1;
          if (countdownRef.current <= 0) phaseRef.current = "playing";
        } else if (phaseRef.current === "playing") {
          ticksRef.current += 1;
          for (const slot of slots) {
            if (slot.finishedAt !== null) continue;
            if (slot.bot) {
              const botDead = slot.bot.player.status === "dead";
              slot.bot.step();
              slot.state = slot.bot.player;
              if (!botDead && slot.bot.player.status === "dead") slot.flash = 1;
            } else {
              stepHuman(slot);
            }
            if (slot.state.status === "finished")
              slot.finishedAt = ticksRef.current;
          }
          if (
            slots.some((slot) => slot.finishedAt !== null) ||
            ticksRef.current > maxTicksOf(prepared)
          ) {
            finish();
            break;
          }
        }
      }
      clock += 1;
      // Desenho: uma faixa por jogador.
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      slotsRef.current.forEach((slot, index) => {
        const cell = cells[index];
        const x = Math.round(cell.x * width);
        const y = Math.round(cell.y * height);
        const w = Math.round((cell.x + cell.w) * width) - x;
        const h = Math.round((cell.y + cell.h) * height) - y;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
        ctx.translate(x, y);
        drawScene(ctx, prepared, slot.state, w, h, {
          color: slot.player.color,
          sprites: slot.player.sprites,
          deadFor: Math.floor(slot.deadFor / 6),
          stopped: phaseRef.current !== "playing",
          clock,
          rivals: [],
          rank: null,
          flash: slot.flash,
          note: null,
          dpr,
          compact: { name: slot.player.name },
        });
        // Mensagens da largada, dentro da faixa.
        const message =
          phaseRef.current === "ready" && slot.player.human
            ? slot.ready
              ? "Pronto!"
              : "Toque aqui para entrar"
            : phaseRef.current === "countdown"
              ? String(
                  Math.max(
                    1,
                    Math.ceil(countdownRef.current / TICKS_PER_SECOND),
                  ),
                )
              : phaseRef.current === "playing" && ticksRef.current < 45
                ? "Já!"
                : null;
        if (message) {
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const big = phaseRef.current !== "ready";
          ctx.font = `800 ${(big ? 44 : 17) * dpr}px system-ui, sans-serif`;
          ctx.lineWidth = 5 * dpr;
          ctx.strokeStyle = "rgba(0,0,0,0.7)";
          ctx.fillStyle =
            slot.ready || phaseRef.current !== "ready" ? "#fde047" : "#fff";
          ctx.strokeText(message, w / 2, h * (big ? 0.5 : 0.55));
          ctx.fillText(message, w / 2, h * (big ? 0.5 : 0.55));
        }
        ctx.restore();
        slot.flash = Math.max(0, slot.flash - 0.04);
      });
      // Divisórias entre as faixas.
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      for (const cell of cells) {
        if (cell.y > 0)
          ctx.fillRect(0, Math.round(cell.y * height) - dpr, width, 2 * dpr);
        if (cell.x > 0)
          ctx.fillRect(
            Math.round(cell.x * width) - dpr,
            Math.round(cell.y * height),
            2 * dpr,
            Math.round(cell.h * height),
          );
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [cells, prepared]);

  const winner = standings?.[0];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Corrida no mesmo aparelho: ${level.name}`}
      className="fixed inset-0 z-[60] flex flex-col bg-black"
    >
      <div className="relative min-h-0 flex-1 select-none">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label="Área do jogo: uma faixa para cada jogador"
        />
        {standings ? null : (
          <button
            type="button"
            onClick={onExit}
            aria-label="Sair da corrida"
            className="absolute left-1/2 top-[max(0.25rem,env(safe-area-inset-top))] z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-2xl bg-black/50 text-white transition hover:bg-black/70"
          >
            <CloseRoundedIcon />
          </button>
        )}
        {portrait ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/85 px-8 text-center text-white">
            <ScreenRotationRoundedIcon sx={{ fontSize: 64 }} />
            <p className="font-display text-xl font-bold">
              Gire o celular para jogar na horizontal
            </p>
            <p className="text-sm font-semibold text-white/70">
              Cada jogador toca na sua faixa da tela.
            </p>
            <Button variant="secondary" onClick={onExit}>
              Sair
            </Button>
          </div>
        ) : null}
        {standings && !portrait ? (
          <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/50 p-3">
            <div className="panel max-h-full w-full max-w-md space-y-3 overflow-y-auto p-4 text-center">
              <h3 className="font-display text-xl font-bold text-ink sm:text-2xl">
                {winner?.finished
                  ? `${winner.name} chegou primeiro!`
                  : "Fim da corrida"}
              </h3>
              <ol className="space-y-1.5 text-left">
                {standings.map((racer, index) => (
                  <li
                    key={`${racer.name}-${index}`}
                    className="flex items-center gap-2 rounded-xl bg-surface-3 px-3 py-1.5"
                  >
                    <span className="w-6 font-display text-lg font-bold text-muted">
                      {index + 1}º
                    </span>
                    <span
                      className="h-4 w-4 shrink-0 rounded"
                      style={{ background: racer.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate font-display font-bold text-ink">
                      {racer.name}
                      {racer.human ? "" : " (bot)"}
                    </span>
                    <span className="text-right text-xs font-semibold text-muted">
                      {racer.finished
                        ? `chegou em ${formatTime(racer.ticks)}`
                        : `${Math.floor(racer.progress * 100)}%`}
                      <br />
                      {racer.words} {racer.words === 1 ? "palavra" : "palavras"}
                      {racer.deaths > 0
                        ? ` · ${racer.deaths} ${racer.deaths === 1 ? "queda" : "quedas"}`
                        : ""}
                    </span>
                  </li>
                ))}
              </ol>
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" onClick={restart}>
                  Revanche
                </Button>
                <Button size="lg" variant="ghost" onClick={onExit}>
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

/** Miniatura do personagem para as listas de vagas. */
export function PlayerChip({
  name,
  color,
  sprites,
  suffix,
}: {
  name: string;
  color: string;
  sprites?: Sprites;
  suffix?: string;
}) {
  const portrait = sprites?.portrait ?? sprites?.idle ?? sprites?.run;
  return (
    <span className="flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-sm font-semibold text-ink">
      <SpriteView
        url={portrait?.url}
        frames={portrait?.frames}
        fps={8}
        color={color}
        size={22}
      />
      {name}
      {suffix ? <span className="text-muted">{suffix}</span> : null}
    </span>
  );
}
