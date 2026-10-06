import { useEffect, useState, type FormEvent } from 'react';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Button } from '@/components/ui/button';
import { ColorField } from '@/components/ui/color-field';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { StoneGem } from '@/components/user/campaign/breastplate';
import { listStonesAdmin, updateStone, type AdminStone } from '@/lib/admin-campaign-api';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';
import { ImageUploadField } from '../image-upload-field';

/** As 12 pedras do Peitoral: nome, cor, arte e moedas. Os cenários ligam-se a elas no cadastro do cenário. */
export function StonesPanel() {
  const [stones, setStones] = useState<AdminStone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminStone | null>(null);
  const paged = usePagination(stones, 6);

  function load() {
    setLoading(true);
    listStonesAdmin()
      .then((list) => {
        setStones(list);
        setError(null);
      })
      .catch((reason) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <AdminPanel title="Pedras do Peitoral" description="As 12 pedras de Êxodo 28, conquistadas a cada 3 cenários concluídos. Defina a cor, a arte (quadrada, fundo transparente) e as moedas; o cosmético e o brasão de cada pedra ficam em Itens visuais.">
      <DataTable columns={[{ label: 'Pedra' }, { label: 'Tribo' }, { label: 'Cenários ligados' }, { label: 'Moedas' }, { label: 'Status' }, { label: '', className: 'w-20' }]} loading={loading} error={error} isEmpty={stones.length === 0} empty="Nenhuma pedra cadastrada." minWidth={640}>
        {paged.pageItems.map((stone) => (
          <Row key={stone.id}>
            <Cell>
              <span className="flex items-center gap-3">
                <StoneGem stone={{ ...stone, state: 'claimed' }} size={40} />
                <span className="font-semibold">
                  {stone.slot}. {stone.name}
                </span>
              </span>
            </Cell>
            <Cell>{stone.tribe ?? '—'}</Cell>
            <Cell>{stone._count.scenarios} de 3</Cell>
            <Cell>{stone.rewardCoins.toLocaleString('pt-BR')}</Cell>
            <Cell>
              <StatusBadge active={stone.active} on="Ligada" off="Desligada" />
            </Cell>
            <Cell>
              <div className="flex justify-end">
                <IconAction label="Editar" onClick={() => setEditing(stone)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={paged.page} totalPages={paged.totalPages} totalElements={paged.totalElements} pageSize={paged.pageSize} onPageChange={paged.setPage} onPageSizeChange={paged.setPageSize} itemLabel="pedras" />
      {editing ? (
        <StoneModal
          stone={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

function StoneModal({ stone, onClose, onSaved }: { stone: AdminStone; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(stone.name);
  const [tribe, setTribe] = useState(stone.tribe ?? '');
  const [color, setColor] = useState(stone.color);
  const [description, setDescription] = useState(stone.description ?? '');
  const [imageUrl, setImageUrl] = useState(stone.imageUrl ?? '');
  const [coins, setCoins] = useState(String(stone.rewardCoins));
  const [active, setActive] = useState(stone.active);
  const [errors, setErrors] = useState<{ name?: string; coins?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Informe o nome da pedra.';
    if (!Number.isInteger(Number(coins)) || Number(coins) < 0) next.coins = 'Informe um número inteiro a partir de 0.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    try {
      await updateStone(stone.id, { name: name.trim(), tribe: tribe.trim() || null, color, description: description.trim() || null, imageUrl: imageUrl || null, rewardCoins: Number(coins), active });
      toast.success('Pedra salva.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={`Pedra ${stone.slot}: ${stone.name}`} onClose={saving ? undefined : onClose}>
      <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
        <div className="flex justify-center">
          <StoneGem stone={{ name, color, imageUrl: imageUrl || null, state: 'claimed' }} size={96} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} />
          </Field>
          <Field label="Tribo (opcional)" hint="Subtítulo ligado à pedra pela tradição.">
            <Input value={tribe} onChange={(event) => setTribe(event.target.value)} maxLength={60} />
          </Field>
        </div>
        <Field label="Descrição (opcional)">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={2} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Cor da pedra" hint="Usada na gema desenhada, no brilho e na cor do brasão.">
            <ColorField value={color} onChange={setColor} />
          </Field>
          <Field label="Moedas ao resgatar" error={errors.coins}>
            <Input type="number" min={0} value={coins} onChange={(event) => setCoins(event.target.value)} />
          </Field>
        </div>
        <Field label="Arte da pedra (opcional)" hint="Quadrada, fundo transparente. Sem arte, o app desenha a gema na cor escolhida.">
          <ImageUploadField value={imageUrl} onChange={setImageUrl} />
        </Field>
        <Switch checked={active} onChange={setActive} label="Ligada (aparece no Peitoral)" />
        <div className="flex justify-end gap-2 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
