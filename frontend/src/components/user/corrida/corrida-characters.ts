import { useEffect, useState } from 'react';
import { getRunnerCharacters, type RunnerCharacterDto } from '@/lib/runner-api';
import type { Sounds, Sprites } from '@runner/characters';

/**
 * Personagem da Corrida no app. Todos correm com a mesma física: o personagem só muda como aparece (sprites por pose, ou a cor quando falta)
 * e como soa (sons opcionais). Vêm do Painel; sem internet ou sem nenhum cadastrado, valem os 9 padrão abaixo (só cores).
 */
export type RunnerCharacter = { id: string; name: string; color: string; text: string; sprites: Sprites; sounds: Sounds; unlockLevel: string | null; scenarioId: string | null };

export const DEFAULT_CHARACTERS: RunnerCharacter[] = [
  { id: 'davi', name: 'Davi', color: '#38bdf8', text: 'O pastor que enfrentou o gigante.', unlockLevel: null, scenarioId: 'cidade-de-davi' },
  { id: 'jonatas', name: 'Jônatas', color: '#34d399', text: 'O amigo fiel de Davi.', unlockLevel: 'cd-3', scenarioId: 'cidade-de-davi' },
  { id: 'joabe', name: 'Joabe', color: '#f87171', text: 'O comandante do exército de Davi.', unlockLevel: 'cd-5', scenarioId: 'cidade-de-davi' },
  { id: 'moises', name: 'Moisés', color: '#60a5fa', text: 'Guiou o povo pelo Mar Vermelho.', unlockLevel: 'mv-2', scenarioId: 'mar-vermelho' },
  { id: 'arao', name: 'Arão', color: '#fbbf24', text: 'O irmão e porta-voz de Moisés.', unlockLevel: 'mv-3', scenarioId: 'mar-vermelho' },
  { id: 'miria', name: 'Miriã', color: '#f9a8d4', text: 'A profetisa que cantou à beira do mar.', unlockLevel: 'mv-4', scenarioId: 'mar-vermelho' },
  { id: 'ezequiel', name: 'Ezequiel', color: '#a3e635', text: 'O profeta do vale dos ossos secos.', unlockLevel: 'vo-3', scenarioId: 'vale-dos-ossos-secos' },
  { id: 'daniel', name: 'Daniel', color: '#facc15', text: 'Não temeu a cova dos leões na Babilônia.', unlockLevel: 'vo-6', scenarioId: 'vale-dos-ossos-secos' },
  { id: 'jeremias', name: 'Jeremias', color: '#818cf8', text: 'O profeta que chorou por Jerusalém e anunciou esperança.', unlockLevel: 'vo-9', scenarioId: 'vale-dos-ossos-secos' },
].map((character) => ({ ...character, sprites: {}, sounds: {} }));

const fromDto = (dto: RunnerCharacterDto): RunnerCharacter => ({ id: dto.slug, name: dto.name, color: dto.color, text: dto.description ?? '', sprites: dto.sprites, sounds: dto.sounds, unlockLevel: dto.unlockLevel, scenarioId: dto.scenarioSlug });

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

/** Quadros por segundo de cada pose nos cartões (a respiração do "Parado" é mais lenta). */
const CARD_FPS = { portrait: 8, idle: 5, run: 8 } as const;

/** Sprite para mostrar o personagem em cartões e listas: o retrato, senão o "Parado" (respirando), senão a corrida; sem nenhum, a cor. Já traz a velocidade da animação. */
export function portraitOf(sprites: Sprites): { url: string; frames: number; fps: number } | null {
  const pick = (pose: keyof typeof CARD_FPS) => (sprites[pose] ? { ...sprites[pose]!, fps: CARD_FPS[pose] } : null);
  return pick('portrait') ?? pick('idle') ?? pick('run');
}

/** Os rivais da corrida contra bots: os outros personagens, na ordem da lista; se faltarem, completa com os padrão. */
export function rivalsFor(characters: RunnerCharacter[], selectedId: string, count: number): RunnerCharacter[] {
  const pool = [...characters.filter((item) => item.id !== selectedId), ...DEFAULT_CHARACTERS.filter((item) => item.id !== selectedId && !characters.some((other) => other.id === item.id))];
  return pool.slice(0, count);
}
