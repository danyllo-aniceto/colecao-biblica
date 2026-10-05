import { TEAM_SIZE, type CardDef, type Cond, type Count, type Dom, type Effect, type Target, type TeamCard } from "./types";

// ---------------------------------------------------------------------------
// Nível da figurinha
// ---------------------------------------------------------------------------

export const MAX_CARD_LEVEL = 5;

function bumpEffect(effect: Effect): Effect {
  if ("amount" in effect && effect.amount > 0) return { ...effect, amount: effect.amount + 1 };
  return effect;
}

/**
 * Ajusta a carta ao nível da figurinha: Nv2 e Nv4 dão +1 de Influência; Nv3 e Nv5 dão +1 no número do Dom
 * (o primeiro efeito que soma). Teto de +2 de Influência: meio Vigor, melhora sem quebrar o equilíbrio.
 */
export function levelDef(def: CardDef, level: number | undefined): CardDef {
  const lv = Math.min(MAX_CARD_LEVEL, Math.max(1, Math.floor(level ?? 1)));
  const power = def.power + (lv >= 2 ? 1 : 0) + (lv >= 4 ? 1 : 0);
  const domSteps = (lv >= 3 ? 1 : 0) + (lv >= 5 ? 1 : 0);
  let dom = def.dom;
  if (dom && domSteps > 0) {
    // O primeiro efeito numérico recebe os acréscimos.
    const effects = [...dom.effects];
    const index = effects.findIndex((effect) => "amount" in effect && effect.amount > 0);
    if (index >= 0) {
      let bumped = effects[index];
      for (let step = 0; step < domSteps; step += 1) bumped = bumpEffect(bumped);
      effects[index] = bumped;
      dom = { ...dom, effects, text: undefined };
    }
  }
  return { ...def, power, dom };
}

// ---------------------------------------------------------------------------
// Texto dos Dons
// ---------------------------------------------------------------------------

const signed = (amount: number) => (amount >= 0 ? `+${amount}` : `${amount}`);

const TARGETS: Record<Target, string> = {
  self: "esta carta",
  alliesHere: "suas cartas aqui",
  enemiesHere: "as cartas do rival aqui",
  otherAllies: "suas outras cartas",
  weakestEnemyHere: "a carta mais fraca do rival aqui",
  strongestEnemyHere: "a carta mais forte do rival aqui",
  weakestAllyHere: "sua carta mais fraca aqui",
};

function describeCond(cond: Cond): string {
  switch (cond.type) {
    case "enemyHerePower":
      return `se o rival tem aqui uma carta de ${cond.atLeast}+ de Influência`;
    case "enemyHereNamed":
      return `se o rival tem ${cond.name} aqui`;
    case "alliesHere":
      return `se você tem ${cond.atLeast}+ outras cartas aqui`;
    case "laneLosing":
      return "se este cenário estiver perdendo";
    case "turnAtLeast":
      return `a partir do turno ${cond.turn}`;
  }
}

function describeCount(count: Count): string {
  const what = count.tag ? `carta ${count.tag}` : count.cost !== undefined ? `carta de Vigor ${count.cost}` : "carta";
  return `${what} sua${count.of === "alliesHere" ? " aqui" : " em jogo"}`;
}

function describeEffect(effect: Effect): string {
  switch (effect.kind) {
    case "power":
      return `${signed(effect.amount)} de Influência para ${TARGETS[effect.to]}${effect.when ? `, ${describeCond(effect.when)}` : ""}`;
    case "powerPer":
      return `${signed(effect.amount)} de Influência por cada ${describeCount(effect.per)}`;
    case "draw":
      return `compre ${effect.count} carta${effect.count > 1 ? "s" : ""}`;
    case "destroy":
      return `${effect.target === "allHere" ? "destrói todas as cartas daqui" : `destrói ${TARGETS[effect.target]}`}${effect.when ? `, ${describeCond(effect.when)}` : ""}`;
    case "moveEnemies":
      return "move as cartas do rival daqui para os outros cenários";
    case "silence":
      return "cancela os Dons contínuos das cartas do rival aqui";
    case "create":
      return effect.where === "eachLane" ? `cria ${effect.token} em cada cenário com espaço` : `cria ${effect.token} aqui`;
    case "vanish":
      return `some e volta à mão ${effect.turns} turnos depois com ${signed(effect.bonus)}`;
    case "protect":
      return "suas cartas aqui não podem ser destruídas nem reduzidas pelo rival";
    case "aura":
      return `${signed(effect.amount)} de Influência para ${effect.to === "alliesHere" ? "suas cartas aqui" : "suas cartas nos cenários vizinhos"}${effect.tag ? ` com a etiqueta ${effect.tag}` : ""}`;
  }
}

const TRIGGER_LABEL: Record<Dom["trigger"], string> = {
  reveal: "Ao revelar",
  ongoing: "Contínuo",
  turnEnd: "Fim do turno",
  gameEnd: "Fim do duelo",
  destroyed: "Ao ser destruída",
  allyPlayed: "Quando uma carta sua é jogada aqui",
};

export function describeDom(dom: Dom | undefined): string {
  if (!dom) return "Sem Dom.";
  if (dom.text?.trim()) return dom.text.trim();
  const text = dom.effects.map(describeEffect).join("; ");
  return `${TRIGGER_LABEL[dom.trigger]}: ${text}.`;
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

/** Confere o Time: 12 cartas diferentes, Vigor de 0 a 6 e nada de carta-ficha. */
export function validateTeam(team: TeamCard[]): string | null {
  if (team.length !== TEAM_SIZE) return `O Time precisa ter ${TEAM_SIZE} cartas.`;
  const ids = new Set(team.map((card) => card.def.id));
  if (ids.size !== team.length) return "O Time não pode ter a mesma carta duas vezes.";
  if (team.some((card) => card.def.token)) return "Cartas criadas por Dons não entram no Time.";
  if (team.some((card) => card.def.cost < 0 || card.def.cost > 6)) return "Há carta com Vigor fora de 0 a 6.";
  return null;
}

/**
 * "Orçamento" de uma carta: Influência sem Dom vale ~2 × Vigor; um Dom bom tira 1 a 3.
 * Positivo = carta acima do preço; negativo = abaixo. O painel mostra isso para o admin equilibrar.
 */
export function budgetOf(def: CardDef): number {
  return def.power - def.cost * 2;
}
