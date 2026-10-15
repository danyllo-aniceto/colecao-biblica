import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Button } from '@/components/ui/button';
import { newPlayer, prepareLevel, progressOf, stepPlayer } from '@runner/engine';
import { CEIL_Y, FLOOR_Y, PLAYER, TICKS_PER_SECOND, TILE, type Form, type Level, type PlayerState, type PreparedLevel } from '@runner/types';

/** Altura do mundo em px (7 linhas do campo + 40 de teto + 40 de chão); a tela só escala. */
const WORLD_H = FLOOR_Y + 40;
/** O personagem fica a 28% da largura da tela. */
const CAMERA_AT = 0.28;
const STEP_MS = 1000 / TICKS_PER_SECOND;

const FORM_LABEL: Record<Form, string> = { RUN: 'Corrida: toque para pular', FLY: 'Voo: segure para subir', GRAVITY: 'Gravidade: toque para inverter' };
const FORM_COLOR: Record<Form, string> = { RUN: '#38bdf8', FLY: '#f59e0b', GRAVITY: '#a78bfa' };

type Phase = 'ready' | 'playing' | 'dead' | 'finished';
type Summary = { progress: number; words: number; total: number };

/** Desenho da cena com formas simples (a arte entra depois). Cores fixas: é a "arte" do jogo, igual nos dois temas. */
function draw(ctx: CanvasRenderingContext2D, level: PreparedLevel, p: PlayerState, width: number, height: number, flash: number) {
  const scale = height / WORLD_H;
  const viewW = width / scale;
  const camX = p.x - viewW * CAMERA_AT;
  const accent = FORM_COLOR[p.form];
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.scale(scale, scale);

  const sky = ctx.createLinearGradient(0, 0, 0, WORLD_H);
  sky.addColorStop(0, '#0f172a');
  sky.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, viewW, WORLD_H);

  // Morros distantes (paralaxe lenta).
  ctx.fillStyle = 'rgba(148,163,184,0.12)';
  const shift = -((camX * 0.25) % 360);
  for (let x = shift - 360; x < viewW + 360; x += 360) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y);
    ctx.quadraticCurveTo(x + 180, FLOOR_Y - 190, x + 360, FLOOR_Y);
    ctx.fill();
  }

  // Grade do campo, para sentir a velocidade.
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let x = -(camX % TILE); x < viewW; x += TILE) {
    ctx.beginPath();
    ctx.moveTo(x, CEIL_Y);
    ctx.lineTo(x, FLOOR_Y);
    ctx.stroke();
  }

  // Teto e chão.
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, viewW, CEIL_Y);
  ctx.fillRect(0, FLOOR_Y, viewW, WORLD_H - FLOOR_Y);
  ctx.fillStyle = accent;
  ctx.fillRect(0, CEIL_Y - 3, viewW, 3);
  ctx.fillRect(0, FLOOR_Y, viewW, 3);

  const left = camX - TILE * 2;
  const right = camX + viewW + TILE * 2;
  ctx.translate(-camX, 0);
  for (const object of level.level.objects) {
    const objectX = object.x * TILE;
    if (objectX < left - TILE * 12 || objectX > right) continue;
    if (object.kind === 'block') {
      const top = FLOOR_Y - (object.y + object.h) * TILE;
      ctx.fillStyle = '#7c4a21';
      ctx.fillRect(objectX, top, object.w * TILE, object.h * TILE);
      ctx.strokeStyle = '#d6a15f';
      ctx.lineWidth = 3;
      ctx.strokeRect(objectX + 1.5, top + 1.5, object.w * TILE - 3, object.h * TILE - 3);
    } else if (object.kind === 'spike') {
      const row = object.y ?? 0;
      const cellTop = FLOOR_Y - (row + 1) * TILE;
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      if (object.down) {
        ctx.moveTo(objectX + 4, cellTop);
        ctx.lineTo(objectX + TILE - 4, cellTop);
        ctx.lineTo(objectX + TILE / 2, cellTop + TILE - 4);
      } else {
        ctx.moveTo(objectX + 4, cellTop + TILE);
        ctx.lineTo(objectX + TILE - 4, cellTop + TILE);
        ctx.lineTo(objectX + TILE / 2, cellTop + 4);
      }
      ctx.closePath();
      ctx.fill();
    } else if (object.kind === 'portal') {
      ctx.fillStyle = FORM_COLOR[object.form];
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(p.tick / 8);
      ctx.fillRect(objectX, CEIL_Y, TILE * 0.6, FLOOR_Y - CEIL_Y);
      ctx.globalAlpha = 1;
      ctx.fillRect(objectX + TILE * 0.2, CEIL_Y, 4, FLOOR_Y - CEIL_Y);
    } else if (object.kind === 'word' && !p.collected.includes(object.index)) {
      const cx = objectX + TILE / 2;
      const cy = FLOOR_Y - (object.y + 0.5) * TILE + Math.sin((p.tick + object.index * 9) / 10) * 3;
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#713f12';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(object.index + 1), cx, cy + 1);
    }
  }
  // Linha de chegada.
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(level.endX, CEIL_Y, 8, FLOOR_Y - CEIL_Y);

  // Personagem.
  ctx.save();
  ctx.translate(p.x + PLAYER / 2, p.y + PLAYER / 2);
  if (p.form === 'RUN') ctx.rotate(p.grounded ? Math.round((p.tick * 0.18) / (Math.PI / 2)) * (Math.PI / 2) : p.tick * 0.18);
  if (p.form === 'FLY') ctx.rotate(Math.max(-0.5, Math.min(0.5, p.vy * 0.07)));
  if (p.form === 'GRAVITY' && p.grav === -1) ctx.scale(1, -1);
  ctx.fillStyle = p.status === 'dead' ? '#ef4444' : accent;
  if (p.form === 'FLY') {
    ctx.beginPath();
    ctx.moveTo(-PLAYER / 2, -PLAYER / 2);
    ctx.lineTo(PLAYER / 2, 0);
    ctx.lineTo(-PLAYER / 2, PLAYER / 2);
    ctx.closePath();
    ctx.fill();
  } else if (p.form === 'GRAVITY') {
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(4, -9, 5, 7);
  } else {
    ctx.fillRect(-PLAYER / 2, -PLAYER / 2, PLAYER, PLAYER);
    ctx.fillStyle = '#fff';
    ctx.fillRect(2, -9, 7, 8);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(6, -7, 3, 5);
  }
  ctx.restore();
  ctx.restore();

  // Barra de progresso e forma atual.
  const progress = progressOf(level, p);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(width * 0.1, 7, width * 0.8, 8);
  ctx.fillStyle = accent;
  ctx.fillRect(width * 0.1, 7, width * 0.8 * progress, 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`${Math.floor(progress * 100)}%  ·  ${FORM_LABEL[p.form]}`, width / 2, 20);
  if (flash > 0) {
    ctx.fillStyle = `rgba(239,68,68,${flash * 0.45})`;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Tela da partida em tela cheia. Passo fixo de 60 por segundo (o mesmo motor que o servidor repete para conferir).
 * `replay` (lista de toques de um bot) faz a tela só assistir, sem aceitar toque.
 */
export function CorridaGame({ level, replay, onExit }: { level: Level; replay?: number[]; onExit: () => void }) {
  const prepared = useRef<PreparedLevel>(prepareLevel(level));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holdRef = useRef(false);
  const playerRef = useRef<PlayerState>(newPlayer(prepared.current));
  const phaseRef = useRef<Phase>('ready');
  const flashRef = useRef(0);
  const replayRef = useRef({ next: 0, held: false });
  const [phase, setPhase] = useState<Phase>('ready');
  const [summary, setSummary] = useState<Summary | null>(null);

  const setPhaseBoth = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const restart = useCallback(() => {
    playerRef.current = newPlayer(prepared.current);
    holdRef.current = false;
    flashRef.current = 0;
    replayRef.current = { next: 0, held: false };
    setSummary(null);
    setPhaseBoth(replay ? 'playing' : 'ready');
  }, [replay, setPhaseBoth]);

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
    if (replay) return undefined;
    const press = () => {
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
  }, [onExit, replay, setPhaseBoth]);

  // Laço do jogo: passo fixo com acumulador; desenha a cada quadro.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const box = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(box.width * ratio));
      canvas.height = Math.max(1, Math.round(box.height * ratio));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const frame = (now: number) => {
      acc = Math.min(acc + (now - last), STEP_MS * 5);
      last = now;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        if (phaseRef.current !== 'playing') continue;
        let held = holdRef.current;
        if (replay) {
          const state = replayRef.current;
          while (state.next < replay.length && replay[state.next] <= playerRef.current.tick) {
            state.held = !state.held;
            state.next += 1;
          }
          held = state.held;
        }
        playerRef.current = stepPlayer(prepared.current, playerRef.current, held);
        const status = playerRef.current.status;
        if (status !== 'running') {
          flashRef.current = status === 'dead' ? 1 : 0;
          setSummary({ progress: progressOf(prepared.current, playerRef.current), words: playerRef.current.collected.length, total: prepared.current.wordCount });
          setPhaseBoth(status === 'dead' ? 'dead' : 'finished');
        }
      }
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.04);
      draw(ctx, prepared.current, playerRef.current, canvas.width, canvas.height, flashRef.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [replay, setPhaseBoth]);

  // Começa do zero ao abrir (e o replay de bot já começa rodando).
  useEffect(() => {
    restart();
  }, [restart]);

  const dead = phase === 'dead';
  const finished = phase === 'finished';
  const total = summary?.total ?? prepared.current.wordCount;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Corrida: ${level.name}`} className="fixed inset-0 z-[60] flex flex-col bg-bg pt-[env(safe-area-inset-top)]">
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <button type="button" onClick={onExit} aria-label="Sair da fase" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
          <CloseRoundedIcon />
        </button>
        <p className="min-w-0 truncate font-display text-base font-bold text-ink">{level.name}</p>
        <span className="w-11" />
      </div>
      <div className="relative min-h-0 flex-1 select-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="Área do jogo" />
        {phase === 'ready' ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-[18%] flex justify-center px-6">
            <p className="rounded-2xl bg-black/60 px-5 py-3 text-center font-display text-lg font-bold text-white">Toque na tela para começar</p>
          </div>
        ) : null}
        {dead || finished ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-5">
            <div className="panel w-full max-w-sm space-y-4 p-5 text-center">
              <h3 className="font-display text-2xl font-bold text-ink">{finished ? 'Fase concluída!' : 'Quase lá!'}</h3>
              <p className="text-sm font-semibold text-muted">
                {finished
                  ? `Você pegou ${summary?.words ?? 0} de ${total} palavras do versículo.`
                  : `Você parou em ${Math.floor((summary?.progress ?? 0) * 100)}% e pegou ${summary?.words ?? 0} de ${total} palavras.`}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button onClick={restart} size="lg">
                  {replay ? 'Ver de novo' : 'Tentar de novo'}
                </Button>
                <Button onClick={onExit} variant="secondary" size="lg">
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
