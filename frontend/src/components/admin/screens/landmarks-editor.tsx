import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { MAX_LANDMARKS, type Landmark } from '@board/layout';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Slider } from '@/components/ui/slider';
import { Tooltip } from '@/components/ui/tooltip';
import { EmojiPicker } from '../emoji-picker';
import { ImageUploadField } from '../image-upload-field';

const PAGE_SIZE = 2;

/**
 * Marcos do cenário: desenhos (árvore, tenda, barco...) colocados ao lado do caminho. A posição é uma porcentagem do
 * caminho (0 = largada, 100 = chegada), então o marco acompanha o caminho em qualquer tamanho de tabuleiro.
 */
export function LandmarksEditor({ value, onChange }: { value: Landmark[]; onChange: (next: Landmark[]) => void }) {
  const paging = usePagination(value, PAGE_SIZE);

  function update(index: number, patch: Partial<Landmark>) {
    onChange(value.map((landmark, current) => (current === index ? { ...landmark, ...patch } : landmark)));
  }

  function add() {
    onChange([...value, { emoji: '🌳', at: 50, side: value.length % 2 === 0 ? 'L' : 'R', offset: 115, size: 80 }]);
    paging.setPage(Math.floor(value.length / PAGE_SIZE));
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? <p className="rounded-2xl bg-surface-2 p-4 text-sm font-semibold text-muted">Nenhum marco ainda. Adicione desenhos para dar vida às margens do caminho.</p> : null}
      <ul className="space-y-3">
        {paging.pageItems.map((landmark, offsetIndex) => {
          const index = paging.page * PAGE_SIZE + offsetIndex;
          return (
            <li key={index} className="space-y-3 rounded-3xl border-2 border-edge bg-surface-2 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-base font-bold text-ink">Marco {index + 1}</p>
                <Tooltip content="Remover este marco">
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((_, current) => current !== index))}
                    aria-label={`Remover o marco ${index + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-danger"
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </button>
                </Tooltip>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Imagem (PNG com fundo transparente)" hint="Sem imagem, vale o emoji ao lado.">
                  <ImageUploadField value={landmark.imageUrl ?? ''} onChange={(url) => update(index, { imageUrl: url || null })} />
                </Field>
                <Field label="Emoji" hint="Usado quando não há imagem.">
                  <div className="space-y-2">
                    <Input value={landmark.emoji ?? ''} onChange={(event) => update(index, { emoji: event.target.value })} maxLength={8} placeholder="🌳" />
                    <EmojiPicker value={landmark.emoji ?? ''} onPick={(emoji) => update(index, { emoji })} />
                  </div>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={`Posição no caminho: ${landmark.at}%`} hint="0% fica na largada e 100% na chegada.">
                  <Slider aria-label={`Posição do marco ${index + 1} no caminho`} value={landmark.at} min={0} max={100} onChange={(at) => update(index, { at })} />
                </Field>
                <Field label="Lado do caminho">
                  <Segmented
                    aria-label={`Lado do marco ${index + 1}`}
                    value={landmark.side}
                    onChange={(side) => update(index, { side })}
                    options={[
                      { value: 'L', label: 'Esquerda' },
                      { value: 'R', label: 'Direita' },
                    ]}
                  />
                </Field>
                <Field label={`Distância da estrada: ${landmark.offset}`} hint="Maior = mais para a margem.">
                  <Slider aria-label={`Distância do marco ${index + 1}`} value={landmark.offset} min={40} max={170} onChange={(offset) => update(index, { offset })} />
                </Field>
                <Field label={`Tamanho: ${landmark.size}`}>
                  <Slider aria-label={`Tamanho do marco ${index + 1}`} value={landmark.size} min={30} max={160} onChange={(size) => update(index, { size })} />
                </Field>
              </div>
            </li>
          );
        })}
      </ul>
      {value.length > PAGE_SIZE ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} pageSize={paging.pageSize} onPageChange={paging.setPage} itemLabel="marcos" /> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={add} disabled={value.length >= MAX_LANDMARKS}>
          <AddRoundedIcon fontSize="small" /> Adicionar marco
        </Button>
        <span className="text-xs font-semibold text-muted">
          {value.length}/{MAX_LANDMARKS} marcos
        </span>
      </div>
    </div>
  );
}
