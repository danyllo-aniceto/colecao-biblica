import { useEffect, useState } from 'react';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage, useToast } from '@/components/ui/toast';
import { saveGameModeImage, useGameModeImages } from '@/lib/game-modes';
import { AdminPanel } from '../admin-ui';
import { ImageUploadField } from '../image-upload-field';

const DEFAULT_IMAGE = '/compartilhar.jpg';
const DEFAULT_MESSAGE = 'Conheça a Coleção Bíblica! Aprenda a Bíblia jogando: quiz, álbum de figurinhas e jogos para jogar com os amigos. É grátis:';

/** Pega a imagem como arquivo para anexar ao compartilhar (null se o endereço não deixar). */
async function imageFile(src: string): Promise<File | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const extension = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
    return new File([blob], `colecao-biblica.${extension}`, { type: blob.type || 'image/jpeg' });
  } catch {
    return null;
  }
}

/** Compartilhar o app: o link vem com um cartão (imagem + texto) que explica o que é o jogo. */
export function ShareScreen() {
  const toast = useToast();
  const saved = useGameModeImages();
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    setCustom((current) => current || saved.SHARE || '');
  }, [saved.SHARE]);

  const link = `${window.location.origin}/api/compartilhar`;
  const preview = custom || DEFAULT_IMAGE;
  const changed = custom !== (saved.SHARE ?? '');
  const fullText = `${message.trim()}\n${link}`;

  async function saveImage() {
    setSaving(true);
    try {
      await saveGameModeImage('SHARE', custom.trim() || null);
      toast.success(custom.trim() ? 'Imagem de compartilhamento salva.' : 'Voltou a imagem padrão.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, done: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível copiar.'));
    }
  }

  async function share() {
    setSharing(true);
    try {
      if (typeof navigator.share !== 'function') {
        await copy(fullText, 'Mensagem com o link copiada. Cole numa conversa.');
        return;
      }
      // Com imagem anexada quando o aparelho deixa; senão só texto e link (o cartão aparece pelo link).
      const file = await imageFile(preview);
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: fullText });
      } else {
        await navigator.share({ title: 'Coleção Bíblica', text: message.trim(), url: link });
      }
    } catch (reason) {
      // Fechar a janela de compartilhar não é erro.
      if (!(reason instanceof DOMException && reason.name === 'AbortError')) toast.error(errorMessage(reason, 'Não foi possível compartilhar.'));
    } finally {
      setSharing(false);
    }
  }

  async function download() {
    const file = await imageFile(preview);
    if (!file) {
      window.open(preview, '_blank', 'noopener');
      return;
    }
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = file.name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AdminPanel
      title="Compartilhar o app"
      description="O link abaixo mostra um cartão com a imagem e o texto que explicam o app quando é enviado no WhatsApp, Telegram ou redes sociais. Quem toca no cartão cai direto na página inicial."
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-3xl border-2 border-edge bg-surface-2">
            <img src={preview} alt="Imagem que acompanha o link" className="aspect-[1200/630] w-full object-cover" />
            <div className="space-y-0.5 border-t border-edge p-3">
              <p className="truncate text-xs font-semibold text-muted">{window.location.host}</p>
              <p className="font-display text-base font-bold text-ink">Coleção Bíblica: aprenda a Bíblia jogando</p>
              <p className="text-sm text-muted">Aprenda a Bíblia jogando! Quiz, álbum de figurinhas dos personagens e jogos para jogar com os amigos. Jogue grátis.</p>
            </div>
          </div>
          <p className="text-xs font-semibold text-muted">Assim o cartão aparece nas conversas.</p>
        </div>

        <div className="space-y-4">
          <Field label="Link para compartilhar" hint="Use este link (e não o endereço da página inicial) para o cartão aparecer com a imagem escolhida.">
            <div className="flex gap-2">
              <Input value={link} readOnly onFocus={(event) => event.currentTarget.select()} />
              <Button type="button" variant="secondary" onClick={() => void copy(link, 'Link copiado.')}>
                <ContentCopyRoundedIcon fontSize="small" /> Copiar
              </Button>
            </div>
          </Field>

          <Field label="Mensagem" hint="Vai junto com o link.">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={4}
              maxLength={300}
              className="w-full rounded-2xl border-2 border-edge bg-surface-2 px-4 py-3 text-sm font-semibold text-ink outline-none focus:border-primary"
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void share()} loading={sharing}>
              <ShareRoundedIcon fontSize="small" /> Compartilhar
            </Button>
            <Button variant="secondary" onClick={() => void copy(fullText, 'Mensagem com o link copiada.')}>
              <ContentCopyRoundedIcon fontSize="small" /> Copiar mensagem
            </Button>
            <Button variant="secondary" onClick={() => void download()}>
              <DownloadRoundedIcon fontSize="small" /> Baixar imagem
            </Button>
          </div>

          <Field label="Trocar a imagem do cartão" hint="Horizontal 1200 × 630 px, de preferência com menos de 300 KB (o WhatsApp ignora imagens grandes). Vazio usa a imagem padrão com a logo e os jogos.">
            <ImageUploadField value={custom} onChange={setCustom} wide />
          </Field>
          <Button size="sm" onClick={() => void saveImage()} loading={saving} disabled={!changed}>
            Salvar imagem
          </Button>
        </div>
      </div>
    </AdminPanel>
  );
}
