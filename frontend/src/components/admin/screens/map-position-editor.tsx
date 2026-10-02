import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { defaultNodePosition, listAllNodes, saveNodePositions, type AdminNode, type AdminScenario } from '@/lib/admin-campaign-api';
import { scenarioFallbackBackground, scenarioMapSrc } from '@/lib/campaign-theme';

type Point = { x: number; y: number };

const clamp = (value: number) => Math.min(100, Math.max(0, value));
const round = (value: number) => Math.round(value * 10) / 10;

function pathThrough(points: Point[]) {
  return points
    .map((point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`;
      const previous = points[index - 1];
      const middle = (previous.y + point.y) / 2;
      return `C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
    })
    .join(' ');
}

/**
 * Editor visual do mapa: mostra o mapa do cenário e deixa o admin arrastar cada parada com o mouse
 * (ou o dedo, ou as setas do teclado) para onde quiser; depois salva todas de uma vez.
 */
export function MapPositionEditor({ scenario, onClose, onSaved }: { scenario: AdminScenario; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { confirm } = useDialogs();
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [nodes, setNodes] = useState<AdminNode[] | null>(null);
  const [points, setPoints] = useState<Record<number, Point>>({});
  const [automatic, setAutomatic] = useState(false);
  const [touched, setTouched] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [snap, setSnap] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoPoints = useCallback((list: AdminNode[]) => Object.fromEntries(list.map((node, index) => [node.id, defaultNodePosition(index, list.length)])) as Record<number, Point>, []);

  useEffect(() => {
    let ignore = false;
    listAllNodes(scenario.id)
      .then((list) => {
        if (ignore) return;
        const sorted = [...list].sort((a, b) => a.level - b.level);
        const auto = autoPoints(sorted);
        const start = Object.fromEntries(sorted.map((node) => [node.id, node.posX !== null && node.posY !== null ? { x: node.posX, y: node.posY } : auto[node.id]])) as Record<number, Point>;
        setNodes(sorted);
        setPoints(start);
        setAutomatic(sorted.every((node) => node.posX === null || node.posY === null));
      })
      .catch((reason: unknown) => !ignore && setError(errorMessage(reason)));
    return () => {
      ignore = true;
    };
  }, [scenario.id, autoPoints]);

  const ordered = nodes ?? [];
  const pathPoints = ordered.map((node) => points[node.id]).filter(Boolean);

  function place(id: number, x: number, y: number) {
    const fix = (value: number) => (snap ? Math.round(value / 5) * 5 : round(value));
    setAutomatic(false);
    setTouched(true);
    setPoints((current) => ({ ...current, [id]: { x: clamp(fix(x)), y: clamp(fix(y)) } }));
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>, id: number) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(id);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>, id: number) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    place(id, ((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, id: number) {
    const step = event.shiftKey ? 5 : 1;
    const delta: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const move = delta[event.key];
    if (!move) return;
    event.preventDefault();
    const current = points[id];
    place(id, current.x + move.x, current.y + move.y);
  }

  function resetToAutomatic() {
    if (!nodes) return;
    setPoints(autoPoints(nodes));
    setAutomatic(true);
    setTouched(true);
  }

  async function close() {
    if (touched && !saving) {
      const ok = await confirm({ title: 'Descartar as posições alteradas?', message: 'O que você moveu ainda não foi salvo.', confirmLabel: 'Descartar', tone: 'danger' });
      if (!ok) return;
    }
    onClose();
  }

  async function save() {
    if (!nodes) return;
    setSaving(true);
    try {
      await saveNodePositions(
        scenario.id,
        nodes.map((node) => ({ id: node.id, posX: automatic ? null : Math.round(points[node.id].x), posY: automatic ? null : Math.round(points[node.id].y) })),
      );
      toast.success(automatic ? 'Posições automáticas restauradas.' : 'Posições salvas.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="xl"
      title={`Posição das paradas: ${scenario.name}`}
      description="Arraste cada parada para onde quiser no mapa. Com uma parada selecionada, as setas do teclado movem 1% (Shift: 5%)."
      onClose={saving ? undefined : () => void close()}
      footer={
        <>
          <Button variant="secondary" onClick={() => void close()} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!nodes || !touched}>
            Salvar posições
          </Button>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!nodes && !error ? <LoadingState label="Carregando as paradas..." /> : null}
      {nodes && nodes.length === 0 ? <Alert tone="info">Este cenário ainda não tem paradas. Crie as paradas primeiro.</Alert> : null}
      {nodes && nodes.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <div
            ref={mapRef}
            className="relative mx-auto aspect-[3/4] w-full max-w-sm touch-none select-none overflow-hidden rounded-3xl border-4 border-edge-strong shadow-lg"
            style={{ background: scenarioFallbackBackground(scenario.color) }}
            onPointerDown={(event) => event.target === event.currentTarget && setSelected(null)}
          >
            {!mapFailed ? <img src={scenarioMapSrc(scenario)} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" onError={() => setMapFailed(true)} /> : null}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
              <path d={pathThrough(pathPoints)} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d={pathThrough(pathPoints)} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeDasharray="1 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            {ordered.map((node) => {
              const point = points[node.id];
              if (!point) return null;
              return (
                <button
                  key={node.id}
                  type="button"
                  aria-label={`Parada do nível ${node.level}, posição ${Math.round(point.x)}% por ${Math.round(point.y)}%`}
                  onPointerDown={(event) => onPointerDown(event, node.id)}
                  onPointerMove={(event) => onPointerMove(event, node.id)}
                  onKeyDown={(event) => onKeyDown(event, node.id)}
                  onFocus={() => setSelected(node.id)}
                  className="group absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none flex-col items-center gap-0.5 active:cursor-grabbing focus-visible:outline-none"
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                >
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full border-4 border-white bg-primary font-display font-bold text-on-primary shadow-lg transition-transform group-hover:scale-110',
                      node.relic ? 'h-14 w-14' : 'h-11 w-11',
                      selected === node.id && 'scale-110 ring-4 ring-info',
                    )}
                  >
                    {node.relic ? <StarRoundedIcon /> : node.level}
                  </span>
                  <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">Nv {node.level}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Switch checked={snap} onChange={setSnap} label="Alinhar na grade de 5%" />
              <Button variant="secondary" size="sm" onClick={resetToAutomatic}>
                <RestartAltRoundedIcon fontSize="small" /> Voltar ao automático
              </Button>
            </div>
            {automatic ? <Alert tone="info">Posições automáticas (zigue-zague). Mexa em uma parada para definir as suas.</Alert> : null}
            <ul className="space-y-2">
              {ordered.map((node) => {
                const point = points[node.id];
                if (!point) return null;
                return (
                  <li key={node.id} className={cn('flex items-center gap-3 rounded-2xl border-2 p-2 transition', selected === node.id ? 'border-info bg-info/10' : 'border-edge')}>
                    <button type="button" onClick={() => setSelected(node.id)} className="min-w-[5.5rem] flex-1 text-left">
                      <span className="block font-display font-bold text-ink">Nível {node.level}</span>
                      <span className="block truncate text-xs text-muted">{node.relic ? '★ ' : ''}{node.title ?? (node.relic ? 'Relíquia' : 'Parada')}</span>
                    </button>
                    <div className="w-20 shrink-0">
                      <Input type="number" min={0} max={100} aria-label={`x do nível ${node.level}`} value={Math.round(point.x)} onChange={(event) => place(node.id, Number(event.target.value) || 0, point.y)} />
                    </div>
                    <div className="w-20 shrink-0">
                      <Input type="number" min={0} max={100} aria-label={`y do nível ${node.level}`} value={Math.round(point.y)} onChange={(event) => place(node.id, point.x, Number(event.target.value) || 0)} />
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted">x e y são porcentagens a partir do canto superior esquerdo do mapa. O jogador vê exatamente esta disposição.</p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
