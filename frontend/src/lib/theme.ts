export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'colecao-biblica:theme';

/** Cor da barra do sistema/janela do app instalado em cada tema (mesmo --bg-primary do CSS). */
export const THEME_COLORS: Record<Theme, string> = {
  light: '#f5e9d7',
  dark: '#121212',
};

/**
 * Executado inline no <head>, antes da primeira pintura, para aplicar o tema salvo
 * (ou o do sistema) sem "piscar" o tema claro.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);var c=t==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}';var s=function(){document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',c);});};s();document.addEventListener('DOMContentLoaded',s);}catch(e){}})();`;

/** Faz a barra do sistema (e a janela do app instalado) acompanhar o tema escolhido no app. */
function syncThemeColor(theme: Theme) {
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
    meta.setAttribute('content', THEME_COLORS[theme]);
  });
}

export function readTheme(): Theme {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  syncThemeColor(theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Armazenamento indisponível (modo privado): o tema vale só para esta sessão.
  }
}

export function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observer.disconnect();
}
