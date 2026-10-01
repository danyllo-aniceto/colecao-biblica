import { useRef, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import UploadRoundedIcon from '@mui/icons-material/UploadRounded';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { errorMessage, useToast } from '@/components/ui/toast';
import { uploadImage } from '@/lib/uploads';

/** Imagem pequena (ícone, reação, moldura): enviar arquivo, colar link ou remover. */
export function ImageUploadField({ value, onChange, round = false }: { value: string; onChange: (url: string) => void; round?: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadImage(file, 'conteudo');
      onChange(result.url);
      toast.success('Imagem enviada.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden border-2 border-dashed border-edge bg-surface-2 ${round ? 'rounded-full' : 'rounded-2xl'}`}>
        {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <UploadRoundedIcon className="text-muted" />}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
            {uploading ? null : <UploadRoundedIcon fontSize="small" />}
            {value ? 'Trocar imagem' : 'Enviar imagem'}
          </Button>
          {value ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')} disabled={uploading}>
              <DeleteOutlineRoundedIcon fontSize="small" /> Remover
            </Button>
          ) : null}
        </div>
        <Input value={value} onChange={(event) => onChange(event.target.value.trim())} placeholder="ou cole o link da imagem" />
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" onChange={(event) => void pick(event.target.files?.[0])} />
      </div>
    </div>
  );
}
