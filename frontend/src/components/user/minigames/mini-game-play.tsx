import { HangmanGame } from '@/components/user/minigames/games/hangman-game';
import { MazeGame } from '@/components/user/minigames/games/maze-game';
import { MemoryGame } from '@/components/user/minigames/games/memory-game';
import { MiniGameFrame } from '@/components/user/minigames/games/play-frame';
import { SwapPuzzleGame } from '@/components/user/minigames/games/swap-puzzle-game';
import { VerseGame } from '@/components/user/minigames/games/verse-game';
import { WordSearchGame } from '@/components/user/minigames/games/wordsearch-game';
import type { HangmanPuzzle, MazePuzzle, MemoryPuzzle, MiniGameInfo, SwapPuzzle, VersePuzzle, WordSearchPuzzle } from '@/lib/minigames-api';

type Props = { game: MiniGameInfo; onExit: () => void; onWallet: (wallet: { userCoins: number }) => void };

/** Abre a tela do mini game escolhido dentro da moldura comum (relógio, resultado, moedas). */
export function MiniGamePlay({ game, onExit, onWallet }: Props) {
  switch (game.id) {
    case 'caca-palavras':
      return <MiniGameFrame<WordSearchPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <WordSearchGame {...props} />}</MiniGameFrame>;
    case 'forca':
      return <MiniGameFrame<HangmanPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <HangmanGame {...props} />}</MiniGameFrame>;
    case 'quebra-cabeca':
      return <MiniGameFrame<SwapPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <SwapPuzzleGame {...props} />}</MiniGameFrame>;
    case 'memoria':
      return <MiniGameFrame<MemoryPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <MemoryGame {...props} />}</MiniGameFrame>;
    case 'versiculo':
      return <MiniGameFrame<VersePuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <VerseGame {...props} />}</MiniGameFrame>;
    case 'labirinto':
      return <MiniGameFrame<MazePuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <MazeGame {...props} />}</MiniGameFrame>;
    default:
      return null;
  }
}
