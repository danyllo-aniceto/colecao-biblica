/**
 * Motor do Modo Duelo: regras puras, sem banco e sem dependências, para rodar igual no navegador
 * (treino contra bot) e no servidor (salas online). Cada função recebe o estado e devolve um estado novo
 * (o original nunca é alterado). O sorteio usa uma semente guardada no estado, então a mesma partida
 * se repete igual (testes e revanche).
 *
 * Informação escondida: a mão e o Time do rival, a ordem do baralho, as jogadas ainda não reveladas e os
 * cenários que ainda não apareceram. Quem chama (o servidor) deve mandar ao cliente só `viewFor(...)`.
 */
import { describeDom, levelDef } from "./cards";
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
  type SnapCard,
  type Snapshot,
  type Staged,
  type Target,
  type TeamCard,
  type Trigger,
} from "./types";

// ---------------------------------------------------------------------------
// Figurinhas-ficha (criadas por Dons)
// ---------------------------------------------------------------------------

export const TOKENS: Record<string, CardDef> = {
  Descendente: { id: "token:descendente", name: "Descendente", cost: 0, power: 1, tags: ["Descendente"], token: true },
  Ovelha: { id: "token:ovelha", name: "Ovelha", cost: 0, power: 1, tags: ["Pastor"], token: true },
  Pão: { id: "token:pao", name: "Pão", cost: 0, power: 2, tags: ["Alimento"], token: true },
  Peixe: { id: "token:peixe", name: "Peixe", cost: 0, power: 1, tags: ["Alimento"], token: true },
  Soldado: { id: "token:soldado", name: "Soldado", cost: 0, power: 2, tags: ["Guerreiro"], token: true },
};

// ---------------------------------------------------------------------------
// Criação
// ---------------------------------------------------------------------------

export type NewDuelInput = {
  teams: [TeamCard[], TeamCard[]];
  seed: number;
  /** Cenários dos três lugares (identificadores); sem isso, são sorteados. */
  scenarios?: [string, string, string];
  /** A aposta (Dobrar) vale algo nesta partida? Falso na rodada única. Padrão: sim. */
  stakesMatter?: boolean;
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
    return { deck: mixed.items.slice(START_HAND), hand: mixed.items.slice(0, START_HAND), graveyard: [], returning: [], staged: [], ready: false, doubledTurn: 0, energyBonus: 0, nextEnergyBonus: 0 };
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
    stakesMatter: input.stakesMatter !== false,
    events: [{ type: "scenario", lane: 0, text: `${scenarioOf(scenarioIds[0]).emoji} ${scenarioOf(scenarioIds[0]).name}: ${scenarioOf(scenarioIds[0]).text}` }],
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Vigor do jogador no turno: o número do turno mais o que um Dom deu a mais. */
export function energyFor(state: DuelState, side: Side) {
  return state.turn + state.players[side].energyBonus;
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
  const lanes = count.of === "alliesHere" || count.of === "enemiesHere" || count.of === "cardsHere" ? [source.lane] : state.lanes.map((_, index) => index);
  const sides: Side[] = count.of === "enemiesHere" ? [other(source.side)] : count.of === "cardsHere" ? [0, 1] : [source.side];
  let total = 0;
  for (const laneIndex of lanes) {
    for (const side of sides) {
      for (const card of state.lanes[laneIndex].cards[side]) {
        if (card.uid === source.card.uid) continue;
        if (count.tag && !card.def.tags.includes(count.tag)) continue;
        if (count.cost !== undefined && card.def.cost !== count.cost) continue;
        total += 1;
      }
    }
  }
  return total;
}

/** Influência atual de uma figurinha: base + bônus permanentes + Dons contínuos + regra do cenário. */
export function cardPower(state: DuelState, laneIndex: number, side: Side, card: PlacedCard): number {
  let power = card.def.power + card.bonus;
  const here = state.lanes[laneIndex].cards[side];
  const dom = card.def.dom;
  if (dom?.trigger === "ongoing" && !card.silenced) {
    for (const effect of dom.effects) {
      if (effect.kind === "powerPer") power += effect.amount * countMatching(state, { lane: laneIndex, side, card }, effect.per);
    }
  }
  // Auras de outras figurinhas suas.
  state.lanes.forEach((lane, index) => {
    for (const source of lane.cards[side]) {
      if (source.uid === card.uid || source.silenced || source.def.dom?.trigger !== "ongoing") continue;
      for (const effect of source.def.dom.effects) {
        if (effect.kind !== "aura") continue;
        if (effect.tag && !card.def.tags.includes(effect.tag)) continue;
        if (effect.to === "alliesHere" && index === laneIndex) power += effect.amount;
        if (effect.to === "adjacent" && Math.abs(index - laneIndex) === 1) power += effect.amount;
        if (effect.to === "allies") power += effect.amount;
      }
    }
  });
  // Regras de cenário que mexem em cada figurinha.
  const rule = laneScenario(state, laneIndex).rule;
  if (rule.kind === "cheapBonus" && card.def.cost === 1) power += rule.amount;
  if (rule.kind === "sharedTag" && here.some((mate) => mate.uid !== card.uid && mate.def.tags.some((tag) => card.def.tags.includes(tag)))) power += rule.amount;
  return power;
}

/** Bônus do cenário que vale para o lado todo (não é de uma figurinha). */
function laneBonus(state: DuelState, laneIndex: number, side: Side): number {
  const rule = laneScenario(state, laneIndex).rule;
  const mine = state.lanes[laneIndex].cards[side];
  const theirs = state.lanes[laneIndex].cards[other(side)];
  if (rule.kind === "majority" && mine.length > theirs.length) return rule.amount;
  // Quem tem menos figurinhas (e ao menos uma) ganha o bônus; empate de quantidade não dá nada.
  if (rule.kind === "underdog" && mine.length > 0 && mine.length < theirs.length) return rule.amount;
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

/** Foto do tabuleiro agora (a tela usa a de antes do turno como ponto de partida da repetição). */
export function snapshotOf(state: DuelState): Snapshot {
  return state.lanes.map((lane, index) => {
    const open = isLaneOpen(state, index);
    // Arena ainda fechada: as figurinhas jogadas lá já aparecem, mas só com a Influência própria (a regra do cenário é segredo).
    const decorate = (side: Side): SnapCard[] => lane.cards[side].map((card) => ({ uid: card.uid, def: card.def, power: open ? cardPower(state, index, side, card) : card.def.power + card.bonus, silenced: card.silenced }));
    return { open, cards: [decorate(0), decorate(1)], power: open ? [lanePower(state, index, 0), lanePower(state, index, 1)] : [0, 0] };
  });
}

/** Foto do tabuleiro a partir do que um jogador vê (a tela online usa a da visão anterior como ponto de partida da repetição). */
export function snapshotOfView(view: DuelView): Snapshot {
  return view.lanes.map((lane) => ({
    open: lane.open,
    cards: [lane.cards[0].map((card) => ({ uid: card.uid, def: card.def, power: card.power, silenced: card.silenced })), lane.cards[1].map((card) => ({ uid: card.uid, def: card.def, power: card.power, silenced: card.silenced }))],
    power: lane.open ? lane.power : [0, 0],
  }));
}

function emit(state: DuelState, event: DuelEvent) {
  state.events.push({ ...event, snap: snapshotOf(state) });
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
    case "laneWinning":
      return lanePower(state, ctx.lane, ctx.side) > lanePower(state, ctx.lane, other(ctx.side));
    case "alone":
      return state.lanes[ctx.lane].cards[ctx.side].every((card) => card.uid === ctx.card.uid);
    case "handAtMost":
      return state.players[ctx.side].hand.length <= cond.count;
    case "enemyHereTag":
      return state.lanes[ctx.lane].cards[other(ctx.side)].some((card) => card.def.tags.includes(cond.tag));
    case "allyHereTag":
      return state.lanes[ctx.lane].cards[ctx.side].some((card) => card.uid !== ctx.card.uid && card.def.tags.includes(cond.tag));
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
    case "enemiesAll":
      return allCards(state).filter((entry) => entry.side === other(ctx.side));
    case "hand":
      return [];
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
  // Figurinhas-ficha (Descendente) simplesmente desaparecem; as do Time vão para o cemitério.
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
      if (effect.to === "hand") {
        const hand = state.players[ctx.side].hand;
        if (hand.length === 0) return;
        for (const card of hand) card.bonus += effect.amount;
        emit(state, { type: "power", side: ctx.side, lane: ctx.lane, uid: ctx.card.uid, name: self, amount: effect.amount, text: `${self}: ${effect.amount >= 0 ? "+" : ""}${effect.amount} de Influência nas figurinhas da mão.` });
        return;
      }
      const targets = targetsOf(state, ctx, effect.to).filter((entry) => !(effect.amount < 0 && entry.side !== ctx.side && isProtected(state, entry)));
      if (targets.length === 0) return;
      for (const entry of targets) entry.card.bonus += effect.amount;
      const who = effect.to === "self" ? "" : ` em ${targets.length} figurinha${targets.length > 1 ? "s" : ""}`;
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
      if (drawn > 0) emit(state, { type: "draw", side: ctx.side, name: self, amount: drawn, text: `${self}: comprou ${drawn} figurinha${drawn > 1 ? "s" : ""}.` });
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
      const lanes =
        effect.where === "here"
          ? [ctx.lane]
          : effect.where === "neighbors"
            ? [ctx.lane - 1, ctx.lane + 1].filter((index) => isLaneOpen(state, index))
            : state.lanes.map((_, index) => index).filter((index) => isLaneOpen(state, index));
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
    case "bounce": {
      const target = targetsOf(state, ctx, effect.target).find((entry) => !isProtected(state, entry));
      if (!target) return;
      const list = state.lanes[target.lane].cards[target.side];
      list.splice(list.findIndex((card) => card.uid === target.card.uid), 1);
      const hand = state.players[target.side].hand;
      if (target.card.def.token) return;
      if (hand.length < HAND_MAX) hand.push({ uid: target.card.uid, def: target.card.def, bonus: 0 });
      else state.players[target.side].graveyard.push({ uid: target.card.uid, def: target.card.def, bonus: 0 });
      emit(state, { type: "bounce", side: target.side, lane: target.lane, uid: target.card.uid, name: target.card.def.name, text: `${target.card.def.name} voltou para a mão do dono por ${self}.` });
      return;
    }
    case "discard": {
      const foe = state.players[other(ctx.side)];
      let dropped = 0;
      for (let step = 0; step < effect.count; step += 1) {
        const target = [...foe.hand].sort((a, b) => b.def.cost - a.def.cost || b.def.power - a.def.power || a.uid - b.uid)[0];
        if (!target) break;
        foe.hand.splice(foe.hand.findIndex((card) => card.uid === target.uid), 1);
        foe.graveyard.push(target);
        dropped += 1;
      }
      if (dropped > 0) emit(state, { type: "discard", side: other(ctx.side), name: self, amount: dropped, text: `${self}: o rival descartou ${dropped} figurinha${dropped > 1 ? "s" : ""}.` });
      return;
    }
    case "energy": {
      state.players[ctx.side].nextEnergyBonus += effect.amount;
      emit(state, { type: "energy", side: ctx.side, name: self, amount: effect.amount, text: `${self}: +${effect.amount} de Vigor no próximo turno.` });
      return;
    }
    case "cheaper": {
      const hand = state.players[ctx.side].hand;
      if (hand.length === 0) return;
      for (const card of hand) card.def = { ...card.def, cost: Math.max(0, card.def.cost - effect.amount) };
      emit(state, { type: "energy", side: ctx.side, name: self, amount: effect.amount, text: `${self}: as figurinhas da mão custam ${effect.amount} a menos de Vigor.` });
      return;
    }
    case "convert": {
      const target = targetsOf(state, ctx, "weakestEnemyHere").find((entry) => !isProtected(state, entry));
      if (!target || state.lanes[ctx.lane].cards[ctx.side].length >= slotsOf(laneScenario(state, ctx.lane))) return;
      const foe = state.lanes[ctx.lane].cards[target.side];
      foe.splice(foe.findIndex((card) => card.uid === target.card.uid), 1);
      target.card.order = state.nextOrder++;
      target.card.silenced = false;
      state.lanes[ctx.lane].cards[ctx.side].push(target.card);
      emit(state, { type: "convert", side: ctx.side, lane: ctx.lane, uid: target.card.uid, name: target.card.def.name, text: `${self} trouxe ${target.card.def.name} para o seu lado.` });
      return;
    }
    case "sacrifice": {
      const target = targetsOf(state, ctx, "weakestAllyHere")[0];
      if (!target) return;
      destroyCard(state, target, "");
      ctx.card.bonus += effect.gain;
      emit(state, { type: "power", side: ctx.side, lane: ctx.lane, uid: ctx.card.uid, name: self, amount: effect.gain, text: `${self}: ofereceu ${target.card.def.name} e ganhou +${effect.gain} de Influência.` });
      return;
    }
    case "multiply": {
      const now = cardPower(state, ctx.lane, ctx.side, ctx.card);
      const extra = Math.round(now * (effect.factor - 1));
      if (extra === 0) return;
      ctx.card.bonus += extra;
      emit(state, { type: "power", side: ctx.side, lane: ctx.lane, uid: ctx.card.uid, name: self, amount: extra, text: `${self}: ${effect.factor}× de Influência (${extra >= 0 ? "+" : ""}${extra}).` });
      return;
    }
    case "relocate": {
      if (laneScenario(state, ctx.lane).rule.kind === "noMove") return;
      let best = -1;
      let bestPower = Infinity;
      for (let index = 0; index < LANES; index += 1) {
        if (index === ctx.lane || !isLaneOpen(state, index) || state.lanes[index].cards[ctx.side].length >= slotsOf(laneScenario(state, index))) continue;
        const power = lanePower(state, index, ctx.side);
        if (power < bestPower) {
          best = index;
          bestPower = power;
        }
      }
      if (best < 0) return;
      const from = state.lanes[ctx.lane].cards[ctx.side];
      const [card] = from.splice(from.findIndex((entry) => entry.uid === ctx.card.uid), 1);
      if (!card) return;
      state.lanes[best].cards[ctx.side].push(card);
      emit(state, { type: "move", side: ctx.side, lane: best, uid: card.uid, name: card.def.name, text: `${card.def.name} foi reforçar ${laneScenario(state, best).name}.` });
      return;
    }
    case "revive": {
      const player = state.players[ctx.side];
      let back = 0;
      for (let step = 0; step < effect.count; step += 1) {
        const index = [...player.graveyard].reverse().findIndex((card) => !card.def.token);
        if (index < 0 || player.hand.length >= HAND_MAX) break;
        const [card] = player.graveyard.splice(player.graveyard.length - 1 - index, 1);
        player.hand.push({ uid: card.uid, def: card.def, bonus: 0 });
        back += 1;
      }
      if (back > 0) emit(state, { type: "return", side: ctx.side, name: self, amount: back, text: `${self}: ${back} figurinha${back > 1 ? "s" : ""} voltou à mão.` });
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

/** Motivo pelo qual não dá para jogar a figurinha no cenário agora, ou null se dá. */
/** Nome da arena para os textos: o do cenário se já apareceu; senão só o número (o cenário ainda é segredo). */
function arenaName(state: DuelState, lane: number) {
  return isLaneOpen(state, lane) ? laneScenario(state, lane).name : `a arena ${lane + 1}`;
}

export function whyNotStage(state: DuelState, side: Side, uid: number, lane: number): string | null {
  if (state.status !== "playing") return "O duelo terminou.";
  const player = state.players[side];
  if (player.ready) return "Você já terminou o turno.";
  const card = player.hand.find((entry) => entry.uid === uid);
  if (!card) return "Essa figurinha não está na sua mão.";
  if (player.staged.some((play) => play.uid === uid)) return "Essa figurinha já foi colocada.";
  if (!Number.isInteger(lane) || lane < 0 || lane >= LANES) return "Essa arena não existe.";
  // Dá para jogar numa arena que ainda não apareceu (às cegas): o espaço só é conferido de verdade na revelação.
  const slots = isLaneOpen(state, lane) ? slotsOf(laneScenario(state, lane)) : MAX_SLOTS;
  const used = state.lanes[lane].cards[side].length + player.staged.filter((play) => play.lane === lane).length;
  if (used >= slots) return "Esse cenário está cheio.";
  if (stagedCost(state, side) + card.def.cost > energyFor(state, side)) return "Vigor insuficiente.";
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
  if (spent.value + card.def.cost > energyFor(state, side)) return;
  if (play.lane < 0 || play.lane >= LANES) return;

  let target = play.lane;
  const origin = state.lanes[target];
  const rule = scenarioOf(origin.scenario).rule;
  // Babilônia: a primeira figurinha de cada lado vai para o cenário da direita, se houver espaço.
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
  emit(state, {
    type: "reveal",
    side,
    lane: target,
    uid: placed.uid,
    name: placed.def.name,
    text: target !== play.lane ? `${placed.def.name} foi levado para ${arenaName(state, target)}.` : `${placed.def.name} entrou em ${arenaName(state, target)}.`,
    ...(placed.def.dom ? { dom: describeDom(placed.def.dom) } : {}),
    ...(target !== play.lane ? { fromLane: play.lane } : {}),
  });

  runDom(state, { lane: target, side, card: placed }, "reveal");
  // "Quando uma figurinha sua é jogada aqui": as outras figurinhas suas neste cenário reagem.
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
    if (rule.kind === "decayStrongest" || rule.kind === "growWeakest") {
      const strongest = rule.kind === "decayStrongest";
      for (const side of [0, 1] as Side[]) {
        const cards = lane.cards[side];
        if (cards.length === 0) continue;
        // Mais forte ou mais fraca; no empate, a que entrou primeiro.
        const target = [...cards].sort((a, b) => (strongest ? -1 : 1) * (cardPower(state, index, side, a) - cardPower(state, index, side, b)) || a.order - b.order)[0];
        // A queda não leva ninguém abaixo de zero.
        if (strongest && cardPower(state, index, side, target) <= 0) continue;
        const amount = strongest ? -rule.amount : rule.amount;
        target.bonus += amount;
        emit(state, {
          type: "power",
          side,
          lane: index,
          uid: target.uid,
          name: target.def.name,
          amount,
          text: strongest ? `${scenarioOf(lane.scenario).name}: ${target.def.name}, a mais forte, perdeu ${rule.amount}.` : `${scenarioOf(lane.scenario).name}: ${target.def.name}, a mais fraca, subiu ${rule.amount}.`,
        });
      }
    }
    if (rule.kind === "stormAt" && state.turn === rule.turn) {
      for (const side of [0, 1] as Side[]) for (const card of lane.cards[side]) card.bonus -= rule.amount;
      emit(state, { type: "power", lane: index, amount: -rule.amount, text: `${scenarioOf(lane.scenario).emoji} Tempestade em ${scenarioOf(lane.scenario).name}: todas as figurinhas perderam ${rule.amount}.` });
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
  emit(state, { type: "turn", text: `Turno ${state.turn}` });
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
    player.energyBonus = player.nextEnergyBonus;
    player.nextEnergyBonus = 0;
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
  if (state.stakesMatter === false) return "Na rodada única a aposta não vale nada. Dobrar só vale em Melhor de 3 e Vidas.";
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
  emit(next, { type: "double", side, amount: next.stakes, text: `A aposta dobrou: agora vale ${next.stakes}.` });
  return next;
}

export function whyNotRetreat(state: DuelState, side: Side): string | null {
  if (state.status !== "playing") return "O duelo terminou.";
  if (state.players[side].doubledTurn === state.turn) return "Não dá para desistir no turno em que você dobrou.";
  return null;
}

/** Quanto custa desistir agora: a aposta atual; se o rival acabou de dobrar neste turno, só o que valia antes dele dobrar (como no Snap). */
export function retreatCost(state: DuelState, side: Side): number {
  const foeDoubledNow = state.players[other(side)].doubledTurn === state.turn;
  return foeDoubledNow ? Math.max(1, state.stakes / 2) : state.stakes;
}

/** Desiste da rodada: perde o que está em jogo (veja `retreatCost`). */
export function retreat(state: DuelState, side: Side): DuelState {
  const why = whyNotRetreat(state, side);
  if (why) throw new Error(why);
  const next = clone(state);
  next.stakes = retreatCost(state, side);
  next.events = [];
  emit(next, { type: "retreat", side, text: "Desistiu da rodada." });
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
  /** Vigor ainda disponível neste turno, descontando as figurinhas já colocadas. */
  energyLeft: number;
  canDouble: boolean;
  canRetreat: boolean;
  /** A aposta vale algo nesta partida? (Falso na rodada única.) */
  stakesMatter: boolean;
  /** Quanto se perde ao desistir agora (se o rival acabou de dobrar, só o que valia antes). */
  retreatCost: number;
  /** O rival dobrou a aposta neste turno e você ainda decide: seguir ou desistir. */
  foeDoubledNow: boolean;
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
    // Arena fechada: só a Influência própria da figurinha (a do cenário é segredo até a arena aparecer).
    const decorate = (list: PlacedCard[], who: Side): ViewCard[] => list.map((card) => ({ ...clone(card), power: open || state.status === "finished" ? cardPower(state, index, who, card) : card.def.power + card.bonus }));
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
    energy: energyFor(state, side),
    status: state.status,
    stakes: state.stakes,
    priority: state.priority,
    lanes,
    hand: clone(me.hand),
    deckCount: me.deck.length,
    staged: clone(me.staged),
    ready: me.ready,
    energyLeft: energyFor(state, side) - stagedCost(state, side),
    canDouble: whyNotDouble(state, side) === null,
    canRetreat: whyNotRetreat(state, side) === null,
    stakesMatter: state.stakesMatter !== false,
    retreatCost: retreatCost(state, side),
    foeDoubledNow: state.status === "playing" && state.players[foe].doubledTurn === state.turn && state.players[side].doubledTurn !== state.turn,
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
  const empty = (): PlayerState => ({ deck: [], hand: [], graveyard: [], returning: [], staged: [], ready: false, doubledTurn: 0, energyBonus: 0, nextEnergyBonus: 0 });
  const players: [PlayerState, PlayerState] = [empty(), empty()];
  players[side] = { ...empty(), hand: clone(view.hand), deck: [] };
  const maxOrder = lanes.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).reduce((max, card) => Math.max(max, card.order), 0);
  const maxUid = lanes.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).reduce((max, card) => Math.max(max, card.uid), 1000);
  return { rng: seed, turn: view.turn, status: "playing", lanes, players, nextUid: maxUid + 1, nextOrder: maxOrder + 1, priority: view.priority, stakes: view.stakes, stakesMatter: view.stakesMatter, events: [], result: null };
}

/** Revela só as jogadas de `side` (sem fim de turno nem jogadas do rival) e devolve o estado resultante. */
export function previewReveal(state: DuelState, side: Side, plays: Staged[]): DuelState {
  const draft = clone(state);
  draft.events = [];
  const spent = { value: 0 };
  for (const play of plays) revealPlay(draft, side, play, spent);
  return draft;
}
