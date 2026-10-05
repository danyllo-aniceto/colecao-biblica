/**
 * Motor do Modo Duelo: regras puras, sem banco e sem dependências, para rodar igual no navegador
 * (treino contra bot) e no servidor (salas online). Cada função recebe o estado e devolve um estado novo
 * (o original nunca é alterado). O sorteio usa uma semente guardada no estado, então a mesma partida
 * se repete igual (testes e revanche).
 *
 * Informação escondida: a mão e o Time do rival, a ordem do baralho, as jogadas ainda não reveladas e os
 * cenários que ainda não apareceram. Quem chama (o servidor) deve mandar ao cliente só `viewFor(...)`.
 */
import { levelDef } from "./cards";
import { nextRandom, shuffled } from "./rng";
import { scenarioOf, SCENARIOS } from "./scenarios";
import {
  HAND_MAX,
  LANES,
  MAX_SLOTS,
  MAX_STAKES,
  START_HAND,
  TURNS,
  type Card,
  type CardDef,
  type Cond,
  type Count,
  type DuelEvent,
  type DuelResult,
  type DuelState,
  type Effect,
  type Lane,
  type PlacedCard,
  type PlayerState,
  type ScenarioDef,
  type Side,
  type Staged,
  type Target,
  type TeamCard,
  type Trigger,
} from "./types";

// ---------------------------------------------------------------------------
// Cartas-ficha (criadas por Dons)
// ---------------------------------------------------------------------------

export const TOKENS: Record<string, CardDef> = {
  Descendente: { id: "token:descendente", name: "Descendente", cost: 0, power: 1, tags: ["Descendente"], token: true },
};

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export type NewDuelInput = {
  teams: [TeamCard[], TeamCard[]];
  seed: number;
  /** Cenários dos três lugares (identificadores); sem isso, são sorteados. */
  scenarios?: [string, string, string];
};

const other = (side: Side): Side => (side === 0 ? 1 : 0);

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function newDuel(input: NewDuelInput): DuelState {
  let seed = input.seed >>> 0;
  let uid = 1;

  let scenarioIds = input.scenarios;
  if (!scenarioIds) {
    const picked = shuffled(
      SCENARIOS.map((scenario) => scenario.id),
      seed,
    );
    seed = picked.seed;
    scenarioIds = [picked.items[0], picked.items[1], picked.items[2]];
  }
  scenarioIds.forEach((id) => scenarioOf(id));

  const build = (team: TeamCard[]): PlayerState => {
    const cards: Card[] = team.map((entry) => ({ uid: uid++, def: levelDef(entry.def, entry.level), bonus: 0 }));
    const mixed = shuffled(cards, seed);
    seed = mixed.seed;
    return { deck: mixed.items.slice(START_HAND), hand: mixed.items.slice(0, START_HAND), graveyard: [], returning: [], staged: [], ready: false, doubledTurn: 0 };
  };
  const players: [PlayerState, PlayerState] = [build(input.teams[0]), build(input.teams[1])];

  const lanes: Lane[] = scenarioIds.map((scenario) => ({ scenario, cards: [[], []], played: [0, 0] }));
  return {
    rng: seed,
    turn: 1,
    status: "playing",
    lanes,
    players,
    nextUid: uid,
    nextOrder: 1,
    priority: null,
    stakes: 1,
    events: [{ type: "scenario", lane: 0, text: `${scenarioOf(scenarioIds[0]).emoji} ${scenarioOf(scenarioIds[0]).name}: ${scenarioOf(scenarioIds[0]).text}` }],
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export function energyOf(state: DuelState) {
  return state.turn;
}

export function isLaneOpen(state: DuelState, lane: number) {
  return lane >= 0 && lane < Math.min(state.turn, LANES);
}

export function slotsOf(scenario: ScenarioDef) {
  return scenario.rule.kind === "slots" ? scenario.rule.count : MAX_SLOTS;
}

function laneScenario(state: DuelState, lane: number) {
  return scenarioOf(state.lanes[lane].scenario);
}

type Found = { lane: number; side: Side; card: PlacedCard };

function allCards(state: DuelState): Found[] {
  const found: Found[] = [];
  state.lanes.forEach((lane, laneIndex) => {
    ([0, 1] as Side[]).forEach((side) => lane.cards[side].forEach((card) => found.push({ lane: laneIndex, side, card })));
  });
  return found.sort((a, b) => a.card.order - b.card.order);
}

function findCard(state: DuelState, uid: number): Found | null {
  return allCards(state).find((entry) => entry.card.uid === uid) ?? null;
}

function countMatching(state: DuelState, source: Found, count: Count) {
  const lanes = count.of === "alliesHere" ? [source.lane] : state.lanes.map((_, index) => index);
  let total = 0;
  for (const laneIndex of lanes) {
    for (const card of state.lanes[laneIndex].cards[source.side]) {
      if (card.uid === source.card.uid) continue;
      if (count.tag && !card.def.tags.includes(count.tag)) continue;
      if (count.cost !== undefined && card.def.cost !== count.cost) continue;
      total += 1;
    }
  }
  return total;
}

/** Influência atual de uma carta: base + bônus permanentes + Dons contínuos + regra do cenário. */
export function cardPower(state: DuelState, laneIndex: number, side: Side, card: PlacedCard): number {
  let power = card.def.power + card.bonus;
  const here = state.lanes[laneIndex].cards[side];
  const dom = card.def.dom;
  if (dom?.trigger === "ongoing" && !card.silenced) {
    for (const effect of dom.effects) {
      if (effect.kind === "powerPer") power += effect.amount * countMatching(state, { lane: laneIndex, side, card }, effect.per);
    }
  }
  // Auras de outras cartas suas.
  state.lanes.forEach((lane, index) => {
    for (const source of lane.cards[side]) {
      if (source.uid === card.uid || source.silenced || source.def.dom?.trigger !== "ongoing") continue;
      for (const effect of source.def.dom.effects) {
        if (effect.kind !== "aura") continue;
        if (effect.tag && !card.def.tags.includes(effect.tag)) continue;
        if (effect.to === "alliesHere" && index === laneIndex) power += effect.amount;
        if (effect.to === "adjacent" && Math.abs(index - laneIndex) === 1) power += effect.amount;
      }
    }
  });
  // Regras de cenário que mexem em cada carta.
  const rule = laneScenario(state, laneIndex).rule;
  if (rule.kind === "cheapBonus" && card.def.cost === 1) power += rule.amount;
  if (rule.kind === "sharedTag" && here.some((mate) => mate.uid !== card.uid && mate.def.tags.some((tag) => card.def.tags.includes(tag)))) power += rule.amount;
  return power;
}

/** Bônus do cenário que vale para o lado todo (não é de uma carta). */
function laneBonus(state: DuelState, laneIndex: number, side: Side): number {
  const rule = laneScenario(state, laneIndex).rule;
  const mine = state.lanes[laneIndex].cards[side];
  const theirs = state.lanes[laneIndex].cards[other(side)];
  if (rule.kind === "majority" && mine.length > theirs.length) return rule.amount;
  if (rule.kind === "tagBonus") return mine.filter((card) => card.def.tags.some((tag) => rule.tags.includes(tag))).length * rule.amount;
  return 0;
}

export function lanePower(state: DuelState, laneIndex: number, side: Side): number {
  const cards = state.lanes[laneIndex].cards[side];
  return cards.reduce((sum, card) => sum + cardPower(state, laneIndex, side, card), 0) + laneBonus(state, laneIndex, side);
}

function laneWinner(state: DuelState, laneIndex: number): Side | null {
  const a = lanePower(state, laneIndex, 0);
  const b = lanePower(state, laneIndex, 1);
  return a === b ? null : a > b ? 0 : 1;
}

function isProtected(state: DuelState, target: Found) {
  return state.lanes[target.lane].cards[target.side].some((card) => !card.silenced && card.def.dom?.trigger === "ongoing" && card.def.dom.effects.some((effect) => effect.kind === "protect"));
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

function emit(state: DuelState, event: DuelEvent) {
  state.events.push(event);
}

// ---------------------------------------------------------------------------
// Efeitos dos Dons
// ---------------------------------------------------------------------------

type Ctx = { side: Side; lane: number; card: PlacedCard };

function checkCond(state: DuelState, ctx: Ctx, cond: Cond | undefined): boolean {
  if (!cond) return true;
  switch (cond.type) {
    case "enemyHerePower":
      return state.lanes[ctx.lane].cards[other(ctx.side)].some((card) => cardPower(state, ctx.lane, other(ctx.side), card) >= cond.atLeast);
    case "enemyHereNamed":
      return state.lanes[ctx.lane].cards[other(ctx.side)].some((card) => card.def.name === cond.name);
    case "alliesHere":
      return state.lanes[ctx.lane].cards[ctx.side].filter((card) => card.uid !== ctx.card.uid).length >= cond.atLeast;
    case "laneLosing":
      return lanePower(state, ctx.lane, ctx.side) < lanePower(state, ctx.lane, other(ctx.side));
    case "turnAtLeast":
      return state.turn >= cond.turn;
  }
}

function targetsOf(state: DuelState, ctx: Ctx, target: Target): Found[] {
  const here = (side: Side) => state.lanes[ctx.lane].cards[side].map((card) => ({ lane: ctx.lane, side, card }));
  const byPower = (list: Found[]) => [...list].sort((a, b) => cardPower(state, a.lane, a.side, a.card) - cardPower(state, b.lane, b.side, b.card) || a.card.order - b.card.order);
  switch (target) {
    case "self":
      return state.lanes[ctx.lane].cards[ctx.side].some((card) => card.uid === ctx.card.uid) ? [{ lane: ctx.lane, side: ctx.side, card: ctx.card }] : [];
    case "alliesHere":
      return here(ctx.side).filter((entry) => entry.card.uid !== ctx.card.uid);
    case "enemiesHere":
      return here(other(ctx.side));
    case "otherAllies":
      return allCards(state).filter((entry) => entry.side === ctx.side && entry.card.uid !== ctx.card.uid);
    case "weakestEnemyHere":
      return byPower(here(other(ctx.side))).slice(0, 1);
    case "strongestEnemyHere":
      return byPower(here(other(ctx.side))).slice(-1);
    case "weakestAllyHere":
      return byPower(here(ctx.side).filter((entry) => entry.card.uid !== ctx.card.uid)).slice(0, 1);
  }
}

function drawCards(state: DuelState, side: Side, count: number) {
  const player = state.players[side];
  let drawn = 0;
  for (let index = 0; index < count; index += 1) {
    const card = player.deck.shift();
    if (!card) break;
    if (player.hand.length >= HAND_MAX) {
      player.graveyard.push(card);
      continue;
    }
    player.hand.push(card);
    drawn += 1;
  }
  return drawn;
}

function destroyCard(state: DuelState, target: Found, cause: string) {
  const list = state.lanes[target.lane].cards[target.side];
  const index = list.findIndex((card) => card.uid === target.card.uid);
  if (index < 0) return;
  list.splice(index, 1);
  // Cartas-ficha (Descendente) simplesmente desaparecem; as do Time vão para o cemitério.
  if (!target.card.def.token) state.players[target.side].graveyard.push({ uid: target.card.uid, def: target.card.def, bonus: 0 });
  emit(state, { type: "destroy", side: target.side, lane: target.lane, uid: target.card.uid, name: target.card.def.name, text: `${target.card.def.name} foi afastado${cause ? ` por ${cause}` : ""}.` });
  if (target.card.def.dom?.trigger === "destroyed") {
    for (const effect of target.card.def.dom.effects) applyEffect(state, { side: target.side, lane: target.lane, card: target.card }, effect, true);
  }
}

function moveEnemies(state: DuelState, ctx: Ctx) {
  const foeSide = other(ctx.side);
  if (laneScenario(state, ctx.lane).rule.kind === "noMove") return;
  for (const card of [...state.lanes[ctx.lane].cards[foeSide]]) {
    if (isProtected(state, { lane: ctx.lane, side: foeSide, card })) continue;
    // Destino: o cenário aberto com mais espaço livre para o rival (empate: o mais à esquerda).
    let best = -1;
    let bestFree = 0;
    for (let index = 0; index < LANES; index += 1) {
      if (index === ctx.lane || !isLaneOpen(state, index)) continue;
      const free = slotsOf(laneScenario(state, index)) - state.lanes[index].cards[foeSide].length;
      if (free > bestFree) {
        best = index;
        bestFree = free;
      }
    }
    if (best < 0) continue;
    const from = state.lanes[ctx.lane].cards[foeSide];
    from.splice(from.findIndex((entry) => entry.uid === card.uid), 1);
    state.lanes[best].cards[foeSide].push(card);
    emit(state, { type: "move", side: foeSide, lane: best, uid: card.uid, name: card.def.name, text: `${card.def.name} foi levado para outro cenário por ${ctx.card.def.name}.` });
  }
}

function applyEffect(state: DuelState, ctx: Ctx, effect: Effect, isDestroyedHook = false) {
  const self = ctx.card.def.name;
  switch (effect.kind) {
    case "power": {
      if (!checkCond(state, ctx, effect.when)) return;
      const targets = targetsOf(state, ctx, effect.to).filter((entry) => !(effect.amount < 0 && entry.side !== ctx.side && isProtected(state, entry)));
      if (targets.length === 0) return;
      for (const entry of targets) entry.card.bonus += effect.amount;
      const who = effect.to === "self" ? "" : ` em ${targets.length} carta${targets.length > 1 ? "s" : ""}`;
      emit(state, { type: "power", side: ctx.side, lane: ctx.lane, uid: ctx.card.uid, name: self, amount: effect.amount, text: `${self}: ${effect.amount >= 0 ? "+" : ""}${effect.amount} de Influência${who}.` });
      return;
    }
    case "powerPer": {
      const count = countMatching(state, { lane: ctx.lane, side: ctx.side, card: ctx.card }, effect.per);
      const amount = effect.amount * count;
      if (amount === 0) return;
      ctx.card.bonus += amount;
      emit(state, { type: "power", side: ctx.side, lane: ctx.lane, uid: ctx.card.uid, name: self, amount, text: `${self}: ${amount >= 0 ? "+" : ""}${amount} de Influência.` });
      return;
    }
    case "draw": {
      if (isDestroyedHook) return;
      const drawn = drawCards(state, ctx.side, effect.count);
      if (drawn > 0) emit(state, { type: "draw", side: ctx.side, name: self, amount: drawn, text: `${self}: comprou ${drawn} carta${drawn > 1 ? "s" : ""}.` });
      return;
    }
    case "destroy": {
      if (!checkCond(state, ctx, effect.when)) return;
      const targets =
        effect.target === "allHere"
          ? [0, 1].flatMap((side) => state.lanes[ctx.lane].cards[side as Side].map((card) => ({ lane: ctx.lane, side: side as Side, card })))
          : targetsOf(state, ctx, effect.target);
      for (const entry of targets) {
        if (entry.side !== ctx.side && isProtected(state, entry)) continue;
        destroyCard(state, entry, self);
      }
      return;
    }
    case "moveEnemies":
      moveEnemies(state, ctx);
      return;
    case "silence": {
      const targets = targetsOf(state, ctx, "enemiesHere").filter((entry) => !entry.card.silenced && entry.card.def.dom?.trigger === "ongoing");
      for (const entry of targets) entry.card.silenced = true;
      if (targets.length > 0) emit(state, { type: "silence", side: ctx.side, lane: ctx.lane, name: self, text: `${self} calou os Dons contínuos do rival aqui.` });
      return;
    }
    case "create": {
      const token = TOKENS[effect.token];
      if (!token) return;
      const lanes = effect.where === "here" ? [ctx.lane] : state.lanes.map((_, index) => index).filter((index) => isLaneOpen(state, index));
      for (const index of lanes) {
        if (state.lanes[index].cards[ctx.side].length >= slotsOf(laneScenario(state, index))) continue;
        state.lanes[index].cards[ctx.side].push({ uid: state.nextUid++, def: token, bonus: 0, silenced: false, order: state.nextOrder++, turn: state.turn });
        emit(state, { type: "create", side: ctx.side, lane: index, name: token.name, text: `${self} criou ${token.name}.` });
      }
      return;
    }
    case "vanish": {
      const list = state.lanes[ctx.lane].cards[ctx.side];
      const index = list.findIndex((card) => card.uid === ctx.card.uid);
      if (index < 0) return;
      list.splice(index, 1);
      state.players[ctx.side].returning.push({ card: { uid: ctx.card.uid, def: ctx.card.def, bonus: ctx.card.bonus + effect.bonus }, atTurn: state.turn + effect.turns });
      emit(state, { type: "vanish", side: ctx.side, lane: ctx.lane, uid: ctx.card.uid, name: self, text: `${self} sumiu e volta em ${effect.turns} turnos.` });
      return;
    }
    case "protect":
    case "aura":
      return; // Contínuos: calculados em cardPower / isProtected.
  }
}

function runDom(state: DuelState, found: Found, trigger: Trigger) {
  const dom = found.card.def.dom;
  if (!dom || dom.trigger !== trigger) return;
  // Silenciar só corta o que é contínuo ou acontece depois; o "Ao revelar" já aconteceu.
  if (found.card.silenced && trigger !== "reveal" && trigger !== "destroyed") return;
  const ctx: Ctx = { side: found.side, lane: found.lane, card: found.card };
  for (const effect of dom.effects) applyEffect(state, ctx, effect);
}

// ---------------------------------------------------------------------------
// Jogadas
// ---------------------------------------------------------------------------

function stagedCost(state: DuelState, side: Side) {
  const player = state.players[side];
  return player.staged.reduce((sum, play) => sum + (player.hand.find((card) => card.uid === play.uid)?.def.cost ?? 0), 0);
}

/** Motivo pelo qual não dá para jogar a carta no cenário agora, ou null se dá. */
export function whyNotStage(state: DuelState, side: Side, uid: number, lane: number): string | null {
  if (state.status !== "playing") return "O duelo terminou.";
  const player = state.players[side];
  if (player.ready) return "Você já terminou o turno.";
  const card = player.hand.find((entry) => entry.uid === uid);
  if (!card) return "Essa carta não está na sua mão.";
  if (player.staged.some((play) => play.uid === uid)) return "Essa carta já foi colocada.";
  if (!isLaneOpen(state, lane)) return "Esse cenário ainda não apareceu.";
  const slots = slotsOf(laneScenario(state, lane));
  const used = state.lanes[lane].cards[side].length + player.staged.filter((play) => play.lane === lane).length;
  if (used >= slots) return "Esse cenário está cheio.";
  if (stagedCost(state, side) + card.def.cost > energyOf(state)) return "Vigor insuficiente.";
  return null;
}

export function stage(state: DuelState, side: Side, uid: number, lane: number): DuelState {
  const why = whyNotStage(state, side, uid, lane);
  if (why) throw new Error(why);
  const next = clone(state);
  next.players[side].staged.push({ uid, lane });
  return next;
}

export function unstage(state: DuelState, side: Side, uid: number): DuelState {
  if (state.status !== "playing" || state.players[side].ready) return state;
  const next = clone(state);
  next.players[side].staged = next.players[side].staged.filter((play) => play.uid !== uid);
  return next;
}

/** Marca "Pronto". Quando os dois estão prontos, o turno é resolvido. */
export function setReady(state: DuelState, side: Side): DuelState {
  if (state.status !== "playing") return state;
  const next = clone(state);
  next.players[side].ready = true;
  if (next.players[0].ready && next.players[1].ready) resolveTurn(next);
  return next;
}

/** Quem está na frente revela primeiro: mais cenários, depois mais Influência total, depois sorteio. */
function decidePriority(state: DuelState): Side {
  const wins: [number, number] = [0, 0];
  const totals: [number, number] = [0, 0];
  for (let index = 0; index < Math.min(state.turn, LANES); index += 1) {
    const winner = laneWinner(state, index);
    if (winner !== null) wins[winner] += 1;
    totals[0] += lanePower(state, index, 0);
    totals[1] += lanePower(state, index, 1);
  }
  if (wins[0] !== wins[1]) return wins[0] > wins[1] ? 0 : 1;
  if (totals[0] !== totals[1]) return totals[0] > totals[1] ? 0 : 1;
  const roll = nextRandom(state.rng);
  state.rng = roll.seed;
  return roll.value < 0.5 ? 0 : 1;
}

function revealPlay(state: DuelState, side: Side, play: Staged, spent: { value: number }) {
  const player = state.players[side];
  const handIndex = player.hand.findIndex((card) => card.uid === play.uid);
  if (handIndex < 0) return;
  const card = player.hand[handIndex];
  if (spent.value + card.def.cost > energyOf(state)) return;
  if (!isLaneOpen(state, play.lane)) return;

  let target = play.lane;
  const origin = state.lanes[target];
  const rule = scenarioOf(origin.scenario).rule;
  // Babilônia: a primeira carta de cada lado vai para o cenário da direita, se houver espaço.
  if (rule.kind === "shiftFirst" && origin.played[side] === 0 && isLaneOpen(state, target + 1) && state.lanes[target + 1].cards[side].length < slotsOf(laneScenario(state, target + 1))) {
    target += 1;
  }
  if (state.lanes[target].cards[side].length >= slotsOf(laneScenario(state, target))) {
    emit(state, { type: "play", side, lane: target, name: card.def.name, text: `${card.def.name} não coube e voltou à mão.` });
    return;
  }

  spent.value += card.def.cost;
  player.hand.splice(handIndex, 1);
  origin.played[side] += 1;
  const placed: PlacedCard = { uid: card.uid, def: card.def, bonus: card.bonus, silenced: false, order: state.nextOrder++, turn: state.turn };
  state.lanes[target].cards[side].push(placed);
  emit(state, { type: "reveal", side, lane: target, uid: placed.uid, name: placed.def.name, text: target !== play.lane ? `${placed.def.name} foi levado para ${laneScenario(state, target).name}.` : `${placed.def.name} entrou em ${laneScenario(state, target).name}.` });

  runDom(state, { lane: target, side, card: placed }, "reveal");
  // "Quando uma carta sua é jogada aqui": as outras cartas suas neste cenário reagem.
  const current = findCard(state, placed.uid);
  if (current) {
    for (const mate of [...state.lanes[current.lane].cards[side]]) {
      if (mate.uid !== placed.uid) runDom(state, { lane: current.lane, side, card: mate }, "allyPlayed");
    }
  }
}

function endOfTurn(state: DuelState) {
  state.lanes.forEach((lane, index) => {
    if (!isLaneOpen(state, index)) return;
    const rule = scenarioOf(lane.scenario).rule;
    if (rule.kind === "decay") {
      for (const side of [0, 1] as Side[]) {
        const cards = lane.cards[side];
        if (cards.length === 0) continue;
        const weakest = [...cards].sort((a, b) => cardPower(state, index, side, a) - cardPower(state, index, side, b) || a.order - b.order)[0];
        // A praga não leva ninguém abaixo de zero.
        if (cardPower(state, index, side, weakest) <= 0) continue;
        weakest.bonus -= rule.amount;
        emit(state, { type: "power", side, lane: index, uid: weakest.uid, name: weakest.def.name, amount: -rule.amount, text: `${scenarioOf(lane.scenario).name}: ${weakest.def.name} perdeu ${rule.amount}.` });
      }
    }
    if (rule.kind === "stormAt" && state.turn === rule.turn) {
      for (const side of [0, 1] as Side[]) for (const card of lane.cards[side]) card.bonus -= rule.amount;
      emit(state, { type: "power", lane: index, amount: -rule.amount, text: `${scenarioOf(lane.scenario).emoji} Tempestade em ${scenarioOf(lane.scenario).name}: todas as cartas perderam ${rule.amount}.` });
    }
  });
  for (const entry of allCards(state)) {
    if (findCard(state, entry.card.uid)) runDom(state, entry, "turnEnd");
  }
}

function finish(state: DuelState, retreated: Side | null = null) {
  if (retreated === null) {
    // "Ao fim do duelo", cenário por cenário, quem revelou primeiro no último turno antes.
    const first = state.priority ?? 0;
    for (let laneIndex = 0; laneIndex < LANES; laneIndex += 1) {
      for (const side of [first, other(first)]) {
        for (const card of [...state.lanes[laneIndex].cards[side]]) {
          if (findCard(state, card.uid)) runDom(state, { lane: laneIndex, side, card }, "gameEnd");
        }
      }
    }
  }
  const lanes: DuelResult["lanes"] = [];
  const wins: [number, number] = [0, 0];
  const totals: [number, number] = [0, 0];
  for (let index = 0; index < LANES; index += 1) {
    const power: [number, number] = [lanePower(state, index, 0), lanePower(state, index, 1)];
    const winner = power[0] === power[1] ? null : power[0] > power[1] ? 0 : 1;
    lanes.push({ winner, power });
    if (winner !== null) wins[winner] += 1;
    totals[0] += power[0];
    totals[1] += power[1];
    const rule = laneScenario(state, index).rule;
    if (rule.kind === "winnerBonus" && winner !== null) totals[winner] += rule.amount;
  }
  let winner: Side | null;
  if (retreated !== null) winner = other(retreated);
  else if (wins[0] !== wins[1]) winner = wins[0] > wins[1] ? 0 : 1;
  else winner = totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1;
  state.status = "finished";
  state.result = { winner, lanes, totals, retreated, stakes: state.stakes };
  emit(state, { type: "win", side: winner ?? undefined, text: winner === null ? "Empate!" : retreated !== null ? "O rival desistiu." : "Fim do duelo." });
}

function nextTurn(state: DuelState) {
  state.turn += 1;
  state.events.push({ type: "turn", text: `Turno ${state.turn}` });
  for (const side of [0, 1] as Side[]) {
    const player = state.players[side];
    const back = player.returning.filter((entry) => entry.atTurn <= state.turn);
    player.returning = player.returning.filter((entry) => entry.atTurn > state.turn);
    for (const entry of back) {
      if (player.hand.length < HAND_MAX) {
        player.hand.push(entry.card);
        emit(state, { type: "return", side, name: entry.card.def.name, text: `${entry.card.def.name} voltou à mão.` });
      } else {
        player.graveyard.push(entry.card);
      }
    }
    drawCards(state, side, 1);
    player.staged = [];
    player.ready = false;
  }
  if (state.turn <= LANES) {
    const scenario = laneScenario(state, state.turn - 1);
    emit(state, { type: "scenario", lane: state.turn - 1, text: `${scenario.emoji} ${scenario.name}: ${scenario.text}` });
  }
}

function resolveTurn(state: DuelState) {
  state.events = [];
  const first = decidePriority(state);
  state.priority = first;
  const spent: [{ value: number }, { value: number }] = [{ value: 0 }, { value: 0 }];
  for (const side of [first, other(first)]) {
    for (const play of state.players[side].staged) revealPlay(state, side, play, spent[side]);
  }
  endOfTurn(state);
  if (state.turn >= TURNS) finish(state);
  else nextTurn(state);
}

// ---------------------------------------------------------------------------
// Aposta
// ---------------------------------------------------------------------------

export function whyNotDouble(state: DuelState, side: Side): string | null {
  if (state.status !== "playing") return "O duelo terminou.";
  if (state.players[side].doubledTurn > 0) return "Você já dobrou a aposta.";
  if (state.stakes >= MAX_STAKES) return "A aposta já está no máximo.";
  return null;
}

/** Dobra a aposta (1 → 2 → 4 → 8). Cada jogador dobra no máximo uma vez. */
export function doubleStakes(state: DuelState, side: Side): DuelState {
  const why = whyNotDouble(state, side);
  if (why) throw new Error(why);
  const next = clone(state);
  next.stakes *= 2;
  next.players[side].doubledTurn = next.turn;
  next.events = [...next.events, { type: "double", side, text: `A aposta dobrou: agora vale ${next.stakes}.` }];
  return next;
}

export function whyNotRetreat(state: DuelState, side: Side): string | null {
  if (state.status !== "playing") return "O duelo terminou.";
  if (state.players[side].doubledTurn === state.turn) return "Não dá para desistir no turno em que você dobrou.";
  return null;
}

/** Desiste da rodada: perde o que está em jogo (a aposta atual). */
export function retreat(state: DuelState, side: Side): DuelState {
  const why = whyNotRetreat(state, side);
  if (why) throw new Error(why);
  const next = clone(state);
  next.events = [{ type: "retreat", side, text: "Desistiu da rodada." }];
  finish(next, side);
  return next;
}

// ---------------------------------------------------------------------------
// Visão de cada jogador (o que pode sair do servidor)
// ---------------------------------------------------------------------------

export type ViewCard = PlacedCard & { power: number };

export type ViewLane = {
  open: boolean;
  /** Nulo enquanto o cenário não apareceu. */
  scenario: ScenarioDef | null;
  slots: number;
  cards: [ViewCard[], ViewCard[]];
  power: [number, number];
};

export type DuelView = {
  you: Side;
  turn: number;
  energy: number;
  status: DuelState["status"];
  stakes: number;
  priority: Side | null;
  lanes: ViewLane[];
  hand: Card[];
  deckCount: number;
  staged: Staged[];
  ready: boolean;
  /** Vigor ainda disponível neste turno, descontando as cartas já colocadas. */
  energyLeft: number;
  canDouble: boolean;
  canRetreat: boolean;
  opponent: { handCount: number; deckCount: number; ready: boolean; doubled: boolean };
  you_doubled: boolean;
  events: DuelEvent[];
  result: DuelResult | null;
};

export function viewFor(state: DuelState, side: Side): DuelView {
  const foe = other(side);
  const me = state.players[side];
  const lanes: ViewLane[] = state.lanes.map((lane, index) => {
    const open = isLaneOpen(state, index);
    const scenario = open || state.status === "finished" ? scenarioOf(lane.scenario) : null;
    const decorate = (list: PlacedCard[], who: Side): ViewCard[] => list.map((card) => ({ ...clone(card), power: cardPower(state, index, who, card) }));
    return {
      open,
      scenario,
      slots: scenario ? slotsOf(scenario) : MAX_SLOTS,
      cards: [decorate(lane.cards[0], 0), decorate(lane.cards[1], 1)],
      power: open ? [lanePower(state, index, 0), lanePower(state, index, 1)] : [0, 0],
    };
  });
  return {
    you: side,
    turn: state.turn,
    energy: energyOf(state),
    status: state.status,
    stakes: state.stakes,
    priority: state.priority,
    lanes,
    hand: clone(me.hand),
    deckCount: me.deck.length,
    staged: clone(me.staged),
    ready: me.ready,
    energyLeft: energyOf(state) - stagedCost(state, side),
    canDouble: whyNotDouble(state, side) === null,
    canRetreat: whyNotRetreat(state, side) === null,
    opponent: { handCount: state.players[foe].hand.length, deckCount: state.players[foe].deck.length, ready: state.players[foe].ready, doubled: state.players[foe].doubledTurn > 0 },
    you_doubled: me.doubledTurn > 0,
    events: state.events,
    result: state.result,
  };
}

// ---------------------------------------------------------------------------
// Previsão (para os bots)
// ---------------------------------------------------------------------------

/**
 * Monta um estado aproximado a partir do que um jogador vê: o rival aparece sem mão nem baralho. Serve só para
 * os bots "experimentarem" jogadas; nunca para decidir o duelo de verdade.
 */
export function stateFromView(view: DuelView, seed: number): DuelState {
  const side = view.you;
  const lanes: Lane[] = view.lanes.map((lane) => ({
    scenario: lane.scenario?.id ?? SCENARIOS[0].id,
    cards: [lane.cards[0].map(({ power: _power, ...card }) => card), lane.cards[1].map(({ power: _power, ...card }) => card)],
    played: [lane.cards[0].length, lane.cards[1].length],
  }));
  const empty = (): PlayerState => ({ deck: [], hand: [], graveyard: [], returning: [], staged: [], ready: false, doubledTurn: 0 });
  const players: [PlayerState, PlayerState] = [empty(), empty()];
  players[side] = { ...empty(), hand: clone(view.hand), deck: [] };
  const maxOrder = lanes.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).reduce((max, card) => Math.max(max, card.order), 0);
  const maxUid = lanes.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).reduce((max, card) => Math.max(max, card.uid), 1000);
  return { rng: seed, turn: view.turn, status: "playing", lanes, players, nextUid: maxUid + 1, nextOrder: maxOrder + 1, priority: view.priority, stakes: view.stakes, events: [], result: null };
}

/** Revela só as jogadas de `side` (sem fim de turno nem jogadas do rival) e devolve o estado resultante. */
export function previewReveal(state: DuelState, side: Side, plays: Staged[]): DuelState {
  const draft = clone(state);
  draft.events = [];
  const spent = { value: 0 };
  for (const play of plays) revealPlay(draft, side, play, spent);
  return draft;
}
