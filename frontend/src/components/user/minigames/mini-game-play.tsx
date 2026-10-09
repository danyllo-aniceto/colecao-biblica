import { ChainGame } from '@/components/user/minigames/games/chain-game';
import { CrosswordGame } from '@/components/user/minigames/games/crossword-game';
import { LineageGame } from '@/components/user/minigames/games/lineage-game';
import { MapGame } from '@/components/user/minigames/games/map-game';
import { TimelineGame } from '@/components/user/minigames/games/timeline-game';
import { AnagramGame, anagramSetup } from '@/components/user/minigames/games/anagram-game';
import { BlanksGame } from '@/components/user/minigames/games/blanks-game';
import { BlitzGame } from '@/components/user/minigames/games/blitz-game';
import { BooksGame, booksSetup } from '@/components/user/minigames/games/books-game';
import { TestamentGame, testamentSetup } from '@/components/user/minigames/games/testament-game';
import { WhoAmIGame } from '@/components/user/minigames/games/whoami-game';
import { HangmanGame, hangmanSetup } from '@/components/user/minigames/games/hangman-game';
import { MazeGame } from '@/components/user/minigames/games/maze-game';
import { MemoryGame } from '@/components/user/minigames/games/memory-game';
import { MiniGameFrame } from '@/components/user/minigames/games/play-frame';
import { SwapPuzzleGame } from '@/components/user/minigames/games/swap-puzzle-game';
import { VerseGame } from '@/components/user/minigames/games/verse-game';
import { WordSearchGame, wordSearchSetup } from '@/components/user/minigames/games/wordsearch-game';
import type { ChainPuzzle, CrosswordPuzzle, LineagePuzzle, MapPuzzle, TimelinePuzzle, AnagramPuzzle, BlanksPuzzle, BlitzPuzzle, BooksPuzzle, TestamentPuzzle, WhoAmIPuzzle, HangmanPuzzle, MazePuzzle, MemoryPuzzle, MiniGameInfo, SwapPuzzle, VersePuzzle, WordSearchPuzzle } from '@/lib/minigames-api';

type Props = { game: MiniGameInfo; onExit: () => void; onWallet: (wallet: { userCoins: number }) => void };

/** Abre a tela do mini game escolhido dentro da moldura comum (relógio, resultado, moedas). */
export function MiniGamePlay({ game, onExit, onWallet }: Props) {
  switch (game.id) {
    case 'caca-palavras':
      return <MiniGameFrame<WordSearchPuzzle> game={game} onExit={onExit} onWallet={onWallet} setup={wordSearchSetup}>{(props) => <WordSearchGame {...props} />}</MiniGameFrame>;
    case 'forca':
      return <MiniGameFrame<HangmanPuzzle> game={game} onExit={onExit} onWallet={onWallet} setup={hangmanSetup}>{(props) => <HangmanGame {...props} />}</MiniGameFrame>;
    case 'quebra-cabeca':
      return <MiniGameFrame<SwapPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <SwapPuzzleGame {...props} />}</MiniGameFrame>;
    case 'memoria':
      return <MiniGameFrame<MemoryPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <MemoryGame {...props} />}</MiniGameFrame>;
    case 'versiculo':
      return <MiniGameFrame<VersePuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <VerseGame {...props} />}</MiniGameFrame>;
    case 'labirinto':
      return <MiniGameFrame<MazePuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <MazeGame {...props} />}</MiniGameFrame>;
    case 'anagrama':
      return <MiniGameFrame<AnagramPuzzle> game={game} onExit={onExit} onWallet={onWallet} setup={anagramSetup}>{(props) => <AnagramGame {...props} />}</MiniGameFrame>;
    case 'testamento':
      return <MiniGameFrame<TestamentPuzzle> game={game} onExit={onExit} onWallet={onWallet} setup={testamentSetup}>{(props) => <TestamentGame {...props} />}</MiniGameFrame>;
    case 'livros':
      return <MiniGameFrame<BooksPuzzle> game={game} onExit={onExit} onWallet={onWallet} setup={booksSetup}>{(props) => <BooksGame {...props} />}</MiniGameFrame>;
    case 'relampago':
      return <MiniGameFrame<BlitzPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <BlitzGame {...props} />}</MiniGameFrame>;
    case 'lacunas':
      return <MiniGameFrame<BlanksPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <BlanksGame {...props} />}</MiniGameFrame>;
    case 'quem-sou-eu':
      return <MiniGameFrame<WhoAmIPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <WhoAmIGame {...props} />}</MiniGameFrame>;
    case 'linha-do-tempo':
      return <MiniGameFrame<TimelinePuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <TimelineGame {...props} />}</MiniGameFrame>;
    case 'mapa':
      return <MiniGameFrame<MapPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <MapGame {...props} />}</MiniGameFrame>;
    case 'arvore':
      return <MiniGameFrame<LineagePuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <LineageGame {...props} />}</MiniGameFrame>;
    case 'interconexao':
      return <MiniGameFrame<ChainPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <ChainGame {...props} />}</MiniGameFrame>;
    case 'palavras-cruzadas':
      return <MiniGameFrame<CrosswordPuzzle> game={game} onExit={onExit} onWallet={onWallet}>{(props) => <CrosswordGame {...props} />}</MiniGameFrame>;
    default:
      return null;
  }
}
