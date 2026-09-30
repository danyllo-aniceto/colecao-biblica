import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import WifiOffRoundedIcon from '@mui/icons-material/WifiOffRounded';
import { LoginForm } from '@/components/auth/login-form';
import { StickerCard } from '@/components/game/sticker-card';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import logo from '@/assets/logo.png';

const features = [
  { icon: QuizRoundedIcon, title: 'Quizzes com tempo', text: 'Perguntas rápidas, vidas e bônus para virar o jogo.', tone: 'bg-danger/15 text-danger' },
  { icon: CollectionsBookmarkRoundedIcon, title: 'Álbum de figurinhas', text: 'Conquiste personagens da Bíblia em quatro raridades.', tone: 'bg-violet/15 text-violet' },
  { icon: StorefrontRoundedIcon, title: 'Loja de bônus', text: 'Troque moedas por figurinhas, vidas e XP em dobro.', tone: 'bg-primary/20 text-primary-strong dark:text-primary' },
  { icon: EmojiEventsRoundedIcon, title: 'Ranking', text: 'Suba de nível e dispute o topo com outros jogadores.', tone: 'bg-accent/15 text-accent-strong dark:text-accent' },
  { icon: BoltRoundedIcon, title: 'Aprenda jogando', text: 'Cada figurinha abre a história completa do personagem.', tone: 'bg-info/15 text-info' },
  { icon: WifiOffRoundedIcon, title: 'Funciona como app', text: 'Instale no celular e veja sua coleção até sem internet.', tone: 'bg-success/15 text-success' },
];

const showcase = [
  { name: 'Rute', rarity: 'COMMON' },
  { name: 'Davi', rarity: 'RARE' },
  { name: 'Ester', rarity: 'EPIC' },
  { name: 'Paulo', rarity: 'LEGENDARY' },
] as const;

export function HomePage() {
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
          <img src={logo} alt="Coleção Bíblica" width={288} height={288} fetchPriority="high" className="animate-float mx-auto h-auto w-56 drop-shadow-[0_20px_30px_rgba(0,0,0,0.35)] sm:w-72 lg:mx-0" />
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight text-ink sm:text-6xl">
            Aprenda a Bíblia{' '}
            <span className="bg-[linear-gradient(90deg,var(--primary),var(--accent))] bg-clip-text text-transparent">jogando</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted lg:mx-0">
            Responda quizzes, ganhe XP e moedas e complete o álbum com os personagens da Bíblia.
          </p>
          <div className="mt-8 grid grid-cols-4 gap-3 sm:gap-4">
            {showcase.map((item, index) => (
              <div key={item.name} className="animate-pop-in" style={{ animationDelay: `${300 + index * 120}ms`, transform: `rotate(${(index - 1.5) * 4}deg)` }}>
                <StickerCard name={item.name} rarity={item.rarity} owned size="sm" />
              </div>
            ))}
          </div>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <LoginForm />
        </div>
      </section>

      <section className="py-8">
        <h2 className="text-center font-display text-3xl font-bold text-ink sm:text-4xl">Como funciona</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-3">
          {['Crie sua conta grátis', 'Jogue e acerte perguntas', 'Ganhe prêmios e figurinhas'].map((step, index) => (
            <li key={step} className="panel flex items-center gap-4 p-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary font-display text-2xl font-bold text-on-primary shadow-[0_4px_0_var(--primary-strong)]">
                {index + 1}
              </span>
              <span className="font-display text-lg font-semibold text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-4 py-8 sm:grid-cols-2 lg:grid-cols-3">
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
