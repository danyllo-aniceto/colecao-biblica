import { useEffect, useState } from 'react';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { ChestIcon } from '@/components/user/chest-opening';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { getChestsToday, type ChestsToday, type ChestTierName } from '@/lib/user-api';

const TIER_NAME: Record<ChestTierName, string> = { BRONZE: 'Bronze', SILVER: 'Prata', GOLD: 'Ouro', DIAMOND: 'Diamante', EMERALD: 'Esmeralda' };

/**
 * Baús da maratona ganhos hoje: um espaço por baú do limite diário. Os ganhos aparecem coloridos (com o nível) e os que
 * faltam ficam vazios, para o jogador ver de relance quantos ainda pode conquistar.
 * `refreshKey` muda quando uma partida termina, para recontar.
 */
export function DailyChestsCard({ refreshKey }: { refreshKey: unknown }) {
  const [data, setData] = useState<ChestsToday | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getChestsToday()
      .then((next) => {
        if (cancelled) return;
        setData(next);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (failed && !data) return null;
  if (!data) {
    return (
      <section className="panel flex items-center justify-center p-4">
        <Spinner size="sm" label="Carregando os baús de hoje" />
      </section>
    );
  }
  // Limite 0 = baús desligados.
  if (data.limit <= 0) return null;

  const left = Math.max(0, data.limit - data.used);
  const full = left === 0;
  const slots = Array.from({ length: Math.max(data.limit, data.used) }, (_, index) => (index < data.used ? (data.tiers[index] ?? 'BRONZE') : null));

  return (
    <section className="panel space-y-3 p-4" aria-label="Baús de hoje">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <Inventory2RoundedIcon className="text-primary" fontSize="small" /> Baús de hoje
        </h3>
        <span className={`rounded-full px-3 py-1 font-display text-sm font-bold ${full ? 'bg-success/20 text-success' : 'bg-primary/20 text-ink'}`}>
          {data.used}/{data.limit}
        </span>
      </div>

      <ul className="flex items-end justify-center gap-2 sm:gap-3">
        {slots.map((tier, index) => (
          <li key={index} className="min-w-0 flex-1">
            <Tooltip content={tier ? `Baú de ${TIER_NAME[tier]} conquistado` : 'Baú ainda por conquistar'}>
              <div
                className={`flex aspect-square max-w-20 items-center justify-center rounded-2xl border-2 p-1 mx-auto ${
                  tier ? 'border-primary/60 bg-primary/10' : 'border-dashed border-edge bg-surface-2'
                }`}
              >
                {tier ? (
                  <ChestIcon tier={tier} className="h-full w-full drop-shadow" />
                ) : (
                  <Inventory2RoundedIcon className="text-muted opacity-40" />
                )}
              </div>
            </Tooltip>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm font-semibold text-muted">
        {full
          ? 'Você pegou todos os baús de hoje! Volte amanhã para mais.'
          : data.used === 0
            ? `Jogue a Maratona: você pode ganhar até ${data.limit} baús hoje.`
            : `Ainda dá para ganhar ${left} ${left === 1 ? 'baú' : 'baús'} hoje na Maratona.`}
      </p>
    </section>
  );
}
