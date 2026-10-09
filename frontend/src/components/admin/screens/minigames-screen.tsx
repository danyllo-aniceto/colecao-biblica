import { MiniGamesHub } from '@/components/user/minigames/minigames-hub';
import { AdminPanel } from '../admin-ui';

/** Mini games para o administrador testar: todos os jogos liberados (o servidor reconhece o papel) e placar fora do ranking dos jogadores. */
export function MiniGamesScreen() {
  return (
    <AdminPanel title="Testar mini games" description="Jogue aqui os mini games como um jogador: estão todos liberados para você. As moedas ganhas vão para a sua conta de administrador e o seu placar não aparece no ranking dos jogadores.">
      <div className="mx-auto max-w-2xl">
        <MiniGamesHub onWallet={() => undefined} />
      </div>
    </AdminPanel>
  );
}
