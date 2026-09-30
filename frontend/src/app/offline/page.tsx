import type { Metadata } from 'next';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { RetryButton } from './retry-button';

export const metadata: Metadata = {
  title: 'Sem conexão | Coleção Bíblica',
};

/**
 * Exibida pelo service worker quando não há rede e a página pedida não está em cache.
 * Usa apenas recursos que o worker guarda na instalação (ícones e esta própria página).
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-[var(--border)] bg-[var(--bg-secondary)] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.12)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone pré-cacheado; next/image dependeria da rede */}
        <img src="/icons/icon-192.png" alt="" width={96} height={96} className="mx-auto rounded-3xl" />
        <div className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-[var(--accent)]">
          <CloudOffRoundedIcon />
        </div>
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-semibold text-[var(--text-primary)]">Você está offline</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          Esta página ainda não foi salva no seu aparelho. Seu painel, suas figurinhas e o ranking que você já abriu continuam
          disponíveis sem internet.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <RetryButton />
          <a
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[var(--border)] px-5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)]"
          >
            Abrir meu painel
          </a>
        </div>
      </div>
    </main>
  );
}
