import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ScreenRotationRoundedIcon from '@mui/icons-material/ScreenRotationRounded';
import { Button } from '@/components/ui/button';
import { unlockAudio } from '@/lib/sound/context';
import { playSfx } from '@/lib/sound/sfx';
import { newPlayer, prepareLevel, progressOf, stepPlayer } from '@runner/engine';
import { CEIL_Y, FLOOR_Y, PLAYER, SPEED, TICKS_PER_SECOND, TILE, type Form, type Level, type PlayerState, type PreparedLevel } from '@runner/types';

/** Altura do mundo em px (7 linhas do campo + 40 de teto + 40 de chão); a tela só escala. */
const WORLD_H = FLOOR_Y + 40;
/** O personagem fica a 28% da largura da tela. */
const CAMERA_AT = 0.28;
/** Zoom da câmera (menor = personagem menor e mapa mais amplo; sobra céu e chão nas bordas). Pensado para a tela deitada e para várias corredores no multijogador. */
const ZOOM = 0.95;
const STEP_MS = 1000 / TICKS_PER_SECOND;

const FORM_LABEL: Record<Form, string> = { RUN: 'Corrida · toque para pular, toque de novo no ar: pulo duplo', FLY: 'Voo · segure para subir, solte para descer', GRAVITY: 'Gravidade · toque para inverter' };
const FORM_COLOR: Record<Form, string> = { RUN: '#38bdf8', FLY: '#f59e0b', GRAVITY: '#a78bfa' };

type Phase = 'ready' | 'playing' | 'dead' | 'finished';
type Summary = { progress: number; words: number; total: number };

/** Desenho da cena com formas simples (a arte entra depois). Cores fixas: é a "arte" do jogo, igual nos dois temas. */
function draw(ctx: CanvasRenderingContext2D, level: PreparedLevel, p: PlayerState, width: number, height: number, flash: number, note: { text: string; fade: number } | null, dpr: number) {
  const scale = (height / WORLD_H) * ZOOM;
  const viewW = width / scale;
  // Sobra de céu e chão acima e abaixo do campo: o campo fica centralizado.
  const margin = (height / scale - WORLD_H) / 2;
  const camX = p.x - viewW * CAMERA_AT;
  const accent = FORM_COLOR[p.form];
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.scale(scale, scale);
  ctx.translate(0, margin);

  const sky = ctx.createLinearGradient(0, -margin, 0, WORLD_H + margin);
  sky.addColorStop(0, '#0f172a');
  sky.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, -margin, viewW, WORLD_H + margin * 2);

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
  ctx.fillRect(0, -margin, viewW, CEIL_Y + margin);
  ctx.fillRect(0, FLOOR_Y, viewW, WORLD_H - FLOOR_Y + margin);
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
    } else if (object.kind === 'checkpoint') {
      // Bandeira: cinza até passar, verde depois.
      const reached = p.x + PLAYER / 2 >= objectX;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(objectX + TILE / 2 - 2, FLOOR_Y - 56, 4, 56);
      ctx.fillStyle = reached ? '#22c55e' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(objectX + TILE / 2 + 2, FLOOR_Y - 56);
      ctx.lineTo(objectX + TILE / 2 + 30, FLOOR_Y - 45);
      ctx.lineTo(objectX + TILE / 2 + 2, FLOOR_Y - 34);
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

  // Painel: porcentagem, barra com as bandeiras, tempo que falta, forma atual e versículo. Tamanhos em px de tela (× dpr).
  const u = dpr;
  const progress = progressOf(level, p);
  const hudLeft = 64 * u;
  const hudRight = width - 16 * u;
  const pctWidth = 66 * u;
  const timeWidth = 96 * u;
  const barX = hudLeft + pctWidth;
  const barW = Math.max(40 * u, hudRight - timeWidth - barX);
  const barY = 9 * u;
  const barH = 15 * u;
  // O painel cabe nas faixas de cima e de baixo do campo, em qualquer altura de tela.
  const ceilScreenY = (margin + CEIL_Y) * scale;
  const bandH = height - (margin + FLOOR_Y) * scale;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `800 ${24 * u}px system-ui, sans-serif`;
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.fillStyle = accent;
  const percentText = `${Math.floor(progress * 100)}%`;
  ctx.strokeText(percentText, hudLeft, barY + barH / 2);
  ctx.fillText(percentText, hudLeft, barY + barH / 2);
  // Barra.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barH / 2);
  ctx.fill();
  if (progress > 0) {
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(barH, barW * progress), barH, barH / 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2 * u;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, barH / 2);
  ctx.stroke();
  // Marcas dos checkpoints na barra (amarelas até passar, verdes depois).
  for (const at of level.checkpoints) {
    const markX = barX + barW * (at / level.endX);
    ctx.fillStyle = p.x + PLAYER / 2 >= at ? '#22c55e' : '#fde047';
    ctx.fillRect(markX - 1.5 * u, barY - 3 * u, 3 * u, barH + 6 * u);
  }
  // Tempo que falta.
  const remaining = Math.max(0, Math.ceil((level.endX - p.x) / (SPEED * TICKS_PER_SECOND)));
  ctx.textAlign = 'right';
  ctx.font = `700 ${15 * u}px system-ui, sans-serif`;
  ctx.fillStyle = '#fff';
  ctx.strokeText(`faltam ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`, hudRight, barY + barH / 2);
  ctx.fillText(`faltam ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`, hudRight, barY + barH / 2);
  // Forma atual.
  ctx.textAlign = 'center';
  ctx.font = `700 ${13 * u}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  const labelY = Math.min(barY + barH + 14 * u, ceilScreenY - 9 * u);
  ctx.strokeText(FORM_LABEL[p.form], width / 2, labelY);
  ctx.fillText(FORM_LABEL[p.form], width / 2, labelY);
  // Aviso curto (checkpoint salvo): cápsula que some rápido.
  if (note) {
    ctx.save();
    ctx.globalAlpha = note.fade;
    ctx.font = `800 ${16 * u}px system-ui, sans-serif`;
    const w = ctx.measureText(note.text).width + 28 * u;
    const h = 30 * u;
    const y = Math.max(barY + barH + 36 * u, ceilScreenY + 10 * u);
    ctx.fillStyle = 'rgba(21,128,61,0.92)';
    ctx.beginPath();
    ctx.roundRect((width - w) / 2, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(note.text, width / 2, y + h / 2 + u);
    ctx.restore();
  }
  // Versículo escondido: palavras coletadas em amarelo, as que faltam em "___". Cresce até caber na largura.
  const verse = level.level.verse;
  if (verse) {
    const tokens = verse.words.map((word, index) => ({ text: p.collected.includes(index) ? word : '___', got: p.collected.includes(index) }));
    // Altura do quadro: cabe na faixa do chão (sem invadir o campo); a letra cresce até caber na largura e nessa altura.
    let size = Math.min(24 * u, (bandH - 8 * u) / 1.7);
    const maxW = width * 0.94 - 32 * u;
    const measure = () => {
      ctx.font = `800 ${size}px system-ui, sans-serif`;
      return tokens.reduce((sum, token) => sum + ctx.measureText(`${token.text} `).width, 0) - ctx.measureText(' ').width;
    };
    while (measure() > maxW && size > 13 * u) size -= u;
    const total = measure();
    const boxW = Math.min(width * 0.96, total + 32 * u);
    const boxH = size * 1.7;
    const boxY = height - boxH - Math.max(4 * u, (bandH - boxH) / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.beginPath();
    ctx.roundRect((width - boxW) / 2, boxY, boxW, boxH, boxH / 2);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let cursorX = (width - total) / 2;
    for (const token of tokens) {
      ctx.fillStyle = token.got ? '#facc15' : 'rgba(255,255,255,0.5)';
      ctx.fillText(token.text, cursorX, boxY + boxH / 2 + u);
      cursorX += ctx.measureText(`${token.text} `).width;
    }
    ctx.textAlign = 'center';
  }
  if (flash > 0) {
    ctx.fillStyle = `rgba(239,68,68,${flash * 0.45})`;
    ctx.fillRect(0, 0, width, height);
  }
}

/**
 * Tela da partida em tela cheia. Passo fixo de 60 por segundo (o mesmo motor que o servidor repete para conferir).
 * `replay` (lista de toques de um bot) faz a tela só assistir, sem aceitar toque.
 */
export type CorridaResult = { progress: number; words: number; finished: boolean; /** Concluída sem voltar a nenhum checkpoint. */ clean: boolean };

/**
 * Todo checkpoint (bandeira) salva o ponto e, ao cair, dá para voltar a ele. `practice` = treino: não conta para o melhor resultado.
 * Fora do treino e do replay, o resultado da partida vai para `onResult` (`clean` = concluída sem voltar a nenhum checkpoint).
 */
export function CorridaGame({ level, replay, practice = false, onResult, onExit }: { level: Level; replay?: number[]; practice?: boolean; onResult?: (result: CorridaResult) => void; onExit: () => void }) {
  const prepared = useRef<PreparedLevel>(prepareLevel(level));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const holdRef = useRef(false);
  const playerRef = useRef<PlayerState>(newPlayer(prepared.current));
  const phaseRef = useRef<Phase>('ready');
  const flashRef = useRef(0);
  const replayRef = useRef({ next: 0, held: false });
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const checkpointRef = useRef<PlayerState | null>(null);
  const usedCheckpointRef = useRef(false);
  const noteRef = useRef<{ text: string; until: number } | null>(null);
  const [hasCheckpoint, setHasCheckpoint] = useState(false);
  const [phase, setPhase] = useState<Phase>('ready');
  const [summary, setSummary] = useState<Summary | null>(null);
  // O jogo é só para a tela deitada: em pé, pausa e pede para girar o celular.
  const portraitRef = useRef(false);
  const [portrait, setPortrait] = useState(false);
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

  const restart = useCallback(
    (fromCheckpoint = false) => {
      const saved = fromCheckpoint ? checkpointRef.current : null;
      usedCheckpointRef.current = saved !== null;
      noteRef.current = null;
      playerRef.current = saved ? { ...saved, status: 'running', cause: null, held: false } : newPlayer(prepared.current);
      if (!saved) {
        checkpointRef.current = null;
        setHasCheckpoint(false);
      }
      holdRef.current = false;
      flashRef.current = 0;
      replayRef.current = { next: 0, held: false };
      setSummary(null);
      setPhaseBoth(replay ? 'playing' : 'ready');
    },
    [replay, setPhaseBoth],
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
    if (replay) return undefined;
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
  }, [onExit, replay, setPhaseBoth]);

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

    const frame = (now: number) => {
      acc = Math.min(acc + (now - last), STEP_MS * 5);
      last = now;
      while (acc >= STEP_MS) {
        acc -= STEP_MS;
        if (phaseRef.current !== 'playing' || portraitRef.current) continue;
        let held = holdRef.current;
        if (replay) {
          const state = replayRef.current;
          while (state.next < replay.length && replay[state.next] <= playerRef.current.tick) {
            state.held = !state.held;
            state.next += 1;
          }
          held = state.held;
        }
        const before = playerRef.current;
        const after = stepPlayer(prepared.current, before, held);
        playerRef.current = after;
        // Sons dos acontecimentos deste passo.
        if (after.airJumps < before.airJumps) playSfx('rnDouble');
        else if (before.grounded && after.form === 'RUN' && after.vy < -4) playSfx('rnJump');
        if (after.collected.length > before.collected.length) playSfx('rnWord');
        if (after.grav !== before.grav) playSfx('rnFlip');
        if (after.portal > before.portal) playSfx('rnPortal');
        if (after.checkpoint > before.checkpoint && !replay) {
          checkpointRef.current = after;
          setHasCheckpoint(true);
          playSfx('rnCheckpoint');
          noteRef.current = { text: 'Checkpoint salvo', until: after.tick + 50 };
        }
        const status = after.status;
        if (status !== 'running') {
          flashRef.current = status === 'dead' ? 1 : 0;
          playSfx(status === 'dead' ? 'rnDeath' : 'rnWin');
          const result = { progress: progressOf(prepared.current, after), words: after.collected.length, finished: status === 'finished', clean: status === 'finished' && !usedCheckpointRef.current };
          setSummary({ progress: result.progress, words: result.words, total: prepared.current.wordCount });
          setPhaseBoth(status === 'dead' ? 'dead' : 'finished');
          if (!practice && !replay) onResultRef.current?.(result);
        }
      }
      if (flashRef.current > 0) flashRef.current = Math.max(0, flashRef.current - 0.04);
      const left = noteRef.current ? noteRef.current.until - playerRef.current.tick : 0;
      const note = noteRef.current && left > 0 ? { text: noteRef.current.text, fade: Math.min(1, left / 15) } : null;
      draw(ctx, prepared.current, playerRef.current, canvas.width, canvas.height, flashRef.current, note, dpr);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [practice, replay, setPhaseBoth]);

  // Começa do zero ao abrir (e o replay de bot já começa rodando).
  useEffect(() => {
    restart();
  }, [restart]);

  const checkpointPercent = checkpointRef.current ? Math.floor(progressOf(prepared.current, checkpointRef.current) * 100) : 0;

  const dead = phase === 'dead';
  const finished = phase === 'finished';
  const total = summary?.total ?? prepared.current.wordCount;

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
            <p className="rounded-2xl bg-black/60 px-5 py-3 text-center font-display text-lg font-bold text-white">{playerRef.current.tick > 0 ? 'Toque na tela para continuar' : 'Toque na tela para começar'}</p>
          </div>
        ) : null}
        {(dead || finished) && !portrait ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 px-5">
            <div className="panel w-full max-w-md space-y-4 p-5 text-center">
              <h3 className="font-display text-2xl font-bold text-ink">{finished ? (practice ? 'Treino concluído!' : 'Fase concluída!') : 'Quase lá!'}</h3>
              <p className="text-sm font-semibold text-muted">
                {finished
                  ? `Você pegou ${summary?.words ?? 0} de ${total} palavras do versículo${level.verse ? ` (${level.verse.ref})` : ''}${usedCheckpointRef.current ? '.' : ' e não usou nenhum checkpoint!'}`
                  : `Você parou em ${Math.floor((summary?.progress ?? 0) * 100)}% e pegou ${summary?.words ?? 0} de ${total} palavras.${hasCheckpoint ? ` Seu último checkpoint está em ${checkpointPercent}%.` : ''}`}
              </p>
              <div className="flex flex-col gap-2">
                {dead && hasCheckpoint ? (
                  <Button onClick={() => restart(true)} size="lg" className="w-full whitespace-nowrap">
                    Voltar ao último checkpoint ({checkpointPercent}%)
                  </Button>
                ) : null}
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => restart()} size="lg" variant={dead && hasCheckpoint ? 'secondary' : 'primary'} className="whitespace-nowrap">
                    {replay ? 'Ver de novo' : finished ? 'Jogar de novo' : hasCheckpoint ? 'Do início' : 'Tentar de novo'}
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
