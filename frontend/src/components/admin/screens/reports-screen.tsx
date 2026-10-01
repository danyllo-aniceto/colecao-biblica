import { useState } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DoNotDisturbRoundedIcon from '@mui/icons-material/DoNotDisturbRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { errorMessage, useToast } from '@/components/ui/toast';
import { getQuestion, listReports, updateQuestion, updateReport, type AdminQuestion, type AdminReport, type ReportStatus } from '@/lib/admin-api';
import { REPORT_REASON_LABELS, formatDateTime } from '@/lib/labels';
import { AdminPanel, Cell, DataTable, IconAction, Row } from '../admin-ui';
import { usePagedList } from '../use-paged-list';
import { QuestionEditorModal } from './questions-screen';

const STATUS_LABEL: Record<ReportStatus, string> = { OPEN: 'Aberto', RESOLVED: 'Resolvido', DISMISSED: 'Descartado' };

/** Perguntas marcadas pelos jogadores como erradas ou confusas. */
export function ReportsScreen({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<'OPEN' | 'RESOLVED' | 'DISMISSED' | 'ALL'>('OPEN');
  const [editing, setEditing] = useState<AdminQuestion | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const list = usePagedList(listReports, { status });

  async function close(report: AdminReport, next: ReportStatus) {
    setBusyId(report.id);
    try {
      await updateReport(report.id, next);
      toast.success(next === 'RESOLVED' ? 'Reporte resolvido.' : next === 'DISMISSED' ? 'Reporte descartado.' : 'Reporte reaberto.', {
        description: next !== 'OPEN' && report.questionReports > 1 ? 'Os outros reportes abertos desta pergunta também foram fechados.' : undefined,
      });
      list.reload();
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function openQuestion(report: AdminReport) {
    setBusyId(report.id);
    try {
      setEditing(await getQuestion(report.questionId));
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function deactivate(report: AdminReport) {
    setBusyId(report.id);
    try {
      await updateQuestion(report.questionId, { active: false });
      toast.success('Pergunta desativada: não entra mais nas partidas.');
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminPanel description="Revise a pergunta, corrija se precisar e marque como resolvido. Descarte quando o reporte não procede.">
      <Segmented
        aria-label="Status dos reportes"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'OPEN', label: 'Abertos' },
          { value: 'RESOLVED', label: 'Resolvidos' },
          { value: 'DISMISSED', label: 'Descartados' },
          { value: 'ALL', label: 'Todos' },
        ]}
      />
      <DataTable
        columns={[{ label: 'Pergunta' }, { label: 'Motivo' }, { label: 'Quem reportou' }, { label: 'Status' }, { label: 'Ações', className: 'w-44 text-right' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty={status === 'OPEN' ? 'Nenhum reporte aberto. 🎉' : 'Nenhum reporte aqui.'}
        minWidth={820}
      >
        {list.items.map((report) => (
          <Row key={report.id}>
            <Cell className="max-w-md">
              <p className="line-clamp-2 font-semibold text-ink">{report.questionText}</p>
              <p className="text-xs text-muted">
                {report.questionReports > 1 ? `${report.questionReports} reportes nesta pergunta` : '1 reporte'}
                {report.questionActive ? '' : ' · pergunta inativa'}
              </p>
            </Cell>
            <Cell>
              <Badge tone="primary">{REPORT_REASON_LABELS[report.reason]}</Badge>
              {report.message ? <p className="mt-1 line-clamp-3 max-w-xs text-xs text-muted">“{report.message}”</p> : null}
            </Cell>
            <Cell>
              <p className="font-semibold text-ink">{report.userName}</p>
              <p className="text-xs text-muted">{formatDateTime(report.createdAt)}</p>
            </Cell>
            <Cell>
              <Badge tone={report.status === 'OPEN' ? 'danger' : report.status === 'RESOLVED' ? 'success' : 'neutral'}>{STATUS_LABEL[report.status]}</Badge>
            </Cell>
            <Cell className="text-right">
              <div className="flex justify-end gap-1">
                <IconAction label="Editar pergunta" onClick={() => void openQuestion(report)} disabled={busyId === report.id}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                {report.questionActive ? (
                  <IconAction label="Desativar pergunta" onClick={() => void deactivate(report)} disabled={busyId === report.id}>
                    <ToggleOffRoundedIcon fontSize="small" />
                  </IconAction>
                ) : null}
                {report.status === 'OPEN' ? (
                  <>
                    <IconAction label="Marcar como resolvido" onClick={() => void close(report, 'RESOLVED')} disabled={busyId === report.id}>
                      <CheckRoundedIcon fontSize="small" />
                    </IconAction>
                    <IconAction label="Descartar" tone="danger" onClick={() => void close(report, 'DISMISSED')} disabled={busyId === report.id}>
                      <DoNotDisturbRoundedIcon fontSize="small" />
                    </IconAction>
                  </>
                ) : null}
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="reportes" />

      {editing ? (
        <QuestionEditorModal
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}
