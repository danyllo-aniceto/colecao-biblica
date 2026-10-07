import { PlayerAvatar, PlayerName } from '@/components/game/player-look';
import { ProgressBar } from '@/components/game/game-ui';
import { AlbumIntro } from '@/components/user/album-book';
import { albumCoverStyle, surfaceStyle } from '@/lib/look-background';
import type { Cosmetic } from '@/lib/rewards-api';

type Surface = Pick<Cosmetic, 'imageUrl' | 'color'>;

/** Cabeçalho do perfil com o fundo equipado, igual ao que o jogador vê (película clara à esquerda para o texto). */
export function ProfileBgPreview({ item, name = 'Maria' }: { item: Surface; name?: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted">Assim fica o cartão de perfil do jogador:</p>
      <section className="panel relative overflow-hidden p-5" style={surfaceStyle(item)}>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/65 to-surface/20" />
        <div className="relative flex flex-wrap items-center gap-4">
          <PlayerAvatar look={{ avatarUrl: '/avatars/pomba.svg', frame: null }} name={name} size="xl" />
          <div className="min-w-0 flex-1">
            <PlayerName name={name} look={null} nameClassName="text-2xl" />
            <p className="text-sm font-semibold text-muted">maria@email.com</p>
            <div className="mt-2 max-w-xs space-y-1">
              <div className="flex justify-between text-xs font-bold text-muted">
                <span>Nível 12</span>
                <span>340/900 XP</span>
              </div>
              <ProgressBar value={38} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** O álbum fechado em cima da folha de abertura, com a capa equipada: cor do livro e, se houver, a imagem em tela cheia. */
export function AlbumCoverPreview({ item }: { item: Surface }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted">Assim fica o álbum do jogador (folha de abertura):</p>
      <div className="mx-auto w-56">
        <div className="album-cover rounded-[1.5rem] p-2" style={albumCoverStyle(item)}>
          <div className="album-paper album-paper-right relative flex aspect-[2/3] overflow-hidden rounded-2xl p-2">
            <AlbumIntro items={[]} ownedCount={12} totalCharacters={40} coverImage={item.imageUrl} />
          </div>
        </div>
      </div>
    </div>
  );
}
