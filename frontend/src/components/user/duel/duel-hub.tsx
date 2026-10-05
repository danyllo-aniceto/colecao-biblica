import { useMemo, useState } from 'react';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { describeDom } from '@duel/cards';
import { SERIES_FORMATS, type SeriesFormat } from '@duel/series';
import { READY_DECKS, readyTeam } from '@duel/starter';
import type { BotSkill } from '@duel/bots';
import { SectionHeading } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { buildCardArt, DuelCardFace } from '@/components/user/duel/duel-card';
import { DuelGame } from '@/components/user/duel/duel-game';
import { DuelHelpModal } from '@/components/user/duel/duel-help';

const SKILLS: Array<{ value: BotSkill; label: string }> = [
  { value: 'APPRENTICE', label: 'Aprendiz' },
  { value: 'STUDENT', label: 'Estudante' },
  { value: 'MASTER', label: 'Mestre' },
];

/** Cartão "Duelo de Cartas" da aba Jogar: treino contra bot, sem XP nem moedas. */
export function DuelHub({ characters }: { characters: Array<{ name: string; imageUrl?: string | null }> }) {
  const art = useMemo(() => buildCardArt(characters), [characters]);
  const [deckId, setDeckId] = useState(READY_DECKS[0].id);
  const [skill, setSkill] = useState<BotSkill>('STUDENT');
  const [format, setFormat] = useState<SeriesFormat>('bo3');
  const [playing, setPlaying] = useState<{ key: number } | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const deck = READY_DECKS.find((entry) => entry.id === deckId) ?? READY_DECKS[0];
  const cards = useMemo(() => readyTeam(deck.id), [deck.id]);
  const paging = usePagination(cards, 4);

  return (
    <section className="space-y-3" aria-label="Duelo de Cartas">
      <SectionHeading title="Duelo de Cartas" subtitle="Cartas com poderes, 3 cenários e 6 turnos. Sem XP nem moedas: é só diversão." />
      <div className="panel space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary" aria-hidden="true">
            <StyleRoundedIcon sx={{ fontSize: 32 }} />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-display text-xl font-bold text-ink">Duelo das Eras</h3>
            <p className="text-sm font-semibold text-muted">
              Monte a jogada com o Vigor do turno, coloque suas cartas nos cenários e ganhe 2 dos 3. Cada personagem tem um Dom ligado à sua história. Treine contra um bot; o duelo com amigos vem em seguida.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm font-bold text-muted">Time pronto</span>
          <Segmented aria-label="Time pronto" value={deckId} onChange={setDeckId} options={READY_DECKS.map((entry) => ({ value: entry.id, label: entry.name }))} />
          <p className="text-sm text-muted">
            {deck.description}{' '}
            <button type="button" className="font-bold text-primary-strong underline dark:text-primary" onClick={() => setPreviewOpen(true)}>
              Ver as 12 cartas
            </button>
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-bold text-muted">Rival</span>
            <Segmented aria-label="Nível do bot" value={skill} onChange={setSkill} options={SKILLS} />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-bold text-muted">Partida</span>
            <Segmented aria-label="Tipo de série" value={format} onChange={setFormat} options={SERIES_FORMATS.map((entry) => ({ value: entry.id, label: entry.name }))} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="lg" onClick={() => setPlaying({ key: Date.now() })}>
            <StyleRoundedIcon /> Jogar contra o bot
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setHelpOpen(true)}>
            <HelpOutlineRoundedIcon /> Como jogar
          </Button>
        </div>
      </div>

      {playing ? <DuelGame key={playing.key} deckId={deckId} skill={skill} format={format} art={art} onExit={() => setPlaying(null)} /> : null}
      <DuelHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Modal open={previewOpen} title={deck.name} description="As 12 cartas do Time." onClose={() => setPreviewOpen(false)} footer={<Button onClick={() => setPreviewOpen(false)}>Fechar</Button>}>
        <ul className="space-y-3">
          {paging.pageItems.map(({ def }) => (
            <li key={def.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2">
              <DuelCardFace def={def} art={art} size="hand" />
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-ink">{def.name}</p>
                <p className="text-xs font-semibold text-muted">{def.tags.join(' · ')}</p>
                <p className="text-sm font-semibold text-ink">{describeDom(def.dom)}</p>
              </div>
            </li>
          ))}
        </ul>
        <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="cartas" pageSizeOptions={[4]} className="mt-3" />
      </Modal>
    </section>
  );
}
