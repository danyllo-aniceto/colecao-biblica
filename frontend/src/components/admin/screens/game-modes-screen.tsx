import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { errorMessage, useToast } from '@/components/ui/toast';
import { saveGameModeImage, useGameModeImages, type GameMode } from '@/lib/game-modes';
import { AdminPanel } from '../admin-ui';
import { ImageUploadField } from '../image-upload-field';

const MODES: Array<{ id: GameMode; title: string; hint: string }> = [
  { id: 'QUIZ', title: 'Quiz Bíblico', hint: 'O jogo principal: perguntas, XP, moedas e baús.' },
  { id: 'BOARD', title: 'Tabuleiro', hint: 'Jogo de dado e perguntas com os amigos.' },
  { id: 'DUEL', title: 'Duelo de Figurinhas', hint: 'Jogo de figurinhas com Dons, arenas e turnos.' },
];

/** Capas dos três jogos da aba Jogar. Sem imagem, o app usa um fundo colorido padrão. */
export function GameModesScreen() {
  const toast = useToast();
  const saved = useGameModeImages();
  const [drafts, setDrafts] = useState<Partial<Record<GameMode, string>>>({});
  const [saving, setSaving] = useState<GameMode | null>(null);

  // Quando as capas chegam do servidor, os campos mostram o que está salvo (sem apagar o que a pessoa já mexeu).
  useEffect(() => {
    setDrafts((current) => Object.fromEntries(MODES.map((mode) => [mode.id, current[mode.id] ?? saved[mode.id] ?? ''])));
  }, [saved]);

  async function save(mode: GameMode) {
    setSaving(mode);
    try {
      await saveGameModeImage(mode, (drafts[mode] ?? '').trim() || null);
      toast.success('Capa salva.');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(null);
    }
  }

  return (
    <AdminPanel
      title="Capas dos jogos"
      description="Cada jogo da aba Jogar tem um cartão com uma imagem. Envie imagens horizontais de 1600 × 1000 px (16:10), sem texto e com o assunto no centro; o título do jogo aparece escrito por cima da parte de baixo. Vazio usa um fundo colorido padrão."
    >
      <div className="space-y-4">
        {MODES.map((mode) => {
          const value = drafts[mode.id] ?? '';
          const changed = value !== (saved[mode.id] ?? '');
          return (
            <article key={mode.id} className="gap-4 space-y-3 rounded-3xl border-2 border-edge bg-surface p-4 md:flex md:space-y-0">
              <div className="relative aspect-[16/10] w-full shrink-0 self-start overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-accent md:w-72">
                {value ? <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" /> : null}
                <span className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-3 left-3 font-display text-xl font-bold text-white drop-shadow">{mode.title}</span>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <Field label={mode.title} hint={mode.hint}>
                  <ImageUploadField value={value} onChange={(url) => setDrafts((current) => ({ ...current, [mode.id]: url }))} wide />
                </Field>
                <Button size="sm" onClick={() => void save(mode.id)} loading={saving === mode.id} disabled={!changed}>
                  Salvar capa
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </AdminPanel>
  );
}
