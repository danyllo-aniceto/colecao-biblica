import { useCallback, useMemo, useState } from 'react';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import { createGame } from '@board/engine';
import { boardRulesFor } from '@board/scenarios';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { SectionHeading } from '@/components/game/game-ui';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { BoardGame } from '@/components/user/board/board-game';
import { BoardSetupModal, type BoardSetup } from '@/components/user/board/board-setup';
import { fetchBoardQuestions } from '@/lib/board-api';
import { clearLocalBoard, loadLocalBoard, saveLocalBoard, type LocalBoardGame } from '@/lib/board-local';

/** Perguntas por partida: as do tabuleiro e dos jogadores; o motor recomeça o baralho se acabar. */
const questionCount = (size: number, players: number) => Math.min(200, Math.max(40, Math.round(size * players * 0.9)));
const MIN_QUESTIONS = 12;

/** Cartão "Tabuleiro" da aba Jogar: cria uma partida local (um aparelho) ou retoma a que ficou guardada. */
export function BoardHub({ playerName }: { playerName: string }) {
  const { campaign } = useCampaign();
  const dialogs = useDialogs();
  const [setupOpen, setSetupOpen] = useState(false);
  const [game, setGame] = useState<LocalBoardGame | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [saved, setSaved] = useState<LocalBoardGame | null>(() => loadLocalBoard());
  const [lastSetup, setLastSetup] = useState<BoardSetup | null>(null);

  const scenarios = useMemo(() => campaign?.scenarios ?? [], [campaign]);

  /** Sorteia perguntas e tabuleiro e deixa a partida pronta. */
  const build = useCallback(
    async (setup: BoardSetup): Promise<LocalBoardGame> => {
      const scenario = scenarios.find((item) => item.id === setup.scenarioId);
      if (!scenario) throw new Error('Escolha um cenário.');
      const questions = await fetchBoardQuestions({ scenarioId: scenario.id, count: questionCount(setup.config.size, setup.players.length) });
      if (questions.length < MIN_QUESTIONS) throw new Error('Ainda não há perguntas suficientes para uma partida de tabuleiro.');
      const { state } = createGame({
        config: setup.config,
        rules: boardRulesFor(scenario.slug),
        players: setup.players.map((player) => ({ id: player.id, name: player.name, pawn: player.pawn, bot: player.bot })),
        seed: Math.floor(Math.random() * 2 ** 31),
        bank: {
          pool: questions.map((question) => ({ id: question.id, difficulty: question.difficulty })),
          correctOption: (id) => questions.find((question) => question.id === id)?.correctOption ?? 'A',
        },
      });
      return {
        version: 2,
        scenario: { id: scenario.id, slug: scenario.slug, name: scenario.name, color: scenario.color, background: scenario.quizBackgroundUrl ?? null, boardImage: scenario.boardImageUrl ?? null },
        state,
        questions,
        log: [],
        savedAt: Date.now(),
      };
    },
    [scenarios],
  );

  const begin = useCallback((next: LocalBoardGame) => {
    saveLocalBoard(next);
    setSaved(next);
    setGame(next);
    setGameKey((current) => current + 1);
  }, []);

  async function handleStart(setup: BoardSetup) {
    const next = await build(setup);
    setLastSetup(setup);
    setSetupOpen(false);
    begin(next);
  }

  async function handleRematch() {
    // Sem a configuração da sessão (partida retomada), refaz a mesa a partir da partida guardada.
    const base: BoardSetup | null =
      lastSetup ??
      (game
        ? {
            scenarioId: game.scenario.id,
            players: game.state.players.map((player) => ({ id: player.id, name: player.name, pawn: player.pawn, bot: player.bot?.skill ?? null })),
            config: game.state.config,
          }
        : null);
    if (!base) return;
    begin(await build(base));
  }

  function exitGame() {
    setGame(null);
    setSaved(loadLocalBoard());
  }

  async function discard() {
    const ok = await dialogs.confirm({
      title: 'Descartar a partida guardada?',
      message: 'Ela não poderá ser retomada.',
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (!ok) return;
    clearLocalBoard();
    setSaved(null);
  }

  return (
    <section className="space-y-3" aria-label="Tabuleiro">
      <SectionHeading title="Jogue com amigos" subtitle="Partidas sem XP nem moedas: é só diversão." />
      <div className="panel space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet text-white" aria-hidden="true">
            <CasinoRoundedIcon sx={{ fontSize: 32 }} />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-display text-xl font-bold text-ink">Tabuleiro</h3>
            <p className="text-sm font-semibold text-muted">
              Role o dado, responda a pergunta e só anda quem acerta. Chegue primeiro no fim do caminho de um cenário! De 2 a 6 jogadores no mesmo aparelho, com bots para completar a mesa.
            </p>
          </div>
        </div>

        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">
              Partida guardada: <b>{saved.scenario.name}</b> · rodada {saved.state.round} · {saved.state.players.length} jogadores
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="accent" onClick={() => begin(saved)}>
                Continuar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void discard()}>
                Descartar
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={() => setSetupOpen(true)} disabled={scenarios.length === 0}>
            Nova partida
          </Button>
          <span className="text-xs font-semibold text-muted">Online com amigos: em breve.</span>
        </div>
      </div>

      {setupOpen ? (
        <BoardSetupModal
          open
          scenarios={scenarios}
          defaultScenarioId={campaign?.currentScenarioId ?? null}
          playerName={playerName}
          onClose={() => setSetupOpen(false)}
          onStart={handleStart}
        />
      ) : null}

      {game ? <BoardGame key={gameKey} game={game} onExit={exitGame} onRematch={handleRematch} /> : null}
    </section>
  );
}
