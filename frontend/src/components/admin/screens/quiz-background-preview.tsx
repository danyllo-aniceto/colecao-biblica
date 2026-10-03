import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import { quizBackgroundStyle } from '@/lib/quiz-background';

const OPTIONS = [
  { letter: 'A', tile: 'bg-danger text-white', text: 'Primeira alternativa' },
  { letter: 'B', tile: 'bg-info text-white', text: 'Segunda alternativa' },
  { letter: 'C', tile: 'bg-primary text-on-primary', text: 'Terceira alternativa' },
  { letter: 'D', tile: 'bg-success text-white', text: 'Quarta alternativa' },
];

/** Prévia de como a tela do quiz fica com o fundo e a cor do cenário (mesma película e mesmas cores do jogo). */
export function QuizBackgroundPreview({ imageUrl, color, name }: { imageUrl?: string | null; color?: string | null; name?: string }) {
  return (
    <div className="mx-auto w-full max-w-[15rem] space-y-2">
      <div className="contents" style={scenarioThemeVars(color ?? null)}>
        <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[1.75rem] border-4 border-edge-strong bg-bg shadow-lg" style={quizBackgroundStyle(imageUrl)}>
          <div className="flex h-full flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-surface-3 text-[10px] text-muted">✕</span>
              <div className="flex flex-1 gap-0.5">
                {[0, 1, 2, 3, 4].map((index) => (
                  <span key={index} className={index < 2 ? 'h-1.5 flex-1 rounded-full bg-accent' : index === 2 ? 'h-1.5 flex-1 rounded-full bg-primary' : 'h-1.5 flex-1 rounded-full bg-surface-3'} />
                ))}
              </div>
              <span className="flex text-danger">
                {[0, 1, 2].map((index) => (
                  <FavoriteRoundedIcon key={index} sx={{ fontSize: 14 }} />
                ))}
              </span>
            </div>
            <div className="panel p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-muted">Média</p>
              <p className="mt-1 font-display text-xs font-semibold leading-snug text-ink">{name ? `Pergunta de exemplo em ${name}` : 'Pergunta de exemplo'}</p>
            </div>
            <div className="mt-auto grid gap-1.5">
              {OPTIONS.map((option) => (
                <div key={option.letter} className={`flex items-center gap-2 rounded-2xl p-2 text-[10px] font-semibold ${option.tile}`}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg bg-black/15 font-bold">{option.letter}</span>
                  {option.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="text-center text-xs text-muted">{imageUrl ? 'Como fica no quiz deste cenário' : 'Sem imagem: o quiz usa o fundo padrão do tema'}</p>
    </div>
  );
}
