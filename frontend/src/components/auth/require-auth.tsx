'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isHydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isHydrated, router]);

  if (!isHydrated) {
    return (
      <div className="m-4 rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 text-sm text-[var(--text-secondary)]">
        Carregando sessão...
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
