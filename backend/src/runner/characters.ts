/**
 * Personagens da Corrida: aparência (sprites por pose) e sons enviados pelo painel. Regras puras, sem dependências (o app usa o mesmo arquivo).
 * Todos os personagens correm com a MESMA física: o personagem só muda como aparece e como soa.
 */

/** Poses do personagem. Cada pose é UMA imagem com os quadros lado a lado (tira horizontal de quadros quadrados). */
export const POSES = ["portrait", "idle", "run", "jump", "fly", "gravity", "dead", "win"] as const;
export type Pose = (typeof POSES)[number];

export const POSE_INFO: Record<Pose, { label: string; hint: string; defaultFrames: number }> = {
  portrait: { label: "Retrato", hint: "Cartão de escolha do personagem (1 quadro). Sem ele, usa o 1º quadro da corrida.", defaultFrames: 1 },
  idle: { label: "Parado", hint: "Personagem parado, de perfil olhando para a direita, respirando (2 a 6 quadros em ciclo; os pés ficam sempre no mesmo lugar). Aparece antes da largada, na escolha do personagem e sempre que ele está no chão sem andar.", defaultFrames: 4 },
  run: { label: "Correndo", hint: "No chão, na forma Corrida. Roda em ciclo (4 a 6 quadros).", defaultFrames: 4 },
  jump: { label: "No ar", hint: "Pulando ou caindo, na forma Corrida (1 a 3 quadros).", defaultFrames: 1 },
  fly: { label: "Voando", hint: "Forma Voo (2 a 4 quadros em ciclo).", defaultFrames: 2 },
  gravity: { label: "Gravidade", hint: "Forma Gravidade: o app vira a imagem de cabeça para baixo no teto (1 a 4 quadros).", defaultFrames: 1 },
  dead: { label: "Caindo", hint: "Quando erra (1 a 3 quadros, toca uma vez).", defaultFrames: 1 },
  win: { label: "Vencendo", hint: "Tela de vitória (2 a 6 quadros em ciclo).", defaultFrames: 4 },
};

export const MAX_FRAMES = 12;

/** Sons do personagem (opcionais; sem arquivo, o app usa o som padrão do modo). */
export const SOUND_KEYS = ["jump", "double", "word", "flip", "checkpoint", "death", "win"] as const;
export type SoundKey = (typeof SOUND_KEYS)[number];

export const SOUND_INFO: Record<SoundKey, { label: string; hint: string }> = {
  jump: { label: "Pulo", hint: "Toca a cada pulo." },
  double: { label: "Pulo duplo", hint: "Toca no segundo pulo, no ar." },
  word: { label: "Palavra", hint: "Ao pegar uma palavra do versículo." },
  flip: { label: "Inverter gravidade", hint: "Ao trocar chão e teto." },
  checkpoint: { label: "Checkpoint", hint: "Ao passar por uma bandeira." },
  death: { label: "Queda", hint: "Quando erra." },
  win: { label: "Vitória", hint: "Ao concluir a fase ou vencer a corrida." },
};

/** Uma pose: o endereço da imagem e quantos quadros quadrados ela tem lado a lado. */
export type SpriteSheet = { url: string; frames: number };
export type Sprites = Partial<Record<Pose, SpriteSheet>>;
export type Sounds = Partial<Record<SoundKey, string>>;

const isPose = (value: string): value is Pose => (POSES as readonly string[]).includes(value);
const isSoundKey = (value: string): value is SoundKey => (SOUND_KEYS as readonly string[]).includes(value);

const clampFrames = (value: unknown) => {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : 1;
  return Math.max(1, Math.min(MAX_FRAMES, number));
};

/** Lê com segurança o JSON guardado (pode estar vazio, velho ou com chaves desconhecidas): só poses e sons conhecidos, com quadros entre 1 e 12. */
export function sanitizeSprites(raw: unknown): Sprites {
  const result: Sprites = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isPose(key) || !value || typeof value !== "object") continue;
    const sheet = value as Record<string, unknown>;
    if (typeof sheet.url !== "string" || !sheet.url.trim()) continue;
    result[key] = { url: sheet.url.trim(), frames: clampFrames(sheet.frames) };
  }
  return result;
}

export function sanitizeSounds(raw: unknown): Sounds {
  const result: Sounds = {};
  if (!raw || typeof raw !== "object") return result;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (isSoundKey(key) && typeof value === "string" && value.trim()) result[key] = value.trim();
  }
  return result;
}

/** Atualização parcial: pose ausente não muda; `null` remove a pose. */
export function mergeSprites(current: Sprites, patch: Partial<Record<Pose, SpriteSheet | null>>): Sprites {
  const next: Sprites = { ...current };
  for (const pose of POSES) {
    if (!(pose in patch)) continue;
    const value = patch[pose];
    if (value === null || value === undefined) delete next[pose];
    else next[pose] = { url: value.url.trim(), frames: clampFrames(value.frames) };
  }
  return next;
}

export function mergeSounds(current: Sounds, patch: Partial<Record<SoundKey, string | null>>): Sounds {
  const next: Sounds = { ...current };
  for (const key of SOUND_KEYS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (!value || !value.trim()) delete next[key];
    else next[key] = value.trim();
  }
  return next;
}

/**
 * Qual pose desenhar agora. `stopped` = o jogo está parado com o personagem no lugar (antes da largada, esperando o toque, pausado).
 * Parado, ou ao chegar ao fim da fase, no chão: pose "Parado" (no voo ele continua pairando). O resto segue a forma da fase.
 */
export function poseFor(state: { form: "RUN" | "FLY" | "GRAVITY"; grounded: boolean; status: "running" | "dead" | "finished" }, stopped = false): Pose {
  if (state.status === "dead") return "dead";
  if ((stopped || state.status === "finished") && state.form !== "FLY") return "idle";
  if (state.form === "FLY") return "fly";
  if (state.form === "GRAVITY") return "gravity";
  return state.grounded ? "run" : "jump";
}

/** Passos de jogo (60 por segundo) que cada quadro dura. A respiração do "Parado" é mais lenta que o resto. */
const FRAME_TICKS: Record<Pose, number> = { portrait: 6, idle: 12, run: 6, jump: 6, fly: 6, gravity: 6, dead: 6, win: 6 };

/** Quadro a mostrar: poses em ciclo (parado, correndo, voando, vencendo...) avançam com o tempo; a queda toca uma vez e fica no último; o retrato fica no primeiro. */
export function frameFor(pose: Pose, frames: number, tick: number): number {
  if (frames <= 1 || pose === "portrait") return 0;
  const step = Math.floor(Math.max(0, tick) / FRAME_TICKS[pose]);
  return pose === "dead" ? Math.min(frames - 1, step) : step % frames;
}

/**
 * A imagem da pose. Sem arte "Parado", usa o 1º quadro da corrida (parado, sem animar: `still`); as demais poses sem arte voltam `null`
 * (o jogo desenha a forma colorida).
 */
export function pickSheet(sprites: Sprites | undefined, pose: Pose): { sheet: SpriteSheet; still: boolean } | null {
  const own = sprites?.[pose];
  if (own) return { sheet: own, still: false };
  if (pose === "idle" && sprites?.run) return { sheet: sprites.run, still: true };
  return null;
}

/** Cor de reserva válida (#RRGGBB). */
export const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
