import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColorField } from '@/components/ui/color-field';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { CoinIcon } from '@/components/game/game-ui';
import { COSMETIC_TYPE_LABELS, CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { listUsers, type StickerRarity } from '@/lib/admin-api';
import {
  createCosmetic,
  deleteCosmetic,
  getCosmeticMeta,
  grantCosmetic,
  listCosmeticsAdmin,
  listEventsAdmin,
  updateCosmetic,
  type AdminCosmetic,
  type AdminEvent,
  type CosmeticMeta,
} from '@/lib/admin-rewards-api';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import type { Cosmetic, CosmeticType, CosmeticUnlock } from '@/lib/rewards-api';
import type { UserProfile } from '@/types/auth';
import { AdminPanel, Cell, DataTable, IconAction, RarityBadge, Row, SearchInput, StatusBadge } from '../admin-ui';
import { ImageUploadField } from '../image-upload-field';
import { EmojiPicker } from '../emoji-picker';
import { ReactionChatPreview } from '../reaction-chat-preview';
import { ReactionsImport } from '../reactions-import';
import { CosmeticsImport } from '../cosmetics-import';
import { REACTION_ANIMATION_LABELS } from '@/lib/labels';
import { useDebouncedValue, usePagedList } from '../use-paged-list';

const TYPES: CosmeticType[] = ['AVATAR', 'FRAME', 'TITLE', 'NAME_COLOR', 'REACTION', 'PROFILE_BG', 'ALBUM_COVER'];

const UNLOCK_LABELS: Record<CosmeticUnlock, string> = { FREE: 'Grátis', SHOP: 'Loja', REQUIREMENT: 'Meta', REWARD: 'Prêmio' };
const UNLOCK_HELP: Record<CosmeticUnlock, string> = {
  FREE: 'Todo jogador ganha na hora.',
  SHOP: 'Vendido na loja (aba Visual). Ligado a um evento, só fica à venda durante ele.',
  REQUIREMENT: 'Liberado sozinho quando o jogador alcança a meta. Use para títulos difíceis.',
  REWARD: 'Só como prêmio: baú de nível (marque abaixo), coleções, passe da temporada, recompensas ou dado por você.',
};
const STYLE_LABELS: Record<string, string> = {
  plain: 'Simples',
  glow: 'Brilho',
  rainbow: 'Arco-íris animado',
  pulse: 'Pulsando',
  solid: 'Cor sólida',
  wood: 'Madeira',
  silver: 'Prata girando',
  gold: 'Ouro girando',
  fire: 'Fogo girando',
  shimmer: 'Reflexo dourado',
  wave: 'Ondulando',
  copper: 'Cobre',
  ice: 'Gelo girando',
  sunset: 'Entardecer girando',
  laurel: 'Louros',
  aurora: 'Aurora girando',
  neon: 'Neon pulsando',
  royal: 'Realeza girando',
  galaxy: 'Céu estrelado girando',
  pearl: 'Pérola girando',
  pentecost: 'Língua de fogo girando',
  emerald: 'Esmeralda girando (conjunto do baú de esmeralda)',
};

export function CosmeticsScreen() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [type, setType] = useState<CosmeticType | ''>('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [editing, setEditing] = useState<AdminCosmetic | 'new' | null>(null);
  const [granting, setGranting] = useState<AdminCosmetic | null>(null);
  const [importingReactions, setImportingReactions] = useState(false);
  const [importingItems, setImportingItems] = useState(false);
  const [meta, setMeta] = useState<CosmeticMeta | null>(null);
  const list = usePagedList(listCosmeticsAdmin, { type: type || undefined, search: debounced || undefined }, 20);

  useEffect(() => {
    getCosmeticMeta()
      .then(setMeta)
      .catch(() => setMeta(null));
  }, []);

  async function toggle(item: AdminCosmetic) {
    try {
      await updateCosmetic(item.id, { active: !item.active });
      toast.success(item.active ? `${item.name} desativado.` : `${item.name} ativado.`);
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function remove(item: AdminCosmetic) {
    const ok = await confirm({
      title: `Excluir "${item.name}"?`,
      message: item.owners ? `${item.owners} jogador(es) têm este item e vão perdê-lo.` : 'Ninguém tem este item ainda.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteCosmetic(item.id);
      toast.success('Item excluído.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      description="Ícones, molduras, títulos que brilham, cores do nome e reações do chat. Itens com cadeado vieram com o app: dá para editar e desativar."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImportingItems(true)}>
            <UploadFileRoundedIcon fontSize="small" />
            Importar itens
          </Button>
          <Button variant="secondary" onClick={() => setImportingReactions(true)}>
            <UploadFileRoundedIcon fontSize="small" />
            Importar reações
          </Button>
          <Button onClick={() => setEditing('new')}>
            <AddRoundedIcon fontSize="small" />
            Novo item
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 md:grid-cols-[1fr_16rem]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar pelo nome" label="Buscar item" />
        <Select
          aria-label="Tipo"
          value={type}
          onChange={setType}
          options={[{ value: '', label: 'Todos os tipos' }, ...TYPES.map((value) => ({ value, label: COSMETIC_TYPE_LABELS[value].many }))]}
        />
      </div>
      <DataTable
        columns={[{ label: 'Item' }, { label: 'Tipo' }, { label: 'Como ganha' }, { label: 'Jogadores' }, { label: 'Status' }, { label: '', className: 'w-40' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Nenhum item encontrado."
      >
        {list.items.map((item) => (
          <Row key={item.id}>
            <Cell>
              <div className="flex items-center gap-3">
                <span data-rarity={item.rarity} className="rarity rarity-bg flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                  <CosmeticPreview item={item} playerName="Nome" size="md" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 font-semibold">
                    {item.system ? (
                      <Tooltip content="Item padrão do app">
                        <LockRoundedIcon sx={{ fontSize: 14 }} className="text-muted" />
                      </Tooltip>
                    ) : null}
                    {item.name}
                  </p>
                  <RarityBadge rarity={item.rarity} />
                  {item.type === 'REACTION' && item.pack ? <span className="ml-1.5 text-xs text-muted">Pacote {item.pack}</span> : null}
                </div>
              </div>
            </Cell>
            <Cell>{COSMETIC_TYPE_LABELS[item.type].one}</Cell>
            <Cell>
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{UNLOCK_LABELS[item.unlock]}</span>
                <span className="text-xs text-muted">
                  {item.unlock === 'SHOP' ? `${item.priceCoins ?? 0} moedas${item.eventName ? ` · evento ${item.eventName}` : ''}` : null}
                  {item.unlock === 'REQUIREMENT' ? `${item.requirementLabel ?? item.requirement}${item.requirementValue ? `: ${item.requirementValue}` : ''}` : null}
                  {item.inChestPool ? ' · no baú' : ''}
                </span>
              </span>
            </Cell>
            <Cell>{item.owners}</Cell>
            <Cell>
              <StatusBadge active={item.active} />
            </Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                <IconAction label="Dar a um jogador" onClick={() => setGranting(item)}>
                  <CardGiftcardRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Editar" onClick={() => setEditing(item)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label={item.active ? 'Desativar' : 'Ativar'} onClick={() => void toggle(item)}>
                  {item.active ? <ToggleOnRoundedIcon fontSize="small" className="text-success" /> : <ToggleOffRoundedIcon fontSize="small" />}
                </IconAction>
                {!item.system ? (
                  <IconAction label="Excluir" tone="danger" onClick={() => void remove(item)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconAction>
                ) : null}
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="itens" />

      {editing ? (
        <CosmeticModal
          item={editing === 'new' ? null : editing}
          defaultType={type || 'AVATAR'}
          meta={meta}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      {importingItems ? (
        <CosmeticsImport
          onClose={() => setImportingItems(false)}
          onImported={() => {
            setImportingItems(false);
            list.reload();
          }}
        />
      ) : null}
      {importingReactions ? (
        <ReactionsImport
          onClose={() => setImportingReactions(false)}
          onImported={() => {
            setImportingReactions(false);
            list.reload();
          }}
        />
      ) : null}
      {granting ? <GrantModal item={granting} onClose={() => setGranting(null)} onGranted={list.reload} /> : null}
    </AdminPanel>
  );
}

function CosmeticModal({ item, defaultType, meta, onClose, onSaved }: { item: AdminCosmetic | null; defaultType: CosmeticType; meta: CosmeticMeta | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = item === null;
  const [type, setType] = useState<CosmeticType>(item?.type ?? defaultType);
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [rarity, setRarity] = useState<StickerRarity>(item?.rarity ?? 'COMMON');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [color, setColor] = useState(item?.color ?? '#7c4dff');
  const [style, setStyle] = useState(item?.style ?? '');
  const [animation, setAnimation] = useState(item?.animation ?? 'pop');
  const [pack, setPack] = useState(item?.pack ?? '');
  const [unlock, setUnlock] = useState<CosmeticUnlock>(item?.unlock ?? 'SHOP');
  const [price, setPrice] = useState(String(item?.priceCoins ?? 300));
  const [requirement, setRequirement] = useState(item?.requirement ?? 'LEVEL');
  const [requirementValue, setRequirementValue] = useState(String(item?.requirementValue ?? 10));
  const [inChestPool, setInChestPool] = useState(item?.inChestPool ?? false);
  const [eventId, setEventId] = useState(item?.eventId ? String(item.eventId) : '');
  const [active, setActive] = useState(item?.active ?? true);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listEventsAdmin({ page: 0, size: 50 })
      .then((page) => setEvents(page.content))
      .catch(() => setEvents([]));
  }, []);

  const styles = type === 'TITLE' ? (meta?.titleStyles ?? ['plain', 'glow', 'rainbow', 'pulse', 'shimmer', 'wave']) : type === 'FRAME' ? (meta?.frameStyles ?? ['solid']) : [];
  const currentRequirement = meta?.requirements.find((entry) => entry.code === requirement);
  const effectiveStyle = style || (type === 'TITLE' ? 'glow' : type === 'FRAME' ? 'solid' : '');

  const preview: Cosmetic = useMemo(
    () => ({
      id: item?.id ?? 0,
      type,
      name: name || COSMETIC_TYPE_LABELS[type].one,
      rarity,
      imageUrl: imageUrl || null,
      color,
      style: type === 'REACTION' ? style : effectiveStyle,
      animation: type === 'REACTION' ? animation : null,
      pack: type === 'REACTION' ? pack : null,
      unlock,
      inChestPool,
      active,
      system: false,
      sortOrder: 0,
    }),
    [item, type, name, rarity, imageUrl, color, style, effectiveStyle, animation, pack, unlock, inChestPool, active],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (type === 'AVATAR' && !imageUrl) return toast.error('Envie a imagem do ícone.');
    if ((type === 'PROFILE_BG' || type === 'ALBUM_COVER') && !imageUrl && !color) return toast.error('Envie uma imagem ou escolha uma cor.');
    if (type === 'REACTION' && !imageUrl && !style.trim()) return toast.error('Informe um emoji ou envie uma imagem para a reação.');
    if (unlock === 'SHOP' && !(Number(price) >= 0)) return toast.error('Informe o preço.');
    setSaving(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      rarity,
      imageUrl: imageUrl || null,
      color: type === 'AVATAR' || type === 'REACTION' ? null : color,
      style: type === 'REACTION' ? style.trim() || null : type === 'TITLE' || type === 'FRAME' ? effectiveStyle : null,
      animation: type === 'REACTION' ? animation : null,
      pack: type === 'REACTION' ? pack.trim() || null : null,
      unlock,
      priceCoins: unlock === 'SHOP' ? Number(price) : null,
      requirement: unlock === 'REQUIREMENT' ? requirement : null,
      requirementValue: unlock === 'REQUIREMENT' && currentRequirement?.needsValue ? Number(requirementValue) : null,
      inChestPool,
      eventId: unlock === 'SHOP' && eventId ? Number(eventId) : null,
      active,
    };
    try {
      if (isNew) await createCosmetic({ ...payload, type });
      else await updateCosmetic(item.id, payload);
      toast.success(isNew ? 'Item criado.' : 'Item salvo.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="lg" title={isNew ? 'Novo item visual' : `Editar: ${item.name}`} onClose={saving ? undefined : onClose}>
      <form className="space-y-5" onSubmit={submit}>
        {isNew ? (
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented aria-label="Tipo de item" className="min-w-[46rem]" value={type} onChange={setType} options={TYPES.map((value) => ({ value, label: COSMETIC_TYPE_LABELS[value].one }))} />
          </div>
        ) : null}

        <div className="flex items-center gap-4 rounded-3xl bg-surface-2 p-4">
          <span data-rarity={rarity} className="rarity rarity-bg flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl px-1">
            <CosmeticPreview item={preview} playerName="Maria" avatarUrl="/avatars/pomba.svg" />
          </span>
          <p className="text-sm text-muted">Prévia de como o item aparece para o jogador.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} required placeholder={type === 'TITLE' ? 'Ex.: Guardião da Arca' : 'Ex.: Coroa dourada'} />
          </Field>
          <Field label="Raridade">
            <Select aria-label="Raridade" value={rarity} onChange={setRarity} options={RARITY_ORDER.map((value) => ({ value, label: getRarityLabel(value) }))} />
          </Field>
        </div>
        <Field label="Descrição (opcional)">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} rows={2} />
        </Field>

        {type === 'AVATAR' || type === 'REACTION' || type === 'FRAME' || type === 'PROFILE_BG' || type === 'ALBUM_COVER' ? (
          <Field
            label={
              type === 'FRAME'
                ? 'Imagem da moldura (opcional, PNG transparente)'
                : type === 'REACTION'
                  ? 'Imagem ou GIF (opcional se usar emoji)'
                  : type === 'PROFILE_BG'
                    ? 'Imagem do fundo (opcional, horizontal)'
                    : type === 'ALBUM_COVER'
                      ? 'Imagem da capa (opcional, vertical)'
                      : 'Imagem do ícone'
            }
            required={type === 'AVATAR'}
            hint={type === 'PROFILE_BG' || type === 'ALBUM_COVER' ? 'Sem imagem, vale a cor escolhida abaixo (em degradê). Com imagem, a cor serve de reserva.' : undefined}
          >
            <ImageUploadField value={imageUrl} onChange={setImageUrl} round={type === 'AVATAR' || type === 'FRAME'} wide={type === 'PROFILE_BG'} />
          </Field>
        ) : null}
        {type === 'REACTION' ? (
          <>
            <Field label="Emoji" hint="Usado quando não há imagem. Escolha abaixo ou cole qualquer emoji.">
              <div className="space-y-2">
                <Input value={style} onChange={(event) => setStyle(event.target.value)} maxLength={8} placeholder="🙏" />
                <EmojiPicker value={style} onPick={setStyle} />
              </div>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Animação" hint="Como a reação entra na conversa.">
                <Select aria-label="Animação" value={animation} onChange={setAnimation} options={Object.entries(REACTION_ANIMATION_LABELS).map(([value, label]) => ({ value, label }))} />
              </Field>
              <Field label="Pacote (opcional)" hint="Reações com o mesmo pacote ficam juntas no chat. Ex.: Natal.">
                <Input value={pack} onChange={(event) => setPack(event.target.value)} maxLength={40} placeholder="Ex.: Páscoa" />
              </Field>
            </div>
            <ReactionChatPreview reaction={preview} />
          </>
        ) : null}
        {type === 'TITLE' || type === 'NAME_COLOR' || type === 'PROFILE_BG' || type === 'ALBUM_COVER' || (type === 'FRAME' && effectiveStyle === 'solid') ? (
          <Field label="Cor">
            <ColorField value={color} onChange={setColor} />
          </Field>
        ) : null}
        {styles.length ? (
          <Field label={type === 'TITLE' ? 'Efeito do título' : 'Estilo da moldura'}>
            <Select aria-label="Estilo" value={effectiveStyle} onChange={setStyle} options={styles.map((value) => ({ value, label: STYLE_LABELS[value] ?? value }))} />
          </Field>
        ) : null}

        <Field label="Como o jogador ganha" hint={UNLOCK_HELP[unlock]}>
          <Segmented aria-label="Forma de ganhar" value={unlock} onChange={setUnlock} options={(Object.keys(UNLOCK_LABELS) as CosmeticUnlock[]).map((value) => ({ value, label: UNLOCK_LABELS[value] }))} />
        </Field>
        {unlock === 'SHOP' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Preço">
              <div className="relative">
                <Input type="number" min={0} value={price} onChange={(event) => setPrice(event.target.value)} className="pl-11" />
                <CoinIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2" />
              </div>
            </Field>
            <Field label="Só durante o evento (opcional)">
              <Select aria-label="Evento" value={eventId} onChange={setEventId} options={[{ value: '', label: 'Sempre à venda' }, ...events.map((entry) => ({ value: String(entry.id), label: entry.name }))]} />
            </Field>
          </div>
        ) : null}
        {unlock === 'REQUIREMENT' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Meta">
              {meta ? (
                <Select aria-label="Meta" value={requirement} onChange={setRequirement} options={meta.requirements.map((entry) => ({ value: entry.code, label: entry.label }))} />
              ) : (
                <Spinner />
              )}
            </Field>
            {currentRequirement?.needsValue ? (
              <Field label="Quanto" hint="Ex.: nível 20, 100 dias, 1000 acertos.">
                <Input type="number" min={1} value={requirementValue} onChange={(event) => setRequirementValue(event.target.value)} />
              </Field>
            ) : null}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-6">
          <Switch checked={inChestPool} onChange={setInChestPool} label="Pode sair no baú de nível" />
          <Switch checked={active} onChange={setActive} label="Ativo" />
        </div>
        {item?.system ? <Badge tone="neutral">Item padrão: pode editar e desativar, não excluir.</Badge> : null}

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

/** Procura um jogador pelo nome e dá o item para ele. */
function GrantModal({ item, onClose, onGranted }: { item: AdminCosmetic; onClose: () => void; onGranted: () => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const debounced = useDebouncedValue(name);
  const [page, setPage] = useState(0);
  const [users, setUsers] = useState<{ content: UserProfile[]; totalPages: number; totalElements: number } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => setPage(0), [debounced]);
  useEffect(() => {
    let ignore = false;
    listUsers({ page, size: 6, name: debounced || undefined, role: 'USER' })
      .then((result) => !ignore && setUsers(result))
      .catch(() => !ignore && setUsers({ content: [], totalPages: 0, totalElements: 0 }));
    return () => {
      ignore = true;
    };
  }, [debounced, page]);

  async function grant(user: UserProfile) {
    setBusy(user.id);
    try {
      await grantCosmetic(item.id, user.id);
      toast.success(`${item.name} dado para ${user.name}.`);
      onGranted();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open size="md" title={`Dar "${item.name}"`} description="O jogador recebe o item na hora e pode equipar no perfil." onClose={onClose}>
      <div className="space-y-3">
        <SearchInput value={name} onChange={setName} placeholder="Nome do jogador" label="Buscar jogador" />
        {!users ? <Spinner /> : null}
        <ul className="space-y-2">
          {users?.content.map((user) => (
            <li key={user.id} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-ink">{user.name}</span>
                <span className="block truncate text-xs text-muted">{user.email}</span>
              </span>
              <Button size="sm" onClick={() => void grant(user)} loading={busy === user.id} disabled={busy !== null}>
                Dar item
              </Button>
            </li>
          ))}
        </ul>
        {users && users.totalElements === 0 ? <p className="text-sm text-muted">Nenhum jogador encontrado.</p> : null}
        {users && users.totalPages > 1 ? <Pagination page={page} totalPages={users.totalPages} totalElements={users.totalElements} onPageChange={setPage} itemLabel="jogadores" /> : null}
      </div>
    </Modal>
  );
}
