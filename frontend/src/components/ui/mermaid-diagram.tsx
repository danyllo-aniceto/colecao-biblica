import { useEffect, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';

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
  const [rendering, setRendering] = useState(false);
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
      setRendering(true);
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
      } finally {
        if (isMounted) setRendering(false);
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
    return <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-semibold text-danger-strong dark:text-danger">Erro no diagrama: {error}</p>;
  }

  if (!svg) {
    return rendering ? (
      <div className="flex items-center justify-center gap-2 py-6 text-sm font-semibold text-muted">
        <Spinner size="sm" /> Desenhando diagrama...
      </div>
    ) : null;
  }

  const zoomButton = 'flex h-8 w-8 items-center justify-center rounded-lg border border-edge text-ink transition hover:bg-surface-3';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-32">
          <Select
            size="sm"
            aria-label="Tema do diagrama"
            value={theme}
            onChange={(value) => setTheme(value)}
            options={[
              { value: 'neutral', label: 'Neutro' },
              { value: 'default', label: 'Padrão' },
              { value: 'forest', label: 'Floresta' },
              { value: 'dark', label: 'Escuro' },
            ]}
          />
        </div>
        <Tooltip content="Diminuir">
          <button type="button" className={zoomButton} onClick={() => changeZoomBy(-0.15)} aria-label="Diminuir zoom">
            <RemoveRoundedIcon fontSize="small" />
          </button>
        </Tooltip>
        <Tooltip content="Tamanho original">
          <button type="button" className={zoomButton} onClick={() => setZoom(1)} aria-label="Zoom original">
            <RestartAltRoundedIcon fontSize="small" />
          </button>
        </Tooltip>
        <Tooltip content="Aumentar">
          <button type="button" className={zoomButton} onClick={() => changeZoomBy(0.15)} aria-label="Aumentar zoom">
            <AddRoundedIcon fontSize="small" />
          </button>
        </Tooltip>
        <span className="text-xs font-semibold text-muted">{Math.round(zoom * 100)}%</span>
        <span className="hidden text-xs text-muted sm:inline">Ctrl + rolagem para zoom</span>
        {rendering ? <Spinner size="sm" /> : null}
      </div>
      <div
        className="max-h-[26rem] overflow-auto rounded-xl border border-edge bg-white p-2"
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
