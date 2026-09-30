import { lazy, Suspense } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { UserDashboard } from '@/components/user/user-dashboard';

// O painel do admin (editor de texto, diagramas) só é baixado por quem é admin.
const AdminDashboard = lazy(() => import('@/components/admin/admin-dashboard').then((module) => ({ default: module.AdminDashboard })));

export function DashboardPage() {
  const { isAdmin } = useAuth();

  return (
    <RequireAuth>
      {isAdmin ? (
        <Suspense fallback={<PageLoading />}>
          <AdminDashboard />
        </Suspense>
      ) : (
        <UserDashboard />
      )}
    </RequireAuth>
  );
}

export function PageLoading() {
  return (
    <div role="status" className="flex min-h-dvh items-center justify-center font-display text-lg font-semibold text-muted">
      Carregando...
    </div>
  );
}
