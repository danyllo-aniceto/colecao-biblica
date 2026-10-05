import { useRef, useState } from 'react';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { importReactions } from '@/lib/admin-api';
import { REACTION_ANIMATION_LABELS } from '@/lib/labels';
import { uploadImage } from '@/lib/uploads';
import { BulkImportModal, type BulkRow } from './bulk-import-modal';

/** "festa-de-natal_01.png" -> "Festa de natal 01". */
function nameFromFile(fileName: string) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Reação';
}

/** Importar reações do chat: por planilha (emojis ou links) ou enviando várias imagens/GIFs de uma vez. */
export function ReactionsImport({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  return (
    <BulkImportModal
      title="Importar reações"
      description="Crie várias reações do chat de uma vez: por planilha CSV ou enviando as imagens/GIFs."
      noun="reação(ões)"
      templateFile="modelo-reacoes.csv"
      header={['Nome', 'Emoji', 'Imagem', 'Raridade', 'Animação', 'Pacote', 'Preço', 'Descrição']}
      templateRows={[
        ['Mãos para o alto', '🙌', '', 'Comum', 'Pulo', 'Louvor', '150', ''],
        ['Estrela de Belém', '⭐', '', 'Rara', 'Girar', 'Natal', '', 'Só no passe de Natal'],
      ]}
      aliases={{
        nome: 'name',
        reacao: 'name',
        emoji: 'emoji',
        imagem: 'imageUrl',
        'link da imagem': 'imageUrl',
        link: 'imageUrl',
        raridade: 'rarity',
        animacao: 'animation',
        pacote: 'pack',
        preco: 'price',
        moedas: 'price',
        descricao: 'description',
      }}
      required={{ name: 'Nome' }}
      help={
        <>
          Colunas: Nome e (Emoji ou Imagem com link). Opcionais: Raridade (Comum, Rara, Épica, Lendária), Animação ({Object.values(REACTION_ANIMATION_LABELS).join(', ')}), Pacote, Preço e Descrição. Com Preço a reação vai para a loja; sem Preço ela fica só como prêmio (passe, baú ou dada por você).
        </>
      }
      maxRows={300}
      run={importReactions}
      rowLabel={(row) => row.name}
      extra={(load, busy) => <ImagesSource onRows={load} disabled={busy} />}
      onClose={onClose}
      onImported={onImported}
    />
  );
}

function ImagesSource({ onRows, disabled }: { onRows: (rows: BulkRow[], source: string) => Promise<void>; disabled: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pack, setPack] = useState('');
  const [price, setPrice] = useState('');
  const [animation, setAnimation] = useState('pop');
  const [progress, setProgress] = useState<string | null>(null);

  async function pick(files: FileList | null) {
    const list = [...(files ?? [])];
    if (list.length === 0) return;
    const rows: BulkRow[] = [];
    for (const [index, file] of list.entries()) {
      setProgress(`Enviando ${index + 1} de ${list.length}...`);
      try {
        const { url } = await uploadImage(file, 'conteudo');
        rows.push({ name: nameFromFile(file.name), imageUrl: url, animation, ...(pack.trim() ? { pack: pack.trim() } : {}), ...(price.trim() ? { price: price.trim() } : {}) });
      } catch (reason) {
        toast.error(`${file.name}: ${errorMessage(reason)}`);
      }
    }
    setProgress(null);
    if (rows.length > 0) await onRows(rows, `${rows.length} imagem(ns) enviada(s)`);
  }

  return (
    <div className="space-y-3 rounded-3xl border border-edge p-4">
      <p className="flex items-center gap-2 font-display font-semibold text-ink">
        <ImageRoundedIcon fontSize="small" /> Ou envie várias imagens/GIFs de uma vez
      </p>
      <p className="text-xs text-muted">Cada arquivo vira uma reação, com o nome tirado do nome do arquivo (você pode renomear depois). Defina antes o que vale para todas.</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Pacote">
          <Input value={pack} onChange={(event) => setPack(event.target.value)} maxLength={40} placeholder="Ex.: Natal" />
        </Field>
        <Field label="Preço (vazio = só prêmio)">
          <Input type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)} />
        </Field>
        <Field label="Animação">
          <Select aria-label="Animação" value={animation} onChange={setAnimation} options={Object.entries(REACTION_ANIMATION_LABELS).map(([value, label]) => ({ value, label }))} />
        </Field>
      </div>
      <Button type="button" size="sm" onClick={() => inputRef.current?.click()} loading={progress !== null} disabled={disabled}>
        {progress ?? 'Escolher imagens'}
      </Button>
      <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/gif,image/avif" className="hidden" onChange={(event) => { const files = event.target.files; void pick(files).finally(() => { event.target.value = ''; }); }} />
    </div>
  );
}
