import { useEffect, useMemo } from 'react';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { useBoardMusicOverride } from '@/lib/sound/board-music';
import { setMusicTrack } from '@/lib/sound/music';
import { useSoundSettings } from '@/lib/sound/settings';

/**
 * Decide qual música toca. No quiz é sempre a do tema do nível do jogador e no tabuleiro a do cenário da partida; fora dele vale a
 * escolhida nos ajustes (padrão: a do tema do nível). Só toca música já liberada.
 */
export function MusicController({ inQuiz }: { inQuiz: boolean }) {
  const { campaign, current } = useCampaign();
  const settings = useSoundSettings();
  const boardMusic = useBoardMusicOverride();

  const src = useMemo(() => {
    if (!settings.musicEnabled) return null;
    if (boardMusic) return boardMusic;
    const chosen = inQuiz || settings.track === 'auto' ? current : (campaign?.scenarios.find((scenario) => scenario.slug === settings.track) ?? current);
    return chosen?.musicUnlocked ? chosen.musicUrl : null;
  }, [boardMusic, campaign, current, inQuiz, settings.musicEnabled, settings.track]);

  useEffect(() => {
    setMusicTrack(src);
  }, [src]);

  // Ao sair do painel (sair da conta), a música para.
  useEffect(() => () => setMusicTrack(null), []);

  return null;
}
