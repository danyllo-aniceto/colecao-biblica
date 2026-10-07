import { WALL_NEED, type QuestionKind, type ScenarioRules, type Tile, type TileKind } from '@board/engine';

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
  WALL: { icon: '🧱', label: 'Muro', description: `Para o peão: só passa quem acerta ${WALL_NEED} perguntas seguidas (ou usa a Trombeta).`, className: 'border-ink/40 bg-ink/15' },
  FIRE: { icon: '🔥', label: 'Fogo', description: 'Quem para aqui recua (o escudo anula).', className: 'border-danger bg-danger/25' },
  DEN: { icon: '🦁', label: 'Cova dos leões', description: 'Fica uma vez sem jogar, mas ganha um escudo.', className: 'border-violet bg-violet/20' },
  VIGIL: { icon: '🕯️', label: 'Vigília', description: 'Todos respondem à mesma pergunta; só quem acerta avança.', className: 'border-violet bg-violet/25' },
  FINISH: { icon: '🏁', label: 'Chegada', description: 'Quem acertar a pergunta final do portão chega aqui e vence.', className: 'border-primary bg-primary/40' },
};

/** Ícone do abrigo: nos cenários em que ele dá power-up, vira a árvore, o maná ou o ouro do cenário. */
const SHELTER_ICON: Record<string, string> = { eden: '🌳', sinai: '🍞', templo: '🪙' };

export function tileIcon(tile: Tile, rules: ScenarioRules): string {
  if (tile.kind === 'SHELTER' && rules.shelterGrants) return SHELTER_ICON[rules.slug] ?? '🎁';
  return TILE_INFO[tile.kind].icon;
}

/** Texto da legenda da casa, com os números do cenário. */
export function tileDescription(kind: TileKind, rules: ScenarioRules): string {
  switch (kind) {
    case 'SHELTER':
      return rules.shelterGrants ? 'Ninguém é empurrado aqui, e quem para ganha um power-up.' : TILE_INFO.SHELTER.description;
    case 'WALL':
      return `Para o peão: só passa quem acerta ${WALL_NEED} perguntas seguidas (ou usa a Trombeta).${rules.walls ? ` Na rodada ${rules.walls.fallsAtRound} todos os muros caem.` : ''}`;
    case 'FIRE':
      return `Quem para aqui recua ${rules.fire?.penalty ?? 3} (o escudo anula).`;
    case 'TRIAL':
      return rules.trial.optional ? 'Você escolhe se arrisca a pergunta difícil.' : TILE_INFO.TRIAL.description;
    default:
      return TILE_INFO[kind].description;
  }
}

/** Casas que existem no tabuleiro do cenário (para a legenda). */
export function tileKindsOf(rules: ScenarioRules): TileKind[] {
  return [
    'START',
    'SHELTER',
    'POWER',
    rules.vigil ? 'VIGIL' : 'TRIAL',
    'SHORTCUT',
    'FALL',
    ...(rules.walls ? (['WALL'] as const) : []),
    ...(rules.fire ? (['FIRE'] as const) : []),
    ...(rules.den ? (['DEN'] as const) : []),
    'GATE',
    'FINISH',
  ];
}

export const PHASE_LABEL: Record<QuestionKind, string> = {
  MOVE: 'Pergunta',
  TRIAL: 'Provação',
  FINAL: 'Pergunta final',
  WALL: 'Muro',
  VIGIL: 'Vigília',
};

export { eventMessage } from '@board/messages';
