import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import FormatQuoteRoundedIcon from '@mui/icons-material/FormatQuoteRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/game/game-ui';
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
} from '@/lib/user-api';
import { getRarityLabel } from '@/lib/rarity-theme';

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
  const [locked, setLocked] = useState(false);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentEditingId, setCommentEditingId] = useState<number | null>(null);

  const parsedCharacterId = Number(params.characterId);

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
        const owned = collection.some((item) => item.characterId === parsedCharacterId);
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

  const keywordChips = useMemo(() => toChipList(character?.keywords), [character?.keywords]);
  const keyVersesChips = useMemo(() => toChipList(character?.keyVerses), [character?.keyVerses]);

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
        <Button type="button" variant="ghost" onClick={() => navigate('/dashboard')} className="-ml-2">
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
            <Button size="lg" onClick={() => navigate('/dashboard')}>
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
                <StickerCard name={character.name} rarity={character.rarity} imageUrl={character.imageUrl} owned={isOwned} size="lg" />
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
                  </div>
                  {isOwned ? (
                    <>
                      <div className="mt-4 text-lg text-muted">
                        <RichContent value={character.shortSummary} />
                      </div>
                      {character.bibleBooks ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                          {toChipList(character.bibleBooks).map((book) => (
                            <Badge key={book} tone="violet">
                              <AutoStoriesRoundedIcon sx={{ fontSize: 14 }} />
                              {book}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <div className="text-lg text-muted">
                        <RichContent value={character.shortSummary} />
                      </div>
                      <p className="flex items-center gap-2 font-semibold text-muted">
                        <LockRoundedIcon /> Conquiste esta figurinha para ler a história completa.
                      </p>
                      <Button size="lg" onClick={() => navigate('/dashboard')}>
                        <PlayArrowRoundedIcon />
                        Jogar para conquistar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {isOwned ? (
              <>
                <InfoPanel title="História">
                  <RichContent value={character.fullDescription} />
                </InfoPanel>

                <div className="grid gap-4 sm:grid-cols-2">
                  {character.curiosities ? (
                    <InfoPanel title="Curiosidades">
                      <RichContent value={character.curiosities} />
                    </InfoPanel>
                  ) : null}
                  {character.bibleReferences ? (
                    <InfoPanel title="Onde ler">
                      <RichContent value={character.bibleReferences} />
                    </InfoPanel>
                  ) : null}
                </div>

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

                {keyVersesChips.length > 0 || keywordChips.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
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
                  </div>
                ) : null}

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
