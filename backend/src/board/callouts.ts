import { NET_PULL, POWER_UPS, WALL_NEED, type BoardEvent, type BoardState } from "./engine";

// Avisos animados do tabuleiro: cada acontecimento importante vira um "cartaz" curto (o que foi e por quê) que a tela
// mostra por cima do tabuleiro, com um brilho na casa e um movimento no peão. Puro e sem dependências, como o motor:
// o navegador (partida local) e o servidor (online) montam os mesmos avisos.

export type CalloutTone = "good" | "bad" | "info" | "special";
/** Movimento do peão quando o aviso aparece. */
export type PawnFx = "shake" | "hop" | "shield" | "cheer";

export type Callout = {
  emoji: string;
  title: string;
  text: string;
  tone: CalloutTone;
  /** Casas que recebem o brilho (a do acontecimento, ou várias). */
  tiles: number[];
  /** Peão que faz o movimento. */
  playerId?: string;
  fx?: PawnFx;
  /** Espera antes de aparecer, para o peão chegar à casa antes (milissegundos). */
  delayMs: number;
};

/** Tempo que o peão leva por casa ao andar (precisa bater com a tela). */
export const STEP_MS = 150;
export const MAX_WALK_STEPS = 16;
export const MAX_CALLOUTS = 3;
/** Quanto cada aviso fica na tela (dá para pular com um toque). */
export const MOMENT_MS = 10_000;
/** Teto da pausa de uma jogada, para o jogo nunca ficar parado esperando aviso. */
const MAX_HOLD_MS = 30_000;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Avisos dos acontecimentos de uma jogada, na ordem em que aconteceram. */
export function calloutsFor(events: BoardEvent[], state: BoardState): Callout[] {
  const find = (id: string) => state.players.find((player) => player.id === id);
  const name = (id: string) => find(id)?.name ?? "Alguém";
  const at = (id: string) => find(id)?.position ?? 0;
  const out: Callout[] = [];
  /** Tempo do peão andando pelo dado: os avisos das casas seguintes esperam por ele. */
  let walk = 0;
  const add = (callout: Omit<Callout, "delayMs">) => out.push({ ...callout, delayMs: walk });

  for (const event of events) {
    switch (event.type) {
      case "MOVED": {
        const steps = Math.abs(event.to - event.from);
        const who = name(event.playerId);
        switch (event.reason) {
          case "DICE":
            if (event.to > event.from) walk += Math.min(steps, MAX_WALK_STEPS) * STEP_MS;
            break;
          case "SHORTCUT":
            add({ emoji: "⬆️", title: "Atalho!", text: `${who} subiu ${plural(steps, "casa", "casas")} de uma vez.`, tone: "good", tiles: [event.from, event.to], playerId: event.playerId, fx: "hop" });
            break;
          case "FALL":
            add({ emoji: "⬇️", title: "Queda!", text: `${who} escorregou ${plural(steps, "casa", "casas")} para trás. Um escudo evitaria.`, tone: "bad", tiles: [event.from, event.to], playerId: event.playerId, fx: "shake" });
            break;
          case "TREE":
            add({ emoji: "🌳", title: "Árvore da Vida!", text: `${who} ganhou ${plural(steps, "casa", "casas")} à frente.`, tone: "good", tiles: [event.to], playerId: event.playerId, fx: "hop" });
            break;
          case "HAZARD":
            add({ emoji: state.hazard?.emoji ?? "⚠️", title: state.hazard?.name ?? "Perigo!", text: `${who} parou numa casa atingida e recuou ${plural(steps, "casa", "casas")}.`, tone: "bad", tiles: [event.from], playerId: event.playerId, fx: "shake" });
            break;
          case "FIRE":
            add({ emoji: "🔥", title: "Fogo!", text: `${who} caiu no fogo e recuou ${plural(steps, "casa", "casas")}. Um escudo evitaria.`, tone: "bad", tiles: [event.from], playerId: event.playerId, fx: "shake" });
            break;
          case "STORM":
            add({ emoji: "⛈️", title: "Levado pelo vento!", text: `${who} errou na tempestade e voltou ${plural(steps, "casa", "casas")}.`, tone: "bad", tiles: [event.to], playerId: event.playerId, fx: "shake" });
            break;
          case "SHARE":
            add({ emoji: "⚖️", title: "Juízo!", text: `${who} foi adiantado ${plural(steps, "casa", "casas")} por estar atrás.`, tone: "good", tiles: [event.to], playerId: event.playerId, fx: "hop" });
            break;
          case "VIGIL":
            add({ emoji: "🕯️", title: "Vigília cumprida!", text: `${who} acertou e avançou ${plural(steps, "casa", "casas")}.`, tone: "good", tiles: [event.to], playerId: event.playerId, fx: "hop" });
            break;
          default:
            break; // provação, empurrão, rede, troca e tenda têm aviso próprio
        }
        break;
      }
      case "PUSHED":
        add({
          emoji: "💥",
          title: "Empurrão!",
          text: `${name(event.byId)} caiu na casa de ${name(event.playerId)}, que voltou ${plural(event.from - event.to, "casa", "casas")}. Casas com ⭐ protegem.`,
          tone: "bad",
          tiles: [event.from],
          playerId: event.playerId,
          fx: "shake",
        });
        break;
      case "SHIELD":
        add({
          emoji: "🛡️",
          title: event.power === "FOURTH" ? "Imune!" : "Escudo!",
          text: `${name(event.playerId)} ${event.power === "FOURTH" ? "estava imune" : `usou ${POWER_UPS[event.power].name}`} e evitou o recuo.`,
          tone: "good",
          tiles: [at(event.playerId)],
          playerId: event.playerId,
          fx: "shield",
        });
        break;
      case "POWER_GAINED":
        add({ emoji: POWER_UPS[event.power].emoji, title: "Novo poder!", text: `${name(event.playerId)} ganhou ${POWER_UPS[event.power].name}: ${POWER_UPS[event.power].description}`, tone: "good", tiles: [at(event.playerId)], playerId: event.playerId, fx: "hop" });
        break;
      case "POWER_FULL":
        add({ emoji: "🎒", title: "Mochila cheia!", text: `${name(event.playerId)} já carrega 2 poderes: este não coube.`, tone: "info", tiles: [at(event.playerId)] });
        break;
      case "POWER_USED":
        add({ emoji: POWER_UPS[event.power].emoji, title: POWER_UPS[event.power].name, text: `${name(event.playerId)} usou: ${POWER_UPS[event.power].description}`, tone: "special", tiles: [at(event.playerId)], playerId: event.playerId, fx: "cheer" });
        break;
      case "POWER_LOST":
        add({ emoji: "💨", title: "Poder perdido!", text: `${name(event.playerId)} perdeu ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name}.`, tone: "bad", tiles: [at(event.playerId)], playerId: event.playerId, fx: "shake" });
        break;
      case "TRIAL":
        // O convite da provação já se explica na folha de decisão; aqui só o resultado.
        if (event.stage === "WON") add({ emoji: "⚔️", title: "Provação vencida!", text: `${name(event.playerId)} acertou a pergunta difícil e avança.`, tone: "good", tiles: [at(event.playerId)], playerId: event.playerId, fx: "cheer" });
        else if (event.stage === "LOST") add({ emoji: "⚔️", title: "Provação perdida!", text: `${name(event.playerId)} errou a pergunta difícil.`, tone: "bad", tiles: [at(event.playerId)], playerId: event.playerId, fx: "shake" });
        else if (event.stage === "TENT") add({ emoji: "⛺", title: "Tenda!", text: `${name(event.playerId)} atravessou a provação sem responder.`, tone: "good", tiles: [at(event.playerId)], playerId: event.playerId, fx: "hop" });
        break;
      case "GATE":
        add({ emoji: "🚪", title: "Portão!", text: `${name(event.playerId)} chegou ao portão: só entra na chegada quem acerta a pergunta final.`, tone: "special", tiles: [at(event.playerId)], playerId: event.playerId });
        break;
      case "WALL":
        if (event.stage === "STOP") add({ emoji: "🧱", title: "Muro!", text: `${name(event.playerId)} parou: precisa acertar ${WALL_NEED} perguntas seguidas.`, tone: "bad", tiles: [at(event.playerId)], playerId: event.playerId });
        else if (event.stage === "FAILED") add({ emoji: "🧱", title: "O muro ficou de pé!", text: `${name(event.playerId)} errou e não passou.`, tone: "bad", tiles: [at(event.playerId)], playerId: event.playerId, fx: "shake" });
        else add({ emoji: event.stage === "TRUMPET" ? "📯" : "💥", title: "Muro derrubado!", text: `${name(event.playerId)} ${event.stage === "TRUMPET" ? "usou a Trombeta e" : "acertou e"} seguiu o caminho.`, tone: "good", tiles: [at(event.playerId)], playerId: event.playerId, fx: "cheer" });
        break;
      case "WALLS_FELL":
        add({ emoji: "🧱", title: "Os muros caíram!", text: "Daqui para a frente, ninguém para nos muros.", tone: "special", tiles: [] });
        break;
      case "VIGIL":
        if (event.stage === "START") add({ emoji: "🕯️", title: "Vigília!", text: "Todos respondem à mesma pergunta, um de cada vez. Só quem acerta avança.", tone: "special", tiles: [at(event.playerId)], playerId: event.playerId });
        break;
      case "HAZARD":
        add({ emoji: event.emoji, title: event.name, text: `As casas marcadas fazem recuar ${state.rules.hazard?.penalty ?? 2} quem parar nelas.`, tone: "special", tiles: event.tiles.slice(0, 8) });
        break;
      case "STORM":
        add({ emoji: event.on ? "⛈️" : "🌤️", title: event.on ? "Tempestade!" : "A tempestade passou", text: event.on ? "Quem errar a pergunta é levado para trás." : "Quem erra volta a ficar no lugar.", tone: event.on ? "bad" : "info", tiles: [] });
        break;
      case "DEN":
        add({ emoji: "🦁", title: "Cova dos leões!", text: `${name(event.playerId)} fica uma vez sem jogar, mas ganhou um escudo.`, tone: "info", tiles: [at(event.playerId)], playerId: event.playerId, fx: "shield" });
        break;
      case "SKIPPED":
        add({ emoji: "⏭️", title: "Sem jogar", text: `${name(event.playerId)} ficou sem jogar nesta vez.`, tone: "info", tiles: [at(event.playerId)] });
        break;
      case "SWAPPED":
        add({ emoji: "🔄", title: "Troca de lugar!", text: `${name(event.playerId)} trocou de lugar com ${name(event.withId)}.`, tone: "special", tiles: [at(event.playerId), at(event.withId)], playerId: event.playerId, fx: "hop" });
        break;
      case "NETTED":
        add({ emoji: "🕸️", title: "Rede!", text: `${name(event.byId)} lançou a rede: ${name(event.playerId)} é puxado ${NET_PULL} casas para trás.`, tone: "bad", tiles: [at(event.playerId)], playerId: event.playerId, fx: "shake" });
        break;
      case "IMMUNE":
        add({ emoji: "🛡️", title: "Imune!", text: `${name(event.playerId)} não sofre recuos por um tempo.`, tone: "good", tiles: [at(event.playerId)], playerId: event.playerId, fx: "shield" });
        break;
      case "WON":
        add({ emoji: "🏆", title: "Vitória!", text: `${name(event.playerId)} chegou ao fim do caminho!`, tone: "special", tiles: [at(event.playerId)], playerId: event.playerId, fx: "cheer" });
        break;
      default:
        break;
    }
  }
  return out;
}

/** No máximo `max` avisos por jogada: os menos importantes (informativos, depois os bons) saem primeiro. */
export function pickCallouts(list: Callout[], max = MAX_CALLOUTS): Callout[] {
  const result = [...list];
  for (const tone of ["info", "good", "bad", "special"] as const) {
    while (result.length > max) {
      const index = result.findIndex((callout) => callout.tone === tone);
      if (index < 0) break;
      result.splice(index, 1);
    }
  }
  return result.slice(-max);
}

/** Tempo do peão andando (para frente, pelo dado) nos eventos de uma jogada, com uma folga no fim. */
export function walkMs(events: BoardEvent[]): number {
  const steps = events.reduce((total, event) => (event.type === "MOVED" && event.reason === "DICE" && event.to > event.from ? total + Math.min(event.to - event.from, MAX_WALK_STEPS) : total), 0);
  return steps > 0 ? steps * STEP_MS + 500 : 0;
}

/**
 * Quanto tempo a tela se dedica ao que acabou de acontecer (o peão andar e cada aviso, um de cada vez) antes de a próxima
 * jogada começar. O servidor empurra bots e cronômetros por esse tempo, para ninguém perder a vez lendo.
 */
export function holdMs(events: BoardEvent[], callouts: Callout[]): number {
  return Math.min(MAX_HOLD_MS, walkMs(events) + callouts.length * MOMENT_MS);
}
