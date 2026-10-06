import { useId, useState } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Alert, CoinIcon, ProgressBar } from '@/components/game/game-ui';
import { CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { cn } from '@/lib/cn';
import type { Breastplate, Stone } from '@/lib/campaign-api';

/** Gema lapidada desenhada em SVG (usada enquanto a arte da pedra não foi enviada no painel). */
export function StoneGem({ stone, size = 96, className }: { stone: Pick<Stone, 'name' | 'color' | 'imageUrl' | 'state'>; size?: number; className?: string }) {
  const id = useId();
  const locked = stone.state === 'locked';
  return (
    <span
      role="img"
      aria-label={`Pedra ${stone.name}${locked ? ' (bloqueada)' : ''}`}
      className={cn('relative inline-flex shrink-0 items-center justify-center transition-all duration-500', locked && 'opacity-45 grayscale', stone.state === 'available' && 'animate-pulse', className)}
      style={{ width: size, height: size, filter: stone.state === 'claimed' ? `drop-shadow(0 0 ${Math.round(size / 8)}px ${stone.color})` : undefined }}
    >
      {stone.imageUrl ? (
        <img src={stone.imageUrl} alt="" draggable={false} className="h-full w-full object-contain" />
      ) : (
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
              <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
              <stop offset="1" stopColor="#000" stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {/* Engaste de ouro */}
          <polygon points="30,4 70,4 96,30 96,70 70,96 30,96 4,70 4,30" fill="#e0b43a" stroke="#a97c10" strokeWidth="2" />
          {/* Gema */}
          <polygon points="32,12 68,12 88,32 88,68 68,88 32,88 12,68 12,32" fill={stone.color} />
          <polygon points="32,12 68,12 88,32 88,68 68,88 32,88 12,68 12,32" fill={`url(#${id}-shine)`} />
          {/* Facetas */}
          <polygon points="38,32 62,32 72,42 72,58 62,68 38,68 28,58 28,42" fill="#fff" fillOpacity="0.14" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" />
          <path d="M32 12 38 32M68 12 62 32M88 32 72 42M88 68 72 58M68 88 62 68M32 88 38 68M12 68 28 58M12 32 28 42" stroke="#fff" strokeOpacity="0.35" strokeWidth="1" fill="none" />
          <polygon points="40,36 52,36 44,48" fill="#fff" fillOpacity="0.5" />
        </svg>
      )}
      {locked ? (
        <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-muted shadow">
          <LockRoundedIcon sx={{ fontSize: 16 }} />
        </span>
      ) : null}
    </span>
  );
}

function stateLabel(stone: Stone) {
  if (stone.state === 'claimed') return 'Conquistada';
  if (stone.state === 'available') return 'Pronta para resgatar';
  return `${stone.completed}/${stone.required} cenários`;
}

/** Recompensas da pedra: moedas, cosmético e brasão. */
function StoneRewards({ stone, playerName }: { stone: Stone; playerName: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Recompensas</p>
      <ul className="space-y-2 text-sm font-semibold text-ink">
        {stone.rewardCoins > 0 ? (
          <li className="flex items-center gap-2">
            <CoinIcon className="h-5 w-5" /> {stone.rewardCoins.toLocaleString('pt-BR')} moedas
          </li>
        ) : null}
        {stone.cosmetic ? (
          <li data-rarity={stone.cosmetic.rarity} className="rarity rarity-bg flex items-center gap-2 rounded-xl p-2">
            <CosmeticPreview item={stone.cosmetic} playerName={playerName} size="md" />
            <span className="min-w-0 truncate text-xs font-bold">{stone.cosmetic.name}</span>
          </li>
        ) : null}
        {stone.badge ? (
          <li data-rarity={stone.badge.rarity} className="rarity rarity-bg flex items-center gap-2 rounded-xl p-2">
            <CosmeticPreview item={stone.badge} playerName={playerName} size="md" />
            <span className="min-w-0 truncate text-xs font-bold">{stone.badge.name}</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

/** Cenários do grupo da pedra: concluídos, pendentes e os que ainda vêm ("em breve"). */
function StoneScenarios({ stone }: { stone: Stone }) {
  const missing = Math.max(stone.required - stone.scenarios.length, 0);
  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">Cenários desta pedra</p>
      <ProgressBar className="h-2.5" value={(stone.completed / Math.max(stone.required, 1)) * 100} color={stone.color} />
      <ul className="space-y-1.5">
        {stone.scenarios.map((scenario) => (
          <li key={scenario.id} className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className={cn('flex h-5 w-5 items-center justify-center rounded-full', scenario.completed ? 'bg-success text-on-primary' : 'border-2 border-edge-strong')}>{scenario.completed ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : null}</span>
            <span className={cn('truncate', scenario.completed ? '' : 'text-muted')}>{scenario.name}</span>
          </li>
        ))}
        {Array.from({ length: missing }, (_, index) => (
          <li key={`soon-${index}`} className="flex items-center gap-2 text-sm font-semibold text-muted">
            <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-dashed border-edge-strong">
              <HourglassTopRoundedIcon sx={{ fontSize: 12 }} />
            </span>
            Novo cenário em breve
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Página da campanha, logo depois do último cenário do grupo: a pedra para resgatar. */
export function StonePage({ stone, playerName, active, claiming, onClaim, onOpenBreastplate, pageClass }: { stone: Stone; playerName: string; active: boolean; claiming: boolean; onClaim: (stone: Stone) => void; onOpenBreastplate: () => void; pageClass: string }) {
  return (
    <section aria-label={`Pedra ${stone.name}`} aria-hidden={active ? undefined : true} className={pageClass}>
      <div className={cn('my-auto w-full max-w-md space-y-4 pr-8 transition-all duration-700', active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')}>
        <div className="flex flex-col items-center text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-muted">{stone.state === 'claimed' ? 'Pedra conquistada' : `Pedra ${stone.slot} de 12 do Peitoral`}</p>
          <StoneGem stone={stone} size={128} className="my-3" />
          <h3 className="font-display text-2xl font-bold text-ink">{stone.name}</h3>
          {stone.tribe ? <p className="text-sm font-semibold text-muted">Tribo de {stone.tribe}</p> : null}
          {stone.description ? <p className="mt-1 text-sm font-semibold text-muted">{stone.description}</p> : null}
        </div>
        <div className="panel space-y-4 p-4">
          <StoneScenarios stone={stone} />
          <StoneRewards stone={stone} playerName={playerName} />
        </div>
        <div className="flex flex-col gap-2">
          {stone.state === 'available' ? (
            <Button onClick={() => onClaim(stone)} loading={claiming}>
              Resgatar pedra
            </Button>
          ) : stone.state === 'claimed' ? (
            <Alert tone="success">Esta pedra já está no seu Peitoral.</Alert>
          ) : (
            <Alert tone="info">Conclua os {stone.required} cenários desta pedra para resgatá-la.</Alert>
          )}
          <Button variant="secondary" onClick={onOpenBreastplate}>
            Ver o Peitoral
          </Button>
        </div>
      </div>
    </section>
  );
}

/** O Peitoral do Sumo Sacerdote: 12 engastes em 4 fileiras de 3; a pedra conquistada acende. */
export function BreastplateModal({ open, breastplate, playerName, claimingId, onClaim, onClose }: { open: boolean; breastplate: Breastplate | null; playerName: string; claimingId: number | null; onClaim: (stone: Stone) => void; onClose: () => void }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const stones = breastplate?.stones ?? [];
  const selected = stones.find((stone) => stone.id === selectedId) ?? null;
  const rows = [0, 1, 2, 3].map((row) => stones.slice(row * 3, row * 3 + 3));

  return (
    <Modal open={open} size="md" title="Peitoral do Sumo Sacerdote" description={breastplate ? `Êxodo 28:15–21 · ${breastplate.claimed} de ${breastplate.total} pedras` : undefined} onClose={onClose} footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}>
      {breastplate ? (
        <div className="space-y-4">
          <div className="space-y-2 rounded-3xl border-2 border-[#e0b43a] bg-gradient-to-b from-[#2d4a8a]/25 via-[#7a3c8a]/20 to-[#a83a3a]/20 p-3 shadow-inner">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-3 gap-2">
                {row.map((stone) => (
                  <button
                    key={stone.id}
                    type="button"
                    onClick={() => setSelectedId(stone.id === selectedId ? null : stone.id)}
                    aria-pressed={stone.id === selectedId}
                    aria-label={`${stone.name}: ${stateLabel(stone)}`}
                    className={cn('flex flex-col items-center gap-1 rounded-2xl border-2 bg-surface/70 px-1 py-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50', stone.id === selectedId ? 'border-primary' : 'border-transparent hover:border-edge-strong')}
                  >
                    <StoneGem stone={stone} size={64} />
                    <span className="max-w-full truncate text-xs font-bold text-ink">{stone.name}</span>
                    <span className={cn('text-[10px] font-bold', stone.state === 'available' ? 'text-success' : 'text-muted')}>{stateLabel(stone)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          {selected ? (
            <div className="panel space-y-3 p-4">
              <div className="flex items-center gap-3">
                <StoneGem stone={selected} size={56} />
                <div className="min-w-0">
                  <h4 className="truncate font-display text-lg font-bold text-ink">{selected.name}</h4>
                  <p className="text-xs font-semibold text-muted">{selected.tribe ? `Tribo de ${selected.tribe} · ` : ''}{stateLabel(selected)}</p>
                </div>
              </div>
              {selected.description ? <p className="text-sm font-semibold text-muted">{selected.description}</p> : null}
              <StoneScenarios stone={selected} />
              <StoneRewards stone={selected} playerName={playerName} />
              {selected.state === 'available' ? (
                <Button onClick={() => onClaim(selected)} loading={claimingId === selected.id}>
                  Resgatar pedra
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-center text-sm font-semibold text-muted">Toque numa pedra para ver os cenários e as recompensas dela.</p>
          )}

          <div className="panel space-y-2 p-4">
            <p className="font-display font-bold text-ink">🛡️ Peitoral Completo</p>
            <ProgressBar className="h-2.5" value={(breastplate.claimed / Math.max(breastplate.total, 1)) * 100} color="#e0b43a" />
            <p className="text-sm font-semibold text-muted">
              {breastplate.finalClaimed
                ? 'Conquista concluída: você completou o Peitoral!'
                : `Reúna as ${breastplate.total} pedras e ganhe ${breastplate.finalReward.coins.toLocaleString('pt-BR')} moedas, o brasão e a moldura de prestígio do Peitoral Completo.`}
            </p>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
