import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/components/providers/auth-provider';
import { LoadingState } from '@/components/ui/spinner';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const { isHydrated, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, isHydrated, navigate]);

  if (!isHydrated) {
    return <LoadingState fullScreen label="Carregando sessão..." />;
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
