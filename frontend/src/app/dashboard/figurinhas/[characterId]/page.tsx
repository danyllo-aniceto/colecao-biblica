'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { RequireAuth } from '@/components/auth/require-auth';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MermaidDiagram } from '@/components/ui/mermaid-diagram';
import { RichContent } from '@/components/ui/rich-content';
import {
  createComment,
  getCollection,
  getMyComments,
  listCharacters,
  updateComment,
  type CharacterEntry,
  type CommentEntry,
} from '@/lib/user-api';
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

function toChipList(value?: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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

  const rarityBadgeClassName = useMemo(() => {
    if (!character) {
      return '';
    }

    return rarityConfig[character.rarity].badge;
  }, [character]);

  const keywordChips = useMemo(() => toChipList(character?.keywords), [character?.keywords]);
  const keyVersesChips = useMemo(() => toChipList(character?.keyVerses), [character?.keyVerses]);

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
            <>
              <Card className="border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_74%,white)]">
                <CardHeader>
                  <CardTitle>{character.name}</CardTitle>
                  <CardDescription>
                    {isOwned ? 'Resumo da figurinha' : 'Desbloqueie esta figurinha para visualizar os detalhes completos.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isOwned ? (
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                      <RichContent value={character.shortSummary} />
                    </div>
                  ) : null}

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
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
                        <RichContent value={character.fullDescription} />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <DetailBlock title="Livros bíblicos">
                          <p>{character.bibleBooks ?? '-'}</p>
                        </DetailBlock>
                        <DetailBlock title="Papel narrativo">
                          <RichContent value={character.narrativeRole} />
                        </DetailBlock>
                        <DetailBlock title="Período histórico">
                          <RichContent value={character.historicalPeriod} />
                        </DetailBlock>
                        <DetailBlock title="Curiosidades">
                          <RichContent value={character.curiosities} />
                        </DetailBlock>
                        <DetailBlock title="Referências bíblicas">
                          <RichContent value={character.bibleReferences} />
                        </DetailBlock>
                      </div>

                      {character.genealogy?.trim() ? (
                        <DetailBlock title="Genealogia">
                          <MermaidDiagram code={character.genealogy} className="[&_svg]:h-auto [&_svg]:w-full" />
                        </DetailBlock>
                      ) : null}

                      {character.importantEvents?.trim() ? (
                        <DetailBlock title="Eventos importantes">
                          <MermaidDiagram code={character.importantEvents} className="[&_svg]:h-auto [&_svg]:w-full" />
                        </DetailBlock>
                      ) : null}

                      {keyVersesChips.length > 0 ? (
                        <DetailBlock title="Versículos-chave">
                          <div className="flex flex-wrap gap-2">
                            {keyVersesChips.map((chip) => (
                              <Badge key={chip} className="bg-[color-mix(in_srgb,var(--gold)_18%,transparent)] text-[var(--text-primary)]">
                                {chip}
                              </Badge>
                            ))}
                          </div>
                        </DetailBlock>
                      ) : null}

                      {keywordChips.length > 0 ? (
                        <DetailBlock title="Palavras-chave">
                          <div className="flex flex-wrap gap-2">
                            {keywordChips.map((chip) => (
                              <Badge key={chip} className="bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--text-primary)]">
                                {chip}
                              </Badge>
                            ))}
                          </div>
                        </DetailBlock>
                      ) : null}
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
                  <CardDescription>Comentários ficam abaixo do conteúdo da figurinha para facilitar o estudo.</CardDescription>
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
            </>
          ) : null}
        </div>
      </main>
    </RequireAuth>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{title}</p>
      <div className="text-sm text-[var(--text-secondary)]">{children}</div>
    </div>
  );
}
