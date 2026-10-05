import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import type { BotSkill } from '@duel/bots';
import { botTeam } from '@duel/bot-team';
import { SERIES_FORMATS, type SeriesFormat } from '@duel/series';
import type { CardDef, TeamCard } from '@duel/types';
import { TEAM_SIZE } from '@duel/types';
import { Alert, SectionHeading } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { LoadingState } from '@/components/ui/spinner';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { errorMessage, useToast } from '@/components/ui/toast';
import { buildCardArt, DuelCardFace } from '@/components/user/duel/duel-card';
import { DuelDeckBuilder } from '@/components/user/duel/duel-deck-builder';
import { DuelGame } from '@/components/user/duel/duel-game';
import { DuelHelpModal } from '@/components/user/duel/duel-help';
import { OnlineDuel } from '@/components/user/duel/duel-online';
import { JoinRoomModal } from '@/components/user/board/join-room-modal';
import { deleteDuelDeck, getDuelCards, listDuelDecks, MAX_DUEL_DECKS, saveDuelDeck, type DuelDeck } from '@/lib/duel-api';
import { createDuelRoom, joinDuelRoom, myDuelRoom, PENDING_DUEL_EVENT, takePendingDuelRoom, type DuelRoomView } from '@/lib/duel-room-api';
import type { UserSticker } from '@/lib/user-api';

const SKILLS: Array<{ value: BotSkill; label: string }> = [
  { value: 'APPRENTICE', label: 'Aprendiz' },
  { value: 'STUDENT', label: 'Estudante' },
  { value: 'MASTER', label: 'Mestre' },
];

type Props = {
  characters: Array<{ name: string; imageUrl?: string | null }>;
  /** Figurinhas que o jogador tem (com o nível de cada uma). */
  collection: UserSticker[];
};

/** Cartão "Duelo de Cartas" da aba Jogar: monte seu Time com as figurinhas que você tem e treine contra um bot. Sem XP nem moedas. */
export function DuelHub({ characters, collection }: Props) {
  const toast = useToast();
  const { confirm } = useDialogs();
  const art = useMemo(() => buildCardArt(characters), [characters]);
  const [cards, setCards] = useState<CardDef[] | null>(null);
  const [decks, setDecks] = useState<DuelDeck[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [skill, setSkill] = useState<BotSkill>('STUDENT');
  const [format, setFormat] = useState<SeriesFormat>('bo3');
  const [useLevels, setUseLevels] = useState(false);
  const [editing, setEditing] = useState<{ slot: number; deck: DuelDeck | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState<{ key: number; team: TeamCard[]; foe: TeamCard[] } | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** Sala online aberta na tela (com a visão que veio de criar/entrar, para não piscar vazia). */
  const [room, setRoom] = useState<{ code: string; initial: DuelRoomView | null } | null>(null);
  const [current, setCurrent] = useState<{ code: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    Promise.all([getDuelCards(), listDuelDecks()])
      .then(([cardResult, deckResult]) => {
        setCards(cardResult.cards);
        setDecks(deckResult.decks);
        setSlot((current) => current ?? deckResult.decks[0]?.slot ?? null);
      })
      .catch((reason) => setLoadError(errorMessage(reason, 'Não foi possível carregar o Duelo.')))
      .finally(() => setLoaded(true));
  }, []);
  useEffect(load, [load]);

  // Só vale carta de figurinha conquistada.
  const levelOf = useMemo(() => new Map(collection.map((sticker) => [String(sticker.characterId), sticker.level])), [collection]);
  const ownedCards = useMemo(() => (cards ?? []).filter((card) => levelOf.has(card.id)), [cards, levelOf]);
  const cardById = useMemo(() => new Map((cards ?? []).map((card) => [card.id, card])), [cards]);
  const missing = (cards?.length ?? 0) - ownedCards.length;

  const teamOf = useCallback(
    (deck: DuelDeck): TeamCard[] => deck.cards.flatMap((id) => (cardById.has(String(id)) ? [{ def: cardById.get(String(id))!, level: useLevels ? (levelOf.get(String(id)) ?? 1) : 1 }] : [])),
    [cardById, levelOf, useLevels],
  );

  const selected = decks.find((deck) => deck.slot === slot) ?? null;
  const selectedTeam = selected ? teamOf(selected) : [];
  const selectedOk = selectedTeam.length === TEAM_SIZE && selected !== null && selected.cards.every((id) => levelOf.has(String(id)));

  // Sala em que a pessoa já está (para voltar a ela) e salas pedidas por link ou convite de amigo.
  const refreshCurrent = useCallback(() => {
    myDuelRoom()
      .then((found) => setCurrent(found ? { code: found.code } : null))
      .catch(() => setCurrent(null));
  }, []);

  const deckForRoom = selectedOk ? slot : null;
  const deckForRoomRef = useRef<number | null>(null);
  deckForRoomRef.current = deckForRoom;

  const openPending = useCallback(async () => {
    const code = takePendingDuelRoom();
    if (!code) return;
    try {
      setRoom({ code, initial: await joinDuelRoom(code, deckForRoomRef.current) });
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível entrar na sala.'));
      refreshCurrent();
    }
  }, [toast, refreshCurrent]);

  useEffect(() => {
    if (!loaded) return;
    refreshCurrent();
    void openPending();
    const listener = () => void openPending();
    window.addEventListener(PENDING_DUEL_EVENT, listener);
    return () => window.removeEventListener(PENDING_DUEL_EVENT, listener);
  }, [loaded, refreshCurrent, openPending]);

  async function createOnline() {
    setCreating(true);
    try {
      const created = await createDuelRoom({ config: { format, levels: useLevels }, deckSlot: deckForRoom });
      setRoom({ code: created.code, initial: created });
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível criar a sala.'));
    } finally {
      setCreating(false);
    }
  }

  async function joinByCode(code: string) {
    const joined = await joinDuelRoom(code, deckForRoom);
    setJoinOpen(false);
    setRoom({ code: joined.code, initial: joined });
  }

  function closeRoom() {
    setRoom(null);
    refreshCurrent();
  }

  function start() {
    if (!selected || !cards) return;
    // O rival joga com um Time sorteado entre todas as cartas, no nível médio do seu (se os níveis valem).
    const average = selectedTeam.length ? Math.round(selectedTeam.reduce((sum, card) => sum + (card.level ?? 1), 0) / selectedTeam.length) : 1;
    const foe = botTeam(cards, Math.floor(Math.random() * 2 ** 31), useLevels ? average : 1);
    if (!foe) {
      toast.error('Ainda não há cartas suficientes no Duelo para o rival montar um Time.');
      return;
    }
    setPlaying({ key: Date.now(), team: selectedTeam, foe });
  }

  async function save(name: string, ids: string[]) {
    if (!editing) return;
    setSaving(true);
    try {
      await saveDuelDeck(
        editing.slot,
        name,
        ids.map(Number),
      );
      toast.success('Time salvo.');
      setEditing(null);
      setSlot(editing.slot);
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(deck: DuelDeck) {
    const ok = await confirm({ title: `Excluir o Time "${deck.name}"?`, message: 'As cartas continuam com você; só o Time é apagado.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteDuelDeck(deck.slot);
      toast.success('Time excluído.');
      if (slot === deck.slot) setSlot(null);
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  const freeSlot = Array.from({ length: MAX_DUEL_DECKS }, (_, index) => index + 1).find((candidate) => !decks.some((deck) => deck.slot === candidate));

  return (
    <section className="space-y-3" aria-label="Duelo de Cartas">
      <SectionHeading title="Duelo de Cartas" subtitle="Cartas com poderes, 3 arenas e 6 turnos. Sem XP nem moedas: é só diversão." />
      <div className="panel space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary" aria-hidden="true">
            <StyleRoundedIcon sx={{ fontSize: 32 }} />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-display text-xl font-bold text-ink">Duelo das Eras</h3>
            <p className="text-sm font-semibold text-muted">
              Monte um Time de {TEAM_SIZE} cartas com as figurinhas que você já conquistou, use o Vigor do turno para colocá-las nas arenas e ganhe 2 das 3. Cada personagem tem um Dom ligado à história dele.
            </p>
          </div>
        </div>

        {cards === null && !loadError ? <LoadingState label="Carregando as cartas..." /> : null}
        {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
        {cards !== null && cards.length === 0 ? <Alert tone="info">O Duelo ainda não tem cartas cadastradas. Volte em breve!</Alert> : null}

        {cards !== null && cards.length > 0 ? (
          <>
            <Alert tone={ownedCards.length >= TEAM_SIZE ? 'success' : 'info'}>
              {ownedCards.length >= TEAM_SIZE
                ? `Você tem ${ownedCards.length} carta(s) do Duelo${missing > 0 ? ` (faltam ${missing} para conquistar)` : ''}.`
                : `Você tem ${ownedCards.length} de ${TEAM_SIZE} cartas para montar um Time. Conquiste mais figurinhas jogando, na loja ou trocando com amigos.`}
            </Alert>

            <div className="space-y-2">
              <span className="text-sm font-bold text-muted">Seus Times</span>
              {decks.length === 0 ? <p className="text-sm text-muted">Você ainda não montou nenhum Time.</p> : null}
              <ul className="space-y-2">
                {decks.map((deck) => {
                  const team = teamOf(deck);
                  const on = deck.slot === slot;
                  return (
                    <li key={deck.slot}>
                      <div className={`flex items-center gap-3 rounded-2xl border-2 p-2 transition ${on ? 'border-primary bg-primary/10' : 'border-edge bg-surface-2'}`}>
                        <button type="button" onClick={() => setSlot(deck.slot)} aria-pressed={on} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${on ? 'border-primary bg-primary text-on-primary' : 'border-edge-strong text-transparent'}`} aria-hidden="true">
                            ✓
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-display text-base font-bold text-ink">{deck.name}</span>
                            <span className="block text-xs font-semibold text-muted">{team.length === TEAM_SIZE ? `${TEAM_SIZE} cartas` : `${team.length} cartas (algumas saíram do jogo)`}</span>
                          </span>
                          <span className="no-scrollbar hidden min-w-0 gap-1 overflow-x-auto sm:flex">
                            {team.slice(0, 6).map((card) => (
                              <DuelCardFace key={card.def.id} def={card.def} art={art} />
                            ))}
                          </span>
                        </button>
                        <Tooltip content="Editar Time">
                          <button type="button" aria-label={`Editar ${deck.name}`} onClick={() => setEditing({ slot: deck.slot, deck })} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-3 hover:text-ink">
                            <EditRoundedIcon fontSize="small" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Excluir Time">
                          <button type="button" aria-label={`Excluir ${deck.name}`} onClick={() => void remove(deck)} className="flex h-9 w-9 items-center justify-center rounded-xl text-danger hover:bg-danger/15">
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </button>
                        </Tooltip>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <Button variant="secondary" size="sm" disabled={freeSlot === undefined || ownedCards.length < TEAM_SIZE} onClick={() => freeSlot !== undefined && setEditing({ slot: freeSlot, deck: null })}>
                <AddRoundedIcon fontSize="small" /> {freeSlot === undefined ? `Limite de ${MAX_DUEL_DECKS} Times` : 'Montar novo Time'}
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <span className="text-sm font-bold text-muted">Rival no treino</span>
                <Segmented aria-label="Nível do bot" value={skill} onChange={setSkill} options={SKILLS} />
              </div>
              <div className="space-y-2">
                <span className="text-sm font-bold text-muted">Partida</span>
                <Segmented aria-label="Tipo de série" value={format} onChange={setFormat} options={SERIES_FORMATS.map((entry) => ({ value: entry.id, label: entry.name }))} />
              </div>
            </div>
            <Switch checked={useLevels} onChange={setUseLevels} label="Usar o nível das minhas figurinhas" description="Ligado, cartas de nível 2 a 5 ficam um pouco mais fortes (e o rival também sobe). Desligado, todas valem como nível 1." />

            {current && !room ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/15 p-3">
                <p className="text-sm font-semibold text-ink">
                  Você está na sala de duelo <b className="tracking-widest">{current.code}</b>
                </p>
                <Button size="sm" variant="accent" onClick={() => setRoom({ code: current.code, initial: null })}>
                  Voltar para a sala
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button size="lg" disabled={!selectedOk} onClick={start}>
                <StyleRoundedIcon /> Jogar contra o bot
              </Button>
              <Button size="lg" variant="accent" disabled={!selectedOk} loading={creating} onClick={() => void createOnline()}>
                <GroupsRoundedIcon /> Criar sala online
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setJoinOpen(true)}>
                <MeetingRoomRoundedIcon /> Entrar com código
              </Button>
              <Button size="lg" variant="ghost" onClick={() => setHelpOpen(true)}>
                <HelpOutlineRoundedIcon /> Como jogar
              </Button>
            </div>
            {!selectedOk && decks.length > 0 ? <p className="text-xs font-semibold text-muted">Escolha um Time completo para jogar.</p> : null}
          </>
        ) : null}
      </div>

      {joinOpen ? <JoinRoomModal open onClose={() => setJoinOpen(false)} onJoin={joinByCode} /> : null}
      {room ? <OnlineDuel key={room.code} code={room.code} initial={room.initial} decks={decks} art={art} onClose={closeRoom} /> : null}
      {playing ? <DuelGame key={playing.key} team={playing.team} foeTeam={playing.foe} skill={skill} format={format} art={art} onExit={() => setPlaying(null)} /> : null}
      <DuelHelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {editing ? (
        <DuelDeckBuilder
          cards={ownedCards}
          art={art}
          initialName={editing.deck?.name ?? `Time ${editing.slot}`}
          initialIds={(editing.deck?.cards ?? []).map(String).filter((id) => ownedCards.some((card) => card.id === id))}
          saving={saving}
          missing={missing}
          onSave={(name, ids) => void save(name, ids)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </section>
  );
}
