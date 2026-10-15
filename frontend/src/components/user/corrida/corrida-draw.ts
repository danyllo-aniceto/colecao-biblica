import { frameFor, poseFor, type Sprites } from '@runner/characters';
import { progressOf } from '@runner/engine';
import { spriteImage } from '@/components/user/corrida/corrida-sprites';
import { CEIL_Y, FLOOR_Y, PLAYER, SPEED, TICKS_PER_SECOND, TILE, type Form, type PlayerState, type PreparedLevel } from '@runner/types';

/** Altura do mundo em px (7 linhas do campo + 40 de teto + 40 de chão); a tela só escala. */
export const WORLD_H = FLOOR_Y + 40;
/** O personagem fica a 28% da largura da tela. */
const CAMERA_AT = 0.28;
/** Zoom da câmera (menor = personagem menor e mapa mais amplo; sobra céu e chão nas bordas). Pensado para a tela deitada e para várias corredoras. */
const ZOOM = 0.95;

export const FORM_LABEL: Record<Form, string> = {
  RUN: 'Corrida · toque para pular, toque de novo no ar: pulo duplo',
  FLY: 'Voo · segure para subir, solte para descer',
  GRAVITY: 'Gravidade · toque para inverter',
};
export const FORM_COLOR: Record<Form, string> = { RUN: '#38bdf8', FLY: '#f59e0b', GRAVITY: '#a78bfa' };

/** Um rival na tela (corrida contra bots): nome, cor e onde está. */
export type RivalView = { name: string; color: string; player: PlayerState; sprites?: Sprites };
export type Note = { text: string; fade: number };

export type SceneOptions = {
  /** Cor do corpo do personagem do jogador (usada quando falta o sprite da pose). */
  color: string;
  /** Sprites do personagem do jogador, por pose. */
  sprites?: Sprites;
  /** Quadros de animação desde que o jogador caiu (a pose "caindo" toca uma vez). */
  deadFor: number;
  rivals: RivalView[];
  /** Posição do jogador na corrida (1 = na frente), só quando há rivais. */
  rank: { position: number; total: number } | null;
  flash: number;
  note: Note | null;
  /** Densidade da tela (o painel é desenhado em px de tela). */
  dpr: number;
};

/** Altura (px do mundo) com que o sprite é desenhado: um pouco maior que a caixa de colisão (32), com os pés alinhados nela. */
const SPRITE_SIZE = 48;

/** Desenha a pose do personagem (quadro certo da tira). Devolve `false` se ainda não há imagem (o corredor cai para a forma colorida). */
function drawSprite(ctx: CanvasRenderingContext2D, p: PlayerState, sprites: Sprites | undefined, alpha: number, deadFor: number): boolean {
  const pose = poseFor(p);
  const sheet = sprites?.[pose];
  const image = sheet ? spriteImage(sheet.url) : null;
  if (!sheet || !image) return false;
  const frameW = image.width / sheet.frames;
  const frame = frameFor(pose, sheet.frames, pose === 'dead' ? deadFor : p.tick);
  const width = (SPRITE_SIZE * frameW) / image.height;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x + PLAYER / 2, p.y + PLAYER / 2);
  if (p.form === 'FLY') ctx.rotate(Math.max(-0.4, Math.min(0.4, p.vy * 0.06)));
  if (p.form === 'GRAVITY' && p.grav === -1) ctx.scale(1, -1);
  // Pés na base da caixa de colisão; a cabeça passa um pouco por cima.
  ctx.drawImage(image, frame * frameW, 0, frameW, image.height, -width / 2, PLAYER / 2 - SPRITE_SIZE, width, SPRITE_SIZE);
  ctx.restore();
  return true;
}

/** Corpo do corredor: o sprite da pose, se o personagem tiver; senão quadrado que gira (Corrida), flecha (Voo) ou bola (Gravidade) na cor dele. Vermelho ao cair. */
function drawRunner(ctx: CanvasRenderingContext2D, p: PlayerState, color: string, alpha: number, sprites?: Sprites, deadFor = 0) {
  if (drawSprite(ctx, p, sprites, alpha, deadFor)) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(p.x + PLAYER / 2, p.y + PLAYER / 2);
  if (p.form === 'RUN') ctx.rotate(p.grounded ? Math.round((p.tick * 0.18) / (Math.PI / 2)) * (Math.PI / 2) : p.tick * 0.18);
  if (p.form === 'FLY') ctx.rotate(Math.max(-0.5, Math.min(0.5, p.vy * 0.07)));
  if (p.form === 'GRAVITY' && p.grav === -1) ctx.scale(1, -1);
  ctx.fillStyle = p.status === 'dead' ? '#ef4444' : color;
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
}

/** Desenho da cena com formas simples (a arte entra depois). Cores fixas: é a "arte" do jogo, igual nos dois temas. */
export function drawScene(ctx: CanvasRenderingContext2D, level: PreparedLevel, p: PlayerState, width: number, height: number, options: SceneOptions) {
  const { flash, note, dpr, rivals, rank, color, sprites, deadFor } = options;
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

  // Rivais (translúcidos, com o nome em cima) e depois o jogador por cima de todos.
  for (const [index, rival] of rivals.entries()) {
    if (rival.player.x + PLAYER < left || rival.player.x > right) continue;
    drawRunner(ctx, rival.player, rival.color, 0.6, rival.sprites);
    ctx.save();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.fillStyle = '#fff';
    // Nomes empilhados: rivais que largam juntos não escondem o nome um do outro.
    const labelY = rival.player.y - 4 - index * 15;
    ctx.strokeText(rival.name, rival.player.x + PLAYER / 2, labelY);
    ctx.fillText(rival.name, rival.player.x + PLAYER / 2, labelY);
    ctx.restore();
  }
  drawRunner(ctx, p, color, 1, sprites, deadFor);
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
  // Rivais na barra: uma bolinha da cor de cada um.
  for (const rival of rivals) {
    const dotX = barX + barW * progressOf(level, rival.player);
    ctx.fillStyle = rival.color;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * u;
    ctx.beginPath();
    ctx.arc(dotX, barY + barH / 2, 6 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Tempo que falta.
  const remaining = Math.max(0, Math.ceil((level.endX - p.x) / (SPEED * TICKS_PER_SECOND)));
  const remainingText = `faltam ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  ctx.textAlign = 'right';
  ctx.font = `700 ${15 * u}px system-ui, sans-serif`;
  ctx.lineWidth = 4 * u;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  ctx.fillStyle = '#fff';
  ctx.strokeText(remainingText, hudRight, barY + barH / 2);
  ctx.fillText(remainingText, hudRight, barY + barH / 2);
  // Forma atual.
  const labelY = Math.min(barY + barH + 14 * u, ceilScreenY - 9 * u);
  ctx.textAlign = 'center';
  ctx.font = `700 ${13 * u}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.strokeText(FORM_LABEL[p.form], width / 2, labelY);
  ctx.fillText(FORM_LABEL[p.form], width / 2, labelY);
  // Posição na corrida (só contra bots).
  if (rank) {
    ctx.textAlign = 'right';
    ctx.font = `800 ${16 * u}px system-ui, sans-serif`;
    const rankText = `${rank.position}º de ${rank.total}`;
    ctx.fillStyle = rank.position === 1 ? '#facc15' : '#fff';
    ctx.strokeText(rankText, hudRight, labelY);
    ctx.fillText(rankText, hudRight, labelY);
  }
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
