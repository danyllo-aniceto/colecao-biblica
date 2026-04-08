'use client';

import { useEffect, useState } from 'react';
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded';
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded';

type Theme = 'light' | 'dark';

const STORAGE_KEY = 'colecao-biblica:theme';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const persisted = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (persisted === 'dark' || persisted === 'light') {
      setTheme(persisted);
      applyTheme(persisted);
      return;
    }

    const systemTheme: Theme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    setTheme(systemTheme);
    applyTheme(systemTheme);
  }, []);

  function handleToggle() {
    const nextTheme: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
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
