'use client';

import { useSyncExternalStore } from 'react';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';
import { applyTheme, readTheme, subscribeTheme, type Theme } from '@/lib/theme';

function getServerTheme(): Theme {
  return 'light';
}

export function ThemeToggle() {
  // O tema é aplicado no <html> pelo script inline do layout; aqui só refletimos e alternamos.
  const theme = useSyncExternalStore(subscribeTheme, readTheme, getServerTheme);

  function handleToggle() {
    applyTheme(theme === 'light' ? 'dark' : 'light');
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_80%,white)] px-4 text-sm font-medium text-[var(--text-primary)] transition hover:brightness-105"
      aria-label="Alternar tema"
      title="Alternar tema"
    >
      <span className="inline-flex h-4 w-4 items-center justify-center text-[var(--gold)]" aria-hidden="true">
        {theme === 'light' ? <DarkModeRoundedIcon fontSize="inherit" /> : <LightModeRoundedIcon fontSize="inherit" />}
      </span>
      <span>{theme === 'light' ? 'Modo escuro' : 'Modo claro'}</span>
    </button>
  );
}
