import { useEffect, useRef, useState, type PointerEvent } from 'react';
import ZoomInRoundedIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutRoundedIcon from '@mui/icons-material/ZoomOutRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';

/** Moldura da figurinha (retrato 3:4), em pixels na tela. */
const FRAME_W = 240;
const FRAME_H = 320;
/** Tamanho final da imagem recortada. */
const OUTPUT_W = 900;
const OUTPUT_H = 1200;

type Props = {
  file: File;
  onCancel: () => void;
  /** Recebe a imagem recortada, ou o arquivo original se o admin pular o recorte. */
  onDone: (file: File) => void;
};

/** Enquadrar a imagem na moldura da figurinha: arraste para posicionar e use o zoom. */
export function ImageCropper({ file, onCancel, onDone }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  // A URL é criada e revogada no mesmo efeito (no modo estrito o efeito roda duas vezes).
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const element = new Image();
    element.onload = () => {
      setUrl(objectUrl);
      setImage(element);
    };
    element.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  // Escala que faz a imagem cobrir a moldura no zoom 1.
  const baseScale = image ? Math.max(FRAME_W / image.naturalWidth, FRAME_H / image.naturalHeight) : 1;
  const scale = baseScale * zoom;
  const width = (image?.naturalWidth ?? 0) * scale;
  const height = (image?.naturalHeight ?? 0) * scale;

  /** Mantém a imagem sempre cobrindo a moldura (sem bordas vazias). */
  function clamp(next: { x: number; y: number }, w = width, h = height) {
    const maxX = Math.max(0, (w - FRAME_W) / 2);
    const maxY = Math.max(0, (h - FRAME_H) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) };
  }

  function changeZoom(next: number) {
    const value = Math.min(4, Math.max(1, next));
    setZoom(value);
    if (image) {
      const w = image.naturalWidth * baseScale * value;
      const h = image.naturalHeight * baseScale * value;
      setOffset((current) => clamp(current, w, h));
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setOffset(clamp({ x: drag.current.ox + event.clientX - drag.current.x, y: drag.current.oy + event.clientY - drag.current.y }));
  }

  async function confirm() {
    if (!image) return;
    setSaving(true);
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT_W;
    canvas.height = OUTPUT_H;
    const context = canvas.getContext('2d');
    if (!context) {
      onDone(file);
      return;
    }
    // Canto superior esquerdo da moldura em coordenadas da imagem original.
    const left = (width - FRAME_W) / 2 - offset.x;
    const top = (height - FRAME_H) / 2 - offset.y;
    context.drawImage(image, left / scale, top / scale, FRAME_W / scale, FRAME_H / scale, 0, 0, OUTPUT_W, OUTPUT_H);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    const type = blob?.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const result = blob && blob.type === type ? blob : await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    if (!result) {
      onDone(file);
      return;
    }
    onDone(new File([result], file.name.replace(/\.[^.]+$/, '') + (type === 'image/webp' ? '.webp' : '.jpg'), { type }));
  }

  return (
    <Modal
      open
      size="sm"
      title="Enquadrar imagem"
      description="Arraste a imagem para posicionar e ajuste o zoom. O que estiver dentro da moldura vira a figurinha."
      onClose={saving ? undefined : onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={() => onDone(file)} disabled={saving}>
            Usar sem recortar
          </Button>
          <Button onClick={() => void confirm()} loading={saving}>
            {saving ? 'Recortando...' : 'Recortar e enviar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="relative cursor-grab touch-none overflow-hidden rounded-3xl border-4 border-primary bg-surface-3 active:cursor-grabbing"
          style={{ width: FRAME_W, height: FRAME_H }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onWheel={(event) => changeZoom(zoom - event.deltaY * 0.0015)}
        >
          {image && url ? (
            <img
              src={url}
              alt="Imagem a recortar"
              draggable={false}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={{ width, height, transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Spinner size="lg" />
            </div>
          )}
        </div>
        <div className="flex w-full items-center gap-3">
          <button type="button" aria-label="Diminuir zoom" onClick={() => changeZoom(zoom - 0.25)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-3 hover:text-ink">
            <ZoomOutRoundedIcon />
          </button>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(event) => changeZoom(Number(event.target.value))}
            className="range flex-1"
          />
          <button type="button" aria-label="Aumentar zoom" onClick={() => changeZoom(zoom + 0.25)} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-3 hover:text-ink">
            <ZoomInRoundedIcon />
          </button>
        </div>
      </div>
    </Modal>
  );
}
