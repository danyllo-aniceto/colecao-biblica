/**
 * Bots do Duelo. Só enxergam o que um jogador enxerga (`DuelView`): nunca a mão do rival. Três níveis:
 * Aprendiz joga ao acaso; Estudante usa o Vigor e disputa o cenário mais apertado; Mestre experimenta cada jogada no
 * motor e escolhe a melhor, dobra a aposta quando está na frente e desiste quando a rodada está perdida.
 */
import { doubleStakes, previewReveal, retreat, setReady, stage, stateFromView, lanePower, whyNotStage, type DuelView, viewFor } from "./engine";
import { nextRandom, shuffled } from "./rng";
import { LANES, type DuelState, type Side, type Staged } from "./types";

export type BotSkill = "APPRENTICE" | "STUDENT" | "MASTER";

export type BotMove = { plays: Staged[]; double: boolean; retreat: boolean };

function openLanes(view: DuelView) {
  return view.lanes.map((lane, index) => ({ lane, index })).filter((entry) => entry.lane.open);
}

/** Cenários abertos em que ainda cabe uma carta (descontando o que o bot já colocou neste turno). */
function freeLanes(view: DuelView, plays: Staged[]) {
  return openLanes(view).filter(({ lane, index }) => lane.cards[view.you].length + plays.filter((play) => play.lane === index).length < lane.slots);
}

function totalPower(view: DuelView, side: Side) {
  return view.lanes.reduce((sum, lane) => sum + (lane.open ? lane.power[side] : 0), 0);
}

function lanesWon(view: DuelView, side: Side) {
  return view.lanes.filter((lane) => lane.open && lane.power[side] > lane.power[side === 0 ? 1 : 0]).length;
}

function apprentice(view: DuelView, seed: number): Staged[] {
  const plays: Staged[] = [];
  let left = view.energyLeft;
  let rng = seed;
  const order = shuffled(view.hand, rng);
  rng = order.seed;
  for (const card of order.items) {
    if (card.def.cost > left) continue;
    const lanes = freeLanes(view, plays);
    if (lanes.length === 0) break;
    const roll = nextRandom(rng);
    rng = roll.seed;
    plays.push({ uid: card.uid, lane: lanes[Math.floor(roll.value * lanes.length)].index });
    left -= card.def.cost;
  }
  return plays;
}

function student(view: DuelView): Staged[] {
  const plays: Staged[] = [];
  let left = view.energyLeft;
  // Cartas mais caras primeiro (usa melhor o Vigor), cada uma no cenário mais disputado onde ainda dá para vencer.
  const hand = [...view.hand].sort((a, b) => b.def.cost - a.def.cost || b.def.power - a.def.power);
  const added: number[] = [0, 0, 0];
  for (const card of hand) {
    if (card.def.cost > left) continue;
    const lanes = freeLanes(view, plays);
    if (lanes.length === 0) break;
    const foe: Side = view.you === 0 ? 1 : 0;
    const margin = (index: number) => view.lanes[index].power[view.you] + added[index] - view.lanes[index].power[foe];
    // Prefere o cenário em que está um pouco atrás; se todos estão à frente, reforça o mais apertado.
    const best = [...lanes].sort((a, b) => {
      const ma = margin(a.index);
      const mb = margin(b.index);
      const score = (m: number) => (m < 0 ? -m : 100 + m);
      return score(ma) - score(mb);
    })[0];
    plays.push({ uid: card.uid, lane: best.index });
    added[best.index] += card.def.power;
    left -= card.def.cost;
  }
  return plays;
}

function evaluate(state: DuelState, side: Side) {
  const foe: Side = side === 0 ? 1 : 0;
  let score = 0;
  let mine = 0;
  let theirs = 0;
  for (let index = 0; index < Math.min(state.turn, LANES); index += 1) {
    const a = lanePower(state, index, side);
    const b = lanePower(state, index, foe);
    mine += a;
    theirs += b;
    score += a > b ? 3 : a < b ? -3 : 0;
    // Perto de virar vale mais do que ganhar de lavada.
    score += Math.max(-4, Math.min(4, a - b)) * 0.3;
  }
  return score + (mine - theirs) * 0.05;
}

function master(view: DuelView, seed: number): Staged[] {
  const base = stateFromView(view, seed);
  const side = view.you;
  let plays: Staged[] = [];
  let left = view.energyLeft;
  let current = evaluate(previewReveal(base, side, plays), side);
  for (let guard = 0; guard < 8; guard += 1) {
    let best: { play: Staged; gain: number; cost: number } | null = null;
    for (const card of view.hand) {
      if (card.def.cost > left || plays.some((play) => play.uid === card.uid)) continue;
      for (const { index } of freeLanes(view, plays)) {
        const candidate = [...plays, { uid: card.uid, lane: index }];
        const gain = evaluate(previewReveal(base, side, candidate), side) - current;
        // Pequeno desempate a favor de gastar o Vigor.
        const score = gain + card.def.cost * 0.15;
        if (!best || score > best.gain) best = { play: { uid: card.uid, lane: index }, gain: score, cost: card.def.cost };
      }
    }
    if (!best || best.gain <= 0) break;
    plays = [...plays, best.play];
    left -= best.cost;
    current = evaluate(previewReveal(base, side, plays), side);
  }
  return plays;
}

/** A decisão do bot para o turno (jogadas, dobrar e desistir) a partir da visão dele. */
export function botMove(view: DuelView, skill: BotSkill, seed: number): BotMove {
  const foe: Side = view.you === 0 ? 1 : 0;
  const mine = lanesWon(view, view.you);
  const theirs = lanesWon(view, foe);
  const margin = totalPower(view, view.you) - totalPower(view, foe);

  let wantsRetreat = false;
  let wantsDouble = false;
  if (skill === "MASTER") {
    wantsRetreat = view.canRetreat && view.turn >= 5 && theirs >= 2 && mine === 0 && margin <= -10;
    wantsDouble = view.canDouble && view.turn >= 4 && mine >= 2 && margin >= 6;
  } else if (skill === "STUDENT") {
    wantsDouble = view.canDouble && view.turn >= 5 && mine >= 2 && margin >= 8;
  }

  const plays = skill === "APPRENTICE" ? apprentice(view, seed) : skill === "STUDENT" ? student(view) : master(view, seed);
  return { plays, double: wantsDouble, retreat: wantsRetreat };
}

/** Aplica ao estado a jogada do bot de `side` (colocar cartas, dobrar/desistir e dizer "Pronto"). */
export function playBotTurn(state: DuelState, side: Side, skill: BotSkill): DuelState {
  if (state.status !== "playing" || state.players[side].ready) return state;
  const view = viewFor(state, side);
  const move = botMove(view, skill, state.rng ^ (state.turn * 7919 + side));
  let next = state;
  if (move.retreat) return retreat(next, side);
  if (move.double) next = doubleStakes(next, side);
  for (const play of move.plays) {
    if (whyNotStage(next, side, play.uid, play.lane) === null) next = stage(next, side, play.uid, play.lane);
  }
  return setReady(next, side);
}
