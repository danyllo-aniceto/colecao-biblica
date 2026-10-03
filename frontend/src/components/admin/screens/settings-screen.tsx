import { useEffect, useMemo, useState, type FormEvent } from 'react';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert } from '@/components/game/game-ui';
import { getSettings, updateSettings, type GameSettings } from '@/lib/admin-api';
import { DROP_RARITIES, getRarityLabel } from '@/lib/rarity-theme';
import { AdminPanel } from '../admin-ui';

type Key = keyof GameSettings;
type FieldDef = { key: Key; label: string; hint?: string; min: number; max: number; step?: number; suffix?: string; toggle?: boolean };

const GROUPS: Array<{ title: string; description: string; fields: FieldDef[] }> = [
  {
    title: 'Partida',
    description: 'Como cada partida funciona.',
    fields: [
      { key: 'startingLives', label: 'Vidas por partida', min: 1, max: 20, hint: 'A partida acaba quando as vidas zeram.' },
      { key: 'maxQuestionsPerMatch', label: 'Máximo de perguntas por partida', min: 1, max: 1000 },
      { key: 'rewardMinCorrectAnswers', label: 'Acertos mínimos para ganhar baú', min: 1, max: 100, hint: 'No quiz geral. Limitado ao total de perguntas ativas.' },
      { key: 'chestDiamondMinCorrect', label: 'Acertos para o baú de diamante', min: 1, max: 1000, hint: 'Só jogador experiente chega lá. Sempre dá figurinha épica (75%) ou lendária (25%), mais moedas, uma ajuda e, às vezes, um item visual raro.' },
      { key: 'chestDiamondLimitPerDay', label: 'Baús de diamante por dia', min: 0, max: 20, hint: 'Contam dentro do limite de baús. Acima disso o baú vira ouro (0 desliga o diamante).' },
      { key: 'xpFullMatchesPerDay', label: 'Partidas por dia com XP cheio', min: 0, max: 100, hint: 'Depois disso o XP cai para a porcentagem abaixo (0 desliga o freio).' },
      { key: 'xpAfterLimitPercent', label: 'XP depois do limite diário', min: 0, max: 100, suffix: '%', hint: 'Porcentagem do XP nas partidas extras do dia.' },
      { key: 'rewardMatchLimitPerDay', label: 'Baús da partida por dia', min: 0, max: 20, hint: 'Quantos baús o jogador pode ganhar por dia na maratona (0 desliga os baús).' },
      { key: 'chestSilverMinCorrect', label: 'Acertos para o baú de prata', min: 1, max: 1000, hint: 'Abaixo disso o baú é de bronze (o mínimo para ganhar baú é "Acertos mínimos para ganhar baú").' },
      { key: 'chestGoldMinCorrect', label: 'Acertos para o baú de ouro', min: 1, max: 1000, hint: 'O ouro sempre dá figurinha, com chances melhores de rara e épica.' },
    ],
  },
  {
    title: 'Economia',
    description: 'De onde vêm as moedas. Toda partida rende algo, até o limite diário (evita repetir o mesmo quiz só para ganhar).',
    fields: [
      { key: 'coinsPerCorrectAnswer', label: 'Moedas por acerto', min: 0, max: 100 },
      { key: 'perfectMatchBonusCoins', label: 'Bônus de partida perfeita', min: 0, max: 1000, hint: 'Sem erros, com 5+ perguntas.' },
      { key: 'coinMatchLimitPerDay', label: 'Partidas que rendem moedas por dia', min: 0, max: 100 },
      { key: 'shopStickerLimitPerDay', label: 'Figurinhas compradas por dia', min: 0, max: 50, hint: 'Inclui o pacote surpresa. 0 = sem limite. Ajudas e itens visuais não contam.' },
      { key: 'duplicateCoinsCommon', label: 'Venda de repetida comum', min: 0, max: 10000, suffix: 'moedas' },
      { key: 'duplicateCoinsRare', label: 'Venda de repetida rara', min: 0, max: 10000, suffix: 'moedas' },
      { key: 'duplicateCoinsEpic', label: 'Venda de repetida épica', min: 0, max: 10000, suffix: 'moedas' },
      { key: 'duplicateCoinsLegendary', label: 'Venda de repetida lendária', min: 0, max: 10000, suffix: 'moedas' },
    ],
  },
  {
    title: 'Prêmio diário',
    description: 'Ciclo de 7 dias: o prêmio cresce a cada dia seguido; pular um dia recomeça do 1º.',
    fields: [
      { key: 'dailyRewardBaseCoins', label: 'Moedas no 1º dia', min: 0, max: 10000 },
      { key: 'dailyRewardStepCoins', label: 'A mais por dia seguido', min: 0, max: 10000, hint: 'Dias 2 a 6.' },
      { key: 'dailyRewardDay7Coins', label: 'Moedas no 7º dia', min: 0, max: 10000, hint: 'O 7º dia também dá 1 dica 50/50.' },
    ],
  },
  {
    title: 'Bônus',
    description: 'Limites do inventário e efeito dos bônus usados na partida (cada um, uma vez por partida).',
    fields: [
      { key: 'maxExtraLifeBoosts', label: 'Máximo de vidas extras guardadas', min: 1, max: 20 },
      { key: 'maxExtraTimeBoosts', label: 'Máximo de tempos extras guardados', min: 1, max: 20 },
      { key: 'maxDoubleXpBoosts', label: 'Máximo de XP em dobro guardados', min: 1, max: 20 },
      { key: 'maxHintBoosts', label: 'Máximo de dicas 50/50 guardadas', min: 1, max: 20 },
      { key: 'extraTimeSeconds', label: 'Segundos do tempo extra', min: 1, max: 120, suffix: 's' },
      { key: 'doubleXpMultiplier', label: 'Multiplicador do XP em dobro', min: 1, max: 10, step: 0.1, suffix: '×' },
    ],
  },
  {
    title: 'Engajamento',
    description: 'Protetor de sequência, garantia contra azar, fusão de repetidas e desafio do dia.',
    fields: [
      { key: 'maxStreakFreezes', label: 'Máximo de protetores guardados', min: 1, max: 10, hint: 'Cada protetor cobre um dia esquecido no prêmio diário.' },
      { key: 'pityThreshold', label: 'Garantia de figurinha a cada', min: 0, max: 50, suffix: 'prêmios', hint: 'Depois de N prêmios sem figurinha, o próximo é figurinha (0 desliga).' },
      { key: 'fuseCost', label: 'Repetidas para uma fusão', min: 2, max: 10, hint: 'Da mesma raridade, para ganhar uma da raridade acima.' },
      { key: 'dailyChallengeQuestions', label: 'Perguntas do desafio do dia', min: 3, max: 30 },
    ],
  },
  {
    title: 'Liga semanal',
    description: 'Ranking pelos pontos da semana (segunda a domingo). Os 3 primeiros resgatam o prêmio na semana seguinte.',
    fields: [
      { key: 'leagueFirstCoins', label: 'Prêmio do 1º lugar', min: 0, max: 100000, suffix: 'moedas' },
      { key: 'leagueSecondCoins', label: 'Prêmio do 2º lugar', min: 0, max: 100000, suffix: 'moedas' },
      { key: 'leagueThirdCoins', label: 'Prêmio do 3º lugar', min: 0, max: 100000, suffix: 'moedas' },
    ],
  },
  {
    title: 'Ajudas novas',
    description: 'Quantas de cada ajuda o jogador pode guardar. Cada uma vale uma vez por partida.',
    fields: [
      { key: 'maxSkipBoosts', label: 'Pular pergunta', min: 1, max: 20 },
      { key: 'maxSecondChanceBoosts', label: 'Segunda chance', min: 1, max: 20 },
      { key: 'maxCrowdBoosts', label: 'Voz da multidão', min: 1, max: 20 },
      { key: 'maxVerseHintBoosts', label: 'Pista do versículo', min: 1, max: 20 },
      { key: 'maxFreezeTimeBoosts', label: 'Ampulheta', min: 1, max: 20 },
      { key: 'maxDoubleCoinsBoosts', label: 'Bênção dobrada', min: 1, max: 20 },
      { key: 'maxComboShieldBoosts', label: 'Escudo de sequência', min: 1, max: 20 },
      { key: 'doubleCoinsMultiplier', label: 'Multiplicador da bênção dobrada', min: 1, max: 10, step: 0.1, suffix: '×' },
    ],
  },
  {
    title: 'Sequência de acertos',
    description: 'Acertos seguidos numa partida dão pontos e moedas extras a cada acerto, a partir do N-ésimo.',
    fields: [
      { key: 'comboStartAt', label: 'Começa no acerto seguido nº', min: 2, max: 20 },
      { key: 'comboPointsPerAnswer', label: 'Pontos extras por acerto', min: 0, max: 100 },
      { key: 'comboCoinsPerAnswer', label: 'Moedas extras por acerto', min: 0, max: 20, hint: 'Entram no limite diário de partidas com moedas.' },
    ],
  },
  {
    title: 'Baú de nível',
    description: 'Cada nível novo dá um baú: moedas, uma ajuda sorteada e chance de item visual (os marcados "pode sair no baú" em Visual).',
    fields: [
      { key: 'chestBaseCoins', label: 'Moedas fixas', min: 0, max: 10000 },
      { key: 'chestCoinsPerLevel', label: 'Moedas a mais por nível', min: 0, max: 1000 },
      { key: 'chestMaxCoins', label: 'Teto de moedas por baú', min: 0, max: 100000, hint: 'Evita baús enormes em níveis altos. 0 = sem teto.' },
      { key: 'chestCosmeticChance', label: 'Chance de item visual', min: 0, max: 100, suffix: '%' },
    ],
  },
  {
    title: 'Social',
    description: 'Amigos, conversa e troca de figurinhas repetidas entre jogadores.',
    fields: [
      { key: 'chatEnabled', label: 'Conversa entre amigos', min: 0, max: 1, toggle: true, hint: 'Desligada, os amigos continuam trocando figurinhas, mas não mandam mensagens.' },
      { key: 'tradesPerDay', label: 'Trocas concluídas por dia', min: 0, max: 100, hint: 'Por jogador (0 pausa as trocas).' },
      { key: 'maxPendingTrades', label: 'Propostas abertas ao mesmo tempo', min: 1, max: 100 },
      { key: 'tradeExpireDays', label: 'Proposta expira em', min: 1, max: 60, suffix: 'dias' },
      { key: 'friendSalePriceCommon', label: 'Venda a amigo: figurinha comum', min: 0, max: 100000, hint: 'Preço padrão: o comprador paga isso e o vendedor recebe sem a taxa.' },
      { key: 'friendSalePriceRare', label: 'Venda a amigo: figurinha rara', min: 0, max: 100000 },
      { key: 'friendSalePriceEpic', label: 'Venda a amigo: figurinha épica', min: 0, max: 100000 },
      { key: 'friendSalePriceLegendary', label: 'Venda a amigo: figurinha lendária', min: 0, max: 100000 },
      { key: 'friendSaleFeePercent', label: 'Taxa da venda a amigo', min: 0, max: 90, suffix: '%', hint: 'Descontada de quem vende; some do jogo (evita criar moedas).' },
    ],
  },
  {
    title: 'Pacote surpresa',
    description: 'Peso de cada raridade no pacote (vendido na loja e sorteado no fim da partida).',
    fields: [
      { key: 'packOddsCommon', label: 'Peso: comum', min: 0, max: 1000 },
      { key: 'packOddsRare', label: 'Peso: rara', min: 0, max: 1000 },
      { key: 'packOddsEpic', label: 'Peso: épica', min: 0, max: 1000 },
      { key: 'packOddsLegendary', label: 'Peso: lendária', min: 0, max: 1000 },
    ],
  },
];

const ALL_FIELDS = GROUPS.flatMap((group) => group.fields);

export function SettingsScreen() {
  const toast = useToast();
  const [saved, setSaved] = useState<GameSettings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function fill(settings: GameSettings) {
    setSaved(settings);
    setForm(Object.fromEntries(ALL_FIELDS.map((field) => [field.key, String(settings[field.key])])));
  }

  useEffect(() => {
    getSettings()
      .then(fill)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, []);

  const dirty = useMemo(() => saved !== null && ALL_FIELDS.some((field) => Number(form[field.key]) !== saved[field.key]), [form, saved]);

  const packOdds = useMemo(() => {
    const weights = { COMMON: Number(form.packOddsCommon) || 0, RARE: Number(form.packOddsRare) || 0, EPIC: Number(form.packOddsEpic) || 0, LEGENDARY: Number(form.packOddsLegendary) || 0 };
    const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
    return DROP_RARITIES.map((rarity) => ({ rarity, percent: total > 0 ? (weights[rarity as keyof typeof weights] / total) * 100 : 0 }));
  }, [form]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved) return;
    const changes: Partial<GameSettings> = {};
    for (const field of ALL_FIELDS) {
      const value = Number(form[field.key]);
      if (!Number.isFinite(value) || value < field.min || value > field.max) {
        toast.error(`${field.label}: use um valor entre ${field.min} e ${field.max}.`);
        return;
      }
      if (value !== saved[field.key]) changes[field.key] = value;
    }
    setSaving(true);
    try {
      fill(await updateSettings(changes));
      toast.success('Configurações salvas. Valem a partir da próxima partida.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!saved) return <LoadingState label="Carregando configurações..." />;

  return (
    <form className="space-y-6 pb-24" onSubmit={submit}>
      {GROUPS.map((group) => (
        <AdminPanel key={group.title} title={group.title} description={group.description}>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {group.fields.map((field) => (
              <Field key={field.key} label={field.label} hint={field.hint ?? `Entre ${field.min} e ${field.max}${field.suffix ? ` ${field.suffix}` : ''}.`}>
                {field.toggle ? (
                  <Switch
                    checked={form[field.key] === '1'}
                    onChange={(checked) => setForm((current) => ({ ...current, [field.key]: checked ? '1' : '0' }))}
                    label={form[field.key] === '1' ? 'Ligada' : 'Desligada'}
                  />
                ) : (
                  <div className="relative">
                    <Input
                      type="number"
                      min={field.min}
                      max={field.max}
                      step={field.step ?? 1}
                      value={form[field.key] ?? ''}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                      className={field.suffix ? 'pr-20' : undefined}
                    />
                    {field.suffix ? <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted">{field.suffix}</span> : null}
                  </div>
                )}
              </Field>
            ))}
          </div>
          {group.title === 'Pacote surpresa' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {packOdds.map(({ rarity, percent }) => (
                <div key={rarity} data-rarity={rarity} className="rarity rarity-bg rounded-2xl p-3 text-center">
                  <span className="rarity-text block font-display text-xl font-bold">{percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                  <span className="text-xs font-bold text-muted">{getRarityLabel(rarity)}</span>
                </div>
              ))}
            </div>
          ) : null}
        </AdminPanel>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:left-[264px]">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <span className="mr-auto text-sm font-semibold text-muted">{dirty ? 'Alterações não salvas.' : 'Tudo salvo.'}</span>
          <Button variant="secondary" onClick={() => fill(saved)} disabled={!dirty || saving}>
            Desfazer
          </Button>
          <Button type="submit" loading={saving} disabled={!dirty}>
            {saving ? null : <SaveRoundedIcon fontSize="small" />}
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </Button>
        </div>
      </div>
    </form>
  );
}
