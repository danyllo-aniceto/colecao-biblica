import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { cn } from '@/lib/cn';

/** As 3 estrelas de uma fase: terminar, pegar todas as palavras e terminar sem cair (sem voltar a checkpoint). */
export function RunStars({ finished, allWords, clean, className }: { finished: boolean; allWords: boolean; clean: boolean; className?: string }) {
  const items = [
    { label: 'Terminou', on: finished },
    { label: 'Todas as palavras', on: finished && allWords },
    { label: 'Sem cair', on: finished && clean },
  ];
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label="Estrelas da fase">
      {items.map((item) => (
        <li key={item.label} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', item.on ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted')}>
          <StarRoundedIcon sx={{ fontSize: 14 }} aria-hidden="true" />
          {item.label}
          <span className="sr-only">{item.on ? ' (conquistada)' : ' (ainda não)'}</span>
        </li>
      ))}
    </ul>
  );
}
