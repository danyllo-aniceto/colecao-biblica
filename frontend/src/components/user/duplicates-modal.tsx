import { useMemo, useState } from 'react';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon, EmptyState } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity } from '@/lib/admin-api';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { fuseDuplicates, sellDuplicates, type FuseResult, type GameRules, type UserSticker } from '@/lib/user-api';

const NEXT: Partial<Record<StickerRarity, StickerRarity>> = { COMMON: 'RARE', RARE: 'EPIC', EPIC: 'LEGENDARY' };
const PLURAL: Record<StickerRarity, string> = { COMMON: 'comuns', RARE: 'raras', EPIC: 'épicas', LEGENDARY: 'lendárias' };

type Props = {
  open: boolean;
  onClose: () => void;
  collection: UserSticker[];
  rules: GameRules | null;
  onChanged: (wallet: { userCoins: number }) => void;
  onFused: (result: FuseResult) => void;
};

/** Repetidas guardadas: vender por moedas ou fundir N de uma raridade em uma de raridade acima. */
export function DuplicatesModal({ open, onClose, collection, rules, onChanged, onFused }: Props) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const withDuplicates = useMemo(() => collection.filter((sticker) => sticker.duplicates > 0), [collection]);
  const paging = usePagination(withDuplicates, 8);
  const fuseCost = rules?.fuseCost ?? 3;

  const sellValue = (rarity: StickerRarity) =>
    rules ? { COMMON: rules.duplicateCoinsCommon, RARE: rules.duplicateCoinsRare, EPIC: rules.duplicateCoinsEpic, LEGENDARY: rules.duplicateCoinsLegendary }[rarity] : 0;
  const byRarity = (rarity: StickerRarity) => withDuplicates.filter((sticker) => sticker.rarity === rarity).reduce((sum, sticker) => sum + sticker.duplicates, 0);

  async function sell(sticker: UserSticker, quantity: number) {
    setBusy(`sell-${sticker.characterId}`);
    try {
      const result = await sellDuplicates(sticker.characterId, quantity);
      onChanged(result);
      toast.success(`${result.sold} repetida(s) de ${sticker.characterName} vendida(s).`, { description: `+${result.coins} moedas`, icon: <CoinIcon /> });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function fuse(rarity: StickerRarity) {
    setBusy(`fuse-${rarity}`);
    try {
      const result = await fuseDuplicates(rarity);
      onChanged(result);
      onFused(result);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} size="lg" title="Minhas repetidas" description={`Venda por moedas ou junte ${fuseCost} repetidas da mesma raridade para ganhar uma da raridade acima (de preferência uma que você não tem).`} onClose={onClose}>
      {withDuplicates.length === 0 ? (
        <EmptyState icon={<AutoAwesomeRoundedIcon fontSize="large" />} title="Nenhuma repetida ainda">
          Figurinhas repetidas de sorteios e pacotes aparecem aqui.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {RARITY_ORDER.filter((rarity) => NEXT[rarity]).map((rarity) => {
              const count = byRarity(rarity);
              const next = NEXT[rarity]!;
              return (
                <div key={rarity} data-rarity={rarity} className="rarity rarity-bg space-y-2 rounded-2xl p-3">
                  <p className="rarity-text font-display font-bold">
                    {count}/{fuseCost} {PLURAL[rarity]}
                  </p>
                  <Button size="sm" className="w-full" disabled={count < fuseCost} loading={busy === `fuse-${rarity}`} onClick={() => void fuse(rarity)}>
                    <AutoAwesomeRoundedIcon fontSize="small" />
                    Fundir em {getRarityLabel(next).toLowerCase()}
                  </Button>
                </div>
              );
            })}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {paging.pageItems.map((sticker) => (
              <li key={sticker.characterId} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <div className="w-16 shrink-0">
                  <StickerCard name={sticker.characterName} rarity={sticker.rarity} imageUrl={sticker.imageUrl} owned size="sm" duplicates={sticker.duplicates} />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate font-display font-semibold text-ink">{sticker.characterName}</p>
                  <p className="text-xs text-muted">
                    {sticker.duplicates} repetida(s) · {sellValue(sticker.rarity)} moedas cada
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" loading={busy === `sell-${sticker.characterId}`} disabled={busy !== null} onClick={() => void sell(sticker, 1)}>
                      Vender 1
                    </Button>
                    {sticker.duplicates > 1 ? (
                      <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void sell(sticker, sticker.duplicates)}>
                        Vender todas
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="figurinhas com repetidas" />
        </div>
      )}
    </Modal>
  );
}
