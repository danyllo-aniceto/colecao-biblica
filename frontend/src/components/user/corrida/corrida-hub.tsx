import { lazy, Suspense, useState } from 'react';
import type { ReactNode } from 'react';
import FaceRoundedIcon from '@mui/icons-material/FaceRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import SmartToyRoundedIcon from '@mui/icons-material/SmartToyRounded';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { BOT_LEVELS, type BotLevel } from '@runner/bots';
import { TILES_PER_SECOND } from '@runner/journey';
import { LEVELS } from '@runner/levels';
import type { Level } from '@runner/types';
import type { CorridaResult, CorridaRival } from '@/components/user/corrida/corrida-game';
import { loadBests, saveBest } from '@/components/user/corrida/corrida-storage';
import { portraitOf, rivalsFor, saveCharacter, storedCharacterId, useRunnerCharacters, type RunnerCharacter } from '@/components/user/corrida/corrida-characters';
import { SpriteView } from '@/components/user/corrida/sprite-view';

const CorridaGame = lazy(() => import('@/components/user/corrida/corrida-game').then((m) => ({ default: m.CorridaGame })));

type Tab = 'campaign' | 'free' | 'bots' | 'multi' | 'characters';
/** Como a partida começou: campanha (vale para o melhor resultado), treino, assistindo um bot ou corrida contra bots. */
type Playing = { level: Level; mode: 'campaign' | 'practice' | 'watch' | 'race'; rivals?: CorridaRival[] };

/** Ordem da campanha solo (a próxima fase só abre ao concluir a anterior; o progresso com servidor vem na etapa 5). */
const CAMPAIGN_IDS = ['treino', 'jornada'];
const CAMPAIGN = CAMPAIGN_IDS.map((id) => LEVELS.find((level) => level.id === id)).filter((level): level is Level => Boolean(level));

const TABS: Array<{ id: Tab; label: string; icon: ReactNode }> = [
  { id: 'campaign', label: 'Campanha', icon: <MapRoundedIcon fontSize="small" /> },
  { id: 'free', label: 'Livre', icon: <SportsEsportsRoundedIcon fontSize="small" /> },
  { id: 'bots', label: 'Bots', icon: <SmartToyRoundedIcon fontSize="small" /> },
  { id: 'multi', label: 'Multi', icon: <GroupsRoundedIcon fontSize="small" /> },
  { id: 'characters', label: 'Personagens', icon: <FaceRoundedIcon fontSize="small" /> },
];

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  return total >= 60 ? `${Math.floor(total / 60)} min${total % 60 ? ` ${total % 60} s` : ''}` : `${total} s`;
}

type Bests = ReturnType<typeof loadBests>;

function bestText(best: Bests[string] | undefined, totalWords: number) {
  if (!best) return 'Ainda não jogada';
  const words = totalWords > 0 ? ` · ${best.words}/${totalWords} palavras` : '';
  if (best.finished) return `${best.clean ? 'Concluída sem checkpoint ★' : 'Concluída'}${words}`;
  return `Melhor: ${Math.floor(best.progress * 100)}%${words}`;
}

function levelInfo(level: Level) {
  return `${formatDuration(level.length / TILES_PER_SECOND)}${level.verse ? ` · versículo escondido (${level.verse.ref})` : ''}`;
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
  const [bests, setBests] = useState(loadBests);
  const characters = useRunnerCharacters();
  const [selectedId, setSelectedId] = useState<string | null>(storedCharacterId);
  // O escolhido pode ter sumido do Painel (desativado): volta ao primeiro da lista.
  const character = characters.find((item) => item.id === selectedId) ?? characters[0];
  const portrait = portraitOf(character);

  function choose(next: RunnerCharacter) {
    setSelectedId(next.id);
    saveCharacter(next.id);
  }

  return (
    <section className="space-y-4" aria-label="Corrida">
      <Alert tone="info">Protótipo do novo modo: ainda sem o modo online. Use o celular deitado (no computador, a barra de espaço).</Alert>

      <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-3 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <SpriteView url={portrait?.url} frames={portrait?.frames} color={character.color} size={40} />
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

      {tab === 'campaign' ? <CampaignTab bests={bests} onPlay={(level) => setPlaying({ level, mode: 'campaign' })} /> : null}
      {tab === 'free' ? <FreeTab bests={bests} onPlay={(level, mode) => setPlaying({ level, mode })} /> : null}
      {tab === 'bots' ? <BotsTab characters={characters} character={character} onStart={(level, rivals) => setPlaying({ level, mode: 'race', rivals })} /> : null}
      {tab === 'multi' ? <MultiTab /> : null}
      {tab === 'characters' ? <CharactersTab characters={characters} character={character} onChoose={choose} /> : null}

      {playing ? (
        <Suspense fallback={<LoadingState />}>
          <CorridaGame
            level={playing.level}
            character={character}
            practice={playing.mode === 'practice'}
            autopilot={playing.mode === 'watch' ? { skill: 1, lag: 2 } : undefined}
            rivals={playing.mode === 'race' ? playing.rivals : undefined}
            onResult={(result: CorridaResult) => setBests(saveBest(playing.level.id, result))}
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

/** Campanha solo: fases em sequência; a próxima abre ao concluir a anterior. Estrelas, personagens e progresso com servidor vêm nas etapas 3 a 5. */
function CampaignTab({ bests, onPlay }: { bests: Bests; onPlay: (level: Level) => void }) {
  const list = usePagination(CAMPAIGN, 10);
  return (
    <div className="space-y-4">
      <Alert tone="info">Conclua cada fase para abrir a próxima. Aqui o seu melhor resultado fica guardado e as bandeiras (checkpoints) ajudam, mas terminar sem usá-las vale uma estrela ★.</Alert>
      <ol className="space-y-3">
        {list.pageItems.map((level) => {
          const index = CAMPAIGN.indexOf(level);
          const unlocked = index === 0 || bests[CAMPAIGN[index - 1].id]?.finished === true;
          return (
            <li key={level.id} className={cn('panel flex flex-wrap items-center gap-3 p-4', !unlocked && 'opacity-70')}>
              <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-display text-xl font-bold', unlocked ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted')}>
                {unlocked ? index + 1 : <LockRoundedIcon fontSize="small" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold text-ink">{level.name}</p>
                <p className="text-sm font-semibold text-muted">{levelInfo(level)}</p>
                <p className="text-sm font-bold text-ink">{unlocked ? bestText(bests[level.id], level.verse?.words.length ?? 0) : 'Conclua a fase anterior para abrir'}</p>
              </div>
              <Button disabled={!unlocked} onClick={() => onPlay(level)}>
                Jogar
              </Button>
            </li>
          );
        })}
      </ol>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="fases" />
    </div>
  );
}

/** Livre: jogar sem valer nada. Qualquer fase, com checkpoints, sem guardar resultado. */
function FreeTab({ bests, onPlay }: { bests: Bests; onPlay: (level: Level, mode: 'practice' | 'watch') => void }) {
  const list = usePagination(LEVELS, 10);
  return (
    <div className="space-y-4">
      <Alert tone="info">Treine à vontade: qualquer fase, com checkpoints, e nada disso conta para o seu melhor resultado.</Alert>
      <Controls />
      <ul className="space-y-3">
        {list.pageItems.map((level) => (
          <li key={level.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-ink">{level.name}</p>
              <p className="text-sm font-semibold text-muted">{levelInfo(level)}</p>
              <p className="text-sm font-bold text-ink">{bestText(bests[level.id], level.verse?.words.length ?? 0)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" onClick={() => onPlay(level, 'watch')}>
                Ver um bot jogar
              </Button>
              <Button onClick={() => onPlay(level, 'practice')}>Treinar</Button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="fases" />
    </div>
  );
}

/** Contra bots: você e de 1 a 3 bots na mesma tela, na mesma fase. Quem cair volta ao último checkpoint; vence quem cruzar a linha primeiro. */
function BotsTab({ characters, character, onStart }: { characters: RunnerCharacter[]; character: RunnerCharacter; onStart: (level: Level, rivals: CorridaRival[]) => void }) {
  const [levelId, setLevelId] = useState(LEVELS[0].id);
  const [count, setCount] = useState<'1' | '2' | '3'>('2');
  const [difficulty, setDifficulty] = useState<BotLevel>('STUDENT');
  const level = LEVELS.find((item) => item.id === levelId) ?? LEVELS[0];
  // Os rivais são os outros personagens, na ordem da lista (com os sprites deles).
  const rivals: CorridaRival[] = rivalsFor(characters, character.id, Number(count)).map((item) => ({ name: item.name, color: item.color, sprites: item.sprites, skill: BOT_LEVELS[difficulty].skill, lag: BOT_LEVELS[difficulty].lag }));

  return (
    <div className="space-y-4">
      <Alert tone="info">Corra contra os bots na mesma tela. Quem cai volta sozinho ao último checkpoint, e vence quem cruzar a linha de chegada primeiro. Sem XP nem moedas.</Alert>
      <div className="panel space-y-4 p-4">
        <div className="space-y-1.5">
          <p className="font-display text-sm font-bold text-ink">Fase</p>
          <Select value={levelId} onChange={setLevelId} options={LEVELS.map((item) => ({ value: item.id, label: item.name, description: levelInfo(item) }))} aria-label="Fase da corrida" />
        </div>
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
            <SpriteView url={portraitOf(character)?.url} frames={portraitOf(character)?.frames} color={character.color} size={22} />
            Você ({character.name})
          </span>
          {rivals.map((rival) => (
            <span key={rival.name} className="flex items-center gap-1.5 rounded-full bg-surface-3 px-2.5 py-1 text-ink">
              <SpriteView url={rival.sprites?.portrait?.url ?? rival.sprites?.run?.url} frames={rival.sprites?.portrait?.frames ?? rival.sprites?.run?.frames} color={rival.color} size={22} />
              {rival.name}
            </span>
          ))}
        </div>
        <Button size="lg" className="w-full" onClick={() => onStart(level, rivals)}>
          Largar!
        </Button>
      </div>
    </div>
  );
}

/** Multijogador: local (até 4 na mesma tela) e online (até 4 jogadores). Chegam nas etapas 6 e 7 do cronograma. */
function MultiTab() {
  return (
    <div className="space-y-4">
      <Alert tone="info">Estas duas formas de jogar com amigos chegam nas próximas etapas. Os bots completam as vagas que faltarem.</Alert>
      <ul className="grid gap-3 sm:grid-cols-2">
        <li className="panel space-y-2 p-4">
          <p className="font-display text-lg font-bold text-ink">No mesmo aparelho</p>
          <p className="text-sm font-semibold text-muted">De 2 a 4 jogadores na mesma tela deitada, cada um tocando na sua faixa.</p>
          <Button disabled className="w-full">
            Em breve
          </Button>
        </li>
        <li className="panel space-y-2 p-4">
          <p className="font-display text-lg font-bold text-ink">Online com amigos</p>
          <p className="text-sm font-semibold text-muted">Crie uma sala, convide até 3 amigos por código ou link e corram na mesma fase.</p>
          <Button disabled className="w-full">
            Em breve
          </Button>
        </li>
      </ul>
    </div>
  );
}

/** Personagens: escolha o corredor. Todos correm igual; muda só a aparência (sprites e sons vêm do Painel na etapa 3; na campanha, cada novo se abre ao concluir uma fase). */
function CharactersTab({ characters, character, onChoose }: { characters: RunnerCharacter[]; character: RunnerCharacter; onChoose: (character: RunnerCharacter) => void }) {
  const list = usePagination(characters, 8);
  return (
    <div className="space-y-4">
      <Alert tone="info">Todos os personagens correm igual: o que muda é só a aparência e os sons. Na campanha, novos personagens vão abrindo conforme você conclui as fases.</Alert>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {list.pageItems.map((item) => {
          const selected = item.id === character.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onChoose(item)}
                aria-pressed={selected}
                className={cn('flex h-full w-full flex-col items-center gap-2 rounded-2xl border-2 bg-surface p-3 text-center transition', selected ? 'border-primary shadow-md' : 'border-edge hover:border-primary/60')}
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: `${item.color}33` }}>
                  <SpriteView url={portraitOf(item)?.url} frames={portraitOf(item)?.frames} color={item.color} size={72} />
                </span>
                <span className="font-display text-base font-bold text-ink">{item.name}</span>
                <span className="text-xs font-semibold text-muted">{item.text}</span>
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
