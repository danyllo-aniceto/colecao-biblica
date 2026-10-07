/**
 * Texto dos Dons para a planilha e o painel. Um Dom tem um gatilho e uma lista de efeitos separados por " | ";
 * cada efeito é "nome chave=valor chave=valor". Nada de espaços nos valores: o sublinhado vira espaço
 * (ex.: inimigo-nomeado:João_Batista). Exemplo:
 *
 *   gatilho: revelar
 *   efeitos: poder valor=6 alvo=si se=inimigo-poder:6 | comprar qtd=1
 *
 * É puro e sem dependências: o servidor valida a importação e o painel mostra a prévia com o mesmo código.
 */
import { TOKENS } from "./engine";
import type { CardDef, Cond, Count, Dom, Effect, Target, Trigger } from "./types";

// ---------------------------------------------------------------------------
// Vocabulário
// ---------------------------------------------------------------------------

const TRIGGERS: Array<[string, Trigger]> = [
  ["revelar", "reveal"],
  ["continuo", "ongoing"],
  ["fim-do-turno", "turnEnd"],
  ["fim-do-duelo", "gameEnd"],
  ["destruida", "destroyed"],
  ["aliado-jogado", "allyPlayed"],
];

const TARGETS: Array<[string, Target]> = [
  ["si", "self"],
  ["aliados-aqui", "alliesHere"],
  ["inimigos-aqui", "enemiesHere"],
  ["outros-aliados", "otherAllies"],
  ["inimigo-mais-fraco", "weakestEnemyHere"],
  ["inimigo-mais-forte", "strongestEnemyHere"],
  ["aliado-mais-fraco", "weakestAllyHere"],
  ["inimigos-todos", "enemiesAll"],
  ["mao", "hand"],
];

const COUNT_OF: Array<[string, Count["of"]]> = [
  ["aliados-aqui", "alliesHere"],
  ["aliados", "alliesAll"],
  ["inimigos-aqui", "enemiesHere"],
  ["figurinhas-aqui", "cardsHere"],
];

const WHERE: Array<[string, "eachLane" | "here" | "neighbors"]> = [
  ["cada-cenario", "eachLane"],
  ["aqui", "here"],
  ["vizinhos", "neighbors"],
];

const AURA_TO: Array<[string, "alliesHere" | "adjacent" | "allies"]> = [
  ["aliados-aqui", "alliesHere"],
  ["vizinhos", "adjacent"],
  ["aliados", "allies"],
];

const DESTROY_TARGETS = ["inimigo-mais-fraco", "inimigo-mais-forte", "aliado-mais-fraco", "todos-aqui"] as const;

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, "-");
const fromName = (value: string) => value.replace(/_/g, " ").trim();
const toName = (value: string) => value.trim().replace(/\s+/g, "_");

function lookup<T>(table: Array<[string, T]>, key: string | undefined): T | undefined {
  const wanted = normalize(key ?? "");
  return table.find(([name]) => name === wanted)?.[1];
}

function nameOf<T>(table: Array<[string, T]>, value: T): string {
  return table.find(([, item]) => item === value)?.[0] ?? String(value);
}

class DslError extends Error {}

// ---------------------------------------------------------------------------
// Condições ("se=...")
// ---------------------------------------------------------------------------

function parseCond(raw: string | undefined): Cond | undefined {
  if (!raw) return undefined;
  const [kind, ...rest] = raw.split(":");
  const arg = rest.join(":");
  const key = normalize(kind);
  const number = (min: number, max: number) => {
    const value = Number(arg);
    if (!Number.isInteger(value) || value < min || value > max) throw new DslError(`"se=${raw}" precisa de um número de ${min} a ${max}.`);
    return value;
  };
  const text = () => {
    if (!arg.trim()) throw new DslError(`"se=${raw}" precisa de um nome ou etiqueta depois dos dois-pontos.`);
    return fromName(arg);
  };
  switch (key) {
    case "inimigo-poder":
      return { type: "enemyHerePower", atLeast: number(1, 40) };
    case "inimigo-nomeado":
      return { type: "enemyHereNamed", name: text() };
    case "aliados-aqui":
      return { type: "alliesHere", atLeast: number(1, 4) };
    case "perdendo":
      return { type: "laneLosing" };
    case "ganhando":
      return { type: "laneWinning" };
    case "sozinho":
      return { type: "alone" };
    case "mao-max":
      return { type: "handAtMost", count: number(0, 7) };
    case "inimigo-etiqueta":
      return { type: "enemyHereTag", tag: text() };
    case "aliado-etiqueta":
      return { type: "allyHereTag", tag: text() };
    case "turno":
      return { type: "turnAtLeast", turn: number(1, 6) };
    default:
      throw new DslError(`Condição desconhecida: "${kind}". Use inimigo-poder, inimigo-nomeado, aliados-aqui, perdendo, ganhando, sozinho, mao-max, inimigo-etiqueta, aliado-etiqueta ou turno.`);
  }
}

function condToText(cond: Cond): string {
  switch (cond.type) {
    case "enemyHerePower":
      return `inimigo-poder:${cond.atLeast}`;
    case "enemyHereNamed":
      return `inimigo-nomeado:${toName(cond.name)}`;
    case "alliesHere":
      return `aliados-aqui:${cond.atLeast}`;
    case "laneLosing":
      return "perdendo";
    case "laneWinning":
      return "ganhando";
    case "alone":
      return "sozinho";
    case "handAtMost":
      return `mao-max:${cond.count}`;
    case "enemyHereTag":
      return `inimigo-etiqueta:${toName(cond.tag)}`;
    case "allyHereTag":
      return `aliado-etiqueta:${toName(cond.tag)}`;
    case "turnAtLeast":
      return `turno:${cond.turn}`;
  }
}

// ---------------------------------------------------------------------------
// Efeitos
// ---------------------------------------------------------------------------

function parseParams(tokens: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (const token of tokens) {
    const index = token.indexOf("=");
    if (index <= 0) throw new DslError(`Use chave=valor (recebi "${token}").`);
    params[normalize(token.slice(0, index))] = token.slice(index + 1);
  }
  return params;
}

function integer(params: Record<string, string>, key: string, min: number, max: number, fallback?: number): number {
  const raw = params[key];
  if (raw === undefined || raw === "") {
    if (fallback !== undefined) return fallback;
    throw new DslError(`Falta ${key}=número.`);
  }
  const value = Number(raw.replace(/^\+/, ""));
  if (!Number.isInteger(value) || value < min || value > max) throw new DslError(`${key} precisa ser um número inteiro de ${min} a ${max} (recebi "${raw}").`);
  return value;
}

function parseEffect(raw: string): Effect {
  const [nameRaw, ...tokens] = raw.trim().split(/\s+/);
  const name = normalize(nameRaw ?? "");
  const params = parseParams(tokens);
  const when = parseCond(params.se);
  const known = (...keys: string[]) => {
    const extra = Object.keys(params).filter((key) => ![...keys, "se"].includes(key));
    if (extra.length > 0) throw new DslError(`"${name}" não usa ${extra.map((key) => `"${key}"`).join(", ")}.`);
  };
  switch (name) {
    case "poder": {
      known("valor", "alvo");
      const to = lookup(TARGETS, params.alvo ?? "si");
      if (!to) throw new DslError(`alvo desconhecido: "${params.alvo}". Use ${TARGETS.map(([key]) => key).join(", ")}.`);
      return { kind: "power", amount: integer(params, "valor", -20, 20), to, ...(when ? { when } : {}) };
    }
    case "poder-por": {
      known("valor", "por", "etiqueta", "vigor");
      const of = lookup(COUNT_OF, params.por);
      if (!of) throw new DslError(`por= precisa ser ${COUNT_OF.map(([key]) => key).join(", ")}.`);
      const per: Count = { of, ...(params.etiqueta ? { tag: fromName(params.etiqueta) } : {}), ...(params.vigor !== undefined ? { cost: integer(params, "vigor", 0, 6) } : {}) };
      return { kind: "powerPer", amount: integer(params, "valor", -5, 5), per };
    }
    case "comprar":
      known("qtd");
      return { kind: "draw", count: integer(params, "qtd", 1, 3, 1) };
    case "destruir": {
      known("alvo");
      const key = normalize(params.alvo ?? "");
      if (!(DESTROY_TARGETS as readonly string[]).includes(key)) throw new DslError(`alvo= precisa ser ${DESTROY_TARGETS.join(", ")}.`);
      const target = key === "todos-aqui" ? "allHere" : (lookup(TARGETS, key) as "weakestEnemyHere" | "strongestEnemyHere" | "weakestAllyHere");
      return { kind: "destroy", target, ...(when ? { when } : {}) };
    }
    case "mover-inimigos":
      known();
      return { kind: "moveEnemies" };
    case "calar":
      known();
      return { kind: "silence", target: "enemiesHere" };
    case "criar": {
      known("ficha", "onde");
      const token = Object.keys(TOKENS).find((key) => normalize(key) === normalize(params.ficha ?? ""));
      if (!token) throw new DslError(`ficha= precisa ser ${Object.keys(TOKENS).join(", ")}.`);
      const where = lookup(WHERE, params.onde ?? "aqui");
      if (!where) throw new DslError(`onde= precisa ser ${WHERE.map(([key]) => key).join(", ")}.`);
      return { kind: "create", token, where };
    }
    case "sumir":
      known("turnos", "bonus");
      return { kind: "vanish", turns: integer(params, "turnos", 1, 5), bonus: integer(params, "bonus", -5, 10, 0) };
    case "proteger":
      known();
      return { kind: "protect" };
    case "aura": {
      known("valor", "em", "etiqueta");
      const to = lookup(AURA_TO, params.em ?? "aliados-aqui");
      if (!to) throw new DslError(`em= precisa ser ${AURA_TO.map(([key]) => key).join(", ")}.`);
      return { kind: "aura", amount: integer(params, "valor", -5, 5), to, ...(params.etiqueta ? { tag: fromName(params.etiqueta) } : {}) };
    }
    case "devolver": {
      known("alvo");
      const target = lookup(TARGETS, params.alvo ?? "inimigo-mais-forte");
      if (target !== "weakestEnemyHere" && target !== "strongestEnemyHere") throw new DslError("alvo= precisa ser inimigo-mais-fraco ou inimigo-mais-forte.");
      return { kind: "bounce", target };
    }
    case "descartar":
      known("qtd");
      return { kind: "discard", count: integer(params, "qtd", 1, 3, 1) };
    case "vigor-extra":
      known("valor");
      return { kind: "energy", amount: integer(params, "valor", 1, 3) };
    case "custo-menos":
      known("valor");
      return { kind: "cheaper", amount: integer(params, "valor", 1, 2, 1) };
    case "converter":
      known();
      return { kind: "convert" };
    case "sacrificar":
      known("ganho");
      return { kind: "sacrifice", gain: integer(params, "ganho", 1, 12) };
    case "multiplicar":
      known("fator");
      return { kind: "multiply", factor: integer(params, "fator", 2, 3, 2) };
    case "mover-se":
      known();
      return { kind: "relocate" };
    case "ressuscitar":
      known("qtd");
      return { kind: "revive", count: integer(params, "qtd", 1, 2, 1) };
    default:
      throw new DslError(`Efeito desconhecido: "${nameRaw}". Veja o guia de poderes.`);
  }
}

function effectToText(effect: Effect): string {
  const se = (cond?: Cond) => (cond ? [`se=${condToText(cond)}`] : []);
  const join = (name: string, ...parts: string[]) => [name, ...parts].join(" ");
  const sign = (value: number) => (value > 0 ? `+${value}` : String(value));
  switch (effect.kind) {
    case "power":
      return join("poder", `valor=${sign(effect.amount)}`, `alvo=${nameOf(TARGETS, effect.to)}`, ...se(effect.when));
    case "powerPer":
      return join("poder-por", `valor=${sign(effect.amount)}`, `por=${nameOf(COUNT_OF, effect.per.of)}`, ...(effect.per.tag ? [`etiqueta=${toName(effect.per.tag)}`] : []), ...(effect.per.cost !== undefined ? [`vigor=${effect.per.cost}`] : []));
    case "draw":
      return join("comprar", `qtd=${effect.count}`);
    case "destroy":
      return join("destruir", `alvo=${effect.target === "allHere" ? "todos-aqui" : nameOf(TARGETS, effect.target)}`, ...se(effect.when));
    case "moveEnemies":
      return "mover-inimigos";
    case "silence":
      return "calar";
    case "create":
      return join("criar", `ficha=${effect.token}`, `onde=${nameOf(WHERE, effect.where)}`);
    case "vanish":
      return join("sumir", `turnos=${effect.turns}`, `bonus=${sign(effect.bonus)}`);
    case "protect":
      return "proteger";
    case "aura":
      return join("aura", `valor=${sign(effect.amount)}`, `em=${nameOf(AURA_TO, effect.to)}`, ...(effect.tag ? [`etiqueta=${toName(effect.tag)}`] : []));
    case "bounce":
      return join("devolver", `alvo=${nameOf(TARGETS, effect.target)}`);
    case "discard":
      return join("descartar", `qtd=${effect.count}`);
    case "energy":
      return join("vigor-extra", `valor=${effect.amount}`);
    case "cheaper":
      return join("custo-menos", `valor=${effect.amount}`);
    case "convert":
      return "converter";
    case "sacrifice":
      return join("sacrificar", `ganho=${effect.gain}`);
    case "multiply":
      return join("multiplicar", `fator=${effect.factor}`);
    case "relocate":
      return "mover-se";
    case "revive":
      return join("ressuscitar", `qtd=${effect.count}`);
  }
}

// ---------------------------------------------------------------------------
// Dom inteiro
// ---------------------------------------------------------------------------

/** Efeitos que só fazem sentido como Dom contínuo (e os que não podem ser contínuos). */
const ONGOING_ONLY: Array<Effect["kind"]> = ["protect", "aura"];
const ONGOING_ALLOWED: Array<Effect["kind"]> = ["protect", "aura", "powerPer"];

export type ParsedDom = { ok: true; dom: Dom | null } | { ok: false; error: string };

/** Lê gatilho + efeitos (de uma planilha ou do painel). Vazios nos dois = figurinha sem Dom. */
export function parseDom(triggerText: string | undefined, effectsText: string | undefined, text?: string): ParsedDom {
  const trigger = (triggerText ?? "").trim();
  const effects = (effectsText ?? "").trim();
  if (!trigger && !effects) return { ok: true, dom: null };
  try {
    if (!trigger) throw new DslError(`Falta o gatilho (${TRIGGERS.map(([key]) => key).join(", ")}).`);
    if (!effects) throw new DslError("Falta o texto dos efeitos.");
    const kind = lookup(TRIGGERS, trigger);
    if (!kind) throw new DslError(`Gatilho desconhecido: "${trigger}". Use ${TRIGGERS.map(([key]) => key).join(", ")}.`);
    const list = effects.split("|").map((part) => part.trim()).filter(Boolean).map(parseEffect);
    if (list.length === 0) throw new DslError("Nenhum efeito.");
    if (list.length > 3) throw new DslError("No máximo 3 efeitos por Dom.");
    for (const effect of list) {
      if (kind === "ongoing" && !ONGOING_ALLOWED.includes(effect.kind)) throw new DslError(`O efeito "${effectToText(effect).split(" ")[0]}" não funciona como Dom contínuo (use só aura, proteger ou poder-por).`);
      if (kind !== "ongoing" && ONGOING_ONLY.includes(effect.kind)) throw new DslError(`"${effectToText(effect).split(" ")[0]}" só funciona no gatilho continuo.`);
      if (effect.kind === "power" && effect.to === "hand" && effect.amount < 0) throw new DslError("Não dá para tirar Influência da sua própria mão.");
    }
    return { ok: true, dom: { trigger: kind, effects: list, ...(text?.trim() ? { text: text.trim() } : {}) } };
  } catch (error) {
    if (error instanceof DslError) return { ok: false, error: error.message };
    throw error;
  }
}

/** O inverso: gatilho e efeitos em texto (para exportar e para o painel). */
export function domToText(dom: Dom | undefined | null): { trigger: string; effects: string } {
  if (!dom) return { trigger: "", effects: "" };
  return { trigger: nameOf(TRIGGERS, dom.trigger), effects: dom.effects.map(effectToText).join(" | ") };
}

// ---------------------------------------------------------------------------
// Figurinha inteira
// ---------------------------------------------------------------------------

export type CardInput = { id: string; name: string; cost: number; power: number; tags: string[]; trigger?: string; effects?: string; text?: string; imageUrl?: string | null };

/** Monta a figurinha a partir de texto; devolve o erro em português quando algo está errado. */
export function buildCard(input: CardInput): { ok: true; card: CardDef; warnings: string[] } | { ok: false; error: string } {
  if (!input.name.trim()) return { ok: false, error: "A figurinha precisa de um personagem." };
  if (!Number.isInteger(input.cost) || input.cost < 0 || input.cost > 6) return { ok: false, error: "Vigor precisa ser um número de 0 a 6." };
  if (!Number.isInteger(input.power) || input.power < 0 || input.power > 30) return { ok: false, error: "Influência precisa ser um número de 0 a 30." };
  const tags = [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))];
  if (tags.length > 6) return { ok: false, error: "No máximo 6 etiquetas." };
  const parsed = parseDom(input.trigger, input.effects, input.text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const warnings: string[] = [];
  const budget = input.power - input.cost * 2;
  if (budget > 3) warnings.push(`Influência ${input.power} é alta para Vigor ${input.cost} (o normal é ${input.cost * 2}).`);
  if (parsed.dom && budget > 0) warnings.push("Tem Dom e Influência acima do preço: confira o equilíbrio.");
  return {
    ok: true,
    warnings,
    card: { id: input.id, name: input.name.trim(), cost: input.cost, power: input.power, tags, ...(parsed.dom ? { dom: parsed.dom } : {}), ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}) },
  };
}

// ---------------------------------------------------------------------------
// Guia de poderes (mostrado no painel)
// ---------------------------------------------------------------------------

export type GuideEntry = { name: string; summary: string; params: string; example: string };

export const EFFECT_GUIDE: GuideEntry[] = [
  { name: "poder", summary: "Soma ou tira Influência.", params: "valor=±N  alvo=(si, aliados-aqui, inimigos-aqui, outros-aliados, inimigo-mais-fraco, inimigo-mais-forte, aliado-mais-fraco, inimigos-todos, mao)  se=condição", example: "poder valor=+6 alvo=si se=inimigo-poder:6" },
  { name: "poder-por", summary: "Soma Influência por cada figurinha que combine.", params: "valor=N  por=(aliados-aqui, aliados, inimigos-aqui, figurinhas-aqui)  etiqueta=Tag  vigor=N", example: "poder-por valor=+1 por=aliados etiqueta=Apóstolo" },
  { name: "comprar", summary: "Compra figurinhas do Time.", params: "qtd=1 a 3", example: "comprar qtd=1" },
  { name: "destruir", summary: "Afasta figurinhas.", params: "alvo=(inimigo-mais-fraco, inimigo-mais-forte, aliado-mais-fraco, todos-aqui)  se=condição", example: "destruir alvo=todos-aqui se=perdendo" },
  { name: "mover-inimigos", summary: "Leva as figurinhas do rival deste cenário para outros.", params: "(sem parâmetros)", example: "mover-inimigos" },
  { name: "calar", summary: "Cancela os Dons contínuos do rival neste cenário.", params: "(sem parâmetros)", example: "calar" },
  { name: "criar", summary: "Cria figurinhas-ficha (Descendente, Ovelha, Pão, Peixe, Soldado).", params: "ficha=Nome  onde=(cada-cenario, aqui, vizinhos)", example: "criar ficha=Descendente onde=cada-cenario" },
  { name: "sumir", summary: "A figurinha some e volta à mão depois, mais forte.", params: "turnos=1 a 5  bonus=N", example: "sumir turnos=3 bonus=+3" },
  { name: "proteger", summary: "(contínuo) Suas figurinhas aqui não podem ser destruídas nem reduzidas pelo rival.", params: "(sem parâmetros)", example: "proteger" },
  { name: "aura", summary: "(contínuo) Dá Influência a outras figurinhas suas.", params: "valor=N  em=(aliados-aqui, vizinhos, aliados)  etiqueta=Tag", example: "aura valor=+1 em=vizinhos" },
  { name: "devolver", summary: "Devolve uma figurinha do rival à mão dele.", params: "alvo=(inimigo-mais-fraco, inimigo-mais-forte)", example: "devolver alvo=inimigo-mais-forte" },
  { name: "descartar", summary: "O rival descarta as figurinhas de maior Vigor da mão.", params: "qtd=1 a 3", example: "descartar qtd=1" },
  { name: "vigor-extra", summary: "Mais Vigor no próximo turno.", params: "valor=1 a 3", example: "vigor-extra valor=1" },
  { name: "custo-menos", summary: "As figurinhas da sua mão custam menos Vigor.", params: "valor=1 ou 2", example: "custo-menos valor=1" },
  { name: "converter", summary: "A figurinha mais fraca do rival neste cenário passa para o seu lado.", params: "(sem parâmetros)", example: "converter" },
  { name: "sacrificar", summary: "Afasta sua figurinha mais fraca aqui para ganhar Influência.", params: "ganho=N", example: "sacrificar ganho=+5" },
  { name: "multiplicar", summary: "Multiplica a Influência atual da figurinha.", params: "fator=2 ou 3", example: "multiplicar fator=2" },
  { name: "mover-se", summary: "A figurinha vai para o seu cenário mais fraco com espaço.", params: "(sem parâmetros)", example: "mover-se" },
  { name: "ressuscitar", summary: "Uma figurinha afastada sua volta à mão.", params: "qtd=1 ou 2", example: "ressuscitar qtd=1" },
];

export const TRIGGER_GUIDE: Array<{ name: string; summary: string }> = [
  { name: "revelar", summary: "Acontece quando a figurinha vira." },
  { name: "continuo", summary: "Vale enquanto a figurinha estiver em jogo (só aura, proteger e poder-por)." },
  { name: "fim-do-turno", summary: "Acontece no fim de cada turno." },
  { name: "fim-do-duelo", summary: "Acontece depois do turno 6, antes de contar os cenários." },
  { name: "destruida", summary: "Acontece quando a figurinha é afastada." },
  { name: "aliado-jogado", summary: "Acontece quando outra figurinha sua vira no mesmo cenário." },
];

export const CONDITION_GUIDE: Array<{ name: string; summary: string }> = [
  { name: "inimigo-poder:N", summary: "O rival tem aqui uma figurinha com N ou mais de Influência." },
  { name: "inimigo-nomeado:Nome", summary: "O rival tem aqui a figurinha com esse nome (use _ no lugar de espaço)." },
  { name: "inimigo-etiqueta:Tag", summary: "O rival tem aqui uma figurinha com essa etiqueta." },
  { name: "aliado-etiqueta:Tag", summary: "Você tem aqui outra figurinha com essa etiqueta." },
  { name: "aliados-aqui:N", summary: "Você tem N ou mais outras figurinhas aqui." },
  { name: "sozinho", summary: "Esta é sua única figurinha neste cenário." },
  { name: "perdendo / ganhando", summary: "O cenário está perdendo / ganhando para você." },
  { name: "mao-max:N", summary: "Você tem N ou menos figurinhas na mão." },
  { name: "turno:N", summary: "A partir do turno N." },
];
