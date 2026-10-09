import { useEffect, useState } from 'react';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import { LoginForm } from '@/components/auth/login-form';
import { StickerCard } from '@/components/game/sticker-card';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PLAY_MODES } from '@/components/user/play-hub';
import { cn } from '@/lib/cn';
import { useGameModeImages } from '@/lib/game-modes';
import { apiRequest } from '@/lib/http';
import logo from '@/assets/logo-completa.webp';

const features = [
  { icon: CollectionsBookmarkRoundedIcon, title: 'Álbum de figurinhas', text: 'Conquiste personagens da Bíblia em quatro raridades, suba o nível das figurinhas com as repetidas e leia a história completa de cada uma.', tone: 'bg-violet/15 text-violet' },
  { icon: MapRoundedIcon, title: 'Campanha', text: 'Avance de nível por cenários da Bíblia, do Éden à Terra Prometida e além, colecione as 12 pedras do Peitoral e destrave músicas, mapas, prêmios e um mini game novo a cada pedra.', tone: 'bg-info/15 text-info' },
  { icon: TaskAltRoundedIcon, title: 'Missões e prêmio diário', text: 'Metas do dia e da semana, sequência de dias seguidos e baús de recompensa para quem volta sempre.', tone: 'bg-success/15 text-success' },
  { icon: GroupsRoundedIcon, title: 'Amigos e trocas', text: 'Adicione amigos, converse, troque figurinhas e chame todo mundo para jogar online.', tone: 'bg-danger/15 text-danger' },
  { icon: StorefrontRoundedIcon, title: 'Loja de bônus', text: 'Troque moedas por figurinhas, vidas, tempo extra, ícones e visuais para o seu perfil.', tone: 'bg-primary/20 text-primary-strong dark:text-primary' },
  { icon: EmojiEventsRoundedIcon, title: 'Ranking e liga semanal', text: 'Suba de nível e dispute o topo com outros jogadores, com prêmios para os primeiros da semana.', tone: 'bg-accent/15 text-accent-strong dark:text-accent' },
  { icon: BoltRoundedIcon, title: 'Aprenda jogando', text: 'Cada pergunta traz a explicação e a referência bíblica depois de responder.', tone: 'bg-info/15 text-info' },
  { icon: WifiOffRoundedIcon, title: 'Funciona como app', text: 'Instale no celular e veja sua coleção até sem internet.', tone: 'bg-success/15 text-success' },
];

type ShowcaseSticker = { name: string; rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY'; imageUrl?: string | null };

/** Figurinhas de exemplo (as imagens vêm do cadastro; sem rede ou sem imagem, aparece só a moldura). */
const FALLBACK_SHOWCASE: ShowcaseSticker[] = [
  { name: 'Rute', rarity: 'COMMON' },
  { name: 'Davi', rarity: 'RARE' },
  { name: 'Ester', rarity: 'EPIC' },
  { name: 'Paulo', rarity: 'LEGENDARY' },
];

function useShowcase(): ShowcaseSticker[] {
  const [stickers, setStickers] = useState<ShowcaseSticker[]>(FALLBACK_SHOWCASE);
  useEffect(() => {
    let alive = true;
    apiRequest<ShowcaseSticker[]>('/landing/stickers', { method: 'GET' }, 'Não foi possível carregar as figurinhas.')
      .then((list) => {
        if (alive && list.length > 0) setStickers(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return stickers;
}

export function HomePage() {
  const images = useGameModeImages();
  const showcase = useShowcase();
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6">
      <header className="flex items-center justify-between gap-3 py-2">
        <div className="flex items-center gap-2">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <span className="font-display text-lg font-bold text-ink">Coleção Bíblica</span>
        </div>
        <div className="flex items-center gap-2">
          <InstallAppButton />
          <ThemeToggle compact />
        </div>
      </header>

      <section className="grid items-center gap-10 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:py-12">
        <div className="animate-fade-up text-center lg:text-left">
          <img src={logo} alt="Coleção Bíblica" width={640} height={804} fetchPriority="high" className="animate-float mx-auto h-auto w-56 drop-shadow-[0_20px_30px_rgba(0,0,0,0.3)] sm:w-72 lg:mx-0" />
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-ink sm:text-6xl">
            Aprenda a Bíblia{' '}
            <span className="bg-[linear-gradient(90deg,var(--primary),var(--accent))] bg-clip-text text-transparent">jogando</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted lg:mx-0">
            Responda ao quiz, jogue Tabuleiro e Duelo de Figurinhas com os amigos, jogue os mini games (5 já liberados e 12 que se abrem na Campanha), ganhe XP e moedas e complete o álbum com os personagens da Bíblia.
          </p>
          <div className="mt-8 grid grid-cols-4 gap-3 sm:gap-4">
            {showcase.map((item, index) => (
              <div key={item.name} className="animate-pop-in" style={{ animationDelay: `${300 + index * 120}ms`, transform: `rotate(${(index - 1.5) * 4}deg)` }}>
                <StickerCard name={item.name} rarity={item.rarity} imageUrl={item.imageUrl} owned size="sm" eager />
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <LoginForm />
        </div>
      </section>

      <section className="py-8" aria-label="Os jogos">
        <h2 className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">Quatro jeitos de jogar</h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-muted">Um jogo principal para aprender e ganhar prêmios, dois para se divertir com os amigos, sem pressa e sem compromisso, e os 17 mini games, jogos rápidos para treinar a Bíblia: 5 já vêm liberados e os outros 12 se abrem, um por pedra do Peitoral, na Campanha.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLAY_MODES.map((mode, index) => {
            const image = images[mode.design];
            return (
              <li key={mode.id} className="animate-fade-up" style={{ animationDelay: `${index * 90}ms` }}>
                <article className="flex h-full flex-col overflow-hidden rounded-3xl border-2 border-edge bg-surface shadow-sm">
                  <div className={cn('relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br text-white', mode.fallback)}>
                    {image ? <img src={image} alt="" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center opacity-90">{mode.icon}</span>}
                    <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
                    <h3 className="absolute bottom-0 left-0 p-4 font-display text-2xl font-bold leading-tight drop-shadow">{mode.title}</h3>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <p className="text-sm font-semibold leading-6 text-muted">{mode.text}</p>
                    {mode.unlock ? <p className="rounded-xl bg-primary/10 p-2.5 text-xs font-bold leading-5 text-ink">🔒 {mode.unlock}</p> : null}
                    <div className="mt-auto flex flex-wrap gap-1.5">
                      {mode.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-surface-3 px-2.5 py-1 text-xs font-bold text-ink">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="py-8">
        <h2 className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">Como funciona</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {['Crie sua conta grátis', 'Escolha um jogo e divirta-se', 'Ganhe prêmios e complete o álbum'].map((step, index) => (
            <li key={step} className="panel flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-bold text-on-primary shadow-[0_4px_0_var(--primary-strong)]">
                {index + 1}
              </span>
              <span className="font-display text-lg font-semibold text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="py-8" aria-label="Tudo no app">
        <h2 className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">Tudo isso no mesmo app</h2>
      </section>

      <section className="grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <article key={feature.title} className="panel animate-fade-up p-6" style={{ animationDelay: `${index * 70}ms` }}>
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${feature.tone}`}>
                <Icon sx={{ fontSize: 30 }} />
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-ink">{feature.title}</h3>
              <p className="mt-1 text-muted">{feature.text}</p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
