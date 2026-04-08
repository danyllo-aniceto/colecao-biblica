import {
  CollectionsBookmarkRounded,
  EmojiEventsRounded,
  FactCheckRounded,
  GroupsRounded,
  MenuBookRounded,
  ShieldRounded,
} from '@mui/icons-material';
import Image from 'next/image';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import logo from '@/assets/logo.png';

const highlights = [
  {
    icon: MenuBookRounded,
    title: 'Aprenda jogando',
    description:
      'Explore histórias bíblicas por meio de desafios rápidos, conteúdos organizados e progressão contínua.',
  },
  {
    icon: CollectionsBookmarkRounded,
    title: 'Monte sua coleção',
    description:
      'Desbloqueie figurinhas temáticas, acompanhe raridades e veja sua evolução a cada nova conquista.',
  },
  {
    icon: FactCheckRounded,
    title: 'Quizzes dinâmicos',
    description:
      'Participe de partidas com perguntas variadas, tempo controlado e feedback imediato para evoluir mais rápido.',
  },
  {
    icon: EmojiEventsRounded,
    title: 'Recompensas e ranking',
    description:
      'Ganhe reconhecimento com recompensas, suba no ranking e mantenha sua jornada ativa todos os dias.',
  },
  {
    icon: GroupsRounded,
    title: 'Comunidade',
    description:
      'Compartilhe progresso, compare resultados e participe de uma experiência de aprendizado com propósito.',
  },
  {
    icon: ShieldRounded,
    title: 'Conta protegida',
    description:
      'Acesso seguro para manter sua coleção, histórico de quizzes e recompensas sempre disponíveis.',
  },
];

const steps = ['Crie sua conta em menos de 1 minuto', 'Faça quizzes e ganhe pontos', 'Desbloqueie figurinhas e recompensas'];

export default function HomePage() {
  return (
    <main className="auth-shell px-4 py-8 sm:px-6 lg:px-10">
      <div className="w-full max-w-7xl space-y-8">
        <div className="mb-5 flex justify-end">
          <ThemeToggle />
        </div>

        <section className="parchment-grain overflow-hidden rounded-[2.2rem] border border-[var(--border)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--bg-secondary)_78%,white),color-mix(in_srgb,var(--bg-primary)_92%,white))] px-5 pb-8 pt-7 shadow-[0_30px_90px_rgba(0,0,0,0.16)] sm:px-8 sm:pt-9">
          <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="animate-fade-up">
              <div className="relative mx-auto max-w-2xl text-center lg:mx-0 lg:text-left">
                <Image
                  src={logo}
                  alt="Logo Coleção Bíblica"
                  priority
                  className="mx-auto h-auto w-[220px] sm:w-[280px] lg:mx-0"
                />
                <h1 className="mt-5 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl">
                  Coleção Bíblica
                </h1>
                <p className="mt-3 text-base leading-7 text-[var(--text-secondary)] sm:text-lg">
                  Uma plataforma gamificada para aprender mais sobre a Bíblia, colecionar figurinhas, competir em quizzes
                  e acompanhar seu progresso de forma clara e envolvente.
                </p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {steps.map((step, index) => (
                  <div
                    key={step}
                    className="animate-fade-up rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_82%,white)] p-4"
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{index + 1}. Etapa</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
              <LoginForm />
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => {
            const Icon = item.icon;

            return (
              <Card
                key={item.title}
                className="animate-fade-up border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_68%,white)]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <CardContent className="p-6">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--gold)_20%,transparent)] text-[var(--accent)]">
                    <Icon fontSize="medium" />
                  </div>
                  <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[var(--text-primary)]">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="animate-fade-up rounded-[1.8rem] border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_84%,white)] p-6 text-center sm:p-8">
          <h3 className="font-[family-name:var(--font-heading)] text-3xl text-[var(--text-primary)]">Pronto para começar?</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
            Faça seu cadastro, inicie sua jornada e transforme aprendizado bíblico em uma experiência leve, divertida e
            recompensadora.
          </p>
        </section>
      </div>
    </main>
  );
}