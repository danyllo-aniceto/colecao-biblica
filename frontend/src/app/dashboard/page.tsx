'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { UserDashboard } from '@/components/user/user-dashboard';

export default function DashboardPage() {
  const { isAdmin } = useAuth();

  return (
    <RequireAuth>
      {isAdmin ? <AdminDashboard /> : <UserDashboard />}
    </RequireAuth>
  );
}
