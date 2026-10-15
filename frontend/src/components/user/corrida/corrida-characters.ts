/**
 * Personagens da Corrida (por enquanto só cores; os sprites, sons e a regra de desbloqueio por fase chegam pelo Painel nas etapas 3 e 5).
 * Todos correm com a mesma física: o personagem só muda a aparência.
 */
export type RunnerCharacter = { id: string; name: string; color: string; text: string };

export const RUNNER_CHARACTERS: RunnerCharacter[] = [
  { id: 'davi', name: 'Davi', color: '#38bdf8', text: 'O pastor que enfrentou o gigante.' },
  { id: 'debora', name: 'Débora', color: '#f472b6', text: 'Juíza e profetisa de Israel.' },
  { id: 'elias', name: 'Elias', color: '#fb923c', text: 'O profeta da carruagem de fogo.' },
  { id: 'ester', name: 'Ester', color: '#c084fc', text: 'A rainha que salvou o seu povo.' },
  { id: 'jonas', name: 'Jonas', color: '#2dd4bf', text: 'O profeta que passou três dias no peixe.' },
  { id: 'daniel', name: 'Daniel', color: '#facc15', text: 'Não temeu a cova dos leões.' },
];

const KEY = 'colecao-biblica:corrida:character';

/** Personagem escolhido neste aparelho (o primeiro, se nenhum foi escolhido). */
export function loadCharacter(): RunnerCharacter {
  try {
    const id = window.localStorage.getItem(KEY);
    return RUNNER_CHARACTERS.find((character) => character.id === id) ?? RUNNER_CHARACTERS[0];
  } catch {
    return RUNNER_CHARACTERS[0];
  }
}

export function saveCharacter(id: string) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* sem armazenamento: a escolha vale só até fechar a tela */
  }
}
