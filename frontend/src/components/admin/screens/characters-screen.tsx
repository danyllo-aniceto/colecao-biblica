import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { deleteCharacter, listCharactersPage, updateCharacter, type AdminCharacterSummary } from '@/lib/admin-api';
import { TESTAMENT_LABELS } from '@/lib/labels';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { AdminPanel, Cell, DataTable, IconAction, RarityBadge, Row, SearchInput, StatusBadge, Thumb } from '../admin-ui';
import { useDebouncedValue, usePagedList } from '../use-paged-list';
import type { AdminNavigate } from '../admin-dashboard';

export function CharactersScreen({ params, onNavigate }: { params: URLSearchParams; onNavigate: AdminNavigate }) {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [rarity, setRarity] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [issue, setIssue] = useState(params.get('pendencia') ?? '');
  const [busyId, setBusyId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const list = usePagedList(listCharactersPage, { search: debouncedSearch, rarity, status, issue });
  const hasFilters = Boolean(search || rarity || status || issue);

  async function togglePublished(character: AdminCharacterSummary) {
    setBusyId(character.id);
    try {
      await updateCharacter(character.id, { published: !character.published });
      toast.success(character.published ? `${character.name} voltou para rascunho.` : `${character.name} foi publicado no álbum.`);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(character: AdminCharacterSummary) {
    const ok = await confirm({
      title: `Excluir ${character.name}?`,
      message: (
        <>
          A figurinha some do álbum de <strong>todos os jogadores</strong>, junto com as anotações deles. As {character.questionCount} pergunta(s) do personagem passam a ser perguntas gerais.
          Se quiser só esconder, use <strong>rascunho</strong>.
        </>
      ),
      confirmLabel: 'Excluir personagem',
      tone: 'danger',
    });
    if (!ok) return;
    setBusyId(character.id);
    try {
      await deleteCharacter(character.id);
      toast.success(`${character.name} foi excluído.`);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPanel
      actions={
        <Button onClick={() => onNavigate('personagens', { editar: 'novo' })}>
          <AddRoundedIcon fontSize="small" />
          Novo personagem
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome" label="Buscar personagem" />
        <Select
          aria-label="Raridade"
          value={rarity}
          onChange={setRarity}
          options={[{ value: '', label: 'Todas as raridades' }, ...RARITY_ORDER.map((item) => ({ value: item, label: getRarityLabel(item) }))]}
        />
        <Select
          aria-label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Publicados e rascunhos' },
            { value: 'published', label: 'Só publicados' },
            { value: 'draft', label: 'Só rascunhos' },
          ]}
        />
        <Select
          aria-label="Pendência"
          value={issue}
          onChange={setIssue}
          options={[
            { value: '', label: 'Sem filtro de pendência' },
            { value: 'noImage', label: 'Sem imagem' },
            { value: 'noQuestions', label: 'Sem perguntas' },
          ]}
        />
      </div>
      {hasFilters ? (
        <button
          type="button"
          className="text-sm font-bold text-primary-strong hover:underline dark:text-primary"
          onClick={() => {
            setSearch('');
            setRarity('');
            setStatus('');
            setIssue('');
          }}
        >
          Limpar filtros
        </button>
      ) : null}

      <DataTable
        columns={[{ label: 'Personagem' }, { label: 'Raridade' }, { label: 'Perguntas' }, { label: 'Status' }, { label: 'Ações', className: 'w-44 text-right' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty={hasFilters ? 'Nenhum personagem com esses filtros.' : 'Nenhum personagem ainda. Crie o primeiro!'}
      >
        {list.items.map((character) => (
          <Row key={character.id} onClick={() => onNavigate('personagens', { editar: String(character.id) })}>
            <Cell>
              <div className="flex items-center gap-3">
                <Thumb src={character.imageUrl} rarity={character.rarity} />
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">{character.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[character.narrativeRole, character.testament ? TESTAMENT_LABELS[character.testament] : null].filter(Boolean).join(' · ') || 'Sem papel definido'}
                  </p>
                </div>
              </div>
            </Cell>
            <Cell>
              <RarityBadge rarity={character.rarity} />
            </Cell>
            <Cell>{character.questionCount > 0 ? <Badge tone="accent">{character.questionCount}</Badge> : <Badge tone="danger">Nenhuma</Badge>}</Cell>
            <Cell>
              <StatusBadge active={character.published} on="Publicado" off="Rascunho" />
            </Cell>
            <Cell className="text-right">
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => onNavigate('personagens', { editar: String(character.id) })}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Ver perguntas" onClick={() => onNavigate('perguntas', { personagem: String(character.id) })}>
                  <QuizRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label={character.published ? 'Voltar para rascunho' : 'Publicar no álbum'} onClick={() => void togglePublished(character)} disabled={busyId === character.id}>
                  {character.published ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                </IconAction>
                <IconAction label="Excluir" tone="danger" onClick={() => void remove(character)} disabled={busyId === character.id}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        totalElements={list.totalElements}
        pageSize={list.size}
        onPageChange={list.setPage}
        onPageSizeChange={list.setSize}
        itemLabel="personagens"
      />
    </AdminPanel>
  );
}
