import { useState } from 'react';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import { Button } from '@/components/ui/button';
import { ReactionGlyph } from '@/components/game/player-look';

/** Mostra a reação como aparece numa conversa (com a animação escolhida) e deixa repetir. */
export function ReactionChatPreview({ reaction }: { reaction: { name: string; imageUrl?: string | null; style?: string | null; animation?: string | null } }) {
  const [round, setRound] = useState(0);
  const empty = !reaction.imageUrl && !reaction.style;
  return (
    <div className="space-y-2 rounded-3xl bg-surface-2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-muted">Prévia na conversa</p>
        <Button type="button" size="sm" variant="secondary" onClick={() => setRound((value) => value + 1)} disabled={empty}>
          <ReplayRoundedIcon fontSize="small" /> Repetir
        </Button>
      </div>
      <div className="space-y-2 rounded-2xl bg-bg p-3">
        <p className="w-fit max-w-[70%] rounded-2xl rounded-bl-md bg-surface-3 px-3 py-2 text-sm text-ink">Que alegria te ver aqui!</p>
        <div className="flex min-h-24 justify-end">
          {empty ? <span className="self-center text-sm text-muted">Escolha um emoji ou envie uma imagem.</span> : <ReactionGlyph key={round} reaction={reaction} size="lg" animate />}
        </div>
      </div>
    </div>
  );
}
