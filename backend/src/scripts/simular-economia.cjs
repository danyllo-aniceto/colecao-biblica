// Simulador da economia do jogo (moedas, XP e figurinhas) — rode: npm run simular-economia -w backend
//
// Simula, dia a dia, três perfis de jogador (casual, regular e dedicado) com a economia ANTIGA e a NOVA e
// mostra o nível, a % do álbum e a renda diária média em cada marco. É um modelo simplificado (valores
// esperados + sorteios), feito para comparar ajustes antes de mexer no jogo; não é uma previsão exata.
// Premissas: álbum de 88 figurinhas (40 comuns, 25 raras, 15 épicas, 8 lendárias), partidas de 10 perguntas
// (na economia nova: maratona até as 3 vidas, com menos partidas por dia, pois cada uma é mais longa),
// o jogador gasta tudo na loja comprando sempre a figurinha mais rara que consegue pagar.
// Ao mudar um número do jogo, atualize o bloco NOVO abaixo e veja o efeito antes de publicar.
// Simulação da economia: jogador médio por perfil, dia a dia.
const ANTIGO_NODE = (L, relic) => { const b = Math.round((20 + L * 2) / 5) * 5; return relic ? b * 2 : b; };
const ANTIGO = {
  // xp
  xpPerCorrect: 10, levelBase: 200, levelStep: 50,
  // coins
  coinsPerCorrect: 2, perfectBonus: 20, coinMatchLimit: 6, comboStart: 3, comboCoins: 1,
  rewardLimit: 3, rewardMinCorrect: 7, pity: 6,
  dailyBase: 20, dailyStep: 10, daily7: 120,
  chestBase: 30, chestPerLevel: 5, chestMax: 150,
  nodeCoins: (L, relic) => { const b = Math.round((20 + L * 2) / 5) * 5; return relic ? b * 2 : b; },
  price: { C: 200, R: 450, E: 900 }, shopLimit: 2, pack: 300,
  dup: { C: 15, R: 40, E: 90, L: 200 },
  draw: { stC: 20, stR: 8, stE: 3, stL: 1, coins: 50 * 0 + 30, coinAmt: 50, other: 6 + 5 + 4 + 5 + 3 + 24, pack: 2 },
  packOdds: { C: 62, R: 28, E: 9, L: 1 },
  album: { C: 40, R: 25, E: 15, L: 8 },
  missionDaily: 35, weekly: 500, xpFullMatches: null, collectionCoinsPerMonth: 0,
  campaign: (L) => ({ coins: L <= 50 ? ANTIGO_NODE(L, [4, 8, 13, 18, 23, 28, 33, 38, 44, 50].includes(L)) : 0, stone: 0 }),
  xpDaily: null, // limite de XP/dia (null = sem)
  xpAfterCap: 1,
};
const profiles = {
  casual: { matches: 2, marathons: 1.5, acc: 0.72, login: 0.85, missions: 0.8, weekly: 0.2 },
  regular: { matches: 5, marathons: 4, acc: 0.78, login: 0.95, missions: 1.6, weekly: 0.6 },
  hardcore: { matches: 12, marathons: 9, acc: 0.85, login: 1, missions: 2.4, weekly: 1 },
};
const rnd = Math.random;
// Curva antiga (quadrática por nível) ou por cenário (`c.xpCost(L)` = XP para subir até o nível L).
const stepCost = (c, L) => (c.xpCost ? c.xpCost(L) : c.levelBase + c.levelStep * (L - 2));
const levelOf = (c, xp) => { let L = 1, left = xp; while (left >= stepCost(c, L + 1)) { left -= stepCost(c, L + 1); L++; } return L; };

function playMatch(c, acc, n = 10) {
  let streak = 0, correct = 0, combo = 0, lives = 3, answered = 0;
  if (c.marathon) n = 100; // maratona: até perder as 3 vidas
  for (let i = 0; i < n && lives > 0; i++) {
    answered++;
    if (rnd() < acc) { correct++; streak++; if (streak >= c.comboStart) combo += c.comboCoins; } else { streak = 0; lives--; }
  }
  const wrong = answered - correct;
  const a = correct / answered;
  const bonus = a >= 0.9 ? 12 : a >= 0.7 ? 8 : a >= 0.5 ? 4 : 0;
  return { correct, wrong, combo, xp: correct * (c.xpPerCorrect + bonus), perfect: wrong === 0 && correct >= 5 };
}
function pick(w) { const t = w.reduce((s, x) => s + x[1], 0); let r = rnd() * t; for (const [k, v] of w) { if ((r -= v) < 0) return k; } return w[0][0]; }

let SRC = {};
let stickerDraws = 0;
function simulate(c, p, days = Number(process.env.DAYS) || 365) {
  const st = { coins: 0, xp: 0, level: 1, chestLevel: 1, owned: { C: 0, R: 0, E: 0, L: 0 }, streak: 0, noSticker: 0, dupCoins: 0, income: 0, total: 0 };
  const total = c.album.C + c.album.R + c.album.E + c.album.L;
  const out = []; let doneDay = null; st.reached = {};
  st.cum = 0; const hist = [0]; const earn = (n, cat = 'outros') => { st.coins += n; st.cum += n; (SRC[cat] ??= 0); SRC[cat] += n; };
  const giveSticker = (r, free = false) => { // r: C R E L (sorteio e loja preferem figurinhas que faltam; no baú, às vezes vem repetida)
    const faltam = c.album[r] - st.owned[r];
    const bias = free && c.newBias !== undefined ? c.newBias : 1;
    if (faltam > 0 && (bias >= 1 || rnd() < bias + (1 - bias) * (faltam / c.album[r]))) { st.owned[r]++; return true; }
    earn(c.dup[r], 'repetidas'); return false;
  };
  for (let d = 1; d <= days; d++) {
        let coinMatches = 0, draws = 0, xpToday = 0, diamondsToday = 0;
    const base = c.marathon ? p.marathons : p.matches;
    const m = Math.round(base + (rnd() - 0.5) * base * 0.6);
    for (let i = 0; i < Math.max(0, m); i++) {
      const r = playMatch(c, p.acc);
      let xp = r.xp; if (c.xpFullMatches && i >= c.xpFullMatches) xp = Math.round(xp * c.xpAfterCap);
      st.xp += xp;
      if (r.correct > 0 && coinMatches < c.coinMatchLimit) { coinMatches++; earn(r.correct * c.coinsPerCorrect + r.combo + (r.perfect ? c.perfectBonus : 0), 'partidas'); }
      if (c.chests) {
        // Baú da partida: o nível vem dos acertos; até chestLimit por dia (diamante: 1 por dia).
        const k = c.chests;
        let tier = r.correct >= k.diamond ? 'D' : r.correct >= k.gold ? 'G' : r.correct >= k.silver ? 'S' : r.correct >= c.rewardMinCorrect ? 'B' : null;
        if (tier === 'D' && diamondsToday >= 1) tier = 'G';
        if (tier && draws < k.limit) {
          draws++; if (tier === 'D') diamondsToday++;
          const spec = k.spec[tier];
          earn(spec.coins, 'baús');
          let n = 0;
          if (spec.sticker >= 1 || st.noSticker >= c.pity || rnd() < spec.sticker) { n = 1; if (spec.extra > 0 && rnd() < spec.extra) n = 2; }
          for (let i = 0; i < n; i++) {
            const g = c.draw; const m = k.boost[tier];
            const items = tier === 'D' ? [['E', 75], ['L', 25]] : [['C', g.stC * m[0]], ['R', g.stR * m[1]], ['E', g.stE * m[2]], ['L', g.stL * m[3]], ['pack', g.pack * m[4]]];
            const res = pick(items);
            const rar = res === 'pack' ? pick(Object.entries(c.packOdds)) : res;
            giveSticker(rar, true); stickerDraws++;
          }
          st.noSticker = n > 0 ? 0 : st.noSticker + 1;
        }
      } else if (r.correct >= c.rewardMinCorrect && draws < c.rewardLimit) {
        draws++;
        const g = c.draw; const pityOn = st.noSticker >= c.pity;
        const table = [['C', g.stC], ['R', g.stR], ['E', g.stE], ['L', g.stL], ['pack', g.pack], ['coins', g.coins], ['other', g.other]];
        const res = pick(pityOn ? table.slice(0, 5) : table);
        if (res === 'coins') { earn(c.draw.coinAmt, 'sorteio'); st.noSticker++; }
        else if (res === 'other') st.noSticker++;
        else { const rar = res === 'pack' ? pick(Object.entries(c.packOdds)) : res; giveSticker(rar); st.noSticker = 0; stickerDraws++; }
      }
    }
    // diário
    if (rnd() < p.login) { st.streak++; const day = ((st.streak - 1) % 7) + 1; earn(day >= 7 ? c.daily7 : c.dailyBase + c.dailyStep * (day - 1), 'diario'); } else st.streak = 0;
    // missões
    earn(Math.round(p.missions * c.missionDaily * (0.7 + rnd() * 0.6)), 'missoes');
    if (d % 7 === 0) earn(Math.round(c.weekly * p.weekly), 'missoes');
    if (d % 30 === 0) earn(Math.round(650 * Math.min(1, st.xp / 20000 + 0.2)), 'passe');
    // níveis: baú + parada da campanha
    const lv = levelOf(c, st.xp);
    while (st.chestLevel < lv) {
      st.chestLevel++;
      const L = st.chestLevel; if (L % (c.chestEvery || 1) === 0) earn(Math.min(c.chestMax, c.chestBase + c.chestPerLevel * L), 'baus');
      const camp = c.campaign(L);
      if (camp.coins) earn(camp.coins, 'campanha');
      if (camp.stone) earn(camp.stone, 'pedras');
    }
    st.level = lv;
    for (const m of c.milestones ?? []) if (lv >= m && !st.reached[m]) st.reached[m] = d;
    // compras: loja
    let bought = 0;
    while (bought < c.shopLimit) {
      const want = ['L', 'E', 'R', 'C'].filter((r) => c.price[r]).find((r) => st.coins >= c.price[r] && st.owned[r] < c.album[r]);
      if (!want) break;
      st.coins -= c.price[want]; giveSticker(want); bought++;
    }
    hist[d] = st.cum; st.income = (hist[d] - hist[Math.max(0, d - 30)]) / Math.min(d, 30);
    const have = st.owned.C + st.owned.R + st.owned.E + st.owned.L;
    if (!doneDay && have >= total) doneDay = d;
    if ([7, 14, 30, 60, 90, 180, 365].includes(d)) out.push({ d, level: st.level, album: Math.round((have / total) * 100) + '%', leg: st.owned.L + '/' + c.album.L, income: st.income, bank: st.coins });
  }
  return { out, doneDay, total, reached: st.reached };
}
function avg(c, p, runs = 150) {
  const acc = {}; let done = []; let n = 0; const reached = {};
  for (let i = 0; i < runs; i++) {
    const r = simulate(c, p); done.push(r.doneDay ?? 999);
    for (const m of c.milestones ?? []) (reached[m] ??= []).push(r.reached[m] ?? 9999);
    r.out.forEach((o) => { const a = (acc[o.d] ??= { level: 0, album: 0, income: 0, bank: 0, leg: 0 }); a.level += o.level; a.album += parseInt(o.album); a.income += o.income; a.bank += o.bank; a.leg += parseInt(o.leg); });
  }
  const rows = Object.entries(acc).map(([d, a]) => `d${d}: nv ${(a.level / runs).toFixed(0)} | álbum ${(a.album / runs).toFixed(0)}% | lend ${(a.leg / runs).toFixed(1)} | renda/dia ${(a.income / runs).toFixed(0)}`);
  done.sort((a, b) => a - b);
  const reachedMedian = {};
  for (const [m, list] of Object.entries(reached)) { list.sort((a, b) => a - b); const v = list[Math.floor(list.length / 2)]; reachedMedian[m] = v >= 9999 ? null : v; }
  return { rows, median: done[Math.floor(done.length / 2)], reachedMedian };
}
function breakdown(c, p, days = 60, runs = 100) {
  SRC = {};
  for (let i = 0; i < runs; i++) simulate(c, p, days);
  const tot = Object.values(SRC).reduce((a, b) => a + b, 0);
  return Object.entries(SRC).map(([k, v]) => `${k}: ${(v / runs / days).toFixed(0)}/dia (${((v / tot) * 100).toFixed(0)}%)`).join(' · ');
}
const NOVO = {
  ...ANTIGO,
  levelBase: 300, levelStep: 100,
  xpFullMatches: 4, xpAfterCap: 0.25,
  perfectBonus: 15, coinMatchLimit: 3,
  rewardLimit: 2, pity: 10,
  dailyBase: 20, dailyStep: 10, daily7: 100,
  chestBase: 20, chestPerLevel: 3, chestMax: 80,
  campaign: (L) => ({ coins: L <= 50 ? Math.round((15 + L * 1.5) / 5) * 5 * ([4, 8, 13, 18, 23, 28, 33, 38, 44, 50].includes(L) ? 2 : 1) : 0, stone: 0 }),
  price: { C: 450, R: 1100, E: 2800 }, shopLimit: 1,
  dup: { C: 55, R: 135, E: 340, L: 800 },
  draw: { stC: 9, stR: 3.5, stE: 1.2, stL: 0.4, coins: 30, coinAmt: 40, other: 46, pack: 1.5 },
  packOdds: { C: 66, R: 27, E: 6.5, L: 0.5 },
  missionDaily: 26, weekly: 330,
  // Quiz geral em maratona (até as 3 vidas) com baús Bronze/Prata/Ouro por acertos.
  marathon: true,
  newBias: 0.75,
  chests: {
    silver: 15, gold: 40, diamond: 70, limit: 5,
    spec: { B: { coins: 10, sticker: 0.45, extra: 0 }, S: { coins: 25, sticker: 0.65, extra: 0 }, G: { coins: 50, sticker: 1, extra: 0.1 }, D: { coins: 100, sticker: 1, extra: 0.2 } },
    boost: { B: [1, 1, 1, 1, 1], S: [0.8, 1.3, 1.6, 1.3, 1.2], G: [1, 1.6, 2.2, 1.5, 1.5] },
  },
};

// ---------------------------------------------------------------------------------------------
// CURVA POR CENÁRIO (nível e XP refatorados): XP por parada sobe de cenário em cenário (500 + 70, teto 1800),
// moedas da parada = XP/10 (relíquia em dobro), pedra do Peitoral a cada 3 cenários após Jesus.
// ---------------------------------------------------------------------------------------------
const xpPerStop = (i) => Math.min(Number(process.env.XP_CAP) || 1800, 500 + (Number(process.env.XP_STEP) || 70) * i);
function porCenario(stops, { stoneCoins = 500, finalCoins = 2000, claimTail = false } = {}) {
  const levelInfo = {}; let L = 0; const costOf = {};
  stops.forEach((n, i) => {
    for (let k = 0; k < n; k++) {
      L++;
      costOf[L] = xpPerStop(i);
      const relic = k === n - 1;
      const coins = Math.max(5, Math.round(xpPerStop(i) / (Number(process.env.COIN_DIV) || 10) / 5) * 5) * (relic ? 2 : 1);
      // Pedra: depois dos 10 de lançamento, a cada 3 cenários (o último nível do 3º cenário).
      const stoneEnd = relic && i >= 10 && (i - 10) % 3 === 2;
      const isLast = i === stops.length - 1 && relic && (i - 10) % 3 === 2 && (i - 10) / 3 + 1 === 12;
      levelInfo[L] = { coins, stone: stoneEnd ? stoneCoins + (isLast ? finalCoins : 0) : 0 };
    }
  });
  const last = L;
  return {
    last,
    xpCost: (lv) => costOf[Math.min(lv, last)] ?? costOf[last],
    campaign: (lv) => levelInfo[lv] ?? { coins: 0, stone: 0 },
    milestones: [50, Math.min(62, last), last],
  };
}
const STOPS_HOJE = [4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 4, 4, 4]; // 10 de lançamento + trio Sardônio
const STOPS_FUTURO = [...STOPS_HOJE.slice(0, 10), ...Array(36).fill(4)]; // + os 36 cenários das 12 pedras
// Álbum maior (ALBUM=400): mesma proporção de raridades do álbum de 88 (45% comuns, 28% raras, 17% épicas, 10% lendárias).
const ALBUM_TOTAL = Number(process.env.ALBUM) || (process.argv[2] === 'hoje' || process.argv[2] === 'futuro' ? 400 : 88);
const ALBUM = ALBUM_TOTAL === 88 ? { C: 40, R: 25, E: 15, L: 8 } : { C: Math.round(ALBUM_TOTAL * 0.45), R: Math.round(ALBUM_TOTAL * 0.28), E: Math.round(ALBUM_TOTAL * 0.17), L: Math.round(ALBUM_TOTAL * 0.1) };
const EXTRA = { chestEvery: Number(process.env.CHEST_EVERY) || 3, album: ALBUM };
const HOJE = { ...NOVO, ...EXTRA, ...porCenario(STOPS_HOJE) };
const FUTURO = { ...NOVO, ...EXTRA, ...porCenario(STOPS_FUTURO) };

function relatorio(titulo, cfg) {
  console.log(`\n######## ${titulo} ########`);
  for (const [nome, perfil] of Object.entries(profiles)) {
    if (process.env.PROFILE && process.env.PROFILE !== nome) continue;
    const r = avg(cfg, perfil, 100);
    console.log(`\n== ${nome} (${perfil.matches} partidas/dia) — álbum completo (mediana): ${r.median >= 999 ? 'mais de 365' : r.median} dias`);
    stickerDraws = 0; for (let i = 0; i < 30; i++) simulate(cfg, perfil, 60); console.log(`   figurinhas de sorteio/baú por dia (60d): ${(stickerDraws / 30 / 60).toFixed(2)}`);
    console.log('   fontes de moedas (60 dias): ' + breakdown(cfg, perfil, 60, 60));
    r.rows.filter((_, i) => [2, 4, 5, 6].includes(i)).forEach((linha) => console.log('  ' + linha));
    if (cfg.milestones) console.log('   dias até o nível (mediana): ' + cfg.milestones.map((m) => `${m}: ${r.reachedMedian[m] ?? '+365'}`).join(' · '));
  }
}
const alvo = process.argv[2];
// Uso: simular-economia [antigo|novo|hoje|futuro]  (sem argumento: antigo + novo)
if (alvo === 'hoje') relatorio('HOJE: curva por cenário, 13 cenários (62 níveis)', HOJE);
else if (alvo === 'futuro') relatorio('FUTURO: curva por cenário, campanha completa (46 cenários, 194 níveis)', FUTURO);
else {
  if (alvo !== 'novo') relatorio('ECONOMIA ANTIGA', ANTIGO);
  if (alvo !== 'antigo') relatorio('ECONOMIA NOVA (curva por nível, antes da refatoração)', NOVO);
}
