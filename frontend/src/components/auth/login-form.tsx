import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { Alert } from '@/components/game/game-ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/components/providers/auth-provider';

type AuthMode = 'login' | 'register';

export function LoginForm() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();
  // O link de convite de uma sala leva direto para criar a conta (?conta=criar).
  const [params] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(params.get('conta') === 'criar' ? 'register' : 'login');
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
          ? 'Conta criada! Sua jornada começa agora.'
          : 'Bem-vindo de volta. Sua jornada continua.',
      );
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível concluir a autenticação.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="panel overflow-hidden p-6 sm:p-8">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-3 p-1" role="tablist" aria-label="Entrar ou criar conta">
        {(['login', 'register'] as const).map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => switchMode(item)}
            className={
              mode === item
                ? 'h-11 rounded-xl bg-surface font-display font-semibold text-ink shadow-[0_2px_0_var(--edge-strong)]'
                : 'h-11 rounded-xl font-display font-semibold text-muted transition hover:text-ink'
            }
          >
            {item === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        ))}
      </div>

      <h2 className="mt-6 font-display text-3xl font-bold text-ink">{isRegisterMode ? 'Comece sua coleção' : 'Bem-vindo de volta!'}</h2>
      <p className="mt-1 text-sm text-muted">{isRegisterMode ? 'Leva menos de um minuto.' : 'Sua jornada continua de onde parou.'}</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        {isRegisterMode ? (
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome" required />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seuemail@exemplo.com" required />
        </div>

        <PasswordField
          id="password"
          label="Senha"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
          autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
        />

        {isRegisterMode ? (
          <PasswordField
            id="confirm-password"
            label="Confirmar senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            visible={showConfirmPassword}
            onToggle={() => setShowConfirmPassword((current) => !current)}
            autoComplete="new-password"
            placeholder="Repita a senha"
          />
        ) : null}

        {errorMessage ? <Alert tone="danger">{errorMessage}</Alert> : null}
        {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}

        <Button type="submit" size="xl" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Entrando...' : isRegisterMode ? 'Criar minha conta' : 'Entrar e jogar'}
        </Button>
      </form>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  autoComplete,
  placeholder = 'Digite sua senha',
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  autoComplete: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="pr-12"
          required
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
          className="absolute inset-y-0 right-1 my-auto flex h-10 w-10 items-center justify-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-ink"
        >
          {visible ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
        </button>
      </div>
    </div>
  );
}
