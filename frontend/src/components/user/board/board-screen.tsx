import { useState, type ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import {
  POWER_UPS,
  TARGETED_POWERS,
  catchUpBonus,
  currentPlayer,
  powerTargets,
  usablePowerUps,
  type BoardState,
  type OptionLetter,
  type PowerUpKind,
} from '@board/engine';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import { quizBackgroundStyle } from '@/lib/quiz-background';
import { BoardHelp } from '@/components/user/board/board-help';
import { BoardResult } from '@/components/user/board/board-result';
import { Dice } from '@/components/user/board/dice';
import { BoardTrack, Pawn } from '@/components/user/board/board-track';
import type { Landmark, PathStyle } from '@board/layout';
import { QuestionSheet, type Reveal, type SheetQuestion } from '@/components/user/board/board-question';

export type BoardTheme = {
  name: string;
  color: string | null;
  background: string | null;
  boardImage: string | null;
  pathStyle?: PathStyle | null;
  landmarks?: Landmark[] | null;
};

type BoardScreenProps = {
  theme: BoardTheme;
  state: BoardState;
  log: string[];
  flash: number[];
  /** Pergunta aberta (a do `state.pending`), quando já chegou. */
  question: SheetQuestion | null;
  reveal: Reveal | null;
  /**
   * Quem opera os botões: "local" = o aparelho joga pelo humano da vez; um id = só aquele jogador (online).
   * Os demais só acompanham.
   */
  controlledBy: 'local' | string;
  rolling: boolean;
  face: number | null;
  /** Online: a ação foi enviada e o servidor ainda não respondeu. */
  busy?: boolean;
  /** Online: tempo do servidor. */
  deadlineAt?: number | null;
  clockOffset?: number;
  /** Etiqueta ao lado do nome do cenário (ex.: o código da sala). */
  badge?: ReactNode;
  /** Faixa de aviso acima do tabuleiro (ex.: sem conexão). */
  notice?: ReactNode;
  /** Texto de "passe o aparelho" só faz sentido com mais de uma pessoa no mesmo aparelho. */
  sharedDevice?: boolean;
  onRoll: () => void;
  onAnswer: (selected: OptionLetter | null) => void;
  onContinue: () => void;
  onPower: (kind: PowerUpKind, targetId?: string) => void;
  onTrial: (accept: boolean) => void;
  onLeave: () => void;
  /** Fim da partida: voltar e revanche. */
  onExit: () => void;
  onRematch: () => Promise<void>;
  canRematch?: boolean;
  resultNote?: ReactNode;
};

/**
 * A tela da partida (trilha, jogadores, pergunta, dado, mochila e pódio). É a mesma no modo local e no online:
 * quem a usa decide de onde vêm os dados e o que cada botão faz.
 */
export function BoardScreen(props: BoardScreenProps) {
  const { theme, state, log, flash, question, reveal, controlledBy, rolling, face, busy = false, deadlineAt, clockOffset, badge, notice, sharedDevice = false } = props;
  const [helpOpen, setHelpOpen] = useState(false);
  /** Power-up com alvo (Cajado, Rede) esperando a escolha do rival. */
  const [picking, setPicking] = useState<PowerUpKind | null>(null);

  const finished = state.phase === 'FINISHED';
  const player = currentPlayer(state);
  const isBot = Boolean(player.bot);
  const mine = controlledBy === 'local' ? !isBot : player.id === controlledBy;
  const pending = state.pending;
  const usable = mine ? usablePowerUps(state) : [];
  const bonus = state.phase === 'ROLL' && mine ? catchUpBonus(state, player) : 0;
  const steps = state.die !== null ? (state.die + state.bonus) * (state.doubled ? 2 : 1) : null;
  // Há pergunta na mesa sempre que o motor tem uma pendente (movimento, provação, final, muro ou vigília).
  const asking = pending !== null;

  function useFromBar(kind: PowerUpKind) {
    if (TARGETED_POWERS.includes(kind)) setPicking(kind);
    else props.onPower(kind);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={{ ...scenarioThemeVars(theme.color), ...quizBackgroundStyle(theme.background) }}
      role="dialog"
      aria-modal="true"
      aria-label={`Tabuleiro: ${theme.name}`}
    >
      <header className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={props.onLeave} aria-label="Sair da partida" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
          <CloseRoundedIcon />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-2xl bg-surface/90 px-3 py-1.5">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold leading-tight text-ink">{theme.name}</p>
            <p className="text-xs font-semibold text-muted">Rodada {state.round}</p>
          </div>
          {badge}
        </div>
        <button type="button" onClick={() => setHelpOpen(true)} aria-label="Como jogar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
          <HelpOutlineRoundedIcon />
        </button>
      </header>

      <ul className="mx-auto flex w-full max-w-2xl shrink-0 gap-2 overflow-x-auto px-3 pb-2" aria-label="Jogadores">
        {state.players.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl border-2 bg-surface/90 px-2.5 py-1.5',
              !finished && item.id === player.id ? 'border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_30%,transparent)]' : 'border-edge',
            )}
          >
            <Pawn emoji={item.pawn} className="text-2xl" />
            <div className="min-w-0 leading-tight">
              <p className="max-w-[7rem] truncate font-display text-sm font-bold text-ink">
                {item.name}
                {item.bot ? ' 🤖' : ''}
                {controlledBy !== 'local' && item.id === controlledBy ? ' (você)' : ''}
              </p>
              <p className="text-[11px] font-semibold text-muted">
                Casa {item.position}/{state.config.size}
                {item.powerUps.length > 0 ? ` · ${item.powerUps.map((kind) => POWER_UPS[kind].emoji).join('')}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {notice}

      {state.storm || state.hazard ? (
        <div className="mx-auto flex w-full max-w-2xl shrink-0 flex-wrap gap-2 px-3 pb-2" aria-label="Condições do cenário">
          {state.storm ? <span className="rounded-full bg-info/20 px-3 py-1 text-xs font-bold text-ink">⛈️ Tempestade: quem erra é levado para trás</span> : null}
          {state.hazard ? (
            <span className="rounded-full bg-info/20 px-3 py-1 text-xs font-bold text-ink">
              {state.hazard.emoji} {state.hazard.name}: casas marcadas recuam {state.rules.hazard?.penalty ?? 2}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <BoardTrack state={state} flash={flash} image={theme.boardImage} pathStyle={theme.pathStyle} landmarks={theme.landmarks} />
        {log.length > 0 ? (
          <ul className="mx-auto my-3 max-w-xl space-y-0.5 px-4 text-xs font-semibold text-muted" aria-label="Últimas jogadas" aria-live="polite">
            {log.slice(-4).map((line, index, all) => (
              <li key={`${log.length}-${index}`} className={index === all.length - 1 ? 'text-ink' : undefined}>
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mx-auto max-h-[78dvh] w-full max-w-2xl shrink-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {finished ? null : asking && question && pending ? (
          <div className="space-y-2 px-2">
            {steps !== null && pending.kind === 'MOVE' ? (
              <div className="flex items-center gap-3 rounded-2xl bg-surface/95 px-3 py-2">
                <Dice value={state.die} size={40} />
                <p className="text-sm font-semibold text-ink">
                  Acertando, {player.name} anda <b>{steps}</b> {steps === 1 ? 'casa' : 'casas'}
                  {state.bonus ? ' (com ajuda)' : ''}
                  {state.doubled ? ' (dobrado)' : ''}.
                </p>
              </div>
            ) : null}
            <QuestionSheet
              // Na vigília a mesma pergunta passa por vários jogadores: cada um começa com cronômetro e escolha zerados.
              key={`${question.id}-${player.id}`}
              question={question}
              kind={pending.kind}
              trialName={state.rules.trial.name}
              wall={pending.kind === 'WALL' ? { got: pending.got ?? 0, need: pending.need ?? 2 } : undefined}
              hint={pending.hint}
              playerName={player.name}
              watching={!mine}
              removed={pending.removed}
              seconds={state.config.timeSeconds}
              extraSeconds={pending.extraSeconds}
              deadlineAt={deadlineAt}
              clockOffset={clockOffset}
              reveal={reveal}
              onAnswer={props.onAnswer}
              onContinue={props.onContinue}
            />
            {mine ? <PowerBar state={state} usable={usable} locked={Boolean(reveal) || busy} onUse={useFromBar} /> : null}
          </div>
        ) : pending !== null ? (
          <div className="space-y-2 p-3">
            <Alert tone="info">Carregando a pergunta...</Alert>
            <Spinner />
          </div>
        ) : state.phase === 'TRIAL_OFFER' ? (
          <section className="panel mx-2 animate-fade-up space-y-3 rounded-b-none p-4">
            <p className="font-display text-lg font-bold text-ink">⚔️ {state.rules.trial.name}</p>
            <p className="text-sm font-semibold text-muted">{state.rules.trial.description}</p>
            {mine ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" className="flex-1" onClick={() => props.onTrial(true)} disabled={busy}>
                  Aceitar o desafio
                </Button>
                <Button size="lg" variant="secondary" className="flex-1" onClick={() => props.onTrial(false)} disabled={busy}>
                  Seguir o caminho
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Spinner size="sm" /> {player.name} está decidindo...
              </p>
            )}
          </section>
        ) : (
          <section className="panel mx-2 animate-fade-up space-y-3 rounded-b-none p-4">
            <div className="flex items-center gap-4">
              <Dice value={rolling ? face : state.die} rolling={rolling} size={76} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-display text-lg font-bold text-ink">
                  <Pawn emoji={player.pawn} className="mr-1 text-2xl" />
                  {mine && controlledBy !== 'local' ? 'Sua vez!' : `Vez de ${player.name}`}
                </p>
                <p className="text-sm font-semibold text-muted">
                  {!mine
                    ? isBot
                      ? 'Aguarde a vez dele.'
                      : 'Aguarde a vez dessa pessoa.'
                    : sharedDevice
                      ? 'Passe o aparelho para quem joga agora e role o dado.'
                      : 'Role o dado e responda para avançar.'}
                </p>
                {bonus > 0 ? <p className="text-xs font-bold text-info">Ajuda ao último colocado: +{bonus} no dado</p> : null}
                {state.doubled ? <p className="text-xs font-bold text-primary-strong dark:text-primary">✨ Dado dobrado ativo</p> : null}
              </div>
            </div>
            {mine ? (
              <Button size="xl" className="w-full" onClick={props.onRoll} loading={rolling || busy} data-autofocus>
                {rolling ? 'Rolando...' : 'Rolar o dado'}
              </Button>
            ) : (
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Spinner size="sm" /> {player.name} está jogando...
              </p>
            )}
            {mine ? <PowerBar state={state} usable={usable} locked={rolling || busy} onUse={useFromBar} /> : null}
          </section>
        )}
      </div>

      <Modal open={picking !== null} onClose={() => setPicking(null)} title={picking ? `${POWER_UPS[picking].emoji} ${POWER_UPS[picking].name}` : ''} description="Escolha o rival." size="sm">
        <ul className="space-y-2">
          {picking
            ? state.players
                .filter((item) => powerTargets(state, picking).includes(item.id))
                .map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        props.onPower(picking, item.id);
                        setPicking(null);
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border-2 border-edge bg-surface-2 p-3 text-left transition hover:border-primary"
                    >
                      <Pawn emoji={item.pawn} className="text-3xl" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-base font-bold text-ink">
                          {item.name}
                          {item.bot ? ' 🤖' : ''}
                        </span>
                        <span className="text-xs font-semibold text-muted">Casa {item.position}</span>
                      </span>
                    </button>
                  </li>
                ))
            : null}
        </ul>
      </Modal>

      {finished ? <BoardResult state={state} scenarioName={theme.name} onExit={props.onExit} onRematch={props.onRematch} canRematch={props.canRematch} note={props.resultNote} /> : null}
      <BoardHelp open={helpOpen} rules={state.rules} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/** Mochila do jogador da vez: os ativos acendem quando servem; os escudos se gastam sozinhos. */
function PowerBar({ state, usable, locked, onUse }: { state: BoardState; usable: PowerUpKind[]; locked: boolean; onUse: (kind: PowerUpKind) => void }) {
  const player = currentPlayer(state);
  if (!state.config.powerUps) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Mochila de power-ups">
      <span className="text-xs font-bold text-muted">Mochila:</span>
      {player.powerUps.length === 0 ? <span className="text-xs font-semibold text-muted">vazia (pegue nas casas 🎁)</span> : null}
      {player.powerUps.map((kind, index) => {
        const info = POWER_UPS[kind];
        const enabled = !locked && usable.includes(kind);
        return (
          <Tooltip key={`${kind}-${index}`} content={`${info.name}: ${info.description}${info.passive ? ' (se usa sozinho)' : ''}`}>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => onUse(kind)}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-2xl border-2 px-3 font-display text-sm font-bold transition',
                enabled ? 'border-primary bg-primary/20 text-ink hover:bg-primary/30' : 'border-edge bg-surface-2 text-muted',
                !enabled && !info.passive && 'opacity-60',
              )}
            >
              <span aria-hidden="true">{info.emoji}</span>
              {info.name}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
