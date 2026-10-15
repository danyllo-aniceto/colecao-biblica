/** Melhor resultado de um jogador numa fase (guardado no aparelho enquanto não há campanha com servidor). */
export type Best = { progress: number; words: number; finished: boolean; /** Concluída sem voltar a nenhum checkpoint. */ clean: boolean };

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/** Junta o resultado novo ao melhor guardado: cada campo guarda o seu máximo; fase concluída (e concluída sem checkpoint) nunca "desconclui". */
export function mergeBest(previous: Best | null, result: Best): Best {
  const next: Best = { progress: clamp01(result.progress), words: Math.max(0, Math.floor(result.words)), finished: result.finished, clean: result.finished && result.clean };
  if (!previous) return next;
  return {
    progress: Math.max(previous.progress, next.progress),
    words: Math.max(previous.words, next.words),
    finished: previous.finished || next.finished,
    clean: previous.clean || next.clean,
  };
}

/** Lê com segurança um valor vindo do armazenamento do aparelho (pode estar vazio, velho ou adulterado). */
export function sanitizeBest(raw: unknown): Best | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.progress !== "number" || typeof value.words !== "number" || !Number.isFinite(value.progress) || !Number.isFinite(value.words)) return null;
  return { progress: clamp01(value.progress), words: Math.max(0, Math.floor(value.words)), finished: value.finished === true, clean: value.finished === true && value.clean === true };
}
