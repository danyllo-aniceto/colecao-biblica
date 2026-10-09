import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { ISLANDS, LAKES, RIVERS, SEAS } from '@/lib/map-shapes';
import { actMiniGame, type MapEvent, type MapPuzzle, type MapReveal } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { LEVEL_EMOJI, LEVEL_LABEL, LEVEL_SCALE, LevelField, SetupShell, TimeBar, TimerField, readStored, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Mapa da Terra Santa · 5 lugares · tolerância de 120 km · 3 dicas de região',
  medio: 'Oriente Médio e Egito · 7 lugares · tolerância de 400 km · 2 dicas de região',
  dificil: 'Todo o mundo bíblico, de Roma à Babilônia · 10 lugares · tolerância de 800 km · 1 dica de região',
};
const TIMES = ['90', '150', '240', '360'] as const;
const KEY = 'mapa-escolhas';
type Choice = { level: Level; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', timed: false, time: '240' };
const minutes = (value: string) => (Number(value) % 60 === 0 ? `${Number(value) / 60} min` : `${(Number(value) / 60).toLocaleString('pt-BR')} min`);

/** Antes de começar: dificuldade (região do mapa, quantidade de lugares e tolerância) e tempo. */
export const mapSetup: SetupRender = ({ onStart }) => <MapSetup onStart={onStart} />;

function MapSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Choice>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in LEVEL_SCALE ? saved.level : FALLBACK.level,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Marque no mapa onde fica cada lugar da Bíblia. Quanto mais perto do lugar real, mais pontos. No fim, o mapa mostra onde cada um fica de verdade."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🔎 Dá para aumentar o mapa com + e − e arrastar para ver o resto.', '💡 A dica mostra uma área grande onde o lugar está (−40 pontos).', '🎨 Cada lugar tem uma cor, na lista e no mapa.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <TimerField label="Contar o tempo" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} format={minutes} unitLabel="Tempo para marcar os lugares" offNote="Sem pressa, mas o bônus de rapidez continua valendo." />
    </SetupShell>
  );
}

// ---------- A partida ----------

/** Uma cor por lugar (só tokens do tema), na lista e no mapa. */
const PALETTE = ['var(--primary)', 'var(--success)', 'var(--accent)', 'var(--violet)', 'var(--info)', 'var(--danger)', 'var(--r-rare)', 'var(--r-epic)', 'var(--r-legendary)', 'var(--r-common)'];
const colorOf = (index: number) => PALETTE[index % PALETTE.length];
const ZOOMS = [1, 1.5, 2, 3];
/** Unidades do desenho para cada grau de longitude (a escala é a mesma na vertical). */
const SCALE_WIDTH = 1000;

type Guess = { lat: number; lon: number };

/** Mapa bíblico: escolha um lugar da lista, toque no mapa para marcá-lo e, no fim, veja onde cada um fica de verdade, cada um com a sua cor. */
export function MapGame({ puzzle, runId, submit, finished, result }: GameProps<MapPuzzle>) {
  const toast = useToast();
  const dialogs = useDialogs();
  const { west, east, south, north } = puzzle.bounds;
  const scale = SCALE_WIDTH / (east - west);
  const width = SCALE_WIDTH;
  const height = (north - south) * scale;
  const total = puzzle.places.length;
  const [guesses, setGuesses] = useState<Array<Guess | null>>(() => puzzle.places.map(() => null));
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(puzzle.level === 'facil' ? 1 : 1.5);
  const [circles, setCircles] = useState<Record<number, { lat: number; lon: number; radiusKm: number }>>({});
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [shown, setShown] = useState(0);
  const guessesRef = useRef(guesses);
  const sendingRef = useRef(false);
  guessesRef.current = guesses;

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    await submit({ guesses: guessesRef.current });
    sendingRef.current = false;
    setSending(false);
  }, [submit]);

  const left = useTurnClock({ total: puzzle.timeLimit, active: !finished, resetKey: 0, onZero: () => void send() });

  const reveal = result?.reveal as MapReveal | undefined;
  // No fim os lugares certos aparecem um a um, cada um com a sua cor.
  useEffect(() => {
    if (!result) return undefined;
    playSfx(result.solved ? 'wsWin' : 'wsLose');
    const timers = (result.reveal as MapReveal | undefined)?.map((_, index) =>
      window.setTimeout(() => {
        setShown((current) => Math.max(current, index + 1));
        playSfx('wsReveal', 1 + index * 0.06);
      }, 700 + index * 450),
    );
    return () => timers?.forEach((timer) => window.clearTimeout(timer));
  }, [result]);

  const x = (lon: number) => (lon - west) * scale;
  const y = (lat: number) => (north - lat) * scale;
  const pt = ([lon, lat]: [number, number]) => `${x(lon).toFixed(1)},${y(lat).toFixed(1)}`;
  const kmToUnits = (km: number) => (km / 111) * scale;

  function tap(event: MouseEvent<SVGSVGElement>) {
    if (finished || sending) return;
    const box = event.currentTarget.getBoundingClientRect();
    const lon = west + ((event.clientX - box.left) / box.width) * (east - west);
    const lat = north - ((event.clientY - box.top) / box.height) * (north - south);
    playSfx('anPick');
    const next = guesses.map((guess, index) => (index === active ? { lat, lon } : guess));
    setGuesses(next);
    // Passa para o próximo lugar ainda sem marca.
    const empty = next.findIndex((guess, index) => guess === null && index !== active);
    if (empty >= 0) setActive(empty);
  }

  async function hint() {
    setAsking(true);
    try {
      const response = await actMiniGame(runId, { action: 'hint', index: active });
      const event = response.turn as MapEvent | undefined;
      if (event?.kind !== 'hint') return;
      setHintsLeft(event.left);
      setCircles((current) => ({ ...current, [event.index]: { lat: event.lat, lon: event.lon, radiusKm: event.radiusKm } }));
      playSfx('wsHint');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setAsking(false);
    }
  }

  async function giveUp() {
    const marked = guesses.filter(Boolean).length;
    const confirmed = await dialogs.confirm({ title: 'Terminar agora?', message: `Você marcou ${marked} de ${total} lugares. Os que faltam não pontuam.`, confirmLabel: 'Terminar', tone: 'danger' });
    if (confirmed) void send();
  }

  const placed = guesses.filter(Boolean).length;
  const roundCircle = circles[active];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">{puzzle.region}</span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {LEVEL_EMOJI[puzzle.level]} {LEVEL_LABEL[puzzle.level]}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">
          {placed} de {total} marcados
        </span>
      </div>
      {left !== null && puzzle.timeLimit !== null && !finished ? <TimeBar left={left} total={puzzle.timeLimit} unit="para marcar os lugares" /> : null}

      {/* A lista de lugares: cada um com a sua cor; o escolhido recebe a próxima marca. */}
      {!finished ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Lugares">
          {puzzle.places.map((name, index) => (
            <li key={name}>
              <button
                type="button"
                data-sound="off"
                onClick={() => setActive(index)}
                className={cn('flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-display text-sm font-bold transition active:scale-95', active === index ? 'bg-surface-3 text-ink' : 'border-transparent bg-surface-3/70 text-ink')}
                style={active === index ? { borderColor: colorOf(index) } : undefined}
              >
                <span className="h-3 w-3 rounded-full" style={{ background: colorOf(index) }} aria-hidden />
                {name}
                {guesses[index] ? <span aria-hidden>✔</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!finished ? (
        <p className="text-center text-sm font-semibold text-muted">
          Toque no mapa para marcar <b className="text-ink">{puzzle.places[active]}</b>.
        </p>
      ) : null}

      <div className="relative">
        <div className="max-h-[72vh] overflow-auto rounded-2xl border-2 border-edge bg-[#9fd0e6]">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Mapa para marcar os lugares"
            onClick={tap}
            className={cn('block max-w-none', finished ? 'cursor-default' : 'cursor-crosshair')}
            style={{ width: `${zoom * 100}%`, touchAction: 'manipulation' }}
          >
            <rect width={width} height={height} fill="#ead9b4" />
            {SEAS.map((sea, index) => (
              <polygon key={index} points={sea.map(pt).join(' ')} fill="#9fd0e6" stroke="#6fb0cf" strokeWidth="2" />
            ))}
            {ISLANDS.map((island, index) => (
              <polygon key={index} points={island.map(pt).join(' ')} fill="#ead9b4" stroke="#6fb0cf" strokeWidth="2" />
            ))}
            {LAKES.map((lake, index) => (
              <polygon key={index} points={lake.map(pt).join(' ')} fill="#9fd0e6" stroke="#6fb0cf" strokeWidth="2" />
            ))}
            {RIVERS.map((river, index) => (
              <polyline key={index} points={river.map(pt).join(' ')} fill="none" stroke="#6fb0cf" strokeWidth="3" />
            ))}

            {/* Dica: área grande onde o lugar está. */}
            {!finished && roundCircle ? <circle cx={x(roundCircle.lon)} cy={y(roundCircle.lat)} r={kmToUnits(roundCircle.radiusKm)} fill={colorOf(active)} fillOpacity="0.18" stroke={colorOf(active)} strokeWidth="3" strokeDasharray="10 8" /> : null}

            {/* Suas marcas, cada uma na cor do lugar. */}
            {guesses.map((guess, index) =>
              guess ? (
                <g key={index}>
                  <circle cx={x(guess.lon)} cy={y(guess.lat)} r={finished ? 9 : 11} fill={colorOf(index)} stroke="#fff" strokeWidth="3" />
                  {!finished ? (
                    <text x={x(guess.lon) + 15} y={y(guess.lat) + 5} fontSize="22" fontWeight="700" fill="#2b2140" stroke="#fff" strokeWidth="5" paintOrder="stroke">
                      {puzzle.places[index]}
                    </text>
                  ) : null}
                </g>
              ) : null,
            )}

            {/* No fim: o lugar certo (alvo na mesma cor), a linha até a sua marca e o nome. */}
            {reveal?.slice(0, shown).map((place, index) => {
              const guess = guesses[index];
              return (
                <g key={place.name} className="animate-pop-in">
                  {guess ? <line x1={x(guess.lon)} y1={y(guess.lat)} x2={x(place.lon)} y2={y(place.lat)} stroke={colorOf(index)} strokeWidth="4" strokeDasharray="8 7" /> : null}
                  <circle cx={x(place.lon)} cy={y(place.lat)} r="16" fill="none" stroke={colorOf(index)} strokeWidth="6" />
                  <circle cx={x(place.lon)} cy={y(place.lat)} r="6" fill={colorOf(index)} />
                  <text x={x(place.lon) + 22} y={y(place.lat) + 7} fontSize="24" fontWeight="800" fill="#2b2140" stroke="#fff" strokeWidth="6" paintOrder="stroke">
                    {place.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <div className="absolute right-2 top-2 flex flex-col gap-1.5" data-sound="off">
          <button type="button" aria-label="Aumentar o mapa" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onClick={() => setZoom((current) => ZOOMS[Math.min(ZOOMS.indexOf(current) + 1, ZOOMS.length - 1)])} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-ink shadow-md disabled:opacity-40">
            <AddRoundedIcon />
          </button>
          <button type="button" aria-label="Diminuir o mapa" disabled={zoom <= ZOOMS[0]} onClick={() => setZoom((current) => ZOOMS[Math.max(ZOOMS.indexOf(current) - 1, 0)])} className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface text-ink shadow-md disabled:opacity-40">
            <RemoveRoundedIcon />
          </button>
        </div>
      </div>
      <p className="text-center text-[11px] font-semibold text-muted">O mapa é simplificado, com o norte para cima. Use + e − para aumentar e arraste para ver o resto.</p>

      {!finished ? (
        <>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" size="sm" disabled={!guesses[active] || sending} onClick={() => setGuesses((list) => list.map((guess, index) => (index === active ? null : guess)))}>
              Tirar a marca
            </Button>
            <Button variant="secondary" className="flex-1" size="sm" loading={asking} disabled={hintsLeft <= 0 || sending || Boolean(circles[active])} onClick={() => void hint()}>
              💡 Dica de região ({hintsLeft})
            </Button>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" loading={sending} disabled={placed !== total} onClick={() => void send()}>
              Conferir
            </Button>
            <Button variant="ghost" className="flex-1" disabled={sending || placed === 0} onClick={() => void giveUp()}>
              Terminar agora
            </Button>
          </div>
        </>
      ) : reveal ? (
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" aria-label="Onde cada lugar fica">
          {reveal.map((place, index) => (
            <li key={place.name} className={cn('flex items-center gap-2 rounded-xl bg-surface-3 px-3 py-2 transition-opacity', index >= shown && 'opacity-30')}>
              <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: colorOf(index) }} aria-hidden />
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-ink">{place.name}</span>
              <span className={cn('shrink-0 text-xs font-bold', place.km === null ? 'text-muted' : place.km <= puzzle.maxErrorKm / 4 ? 'text-success-strong dark:text-success' : place.km <= puzzle.maxErrorKm ? 'text-ink' : 'text-danger')}>{place.km === null ? 'sem marca' : `errou por ${place.km.toLocaleString('pt-BR')} km`}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
