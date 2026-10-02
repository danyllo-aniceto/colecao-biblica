import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { Button } from '@/components/ui/button';
import { ColorField } from '@/components/ui/color-field';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon } from '@/components/game/game-ui';
import { ScenarioIcon } from '@/components/user/campaign/scenario-art';
import { listCharacterOptions, listRewards, type AdminReward, type CharacterOption } from '@/lib/admin-api';
import {
  createNode,
  createScenario,
  deleteNode,
  deleteScenario,
  listNodesAdmin,
  listScenariosAdmin,
  updateNode,
  updateScenario,
  type AdminNode,
  type AdminScenario,
} from '@/lib/admin-campaign-api';
import { listCosmeticsAdmin } from '@/lib/admin-rewards-api';
import { COSMETIC_TYPE_LABELS } from '@/components/user/rewards/cosmetic-preview';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';
import { ImageUploadField } from '../image-upload-field';
import { usePagedList } from '../use-paged-list';

/** Todos os itens visuais (a lista do painel é paginada em 100, então busca página a página). */
function useAllCosmeticOptions() {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([{ value: '', label: 'Nenhum' }]);
  useEffect(() => {
    let ignore = false;
    (async () => {
      const items = [];
      for (let page = 0; page < 20; page += 1) {
        const response = await listCosmeticsAdmin({ page, size: 100 });
        items.push(...response.content);
        if (page + 1 >= response.totalPages || response.content.length === 0) break;
      }
      if (!ignore) setOptions([{ value: '', label: 'Nenhum' }, ...items.map((item) => ({ value: String(item.id), label: `${item.name} (${COSMETIC_TYPE_LABELS[item.type].one})` }))]);
    })().catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);
  return options;
}

export function CampaignScreen() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const list = usePagedList(listScenariosAdmin, {}, 10);
  const [editing, setEditing] = useState<AdminScenario | 'new' | null>(null);
  const [managing, setManaging] = useState<AdminScenario | null>(null);

  async function remove(scenario: AdminScenario) {
    const ok = await confirm({ title: `Excluir o cenário "${scenario.name}"?`, message: 'As paradas dele também são excluídas. Quem já resgatou os prêmios continua com eles.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteScenario(scenario.id);
      toast.success('Cenário excluído.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      title="Campanha"
      description="Cenários do caminho do jogador. Cada parada abre quando o jogador chega ao nível dela; a última de cada cenário costuma ser a relíquia. Cenários do sistema podem ser editados e desligados, mas não excluídos."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" /> Novo cenário
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Cenário' }, { label: 'Ordem' }, { label: 'Paradas' }, { label: 'Perguntas' }, { label: 'Carta especial' }, { label: 'Status' }, { label: '', className: 'w-36' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Nenhum cenário cadastrado."
        minWidth={780}
      >
        {list.items.map((scenario) => (
          <Row key={scenario.id}>
            <Cell>
              <span className="flex items-center gap-3">
                <ScenarioIcon scenario={scenario} size={40} />
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{scenario.name}</span>
                  <span className="block text-xs text-muted">{scenario.slug}</span>
                </span>
              </span>
            </Cell>
            <Cell>{scenario.sortOrder}</Cell>
            <Cell>{scenario.nodeCount}</Cell>
            <Cell>{scenario.questionCount}</Cell>
            <Cell className="text-sm">{scenario.fragmentCharacter?.name ?? '—'}</Cell>
            <Cell>
              <StatusBadge active={scenario.active} on="Ligado" off="Desligado" />
            </Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                <IconAction label="Paradas e recompensas" onClick={() => setManaging(scenario)}>
                  <RouteRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Editar" onClick={() => setEditing(scenario)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                {scenario.system ? null : (
                  <IconAction label="Excluir" tone="danger" onClick={() => void remove(scenario)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconAction>
                )}
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="cenários" />
      {editing ? (
        <ScenarioModal
          scenario={editing === 'new' ? null : editing}
          nextOrder={((list.items.at(-1)?.sortOrder ?? 0) || 0) + 10}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      {managing ? (
        <NodesModal
          scenario={managing}
          onClose={() => {
            setManaging(null);
            list.reload();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

function ScenarioModal({ scenario, nextOrder, onClose, onSaved }: { scenario: AdminScenario | null; nextOrder: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [slug, setSlug] = useState(scenario?.slug ?? '');
  const [name, setName] = useState(scenario?.name ?? '');
  const [description, setDescription] = useState(scenario?.description ?? '');
  const [verse, setVerse] = useState(scenario?.verse ?? '');
  const [verseReference, setVerseReference] = useState(scenario?.verseReference ?? '');
  const [color, setColor] = useState(scenario?.color ?? '#7c4dff');
  const [mapImageUrl, setMapImageUrl] = useState(scenario?.mapImageUrl ?? '');
  const [iconImageUrl, setIconImageUrl] = useState(scenario?.iconImageUrl ?? '');
  const [characterId, setCharacterId] = useState(scenario?.fragmentCharacterId ? String(scenario.fragmentCharacterId) : '');
  const [sortOrder, setSortOrder] = useState(String(scenario?.sortOrder ?? nextOrder));
  const [active, setActive] = useState(scenario?.active ?? true);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);
  const [errors, setErrors] = useState<{ slug?: string; name?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listCharacterOptions()
      .then((list) => setCharacters(list.filter((character) => character.rarity === 'SPECIAL')))
      .catch(() => setCharacters([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (!scenario && !/^[a-z0-9-]{2,40}$/.test(slug.trim().toLowerCase())) next.slug = 'Use letras minúsculas, números e hífen (2 a 40).';
    if (!name.trim()) next.name = 'Informe o nome do cenário.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      verse: verse.trim() || null,
      verseReference: verseReference.trim() || null,
      color,
      mapImageUrl: mapImageUrl || null,
      iconImageUrl: iconImageUrl || null,
      fragmentCharacterId: characterId ? Number(characterId) : null,
      sortOrder: Number(sortOrder) || 0,
      active,
    };
    try {
      if (scenario) await updateScenario(scenario.id, payload);
      else await createScenario({ ...payload, slug: slug.trim().toLowerCase() });
      toast.success('Cenário salvo.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="lg" title={scenario ? `Editar: ${scenario.name}` : 'Novo cenário'} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" required error={errors.name}>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Mar Vermelho" />
          </Field>
          <Field label="Identificador" required error={errors.slug} hint={scenario ? 'Não muda depois de criado.' : 'Também é o nome da pasta das imagens padrão (public/campaign/<identificador>).'}>
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={40} disabled={Boolean(scenario)} placeholder="mar-vermelho" />
          </Field>
        </div>
        <Field label="Descrição">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={300} />
        </Field>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Versículo (aparece ao concluir o cenário)">
            <Textarea value={verse} onChange={(event) => setVerse(event.target.value)} rows={2} maxLength={300} />
          </Field>
          <Field label="Referência">
            <Input value={verseReference} onChange={(event) => setVerseReference(event.target.value)} maxLength={60} placeholder="Êxodo 14:14" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Mapa do caminho" hint="Vertical 3:4, tipo 1536×2048, sem texto. Vazio usa o arquivo padrão da pasta.">
            <ImageUploadField value={mapImageUrl} onChange={setMapImageUrl} wide />
          </Field>
          <Field label="Ícone do cenário" hint="Quadrado, tipo 512×512, sem texto.">
            <ImageUploadField value={iconImageUrl} onChange={setIconImageUrl} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Cor do cenário" hint="Vira a cor de botões, bordas e destaques.">
            <ColorField value={color} onChange={setColor} />
          </Field>
          <Field label="Carta especial do cenário" hint="Quem recebe os fragmentos das paradas marcadas.">
            <Select
              aria-label="Carta especial"
              value={characterId}
              onChange={setCharacterId}
              searchable
              options={[{ value: '', label: 'Nenhuma' }, ...characters.map((character) => ({ value: String(character.id), label: character.name }))]}
            />
          </Field>
          <Field label="Ordem no caminho" hint="Menor vem primeiro.">
            <Input type="number" min={0} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
          </Field>
        </div>
        <Switch checked={active} onChange={setActive} label="Ligado (aparece para os jogadores)" />
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

function NodesModal({ scenario, onClose }: { scenario: AdminScenario; onClose: () => void }) {
  const { confirm } = useDialogs();
  const toast = useToast();
  const list = usePagedList((params: { page: number; size: number }) => listNodesAdmin(scenario.id, params), {}, 10);
  const [editing, setEditing] = useState<AdminNode | 'new' | null>(null);

  async function remove(node: AdminNode) {
    const ok = await confirm({ title: `Excluir a parada do nível ${node.level}?`, message: 'Quem já resgatou continua com o prêmio.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteNode(node.id);
      toast.success('Parada excluída.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <Modal
      open
      size="xl"
      title={`Paradas: ${scenario.name}`}
      description="Uma parada por nível em toda a campanha. A posição no mapa é opcional; vazia, o app distribui em zigue-zague."
      onClose={onClose}
      footer={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" /> Nova parada
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Nível' }, { label: 'Parada' }, { label: 'Prêmio' }, { label: 'Fragmento' }, { label: 'Mapa (x, y)' }, { label: '', className: 'w-24' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Este cenário ainda não tem paradas."
        minWidth={720}
      >
        {list.items.map((node) => (
          <Row key={node.id}>
            <Cell className="font-display font-bold">{node.level}</Cell>
            <Cell className="text-sm">{node.relic ? `★ ${node.title ?? 'Relíquia'}` : (node.title ?? '—')}</Cell>
            <Cell>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {node.rewardCoins ? (
                  <span className="inline-flex items-center gap-1">
                    <CoinIcon className="h-4 w-4" />
                    {node.rewardCoins}
                  </span>
                ) : null}
                {node.rewardDefinition ? <span>{node.rewardDefinition.name}</span> : null}
                {node.rewardCosmetic ? <span className="font-semibold text-violet-strong dark:text-violet">{node.rewardCosmetic.name}</span> : null}
              </span>
            </Cell>
            <Cell>{node.fragment ? 'Sim' : '—'}</Cell>
            <Cell className="text-xs text-muted">{node.posX !== null && node.posY !== null ? `${node.posX}, ${node.posY}` : 'automática'}</Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => setEditing(node)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Excluir" tone="danger" onClick={() => void remove(node)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination className="mt-3" page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="paradas" />
      {editing ? (
        <NodeModal
          scenario={scenario}
          node={editing === 'new' ? null : editing}
          nextLevel={(list.items.at(-1)?.level ?? 0) + 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
    </Modal>
  );
}

function NodeModal({ scenario, node, nextLevel, onClose, onSaved }: { scenario: AdminScenario; node: AdminNode | null; nextLevel: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [level, setLevel] = useState(String(node?.level ?? nextLevel));
  const [title, setTitle] = useState(node?.title ?? '');
  const [relic, setRelic] = useState(node?.relic ?? false);
  const [fragment, setFragment] = useState(node?.fragment ?? false);
  const [coins, setCoins] = useState(String(node?.rewardCoins ?? 50));
  const [rewardId, setRewardId] = useState(node?.rewardDefinitionId ? String(node.rewardDefinitionId) : '');
  const [cosmeticId, setCosmeticId] = useState(node?.rewardCosmeticId ? String(node.rewardCosmeticId) : '');
  const [posX, setPosX] = useState(node?.posX !== null && node?.posX !== undefined ? String(node.posX) : '');
  const [posY, setPosY] = useState(node?.posY !== null && node?.posY !== undefined ? String(node.posY) : '');
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [errors, setErrors] = useState<{ level?: string; reward?: string; position?: string }>({});
  const [saving, setSaving] = useState(false);
  const cosmeticOptions = useAllCosmeticOptions();

  useEffect(() => {
    listRewards()
      .then((list) => setRewards(list.filter((reward) => reward.rewardType !== 'COINS' && reward.rewardType !== 'COSMETIC')))
      .catch(() => setRewards([]));
  }, []);

  const rewardOptions = useMemo(() => [{ value: '', label: 'Nenhuma' }, ...rewards.map((reward) => ({ value: String(reward.id), label: reward.name }))], [rewards]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    const levelNumber = Number(level);
    if (!Number.isInteger(levelNumber) || levelNumber < 1) next.level = 'Informe um nível a partir de 1.';
    if ((Number(coins) || 0) === 0 && !rewardId && !cosmeticId && !fragment) next.reward = 'A parada precisa dar alguma coisa.';
    if ((posX === '') !== (posY === '') || [posX, posY].some((value) => value !== '' && (Number(value) < 0 || Number(value) > 100))) next.position = 'Preencha x e y entre 0 e 100, ou deixe os dois vazios.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSaving(true);
    const payload = {
      level: levelNumber,
      title: title.trim() || null,
      relic,
      fragment,
      rewardCoins: Number(coins) || 0,
      rewardDefinitionId: rewardId ? Number(rewardId) : null,
      rewardCosmeticId: cosmeticId ? Number(cosmeticId) : null,
      posX: posX === '' ? null : Math.round(Number(posX)),
      posY: posY === '' ? null : Math.round(Number(posY)),
    };
    try {
      if (node) await updateNode(node.id, payload);
      else await createNode(scenario.id, payload);
      toast.success('Parada salva.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={node ? `Parada do nível ${node.level}` : 'Nova parada'} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nível que abre a parada" required error={errors.level}>
            <Input type="number" min={1} value={level} onChange={(event) => setLevel(event.target.value)} />
          </Field>
          <Field label="Título (opcional)">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} placeholder="Ex.: Travessia do Mar" />
          </Field>
        </div>
        {errors.reward ? <Alert tone="danger">{errors.reward}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Moedas">
            <Input type="number" min={0} max={100000} value={coins} onChange={(event) => setCoins(event.target.value)} />
          </Field>
          <Field label="Recompensa (ajuda, pacote...)">
            <Select aria-label="Recompensa" value={rewardId} onChange={setRewardId} options={rewardOptions} searchable />
          </Field>
          <Field label="Item visual do cenário">
            <Select aria-label="Item visual" value={cosmeticId} onChange={setCosmeticId} options={cosmeticOptions} searchable />
          </Field>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Switch checked={relic} onChange={setRelic} label="É a relíquia do cenário" />
          <Switch checked={fragment} onChange={setFragment} label="Dá um fragmento da carta especial" />
        </div>
        <Field label="Posição no mapa (opcional)" error={errors.position} hint="Em % a partir do canto superior esquerdo. Vazio usa o zigue-zague automático.">
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" min={0} max={100} value={posX} onChange={(event) => setPosX(event.target.value)} placeholder="x (0 a 100)" aria-label="Posição x" />
            <Input type="number" min={0} max={100} value={posY} onChange={(event) => setPosY(event.target.value)} placeholder="y (0 a 100)" aria-label="Posição y" />
          </div>
        </Field>
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
