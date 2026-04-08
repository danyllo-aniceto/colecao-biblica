'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createComment, getCollection, getMyComments, listCharacters, updateComment, type CharacterEntry, type CommentEntry } from '@/lib/user-api';
import { rarityConfig } from '@/lib/rarity-theme';

function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function StickerDetailsPage() {
  const router = useRouter();
  const params = useParams<{ characterId: string }>();
  const { accessToken } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [character, setCharacter] = useState<CharacterEntry | null>(null);
  const [isOwned, setIsOwned] = useState(false);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
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
        const token = accessToken as string;
        const [characters, collection, myComments] = await Promise.all([
          listCharacters(token),
          getCollection(token),
          getMyComments(token),
        ]);

        if (ignore) {
          return;
        }

        const selectedCharacter = characters.find((item) => item.id === parsedCharacterId) ?? null;

        if (!selectedCharacter) {
          setError('Figurinha não encontrada.');
          setCharacter(null);
          setLoading(false);
          return;
        }

        const owned = collection.some((item) => item.characterId === parsedCharacterId);
        const characterComments = myComments.filter((comment) => comment.characterId === parsedCharacterId).sort((left, right) => {
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

  const rarityBadgeClassName = useMemo(() => {
    if (!character) {
      return '';
    }

    return rarityConfig[character.rarity].badge;
  }, [character]);

  async function handleSaveComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !character || !isOwned || !commentDraft.trim()) {
      return;
    }

    setCommentSubmitting(true);
    setCommentError(null);

    try {
      const token = accessToken as string;
      if (commentEditingId === null) {
        const created = await createComment(token, {
          characterId: character.id,
          text: commentDraft.trim(),
        });

        setComments((current) => [created, ...current]);
        setCommentEditingId(created.id);
      } else {
        const updated = await updateComment(token, commentEditingId, { text: commentDraft.trim() });
        setComments((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      }
    } catch (saveError) {
      setCommentError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o comentário.');
    } finally {
      setCommentSubmitting(false);
    }
  }

  return (
    <RequireAuth>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--gold)_18%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_srgb,var(--bg-primary)_92%,white),var(--bg-primary))] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => router.push('/dashboard')}>
              <ArrowBackRoundedIcon />
              Voltar para figurinhas
            </Button>
          </div>

          {loading ? (
            <Card className="border-[var(--border)]">
              <CardContent className="p-6 text-sm text-[var(--text-secondary)]">Carregando detalhes da figurinha...</CardContent>
            </Card>
          ) : null}

          {error ? (
            <Card className="border-[var(--border)]">
              <CardContent className="p-6 text-sm text-red-700">{error}</CardContent>
            </Card>
          ) : null}

          {!loading && !error && character ? (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <Card className="border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_74%,white)]">
                <CardHeader>
                  <CardTitle>{character.name}</CardTitle>
                  <CardDescription>{isOwned ? character.shortSummary : 'Desbloqueie esta figurinha para visualizar os detalhes completos.'}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="overflow-hidden rounded-3xl border border-[var(--border)]">
                    {character.imageUrl ? (
                      <img src={character.imageUrl} alt={character.name} className={isOwned ? '' : 'blur-[3px] grayscale'} />
                    ) : (
                      <div className="flex h-64 items-center justify-center bg-[linear-gradient(135deg,color-mix(in_srgb,var(--gold)_18%,transparent),color-mix(in_srgb,var(--bg-secondary)_84%,white))] text-[var(--accent)]">
                        <CollectionsBookmarkRoundedIcon fontSize="large" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge className={rarityBadgeClassName}>{rarityConfig[character.rarity].label}</Badge>
                    {isOwned ? <Badge>Desbloqueada</Badge> : <Badge>Bloqueada</Badge>}
                  </div>

                  {isOwned ? (
                    <>
                      <p className="text-sm leading-6 text-[var(--text-secondary)]">{character.fullDescription}</p>

                      <div className="grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
                        <DetailLine label="Referências" value={character.bibleReferences ?? '-'} />
                        <DetailLine label="Livro(s)" value={character.bibleBooks ?? '-'} />
                        <DetailLine label="Período" value={character.historicalPeriod ?? '-'} />
                        <DetailLine label="Função" value={character.narrativeRole ?? '-'} />
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                      <div className="flex items-center gap-2 font-medium text-[var(--text-primary)]">
                        <LockRoundedIcon fontSize="small" />
                        Conteúdo bloqueado
                      </div>
                      <p className="mt-2">Volte para a coleção e desbloqueie esta figurinha para acessar descrição e comentários.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_74%,white)]">
                <CardHeader>
                  <CardTitle>Meus comentários</CardTitle>
                  <CardDescription>Escreva uma anotação pessoal sobre esta figurinha.</CardDescription>
                </CardHeader>
                <CardContent>
                  {isOwned ? (
                    <>
                      <form className="space-y-4" onSubmit={handleSaveComment}>
                        <textarea
                          className="min-h-36 w-full rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none"
                          value={commentDraft}
                          onChange={(event) => setCommentDraft(event.target.value)}
                          placeholder="Escreva aqui sua reflexão sobre este personagem..."
                        />
                        {commentError ? <p className="text-sm text-red-700">{commentError}</p> : null}
                        <Button type="submit" disabled={commentSubmitting}>
                          {commentSubmitting ? 'Salvando...' : commentEditingId ? 'Atualizar comentário' : 'Salvar comentário'}
                        </Button>
                      </form>

                      <div className="mt-5 space-y-3">
                        {comments.length > 0 ? (
                          comments.map((comment) => (
                            <div key={comment.id} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-[var(--text-primary)]">{comment.characterName}</p>
                                <span className="text-xs text-[var(--text-secondary)]">{formatDate(comment.updatedAt ?? comment.createdAt)}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{comment.text}</p>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-[var(--text-secondary)]">Nenhum comentário salvo para esta figurinha.</p>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                      Desbloqueie a figurinha para escrever comentários.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </main>
    </RequireAuth>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
