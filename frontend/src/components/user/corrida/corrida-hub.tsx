import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import FaceRoundedIcon from '@mui/icons-material/FaceRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { LoadingState } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { BOT_LEVELS, type BotLevel } from '@runner/bots';
import { LOCAL_KEYS, planSlots, uniqueNames } from '@runner/local';
import { levelSeconds } from '@runner/journey';
import { DEFAULT_DIFFICULTY, difficultyLabel, isCharacterUnlocked, isLevelUnlocked, isScenarioUnlocked, type Scenario } from '@runner/campaign';
import { BASE_LEVELS } from '@runner/levels';
import { useRunnerCampaign } from '@/components/user/corrida/corrida-campaign';
import type { Level } from '@runner/types';
import type { CorridaResult, CorridaRival } from '@/components/user/corrida/corrida-game';
import { CampaignMap, type MapStop } from '@/components/user/corrida/corrida-map';
import { CorridaLocal, PlayerChip, type LocalPlayer } from '@/components/user/corrida/corrida-local';
import { CorridaRoom } from '@/components/user/corrida/corrida-room';
import { createRunnerRoom, joinRunnerRoom, myRunnerRoom, PENDING_RUNNER_EVENT, takePendingRunnerRoom, type RunnerRoomView } from '@/lib/runner-room-api';
import { usePwa } from '@/components/pwa/pwa-provider';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useRunnerProgress } from '@/components/user/corrida/corrida-progress';
import { portraitOf, rivalsFor, saveCharacter, storedCharacterId, useRunnerCharacters, type RunnerCharacter } from '@/components/user/corrida/corrida-characters';
import { SpriteView } from '@/components/user/corrida/sprite-view';

const CorridaGame = lazy(() => import('@/components/user/corrida/corrida-game').then((m) => ({ default: m.CorridaGame })));

type Tab = 'campaign' | 'free' | 'multi' | 'characters';
/** Como a partida começou: campanha (vale para o melhor resultado), treino, assistindo um bot ou corrida contra bots. */
type Playing = { level: Level; mode: 'campaign' | 'practice' | 'watch' | 'race' | 'local'; rivals?: CorridaRival[]; players?: LocalPlayer[] };

const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: 'campaign', label: 'Campanha', icon: <MapRoundedIcon fontSize="small" /> },
  { id: 'free', label: 'Livre', icon: <SportsEsportsRoundedIcon fontSize="small" /> },
  { id: 'multi', label: 'Multi', icon: <GroupsRoundedIcon fontSize="small" /> },
  { id: 'characters', label: 'Personagens', icon: <FaceRoundedIcon fontSize="small" /> },
];

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  return total >= 60 ? `${Math.floor(total / 60)} min${total % 60 ? ` ${total % 60} s` : ''}` : `${total} s`;
}

type Bests = ReturnType<typeof useRunnerProgress>['bests'];

function bestText(best: Bests[string] | undefined, totalWords: number) {
  if (!best) return 'Ainda não jogada';
  const words = totalWords > 0 ? ` · ${best.words}/${totalWords} palavras` : '';
  if (best.finished) return `Concluída${words}`;
  return `Melhor: ${Math.floor(best.progress * 100)}%${words}`;
}

function levelInfo(level: Level) {
  return `${formatDuration(levelSeconds(level))}${level.verse ? ` · versículo escondido (${level.verse.ref})` : ''}`;
}

const CONTROLS: Array<{ title: string; text: string }> = [
  { title: 'Corrida', text: 'Toque (ou segure) para pular. Toque de novo no ar para o pulo duplo.' },
  { title: 'Voo', text: 'Segure para subir e solte para descer.' },
  { title: 'Gravidade', text: 'Toque no chão ou no teto para inverter a gravidade.' },
];

/** Aba do modo Corrida: Campanha (solo), Livre (sem valer nada), Bots, Multijogador e Personagens. Protótipo: sem arte, sem servidor. */
export function CorridaHub() {
  const [tab, setTab] = useState<Tab>('campaign');
  const [playing, setPlaying] = useState<Playing | null>(null);
  const { bests, finished, submit, pendingCount } = useRunnerProgress();
  const toast = useToast();
  const { scenarios, levels: campaignLevels } = useRunnerCampaign();
  const levels = useMemo(() => [...BASE_LEVELS, ...campaignLevels], [campaignLevels]);
  const allCharacters = useRunnerCharacters();
  // Só entram na escolha (e nos rivais) os personagens já abertos pela campanha.
  const characters = allCharacters.filter((item) => isCharacterUnlocked(item.unlockLevel, finished));
  const [selectedId, setSelectedId] = useState<string | null>(storedCharacterId);
  // O escolhido pode ter sumido do Painel (desativado) ou estar fechado: volta ao primeiro da lista.
  const character = characters.find((item) => item.id === selectedId) ?? characters[0] ?? allCharacters[0];
  const portrait = portraitOf(character.sprites);
  // Sala online aberta nesta tela (a pessoa pode sair da tela sem sair da sala e voltar depois).
  const [room, setRoom] = useState<RunnerRoomView | null>(null);

  // Sala pedida por link de convite (/corrida/CÓDIGO): entra assim que o hub abre.
  const characterId = character.id;
  const openPending = useCallback(async () => {
    const code = takePendingRunnerRoom();
    if (!code) return;
    setTab('multi');
    try {
      setRoom(await joinRunnerRoom(code, characterId));
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível entrar na sala.'));
    }
  }, [characterId, toast]);
  useEffect(() => {
    void openPending();
    const listener = () => void openPending();
    window.addEventListener(PENDING_RUNNER_EVENT, listener);
    return () => window.removeEventListener(PENDING_RUNNER_EVENT, listener);
  }, [openPending]);

  function choose(next: RunnerCharacter) {
    setSelectedId(next.id);
    saveCharacter(next.id);
  }

  return (
    <section className="space-y-4" aria-label="Corrida">
      <Alert tone="info">Use o celular deitado (no computador, a barra de espaço).{pendingCount > 0 ? ` ${pendingCount === 1 ? '1 partida' : `${pendingCount} partidas`} da campanha aguardando conexão para ser conferida${pendingCount === 1 ? '' : 's'}.` : ''}</Alert>

      {room ? (
        <CorridaRoom initial={room} levels={levels} allCharacters={allCharacters} choices={characters} onExit={() => setRoom(null)} />
      ) : (
        <>
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <SpriteView url={portrait?.url} frames={portrait?.frames} fps={portrait?.fps} color={character.color} size={40} />
          <p className="truncate text-sm font-bold text-ink">Seu corredor: {character.name}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setTab('characters')}>
          Trocar
        </Button>
      </div>

      <div role="tablist" aria-label="Partes do modo" className="grid grid-cols-5 gap-1 rounded-2xl bg-surface-3 p-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 font-display text-[11px] font-semibold transition sm:flex-row sm:gap-1.5 sm:text-sm',
              tab === item.id ? 'bg-surface text-ink shadow-[0_2px_0_var(--edge-strong)]' : 'text-muted hover:text-ink',
            )}
          >
            {item.icon}
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'campaign' ? <CampaignTab scenarios={scenarios} levels={levels} bests={bests} finished={finished} characters={allCharacters} onPlay={(level) => setPlaying({ level, mode: 'campaign' })} /> : null}
      {tab === 'free' ? (
        <FreeTab levels={levels} bests={bests} characters={characters} character={character} onPlay={(level, mode) => setPlaying({ level, mode })} onRace={(level, rivals) => setPlaying({ level, mode: 'race', rivals })} />
      ) : null}
      {tab === 'multi' ? <MultiTab levels={levels} characters={characters} character={character} onStartLocal={(level, players) => setPlaying({ level, mode: 'local', players })} onOpenRoom={setRoom} /> : null}
      {tab === 'characters' ? <CharactersTab levels={levels} characters={allCharacters} finished={finished} character={character} onChoose={choose} /> : null}

        </>
      )}

      {playing?.mode === 'local' && playing.players ? (
        <CorridaLocal level={playing.level} players={playing.players} onExit={() => setPlaying(null)} />
      ) : null}
      {playing && playing.mode !== 'local' ? (
        <Suspense fallback={<LoadingState />}>
          <CorridaGame
            level={playing.level}
            character={character}
            practice={playing.mode === 'practice'}
            autopilot={playing.mode === 'watch' ? { skill: 1, lag: 2 } : undefined}
            rivals={playing.mode === 'race' ? playing.rivals : undefined}
            onResult={(result: CorridaResult) => {
              // O servidor repete os toques e guarda o melhor resultado (sem internet, fica numa fila e vai quando voltar).
              submit(playing.level.id, result.segments, { progress: result.progress, words: result.words, finished: result.finished, clean: result.clean });
              // Concluir uma fase pode abrir personagens novos: avisa na hora.
              const after = new Set(finished);
              if (result.finished) after.add(playing.level.id);
              for (const item of allCharacters) if (!isCharacterUnlocked(item.unlockLevel, finished) && isCharacterUnlocked(item.unlockLevel, after)) toast.success(`Personagem novo: ${item.name}!`);
            }}
            onExit={() => setPlaying(null)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}

function Controls() {
  return (
    <ul className="grid gap-3 sm:grid-cols-3">
      {CONTROLS.map((control) => (
        <li key={control.title} className="panel p-4">
          <p className="font-display text-base font-bold text-ink">{control.title}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{control.text}</p>
        </li>
      ))}
    </ul>
  );
}

/** Capa do cenário (imagem do Painel); sem imagem, o céu do cenário em degradê. */
function ScenarioCover({ scenario, className, locked = false }: { scenario: Scenario; className?: string; locked?: boolean }) {
  const cover = scenario.art?.cover;
  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-2xl border-2 border-edge', className)} style={{ background: `linear-gradient(${scenario.theme.skyTop}, ${scenario.theme.skyBottom})` }}>
      {cover ? <img src={cover} alt={`Capa do cenário ${scenario.name}`} className={cn('h-full w-full object-cover', locked && 'grayscale')} loading="lazy" /> : null}
      {locked ? (
        <span className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-black/60 text-white">
          <LockRoundedIcon fontSize="small" />
        </span>
      ) : null}
    </div>
  );
}

/** Campanha solo: cenários (lugares da Bíblia) com várias fases cada; a fase seguinte abre ao concluir a anterior e cada cenário abre ao concluir o anterior. */
function CampaignTab({ scenarios: scenarioList, levels: allLevels, bests, finished, characters, onPlay }: { scenarios: Scenario[]; levels: Level[]; bests: Bests; finished: ReadonlySet<string>; characters: RunnerCharacter[]; onPlay: (level: Level) => void }) {
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const scenario = scenarioList.find((item) => item.id === scenarioId) ?? null;
  const scenarios = usePagination(scenarioList, 10);
  const levels = usePagination(scenario?.levels ?? [], 10);
  const unlocksOf = (levelId: string) => characters.filter((item) => item.unlockLevel === levelId).map((item) => item.name);

  if (scenario) {
    return (
      <div className="space-y-4">
        <Button size="sm" variant="ghost" onClick={() => setScenarioId(null)}>
          ← Cenários
        </Button>
        <ScenarioCover scenario={scenario} className="mx-auto max-w-xl" />
        <div>
          <h3 className="font-display text-xl font-bold text-ink">{scenario.name}</h3>
          <p className="text-sm font-semibold text-muted">{scenario.story}</p>
        </div>
        <Alert tone="info">Conclua cada fase para abrir a próxima. O servidor guarda o seu melhor resultado na conta depois de conferir a partida. Cada fase vale até 3 estrelas: terminar, pegar todas as palavras e terminar sem cair (voltar a um checkpoint tira esta).</Alert>
        <CampaignMap
          accent={scenario.theme.skyBottom}
          stops={levels.pageItems.flatMap((def): MapStop[] => {
            const level = allLevels.find((item) => item.id === def.id);
            if (!level) return [];
            const best = bests[def.id];
            const total = level.verse?.words.length ?? 0;
            return [
              {
                id: def.id,
                number: scenario.levels.indexOf(def) + 1,
                name: level.name,
                info: `${levelInfo(level)} · ${difficultyLabel(def.difficulty ?? DEFAULT_DIFFICULTY)}`,
                result: bestText(best, total),
                unlocked: isLevelUnlocked(def.id, finished, scenarioList),
                finished: best?.finished === true,
                stars: best?.finished ? { allWords: best.words >= total, clean: best.clean } : null,
                prize: unlocksOf(def.id),
              },
            ];
          })}
          onPlay={(id) => {
            const level = allLevels.find((item) => item.id === id);
            if (level) onPlay(level);
          }}
        />
        <Pagination page={levels.page} totalPages={levels.totalPages} totalElements={levels.totalElements} pageSize={levels.pageSize} onPageChange={levels.setPage} onPageSizeChange={levels.setPageSize} itemLabel="fases" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">Cada cenário é um lugar da Bíblia com várias fases. Concluir fases abre personagens novos, e concluir o cenário inteiro abre o próximo.</Alert>
      <ul className="space-y-3">
        {scenarios.pageItems.map((item: Scenario) => {
          const unlocked = isScenarioUnlocked(item.id, finished, scenarioList);
          const done = item.levels.filter((def) => finished.has(def.id)).length;
          const prizes = item.levels.flatMap((def) => unlocksOf(def.id));
          return (
            <li key={item.id} className={cn('panel space-y-2 p-4', !unlocked && 'opacity-70')} style={unlocked ? { borderLeft: `6px solid ${item.theme.skyBottom}` } : undefined}>
              <ScenarioCover scenario={item} className="max-w-xl" locked={!unlocked} />
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-bold text-ink">{item.name}</p>
                  <p className="text-sm font-semibold text-muted">{item.story}</p>
                </div>
                {unlocked ? null : <LockRoundedIcon className="text-muted" />}
              </div>
              <p className="text-sm font-bold text-ink">
                {done}/{item.levels.length} fases{prizes.length > 0 ? ` · personagens: ${prizes.join(', ')}` : ''}
              </p>
              <Button disabled={!unlocked} onClick={() => setScenarioId(item.id)}>
                {unlocked ? 'Abrir cenário' : 'Conclua o cenário anterior'}
              </Button>
            </li>
          );
        })}
      </ul>
      <Pagination page={scenarios.page} totalPages={scenarios.totalPages} totalElements={scenarios.totalElements} pageSize={scenarios.pageSize} onPageChange={scenarios.setPage} onPageSizeChange={scenarios.setPageSize} itemLabel="cenários" />
    </div>
  );
}

type FreeMode = 'practice' | 'watch' | 'race';

/** Livre: jogar sem valer nada, tudo numa aba só. Escolha a fase e como jogar: treinar sozinho, ver um bot jogar ou correr contra de 1 a 3 bots (quem cai volta ao último checkpoint; vence quem cruzar a linha primeiro). */
function FreeTab({
  levels,
  bests,
  characters,
  character,
  onPlay,
  onRace,
}: {
  levels: Level[];
  bests: Bests;
  characters: RunnerCharacter[];
  character: RunnerCharacter;
  onPlay: (level: Level, mode: 'practice' | 'watch') => void;
  onRace: (level: Level, rivals: CorridaRival[]) => void;
}) {
  const [levelId, setLevelId] = useState(levels[0].id);
  const [mode, setMode] = useState<FreeMode>('practice');
  const [count, setCount] = useState<'1' | '2' | '3'>('2');
  const [difficulty, setDifficulty] = useState<BotLevel>('STUDENT');
  const level = levels.find((item) => item.id === levelId) ?? levels[0];
  const mine = portraitOf(character.sprites);
  // Os rivais são os outros personagens, na ordem da lista (com os sprites deles).
  const rivals: CorridaRival[] = rivalsFor(characters, character.id, Number(count)).map((item) => ({ name: item.name, color: item.color, sprites: item.sprites, skill: BOT_LEVELS[difficulty].skill, lag: BOT_LEVELS[difficulty].lag }));
  const hint: Record<FreeMode, string> = {
    practice: 'Treine à vontade: qualquer fase, com checkpoints, e nada disso conta para o seu melhor resultado.',
    watch: 'Um bot joga a fase inteira enquanto você assiste e aprende os caminhos.',
    race: 'Corra contra os bots na mesma tela. Quem cai volta sozinho ao último checkpoint, e vence quem cruzar a linha de chegada primeiro. Sem XP nem moedas.',
  };

  return (
    <div className="space-y-4">
      <Alert tone="info">{hint[mode]}</Alert>
      <Controls />
      <div className="panel space-y-4 p-4">
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Fase</p>
          <Select value={levelId} onChange={setLevelId} options={levels.map((item) => ({ value: item.id, label: item.name, description: levelInfo(item) }))} searchable aria-label="Fase" />
          <p className="text-sm font-bold text-ink">{bestText(bests[level.id], level.verse?.words.length ?? 0)}</p>
        </div>
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Como jogar</p>
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: 'practice', label: 'Treinar' },
              { value: 'watch', label: 'Ver um bot' },
              { value: 'race', label: 'Contra bots' },
            ]}
            aria-label="Como jogar"
          />
        </div>
        {mode === 'race' ? (
          <>
            <div className="space-y-1.5">
              <p className="font-display text-sm font-bold text-ink">Quantos bots</p>
              <Segmented value={count} onChange={setCount} options={[{ value: '1', label: '1 bot' }, { value: '2', label: '2 bots' }, { value: '3', label: '3 bots' }]} aria-label="Quantidade de bots" />
            </div>
            <div className="space-y-1.5">
              <p className="font-display text-sm font-bold text-ink">Dificuldade dos bots</p>
              <Segmented
                value={difficulty}
                onChange={setDifficulty}
                options={(Object.keys(BOT_LEVELS) as BotLevel[]).map((value) => ({ value, label: BOT_LEVELS[value].label }))}
                aria-label="Dificuldade dos bots"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-muted">
              <span className="flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-ink">
                <SpriteView url={mine?.url} frames={mine?.frames} fps={mine?.fps} color={character.color} size={22} />
                Você ({character.name})
              </span>
              {rivals.map((rival) => (
                <span key={rival.name} className="flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-ink">
                  <SpriteView url={portraitOf(rival.sprites ?? {})?.url} frames={portraitOf(rival.sprites ?? {})?.frames} fps={portraitOf(rival.sprites ?? {})?.fps} color={rival.color} size={22} />
                  {rival.name}
                </span>
              ))}
            </div>
          </>
        ) : null}
        <Button size="lg" className="w-full" onClick={() => (mode === 'race' ? onRace(level, rivals) : onPlay(level, mode))}>
          {mode === 'practice' ? 'Treinar' : mode === 'watch' ? 'Ver o bot jogar' : 'Largar!'}
        </Button>
      </div>
    </div>
  );
}

/** Multijogador: local (até 4 na mesma tela) e online (até 4 jogadores). Chegam nas etapas 6 e 7 do cronograma. */
function MultiTab({ levels, characters, character, onStartLocal, onOpenRoom }: { levels: Level[]; characters: RunnerCharacter[]; character: RunnerCharacter; onStartLocal: (level: Level, players: LocalPlayer[]) => void; onOpenRoom: (view: RunnerRoomView) => void }) {
  const [total, setTotal] = useState<'2' | '3' | '4'>('2');
  const [humans, setHumans] = useState<'1' | '2' | '3' | '4'>('2');
  const [levelId, setLevelId] = useState(levels[0].id);
  const [difficulty, setDifficulty] = useState<BotLevel>('STUDENT');
  // Personagem de cada humano (o 1º começa com o escolhido no app; os outros, nos seguintes da lista).
  const [picks, setPicks] = useState<string[]>([]);
  const level = levels.find((item) => item.id === levelId) ?? levels[0];
  const humanCount = Math.min(Number(humans), Number(total));
  const kinds = planSlots(humanCount, Number(total));
  const chosen = (index: number) => {
    const saved = characters.find((item) => item.id === picks[index]);
    if (saved) return saved;
    const order = [character, ...characters.filter((item) => item.id !== character.id)];
    return order[index % order.length] ?? character;
  };
  const humanChars = Array.from({ length: humanCount }, (_, index) => chosen(index));
  // Os bots são outros personagens (que não estão em uso por humanos), com a dificuldade escolhida.
  const used = new Set(humanChars.map((item) => item.id));
  const botPool = rivalsFor(characters, humanChars[0].id, 8).filter((item) => !used.has(item.id));
  const botChars = kinds.slice(humanCount).map((_, index) => botPool[index % Math.max(1, botPool.length)] ?? humanChars[0]);
  const names = uniqueNames([...humanChars, ...botChars].map((item) => item.name));
  const players: LocalPlayer[] = [...humanChars.map((item) => ({ ...item, human: true })), ...botChars.map((item) => ({ ...item, human: false }))].map((item, index) => ({
    name: names[index],
    color: item.color,
    sprites: item.sprites,
    sounds: item.sounds,
    human: item.human,
    skill: BOT_LEVELS[difficulty].skill,
    lag: BOT_LEVELS[difficulty].lag,
  }));
  const characterOptions = characters.map((item) => ({ value: item.id, label: item.name }));

  return (
    <div className="space-y-4">
      <Alert tone="info">Corrida no mesmo aparelho: a tela deitada se divide em uma faixa para cada jogador, e cada um toca na sua (vários dedos ao mesmo tempo). Os bots completam as vagas. Sem XP nem moedas.</Alert>
      <div className="panel space-y-4 p-4">
        <p className="font-display text-lg font-bold text-ink">No mesmo aparelho</p>
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Fase</p>
          <Select value={levelId} onChange={setLevelId} options={levels.map((item) => ({ value: item.id, label: item.name, description: levelInfo(item) }))} aria-label="Fase da corrida" />
        </div>
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Quantos corredores na tela</p>
          <Segmented
            value={total}
            onChange={(value) => {
              setTotal(value);
              if (Number(humans) > Number(value)) setHumans(value as '2' | '3' | '4');
            }}
            options={[{ value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' }]}
            aria-label="Quantidade de corredores"
          />
        </div>
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Quantos são pessoas (o resto são bots)</p>
          <Segmented
            value={String(humanCount) as '1' | '2' | '3' | '4'}
            onChange={setHumans}
            options={(['1', '2', '3', '4'] as const).filter((value) => Number(value) <= Number(total)).map((value) => ({ value, label: value }))}
            aria-label="Quantidade de pessoas"
          />
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {humanChars.map((item, index) => (
            <li key={index} className="space-y-1.5">
              <p className="font-display text-sm font-bold text-ink">
                Jogador {index + 1} <span className="font-semibold text-muted">(tecla {LOCAL_KEYS[index].replace('Digit', '')} no computador)</span>
              </p>
              <Select
                value={item.id}
                onChange={(id) => setPicks((current) => Object.assign([...current], { [index]: id }))}
                options={characterOptions}
                searchable
                aria-label={`Personagem do jogador ${index + 1}`}
              />
            </li>
          ))}
        </ul>
        {humanCount < Number(total) ? (
          <div className="space-y-1.5">
            <p className="font-display text-sm font-bold text-ink">Dificuldade dos bots</p>
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={(Object.keys(BOT_LEVELS) as BotLevel[]).map((value) => ({ value, label: BOT_LEVELS[value].label }))}
              aria-label="Dificuldade dos bots"
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {players.map((player, index) => (
            <PlayerChip key={`${player.name}-${index}`} name={player.name} color={player.color} sprites={player.sprites} suffix={player.human ? undefined : '(bot)'} />
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={() => onStartLocal(level, players)}>
          Montar a largada
        </Button>
      </div>
      <OnlineRooms levels={levels} character={character} onOpenRoom={onOpenRoom} />
    </div>
  );
}

/** Corrida online com amigos: criar uma sala (fase + personagem), entrar por código ou voltar à sala em que a pessoa já está. */
function OnlineRooms({ levels, character, onOpenRoom }: { levels: Level[]; character: RunnerCharacter; onOpenRoom: (view: RunnerRoomView) => void }) {
  const toast = useToast();
  const { isOnline } = usePwa();
  const [levelId, setLevelId] = useState(levels[0].id);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'create' | 'join' | 'back' | null>(null);
  const [current, setCurrent] = useState<{ code: string } | null>(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    myRunnerRoom()
      .then((found) => setCurrent(found ? { code: found.code } : null))
      .catch(() => setCurrent(null));
  }, []);

  async function create() {
    setBusy('create');
    try {
      onOpenRoom(await createRunnerRoom({ levelSlug: levelId, characterSlug: character.id }));
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível criar a sala.'));
    } finally {
      setBusy(null);
    }
  }

  async function join(roomCode: string, mode: 'join' | 'back') {
    const clean = roomCode.trim().toUpperCase();
    if (clean.length < 4) {
      setCodeError('Digite o código da sala (5 letras ou números).');
      return;
    }
    setCodeError(null);
    setBusy(mode);
    try {
      onOpenRoom(await joinRunnerRoom(clean, character.id));
    } catch (reason) {
      const message = errorMessage(reason, 'Não foi possível entrar na sala.');
      if (mode === 'join') setCodeError(message);
      else toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="panel space-y-4 p-4">
      <p className="font-display text-lg font-bold text-ink">Online com amigos</p>
      <p className="text-sm font-semibold text-muted">Crie uma sala, convide até 3 amigos por código ou link e corram juntos na mesma fase. Os bots completam as vagas. Cada um corre no seu aparelho e o servidor confere o tempo.</p>
      {!isOnline ? <Alert tone="info">A corrida online precisa de internet.</Alert> : null}
      {current ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-3 p-3">
          <p className="min-w-0 flex-1 text-sm font-bold text-ink">
            Você está na sala <span className="tracking-widest">{current.code}</span>
          </p>
          <Button size="sm" onClick={() => void join(current.code, 'back')} loading={busy === 'back'} disabled={!isOnline}>
            Voltar à sala
          </Button>
        </div>
      ) : null}
      <div className="space-y-1.5">
        <p className="font-display text-sm font-bold text-ink">Fase</p>
        <Select value={levelId} onChange={setLevelId} options={levels.map((item) => ({ value: item.id, label: item.name, description: levelInfo(item) }))} aria-label="Fase da corrida online" searchable />
      </div>
      <Button size="lg" className="w-full" onClick={() => void create()} loading={busy === 'create'} disabled={!isOnline}>
        Criar sala
      </Button>
      <Field label="Tem um código?" error={codeError ?? undefined} htmlFor="runner-room-code">
        <div className="flex gap-2">
          <Input id="runner-room-code" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={8} placeholder="ABCDE" className="tracking-widest" />
          <Button variant="secondary" onClick={() => void join(code, 'join')} loading={busy === 'join'} disabled={!isOnline}>
            Entrar
          </Button>
        </div>
      </Field>
    </div>
  );
}

/** Personagens: escolha o corredor. Todos correm igual; muda só a aparência (sprites e sons vêm do Painel na etapa 3; na campanha, cada novo se abre ao concluir uma fase). */
function CharactersTab({ levels, characters, finished, character, onChoose }: { characters: RunnerCharacter[]; levels: Level[]; finished: ReadonlySet<string>; character: RunnerCharacter; onChoose: (character: RunnerCharacter) => void }) {
  const list = usePagination(characters, 8);
  return (
    <div className="space-y-4">
      <Alert tone="info">Todos os personagens correm igual: o que muda é só a aparência e os sons. Na campanha, personagens novos abrem conforme você conclui as fases de cada cenário.</Alert>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.pageItems.map((item) => {
          const selected = item.id === character.id;
          const open = isCharacterUnlocked(item.unlockLevel, finished);
          const lockedBy = levels.find((level) => level.id === item.unlockLevel)?.name;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChoose(item)}
                disabled={!open}
                aria-pressed={selected}
                className={cn('flex h-full w-full flex-col items-center gap-2 rounded-2xl border-2 bg-surface p-3 text-center transition', !open && 'opacity-60', selected ? 'border-primary shadow-md' : 'border-edge hover:border-primary/60')}
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: `${item.color}33` }}>
                  <SpriteView url={portraitOf(item.sprites)?.url} frames={portraitOf(item.sprites)?.frames} fps={portraitOf(item.sprites)?.fps} color={item.color} size={72} />
                </span>
                <span className="font-display text-base font-bold text-ink">{item.name}</span>
                <span className="text-xs font-semibold text-muted">{item.text}</span>
                {open ? null : (
                  <span className="flex items-center gap-1 text-xs font-bold text-ink">
                    <LockRoundedIcon sx={{ fontSize: 14 }} /> Conclua a fase “{lockedBy ?? item.unlockLevel}”
                  </span>
                )}
                {selected ? <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-on-primary">Escolhido</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="personagens" />
    </div>
  );
}
