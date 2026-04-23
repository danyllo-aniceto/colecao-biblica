'use client';

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

type MermaidDiagramProps = {
  code: string;
  className?: string;
  initialTheme?: 'default' | 'neutral' | 'forest' | 'dark';
};

let initialized = false;

function ensureMermaidInitialized() {
  if (initialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'strict',
  });

  initialized = true;
}

function extractMermaidErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Sintaxe Mermaid inválida.';
}

export async function validateMermaidSyntax(code: string) {
  const source = code.trim();
  if (!source) {
    return { valid: true as const, error: null as string | null };
  }

  ensureMermaidInitialized();

  try {
    await mermaid.parse(source);
    return { valid: true as const, error: null as string | null };
  } catch (error) {
    return { valid: false as const, error: extractMermaidErrorMessage(error) };
  }
}

export function MermaidDiagram({ code, className, initialTheme = 'neutral' }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [theme, setTheme] = useState<'default' | 'neutral' | 'forest' | 'dark'>(initialTheme);
  const svgHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderDiagram() {
      const source = code.trim();
      if (!source) {
        setSvg('');
        setError(null);
        return;
      }

      ensureMermaidInitialized();

      try {
        mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' });
        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const result = await mermaid.render(id, source);
        if (!isMounted) {
          return;
        }

        setSvg(result.svg);
        setError(null);
      } catch (renderError) {
        if (!isMounted) {
          return;
        }

        setSvg('');
        setError(extractMermaidErrorMessage(renderError));
      }
    }

    void renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [code, theme]);

  useEffect(() => {
    const host = svgHostRef.current;
    const svgElement = host?.querySelector('svg');
    if (!host || !svgElement) {
      return;
    }

    const viewBoxWidth = svgElement.viewBox?.baseVal?.width ?? 0;
    const viewBoxHeight = svgElement.viewBox?.baseVal?.height ?? 0;
    const fallbackWidth = svgElement.getBoundingClientRect().width || 900;
    const fallbackHeight = svgElement.getBoundingClientRect().height || 450;

    const baseWidth = viewBoxWidth > 0 ? viewBoxWidth : fallbackWidth;
    const baseHeight = viewBoxHeight > 0 ? viewBoxHeight : fallbackHeight;

    svgElement.style.width = `${baseWidth * zoom}px`;
    svgElement.style.height = `${baseHeight * zoom}px`;
    svgElement.style.maxWidth = 'none';
    svgElement.style.display = 'block';
  }, [svg, zoom]);

  function changeZoom(nextZoom: number) {
    const clamped = Math.max(0.5, Math.min(2.5, nextZoom));
    setZoom(clamped);
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!svg) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs text-[var(--text-secondary)]">
          Tema
          <select
            className="ml-2 h-8 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-2 text-xs text-[var(--text-primary)]"
            value={theme}
            onChange={(event) => setTheme(event.target.value as 'default' | 'neutral' | 'forest' | 'dark')}
          >
            <option value="neutral">Neutro</option>
            <option value="default">Padrão</option>
            <option value="forest">Floresta</option>
            <option value="dark">Escuro</option>
          </select>
        </label>
        <button type="button" className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs" onClick={() => changeZoom(zoom - 0.15)}>
          - Zoom
        </button>
        <button type="button" className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs" onClick={() => changeZoom(1)}>
          Reset
        </button>
        <button type="button" className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs" onClick={() => changeZoom(zoom + 0.15)}>
          + Zoom
        </button>
        <span className="text-xs text-[var(--text-secondary)]">{Math.round(zoom * 100)}%</span>
      </div>
      <div className="max-h-[26rem] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2">
        <div
          ref={svgHostRef}
          className={className}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
