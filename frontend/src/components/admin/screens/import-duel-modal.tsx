import { useRef, useState, type DragEvent } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { parseCsv } from '@/lib/csv';
import { importDuelCards, type DuelImportResult, type DuelImportRow } from '@/lib/duel-api';

type Column = keyof DuelImportRow;

/** Nomes aceitos no cabeçalho (sem acento e minúsculos). */
const HEADER_ALIASES: Record<string, Column> = {
  personagem: 'name',
  nome: 'name',
  vigor: 'cost',
  custo: 'cost',
  influencia: 'power',
  forca: 'power',
  poder: 'power',
  etiquetas: 'tags',
  tags: 'tags',
  gatilho: 'trigger',
  efeitos: 'effects',
  efeito: 'effects',
  'texto do dom': 'text',
  texto: 'text',
  disponivel: 'available',
  ativo: 'available',
};

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const MAX_BATCH = 300;

function toRows(table: string[][]) {
  const [header = [], ...body] = table;
  const columns = header.map((cell) => HEADER_ALIASES[normalize(cell)]);
  const missing = (['name', 'cost', 'power'] as Column[]).filter((column) => !columns.includes(column));
  const rows: DuelImportRow[] = [];
  for (const cells of body) {
    const row: Partial<DuelImportRow> = {};
    columns.forEach((column, index) => {
      const value = cells[index]?.trim();
      if (column && value) row[column] = value;
    });
    // Personagem sem Vigor nem Influência = linha da planilha que o admin ainda não preencheu: ignora.
    if (row.name && (row.cost !== undefined || row.power !== undefined)) rows.push({ cost: '', power: '', ...row } as DuelImportRow);
  }
  return { rows, missing, skipped: body.length - rows.length };
}

const MISSING_LABELS: Record<string, string> = { name: 'Personagem', cost: 'Vigor', power: 'Influência' };

/** Importar figurinhas do Duelo de uma planilha CSV: prévia com erros por linha antes de gravar. */
export function ImportDuelModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<DuelImportRow[]>([]);
  const [preview, setPreview] = useState<DuelImportResult | null>(null);
  const [skipped, setSkipped] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
  const [dragging, setDragging] = useState(false);
  const errors = usePagination(preview?.errors ?? [], 6);
  const cards = usePagination(preview?.preview ?? [], 6);

  async function read(file: File) {
    setBusy('reading');
    setProblem(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const { rows: parsed, missing, skipped: ignored } = toRows(parseCsv(await file.text()));
      if (missing.length > 0) {
        setProblem(`Faltam colunas na planilha: ${missing.map((column) => MISSING_LABELS[column]).join(', ')}. Baixe a planilha no painel para ver o formato.`);
        return;
      }
      if (parsed.length === 0) {
        setProblem('Nenhuma linha com Vigor e Influência preenchidos.');
        return;
      }
      if (parsed.length > MAX_BATCH) {
        setProblem(`A planilha tem ${parsed.length} figurinhas; importe no máximo ${MAX_BATCH} por vez.`);
        return;
      }
      setRows(parsed);
      setSkipped(ignored);
      setPreview(await importDuelCards(parsed, true));
    } catch (error) {
      setProblem(errorMessage(error, 'Não foi possível ler a planilha.'));
    } finally {
      setBusy(null);
    }
  }

  async function confirm() {
    setBusy('importing');
    try {
      const result = await importDuelCards(rows, false);
      toast.success(`${result.created} figurinha(s) criada(s) e ${result.updated} atualizada(s).`, result.errors.length ? { description: `${result.errors.length} linha(s) com erro foram ignoradas.` } : undefined);
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
      title="Importar figurinhas do Duelo"
      description="Planilha CSV (a mesma que o botão Baixar planilha gera). Cada linha com Vigor e Influência vira (ou substitui) a figurinha daquele personagem; linhas em branco são ignoradas."
      onClose={busy === 'importing' ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy === 'importing'}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()} disabled={!preview || preview.valid === 0} loading={busy === 'importing'}>
            {busy === 'importing' ? 'Importando...' : `Importar ${preview?.valid ?? 0} figurinha(s)`}
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
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy !== null}>
            Escolher arquivo
          </Button>
          <p className="text-xs text-muted">
            Colunas: Personagem, Vigor, Influência, Etiquetas (separadas por vírgula), Gatilho, Efeitos, Texto do Dom (opcional), Disponível (Sim/Não). Gatilho e Efeitos vazios = figurinha sem Dom. As outras colunas (Raridade, Papel...) servem só de contexto.
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
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-2xl bg-success/10 p-3 font-display font-bold text-success-strong dark:text-success">
                <CheckCircleRoundedIcon /> {preview.created} a criar · {preview.updated} a atualizar
              </div>
              <div className={cn('flex items-center gap-2 rounded-2xl p-3 font-display font-bold', preview.errors.length ? 'bg-danger/10 text-danger-strong dark:text-danger' : 'bg-surface-2 text-muted')}>
                <ErrorRoundedIcon /> {preview.errors.length} com erro
              </div>
            </div>
            {skipped > 0 ? <p className="text-xs text-muted">{skipped} linha(s) sem Vigor/Influência foram ignoradas.</p> : null}

            {preview.errors.length > 0 ? (
              <>
                <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
                  {errors.pageItems.map((error) => (
                    <li key={error.row} className="flex gap-3 px-4 py-2.5 text-sm">
                      <span className="w-16 shrink-0 font-bold text-ink">Linha {error.row}</span>
                      <span className="text-muted">
                        <strong className="text-ink">{error.name}: </strong>
                        {error.message}
                      </span>
                    </li>
                  ))}
                </ul>
                <Pagination page={errors.page} totalPages={errors.totalPages} totalElements={errors.totalElements} onPageChange={errors.setPage} itemLabel="erros" pageSizeOptions={[6]} />
                <p className="text-xs text-muted">A numeração conta só as linhas com figurinha preenchida. Linhas com erro são ignoradas; corrija e importe de novo.</p>
              </>
            ) : null}

            {preview.warnings.length > 0 ? (
              <Alert tone="info">
                {preview.warnings.length} aviso(s) de equilíbrio, por exemplo {preview.warnings[0].name}: {preview.warnings[0].message}
              </Alert>
            ) : null}

            {preview.preview.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-bold text-muted">Como ficam as figurinhas</p>
                <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
                  {cards.pageItems.map((item) => (
                    <li key={item.name} className="px-4 py-2.5 text-sm">
                      <p className="font-semibold text-ink">
                        {item.name} <span className="font-normal text-muted">· Vigor {item.cost} · Influência {item.power}{item.tags.length ? ` · ${item.tags.join(', ')}` : ''}{item.available ? '' : ' · desligada'}</span>
                      </p>
                      <p className="text-xs text-muted">{item.description}</p>
                    </li>
                  ))}
                </ul>
                <Pagination page={cards.page} totalPages={cards.totalPages} totalElements={cards.totalElements} onPageChange={cards.setPage} itemLabel="figurinhas" pageSizeOptions={[6]} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
