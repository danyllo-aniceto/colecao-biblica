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
import { importQuestions, type BulkImportResult, type BulkQuestionRow } from '@/lib/admin-api';
import { downloadText, parseCsv, toCsv } from '@/lib/csv';

type Column = keyof BulkQuestionRow;

/** Nomes aceitos no cabeçalho da planilha (sem acento e minúsculos). */
const HEADER_ALIASES: Record<string, Column> = {
  pergunta: 'text',
  enunciado: 'text',
  texto: 'text',
  a: 'optionA',
  'alternativa a': 'optionA',
  'opcao a': 'optionA',
  b: 'optionB',
  'alternativa b': 'optionB',
  'opcao b': 'optionB',
  c: 'optionC',
  'alternativa c': 'optionC',
  'opcao c': 'optionC',
  d: 'optionD',
  'alternativa d': 'optionD',
  'opcao d': 'optionD',
  correta: 'correctOption',
  resposta: 'correctOption',
  'resposta correta': 'correctOption',
  dificuldade: 'difficulty',
  tempo: 'timeLimitSeconds',
  'tempo (s)': 'timeLimitSeconds',
  segundos: 'timeLimitSeconds',
  personagem: 'character',
  explicacao: 'explanation',
  referencia: 'bibleReference',
  'referencia biblica': 'bibleReference',
};

const TEMPLATE_HEADER = ['Pergunta', 'A', 'B', 'C', 'D', 'Correta', 'Dificuldade', 'Tempo (s)', 'Personagem', 'Explicação', 'Referência'];
const TEMPLATE_ROWS = [
  ['Quem derrotou o gigante Golias?', 'Saul', 'Davi', 'Jônatas', 'Samuel', 'B', 'Fácil', '', 'Davi', 'Davi venceu Golias com uma funda e uma pedra.', '1 Samuel 17:49'],
  ['Quantos livros tem a Bíblia protestante?', '66', '72', '39', '27', 'A', 'Média', '25', '', '39 no Antigo e 27 no Novo Testamento.', ''],
];

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

function toRows(table: string[][]): { rows: BulkQuestionRow[]; missing: string[] } {
  const [header = [], ...body] = table;
  const columns = header.map((cell) => HEADER_ALIASES[normalize(cell)]);
  const required: Column[] = ['text', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption'];
  const missing = required.filter((column) => !columns.includes(column));
  const rows = body.map((cells) => {
    const row: BulkQuestionRow = {};
    columns.forEach((column, index) => {
      const value = cells[index]?.trim();
      if (column && value) row[column] = value;
    });
    return row;
  });
  return { rows, missing };
}

const MISSING_LABELS: Record<string, string> = { text: 'Pergunta', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctOption: 'Correta' };

/** Importar perguntas de uma planilha (CSV): prévia com erros por linha antes de criar. */
export function ImportQuestionsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkQuestionRow[]>([]);
  const [preview, setPreview] = useState<BulkImportResult | null>(null);
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
        setProblem('A planilha não tem perguntas abaixo do cabeçalho.');
        return;
      }
      if (parsed.length > 500) {
        setProblem(`A planilha tem ${parsed.length} perguntas; importe no máximo 500 por vez.`);
        return;
      }
      setRows(parsed);
      setPreview(await importQuestions(parsed, true));
    } catch (error) {
      setProblem(errorMessage(error, 'Não foi possível ler a planilha.'));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    setBusy('importing');
    try {
      const result = await importQuestions(rows, false);
      toast.success(`${result.created} pergunta(s) importada(s).`, result.errors.length ? { description: `${result.errors.length} linha(s) com erro foram ignoradas.` } : undefined);
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
      title="Importar perguntas"
      description="Use uma planilha CSV (no Excel ou Google Planilhas: Arquivo → Salvar/Baixar como CSV). Cada linha vira uma pergunta."
      onClose={busy === 'importing' ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy === 'importing'}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={!preview || preview.valid === 0} loading={busy === 'importing'}>
            {busy === 'importing' ? 'Importando...' : `Importar ${preview?.valid ?? 0} pergunta(s)`}
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
            <Button size="sm" variant="secondary" onClick={() => downloadText('modelo-perguntas.csv', toCsv([TEMPLATE_HEADER, ...TEMPLATE_ROWS]))}>
              <DownloadRoundedIcon fontSize="small" />
              Baixar modelo
            </Button>
          </div>
          <p className="text-xs text-muted">
            Colunas: Pergunta, A, B, C, D, Correta (letra) e, se quiser, Dificuldade (Fácil, Média, Difícil, Muito difícil), Tempo (s), Personagem (nome igual ao cadastrado), Explicação e Referência.
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
                <CheckCircleRoundedIcon /> {preview.valid} pronta(s) para importar
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
                        {rows[error.row - 1]?.text ? <strong className="text-ink">{rows[error.row - 1].text}: </strong> : null}
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
