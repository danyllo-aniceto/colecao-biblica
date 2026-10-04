import { NET_PULL, POWER_UPS, WALL_NEED, type BoardEvent, type BoardState } from "./engine";

// Texto do histórico da partida. Fica junto do motor porque o servidor (online) e o navegador (local) usam o mesmo.

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** Texto de cada acontecimento para o histórico da partida (null = não aparece). */
export function eventMessage(event: BoardEvent, state: BoardState): string | null {
  const name = (id: string) => state.players.find((player) => player.id === id)?.name ?? 'Alguém';
  switch (event.type) {
    case 'ROLLED':
      return `${name(event.playerId)} tirou ${event.die}${event.bonus ? ` +${event.bonus} (ajuda)` : ''}${event.doubled ? ' (dobrado)' : ''}`;
    case 'REROLLED':
      return `${name(event.playerId)} rolou de novo e tirou ${event.die}`;
    case 'ANSWERED':
      // Provação e pergunta final têm mensagens próprias (venceu/perdeu, portão).
      if (event.kind === 'TRIAL' || event.kind === 'FINAL') return null;
      if (event.kind === 'WALL') return event.correct ? `${name(event.playerId)} acertou uma pergunta do muro` : null;
      if (event.kind === 'VIGIL') return event.correct ? `${name(event.playerId)} acertou a vigília` : `${name(event.playerId)} errou a vigília`;
      return event.correct ? `${name(event.playerId)} acertou!` : `${name(event.playerId)} errou`;
    case 'MOVED': {
      const steps = Math.abs(event.to - event.from);
      const who = name(event.playerId);
      switch (event.reason) {
        case 'DICE':
          return event.to >= state.config.size ? null : `${who} avançou ${plural(steps, 'casa', 'casas')}`;
        case 'TRIAL':
          return `${who} avançou ${plural(steps, 'casa', 'casas')} pela provação`;
        case 'TRIAL_PENALTY':
          return `${who} recuou ${plural(steps, 'casa', 'casas')}`;
        case 'SHORTCUT':
          return `${who} pegou um atalho (+${steps})`;
        case 'FALL':
          return `${who} caiu ${plural(steps, 'casa', 'casas')}`;
        case 'TREE':
          return `${who} avançou ${plural(steps, 'casa', 'casas')} com a Árvore da Vida`;
        case 'HAZARD':
          return `${who} parou numa casa atingida e recuou ${plural(steps, 'casa', 'casas')}`;
        case 'FIRE':
          return `${who} caiu no fogo e recuou ${plural(steps, 'casa', 'casas')}`;
        case 'STORM':
          return `${who} foi levado pelo vento ${plural(steps, 'casa', 'casas')} para trás`;
        case 'SHARE':
          return `${who} foi adiantado ${plural(steps, 'casa', 'casas')} pelo juízo`;
        case 'VIGIL':
          return `${who} avançou ${plural(steps, 'casa', 'casas')} pela vigília`;
        case 'NET':
          return `${who} recuou ${plural(steps, 'casa', 'casas')}`;
        case 'TENT':
          return `${who} atravessou a provação e avançou ${plural(steps, 'casa', 'casas')}`;
        default:
          return null;
      }
    }
    case 'PUSHED':
      return `${name(event.playerId)} foi empurrado por ${name(event.byId)} e voltou ${plural(event.from - event.to, 'casa', 'casas')}`;
    case 'SHIELD':
      return event.power === 'FOURTH'
        ? `${name(event.playerId)} estava imune e evitou o recuo`
        : `${name(event.playerId)} usou ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name} e evitou o recuo`;
    case 'POWER_GAINED':
      return `${name(event.playerId)} ganhou ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name}`;
    case 'POWER_FULL':
      return `${name(event.playerId)} está com a mochila cheia`;
    case 'POWER_USED':
      return `${name(event.playerId)} usou ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name}`;
    case 'POWER_LOST':
      return `${name(event.playerId)} perdeu ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name}`;
    case 'WALL':
      if (event.stage === 'STOP') return `${name(event.playerId)} parou diante de um muro: acerte ${WALL_NEED} seguidas`;
      if (event.stage === 'FAILED') return `${name(event.playerId)} não derrubou o muro`;
      return event.stage === 'TRUMPET' ? `${name(event.playerId)} derrubou o muro com a Trombeta` : `${name(event.playerId)} derrubou o muro!`;
    case 'WALLS_FELL':
      return 'Os muros caíram!';
    case 'VIGIL':
      return event.stage === 'START' ? `${name(event.playerId)} abriu uma vigília: todos respondem à mesma pergunta` : 'Fim da vigília';
    case 'HAZARD':
      return `${event.emoji} ${event.name}: novas casas atingidas`;
    case 'STORM':
      return event.on ? '⛈️ Tempestade! Quem errar a pergunta é levado para trás' : 'A tempestade passou';
    case 'DEN':
      return `${name(event.playerId)} caiu na cova dos leões: fica uma vez sem jogar, mas ganhou um escudo`;
    case 'SKIPPED':
      return `${name(event.playerId)} ficou sem jogar`;
    case 'SWAPPED':
      return `${name(event.playerId)} trocou de lugar com ${name(event.withId)}`;
    case 'NETTED':
      return `${name(event.byId)} lançou a rede sobre ${name(event.playerId)} (puxa ${NET_PULL} casas)`;
    case 'IMMUNE':
      return `${name(event.playerId)} está imune a recuos`;
    case 'TRIAL':
      if (event.stage === 'TENT') return `${name(event.playerId)} atravessou a provação com a Tenda`;
      if (event.stage === 'OFFER' && state.rules.vigil) return null;
      if (event.stage === 'OFFER') return `${name(event.playerId)} parou numa provação: ${state.rules.trial.name}`;
      if (event.stage === 'DECLINED') return `${name(event.playerId)} recusou a provação`;
      if (event.stage === 'WON') return `${name(event.playerId)} venceu a provação!`;
      if (event.stage === 'LOST') return `${name(event.playerId)} perdeu a provação`;
      return null;
    case 'GATE':
      return `${name(event.playerId)} está no portão: pergunta final!`;
    case 'WON':
      return `${name(event.playerId)} venceu a partida! 🏆`;
    default:
      return null;
  }
}
