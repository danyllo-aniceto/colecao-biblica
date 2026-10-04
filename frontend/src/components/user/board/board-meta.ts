import { POWER_UPS, type BoardEvent, type BoardState, type ScenarioRules, type Tile, type TileKind } from '@board/engine';

/** Como cada tipo de casa aparece no tabuleiro e na legenda. Só tokens do tema. */
export const TILE_INFO: Record<TileKind, { icon: string; label: string; description: string; className: string }> = {
  START: { icon: '🚩', label: 'Largada', description: 'Todos começam aqui. Ninguém é empurrado nesta casa.', className: 'border-edge-strong bg-surface-3' },
  NORMAL: { icon: '', label: 'Casa comum', description: 'Sem efeito: cair em um rival o empurra para trás.', className: 'border-edge bg-surface-2' },
  SHELTER: { icon: '⭐', label: 'Abrigo', description: 'Ninguém é empurrado aqui.', className: 'border-success bg-success/15' },
  POWER: { icon: '🎁', label: 'Poder', description: 'Ganha um power-up (a mochila guarda até 2).', className: 'border-primary bg-primary/25' },
  TRIAL: { icon: '⚔️', label: 'Provação', description: 'Pergunta difícil, tudo ou nada.', className: 'border-danger bg-danger/20' },
  SHORTCUT: { icon: '⬆️', label: 'Atalho', description: 'Leva o peão para uma casa mais à frente.', className: 'border-info bg-info/20' },
  FALL: { icon: '⬇️', label: 'Queda', description: 'Leva o peão para uma casa mais atrás (o escudo anula).', className: 'border-danger/60 bg-danger/10' },
  GATE: { icon: '🚪', label: 'Portão', description: 'Quem chega aqui responde a pergunta final, a cada vez, até acertar.', className: 'border-accent bg-accent/20' },
  FINISH: { icon: '🏁', label: 'Chegada', description: 'Quem acertar a pergunta final do portão chega aqui e vence.', className: 'border-primary bg-primary/40' },
};

export function tileIcon(tile: Tile, rules: ScenarioRules): string {
  if (tile.kind === 'SHELTER' && rules.shelterGrants) return '🌳';
  return TILE_INFO[tile.kind].icon;
}

export const PHASE_LABEL = {
  MOVE: 'Pergunta',
  TRIAL: 'Provação',
  FINAL: 'Pergunta final',
} as const;

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
      if (event.kind !== 'MOVE') return null;
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
        default:
          return null;
      }
    }
    case 'PUSHED':
      return `${name(event.playerId)} foi empurrado por ${name(event.byId)} e voltou ${plural(event.from - event.to, 'casa', 'casas')}`;
    case 'SHIELD':
      return `${name(event.playerId)} usou ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name} e evitou o recuo`;
    case 'POWER_GAINED':
      return `${name(event.playerId)} ganhou ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name}`;
    case 'POWER_FULL':
      return `${name(event.playerId)} está com a mochila cheia`;
    case 'POWER_USED':
      return `${name(event.playerId)} usou ${POWER_UPS[event.power].emoji} ${POWER_UPS[event.power].name}`;
    case 'TRIAL':
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
