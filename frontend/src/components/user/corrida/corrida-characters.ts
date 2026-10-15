import { useEffect, useState } from 'react';
import { getRunnerCharacters, type RunnerCharacterDto } from '@/lib/runner-api';
import type { Sounds, Sprites } from '@runner/characters';

/**
 * Personagem da Corrida no app. Todos correm com a mesma física: o personagem só muda como aparece (sprites por pose, ou a cor quando falta)
 * e como soa (sons opcionais). Vêm do Painel; sem internet ou sem nenhum cadastrado, valem os 6 padrão abaixo (só cores).
 */
export type RunnerCharacter = { id: string; name: string; color: string; text: string; sprites: Sprites; sounds: Sounds; unlockLevel: string | null };

export const DEFAULT_CHARACTERS: RunnerCharacter[] = [
  { id: 'davi', name: 'Davi', color: '#38bdf8', text: 'O pastor que enfrentou o gigante.' },
  { id: 'debora', name: 'Débora', color: '#f472b6', text: 'Juíza e profetisa de Israel.' },
  { id: 'elias', name: 'Elias', color: '#fb923c', text: 'O profeta da carruagem de fogo.' },
  { id: 'ester', name: 'Ester', color: '#c084fc', text: 'A rainha que salvou o seu povo.' },
  { id: 'jonas', name: 'Jonas', color: '#2dd4bf', text: 'O profeta que passou três dias no peixe.' },
  { id: 'daniel', name: 'Daniel', color: '#facc15', text: 'Não temeu a cova dos leões.' },
].map((character) => ({ ...character, sprites: {}, sounds: {}, unlockLevel: null }));

const fromDto = (dto: RunnerCharacterDto): RunnerCharacter => ({ id: dto.slug, name: dto.name, color: dto.color, text: dto.description ?? '', sprites: dto.sprites, sounds: dto.sounds, unlockLevel: dto.unlockLevel });

let cache: RunnerCharacter[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(list: RunnerCharacter[]) => void>();

function load() {
  loading ??= getRunnerCharacters()
    .then((list) => {
      cache = list.length > 0 ? list.map(fromDto) : DEFAULT_CHARACTERS;
    })
    .catch(() => {
      // Sem internet (ou erro): os padrão; tenta de novo na próxima vez que a tela abrir.
      cache = cache ?? DEFAULT_CHARACTERS;
    })
    .finally(() => {
      loading = null;
      listeners.forEach((listener) => listener(cache ?? DEFAULT_CHARACTERS));
    });
  return loading;
}

/** Personagens da Corrida (cacheados: uma consulta por sessão). Mostra os padrão enquanto carrega. */
export function useRunnerCharacters(): RunnerCharacter[] {
  const [list, setList] = useState<RunnerCharacter[]>(cache ?? DEFAULT_CHARACTERS);
  useEffect(() => {
    listeners.add(setList);
    if (cache) setList(cache);
    // Sempre atualiza em segundo plano ao abrir (o painel pode ter mudado sprites).
    void load();
    return () => {
      listeners.delete(setList);
    };
  }, []);
  return list;
}

const KEY = 'colecao-biblica:corrida:character';

/** Identificador do personagem escolhido neste aparelho (vazio = nenhum; vale o primeiro da lista). */
export function storedCharacterId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCharacter(id: string) {
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* sem armazenamento: a escolha vale só até fechar a tela */
  }
}

/** Sprite para mostrar o personagem em cartões: o retrato, ou a corrida (que anima); sem nenhum, a cor. */
export function portraitOf(character: RunnerCharacter) {
  return character.sprites.portrait ?? character.sprites.run ?? null;
}

/** Os rivais da corrida contra bots: os outros personagens, na ordem da lista; se faltarem, completa com os padrão. */
export function rivalsFor(characters: RunnerCharacter[], selectedId: string, count: number): RunnerCharacter[] {
  const pool = [...characters.filter((item) => item.id !== selectedId), ...DEFAULT_CHARACTERS.filter((item) => item.id !== selectedId && !characters.some((other) => other.id === item.id))];
  return pool.slice(0, count);
}
