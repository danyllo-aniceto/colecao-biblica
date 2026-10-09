import { useState, type MouseEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ISLANDS, SEAS } from '@/lib/map-shapes';
import type { MapPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Mapa bíblico: toque no mapa onde fica cada lugar. */
export function MapGame({ puzzle, submit, finished }: GameProps<MapPuzzle>) {
  const { west, east, south, north } = puzzle.bounds;
  const width = (east - west) * 10;
  const height = (north - south) * 10;
  const [guesses, setGuesses] = useState<Array<{ lat: number; lon: number }>>([]);
  const [sending, setSending] = useState(false);
  const current = guesses.length;
  const point = ([lon, lat]: [number, number]) => `${((lon - west) * 10).toFixed(1)},${((north - lat) * 10).toFixed(1)}`;

  function tap(event: MouseEvent<SVGSVGElement>) {
    if (finished || sending || current >= puzzle.places.length) return;
    const box = event.currentTarget.getBoundingClientRect();
    const lon = west + ((event.clientX - box.left) / box.width) * (east - west);
    const lat = north - ((event.clientY - box.top) / box.height) * (north - south);
    setGuesses((list) => [...list, { lat, lon }]);
  }

  async function send() {
    setSending(true);
    await submit({ guesses });
    setSending(false);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">Toque no mapa no lugar onde fica cada cidade ou região. Quanto mais perto, mais pontos. O mapa é simplificado: norte para cima.</p>
      <div className="panel flex items-center justify-between gap-2 p-3">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{current < puzzle.places.length ? `Lugar ${current + 1} de ${puzzle.places.length}` : 'Tudo marcado'}</span>
        <span className="font-display text-lg font-bold text-ink">{current < puzzle.places.length ? puzzle.places[current] : '✔'}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Mapa para marcar os lugares" onClick={tap} className="w-full cursor-crosshair rounded-2xl border-2 border-edge bg-[#ead9b4]" style={{ touchAction: 'manipulation' }}>
        {SEAS.map((sea, index) => (
          <polygon key={index} points={sea.map(point).join(' ')} fill="#9fd0e6" stroke="#6fb0cf" strokeWidth="1" />
        ))}
        {ISLANDS.map((island, index) => (
          <polygon key={index} points={island.map(point).join(' ')} fill="#ead9b4" stroke="#6fb0cf" strokeWidth="1" />
        ))}
        {guesses.map((guess, index) => {
          const [x, y] = point([guess.lon, guess.lat]).split(',').map(Number);
          return (
            <g key={index}>
              <circle cx={x} cy={y} r="5" fill="var(--primary)" stroke="#fff" strokeWidth="1.5" />
              <text x={x + 7} y={y + 4} fontSize="11" fontWeight="700" fill="#2b2140" stroke="#fff" strokeWidth="2.5" paintOrder="stroke">
                {puzzle.places[index]}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={guesses.length === 0 || finished} onClick={() => setGuesses((list) => list.slice(0, -1))}>
          Desfazer
        </Button>
        <Button className="flex-1" loading={sending} disabled={guesses.length !== puzzle.places.length || finished} onClick={() => void send()}>
          Conferir
        </Button>
      </div>
    </div>
  );
}
