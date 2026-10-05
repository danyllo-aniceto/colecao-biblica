import { useMemo, useState, type FormEvent } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { describeDom } from '@duel/cards';
import { buildCard, domToText, parseDom } from '@duel/dsl';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { ChipInput } from '@/components/ui/chip-input';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { deleteDuelCard, exportDuelRows, listDuelCharacters, saveDuelCard, type DuelCardRecord, type DuelCharacterRow } from '@/lib/duel-api';
import { downloadText, toCsv } from '@/lib/csv';
import { AdminPanel, Cell, DataTable, IconAction, RarityBadge, Row, SearchInput, StatusBadge } from '../admin-ui';
import { usePagedList, useDebouncedValue } from '../use-paged-list';
import { DuelGuideModal } from './duel-guide-modal';
import { ImportDuelModal } from './import-duel-modal';

const TRIGGER_OPTIONS = [
  { value: '', label: 'Sem Dom' },
  { value: 'revelar', label: 'Ao revelar' },
  { value: 'continuo', label: 'Contínuo' },
  { value: 'fim-do-turno', label: 'Fim do turno' },
  { value: 'fim-do-duelo', label: 'Fim do duelo' },
  { value: 'destruida', label: 'Ao ser destruída' },
  { value: 'aliado-jogado', label: 'Quando uma carta sua é jogada aqui' },
];

const COST_OPTIONS = [0, 1, 2, 3, 4, 5, 6].map((value) => ({ value: String(value), label: `Vigor ${value}` }));

/** Cabeçalho da planilha de importação (os mesmos nomes que a importação entende). */
export const DUEL_CSV_HEADER = ['Personagem', 'Raridade', 'Papel na história', 'Período', 'Testamento', 'Palavras-chave', 'Resumo curto', 'Vigor', 'Influência', 'Etiquetas', 'Gatilho', 'Efeitos', 'Texto do Dom', 'Disponível'];

const RARITY_LABEL: Record<string, string> = { COMMON: 'Comum', RARE: 'Rara', EPIC: 'Épica', LEGENDARY: 'Lendária', SPECIAL: 'Especial' };

export function DuelScreen() {
  const toast = useToast();
  const { confirm } = useDialogs();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const debounced = useDebouncedValue(search);
  const list = usePagedList(listDuelCharacters, { search: debounced || undefined, status: status === 'all' ? undefined : status }, 15);
  const [editing, setEditing] = useState<DuelCharacterRow | null>(null);
  const [importing, setImporting] = useState(false);
  const [guide, setGuide] = useState(false);
  const [downloading, setDownloading] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      const { rows } = await exportDuelRows();
      const table = rows.map((row) => [
        row.name,
        RARITY_LABEL[row.rarity] ?? row.rarity,
        row.narrativeRole ?? '',
        row.historicalPeriod ?? '',
        row.testament === 'OLD' ? 'Antigo' : row.testament === 'NEW' ? 'Novo' : '',
        row.keywords ?? '',
        row.shortSummary.replace(/\s+/g, ' ').trim().slice(0, 200),
        row.card ? String(row.card.cost) : '',
        row.card ? String(row.card.power) : '',
        row.card ? row.card.tags.join(', ') : '',
        row.card?.trigger ?? '',
        row.card?.effects ?? '',
        row.card?.domText ?? '',
        row.card ? (row.card.available ? 'Sim' : 'Não') : '',
      ]);
      downloadText('duelo-cartas.csv', toCsv([DUEL_CSV_HEADER, ...table]));
      toast.success(`${rows.length} personagens na planilha.`, { description: 'As colunas de Vigor em diante ficam vazias nos personagens sem carta.' });
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setDownloading(false);
    }
  }

  async function remove(row: DuelCharacterRow) {
    const ok = await confirm({ title: `Remover a carta de ${row.name}?`, message: 'O personagem continua no álbum; só deixa de ser carta do Duelo.', confirmLabel: 'Remover', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteDuelCard(row.characterId);
      toast.success('Carta removida.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      title="Duelo de Cartas"
      description="Cada personagem pode virar uma carta: Vigor (custo), Influência (força), etiquetas e um Dom (poder). Cadastre uma por uma ou importe tudo por planilha; baixe a planilha com todos os personagens, preencha as colunas de Vigor em diante e importe de volta."
      actions={
        <>
          <Button variant="secondary" onClick={() => setGuide(true)}>
            <MenuBookRoundedIcon fontSize="small" /> Guia de poderes
          </Button>
          <Button variant="secondary" onClick={() => void download()} loading={downloading}>
            {downloading ? null : <DownloadRoundedIcon fontSize="small" />} Baixar planilha
          </Button>
          <Button onClick={() => setImporting(true)}>
            <UploadFileRoundedIcon fontSize="small" /> Importar planilha
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar personagem" label="Buscar personagem" />
        <Segmented
          aria-label="Filtro"
          value={status}
          onChange={setStatus}
          className="sm:w-96"
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'with', label: 'Com carta' },
            { value: 'without', label: 'Sem carta' },
          ]}
        />
      </div>

      <DataTable
        columns={[{ label: 'Personagem' }, { label: 'Vigor' }, { label: 'Infl.' }, { label: 'Etiquetas' }, { label: 'Dom' }, { label: 'Status' }, { label: '', className: 'w-28' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Nenhum personagem encontrado."
        minWidth={820}
      >
        {list.items.map((row) => {
          const built = row.card ? buildCard({ id: String(row.characterId), name: row.name, cost: row.card.cost, power: row.card.power, tags: row.card.tags, trigger: row.card.trigger ?? undefined, effects: row.card.effects ?? undefined, text: row.card.domText ?? undefined }) : null;
          return (
            <Row key={row.characterId} onClick={() => setEditing(row)}>
              <Cell>
                <span className="block font-semibold">{row.name}</span>
                <span className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <RarityBadge rarity={row.rarity as 'COMMON'} />
                  {row.narrativeRole ?? ''}
                </span>
              </Cell>
              <Cell>{row.card ? row.card.cost : '—'}</Cell>
              <Cell>{row.card ? row.card.power : '—'}</Cell>
              <Cell className="max-w-40 text-xs text-muted">{row.card?.tags.join(', ') || '—'}</Cell>
              <Cell className="max-w-xs text-xs">{built?.ok ? describeDom(built.card.dom) : built ? <span className="text-danger">{built.error}</span> : '—'}</Cell>
              <Cell>{row.card ? <StatusBadge active={row.card.available} on="Disponível" off="Desligada" /> : <span className="text-xs text-muted">Sem carta</span>}</Cell>
              <Cell>
                <div className="flex justify-end gap-1">
                  <IconAction label="Editar carta" onClick={() => setEditing(row)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconAction>
                  {row.card ? (
                    <IconAction label="Remover carta" tone="danger" onClick={() => void remove(row)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconAction>
                  ) : null}
                </div>
              </Cell>
            </Row>
          );
        })}
      </DataTable>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="personagens" />

      {editing ? (
        <CardModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      {importing ? (
        <ImportDuelModal
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            list.reload();
          }}
        />
      ) : null}
      {guide ? <DuelGuideModal onClose={() => setGuide(false)} /> : null}
    </AdminPanel>
  );
}

function CardModal({ row, onClose, onSaved }: { row: DuelCharacterRow; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const card = row.card;
  const [cost, setCost] = useState(String(card?.cost ?? 2));
  const [power, setPower] = useState(String(card?.power ?? 4));
  const [tags, setTags] = useState<string[]>(card?.tags ?? []);
  const [trigger, setTrigger] = useState(card?.trigger ?? '');
  const [effects, setEffects] = useState(card?.effects ?? '');
  const [domText, setDomText] = useState(card?.domText ?? '');
  const [available, setAvailable] = useState(card?.available ?? true);
  const [saving, setSaving] = useState(false);

  const built = useMemo(
    () => buildCard({ id: String(row.characterId), name: row.name, cost: Number(cost), power: Number(power), tags, trigger, effects, text: domText }),
    [row, cost, power, tags, trigger, effects, domText],
  );
  const domError = built.ok ? null : built.error;
  const preview = built.ok ? describeDom(built.card.dom) : null;

  // Ao trocar de "Sem Dom" para um gatilho com texto, sugere um exemplo para começar.
  function pickTrigger(value: string) {
    setTrigger(value);
    if (!value) setEffects('');
    else if (!effects.trim()) setEffects(value === 'continuo' ? 'aura valor=+1 em=aliados-aqui' : 'poder valor=+2 alvo=si');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    try {
      const body: DuelCardRecord = { cost: Number(cost), power: Number(power), tags, trigger: trigger || null, effects: trigger ? effects.trim() || null : null, domText: domText.trim() || null, available };
      const result = await saveDuelCard(row.characterId, body);
      toast.success('Carta salva.', result.warnings.length ? { description: result.warnings[0] } : undefined);
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  // O mesmo texto do Dom que a planilha usa, para o admin ver como fica (e copiar).
  const normalized = parseDom(trigger, effects);
  const roundTrip = normalized.ok && normalized.dom ? domToText(normalized.dom) : null;

  return (
    <Modal open size="lg" title={`Carta: ${row.name}`} description={row.narrativeRole ?? undefined} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Vigor (custo)" hint="Número de 0 a 6.">
            <Select aria-label="Vigor" value={cost} onChange={setCost} options={COST_OPTIONS} />
          </Field>
          <Field label="Influência (força)" hint={`Sem Dom, o justo é ${Number(cost) * 2}.`}>
            <Input type="number" min={0} max={30} value={power} onChange={(event) => setPower(event.target.value)} />
          </Field>
          <Field label="Etiquetas" hint="Rei, Profeta, Juiz...">
            <ChipInput value={tags} onChange={setTags} placeholder="Ex.: Rei" tone="violet" suggestions={['Rei', 'Profeta', 'Juiz', 'Apóstolo', 'Patriarca', 'Mulher', 'Líder', 'Sacerdote', 'Pastor', 'Adversário']} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
          <Field label="Dom (gatilho)">
            <Select aria-label="Gatilho" value={trigger} onChange={pickTrigger} options={TRIGGER_OPTIONS} />
          </Field>
          <Field label="Efeitos" hint="Veja o Guia de poderes. Ex.: poder valor=+6 alvo=si se=inimigo-poder:6" error={domError && trigger ? domError : null}>
            <Textarea value={effects} onChange={(event) => setEffects(event.target.value)} disabled={!trigger} rows={2} className="min-h-16 font-mono text-xs" spellCheck={false} placeholder={trigger ? 'poder valor=+2 alvo=si' : 'Escolha um gatilho para escrever o Dom'} />
          </Field>
        </div>

        <Field label="Texto do Dom (opcional)" hint="Se preencher, aparece no jogo no lugar do texto gerado.">
          <Input value={domText} onChange={(event) => setDomText(event.target.value)} maxLength={300} />
        </Field>

        <div className="rounded-2xl bg-surface-2 p-3 text-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Como aparece no jogo</p>
          {built.ok ? (
            <>
              <p className="mt-1 font-semibold text-ink">
                Vigor {built.card.cost} · Influência {built.card.power}
                {built.card.tags.length ? ` · ${built.card.tags.join(', ')}` : ''}
              </p>
              <p className="text-ink">{preview}</p>
              {roundTrip ? (
                <p className="mt-1 text-xs text-muted">
                  Planilha: <code>{roundTrip.trigger}</code> / <code>{roundTrip.effects}</code>
                </p>
              ) : null}
              {built.warnings.map((warning) => (
                <p key={warning} className="mt-1 text-xs font-semibold text-warning-strong dark:text-primary">
                  ⚠ {warning}
                </p>
              ))}
            </>
          ) : (
            <p className="mt-1 text-danger">{built.error}</p>
          )}
        </div>

        <Switch checked={available} onChange={setAvailable} label="Disponível no jogo" description="Desligada, a carta some dos duelos e dos Times dos jogadores." />
        {!card ? <Alert tone="info">Este personagem ainda não é carta do Duelo. Ao salvar, ele passa a ser.</Alert> : null}

        <div className="flex justify-end gap-2 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving} disabled={!built.ok}>
            Salvar carta
          </Button>
        </div>
      </form>
    </Modal>
  );
}
