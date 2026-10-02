import { useState } from 'react';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Input, Textarea } from '@/components/ui/input';
import { MermaidDiagram } from '@/components/ui/mermaid-diagram';
import { Select } from '@/components/ui/select';
import { NEW_TESTAMENT_BOOKS, OLD_TESTAMENT_BOOKS } from '@/lib/bible-books';
import { cn } from '@/lib/cn';
import type { StickerRarity } from '@/lib/admin-api';
import { HISTORICAL_PERIODS } from '@/lib/labels';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { useDebouncedValue } from '../use-paged-list';

const RARITY_HINTS: Record<StickerRarity, string> = {
  COMMON: 'Personagens conhecidos, fáceis de conseguir.',
  RARE: 'Aparecem menos nos sorteios.',
  EPIC: 'Figuras centrais de uma história.',
  LEGENDARY: 'Só no sorteio ou no pacote surpresa.',
  SPECIAL: 'Única e intransferível: só se ganha na campanha.',
};

/** Escolha da raridade em cartões coloridos. */
export function RarityPicker({ value, onChange }: { value: StickerRarity; onChange: (value: StickerRarity) => void }) {
  return (
    <div role="radiogroup" aria-label="Raridade" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {RARITY_ORDER.map((rarity) => {
        const active = rarity === value;
        return (
          <button
            key={rarity}
            type="button"
            role="radio"
            aria-checked={active}
            data-rarity={rarity}
            onClick={() => onChange(rarity)}
            className={cn('rarity rounded-2xl border-2 p-3 text-left transition', active ? 'rarity-frame rarity-bg' : 'border-edge bg-surface-2 hover:border-[var(--r)]')}
          >
            <span className="rarity-text block font-display font-bold">{getRarityLabel(rarity)}</span>
            <span className="block text-xs text-muted">{RARITY_HINTS[rarity]}</span>
          </button>
        );
      })}
    </div>
  );
}

const OTHER = '__outro__';

/** Período histórico padronizado (lista) com opção de texto livre. */
export function PeriodField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const known = (HISTORICAL_PERIODS as readonly string[]).includes(value);
  const [custom, setCustom] = useState(Boolean(value) && !known);
  return (
    <div className="space-y-2">
      <Select
        aria-label="Período histórico"
        searchable
        value={custom ? OTHER : value}
        onChange={(next) => {
          if (next === OTHER) {
            setCustom(true);
            if (known) onChange('');
            return;
          }
          setCustom(false);
          onChange(next);
        }}
        options={[
          { value: '', label: 'Não definido' },
          ...HISTORICAL_PERIODS.map((period) => ({ value: period, label: period })),
          { value: OTHER, label: 'Outro (escrever)' },
        ]}
      />
      {custom ? <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Ex.: Período persa" maxLength={200} aria-label="Outro período" /> : null}
    </div>
  );
}

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Livros onde o personagem aparece: busca e botões por testamento. */
export function BibleBooksPicker({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState('');
  const term = normalize(query.trim());
  const toggle = (book: string) => onChange(value.includes(book) ? value.filter((item) => item !== book) : [...value, book]);

  function group(title: string, books: string[]) {
    const visible = term ? books.filter((book) => normalize(book).includes(term)) : books;
    if (visible.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted">{title}</h4>
        <div className="flex flex-wrap gap-1.5">
          {visible.map((book) => {
            const active = value.includes(book);
            return (
              <button
                key={book}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(book)}
                className={cn(
                  'rounded-full border-2 px-3 py-1 text-sm font-semibold transition',
                  active ? 'border-transparent bg-violet text-white' : 'border-edge bg-surface-2 text-muted hover:border-violet hover:text-ink',
                )}
              >
                {book}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border-2 border-edge p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filtrar livros (ex.: Samuel)" aria-label="Filtrar livros" className="h-10 flex-1" />
        <span className="text-sm font-semibold text-muted">{value.length} selecionado(s)</span>
        {value.length > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => onChange([])}>
            Limpar
          </Button>
        ) : null}
      </div>
      <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
        {group('Antigo Testamento', OLD_TESTAMENT_BOOKS)}
        {group('Novo Testamento', NEW_TESTAMENT_BOOKS)}
      </div>
    </div>
  );
}

type Template = { label: string; code: string };

/** Código Mermaid com modelos prontos e prévia (desenha depois que a digitação para). */
export function MermaidField({ value, onChange, templates, placeholder }: { value: string; onChange: (value: string) => void; templates: Template[]; placeholder: string }) {
  const { confirm } = useDialogs();
  const preview = useDebouncedValue(value, 600);

  async function apply(template: Template) {
    if (value.trim() && value.trim() !== template.code.trim()) {
      const ok = await confirm({ title: 'Substituir o diagrama?', message: 'O código atual será trocado pelo modelo.', confirmLabel: 'Substituir' });
      if (!ok) return;
    }
    onChange(template.code);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {templates.map((template) => (
          <Button key={template.label} size="sm" variant="secondary" onClick={() => void apply(template)}>
            <AutoFixHighRoundedIcon fontSize="small" />
            {template.label}
          </Button>
        ))}
      </div>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-40 font-mono text-xs" spellCheck={false} />
      {preview.trim() ? (
        <div className="rounded-2xl border border-edge bg-surface-2 p-3">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Prévia</p>
          <MermaidDiagram code={preview} className="[&_svg]:h-auto [&_svg]:w-full" />
        </div>
      ) : null}
    </div>
  );
}

export const GENEALOGY_TEMPLATES: Template[] = [
  {
    label: 'Árvore de família',
    code: `graph TD
  Abraao[Abraão] --> Isaque[Isaque]
  Abraao --> Ismael[Ismael]
  Isaque --> Jaco[Jacó]
  Isaque --> Esau[Esaú]

classDef principal fill:#FDE68A,stroke:#B45309,color:#111827;
classDef secundario fill:#BFDBFE,stroke:#1D4ED8,color:#111827;
class Abraao,Isaque,Jaco principal;
class Ismael,Esau secundario;`,
  },
  {
    label: 'Pais e filhos',
    code: `graph TD
  Pai[Pai] --- Mae[Mãe]
  Pai --> Personagem[Personagem]
  Mae --> Personagem
  Personagem --> Filho1[Filho 1]
  Personagem --> Filho2[Filho 2]

classDef principal fill:#FDE68A,stroke:#B45309,color:#111827;
class Personagem principal;`,
  },
];

export const TIMELINE_TEMPLATES: Template[] = [
  {
    label: 'Linha do tempo',
    code: `timeline
  title Eventos importantes
  1 Samuel 16 : Davi é ungido rei
  1 Samuel 17 : Davi enfrenta Golias
  2 Samuel 5 : Davi assume o trono`,
  },
  {
    label: 'Por fases da vida',
    code: `timeline
  title Fases da vida
  section Juventude
    Chamado : Primeiro encontro com Deus
  section Ministério
    Obra principal : O que fez de mais importante
  section Legado
    Fim da vida : Como terminou sua história`,
  },
];
