import { useEffect, useMemo, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, ProgressBar, SectionHeading } from '@/components/game/game-ui';
import { COSMETIC_TYPE_LABELS, CosmeticPreview, unlockHint } from '@/components/user/rewards/cosmetic-preview';
import { cn } from '@/lib/cn';
import { getRarityLabel } from '@/lib/rarity-theme';
import { equipCosmetic, getInventory, type CosmeticType, type Inventory, type InventoryItem, type PlayerLook } from '@/lib/rewards-api';

const TYPES: CosmeticType[] = ['AVATAR', 'FRAME', 'TITLE', 'NAME_COLOR', 'REACTION', 'PROFILE_BG', 'ALBUM_COVER', 'PAWN'];
const EQUIP_KEY: Partial<Record<CosmeticType, keyof Inventory['equipped']>> = { AVATAR: 'avatarId', FRAME: 'frameId', TITLE: 'titleId', NAME_COLOR: 'nameColorId', PROFILE_BG: 'profileBgId', ALBUM_COVER: 'albumCoverId' };

/** Armário do jogador: todos os itens, os que tem para equipar e como ganhar os que faltam. */
export function VisualLocker({ playerName, onLookChange }: { playerName: string; onLookChange: (look: PlayerLook) => void }) {
  const toast = useToast();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<CosmeticType>('AVATAR');
  const [saving, setSaving] = useState<number | 'none' | null>(null);

  useEffect(() => {
    getInventory()
      .then((data) => {
        setInventory(data);
        data.unlocked.forEach((item) => toast.success(`Item liberado: ${item.name}!`, { description: COSMETIC_TYPE_LABELS[item.type].one }));
      })
      .catch((reason: unknown) => setError(errorMessage(reason)));
    // Carrega uma vez ao abrir; o toast só avisa os itens recém-liberados.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const items = useMemo(
    () =>
      (inventory?.items ?? [])
        .filter((item) => item.type === type)
        // Os que o jogador tem primeiro; depois os mais perto de liberar.
        .sort((left, right) => Number(right.owned) - Number(left.owned) || left.sortOrder - right.sortOrder),
    [inventory, type],
  );
  const paging = usePagination(items, 12);
  const key = EQUIP_KEY[type];
  const equippedId = key && inventory ? inventory.equipped[key] : null;
  const avatarUrl = inventory?.items.find((item) => item.id === inventory.equipped.avatarId)?.imageUrl ?? null;
  const ownedCount = items.filter((item) => item.owned).length;

  async function equip(item: InventoryItem | null) {
    if (!key) return;
    setSaving(item?.id ?? 'none');
    try {
      const look = await equipCosmetic(type, item?.id ?? null);
      setInventory((current) => (current ? { ...current, equipped: { ...current.equipped, [key]: item?.id ?? null } } : current));
      onLookChange(look);
      toast.success(item ? `${item.name} equipado!` : 'Item tirado.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <SectionHeading title="Meu visual" subtitle="Ícone, moldura, título que brilha, cor do nome, reações do chat, fundo do perfil e capa do álbum." />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!inventory && !error ? <LoadingState label="Abrindo seu armário..." /> : null}
      {inventory ? (
        <>
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <Segmented
              aria-label="Tipo de item"
              className="min-w-[52rem]"
              value={type}
              onChange={(next) => {
                setType(next);
                paging.reset();
              }}
              options={TYPES.map((value) => ({ value, label: COSMETIC_TYPE_LABELS[value].many }))}
            />
          </div>
          <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted">
            <span>
              {ownedCount} de {items.length} {COSMETIC_TYPE_LABELS[type].many.toLowerCase()}
            </span>
            {key && equippedId ? (
              <button type="button" onClick={() => void equip(null)} disabled={saving !== null} className="inline-flex items-center gap-1 font-bold text-muted underline-offset-4 hover:text-ink hover:underline">
                {saving === 'none' ? <Spinner size="sm" /> : null}
                Tirar {COSMETIC_TYPE_LABELS[type].one.toLowerCase()}
              </button>
            ) : null}
          </div>
          {type === 'REACTION' ? <p className="text-sm text-muted">As reações que você tem aparecem no botão de reação da conversa com os amigos.</p> : null}
          {type === 'PAWN' ? <p className="text-sm text-muted">Os peões que você tem ficam disponíveis ao montar uma partida de tabuleiro com amigos.</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {paging.pageItems.map((item) => {
              const equipped = equippedId === item.id;
              const progress = item.progress && Number.isFinite(item.progress.target) ? item.progress : null;
              const clickable = item.owned && Boolean(key) && !equipped;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!clickable || saving !== null}
                  onClick={() => void equip(item)}
                  aria-pressed={equipped}
                  data-rarity={item.rarity}
                  className={cn(
                    'rarity relative flex flex-col items-center gap-2 rounded-3xl border-2 p-3 text-center transition',
                    equipped ? 'border-primary bg-primary/10' : item.owned ? 'border-edge bg-surface hover:border-primary/60' : 'border-dashed border-edge bg-surface-2',
                    !item.owned && 'cursor-not-allowed',
                  )}
                >
                  {equipped ? <CheckCircleRoundedIcon className="absolute right-2 top-2 text-primary-strong dark:text-primary" fontSize="small" /> : null}
                  {saving === item.id ? <Spinner size="sm" className="absolute right-2 top-2" /> : null}
                  <span className={cn('rarity-bg flex h-20 w-full items-center justify-center overflow-hidden rounded-2xl px-1', !item.owned && 'opacity-50 grayscale')}>
                    <CosmeticPreview item={item} playerName={playerName} avatarUrl={avatarUrl} />
                  </span>
                  <span className="w-full truncate font-display text-sm font-bold text-ink">{item.name}</span>
                  <span className="rarity-text text-[10px] font-bold uppercase tracking-wider">{getRarityLabel(item.rarity)}</span>
                  {item.owned ? (
                    <span className="text-xs font-semibold text-muted">{equipped ? 'Equipado' : key ? 'Toque para equipar' : 'Na conversa'}</span>
                  ) : (
                    <span className="flex w-full flex-col gap-1 text-xs font-semibold text-muted">
                      <span className="inline-flex items-center justify-center gap-1">
                        <LockRoundedIcon sx={{ fontSize: 14 }} /> {unlockHint(item)}
                      </span>
                      {progress ? <ProgressBar value={Math.min(100, (progress.current / progress.target) * 100)} className="h-1.5" /> : null}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {items.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <PaletteRoundedIcon fontSize="small" /> Ainda não há itens deste tipo.
            </p>
          ) : null}
          {paging.totalPages > 1 ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="itens" /> : null}
        </>
      ) : null}
    </section>
  );
}
