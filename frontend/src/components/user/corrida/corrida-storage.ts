import { mergeBest, sanitizeBest, type Best } from '@runner/records';

const KEY = 'colecao-biblica:corrida:best';

type Store = Record<string, Best>;

function read(): Store {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Record<string, unknown>;
    const store: Store = {};
    for (const [id, value] of Object.entries(raw)) {
      const best = sanitizeBest(value);
      if (best) store[id] = best;
    }
    return store;
  } catch {
    return {};
  }
}

/** Melhor resultado de cada fase, guardado neste aparelho (a campanha com servidor vem depois). Sem armazenamento, tudo segue funcionando. */
export function loadBests(): Store {
  return read();
}

export function saveBest(levelId: string, result: Best): Store {
  const store = read();
  store[levelId] = mergeBest(store[levelId] ?? null, result);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* sem armazenamento: o melhor resultado vale só até fechar a tela */
  }
  return store;
}
