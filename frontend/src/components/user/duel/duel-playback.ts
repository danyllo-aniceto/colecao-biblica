import type { DuelEvent, Side, Snapshot } from '@duel/types';

/** Quanto cada passo fica na tela (ms, na velocidade normal): dá tempo de ler o Dom e ver o número mudar. */
export function durationOf(event: DuelEvent): number {
  switch (event.type) {
    case 'reveal':
      return event.dom ? 3200 : 1500;
    case 'scenario':
      return 3600;
    case 'turn':
      return 1400;
    case 'double':
    case 'retreat':
      return 2600;
    default:
      return 2300;
  }
}

/** Texto do aviso com quem fez (você ou o rival), sem mexer no motor. */
export function narrate(event: DuelEvent, you: Side = 0): string {
  const mine = event.side === you;
  const who = mine ? 'Você' : 'O rival';
  switch (event.type) {
    case 'reveal':
      return `${who} revelou ${event.name}.`;
    case 'double':
      return mine ? `Você dobrou a aposta: agora vale ${event.amount}.` : `O rival dobrou a aposta! Agora vale ${event.amount}. Você pode seguir ou desistir da rodada.`;
    case 'retreat':
      return mine ? 'Você desistiu da rodada.' : 'O rival desistiu da rodada.';
    default:
      return event.text;
  }
}

/** Passos de um turno: uma foto de "antes" e depois cada acontecimento com a foto do tabuleiro. */
export function stepsFrom(events: DuelEvent[], before: Snapshot): DuelEvent[] {
  const useful = events.filter((event) => event.snap && !['play', 'draw', 'win'].includes(event.type));
  if (useful.length === 0) return [];
  if (useful.some((event) => event.type === 'reveal')) {
    return [{ type: 'turn', text: 'As figurinhas vão virar...', snap: before }, ...useful];
  }
  return useful;
}

export function recordLines(events: DuelEvent[], you: Side = 0) {
  return events.filter((event) => !['play', 'draw', 'win', 'turn'].includes(event.type)).map((event) => `${narrate(event, you)}${event.dom ? ` (${event.dom})` : ''}`);
}

