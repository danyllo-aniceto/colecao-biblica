import { useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import {
  BOARD_SIZES,
  BOT_SKILLS,
  DEFAULT_CONFIG,
  FREE_PAWNS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PAWN_NAMES,
  POWER_UPS,
  PUSH_BACK,
  TIME_OPTIONS,
  type BoardConfig,
  type BotSkill,
} from '@board/engine';
import { boardRulesFor } from '@board/scenarios';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert } from '@/components/game/game-ui';
import { ScenarioIcon } from '@/components/user/campaign/scenario-art';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import { cn } from '@/lib/cn';
import type { CampaignScenario } from '@/lib/campaign-api';

export type SetupPlayer = { id: string; name: string; pawn: string; bot: BotSkill | null };
export type BoardSetup = { scenarioId: number; players: SetupPlayer[]; config: BoardConfig };

const BOT_NAMES = ['Davi', 'Ester', 'Daniel', 'Rute', 'Calebe', 'Débora', 'Josué', 'Miriã', 'Neemias', 'Lídia', 'Samuel', 'Ana'];
const NAME_MAX = 16;

type PresetKey = 'family' | 'classic' | 'challenge' | 'custom';
const PRESETS: Record<Exclude<PresetKey, 'custom'>, { label: string; hint: string; config: BoardConfig }> = {
  family: { label: 'Em família', hint: 'Curto, com tempo de sobra e sem empurrão.', config: { size: 25, timeSeconds: 30, powerUps: true, push: false, catchUp: true } },
  classic: { label: 'Clássico', hint: 'O equilíbrio de sempre.', config: DEFAULT_CONFIG },
  challenge: { label: 'Desafio', hint: 'Mais longo, rápido e com empurrão.', config: { size: 40, timeSeconds: 15, powerUps: true, push: true, catchUp: false } },
};

const sameConfig = (left: BoardConfig, right: BoardConfig) =>
  left.size === right.size && left.timeSeconds === right.timeSeconds && left.powerUps === right.powerUps && left.push === right.push && left.catchUp === right.catchUp;

const SIZE_LABEL: Record<number, string> = { 25: 'Rápido', 40: 'Clássico', 60: 'Épico' };
const PAGE_SIZE = 6;

type Props = {
  open: boolean;
  scenarios: CampaignScenario[];
  defaultScenarioId: number | null;
  /** Nome do jogador logado, para o primeiro lugar da mesa. */
  playerName: string;
  onClose: () => void;
  onStart: (setup: BoardSetup) => Promise<void>;
};

/** Assistente de criação da partida: cenário, jogadores e regras, em três passos. */
export function BoardSetupModal({ open, scenarios, defaultScenarioId, playerName, onClose, onStart }: Props) {
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [scenarioId, setScenarioId] = useState<number | null>(defaultScenarioId ?? scenarios[0]?.id ?? null);
  const [players, setPlayers] = useState<SetupPlayer[]>(() => [
    { id: 'p1', name: playerName.slice(0, NAME_MAX) || 'Jogador 1', pawn: FREE_PAWNS[0], bot: null },
    { id: 'p2', name: 'Jogador 2', pawn: FREE_PAWNS[1], bot: null },
  ]);
  const [config, setConfig] = useState<BoardConfig>(DEFAULT_CONFIG);
  const [showErrors, setShowErrors] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const paging = usePagination(scenarios, PAGE_SIZE);
  const scenario = scenarios.find((item) => item.id === scenarioId) ?? null;
  const rules = scenario ? boardRulesFor(scenario.slug) : null;
  const preset: PresetKey = (Object.keys(PRESETS) as Array<Exclude<PresetKey, 'custom'>>).find((key) => sameConfig(PRESETS[key].config, config)) ?? 'custom';

  const errors = useMemo(() => validatePlayers(players), [players]);
  const hasErrors = Object.keys(errors.byId).length > 0 || errors.general !== null;

  function updatePlayer(id: string, patch: Partial<SetupPlayer>) {
    setPlayers((current) => current.map((player) => (player.id === id ? { ...player, ...patch } : player)));
  }

  function nextId(prefix: 'p' | 'b') {
    for (let index = 1; index <= MAX_PLAYERS; index += 1) {
      if (!players.some((player) => player.id === `${prefix}${index}`)) return `${prefix}${index}`;
    }
    return `${prefix}${Date.now()}`;
  }

  function freePawn() {
    return FREE_PAWNS.find((pawn) => !players.some((player) => player.pawn === pawn)) ?? FREE_PAWNS[0];
  }

  function addHuman() {
    const number = players.filter((player) => !player.bot).length + 1;
    setPlayers((current) => [...current, { id: nextId('p'), name: `Jogador ${number}`, pawn: freePawn(), bot: null }]);
  }

  function addBot() {
    const taken = new Set(players.map((player) => player.name));
    const name = BOT_NAMES.find((candidate) => !taken.has(candidate)) ?? `Bot ${players.length + 1}`;
    setPlayers((current) => [...current, { id: nextId('b'), name, pawn: freePawn(), bot: 'STUDENT' }]);
  }

  function surprise() {
    if (scenarios.length === 0) return;
    const index = Math.floor(Math.random() * scenarios.length);
    setScenarioId(scenarios[index].id);
    paging.setPage(Math.floor(index / PAGE_SIZE));
  }

  function next() {
    if (step === 1) {
      setShowErrors(true);
      if (hasErrors) return;
    }
    setStep((current) => Math.min(2, current + 1));
  }

  async function start() {
    if (!scenario || hasErrors) return;
    setStarting(true);
    setStartError(null);
    try {
      await onStart({ scenarioId: scenario.id, players: players.map((player) => ({ ...player, name: player.name.trim() })), config });
    } catch (error) {
      const message = errorMessage(error, 'Não foi possível começar a partida.');
      setStartError(message);
      toast.error(message);
    } finally {
      setStarting(false);
    }
  }

  const title = ['Escolha o cenário', 'Quem vai jogar?', 'Regras da partida'][step];

  return (
    <Modal
      open={open}
      onClose={starting ? undefined : onClose}
      size="lg"
      title={title}
      description={
        <span className="flex items-center gap-1.5" aria-label={`Passo ${step + 1} de 3`}>
          {[0, 1, 2].map((index) => (
            <span key={index} className={cn('h-2 w-8 rounded-full transition-colors', index <= step ? 'bg-primary' : 'bg-surface-3')} />
          ))}
          <span className="ml-1 text-xs font-bold">Passo {step + 1} de 3</span>
        </span>
      }
      footer={
        <>
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep((current) => current - 1)} disabled={starting}>
              Voltar
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
          )}
          {step < 2 ? (
            <Button onClick={next} disabled={!scenario}>
              Avançar
            </Button>
          ) : (
            <Button onClick={() => void start()} loading={starting} disabled={!scenario}>
              {starting ? 'Preparando...' : 'Começar partida'}
            </Button>
          )}
        </>
      }
    >
      {step === 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted">Cada cenário tem o seu caminho, a sua provação e os seus power-ups. Quem cria a partida escolhe.</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {paging.pageItems.map((item) => {
              const selected = item.id === scenarioId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setScenarioId(item.id)}
                  aria-pressed={selected}
                  style={scenarioThemeVars(item.color)}
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-3xl border-2 bg-surface-2 p-3 text-center transition',
                    selected ? 'border-primary ring-4 ring-primary/30' : 'border-edge hover:border-primary/60',
                  )}
                >
                  <ScenarioIcon scenario={item} size={56} />
                  <span className="font-display text-sm font-bold leading-tight text-ink">{item.name}</span>
                  {item.verseReference ? <span className="text-[11px] font-semibold text-muted">{item.verseReference}</span> : null}
                </button>
              );
            })}
          </div>
          <Pagination
            page={paging.page}
            totalPages={paging.totalPages}
            totalElements={paging.totalElements}
            pageSize={paging.pageSize}
            onPageChange={paging.setPage}
            itemLabel="cenários"
          />
          <Button variant="secondary" size="sm" onClick={surprise}>
            <CasinoRoundedIcon fontSize="small" /> Surpreenda-me
          </Button>

          {scenario && rules ? (
            <section className="space-y-2 rounded-3xl border-2 border-edge bg-surface-2 p-4" style={scenarioThemeVars(scenario.color)} aria-label={`Neste tabuleiro: ${scenario.name}`}>
              <h3 className="font-display text-base font-bold text-ink">{scenario.name}</h3>
              {scenario.verse ? <p className="text-xs italic text-muted">“{scenario.verse}”</p> : null}
              <p className="text-sm text-ink">
                <b>⚔️ {rules.trial.name}.</b> <span className="text-muted">{rules.trial.description}</span>
              </p>
              <p className="text-sm text-ink">
                {rules.exclusive ? (
                  <>
                    <b>
                      {POWER_UPS[rules.exclusive].emoji} {POWER_UPS[rules.exclusive].name}.
                    </b>{' '}
                    <span className="text-muted">Exclusivo deste cenário: {POWER_UPS[rules.exclusive].description}</span>
                  </>
                ) : (
                  <span className="text-muted">Power-ups comuns nas casas 🎁.</span>
                )}
              </p>
              {rules.shelterGrants ? <p className="text-sm text-muted">🌳 Os abrigos também dão um power-up.</p> : null}
            </section>
          ) : (
            <Alert tone="danger">Nenhum cenário disponível no momento.</Alert>
          )}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-muted">
            De {MIN_PLAYERS} a {MAX_PLAYERS} jogadores no mesmo aparelho. Quem não tem conta joga só com o nome. Faltou gente? Chame um bot.
          </p>
          <ul className="space-y-3">
            {players.map((player, index) => {
              const error = showErrors ? errors.byId[player.id] : undefined;
              return (
                <li key={player.id} className="rounded-3xl border-2 border-edge bg-surface-2 p-3">
                  <div className="flex items-start gap-2">
                    <div className="w-24 shrink-0">
                      <Select
                        aria-label={`Peão de ${player.name || `jogador ${index + 1}`}`}
                        value={player.pawn}
                        onChange={(value) => updatePlayer(player.id, { pawn: value })}
                        options={FREE_PAWNS.map((pawn) => ({
                          value: pawn,
                          label: pawn,
                          description: PAWN_NAMES[pawn],
                          disabled: players.some((other) => other.id !== player.id && other.pawn === pawn),
                        }))}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      {player.bot ? (
                        <div className="flex h-12 items-center gap-2 rounded-2xl bg-surface-3 px-3 font-display text-sm font-bold text-ink">
                          <SmartToyRoundedIcon fontSize="small" className="text-muted" />
                          <span className="truncate">{player.name}</span>
                        </div>
                      ) : (
                        <Field label={`Nome do jogador ${index + 1}`} error={error} className="[&>div:first-child]:sr-only">
                          <Input
                            value={player.name}
                            maxLength={NAME_MAX}
                            placeholder={`Jogador ${index + 1}`}
                            aria-label={`Nome do jogador ${index + 1}`}
                            aria-invalid={Boolean(error)}
                            onChange={(event) => updatePlayer(player.id, { name: event.target.value })}
                          />
                        </Field>
                      )}
                    </div>
                    <Tooltip content="Tirar da mesa">
                      <button
                        type="button"
                        onClick={() => setPlayers((current) => current.filter((other) => other.id !== player.id))}
                        disabled={players.length <= MIN_PLAYERS}
                        aria-label={`Tirar ${player.name || `jogador ${index + 1}`} da mesa`}
                        className="flex h-12 w-11 shrink-0 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-3 hover:text-danger disabled:pointer-events-none disabled:opacity-30"
                      >
                        <DeleteOutlineRoundedIcon />
                      </button>
                    </Tooltip>
                  </div>
                  {player.bot ? (
                    <div className="mt-2">
                      <Segmented
                        aria-label={`Nível de ${player.name}`}
                        value={player.bot}
                        onChange={(skill) => updatePlayer(player.id, { bot: skill })}
                        options={(Object.keys(BOT_SKILLS) as BotSkill[]).map((skill) => ({ value: skill, label: BOT_SKILLS[skill].name }))}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {showErrors && errors.general ? <Alert tone="danger">{errors.general}</Alert> : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={addHuman} disabled={players.length >= MAX_PLAYERS}>
              <AddRoundedIcon fontSize="small" /> Jogador
            </Button>
            <Button variant="secondary" size="sm" onClick={addBot} disabled={players.length >= MAX_PLAYERS}>
              <SmartToyRoundedIcon fontSize="small" /> Bot
            </Button>
            <span className="self-center text-xs font-semibold text-muted">
              {players.length}/{MAX_PLAYERS} na mesa
            </span>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5">
          <Field label="Estilo" hint={preset === 'custom' ? 'Personalizado: você ajustou as regras abaixo.' : PRESETS[preset].hint}>
            <Segmented
              aria-label="Estilo da partida"
              value={preset}
              onChange={(key) => {
                if (key !== 'custom') setConfig({ ...PRESETS[key].config });
              }}
              options={(Object.keys(PRESETS) as Array<Exclude<PresetKey, 'custom'>>).map((key) => ({ value: key, label: PRESETS[key].label }))}
            />
          </Field>

          <Field label="Tamanho do tabuleiro" hint="Quantas casas até a chegada.">
            <Segmented
              aria-label="Tamanho do tabuleiro"
              value={String(config.size)}
              onChange={(value) => setConfig((current) => ({ ...current, size: Number(value) }))}
              options={BOARD_SIZES.map((size) => ({ value: String(size), label: `${SIZE_LABEL[size]} · ${size}` }))}
            />
          </Field>

          <Field label="Tempo por pergunta" hint="Estourou o tempo, conta como erro.">
            <Segmented
              aria-label="Tempo por pergunta"
              value={String(config.timeSeconds)}
              onChange={(value) => setConfig((current) => ({ ...current, timeSeconds: Number(value) }))}
              options={TIME_OPTIONS.map((seconds) => ({ value: String(seconds), label: `${seconds}s` }))}
            />
          </Field>

          <div className="space-y-3">
            <Switch checked={config.powerUps} onChange={(powerUps) => setConfig((current) => ({ ...current, powerUps }))} label="Power-ups" description="Casas 🎁, mochila e ajudas durante a pergunta." />
            <Switch checked={config.push} onChange={(push) => setConfig((current) => ({ ...current, push }))} label="Empurrão" description={`Cair na casa de um rival o faz voltar ${PUSH_BACK} casas.`} />
            <Switch checked={config.catchUp} onChange={(catchUp) => setConfig((current) => ({ ...current, catchUp }))} label="Ajuda ao último colocado" description="Quem está muito atrás ganha +1 no dado." />
          </div>

          <section className="rounded-3xl bg-surface-2 p-4 text-sm font-semibold text-muted" aria-label="Resumo">
            <p className="text-ink">
              {scenario?.name} · {config.size} casas · {players.length} jogadores
            </p>
            <p>
              {players.map((player) => `${player.pawn} ${player.name}${player.bot ? ' 🤖' : ''}`).join('  ')}
            </p>
          </section>
          {startError ? <Alert tone="danger">{startError}</Alert> : null}
        </div>
      ) : null}
    </Modal>
  );
}

type PlayerErrors = { byId: Record<string, string>; general: string | null };

/** Nome preenchido e único, peões diferentes, de 2 a 6 na mesa e pelo menos uma pessoa. */
export function validatePlayers(players: SetupPlayer[]): PlayerErrors {
  const byId: Record<string, string> = {};
  const seen = new Set<string>();
  for (const player of players) {
    const name = player.name.trim();
    const key = name.toLocaleLowerCase('pt-BR');
    if (!name) byId[player.id] = 'Escreva o nome do jogador.';
    else if (seen.has(key)) byId[player.id] = 'Já existe alguém com este nome.';
    seen.add(key);
  }
  let general: string | null = null;
  if (players.length < MIN_PLAYERS) general = `São necessários pelo menos ${MIN_PLAYERS} jogadores.`;
  else if (players.every((player) => player.bot)) general = 'Coloque pelo menos uma pessoa na mesa.';
  return { byId, general };
}
