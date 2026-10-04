import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, ProgressBar } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { StickerCard } from '@/components/game/sticker-card';
import { fieldClassName } from '@/components/ui/input';
import { MermaidDiagram, looksLikeMermaid } from '@/components/ui/mermaid-diagram';
import { RichContent } from '@/components/ui/rich-content';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon } from '@/components/game/game-ui';
import { TESTAMENT_LABELS } from '@/lib/labels';
import {
  createComment,
  getCharacterDetail,
  getCollection,
  getMyComments,
  updateComment,
  type CharacterDetail,
  type CommentEntry,
  type StudyStatus,
} from '@/lib/user-api';
import { markStickerReturn } from '@/lib/sticker-return';
import { getRarityLabel } from '@/lib/rarity-theme';

type Tab = 'identidade' | 'historia' | 'biblia' | 'diagramas' | 'estudo';

function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toChipList(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function StickerPage() {
  const navigate = useNavigate();
  const params = useParams<{ characterId: string }>();
  const { accessToken } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterDetail | null>(null);
  const [isOwned, setIsOwned] = useState(false);
  const [study, setStudy] = useState<StudyStatus | null>(null);
  const [stickerLevel, setStickerLevel] = useState(1);
  const [duplicates, setDuplicates] = useState(0);
  const [tab, setTab] = useState<Tab>('identidade');
  const [locked, setLocked] = useState(false);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentEditingId, setCommentEditingId] = useState<number | null>(null);

  const parsedCharacterId = Number(params.characterId);

  // "Voltar" leva ao lugar de onde a ficha foi aberta (álbum na folha dela, início etc.).
  function backToDashboard() {
    navigate('/dashboard');
  }

  // Também vale para o voltar do navegador/celular.
  useEffect(() => markStickerReturn, []);

  useEffect(() => {
    if (!accessToken || !Number.isFinite(parsedCharacterId)) {
      setLoading(false);
      setError('Figurinha inválida.');
      return;
    }

    let ignore = false;

    async function loadDetails() {
      setLoading(true);
      setError(null);

      try {
        // A ficha só abre para quem conquistou a figurinha (o servidor também bloqueia).
        const collection = await getCollection();
        if (ignore) {
          return;
        }
        const mine = collection.find((item) => item.characterId === parsedCharacterId);
        const owned = Boolean(mine);
        setStudy(mine?.study ?? null);
        setStickerLevel(mine?.level ?? 1);
        setDuplicates(mine?.duplicates ?? 0);
        if (!owned) {
          setLocked(true);
          return;
        }

        const [selectedCharacter, myComments] = await Promise.all([getCharacterDetail(parsedCharacterId), getMyComments()]);

        if (ignore) {
          return;
        }

        const characterComments = myComments
          .filter((comment) => comment.characterId === parsedCharacterId)
          .sort((left, right) => {
            return new Date(right.updatedAt ?? right.createdAt).getTime() - new Date(left.updatedAt ?? left.createdAt).getTime();
          });

        setCharacter(selectedCharacter);
        setIsOwned(owned);
        setComments(characterComments);
        setCommentDraft(characterComments[0]?.text ?? '');
        setCommentEditingId(characterComments[0]?.id ?? null);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os detalhes da figurinha.');
      } finally {
        setLoading(false);
      }
    }

    void loadDetails();

    return () => {
      ignore = true;
    };
  }, [accessToken, parsedCharacterId]);

  const bookChips = useMemo(() => toChipList(character?.bibleBooks), [character?.bibleBooks]);
  const keywordChips = useMemo(() => toChipList(character?.keywords), [character?.keywords]);
  const keyVersesChips = useMemo(() => toChipList(character?.keyVerses), [character?.keyVerses]);

  // Só aparecem as abas que têm conteúdo (identidade e estudo sempre).
  const hasBible = Boolean(character?.bibleReferences?.trim()) || bookChips.length > 0 || keyVersesChips.length > 0 || keywordChips.length > 0;
  const hasDiagrams = Boolean(character?.genealogy?.trim()) || Boolean(character?.importantEvents?.trim());
  const tabs: Array<{ value: Tab; label: string; icon: ReactNode }> = [
    { value: 'identidade', label: 'Identidade', icon: <BadgeRoundedIcon fontSize="small" /> },
    { value: 'historia', label: 'História', icon: <HistoryEduRoundedIcon fontSize="small" /> },
    ...(hasBible ? [{ value: 'biblia' as const, label: 'Bíblia', icon: <AutoStoriesRoundedIcon fontSize="small" /> }] : []),
    ...(hasDiagrams ? [{ value: 'diagramas' as const, label: 'Diagramas', icon: <AccountTreeRoundedIcon fontSize="small" /> }] : []),
    { value: 'estudo', label: 'Meu estudo', icon: <SchoolRoundedIcon fontSize="small" /> },
  ];

  async function handleSaveComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !character || !isOwned || !commentDraft.trim()) {
      return;
    }

    setCommentSubmitting(true);

    try {
      if (commentEditingId === null) {
        const created = await createComment({
          characterId: character.id,
          text: commentDraft.trim(),
        });

        setComments((current) => [created, ...current]);
        setCommentEditingId(created.id);
        toast.success('Anotação salva.');
        created.unlockedAchievements?.forEach((achievement) =>
          toast.success(`Conquista: ${achievement.title}!`, { description: `+${achievement.coins} moedas`, icon: <CoinIcon /> }),
        );
      } else {
        const updated = await updateComment(commentEditingId, { text: commentDraft.trim() });
        setComments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success('Anotação atualizada.');
      }
    } catch (saveError) {
      toast.error(errorMessage(saveError, 'Não foi possível salvar a anotação.'));
    } finally {
      setCommentSubmitting(false);
    }
  }

  return (
    <RequireAuth>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:px-6">
        <Button type="button" variant="ghost" onClick={() => backToDashboard()} className="-ml-2">
          <ArrowBackRoundedIcon />
          Voltar
        </Button>

        {loading ? <LoadingState label="Abrindo figurinha..." /> : null}

        {locked ? (
          <section className="panel mx-auto mt-6 flex max-w-md flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-3 text-muted">
              <LockRoundedIcon fontSize="large" />
            </span>
            <h1 className="font-display text-2xl font-bold text-ink">Figurinha bloqueada</h1>
            <p className="text-muted">Conquiste esta figurinha jogando, na loja ou numa troca com amigos para abrir a ficha completa.</p>
            <Button size="lg" onClick={() => backToDashboard()}>
              <PlayArrowRoundedIcon />
              Jogar para conquistar
            </Button>
          </section>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Alert tone="danger">{error}</Alert>
          </div>
        ) : null}

        {!loading && !error && character ? (
          <div className="mt-4 space-y-6">
            <section className="rarity grid items-start gap-6 md:grid-cols-[280px_1fr]" data-rarity={character.rarity}>
              <div className="animate-pop-in mx-auto w-56 md:w-full">
                <StickerCard name={character.name} rarity={character.rarity} imageUrl={character.imageUrl} owned={isOwned} size="lg" level={stickerLevel} duplicates={duplicates} />
              </div>
              <div className="panel relative overflow-hidden p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[var(--r)] opacity-20 blur-3xl" />
                <div className="relative">
                  <span className="rarity-chip inline-block rounded-full px-3 py-1 font-display text-xs font-bold uppercase tracking-wider">
                    Figurinha {getRarityLabel(character.rarity)}
                  </span>
                  <h1 className="mt-3 font-display text-4xl font-bold text-ink sm:text-5xl">{character.name}</h1>
                  {character.narrativeRole ? <p className="mt-1 font-display text-lg font-semibold text-muted">{character.narrativeRole}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {character.testament ? <Badge tone="accent">{TESTAMENT_LABELS[character.testament]}</Badge> : null}
                    {character.historicalPeriod ? <Badge tone="neutral">{character.historicalPeriod}</Badge> : null}
                    {isOwned ? <Badge tone="primary">{duplicates === 0 ? 'Sem repetidas' : duplicates === 1 ? '1 repetida' : `${duplicates} repetidas`}</Badge> : null}
                  </div>
                  {isOwned ? (
                    <>
                      <div className="mt-4 text-lg text-muted">
                        <RichContent value={character.shortSummary} />
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="text-lg text-muted">
                        <RichContent value={character.shortSummary} />
                      </div>
                      <p className="flex items-center gap-2 font-semibold text-muted">
                        <LockRoundedIcon /> Conquiste esta figurinha para ler a história completa.
                      </p>
                      <Button size="lg" onClick={() => backToDashboard()}>
                        <PlayArrowRoundedIcon />
                        Jogar para conquistar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {isOwned ? (
              <div className="rarity space-y-4" data-rarity={character.rarity}>
                <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
                  <div role="tablist" aria-label="Seções da ficha" className="inline-flex min-w-full gap-1 rounded-2xl bg-surface-3 p-1">
                    {tabs.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        role="tab"
                        id={`aba-${item.value}`}
                        aria-selected={tab === item.value}
                        aria-controls="painel-ficha"
                        onClick={() => setTab(item.value)}
                        className={cn(
                          'inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 font-display text-sm font-semibold transition',
                          tab === item.value ? 'bg-surface text-ink shadow-[0_2px_0_var(--edge-strong)]' : 'text-muted hover:text-ink',
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div id="painel-ficha" role="tabpanel" aria-labelledby={`aba-${tab}`} className="space-y-4">
                  {tab === 'identidade' ? (
                    <InfoPanel title="Identidade">
                      <dl className="grid gap-4 sm:grid-cols-2">
                        <Fact label="Nome" value={character.name} />
                        <Fact label="Raridade" value={getRarityLabel(character.rarity)} />
                        <Fact label="Nível da figurinha" value={`${stickerLevel} de 5`} />
                        <Fact label="Repetidas" value={String(duplicates)} />
                        <Fact label="Papel na história" value={character.narrativeRole} />
                        <Fact label="Testamento" value={character.testament ? TESTAMENT_LABELS[character.testament] : null} />
                        <Fact label="Período histórico" value={character.historicalPeriod} />
                        <Fact label="Livros onde aparece" value={character.bibleBooks ? toChipList(character.bibleBooks).join(', ') : null} />
                      </dl>
                      <div className="mt-5 border-t border-edge pt-4">
                        <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted">Resumo</p>
                        <RichContent value={character.shortSummary} />
                      </div>
                    </InfoPanel>
                  ) : null}

                  {tab === 'historia' ? (
                    <>
                      <InfoPanel title="História completa">
                        <RichContent value={character.fullDescription} />
                      </InfoPanel>
                      {character.curiosities?.trim() ? (
                        <InfoPanel title="Curiosidades">
                          <RichContent value={character.curiosities} />
                        </InfoPanel>
                      ) : null}
                    </>
                  ) : null}

                  {tab === 'biblia' ? (
                    <>
                      {character.bibleReferences?.trim() ? (
                        <InfoPanel title="Onde ler">
                          <RichContent value={character.bibleReferences} />
                        </InfoPanel>
                      ) : null}
                      {bookChips.length > 0 ? (
                        <InfoPanel title="Livros onde aparece">
                          <div className="flex flex-wrap gap-2">
                            {bookChips.map((book) => (
                              <Badge key={book} tone="violet">
                                <AutoStoriesRoundedIcon sx={{ fontSize: 14 }} />
                                {book}
                              </Badge>
                            ))}
                          </div>
                        </InfoPanel>
                      ) : null}
                      {keyVersesChips.length > 0 ? (
                        <InfoPanel title="Versículos-chave">
                          <div className="flex flex-wrap gap-2">
                            {keyVersesChips.map((chip) => (
                              <Badge key={chip} tone="primary">
                                <FormatQuoteRoundedIcon sx={{ fontSize: 14 }} />
                                {chip}
                              </Badge>
                            ))}
                          </div>
                        </InfoPanel>
                      ) : null}
                      {keywordChips.length > 0 ? (
                        <InfoPanel title="Palavras-chave">
                          <div className="flex flex-wrap gap-2">
                            {keywordChips.map((chip) => (
                              <Badge key={chip} tone="accent">
                                #{chip}
                              </Badge>
                            ))}
                          </div>
                        </InfoPanel>
                      ) : null}
                    </>
                  ) : null}

                  {tab === 'diagramas' ? (
                    <>
                      {character.genealogy?.trim() ? (
                        <InfoPanel title="Árvore genealógica">
                          {looksLikeMermaid(character.genealogy) ? (
                            <MermaidDiagram code={character.genealogy} className="rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" />
                          ) : (
                            <RichContent value={character.genealogy} />
                          )}
                        </InfoPanel>
                      ) : null}
                      {character.importantEvents?.trim() ? (
                        <InfoPanel title="Linha do tempo">
                          {looksLikeMermaid(character.importantEvents) ? (
                            <MermaidDiagram code={character.importantEvents} className="rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full" />
                          ) : (
                            <RichContent value={character.importantEvents} />
                          )}
                        </InfoPanel>
                      ) : null}
                    </>
                  ) : null}

                  {tab === 'estudo' ? (
                    <>
                      <InfoPanel title="Meu estudo">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="flex items-center gap-2 font-display text-xl font-bold text-ink">
                            <SchoolRoundedIcon className="rarity-text" /> {study?.label ?? 'Iniciante'}
                          </span>
                          <span className="text-sm font-bold text-muted">
                            {study?.correctAnswers ?? 0} {(study?.correctAnswers ?? 0) === 1 ? 'acerto' : 'acertos'} acumulados
                          </span>
                        </div>
                        {study?.nextAt ? (
                          <div className="mt-3 space-y-1">
                            <ProgressBar value={(study.correctAnswers / study.nextAt) * 100} className="h-3" />
                            <p className="text-sm text-muted">
                              Faltam {study.nextAt - study.correctAnswers} acerto(s) para <strong>{study.nextLabel}</strong>.
                            </p>
                          </div>
                        ) : (
                          <p className="mt-3 text-sm text-muted">Você chegou ao status máximo deste personagem.</p>
                        )}
                        <p className="mt-3 text-sm text-muted">Responda perguntas dele em Jogar → Estudo de personagem. Não rende prêmios: é só para acompanhar o quanto você aprendeu.</p>
                      </InfoPanel>

                      <section className="panel space-y-4 p-5 sm:p-6">
                        <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-ink">
                          <EditNoteRoundedIcon className="text-info" />
                          Minhas anotações
                        </h2>
                        <p className="text-sm text-muted">Só você vê o que escreve aqui.</p>
                        <form className="space-y-3" onSubmit={handleSaveComment}>
                          <textarea
                            className={`${fieldClassName} min-h-36 w-full py-3`}
                            value={commentDraft}
                            onChange={(event) => setCommentDraft(event.target.value)}
                            placeholder="O que você aprendeu com este personagem?"
                          />
                          <Button type="submit" loading={commentSubmitting} disabled={!commentDraft.trim()}>
                            {commentSubmitting ? 'Salvando...' : commentEditingId ? 'Atualizar anotação' : 'Salvar anotação'}
                          </Button>
                        </form>
                        {comments.length > 0 ? (
                          <ul className="space-y-2">
                            {comments.map((comment) => (
                              <li key={comment.id} className="rounded-2xl bg-surface-2 p-4">
                                <span className="text-xs font-bold text-muted">{formatDate(comment.updatedAt ?? comment.createdAt)}</span>
                                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink">{comment.text}</p>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                    </>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </RequireAuth>
  );
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel p-5 sm:p-6">
      <h2 className="rarity-text mb-3 font-display text-lg font-bold">{title}</h2>
      <div className="text-base leading-7 text-ink">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold text-ink">{value?.trim() || '—'}</dd>
    </div>
  );
}
