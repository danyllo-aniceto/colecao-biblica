import { useRef, useState, type DragEvent } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { sanitizeMermaidCode, validateMermaidSyntax } from '@/components/ui/mermaid-diagram';
import { importCharacters, type BulkCharacterResult, type BulkCharacterRow } from '@/lib/admin-api';
import { downloadText, parseCsv, toCsv } from '@/lib/csv';

type Column = keyof BulkCharacterRow;

/** Nomes aceitos no cabeçalho da planilha (sem acento e minúsculos). */
const HEADER_ALIASES: Record<string, Column> = {
  nome: 'name',
  personagem: 'name',
  raridade: 'rarity',
  testamento: 'testament',
  'resumo curto': 'shortSummary',
  resumo: 'shortSummary',
  'historia completa': 'fullDescription',
  historia: 'fullDescription',
  curiosidades: 'curiosities',
  'onde ler': 'bibleReferences',
  referencias: 'bibleReferences',
  'papel na historia': 'narrativeRole',
  papel: 'narrativeRole',
  periodo: 'historicalPeriod',
  'periodo historico': 'historicalPeriod',
  livros: 'bibleBooks',
  'livros onde aparece': 'bibleBooks',
  'versiculos-chave': 'keyVerses',
  'versiculos chave': 'keyVerses',
  versiculos: 'keyVerses',
  'palavras-chave': 'keywords',
  'palavras chave': 'keywords',
  publicado: 'published',
  imagem: 'imageUrl',
  'imagem (url)': 'imageUrl',
  'publicar em': 'publishAt',
  'data de publicacao': 'publishAt',
  'arvore genealogica': 'genealogy',
  'linha do tempo': 'importantEvents',
};

const TEMPLATE_HEADER = ['Nome', 'Raridade', 'Testamento', 'Resumo curto', 'História completa', 'Curiosidades', 'Onde ler', 'Papel na história', 'Período', 'Livros', 'Versículos-chave', 'Palavras-chave', 'Publicado', 'Publicar em', 'Imagem (URL)', 'Árvore genealógica', 'Linha do tempo'];
const TEMPLATE_ROWS = [
  ['Davi', 'Épica', 'Antigo', 'Pastor que virou rei de Israel.', 'Davi era o caçula de Jessé...\nDepois foi ungido por Samuel.', 'Escreveu muitos salmos.', '1 Samuel 16-17', 'Rei e salmista', 'Reino Unido', '1 Samuel, 2 Samuel, Salmos', 'Salmo 23; 1Sm 17', 'fé, coragem', 'Não', '', '', 'graph TD\n  Jesse[Jessé] --> Davi[Davi]\n  Davi --> Salomao[Salomão]', 'timeline\n  1 Samuel 16 : Davi é ungido rei\n  1 Samuel 17 : Davi enfrenta Golias'],
];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

function toRows(table: string[][]): { rows: BulkCharacterRow[]; missing: string[] } {
  const [header = [], ...body] = table;
  const columns = header.map((cell) => HEADER_ALIASES[normalize(cell)]);
  const required: Column[] = ['name'];
  const missing = required.filter((column) => !columns.includes(column));
  const rows = body.map((cells) => {
    const row: BulkCharacterRow = {};
    columns.forEach((column, index) => {
      const value = cells[index]?.trim();
      if (column && value) row[column] = value;
    });
    return row;
  });
  return { rows, missing };
}

const MISSING_LABELS: Record<string, string> = { name: 'Nome' };

/** Importar perguntas de uma planilha (CSV): prévia com erros por linha antes de criar. */
export function ImportCharactersModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  // rows: todas as linhas lidas (para mostrar o nome no erro); sendRows: as que seguem para o servidor.
  const [rows, setRows] = useState<BulkCharacterRow[]>([]);
  const [sendRows, setSendRows] = useState<BulkCharacterRow[]>([]);
  const [preview, setPreview] = useState<BulkCharacterResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [dragging, setDragging] = useState(false);
  const errorPaging = usePagination(preview?.errors ?? [], 8);

  async function read(file: File) {
    setBusy('reading');
    setProblem(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const { rows: parsed, missing } = toRows(parseCsv(await file.text()));
      if (missing.length > 0) {
        setProblem(`Faltam colunas na planilha: ${missing.map((column) => MISSING_LABELS[column]).join(', ')}. Baixe o modelo para ver o formato.`);
        return;
      }
      if (parsed.length === 0) {
        setProblem('A planilha não tem personagens abaixo do cabeçalho.');
        return;
      }
      if (parsed.length > 300) {
        setProblem(`A planilha tem ${parsed.length} personagens; importe no máximo 300 por vez.`);
        return;
      }
      // O Mermaid só existe no navegador: valida os diagramas aqui e separa as linhas com código quebrado.
      const diagramErrors: Array<{ row: number; message: string }> = [];
      const sendable: BulkCharacterRow[] = [];
      const originalRow: number[] = [];
      for (const [index, row] of parsed.entries()) {
        let message: string | null = null;
        for (const [field, label] of [['genealogy', 'Árvore genealógica'], ['importantEvents', 'Linha do tempo']] as const) {
          const code = row[field] ? sanitizeMermaidCode(row[field]) : '';
          if (!code) continue;
          const result = await validateMermaidSyntax(code);
          if (!result.valid) {
            message = `${label} com erro: ${result.error}`;
            break;
          }
        }
        if (message) {
          diagramErrors.push({ row: index + 1, message });
        } else {
          sendable.push(row);
          originalRow.push(index + 1);
        }
      }
      setRows(parsed);
      setSendRows(sendable);
      const result = sendable.length > 0 ? await importCharacters(sendable, true) : { valid: 0, created: 0, updated: 0, willCreate: 0, willUpdate: 0, errors: [] };
      const serverErrors = result.errors.map((error) => ({ ...error, row: originalRow[error.row - 1] ?? error.row }));
      setPreview({ ...result, errors: [...diagramErrors, ...serverErrors].sort((a, b) => a.row - b.row) });
    } catch (error) {
      setProblem(errorMessage(error, 'Não foi possível ler a planilha.'));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    setBusy('importing');
    try {
      const result = await importCharacters(sendRows, false);
      toast.success(`${result.created} criado(s) e ${result.updated} atualizado(s).`, result.errors.length ? { description: `${result.errors.length} linha(s) com erro foram ignoradas.` } : undefined);
      onImported();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void read(file);
  }

  return (
    <Modal
      open
      size="lg"
      title="Importar personagens"
      description="Use uma planilha CSV (no Excel ou Google Planilhas: Arquivo → Salvar/Baixar como CSV). Cada linha é um personagem: se o nome já existe, os campos preenchidos são atualizados (célula vazia não apaga nada); se não existe, é criado como rascunho."
      onClose={busy === 'importing' ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy === 'importing'}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={!preview || preview.valid === 0} loading={busy === 'importing'}>
            {busy === 'importing' ? 'Importando...' : `Importar ${preview?.valid ?? 0} personagem(ns)`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn('flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed p-6 text-center transition', dragging ? 'border-primary bg-primary/10' : 'border-edge-strong bg-surface-2')}
        >
          {busy === 'reading' ? <Spinner size="lg" /> : <UploadFileRoundedIcon sx={{ fontSize: 40 }} className="text-primary-strong dark:text-primary" />}
          <p className="font-display font-semibold text-ink">{fileName ?? 'Arraste a planilha CSV para cá'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
              Escolher arquivo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadText('modelo-personagens.csv', toCsv([TEMPLATE_HEADER, ...TEMPLATE_ROWS]))}>
              <DownloadRoundedIcon fontSize="small" />
              Baixar modelo
            </Button>
          </div>
          <p className="text-xs text-muted">
            Só Nome é obrigatório para atualizar. Para criar, preencha também Raridade (Comum, Rara, Épica, Lendária), Resumo curto e História completa. Opcionais: Testamento (Antigo/Novo), Curiosidades, Onde ler, Papel na história, Período, Livros, Versículos-chave, Palavras-chave, Publicado (Sim/Não), Publicar em (25/12/2026 18:30), Imagem (URL) e os diagramas em código Mermaid (Árvore genealógica começa com graph TD; Linha do tempo começa com timeline). Quebra de linha no texto vira parágrafo.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void read(file);
            }}
          />
        </div>

        {problem ? <Alert tone="danger">{problem}</Alert> : null}

        {preview ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 rounded-2xl bg-success/10 p-3 font-display font-bold text-success-strong dark:text-success">
                <CheckCircleRoundedIcon /> {preview.willCreate} a criar · {preview.willUpdate} a atualizar
              </div>
              <div className={cn('flex items-center gap-2 rounded-2xl p-3 font-display font-bold', preview.errors.length ? 'bg-danger/10 text-danger-strong dark:text-danger' : 'bg-surface-2 text-muted')}>
                <ErrorRoundedIcon /> {preview.errors.length} com erro
              </div>
            </div>
            {preview.errors.length > 0 ? (
              <>
                <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
                  {errorPaging.pageItems.map((error) => (
                    <li key={error.row} className="flex gap-3 px-4 py-2.5 text-sm">
                      <span className="w-20 shrink-0 font-bold text-ink">Linha {error.row + 1}</span>
                      <span className="text-muted">
                        {rows[error.row - 1]?.name ? <strong className="text-ink">{rows[error.row - 1].name}: </strong> : null}
                        {error.message}
                      </span>
                    </li>
                  ))}
                </ul>
                <Pagination page={errorPaging.page} totalPages={errorPaging.totalPages} totalElements={errorPaging.totalElements} onPageChange={errorPaging.setPage} itemLabel="erros" />
                <p className="text-xs text-muted">A contagem de linhas inclui o cabeçalho (linha 1). Linhas com erro são ignoradas; corrija e importe de novo depois.</p>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
