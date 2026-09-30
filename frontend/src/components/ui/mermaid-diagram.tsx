import { useEffect, useRef, useState } from 'react';

type MermaidDiagramProps = {
  code: string;
  className?: string;
  initialTheme?: 'default' | 'neutral' | 'forest' | 'dark';
};

type Mermaid = (typeof import('mermaid'))['default'];

let mermaidPromise: Promise<Mermaid> | null = null;

/** O mermaid é grande: só é baixado quando algum diagrama aparece na tela. */
function loadMermaid(): Promise<Mermaid> {
  mermaidPromise ??= import('mermaid').then(({ default: mermaid }) => {
    mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'strict' });
    return mermaid;
  });
  return mermaidPromise;
}

function extractMermaidErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'Sintaxe Mermaid inválida.';
}

export function sanitizeMermaidCode(code: string) {
  const source = code.trim();
  if (!source) {
    return '';
  }

  if (!/^timeline\b/i.test(source)) {
    return source;
  }

  return source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(classDef|class)\b/i.test(line.trim()))
    .join('\n')
    .trim();
}

const MERMAID_START =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram(-v2)?|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|quadrantChart|requirementDiagram|C4\w+|block-beta|sankey-beta|xychart-beta|%%)/i;

/** true quando o texto começa como um diagrama Mermaid (e não é apenas texto comum). */
export function looksLikeMermaid(code?: string | null) {
  const firstLine = (code ?? '').trim().split(/\r?\n/, 1)[0]?.trim() ?? '';
  return MERMAID_START.test(firstLine);
}

export async function validateMermaidSyntax(code: string) {
  const source = sanitizeMermaidCode(code);
  if (!source) {
    return { valid: true as const, error: null as string | null };
  }

  try {
    const mermaid = await loadMermaid();
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

  function changeZoomBy(delta: number) {
    setZoom((currentZoom) => Math.max(0.5, Math.min(2.5, currentZoom + delta)));
  }

  useEffect(() => {
    let isMounted = true;

    async function renderDiagram() {
      const source = sanitizeMermaidCode(code);
      if (!source) {
        setSvg('');
        setError(null);
        return;
      }

      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      try {
        const mermaid = await loadMermaid();
        mermaid.initialize({ startOnLoad: false, theme, securityLevel: 'strict' });
        // parse não insere nada na página; render com erro deixaria o SVG de erro solto no <body>.
        await mermaid.parse(source);
        const result = await mermaid.render(id, source);
        if (!isMounted) {
          return;
        }

        setSvg(result.svg);
        setError(null);
      } catch (renderError) {
        document.getElementById(id)?.remove();
        document.getElementById(`d${id}`)?.remove();
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

  if (error) {
    return <p className="text-sm text-danger">{error}</p>;
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
        <button type="button" className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs" onClick={() => changeZoomBy(-0.15)}>
          - Zoom
        </button>
        <button type="button" className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs" onClick={() => setZoom(1)}>
          Reset
        </button>
        <button type="button" className="h-8 rounded-lg border border-[var(--border)] px-2 text-xs" onClick={() => changeZoomBy(0.15)}>
          + Zoom
        </button>
        <span className="text-xs text-[var(--text-secondary)]">{Math.round(zoom * 100)}%</span>
        <span className="text-xs text-[var(--text-secondary)]">Ctrl + scroll para zoom</span>
      </div>
      <div
        className="max-h-[26rem] overflow-auto rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] p-2"
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) {
            return;
          }

          event.preventDefault();
          changeZoomBy(event.deltaY > 0 ? -0.08 : 0.08);
        }}
      >
        <div
          ref={svgHostRef}
          className={className}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
