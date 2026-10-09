import { useEffect, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { getMiniGames, saveMiniGameDesign, type MiniGameInfo } from '@/lib/minigames-api';
import { AdminPanel } from '../admin-ui';
import { ImageUploadField } from '../image-upload-field';

type Draft = { coverUrl: string; backgroundUrl: string; backUrl: string };

/** Capa do cartão e fundo da tela de cada mini game. Sem imagem, o cartão fica só com o ícone e a tela usa a cor do tema. */
export function MiniGamesVisualScreen() {
  const toast = useToast();
  const [games, setGames] = useState<MiniGameInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const list = usePagination(games ?? [], 5);

  useEffect(() => {
    getMiniGames()
      .then((overview) => {
        setGames(overview.games);
        setDrafts(Object.fromEntries(overview.games.map((game) => [game.id, { coverUrl: game.coverUrl ?? '', backgroundUrl: game.backgroundUrl ?? '', backUrl: game.backUrl ?? '' }])));
      })
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, []);

  async function save(game: MiniGameInfo) {
    const draft = drafts[game.id];
    setSaving(game.id);
    try {
      const saved = await saveMiniGameDesign(game.id, { coverUrl: draft.coverUrl.trim() || null, backgroundUrl: draft.backgroundUrl.trim() || null, ...(game.id === 'memoria' ? { backUrl: draft.backUrl.trim() || null } : {}) });
      setGames((current) => (current ?? []).map((item) => (item.id === game.id ? { ...item, coverUrl: saved.coverUrl, backgroundUrl: saved.backgroundUrl, backUrl: saved.backUrl } : item)));
      toast.success('Imagens do jogo salvas.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminPanel
      title="Visual dos mini games"
      description="Cada mini game tem uma capa no cartão da lista (horizontal 16:9, 1600 × 900 px, sem texto) e um fundo na tela de jogo (vertical 9:16, 1080 × 1920 px, com a arte mais discreta no centro, onde ficam a grade e os botões). O app clareia o fundo para o jogo continuar legível."
    >
      {!games ? (
        error ? (
          <Alert tone="danger">{error}</Alert>
        ) : (
          <LoadingState label="Carregando mini games..." />
        )
      ) : (
        <div className="space-y-4">
          {list.pageItems.map((game) => {
            const draft = drafts[game.id] ?? { coverUrl: '', backgroundUrl: '', backUrl: '' };
            const changed = draft.coverUrl !== (game.coverUrl ?? '') || draft.backgroundUrl !== (game.backgroundUrl ?? '') || draft.backUrl !== (game.backUrl ?? '');
            const update = (patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [game.id]: { ...draft, ...patch } }));
            return (
              <article key={game.id} className="space-y-4 rounded-3xl border-2 border-edge bg-surface p-4">
                <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
                  <span aria-hidden>{game.emoji}</span> {game.name}
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Capa do cartão" hint="Horizontal 16:9 · 1600 × 900 px">
                    <div className="space-y-2">
                      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent">{draft.coverUrl ? <img src={draft.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}</div>
                      <ImageUploadField value={draft.coverUrl} onChange={(url) => update({ coverUrl: url })} wide />
                    </div>
                  </Field>
                  <Field label="Fundo da tela de jogo" hint="Vertical 9:16 · 1080 × 1920 px">
                    <div className="space-y-2">
                      <div className="relative mx-auto aspect-[9/16] w-32 overflow-hidden rounded-2xl bg-surface-3">
                        {draft.backgroundUrl ? <img src={draft.backgroundUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                        {draft.backgroundUrl ? <span className="absolute inset-0 bg-bg/55" /> : null}
                        <span className="absolute inset-x-3 top-1/3 grid aspect-square grid-cols-4 gap-0.5 rounded-lg bg-surface/80 p-1" aria-hidden>
                          {Array.from({ length: 16 }, (_, index) => (
                            <span key={index} className="rounded-sm bg-surface-3" />
                          ))}
                        </span>
                      </div>
                      <ImageUploadField value={draft.backgroundUrl} onChange={(url) => update({ backgroundUrl: url })} wide />
                    </div>
                  </Field>
                </div>
                {game.id === 'memoria' ? (
                  <Field label="Verso das cartas" hint="Vertical 3:4 · 768 × 1024 px · aparece em todas as cartas viradas para baixo; deixe o enfeite no centro e sem texto">
                    <div className="space-y-2">
                      <div className="relative mx-auto aspect-[3/4] w-24 overflow-hidden rounded-xl bg-gradient-to-br from-primary to-accent">{draft.backUrl ? <img src={draft.backUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-2xl text-on-primary opacity-80">✦</span>}</div>
                      <ImageUploadField value={draft.backUrl} onChange={(url) => update({ backUrl: url })} wide />
                    </div>
                  </Field>
                ) : null}
                <Button size="sm" onClick={() => void save(game)} loading={saving === game.id} disabled={!changed}>
                  Salvar imagens
                </Button>
              </article>
            );
          })}
          <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} onPageChange={list.setPage} itemLabel="mini games" />
        </div>
      )}
    </AdminPanel>
  );
}
