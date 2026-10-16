// THE FILM — draws frame t. Everything is a pure function of t (no state), so any frame
// can be rendered in any order by any worker, and it always lines up with song.js.
globalThis.CAST = {
  davi: { skin: '#C98B5E', hair: '#3A2314', hairStyle: 'curly', facialHair: 'beard', outfit: 'abaya', robe: '#233A7A', shirt: '#EADFC5', trim: '#D4A94A', build: 'regular', glasses: 'none' },
  golias: { skin: '#B9835A', hair: '#1E1A18', hairStyle: 'short', facialHair: 'beard', outfit: 'suit', robe: '#6B6F78', trim: '#9A3A2A', build: 'heavy', glasses: 'none' },
};
(function () {
  const U = globalThis.U, G = globalThis.G, Ch = globalThis.Ch, S = globalThis.SCORE, Studio = globalThis.Studio;
  const { BEAT, ev, clock, T } = S;
  const { clamp, lerp, ease, pulse } = U;
  const W = G.W, H = G.H; // from the score's FORMAT: every position below is relative to them
  const GROUND = Math.round((H * 860) / 1080);
  const K = Math.min(W, H) / 1080; // character scale
  const X = (x) => (x * W) / 1920; // an x designed on the 1920-wide stage

  const hop = (t, amp) => amp * Math.sin(Math.PI * clock.phase(t)); // 0 on every beat
  const squash = (t) => Math.max(0, 1 - clock.phase(t) * 5); // 1 right on the beat

  function background(ctx, t) {
    const drop = t >= ev.drop && t < ev.end;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, drop ? '#2B2458' : '#1C2046');
    g.addColorStop(1, drop ? '#6A3F6E' : '#3A3566');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (drop) {
      // sunburst, rotating, pulsing on the beat
      ctx.save();
      ctx.translate(W / 2, GROUND - 120);
      ctx.rotate((t - ev.drop) * 0.3);
      ctx.globalAlpha = 0.5 + 0.2 * pulse(t, ev.drop + Math.floor((t - ev.drop) / BEAT) * BEAT, 8);
      for (let i = 0; i < 24; i++) {
        ctx.fillStyle = i % 2 ? '#F2B84B' : '#E0703E';
        const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); const R = 2200 * Math.max(1, H / 1080);
        ctx.lineTo(Math.cos(a0) * R, Math.sin(a0) * R); ctx.lineTo(Math.cos(a1) * R, Math.sin(a1) * R); ctx.fill();
      }
      ctx.restore();
    }
    // paper hills + ground
    G.poly(ctx, [[X(-50), GROUND - 40], [X(500), GROUND - 110], [X(1100), GROUND - 60], [X(1600), GROUND - 130], [X(1980), GROUND - 70], [X(1980), H + 50], [X(-50), H + 50]], { fill: '#3E8A6A', lw: 5, seed: 3, hatch: { color: 'rgba(0,0,0,0.15)', gap: 9 } });
    G.poly(ctx, [[X(-50), GROUND], [X(1980), GROUND], [X(1980), H + 50], [X(-50), H + 50]], { fill: '#E8D9BC', lw: 5, seed: 4, hatch: { color: 'rgba(120,80,40,0.15)', gap: 8 } });
  }

  function stars(ctx, t) {
    const notes = S.starNotes;
    // constellation lines appear on the drop: the melody, drawn in the sky
    if (t >= ev.drop - 0.05) {
      const k = clamp((t - ev.drop) / 1.2) * (notes.length - 1);
      const pts = notes.slice(0, Math.floor(k) + 1).map((n) => [n.x, n.y]);
      if (pts.length > 1) G.line(ctx, pts, { color: 'rgba(255,240,200,0.7)', lw: 3, seed: 9, step: 30 });
    }
    for (const n of notes) {
      const a = t - n.t;
      if (a < 0) continue;
      const pop = ease.outBack(clamp(a / 0.25), 3);
      const flash = t >= ev.drop ? 1 + 0.35 * pulse(t, ev.drop + Math.floor((t - ev.drop) / BEAT) * BEAT, 6) : 1;
      const r = (18 + (n.midi % 5) * 3) * pop * flash;
      if (a < 0.5) {
        const gl = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3.2);
        gl.addColorStop(0, `rgba(255,233,168,${0.75 * (1 - a / 0.5)})`); gl.addColorStop(1, 'rgba(255,233,168,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = gl; ctx.fillRect(n.x - r * 3.2, n.y - r * 3.2, r * 6.4, r * 6.4); ctx.restore();
      }
      G.star(ctx, n.x, n.y, r, { fill: n.i % 3 ? '#F2B84B' : '#FFF1D2', seed: 100 + n.i, rot: Math.sin(t * 2 + n.i) * 0.2 });
    }
  }

  const DX = W * 0.27, GX = W * 0.76; // posições de Davi e de Golias
  const DS = 1.5 * K, GS = 2.3 * K; // escalas
  const hit = [GX + 10, GROUND - 262 * GS]; // testa de Golias (alvo da pedra)

  // mão de Davi (alvo local do braço direito, sem escala) e posição na tela
  const HANDLOC = [95, -250];
  const handScreen = (dy = 0) => [DX + HANDLOC[0] * DS, GROUND + (HANDLOC[1] + dy) * DS];

  const lastNote = (t) => { let r = -9; for (const n of S.musicbox) if (n.t <= t) r = n.t; return r; };

  function harp(ctx, x, y, s, rot, t) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
    const col = '#8A5A33', gold = '#D4A94A';
    G.poly(ctx, [[0, 0], [0, -230], [14, -250], [40, -250], [46, -232], [40, -222], [24, -226], [24, 0]], { fill: col, lw: 4, seed: 61 });
    G.poly(ctx, [[0, 0], [110, 0], [110, 14], [0, 14]], { fill: col, lw: 4, seed: 62 });
    G.poly(ctx, [[0, -236], [124, -236], [124, -220], [0, -220]], { fill: col, lw: 4, seed: 63 });
    G.poly(ctx, [[110, 0], [124, 0], [124, -236], [110, -236]], { fill: col, lw: 4, seed: 64 });
    for (let i = 0; i < 6; i++) {
      const sx = 30 + i * 14, wig = rot === 0 && t < ev.giantLand ? 2 * Math.sin(t * 40 + i) * pulse(t, lastNote(t), 6) : 0;
      G.line(ctx, [[sx + wig, -222], [sx - wig, -10]], { color: gold, lw: 3, seed: 70 + i, amp: 0.4, step: 40 });
    }
    ctx.restore();
  }

  const DAVI = { skin: '#C98B5E', hair: '#3A2314', hairStyle: 'curly', facialHair: 'beard', outfit: 'abaya', robe: '#233A7A', shirt: '#EADFC5', trim: '#D4A94A', build: 'regular', glasses: 'none' };
  const GOLIAS = { skin: '#B9835A', hair: '#1E1A18', hairStyle: 'short', facialHair: 'beard', outfit: 'kameez', shirt: '#8A6A3A', trim: '#C9A24A', bottoms: 'pants', shorts: '#4A3A2A', build: 'heavy', glasses: 'none' };

  function davi(ctx, t) {
    const o = { x: DX, y: GROUND, s: DS, style: DAVI, eyes: 'normal', mouth: 'smile', brows: 'neutral' };
    if (t < ev.giantLand) { // toca a harpa sob as estrelas
      o.y = GROUND - 0.4 * hop(t, 6); o.mouth = 'smile'; o.look = -0.3;
      o.handL = [-100, -130 + 6 * Math.sin(t * 8)];
    } else if (t < ev.spin) { // medo, depois coragem
      const brave = t >= T(4, 0);
      o.y = GROUND - (brave ? hop(t, 12) : 0); o.eyes = brave ? 'normal' : 'wide';
      o.brows = brave ? 'determined' : 'worried'; o.mouth = brave ? 'flat' : 'o'; o.look = 0.9; o.sweat = brave ? 0 : 1;
      o.handR = brave ? HANDLOC : null;
    } else if (t < ev.drop) { // gira a funda e solta
      o.brows = 'determined'; o.mouth = 'flat'; o.look = 0.9;
      o.handR = t < ev.breath ? [HANDLOC[0], HANDLOC[1] - 90] : [HANDLOC[0] + 40, HANDLOC[1] + 20];
      o.sy = 0.96;
    } else if (t < ev.end) { // vitória
      o.gesture = 'cheer'; o.eyes = 'happy'; o.mouth = 'grin'; o.y = GROUND - hop(t, 60);
    } else { o.gesture = 'cheer'; o.eyes = 'happy'; o.mouth = 'smile'; o.y = GROUND - hop(t, 12); }
    if (o.handR === null) delete o.handR;
    Ch.person(ctx, o);
    if (t < ev.giantLand) harp(ctx, DX - 120 * DS * 0.85, GROUND, 0.85 * DS, 0, t);
    else harp(ctx, X(60), GROUND + 10, 0.8, -1.35, t);
    // a funda e a pedra
    if (t >= T(4, 0) && t < ev.breath) {
      const [hx, hy] = handScreen(t >= ev.spin ? -90 : 0);
      if (t >= ev.spin) {
        const a = (t - ev.spin) * 26, R = 90 * K;
        const sx = hx + Math.cos(a) * R, sy = hy - 20 + Math.sin(a) * R * 0.45;
        G.line(ctx, [[hx, hy], [sx, sy]], { color: '#7A5A3A', lw: 5, seed: 80, step: 20 });
        G.ellipse(ctx, sx, sy, 20 * K, 17 * K, { fill: '#8E9198', lw: 4, seed: 81 });
      } else {
        G.line(ctx, [[hx, hy], [hx - 10, hy + 60]], { color: '#7A5A3A', lw: 5, seed: 80, step: 20 });
        G.ellipse(ctx, hx - 10, hy + 70, 20 * K, 17 * K, { fill: '#8E9198', lw: 4, seed: 81 });
      }
    }
  }

  function golias(ctx, t) {
    if (t < ev.giantFall) return;
    const o = { x: GX, y: GROUND, s: GS, style: GOLIAS, eyes: 'normal', mouth: 'smirk', brows: 'neutral' };
    let sx = 1, sy = 1;
    if (t < ev.giantLand) {
      const u = (t - ev.giantFall) / (ev.giantLand - ev.giantFall);
      o.y = lerp(-500, GROUND, ease.inQuad(u)); sy = 1.15; sx = 0.9; o.eyes = 'wide';
    } else if (t < ev.drop) {
      const land = Math.max(squash(t), Math.exp(-(t - ev.giantLand) * 8));
      sy = 1 - 0.1 * land; sx = 1 + 0.08 * land;
      o.mouth = Math.floor((t - ev.giantLand) / BEAT) % 2 ? 'open' : 'grin'; o.eyes = 'happy'; o.brows = 'determined';
      o.rot = Math.sin(Math.PI * clock.beatPos(t) * 0.5) * 0.02;
      if (t >= ev.breath) { o.mouth = 'open'; o.eyes = 'normal'; }
    } else if (t < ev.drop + 1.0) { // a pedra acerta e ele tomba
      const u = clamp((t - ev.drop) / 0.9);
      o.rot = ease.inQuad(u) * 1.45; o.eyes = 'wide'; o.mouth = 'o'; o.brows = 'worried';
      o.x = GX + u * 60;
    } else { o.rot = 1.45; o.x = GX + 60; o.eyes = 'closed'; o.mouth = 'o'; }
    o.sx = sx; o.sy = sy;
    // lança fincada ao lado dele, no mesmo giro
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0);
    G.line(ctx, [[-170 * GS * 0.5, 0], [-170 * GS * 0.5, -480 * GS]], { color: '#6A4A2A', lw: 9, seed: 90, step: 40 });
    G.poly(ctx, [[-170 * GS * 0.5 - 16, -470 * GS], [-170 * GS * 0.5, -540 * GS], [-170 * GS * 0.5 + 16, -470 * GS]], { fill: '#B8BCC4', lw: 4, seed: 91 });
    ctx.restore();
    Ch.person(ctx, o);
  }

  function stone(ctx, t) { // a pedra voa em silêncio e acerta no tempo exato
    if (t < ev.breath || t >= ev.drop) return;
    const u = (t - ev.breath) / (ev.drop - ev.breath);
    const [x0, y0] = handScreen(-90), x = lerp(x0, hit[0], u), y = lerp(y0, hit[1], u) - 120 * Math.sin(Math.PI * u);
    G.line(ctx, [[lerp(x0, hit[0], Math.max(0, u - 0.3)), lerp(y0, hit[1], Math.max(0, u - 0.3)) - 120 * Math.sin(Math.PI * Math.max(0, u - 0.3))], [x, y]], { color: 'rgba(255,255,255,0.7)', lw: 4, seed: 95, step: 20 });
    G.ellipse(ctx, x, y, 20 * K, 17 * K, { fill: '#8E9198', lw: 4, seed: 81 });
  }

  function impact(ctx, t) {
    const a = t - ev.drop;
    if (a < 0 || a > 0.5) return;
    G.rays(ctx, hit[0], hit[1], { n: 14, r0: 30, r1: 150 + 250 * a, color: '#FFF1D2', lw: 6, alpha: 1 - a / 0.5, spin: 0 });
    G.star(ctx, hit[0], hit[1], 90 * ease.outBack(clamp(a / 0.15), 3) * (1 - a / 0.5), { fill: '#FFF1D2', seed: 120 });
  }

  function endText(ctx, t) {
    const e = S.endText;
    const size = 120;
    const full = e.words.map((w) => w.w).join(' ');
    let x = W / 2 - G.measure(ctx, full, size) / 2;
    const y = S.WIDE ? 250 : H * 0.42;
    e.words.forEach((w, i) => {
      const ww = G.measure(ctx, w.w + (i < e.words.length - 1 ? ' ' : ''), size);
      const p = ease.inOutQuad(clamp((t - w.t) / w.d));
      if (p > 0) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x - 10, y - size, ww * p + 12, size * 1.6); ctx.clip();
        G.text(ctx, w.w, x, y, { size, color: '#F6EBD6' });
        ctx.restore();
      }
      x += ww;
    });
    const sa = clamp((t - e.sub.t) / 0.6);
    if (sa > 0) G.text(ctx, e.sub.text, W / 2, y + 80, { size: 48, fam: 'Patrick Hand', weight: 400, color: '#E9DCC3', align: 'center', alpha: sa });
  }

  Studio.film({
    draw(ctx, t) {
      if (t < 0.25) return; // a beat of black before the first frame of the story
      const shake = t >= ev.drop ? 18 * Math.exp(-(t - ev.drop) * 5) : t >= ev.giantLand ? 14 * Math.exp(-(t - ev.giantLand) * 7) : 0;
      ctx.save();
      ctx.translate(U.noise1(t * 30, 1) * shake, U.noise1(t * 30, 2) * shake);
      background(ctx, t);
      stars(ctx, t);
      golias(ctx, t);
      davi(ctx, t);
      stone(ctx, t);
      impact(ctx, t);
      if (t >= ev.drop) G.confetti(ctx, t, ev.drop, { n: 150, seed: 7, spawn: 2.5 });
      ctx.restore();
      if (t >= ev.breath && t < ev.drop) { ctx.fillStyle = 'rgba(10,8,20,0.35)'; ctx.fillRect(0, 0, W, H); } // the world holds its breath
      const flash = t >= ev.drop ? 0.8 * Math.exp(-(t - ev.drop) * 12) : 0;
      if (flash > 0.01) { ctx.fillStyle = `rgba(255,250,235,${flash})`; ctx.fillRect(0, 0, W, H); }
      for (const c of S.captions) G.caption(ctx, c, t);
      if (t >= ev.end) endText(ctx, t);
    },
    post: { paper: 0.5, vignette: 0.35, grain: 0.06 },
  });
})();
