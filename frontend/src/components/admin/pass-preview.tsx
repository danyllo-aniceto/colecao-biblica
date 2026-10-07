import { useMemo, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PassCardView, PassTrail } from '@/components/user/rewards/season-pass';
import type { AdminPassTier } from '@/lib/admin-rewards-api';
import type { PassTierView, SeasonPass } from '@/lib/rewards-api';

/** Mesmos valores do servidor para o item visual repetido (quando o degrau não define). */
const DEFAULT_DUPLICATE_COINS: Record<string, number> = { COMMON: 50, RARE: 100, EPIC: 200, LEGENDARY: 400, SPECIAL: 400 };

type DraftPass = { name: string; description?: string | null; color?: string | null; imageUrl?: string | null };

/** Fim do mês atual (para o "acaba em N dias" do cartão). */
function endOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
}

/**
 * Prévia do passe como o jogador vê: o cartão da tela inicial (banner, cor, descrição, progresso) e a trilha de degraus.
 * Dá para simular o XP do mês e o caso do item repetido. Aceita um rascunho (nome, cor, imagem ainda não salvos).
 */
export function PassPreview({ pass, tiers, nextPassName = null, showTrail = true }: { pass: DraftPass; tiers: AdminPassTier[]; nextPassName?: string | null; showTrail?: boolean }) {
  const active = useMemo(() => tiers.filter((tier) => tier.active).sort((left, right) => left.level - right.level), [tiers]);
  const top = Math.max(active.at(-1)?.requiredXp ?? 1000, 1);
  const [xp, setXp] = useState(Math.round(top * 0.3));
  const [owned, setOwned] = useState(false);
  const now = new Date();

  const view: SeasonPass = useMemo(() => {
    const mapped: PassTierView[] = active.map((tier) => {
      const alreadyOwned = owned && Boolean(tier.rewardCosmetic);
      return {
        id: tier.id,
        level: tier.level,
        requiredXp: tier.requiredXp,
        rewardCoins: tier.rewardCoins,
        reward: tier.rewardDefinition ? { id: tier.rewardDefinition.id, name: tier.rewardDefinition.name, rewardType: tier.rewardDefinition.rewardType } : null,
        cosmetic: tier.rewardCosmetic ?? null,
        cosmeticOwned: alreadyOwned,
        duplicateCoins: alreadyOwned && tier.rewardCosmetic ? (tier.duplicateCoins ?? DEFAULT_DUPLICATE_COINS[tier.rewardCosmetic.rarity] ?? 50) : null,
        reached: xp >= tier.requiredXp,
        claimed: false,
      };
    });
    return {
      monthKey: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      endsAt: endOfMonth(),
      xp,
      pass: { id: 0, name: pass.name.trim() || 'Nome do passe', description: pass.description?.trim() || null, color: pass.color ?? null, imageUrl: pass.imageUrl || null },
      nextPass: nextPassName ? { name: nextPassName, color: null, imageUrl: null } : null,
      tiers: mapped,
    };
    // `now` só muda o mês; o resto vem das dependências abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, owned, xp, pass.name, pass.description, pass.color, pass.imageUrl, nextPassName]);

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold text-muted">Assim o jogador vê o cartão do passe na tela inicial:</p>
      <PassCardView pass={view} onOpenTrail={undefined} />

      <div className="space-y-3 rounded-2xl bg-surface-2 p-4">
        <div className="flex items-center justify-between gap-3 text-sm font-bold text-ink">
          <span>Simular o XP do mês</span>
          <span className="font-display">{xp.toLocaleString('pt-BR')} XP</span>
        </div>
        <Slider aria-label="XP do mês simulado" value={xp} onChange={setXp} min={0} max={top} step={Math.max(1, Math.round(top / 100))} />
        <Switch checked={owned} onChange={setOwned} label="Jogador já tem os itens visuais" description="Mostra o aviso de item repetido (vira moedas) nos degraus com item." />
      </div>

      {showTrail ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Trilha de degraus (toque em "Ver trilha" no app):</p>
          {view.tiers.length === 0 ? <p className="text-sm text-muted">Este passe ainda não tem degraus ativos.</p> : <PassTrail pass={view} playerName="Maria" pageSize={4} />}
        </div>
      ) : null}
    </div>
  );
}
