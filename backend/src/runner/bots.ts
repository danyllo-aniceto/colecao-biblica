import { maxTicksOf, newPlayer, respawnAt, stepPlayer } from "./engine";
import { randomFrom } from "./rng";
import { PLAYER, TILE, type PlayerState, type PreparedLevel } from "./types";
import type { RunSegment } from "./verify";

/** O bot decide a cada `DECISION_TICKS` passos e olha `DEPTH` decisões à frente (até 128 caminhos, ~56 passos de horizonte). */
export const DECISION_TICKS = 8;
const DEPTH = 7;

/** Atraso do toque (em passos) que o bot tenta aguentar: o dedo de gente real nunca é exato (~50 ms). */
export const TOUCH_DELAY = 3;

/** Até quantas colunas à frente (além do horizonte) o bot "enxerga" uma recompensa para escolher o caminho (de cima ou de baixo, chão ou teto). */
const LURE_COLUMNS = 16;

/**
 * Atração pelas recompensas à frente (palavras e poderes ainda não pegos): quanto mais perto da altura delas o personagem termina o horizonte,
 * mais pontos (no máximo 20: só desempata caminhos igualmente seguros). É o que leva o bot a subir ao caminho de cima onde há recompensa.
 */
function rewardLure(level: PreparedLevel, p: PlayerState): number {
  const first = Math.max(0, Math.floor(p.x / TILE));
  const centre = p.y + PLAYER / 2;
  let best = 0;
  for (let column = first; column <= first + LURE_COLUMNS && column < level.cols.length; column += 1) {
    const col = level.cols[column];
    for (const word of col.words) if (!p.collected.includes(word.index)) best = Math.max(best, 1 - Math.abs((word.t + word.b) / 2 - centre) / 160);
    for (const power of col.powers) if (!p.powers.includes(power.id)) best = Math.max(best, 1 - Math.abs((power.t + power.b) / 2 - centre) / 160);
  }
  return Math.max(0, best) * 20;
}

/**
 * Escolhe segurar ou soltar olhando só o que o jogador também enxerga: percorre a árvore de decisões (cada nó repete a mesma ação por
 * `DECISION_TICKS` passos) e fica com o caminho que sobrevive, pega mais palavras e poderes, vai atrás das recompensas à frente e mexe menos no toque. Empate: prefere soltar (toques curtos, como gente: segurar dá pulo automático em sequência, que é frágil).
 * Cada caminho roda duas vezes, uma exata e outra com o toque atrasado em `delay` passos; o preferido sobrevive nas duas, então a fase
 * não depende de acertar o instante exato (nem o bot nem a fase ficam "no fio da navalha").
 */
export function planHold(level: PreparedLevel, player: PlayerState, current: boolean, delay = TOUCH_DELAY): boolean {
  let best = current;
  let bestScore = -Infinity;
  const visit = (exact: PlayerState, late: PlayerState, depth: number, last: boolean, switches: number, first: boolean) => {
    if (depth === DEPTH || exact.status !== "running") {
      const alive = exact.status !== "dead";
      const lateAlive = late.status !== "dead";
      const base = !alive ? exact.tick - player.tick : lateAlive ? 2e6 : 1e6;
      const score = base + exact.collected.length * 100 + exact.powers.length * 40 + (alive ? rewardLure(level, exact) : 0) - switches + (first ? 0 : 2);
      if (score > bestScore) {
        bestScore = score;
        best = first;
      }
      return;
    }
    for (const hold of [last, !last]) {
      let nextExact = exact;
      let nextLate = late;
      for (let step = 0; step < DECISION_TICKS; step += 1) {
        if (nextExact.status === "running") nextExact = stepPlayer(level, nextExact, hold);
        if (nextLate.status === "running") nextLate = stepPlayer(level, nextLate, step < delay ? last : hold);
      }
      visit(nextExact, nextLate, depth + 1, hold, switches + (hold !== last ? 1 : 0), depth === 0 ? hold : first);
    }
  };
  visit(player, player, 0, current, 0, current);
  return best;
}

/**
 * Dificuldades dos bots da corrida (medidas na jornada de 160 s: Mestre ~165–180 s com 1–3 quedas, Estudante ~185–200 s, Aprendiz ~220–280 s).
 * Todos correm na mesma velocidade; o que muda é quantas vezes caem e o tempo perdido voltando ao checkpoint.
 */
export const BOT_LEVELS = {
  APPRENTICE: { label: "Aprendiz", skill: 0.88, lag: 3 },
  STUDENT: { label: "Estudante", skill: 0.93, lag: 3 },
  MASTER: { label: "Mestre", skill: 0.97, lag: 3 },
} as const;
export type BotLevel = keyof typeof BOT_LEVELS;

/** Quantos passos um bot espera depois de cair antes de voltar ao último checkpoint. */
export const BOT_RESPAWN_TICKS = 45;

export type BotOptions = {
  /** Chance de pensar a cada decisão (0 a 1); quando "distrai", repete o que estava fazendo. */
  skill?: number;
  seed?: number;
  /** Atraso do toque em passos: a decisão só vale `lag` passos depois, como o dedo de gente real. */
  lag?: number;
  /** Desloca os passos em que o bot pensa, para vários bots não pensarem todos no mesmo quadro. */
  phase?: number;
  /** Ao cair, espera um pouco e volta ao último checkpoint (corrida contra bots). Sem isso, a partida do bot acaba na queda. */
  respawn?: boolean;
  /** Começa deste estado em vez do começo da fase (testes de checkpoint). */
  from?: PlayerState;
};

/** Um bot jogando "ao vivo": a cada `step()` anda um passo, decidindo como um jogador (só vê o que o jogador vê). */
export type Bot = {
  player: PlayerState;
  /** Quantas vezes caiu. */
  deaths: number;
  /** Passos de corrida decorridos (inclui o tempo perdido ao cair e voltar). */
  elapsed: number;
  /** Passos em que o toque desceu/subiu (a mesma forma da partida de um jogador). */
  toggles: number[];
  /**
   * A partida como o servidor a confere (`verifyRun`): corrente de tentativas, cada uma com os toques contados desde o começo dela. Ao cair, o bot volta
   * ao último checkpoint (com o que tinha ao cruzá-lo) ou, sem checkpoint, recomeça do início.
   */
  segments: RunSegment[];
  step: () => void;
};

/** Cria um bot ao vivo. `botInputs` (partida inteira) e a corrida contra bots usam exatamente a mesma lógica. */
export function createBot(level: PreparedLevel, options: BotOptions = {}): Bot {
  const skill = options.skill ?? 1;
  const lag = Math.max(0, Math.floor(options.lag ?? 0));
  const phase = Math.max(0, Math.floor(options.phase ?? 0));
  const random = randomFrom(options.seed ?? 1);
  let hold = false;
  let intended = false;
  let pending: { at: number; hold: boolean } | null = null;
  let snapshot: { count: number; collected: number[]; powers: number[]; tick: number } | null = null;
  let segmentStart = options.from?.tick ?? 0;
  let waiting = 0;
  const bot: Bot = {
    player: options.from ?? newPlayer(level),
    deaths: 0,
    elapsed: 0,
    toggles: [],
    segments: [{ fromCheckpoint: false, toggles: [] }],
    step() {
      const current = bot.player;
      if (current.status === "finished") return;
      bot.elapsed += 1;
      if (current.status === "dead") {
        waiting += 1;
        if (options.respawn && waiting >= BOT_RESPAWN_TICKS) {
          if (snapshot) {
            bot.player = respawnAt(level, snapshot.count, snapshot.collected, snapshot.tick, snapshot.powers);
            segmentStart = snapshot.tick;
            bot.segments.push({ fromCheckpoint: true, toggles: [] });
          } else {
            bot.player = newPlayer(level);
            segmentStart = 0;
            bot.segments.push({ fromCheckpoint: false, toggles: [] });
          }
          hold = false;
          intended = false;
          pending = null;
          waiting = 0;
        }
        return;
      }
      if ((current.tick + phase) % DECISION_TICKS === 0 && (skill >= 1 || random() < skill)) {
        const next = planHold(level, current, hold);
        if (next !== intended) {
          intended = next;
          if (lag === 0) {
            if (next !== hold) {
              bot.toggles.push(current.tick);
              bot.segments[bot.segments.length - 1].toggles.push(current.tick - segmentStart);
              hold = next;
            }
          } else {
            pending = { at: current.tick + lag, hold: next };
          }
        }
      }
      if (pending && current.tick >= pending.at) {
        if (pending.hold !== hold) {
          bot.toggles.push(current.tick);
          bot.segments[bot.segments.length - 1].toggles.push(current.tick - segmentStart);
          hold = pending.hold;
        }
        pending = null;
      }
      const after = stepPlayer(level, current, hold);
      // Mesma regra do jogo e do servidor: o checkpoint vale ao cruzar a bandeira com o personagem vivo, guardando o que ele tinha nesse instante.
      if (after.checkpoint > current.checkpoint && after.status === "running") snapshot = { count: after.checkpoint, collected: [...after.collected], powers: [...after.powers], tick: after.tick };
      if (after.status === "dead") bot.deaths += 1;
      bot.player = after;
    },
  };
  return bot;
}

/**
 * Partida inteira de um bot, devolvida como lista de toques (a mesma forma do jogador).
 * `skill` (0 a 1) é a chance de pensar a cada decisão; quando "distrai", repete o que estava fazendo: quanto menor, mais erra.
 * `lag` é o atraso do toque em passos: a decisão só vale `lag` passos depois, como o dedo de gente real; o bot continua replanejando
 * a cada decisão a partir do que vê. Use `lag` ~ `TOUCH_DELAY` para provar que uma fase não exige precisão de 1 passo.
 */
export function botInputs(level: PreparedLevel, options: { skill?: number; seed?: number; lag?: number } = {}): number[] {
  const bot = createBot(level, { ...options, respawn: false });
  const limit = maxTicksOf(level);
  while (bot.player.status === "running" && bot.player.tick < limit) bot.step();
  return bot.toggles;
}
