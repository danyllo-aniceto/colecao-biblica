import { useEffect, useRef, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { buildStripCanvas, canvasToFile, imageSize } from '@/lib/sprite-strip';
import { uploadImage } from '@/lib/uploads';
import { MAX_FRAMES } from '@runner/characters';
import { cellRects } from '@runner/sprite-strip';
import { SpriteView } from '@/components/user/corrida/sprite-view';
import { cn } from '@/lib/cn';
import { IconAction } from './admin-ui';

/** `cells` fica como texto (é o que o campo numérico guarda); `size` vem da própria imagem, para avisar se a tira não é de quadros quadrados. */
type Item = { id: number; file: File; thumb: string; cells: string; size: { w: number; h: number } | null };

/** Quadros que o item declara (1 a MAX_FRAMES) ou `null` se o campo estiver inválido. */
function cellsOf(item: Item): number | null {
  const value = Number(item.cells);
  return item.cells.trim() !== '' && Number.isInteger(value) && value >= 1 && value <= MAX_FRAMES ? value : null;
}

let nextId = 1;

/**
 * Monta a pose a partir de quadros soltos ou de tiras prontas: escolha as imagens (cada uma vale 1 quadro ou uma tira de N quadros, em "Quadros nesta
 * imagem"), confira a ordem e a prévia animada, e use. O painel junta tudo numa tira só (mesma escala, pés na base), tira o fundo verde se pedido e envia. O resultado volta por `onBuilt` (endereço + quantidade de quadros).
 */
export function FrameStripBuilder({ poseName, fps = 8, onBuilt }: { poseName: string; fps?: number; onBuilt: (url: string, frames: number) => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [removeGreen, setRemoveGreen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Libera as miniaturas ao sair.
  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.thumb));
    },
    [],
  );

  const total = items.reduce((sum, item) => sum + (cellsOf(item) ?? 0), 0);
  const allValid = items.length > 0 && items.every((item) => cellsOf(item) !== null);
  const overflow = total > MAX_FRAMES;
  const ready = allValid && !overflow;
  const buildKey = items.map((item) => `${item.id}:${item.cells}`).join('|');

  // Prévia local (sem enviar nada): remonta a cada mudança, quando os campos estão válidos.
  useEffect(() => {
    if (items.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return undefined;
    }
    if (!ready) return undefined;
    let cancelled = false;
    buildStripCanvas(
      items.map((item) => ({ file: item.file, cells: cellsOf(item) ?? 1 })),
      { removeGreen },
    )
      .then(({ canvas }) => {
        if (cancelled) return;
        setPreview(canvas.toDataURL('image/png'));
        setPreviewError(null);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setPreviewError(errorMessage(reason));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildKey, removeGreen, ready]);

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = [...files].filter((file) => file.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (picked.length < files.length) toast.error('Alguns arquivos não são imagens e foram ignorados.');
    // Cada arquivo novo entra com 1 quadro; o que passar do limite (somando os quadros já declarados) fica de fora.
    const room = Math.max(0, MAX_FRAMES - total);
    if (picked.length > room) toast.error(`No máximo ${MAX_FRAMES} quadros por pose (a soma de todas as imagens).`);
    const added: Item[] = picked.slice(0, room).map((file) => ({ id: nextId++, file, thumb: URL.createObjectURL(file), cells: '1', size: null }));
    setItems((current) => [...current, ...added]);
    // O tamanho de cada imagem chega depois e serve só para o aviso de "tira que não parece de quadros quadrados".
    for (const item of added) {
      imageSize(item.file)
        .then((size) => setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, size } : entry))))
        .catch(() => undefined);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function setCells(index: number, cells: string) {
    setItems((current) => current.map((item, position) => (position === index ? { ...item, cells } : item)));
  }

  function move(index: number, delta: number) {
    setItems((current) => {
      const target = index + delta;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setItems((current) => {
      URL.revokeObjectURL(current[index].thumb);
      return current.filter((_, position) => position !== index);
    });
  }

  async function send() {
    if (items.length === 0) return;
    if (!allValid) {
      toast.error(`Confira os quadros de cada imagem (de 1 a ${MAX_FRAMES}).`);
      return;
    }
    if (overflow) {
      toast.error(`Os quadros somam ${total}, e o máximo é ${MAX_FRAMES} por pose. Reduza o número de quadros de alguma imagem ou remova imagens.`);
      return;
    }
    setSending(true);
    try {
      const { canvas, frames } = await buildStripCanvas(
        items.map((item) => ({ file: item.file, cells: cellsOf(item) ?? 1 })),
        { removeGreen },
      );
      const uploaded = await uploadImage(await canvasToFile(canvas, `${poseName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'pose'}.png`), 'conteudo');
      onBuilt(uploaded.url, frames);
      items.forEach((item) => URL.revokeObjectURL(item.thumb));
      setItems([]);
      toast.success('Quadros montados e enviados.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={sending || total >= MAX_FRAMES}>
          <PhotoLibraryRoundedIcon fontSize="small" /> {items.length ? 'Adicionar mais imagens' : 'Escolher as imagens'}
        </Button>
        <span className="text-xs font-semibold text-muted">Escolha várias imagens de uma vez: quadros soltos (1 quadro cada) ou tiras prontas (informe quantos quadros há em cada uma). A ordem é a do nome do arquivo e dá para trocar abaixo. No máximo {MAX_FRAMES} quadros no total.</span>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple className="hidden" onChange={(event) => add(event.target.files)} />
      </div>

      {items.length > 0 ? (
        <>
          <ol className="flex flex-wrap gap-2">
            {items.map((item, index) => {
              const cells = cellsOf(item);
              const strip = (cells ?? 1) > 1;
              const warning = cells !== null && item.size ? cellRects(item.size, cells).warning : null;
              return (
                <li key={item.id} className={cn('flex flex-col items-center gap-1 rounded-xl border-2 border-edge bg-surface p-1.5', strip ? 'w-48' : 'w-28')}>
                  <span className={cn('relative flex h-16 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--surface-3)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]', strip ? 'w-full' : 'w-16')}>
                    <img src={item.thumb} alt={strip ? `Tira ${index + 1} com ${cells} quadros` : `Quadro ${index + 1}`} className="h-full w-full object-contain" />
                    <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{strip ? `${cells} quadros` : index + 1}</span>
                  </span>
                  <Field label="Quadros nesta imagem" error={cells === null ? `De 1 a ${MAX_FRAMES}.` : undefined} htmlFor={`strip-cells-${item.id}`} className="w-full">
                    <Input id={`strip-cells-${item.id}`} type="number" min={1} max={MAX_FRAMES} value={item.cells} onChange={(event) => setCells(index, event.target.value)} disabled={sending} />
                  </Field>
                  {warning ? <p className="w-full text-[11px] font-semibold leading-tight text-warning-strong dark:text-primary">{warning}</p> : null}
                  <span className="flex items-center">
                    <IconAction label="Mover para trás" onClick={() => move(index, -1)} disabled={index === 0 || sending}>
                      <ArrowBackRoundedIcon fontSize="small" />
                    </IconAction>
                    <IconAction label="Remover imagem" tone="danger" onClick={() => remove(index)} disabled={sending}>
                      <CloseRoundedIcon fontSize="small" />
                    </IconAction>
                    <IconAction label="Mover para a frente" onClick={() => move(index, 1)} disabled={index === items.length - 1 || sending}>
                      <ArrowForwardRoundedIcon fontSize="small" />
                    </IconAction>
                  </span>
                </li>
              );
            })}
          </ol>
          {overflow ? <p className="text-xs font-semibold text-danger">Os quadros somam {total}, e o máximo é {MAX_FRAMES} por pose. Reduza o número de quadros de alguma imagem ou remova imagens.</p> : null}
          <Switch checked={removeGreen} onChange={setRemoveGreen} label="Remover o fundo verde (#00FF00)" description="Deixe ligado se gerou os quadros com fundo verde chapado. Se o personagem tiver roupa verde, deixe desligado e remova o fundo por fora." />
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-muted">Prévia da animação</span>
              <span className="rounded-xl bg-[repeating-conic-gradient(var(--surface-3)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-1">
                <SpriteView url={ready ? preview : null} frames={Math.max(1, total)} fps={fps} size={96} />
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {previewError ? <p className="text-xs font-semibold text-danger">{previewError}</p> : null}
              <p className="text-xs font-semibold text-muted">
                {total} {total === 1 ? 'quadro' : 'quadros'} no total. Todos ficam na mesma escala, com os pés alinhados na base.
              </p>
              <Button type="button" onClick={() => void send()} loading={sending} disabled={Boolean(previewError) || !ready}>
                Usar estes quadros
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
