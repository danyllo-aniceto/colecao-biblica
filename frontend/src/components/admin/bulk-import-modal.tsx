import { useRef, useState, type DragEvent, type ReactNode } from 'react';
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
import type { BulkImportResult } from '@/lib/admin-api';
import { downloadText, parseCsv, toCsv } from '@/lib/csv';

export type BulkRow = Record<string, string>;

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

type BulkImportModalProps = {
  title: string;
  description: string;
  /** Plural usado nas mensagens ("missões", "reações"). */
  noun: string;
  /** Nome do arquivo do modelo para baixar. */
  templateFile: string;
  header: string[];
  templateRows: string[][];
  /** Nome da coluna na planilha (sem acento, minúsculo) -> campo enviado à API. */
  aliases: Record<string, string>;
  /** Campos que precisam ter coluna na planilha, com o nome mostrado no aviso. */
  required: Record<string, string>;
  help: ReactNode;
  maxRows?: number;
  /** Valida (dryRun) ou cria as linhas. */
  run: (rows: BulkRow[], dryRun: boolean) => Promise<BulkImportResult>;
  /** Outra forma de montar as linhas (ex.: enviar imagens); recebe a função que carrega as linhas na prévia. */
  extra?: (load: (rows: BulkRow[], source: string) => Promise<void>, busy: boolean) => ReactNode;
  /** Texto que identifica a linha na lista de erros. */
  rowLabel: (row: BulkRow) => string | undefined;
  onClose: () => void;
  onImported: () => void;
};

/** Importação em lote: planilha CSV (ou outra origem) com prévia de erros por linha antes de criar. */
export function BulkImportModal({ title, description, noun, templateFile, header, templateRows, aliases, required, help, maxRows = 300, run, extra, rowLabel, onClose, onImported }: BulkImportModalProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [preview, setPreview] = useState<BulkImportResult | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [dragging, setDragging] = useState(false);
  const errorPaging = usePagination(preview?.errors ?? [], 8);

  async function load(parsed: BulkRow[], origin: string) {
    setSource(origin);
    setProblem(null);
    setPreview(null);
    if (parsed.length === 0) return setProblem('Não há linhas para importar.');
    if (parsed.length > maxRows) return setProblem(`São ${parsed.length} linhas; importe no máximo ${maxRows} por vez.`);
    setBusy('reading');
    try {
      setRows(parsed);
      setPreview(await run(parsed, true));
    } catch (error) {
      setProblem(errorMessage(error, 'Não foi possível validar as linhas.'));
    } finally {
      setBusy(null);
    }
  }

  async function read(file: File) {
    setProblem(null);
    try {
      const [head = [], ...body] = parseCsv(await file.text());
      const columns = head.map((cell) => aliases[normalize(cell)]);
      const missing = Object.keys(required).filter((field) => !columns.includes(field));
      if (missing.length > 0) {
        setSource(file.name);
        setPreview(null);
        return setProblem(`Faltam colunas na planilha: ${missing.map((field) => required[field]).join(', ')}. Baixe o modelo para ver o formato.`);
      }
      const parsed = body.map((cells) => {
        const row: BulkRow = {};
        columns.forEach((field, index) => {
          const value = cells[index]?.trim();
          if (field && value) row[field] = value;
        });
        return row;
      });
      await load(parsed, file.name);
    } catch (error) {
      setProblem(errorMessage(error, 'Não foi possível ler a planilha.'));
    }
  }

  async function confirm() {
    setBusy('importing');
    try {
      const result = await run(rows, false);
      toast.success(`${result.created} ${noun} importada(s).`, result.errors.length ? { description: `${result.errors.length} linha(s) com erro foram ignoradas.` } : undefined);
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
      title={title}
      description={description}
      onClose={busy === 'importing' ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy === 'importing'}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={!preview || preview.valid === 0} loading={busy === 'importing'}>
            {busy === 'importing' ? 'Importando...' : `Importar ${preview?.valid ?? 0} ${noun}`}
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
          <p className="font-display font-semibold text-ink">{source ?? 'Arraste a planilha CSV para cá'}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
              Escolher arquivo
            </Button>
            <Button size="sm" variant="secondary" onClick={() => downloadText(templateFile, toCsv([header, ...templateRows]))}>
              <DownloadRoundedIcon fontSize="small" />
              Baixar modelo
            </Button>
          </div>
          <p className="text-xs text-muted">{help}</p>
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

        {extra ? extra(load, busy !== null) : null}

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
                  {errorPaging.pageItems.map((error) => {
                    const label = rows[error.row - 1] ? rowLabel(rows[error.row - 1]) : undefined;
                    return (
                      <li key={error.row} className="flex gap-3 px-4 py-2.5 text-sm">
                        <span className="w-20 shrink-0 font-bold text-ink">Linha {error.row + 1}</span>
                        <span className="text-muted">
                          {label ? <strong className="text-ink">{label}: </strong> : null}
                          {error.message}
                        </span>
                      </li>
                    );
                  })}
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
