import { useEffect, useRef, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { buildStripCanvas, canvasToFile } from '@/lib/sprite-strip';
import { uploadImage } from '@/lib/uploads';
import { MAX_FRAMES } from '@runner/characters';
import { SpriteView } from '@/components/user/corrida/sprite-view';
import { IconAction } from './admin-ui';

type Item = { id: number; file: File; thumb: string };

let nextId = 1;

/**
 * Monta a pose a partir de quadros soltos: escolha as imagens (uma por quadro), confira a ordem e a prévia animada, e use. O painel junta tudo
 * numa tira (mesma escala, pés na base), tira o fundo verde se pedido e envia. O resultado volta por `onBuilt` (endereço + quantidade de quadros).
 */
export function FrameStripBuilder({ poseName, onBuilt }: { poseName: string; onBuilt: (url: string, frames: number) => void }) {
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

  // Prévia local (sem enviar nada): remonta a cada mudança.
  useEffect(() => {
    if (items.length === 0) {
      setPreview(null);
      setPreviewError(null);
      return undefined;
    }
    let cancelled = false;
    buildStripCanvas(
      items.map((item) => item.file),
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
  }, [items, removeGreen]);

  function add(files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = [...files].filter((file) => file.type.startsWith('image/')).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (picked.length < files.length) toast.error('Alguns arquivos não são imagens e foram ignorados.');
    setItems((current) => {
      const room = MAX_FRAMES - current.length;
      if (picked.length > room) toast.error(`No máximo ${MAX_FRAMES} quadros por pose.`);
      return [...current, ...picked.slice(0, Math.max(0, room)).map((file) => ({ id: nextId++, file, thumb: URL.createObjectURL(file) }))];
    });
    if (inputRef.current) inputRef.current.value = '';
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
    setSending(true);
    try {
      const { canvas, frames } = await buildStripCanvas(
        items.map((item) => item.file),
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
        <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={sending || items.length >= MAX_FRAMES}>
          <PhotoLibraryRoundedIcon fontSize="small" /> {items.length ? 'Adicionar mais quadros' : 'Escolher os quadros'}
        </Button>
        <span className="text-xs font-semibold text-muted">Escolha várias imagens de uma vez: a ordem é a do nome do arquivo (quadro-1, quadro-2...) e dá para trocar abaixo.</span>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" multiple className="hidden" onChange={(event) => add(event.target.files)} />
      </div>

      {items.length > 0 ? (
        <>
          <ol className="flex flex-wrap gap-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex flex-col items-center gap-1 rounded-xl border-2 border-edge bg-surface p-1.5">
                <span className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg bg-[repeating-conic-gradient(var(--surface-3)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px]">
                  <img src={item.thumb} alt={`Quadro ${index + 1}`} className="h-full w-full object-contain" />
                  <span className="absolute left-0.5 top-0.5 rounded bg-black/60 px-1 text-[10px] font-bold text-white">{index + 1}</span>
                </span>
                <span className="flex items-center">
                  <IconAction label="Mover para trás" onClick={() => move(index, -1)} disabled={index === 0 || sending}>
                    <ArrowBackRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label="Remover quadro" tone="danger" onClick={() => remove(index)} disabled={sending}>
                    <CloseRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label="Mover para a frente" onClick={() => move(index, 1)} disabled={index === items.length - 1 || sending}>
                    <ArrowForwardRoundedIcon fontSize="small" />
                  </IconAction>
                </span>
              </li>
            ))}
          </ol>
          <Switch checked={removeGreen} onChange={setRemoveGreen} label="Remover o fundo verde (#00FF00)" description="Deixe ligado se gerou os quadros com fundo verde chapado. Se o personagem tiver roupa verde, deixe desligado e remova o fundo por fora." />
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-muted">Prévia da animação</span>
              <span className="rounded-xl bg-[repeating-conic-gradient(var(--surface-3)_0%_25%,transparent_0%_50%)] bg-[length:12px_12px] p-1">
                <SpriteView url={preview} frames={items.length} size={96} />
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              {previewError ? <p className="text-xs font-semibold text-danger">{previewError}</p> : null}
              <p className="text-xs font-semibold text-muted">
                {items.length} {items.length === 1 ? 'quadro' : 'quadros'}. Todos ficam na mesma escala, com os pés alinhados na base.
              </p>
              <Button type="button" onClick={() => void send()} loading={sending} disabled={Boolean(previewError)}>
                Usar estes quadros
              </Button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
