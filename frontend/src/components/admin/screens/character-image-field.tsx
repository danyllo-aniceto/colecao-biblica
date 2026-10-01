import { useRef, useState, type DragEvent } from 'react';
import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { uploadImage } from '@/lib/uploads';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/avif';

/**
 * Imagem da figurinha: arraste, toque para escolher ou cole um link. A imagem
 * é reduzida no navegador antes do envio (fotos grandes do celular funcionam).
 */
export function CharacterImageField({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { prompt } = useDialogs();
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [broken, setBroken] = useState(false);

  async function send(file: File) {
    setUploading(true);
    try {
      const result = await uploadImage(file, 'personagens');
      setBroken(false);
      onChange(result.url);
      toast.success('Imagem enviada.', {
        description: result.storage === 'inline' ? 'Guardada no banco (Vercel Blob não configurado).' : result.storage === 'private' ? 'Guardada no Vercel Blob (store privado).' : 'Guardada no Vercel Blob.',
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível enviar a imagem.'));
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void send(file);
  }

  async function pasteLink() {
    const url = await prompt({
      title: 'Imagem por link',
      label: 'Endereço da imagem',
      inputType: 'url',
      placeholder: 'https://...',
      defaultValue: value.startsWith('http') ? value : '',
      validate: (text) => (/^https?:\/\//i.test(text.trim()) ? null : 'Informe um endereço começando com https://'),
    });
    if (url) {
      setBroken(false);
      onChange(url.trim());
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'relative flex min-h-56 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border-2 border-dashed p-4 text-center transition',
          dragging ? 'border-primary bg-primary/10' : 'border-edge-strong bg-surface-2',
        )}
      >
        {value && !broken ? (
          <img src={value} alt="Imagem da figurinha" onError={() => setBroken(true)} className="max-h-72 rounded-2xl object-contain shadow-lg" />
        ) : (
          <>
            <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/20 text-primary-strong dark:text-primary">
              <AddPhotoAlternateRoundedIcon sx={{ fontSize: 34 }} />
            </span>
            <div>
              <p className="font-display font-semibold text-ink">{broken ? 'Não foi possível abrir esta imagem' : 'Arraste uma imagem para cá'}</p>
              <p className="text-xs text-muted">PNG, JPG, WEBP, GIF ou AVIF. Fotos grandes são reduzidas automaticamente. Ideal: retrato 3:4.</p>
            </div>
          </>
        )}
        {uploading ? (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface/80 font-display font-semibold text-ink backdrop-blur-sm">
            <Spinner size="lg" />
            Enviando imagem...
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {value ? <SwapHorizRoundedIcon fontSize="small" /> : <AddPhotoAlternateRoundedIcon fontSize="small" />}
          {value ? 'Trocar imagem' : 'Escolher imagem'}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => void pasteLink()} disabled={uploading}>
          <LinkRoundedIcon fontSize="small" />
          Usar link
        </Button>
        {value ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setBroken(false);
              onChange('');
            }}
            disabled={uploading}
          >
            <DeleteOutlineRoundedIcon fontSize="small" />
            Remover
          </Button>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void send(file);
        }}
      />
    </div>
  );
}
