import type { ReactNode } from 'react';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { CoinIcon } from '@/components/game/game-ui';
import { helperByReward } from '@/lib/quiz-helpers';

const TINTS = {
  info: 'bg-info/15 text-info',
  danger: 'bg-danger/15 text-danger',
  primary: 'bg-primary/20 text-primary-strong dark:text-primary',
  violet: 'bg-violet/15 text-violet-strong dark:text-violet',
  accent: 'bg-accent/15 text-accent-strong dark:text-accent',
  success: 'bg-success/15 text-success-strong dark:text-success',
} as const;

/** Ícone e cor de cada tipo de recompensa (loja, resultado, passe, baú). */
export function rewardVisual(type?: string | null, size = 40): { icon: ReactNode; tint: string } {
  const sx = { fontSize: size };
  const helper = helperByReward(type);
  if (helper) return { icon: <span className="inline-flex [&_svg]:!text-[length:inherit]" style={{ fontSize: size }}>{helper.icon}</span>, tint: TINTS[helper.tone] };
  switch (type) {
    case 'STICKER':
      return { icon: <MenuBookRoundedIcon sx={sx} />, tint: TINTS.violet };
    case 'STICKER_PACK':
      return { icon: <CardGiftcardRoundedIcon sx={sx} />, tint: 'bg-[linear-gradient(135deg,var(--violet),var(--info))] text-white' };
    case 'EXTRA_LIFE':
      return { icon: <FavoriteRoundedIcon sx={sx} />, tint: TINTS.danger };
    case 'EXTRA_TIME':
      return { icon: <TimerRoundedIcon sx={sx} />, tint: TINTS.info };
    case 'FIFTY_FIFTY':
      return { icon: <ContentCutRoundedIcon sx={sx} />, tint: TINTS.violet };
    case 'STREAK_FREEZE':
      return { icon: <ShieldRoundedIcon sx={sx} />, tint: TINTS.info };
    case 'COINS':
      return { icon: <CoinIcon className="h-[1em] w-[1em]" />, tint: TINTS.primary };
    case 'COSMETIC':
      return { icon: <PaletteRoundedIcon sx={sx} />, tint: TINTS.accent };
    default:
      return { icon: <BoltRoundedIcon sx={sx} />, tint: TINTS.primary };
  }
}
