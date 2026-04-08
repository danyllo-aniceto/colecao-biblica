'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';

type AuthMode = 'login' | 'register';

export function LoginForm() {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isRegisterMode = mode === 'register';

  function resetFeedback() {
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    resetFeedback();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    resetFeedback();

    try {
      if (isRegisterMode) {
        if (!name.trim()) {
          throw new Error('Informe seu nome para criar a conta.');
        }

        if (password !== confirmPassword) {
          throw new Error('As senhas não coincidem.');
        }

        await signUp({
          name: name.trim(),
          email,
          password,
          role: 'USER',
        });
      } else {
        await signIn({ email, password });
      }

      setSuccessMessage(
        isRegisterMode
          ? 'Conta criada com sucesso. Você recebeu sua primeira figurinha!'
          : 'Bem-vindo de volta. Sua jornada continua.',
      );
      router.replace('/dashboard');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="parchment-grain overflow-hidden">
      <CardHeader className="relative p-7 pb-0 sm:p-9 sm:pb-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Coleção Bíblica</p>
        <CardTitle className="mt-3 max-w-md text-3xl leading-tight sm:text-4xl">
          {isRegisterMode ? 'Comece sua jornada' : 'Entrar na sua jornada'}
        </CardTitle>
        <CardDescription className="mt-3 max-w-md text-base">
          {isRegisterMode
            ? 'Crie sua coleção e desbloqueie sua primeira conquista.'
            : 'Continue sua coleção com acesso rápido e seguro.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="p-7 pt-6 sm:p-9 sm:pt-7">
        <div className="mb-6 inline-flex w-full rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_75%,white)] p-1">
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              !isRegisterMode
                ? 'bg-[linear-gradient(135deg,var(--gold),var(--gold-light))] text-[#2c1b10] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Entrar na jornada
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isRegisterMode
                ? 'bg-[linear-gradient(135deg,var(--gold),var(--gold-light))] text-[#2c1b10] shadow-sm'
                : 'text-[var(--text-secondary)]'
            }`}
          >
            Criar coleção
          </button>
        </div>

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          {isRegisterMode ? (
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                placeholder="Seu nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="seuemail@exemplo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                placeholder="Digite sua senha"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((state) => !state)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          {isRegisterMode ? (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Confirme sua senha"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((state) => !state)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-secondary)]"
                >
                  {showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-2xl border border-red-400/35 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-2xl border border-emerald-400/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Processando...' : isRegisterMode ? 'Começar jornada' : 'Entrar na jornada'}
          </Button>

          <p className="text-xs leading-5 text-[var(--text-secondary)]">
            {isRegisterMode
              ? 'Já tem conta? Volte para entrar na sua jornada.'
              : 'Ainda não começou? Clique em criar coleção.'}
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
