import type { ReactNode } from 'react';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import { SectionHeading } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { useGameModeImages, type GameMode } from '@/lib/game-modes';

export type PlayMode = 'quiz' | 'board' | 'duel' | 'minigames';

export const PLAY_MODES: Array<{ id: PlayMode; design: GameMode; title: string; text: string; tags: string[]; icon: ReactNode; fallback: string; /** Aviso de como liberar o modo (aparece no cartão). */ unlock?: string }> = [
  {
    id: 'quiz',
    design: 'QUIZ',
    title: 'Quiz Bíblico',
    text: 'O jogo principal. Responda perguntas da Bíblia, ganhe XP, moedas e baús com figurinhas novas para o seu álbum.',
    tags: ['Sozinho', 'Dá XP e moedas', 'Baús de figurinhas'],
    icon: <QuizRoundedIcon sx={{ fontSize: 56 }} />,
    fallback: 'from-primary to-accent',
  },
  {
    id: 'board',
    design: 'BOARD',
    title: 'Tabuleiro',
    text: 'Role o dado, responda a pergunta e só anda quem acerta. Chegue primeiro ao fim do caminho! No mesmo aparelho ou online, com bots para completar a mesa.',
    tags: ['Com amigos', '2 a 6 jogadores', 'Sem XP: só diversão'],
    icon: <CasinoRoundedIcon sx={{ fontSize: 56 }} />,
    fallback: 'from-violet to-info',
  },
  {
    id: 'duel',
    design: 'DUEL',
    title: 'Duelo de Figurinhas',
    text: 'Monte um Time de 12 das suas figurinhas, use o Vigor do turno para colocá-las nas 3 arenas e vença 2 delas. Cada figurinha tem um Dom ligado à história do personagem.',
    tags: ['Com amigos ou bot', 'Usa as suas figurinhas', 'Sem XP: só diversão'],
    icon: <StyleRoundedIcon sx={{ fontSize: 56 }} />,
    fallback: 'from-danger to-accent',
  },
  {
    id: 'minigames',
    design: 'MINIGAMES',
    title: 'Mini games',
    text: 'Jogos rápidos para treinar o que você sabe da Bíblia: caça-palavras, forca, quebra-cabeça e mais. Cada pedra do Peitoral libera jogos novos.',
    tags: ['Sozinho', 'Liberados pelas pedras', 'Sem XP · moedas do dia'],
    icon: <ExtensionRoundedIcon sx={{ fontSize: 56 }} />,
    fallback: 'from-success to-info',
    unlock: 'Libere jogando a Campanha: cada pedra do Peitoral que você conquista abre mini games novos. Complete o Peitoral e entre no ranking semanal.',
  },
];

/** Aba Jogar: um cartão explicativo para cada jogo. A capa de cada um é enviada pelo painel. */
export function PlayHub({ onOpen, quizRunning }: { onOpen: (mode: PlayMode) => void; quizRunning: boolean }) {
  const images = useGameModeImages();
  return (
    <section className="space-y-4" aria-label="Jogos">
      <SectionHeading title="Jogar" subtitle="Escolha um jogo. Cada um tem a sua tela." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PLAY_MODES.map((mode) => {
          const image = images[mode.design];
          return (
            <li key={mode.id}>
              <button
                type="button"
                onClick={() => onOpen(mode.id)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-3xl border-2 border-edge bg-surface text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
              >
                <span className={cn('relative block aspect-[16/10] w-full overflow-hidden bg-gradient-to-br text-white', mode.fallback)}>
                  {image ? <img src={image} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <span className="absolute inset-0 flex items-center justify-center opacity-90">{mode.icon}</span>}
                  <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
                  <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
                    <span className="font-display text-2xl font-bold leading-tight drop-shadow">{mode.title}</span>
                    {mode.id === 'quiz' && quizRunning ? <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-bold text-on-accent">Em andamento</span> : null}
                  </span>
                </span>
                <span className="flex flex-1 flex-col gap-3 p-4">
                  <span className="text-sm font-semibold leading-6 text-muted">{mode.text}</span>
                  {mode.unlock ? <span className="rounded-xl bg-primary/10 p-2.5 text-xs font-bold leading-5 text-ink">🔒 {mode.unlock}</span> : null}
                  <span className="flex flex-wrap gap-1.5">
                    {mode.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold text-ink">
                        {tag}
                      </span>
                    ))}
                  </span>
                  <span className="mt-auto flex items-center justify-end gap-1 font-display text-base font-bold text-primary">
                    {mode.id === 'quiz' && quizRunning ? 'Continuar' : 'Jogar'} <ChevronRightRoundedIcon />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const TITLES: Record<PlayMode, { title: string; subtitle: string }> = {
  quiz: { title: 'Quiz Bíblico', subtitle: 'Responda, ganhe XP, moedas e figurinhas.' },
  board: { title: 'Tabuleiro', subtitle: 'Partidas sem XP nem moedas: é só diversão.' },
  duel: { title: 'Duelo de Figurinhas', subtitle: 'Figurinhas com Dons, 3 arenas e 6 turnos. Sem XP nem moedas.' },
  minigames: { title: 'Mini games', subtitle: 'Cada pedra do Peitoral libera um jogo. Sem XP; a 1ª vitória do dia rende moedas.' },
};

/** Moldura da tela de um jogo: botão para voltar aos jogos e o título. */
export function PlayModeFrame({ mode, onBack, children }: { mode: PlayMode; onBack: () => void; children: ReactNode }) {
  const info = TITLES[mode];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label="Voltar para os jogos" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
          <ChevronRightRoundedIcon className="rotate-180" />
        </button>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{info.title}</h2>
          <p className="text-sm text-muted">{info.subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
