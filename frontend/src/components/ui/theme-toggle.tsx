import { useSyncExternalStore } from 'react';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { Tooltip } from '@/components/ui/tooltip';
import { applyTheme, readTheme, subscribeTheme, type Theme } from '@/lib/theme';

function getServerTheme(): Theme {
  return 'light';
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  // O tema é aplicado no <html> pelo script inline do layout; aqui só refletimos e alternamos.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, getServerTheme);

  function handleToggle() {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  }

  const label = theme === 'light' ? 'Modo escuro' : 'Modo claro';

  const button = (
    <button
      type="button"
      onClick={handleToggle}
      className={
        compact
          ? 'inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-edge bg-surface-2 text-primary transition hover:bg-surface-3'
          : 'inline-flex h-10 items-center gap-2 rounded-2xl border border-edge bg-surface-2 px-4 font-display text-sm font-semibold text-ink transition hover:bg-surface-3'
      }
      aria-label={label}
    >
      <span className="inline-flex items-center justify-center text-primary" aria-hidden="true">
        {theme === 'light' ? <DarkModeRoundedIcon fontSize="small" /> : <LightModeRoundedIcon fontSize="small" />}
      </span>
      {compact ? null : <span>{label}</span>}
    </button>
  );
  return compact ? <Tooltip content={label}>{button}</Tooltip> : button;
}
