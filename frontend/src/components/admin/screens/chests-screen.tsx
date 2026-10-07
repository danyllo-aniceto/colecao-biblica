import { useEffect, useMemo, useState } from 'react';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { ColorField } from '@/components/ui/color-field';
import { Alert, CoinIcon } from '@/components/game/game-ui';
import { ImageUploadField } from '../image-upload-field';
import { saveChestDesign, setChestDesign, useChestDesigns } from '@/lib/chest-designs';
import { CHEST_SFX, CHEST_TIERS, ChestIcon, ChestOpening, chestLook } from '@/components/user/chest-opening';
import { playSfx, type SfxName } from '@/lib/sound/sfx';
import { simulateChests, type ChestSimulation, type SimulatedChestTier } from '@/lib/admin-api';
import type { ChestPrize, ChestTierName } from '@/lib/user-api';
import { getRarityLabel } from '@/lib/rarity-theme';
import { AdminPanel } from '../admin-ui';

type MatchTier = Exclude<ChestTierName, 'EMERALD'>;
const TIER_ORDER: MatchTier[] = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
/** O baú de esmeralda não é da partida (vem da campanha), mas também tem visual e animação para conferir. */
const DESIGN_ORDER: ChestTierName[] = [...TIER_ORDER, 'EMERALD'];

/** Exemplo do que o Baú de Esmeralda traz (teste de animação; o conteúdo real é fixo no servidor). */
const EMERALD_SAMPLE: ChestPrize[] = [
  { kind: 'COINS', amount: 1000 },
  { kind: 'HELPER', name: 'Vida extra', amount: 1 },
  { kind: 'HELPER', name: 'Dica 50/50', amount: 1 },
  { kind: 'HELPER', name: 'Ampulheta', amount: 1 },
  { kind: 'HELPER', name: 'Escudo de sequência', amount: 1 },
  { kind: 'COSMETIC', name: 'Luz esmeralda', rarity: 'LEGENDARY' },
  { kind: 'COSMETIC', name: 'Ovelha do Bom Pastor', rarity: 'LEGENDARY' },
  { kind: 'COSMETIC', name: 'Pastor das ovelhas', rarity: 'LEGENDARY' },
  { kind: 'STICKER', characterId: null, name: 'Figurinha épica', rarity: 'EPIC', imageUrl: null, unlocked: true, duplicate: false },
  { kind: 'STICKER', characterId: null, name: 'Figurinha lendária', rarity: 'LEGENDARY', imageUrl: null, unlocked: true, duplicate: false },
  { kind: 'STICKER', characterId: null, name: 'Figurinha especial', rarity: 'SPECIAL', imageUrl: null, unlocked: true, duplicate: false },
];
/** Troca as figurinhas do exemplo por personagens reais (nome e foto) tirados das amostras do simulador. */
function emeraldSample(samples: Partial<Record<MatchTier, ChestPrize[][]>>): ChestPrize[] {
  const stickers = Object.values(samples).flatMap((tier) => (tier ?? []).flat()).filter((prize) => prize.kind === 'STICKER' && prize.name && prize.imageUrl);
  const best = (...rarities: string[]) => stickers.find((prize) => prize.kind === 'STICKER' && rarities.includes(prize.rarity ?? ''));
  const real = {
    EPIC: best('EPIC') ?? best('RARE', 'COMMON'),
    LEGENDARY: best('LEGENDARY') ?? best('EPIC'),
    SPECIAL: best('LEGENDARY', 'EPIC') ?? best('RARE', 'COMMON'),
  };
  return EMERALD_SAMPLE.map((prize) => {
    if (prize.kind !== 'STICKER') return prize;
    const swap = real[(prize.rarity ?? '') as keyof typeof real];
    return swap && swap.kind === 'STICKER' ? { ...swap, rarity: prize.rarity, unlocked: true, duplicate: false } : prize;
  });
}
const RARITIES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'] as const;
const RARITY_COLOR: Record<(typeof RARITIES)[number], string> = { COMMON: '#9ca3af', RARE: '#3b82f6', EPIC: '#a855f7', LEGENDARY: '#fbbf24' };
const ACCURACIES = [0.7, 0.75, 0.8, 0.85, 0.9, 0.95];
const percent = (value: number, digits = 0) => `${(value * 100).toFixed(digits)}%`;
const number = (value: number, digits = 2) => value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

function choose(n: number, k: number) {
  let result = 1;
  for (let index = 1; index <= k; index += 1) result = (result * (n - k + index)) / index;
  return result;
}

/** Chance de acertar pelo menos N perguntas antes de perder todas as vidas, dada a taxa de acerto. */
function chanceAtLeast(correct: number, accuracy: number, lives: number) {
  const trials = correct + lives - 1;
  let sum = 0;
  for (let failures = 0; failures < lives; failures += 1) sum += choose(trials, failures) * (1 - accuracy) ** failures * accuracy ** (trials - failures);
  return sum;
}

function TierCard({ tier, data, minCorrect, onTest }: { tier: MatchTier; data: SimulatedChestTier; minCorrect: number; onTest: () => void }) {
  const designs = useChestDesigns();
  const info = chestLook(tier, designs[tier]);
  const helpers = Object.entries(data.helpers).sort((left, right) => right[1] - left[1]);
  return (
    <article className="space-y-3 rounded-3xl border-2 bg-surface p-4" style={{ borderColor: `${info.color}99` }}>
      <div className="flex items-center gap-3">
        <ChestIcon tier={tier} className="h-14 w-16 shrink-0" />
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold text-ink">{info.label}</h3>
          <p className="text-xs font-semibold text-muted">A partir de {minCorrect} acertos na maratona</p>
        </div>
      </div>
      {!data.possible ? <Alert tone="danger">Não há figurinha épica ou lendária publicada: no jogo este baú vira ouro.</Alert> : null}
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-surface-2 p-2">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Moedas</dt>
          <dd className="flex items-center gap-1 font-display text-lg font-bold text-ink">
            <CoinIcon className="h-4 w-4" /> {number(data.avgCoins, 1)}
          </dd>
        </div>
        <div className="rounded-2xl bg-surface-2 p-2">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Ajudas</dt>
          <dd className="font-display text-lg font-bold text-ink">{number(data.avgHelpers, 1)}</dd>
        </div>
        <div className="rounded-2xl bg-surface-2 p-2">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Tem figurinha</dt>
          <dd className="font-display text-lg font-bold text-ink">{percent(data.chanceSticker)}</dd>
        </div>
        <div className="rounded-2xl bg-surface-2 p-2">
          <dt className="text-xs font-bold uppercase tracking-wider text-muted">Figurinhas por baú</dt>
          <dd className="font-display text-lg font-bold text-ink">{number(data.avgStickers)}</dd>
        </div>
      </dl>
      <div className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Raridade por baú</p>
        {RARITIES.map((rarity) => (
          <div key={rarity} className="flex items-center gap-2 text-xs font-semibold text-ink">
            <span className="w-16 shrink-0">{getRarityLabel(rarity)}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.rarityPerChest[rarity] * 100)}%`, background: RARITY_COLOR[rarity] }} />
            </div>
            <span className="w-14 shrink-0 text-right tabular-nums">{percent(data.rarityPerChest[rarity], 1)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        Duas figurinhas: {percent(data.chanceTwoStickers, 1)}
        {data.spec.cosmetic.chance > 0
          ? ` · item visual: ${percent(data.chanceCosmetic, 1)}${Object.keys(data.cosmeticByRarity).length > 0 ? ` (${RARITIES.filter((rarity) => data.cosmeticByRarity[rarity]).map((rarity) => `${getRarityLabel(rarity)} ${percent(data.cosmeticByRarity[rarity], 1)}`).join(', ')})` : ''}`
          : ' · sem item visual'}
      </p>
      {helpers.length > 0 ? (
        <p className="text-xs text-muted">
          Ajudas mais comuns: {helpers.slice(0, 3).map(([name, value]) => `${name} (${percent(value, 0)})`).join(', ')}
        </p>
      ) : null}
      <Button size="sm" variant="secondary" onClick={onTest} className="w-full">
        <PlayArrowRoundedIcon fontSize="small" />
        Testar a animação
      </Button>
    </article>
  );
}

type DesignDraft = { imageUrl: string; openImageUrl: string; name: string; color: string };

/** Visual de cada baú: arte, nome e cor de brilho. O que ficar vazio usa o desenho padrão do app. */
function ChestDesignPanel({ samples, onPreview }: { samples: Partial<Record<MatchTier, ChestPrize[][]>>; onPreview: (tier: ChestTierName, prizes: ChestPrize[], design: DesignDraft) => void }) {
  const toast = useToast();
  const designs = useChestDesigns();
  const [drafts, setDrafts] = useState<Partial<Record<ChestTierName, DesignDraft>>>({});
  const [saving, setSaving] = useState<ChestTierName | null>(null);

  const draftOf = (tier: ChestTierName): DesignDraft => drafts[tier] ?? { imageUrl: designs[tier]?.imageUrl ?? '', openImageUrl: designs[tier]?.openImageUrl ?? '', name: designs[tier]?.name ?? '', color: designs[tier]?.color ?? CHEST_TIERS[tier].color };
  const change = (tier: ChestTierName, patch: Partial<DesignDraft>) => setDrafts((current) => ({ ...current, [tier]: { ...draftOf(tier), ...patch } }));

  async function save(tier: ChestTierName) {
    const draft = draftOf(tier);
    setSaving(tier);
    try {
      // A cor só é salva se mudou do padrão (assim a cor padrão acompanha o app).
      const color = draft.color.toLowerCase() === CHEST_TIERS[tier].color.toLowerCase() ? null : draft.color;
      const saved = await saveChestDesign(tier, { imageUrl: draft.imageUrl || null, openImageUrl: draft.openImageUrl || null, name: draft.name.trim() || null, color });
      setChestDesign(saved);
      setDrafts((current) => {
        const next = { ...current };
        delete next[tier];
        return next;
      });
      toast.success(`${CHEST_TIERS[tier].label} salvo.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminPanel title="Visual dos baús" description="O baú de esmeralda é o prêmio de conquistar a figurinha especial na campanha. Suba a arte de cada baú (imagem quadrada, de preferência com fundo transparente), escolha o nome e a cor do brilho. Vale para o resultado da partida, a loja e a abertura. Vazio usa o desenho padrão.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {DESIGN_ORDER.map((tier) => {
          const draft = draftOf(tier);
          const look = chestLook(tier, draft);
          return (
            <article key={tier} className="space-y-3 rounded-3xl border-2 border-edge bg-surface p-4">
              <div className="flex h-32 items-center justify-center rounded-2xl" style={{ background: `radial-gradient(circle, ${look.color}44, transparent 70%)` }}>
                <ChestIcon tier={tier} design={draft} className="h-28 w-32" />
                {draft.openImageUrl ? <ChestIcon tier={tier} design={draft} open className="ml-2 h-28 w-32" /> : null}
              </div>
              <Field label="Baú fechado">
                <ImageUploadField value={draft.imageUrl} onChange={(url) => change(tier, { imageUrl: url })} />
              </Field>
              <Field label="Baú aberto (opcional)" hint="Mesmo enquadramento do fechado. Aparece no instante em que o baú abre.">
                <ImageUploadField value={draft.openImageUrl} onChange={(url) => change(tier, { openImageUrl: url })} />
              </Field>
              <Field label="Nome" hint={`Padrão: ${CHEST_TIERS[tier].label}`}>
                <Input value={draft.name} maxLength={40} onChange={(event) => change(tier, { name: event.target.value })} placeholder={CHEST_TIERS[tier].label} />
              </Field>
              <Field label="Cor do brilho">
                <ColorField value={draft.color} onChange={(value) => change(tier, { color: value })} />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => void save(tier)} loading={saving === tier}>
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onPreview(tier, tier === 'EMERALD' ? emeraldSample(samples) : (samples[tier] ?? [])[0] ?? [{ kind: 'COINS', amount: 10 }], draft)}
                >
                  <PlayArrowRoundedIcon fontSize="small" />
                  Testar
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </AdminPanel>
  );
}

const SOUND_TESTS: Array<{ title: string; sounds: Array<{ name: SfxName; label: string }> }> = [
  { title: 'Abertura de cada baú', sounds: DESIGN_ORDER.map((tier) => ({ name: CHEST_SFX[tier], label: CHEST_TIERS[tier].label.replace('Baú de ', '') })) },
  {
    title: 'Carretel e suspense',
    sounds: [
      { name: 'reelTick', label: 'Tique do carretel' },
      { name: 'suspenseRare', label: 'Suspense: rara' },
      { name: 'suspenseEpic', label: 'Suspense: épica' },
      { name: 'suspenseLegendary', label: 'Suspense: lendária' },
    ],
  },
  {
    title: 'Prêmios',
    sounds: [
      { name: 'prizeCoins', label: 'Moedas' },
      { name: 'prizeHelper', label: 'Ajuda' },
      { name: 'prizeCosmetic', label: 'Item visual' },
      { name: 'stickerCommon', label: 'Figurinha comum' },
      { name: 'stickerRare', label: 'Figurinha rara' },
      { name: 'stickerEpic', label: 'Figurinha épica' },
      { name: 'stickerLegendary', label: 'Figurinha lendária' },
      { name: 'stickerSpecial', label: 'Figurinha especial' },
    ],
  },
];

/** Teste dos sons dos baús (respeita o volume e o mudo das configurações de som do app). */
function SoundPanel() {
  return (
    <AdminPanel title="Sons dos baús" description="Cada nível de baú e cada tipo de prêmio tem um som próprio, criado no próprio app (não precisa de arquivo). Toque para ouvir; o volume segue as configurações de som do app.">
      <div className="grid gap-4 md:grid-cols-3">
        {SOUND_TESTS.map((group) => (
          <section key={group.title} className="space-y-2">
            <h3 className="font-display font-bold text-ink">{group.title}</h3>
            <div className="flex flex-wrap gap-2">
              {group.sounds.map((sound) => (
                <Button key={sound.name} size="sm" variant="secondary" onClick={() => playSfx(sound.name)}>
                  <PlayArrowRoundedIcon fontSize="small" />
                  {sound.label}
                </Button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AdminPanel>
  );
}

/** Simulador dos baús: abre milhares de baús em memória, com as regras e os dados reais, e mostra o que cada um entrega. */
export function ChestsScreen() {
  const toast = useToast();
  const [runs, setRuns] = useState('5000');
  const [data, setData] = useState<ChestSimulation | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ tier: ChestTierName; prizes: ChestPrize[]; design?: DesignDraft } | null>(null);
  const [marathons, setMarathons] = useState('4');

  async function run() {
    setLoading(true);
    try {
      setData(await simulateChests(Number(runs)));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function test(tier: MatchTier) {
    const samples = data?.tiers[tier].samples ?? [];
    if (samples.length === 0) return;
    setPreview({ tier, prizes: samples[Math.floor(Math.random() * samples.length)] });
  }

  // Quanto um jogador ganha por dia, conforme a taxa de acerto e a quantidade de maratonas.
  const perDay = useMemo(() => {
    if (!data) return [];
    const { thresholds, tiers } = data;
    const count = Math.max(0, Math.min(40, Number(marathons) || 0));
    return ACCURACIES.map((accuracy) => {
      const atLeast = (correct: number) => chanceAtLeast(correct, accuracy, thresholds.startingLives);
      const gold = atLeast(thresholds.gold);
      const raw = {
        BRONZE: atLeast(thresholds.bronze) - atLeast(thresholds.silver),
        SILVER: atLeast(thresholds.silver) - gold,
        GOLD: gold - atLeast(thresholds.diamond),
        DIAMOND: atLeast(thresholds.diamond),
      };
      const expected = { BRONZE: count * raw.BRONZE, SILVER: count * raw.SILVER, GOLD: count * raw.GOLD, DIAMOND: count * raw.DIAMOND };
      // Diamante tem limite por dia: o que passa vira ouro.
      const diamonds = Math.min(expected.DIAMOND, thresholds.diamondPerDay);
      expected.GOLD += expected.DIAMOND - diamonds;
      expected.DIAMOND = diamonds;
      // Limite total de baús por dia: reduz todos na mesma proporção.
      const total = expected.BRONZE + expected.SILVER + expected.GOLD + expected.DIAMOND;
      const scale = total > thresholds.dailyLimit ? thresholds.dailyLimit / total : 1;
      const chests = TIER_ORDER.map((tier) => expected[tier] * scale);
      const stickers = TIER_ORDER.reduce((sum, tier, index) => sum + chests[index] * tiers[tier].avgStickers, 0);
      const coins = TIER_ORDER.reduce((sum, tier, index) => sum + chests[index] * tiers[tier].avgCoins, 0);
      return { accuracy, raw, chests: chests.reduce((sum, value) => sum + value, 0), stickers, coins };
    });
  }, [data, marathons]);

  return (
    <>
      <AdminPanel
        title="Simulador de baús"
        description="Abre baús de mentira com as regras, os personagens publicados e as configurações de agora. Nada é gravado: serve para conferir se cada baú está entregando o que você quer."
        actions={
          <>
            <Select aria-label="Quantidade de baús simulados" value={runs} onChange={setRuns} options={[{ value: '1000', label: '1.000 baús por nível' }, { value: '5000', label: '5.000 baús por nível' }, { value: '20000', label: '20.000 baús por nível' }]} />
            <Button onClick={() => void run()} loading={loading}>
              <ReplayRoundedIcon fontSize="small" />
              Simular de novo
            </Button>
          </>
        }
      >
        {loading && !data ? <LoadingState label="Abrindo baús..." /> : null}
        {data ? (
          <>
            <p className="text-sm text-muted">
              Cortes de acertos: bronze {data.thresholds.bronze}+, prata {data.thresholds.silver}+, ouro {data.thresholds.gold}+, diamante {data.thresholds.diamond}+ · até {data.thresholds.dailyLimit} baús por dia ({data.thresholds.diamondPerDay} de diamante) · {data.thresholds.newStickerPercent}% de chance de a figurinha ser nova · garantia de figurinha a cada {data.thresholds.pityThreshold} baús sem ela.
            </p>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {TIER_ORDER.map((tier) => (
                <TierCard key={tier} tier={tier} data={data.tiers[tier]} minCorrect={data.thresholds[tier.toLowerCase() as 'bronze' | 'silver' | 'gold' | 'diamond']} onTest={() => test(tier)} />
              ))}
            </div>
            <p className="text-xs text-muted">
              Itens visuais que podem sair em baús (marcados em "entra em baús" na tela Visual): {RARITIES.map((rarity) => `${data.cosmeticsInChestPool[rarity] ?? 0} ${getRarityLabel(rarity).toLowerCase()}s`).join(' · ')}
              {Object.values(data.cosmeticsInChestPool).every((count) => !count) ? '. Nenhum ainda: os baús de prata para cima só trazem item visual quando houver itens marcados.' : '.'} A raridade do item sorteado respeita o baú: comum e rara a partir da prata, épica no ouro, lendária no ouro e no diamante.
            </p>
            <p className="text-xs text-muted">
              Figurinhas publicadas: {RARITIES.map((rarity) => `${data.publishedByRarity[rarity] ?? 0} ${getRarityLabel(rarity).toLowerCase()}s`).join(' · ')}. A raridade vem das chances de cada recompensa de figurinha (tela Recompensas) e do pacote surpresa.
            </p>
          </>
        ) : null}
      </AdminPanel>

      <ChestDesignPanel
        samples={data ? Object.fromEntries(TIER_ORDER.map((tier) => [tier, data.tiers[tier].samples])) : {}}
        onPreview={(tier, prizes, design) => setPreview({ tier, prizes, design })}
      />

      <SoundPanel />

      {data ? (
        <AdminPanel title="Quanto um jogador ganha por dia" description="Estimativa pela taxa de acerto: a chance de cada nível de baú numa maratona (até as vidas acabarem), os limites diários e o que cada baú entrega. Não inclui a garantia contra azar nem a loja.">
          <div className="max-w-xs">
            <Field label="Maratonas por dia" hint="Quantas partidas completas o jogador faz.">
              <Input type="number" min={0} max={40} value={marathons} onChange={(event) => setMarathons(event.target.value)} />
            </Field>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-edge text-xs font-bold uppercase tracking-wider text-muted">
                  <th className="py-2 pr-3">Taxa de acerto</th>
                  <th className="py-2 pr-3">Sem baú</th>
                  {TIER_ORDER.map((tier) => (
                    <th key={tier} className="py-2 pr-3">
                      {CHEST_TIERS[tier].label.replace('Baú de ', '')}
                    </th>
                  ))}
                  <th className="py-2 pr-3">Baús/dia</th>
                  <th className="py-2 pr-3">Figurinhas/dia</th>
                  <th className="py-2">Moedas dos baús/dia</th>
                </tr>
              </thead>
              <tbody>
                {perDay.map((row) => (
                  <tr key={row.accuracy} className="border-b border-edge/60">
                    <td className="py-2 pr-3 font-display font-bold text-ink">{percent(row.accuracy)}</td>
                    <td className="py-2 pr-3 tabular-nums text-muted">{percent(1 - row.raw.BRONZE - row.raw.SILVER - row.raw.GOLD - row.raw.DIAMOND, 1)}</td>
                    {TIER_ORDER.map((tier) => (
                      <td key={tier} className="py-2 pr-3 tabular-nums">
                        {percent(row.raw[tier], 1)}
                      </td>
                    ))}
                    <td className="py-2 pr-3 tabular-nums">{number(row.chests, 1)}</td>
                    <td className="py-2 pr-3 font-display font-bold tabular-nums text-ink">{number(row.stickers)}</td>
                    <td className="py-2 tabular-nums">{number(row.coins, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      ) : null}

      {preview ? <ChestOpening tier={preview.tier} prizes={preview.prizes} design={preview.design ? { imageUrl: preview.design.imageUrl || null, openImageUrl: preview.design.openImageUrl || null, name: preview.design.name || null, color: preview.design.color } : undefined} preview onDone={() => setPreview(null)} /> : null}
    </>
  );
}
