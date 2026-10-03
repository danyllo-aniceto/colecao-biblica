import { useState } from 'react';
import { cn } from '@/lib/cn';

/** Emojis prontos para escolher, por assunto (o campo de texto continua aceitando qualquer emoji). */
const GROUPS: Array<{ label: string; emojis: string[] }> = [
  { label: 'Fé', emojis: ['🙏', '✝️', '📖', '🕊️', '🕎', '⛪', '👼', '🌈', '🐑', '🐟', '🍞', '🍷', '👑', '🔥', '⭐', '🌅', '🕯️', '📜', '🏺', '⚓', '🪨', '🌿', '🍇', '🕍', '✨', '🙌', '🛐', '📿'] },
  { label: 'Carinhas', emojis: ['😀', '😂', '🥹', '😍', '😇', '🤗', '😢', '😭', '😮', '😎', '🥳', '🤩', '😅', '🙂', '🤔', '😴', '😡', '🥰', '😬', '🤯', '😋', '🫡', '😏', '🤭'] },
  { label: 'Gestos', emojis: ['👏', '🙌', '👍', '👎', '💪', '🤝', '👋', '✋', '🫶', '❤️', '💛', '💚', '💙', '💜', '🧡', '🤍', '☝️', '🤞', '✌️', '👀', '🫂', '💯', '❤️‍🔥', '💔'] },
  { label: 'Festa', emojis: ['🎉', '🎊', '🎁', '🏆', '🥇', '🎈', '🌟', '💫', '💥', '🎶', '🎵', '🎂', '🥁', '🎺', '📣', '🎯', '🎖️', '🏅', '🚀', '⚡', '🍀', '🎄', '🐣', '🎆'] },
  { label: 'Natureza', emojis: ['☀️', '🌙', '🌧️', '⛈️', '❄️', '🌊', '🌸', '🌳', '🐦', '🦁', '🐪', '🐋', '🐍', '🐑', '🐕', '🦅', '🐴', '🌾', '🏔️', '🌋', '🌴', '🍎', '🫒', '🌹'] },
];

/** Grade de emojis para clicar. `value` destaca o escolhido. */
export function EmojiPicker({ value, onPick }: { value: string; onPick: (emoji: string) => void }) {
  const [group, setGroup] = useState(0);
  return (
    <div className="space-y-2 rounded-2xl border border-edge bg-surface-2 p-3">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Assuntos dos emojis">
        {GROUPS.map((item, index) => (
          <button
            key={item.label}
            type="button"
            role="tab"
            aria-selected={group === index}
            onClick={() => setGroup(index)}
            className={cn('h-8 shrink-0 rounded-full px-3 font-display text-sm font-semibold transition', group === index ? 'bg-ink text-bg' : 'bg-surface text-muted hover:text-ink')}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 sm:grid-cols-9" role="tabpanel">
        {GROUPS[group].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            aria-label={`Usar ${emoji}`}
            aria-pressed={value === emoji}
            className={cn('flex h-10 items-center justify-center rounded-xl text-2xl transition hover:scale-110 hover:bg-surface-3', value === emoji && 'bg-primary/25 ring-2 ring-primary')}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
