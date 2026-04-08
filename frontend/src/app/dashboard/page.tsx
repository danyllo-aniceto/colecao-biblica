'use client';

import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AdminDashboard } from '@/components/admin/admin-dashboard';

export default function DashboardPage() {
  const { signOut, user, isAdmin } = useAuth();

  return (
    <RequireAuth>
      {isAdmin ? (
        <AdminDashboard />
      ) : (
        <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Bem-vindo à sua conta</CardTitle>
                <CardDescription>
                  {user ? `Olá, ${user.name}. Seu acesso foi confirmado com sucesso.` : 'Seu acesso foi confirmado com sucesso.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-stone-600">
                  Esta área confirma o fluxo básico de autenticação do usuário comum.
                </div>
                <Button variant="secondary" onClick={signOut}>
                  Sair
                </Button>
              </CardContent>
            </Card>
          </div>
        </main>
      )}
    </RequireAuth>
  );
}
