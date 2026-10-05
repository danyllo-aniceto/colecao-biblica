import { useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import RestartAltRoundedIcon from '@mui/icons-material/RestartAltRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon } from '@/components/game/game-ui';
import { createUser, deleteUser, grantUser, listUsers, resetAllUsers, resetUser, updateUser, type GrantPayload, type Role } from '@/lib/admin-api';
import type { UserProfile } from '@/types/auth';
import { AdminPanel, Cell, DataTable, IconAction, Row, SearchInput } from '../admin-ui';
import { useDebouncedValue, usePagedList } from '../use-paged-list';
import { QUIZ_HELPERS } from '@/lib/quiz-helpers';
import { rewardVisual } from '@/lib/reward-visual';

const fetchUsers = (params: { page: number; size: number; search?: string; role?: string }) =>
  listUsers({ page: params.page, size: params.size, role: params.role, ...(params.search?.includes('@') ? { email: params.search } : { name: params.search }) });

export function UsersScreen() {
  const { user: me } = useAuth();
  const { confirm, prompt } = useDialogs();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [editing, setEditing] = useState<UserProfile | 'new' | null>(null);
  const [granting, setGranting] = useState<UserProfile | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const list = usePagedList(fetchUsers, { search: debouncedSearch, role });

  /** Pergunta se amizades e conversas também devem sumir (por padrão ficam). */
  const askSocial = () =>
    confirm({
      title: 'Apagar também amigos e conversas?',
      message: 'Se escolher manter, a pessoa continua com os amigos e o histórico de conversas; só o progresso do jogo volta ao começo.',
      confirmLabel: 'Apagar também',
      cancelLabel: 'Manter amigos e conversas',
    });

  async function reset(target: UserProfile) {
    const ok = await confirm({
      title: `Voltar ${target.name} ao começo?`,
      message: (
        <>
          Zera moedas, XP, nível, ajudas, <strong>figurinhas</strong>, estudos, anotações, partidas, conquistas, missões, campanha e itens visuais, como se a conta fosse nova. O login continua o mesmo.{' '}
          <strong>Não dá para desfazer.</strong>
        </>
      ),
      confirmLabel: 'Resetar jogador',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await resetUser(target.id, await askSocial());
      toast.success(`${target.name} voltou ao começo.`);
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function resetEveryone() {
    const typed = await prompt({
      title: 'Resetar TODOS os jogadores?',
      message: (
        <>
          Todos os jogadores (menos os administradores) voltam ao começo: sem moedas, XP, figurinhas, conquistas ou qualquer progresso. <strong>Não dá para desfazer.</strong> Digite RESETAR para confirmar.
        </>
      ),
      label: 'Confirmação',
      placeholder: 'RESETAR',
      confirmLabel: 'Resetar todos',
      validate: (value) => (value.trim() === 'RESETAR' ? null : 'Digite RESETAR para confirmar.'),
    });
    if (typed?.trim() !== 'RESETAR') return;
    try {
      const result = await resetAllUsers(await askSocial());
      toast.success(`${result.reset} jogador(es) voltaram ao começo.`);
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function remove(target: UserProfile) {
    const ok = await confirm({
      title: `Excluir a conta de ${target.name}?`,
      message: 'A pessoa perde o acesso e sai do ranking. O e-mail continua reservado.',
      confirmLabel: 'Excluir conta',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteUser(target.id);
      toast.success('Conta excluída.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      actions={
        <>
          <Button variant="secondary" onClick={() => void resetEveryone()}>
            <RestartAltRoundedIcon fontSize="small" />
            Resetar todos os jogadores
          </Button>
          <Button onClick={() => setEditing('new')}>
            <AddRoundedIcon fontSize="small" />
            Novo usuário
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-[2fr_1fr]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome ou e-mail" label="Buscar usuário" />
        <Select
          aria-label="Papel"
          value={role}
          onChange={setRole}
          options={[
            { value: '', label: 'Todos os papéis' },
            { value: 'USER', label: 'Jogadores' },
            { value: 'ADMIN', label: 'Administradores' },
          ]}
        />
      </div>

      <DataTable
        columns={[{ label: 'Usuário' }, { label: 'Papel' }, { label: 'Progresso' }, { label: 'Saldo' }, { label: 'Ações', className: 'w-36 text-right' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Nenhum usuário encontrado."
      >
        {list.items.map((account) => (
          <Row key={account.id} onClick={() => setEditing(account)}>
            <Cell>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent/20 font-display font-bold text-accent-strong dark:text-accent">
                  {account.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-semibold text-ink">
                    {account.name}
                    {account.id === me?.id ? <span className="ml-1 text-xs text-muted">(você)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted">{account.email}</p>
                </div>
              </div>
            </Cell>
            <Cell>{account.role === 'ADMIN' ? <Badge tone="violet">Admin</Badge> : <Badge>Jogador</Badge>}</Cell>
            <Cell>
              <p className="font-semibold text-ink">Nível {account.level ?? 1}</p>
              <p className="text-xs text-muted">{(account.totalScore ?? 0).toLocaleString('pt-BR')} pts · {(account.xp ?? 0).toLocaleString('pt-BR')} XP</p>
            </Cell>
            <Cell>
              <p className="inline-flex items-center gap-1 font-semibold text-ink">
                <CoinIcon className="h-4 w-4" /> {(account.coins ?? 0).toLocaleString('pt-BR')}
              </p>
              <p className="flex gap-2 text-xs text-muted">
                <span>❤ {account.extraLifeBoosts ?? 0}</span>
                <span>⏱ {account.extraTimeBoosts ?? 0}</span>
                <span>⚡ {account.doubleXpBoosts ?? 0}</span>
                <span>½ {account.hintBoosts ?? 0}</span>
              </p>
            </Cell>
            <Cell className="text-right">
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => setEditing(account)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Ajustar saldo" onClick={() => setGranting(account)}>
                  <CardGiftcardRoundedIcon fontSize="small" />
                </IconAction>
                {account.role !== 'ADMIN' ? (
                  <IconAction label="Voltar ao começo (resetar progresso)" onClick={() => void reset(account)}>
                    <RestartAltRoundedIcon fontSize="small" />
                  </IconAction>
                ) : null}
                {account.id !== me?.id ? (
                  <IconAction label="Excluir conta" tone="danger" onClick={() => void remove(account)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconAction>
                ) : null}
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>

      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="usuários" />

      {editing ? (
        <UserModal
          user={editing === 'new' ? null : editing}
          isSelf={editing !== 'new' && editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
      {granting ? (
        <GrantModal
          user={granting}
          onClose={() => setGranting(null)}
          onSaved={() => {
            setGranting(null);
            list.reload();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

function UserModal({ user, isSelf, onClose, onSaved }: { user: UserProfile | null; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(user?.role ?? 'USER');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user && password.length < 6) {
      toast.error('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    setSaving(true);
    try {
      if (user) {
        await updateUser(user.id, { name: name.trim(), email: email.trim(), ...(password ? { password } : {}), ...(isSelf ? {} : { role }) });
        toast.success('Usuário atualizado.');
      } else {
        await createUser({ name: name.trim(), email: email.trim(), password, role });
        toast.success('Usuário criado.');
      }
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="sm" title={user ? 'Editar usuário' : 'Novo usuário'} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Nome" required>
          <Input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
        </Field>
        <Field label="E-mail" required>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label={user ? 'Nova senha' : 'Senha'} required={!user} hint={user ? 'Deixe em branco para manter a atual.' : 'Mínimo de 6 caracteres.'}>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Papel" hint={isSelf ? 'Você não pode alterar o seu próprio papel.' : 'Administradores acessam este painel.'}>
          <Segmented<Role>
            aria-label="Papel"
            value={role}
            onChange={(value) => !isSelf && setRole(value)}
            options={[
              { value: 'USER', label: 'Jogador' },
              { value: 'ADMIN', label: 'Administrador' },
            ]}
          />
        </Field>
        <div className="flex justify-end gap-3 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : user ? 'Salvar' : 'Criar usuário'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

const GRANT_FIELDS: Array<{ key: keyof GrantPayload; label: string; icon: React.ReactNode }> = [
  { key: 'coins', label: 'Moedas', icon: <CoinIcon className="h-5 w-5" /> },
  { key: 'extraLifeBoosts', label: 'Vidas extras', icon: <FavoriteRoundedIcon className="text-danger" fontSize="small" /> },
  { key: 'extraTimeBoosts', label: 'Tempo extra', icon: <TimerRoundedIcon className="text-info" fontSize="small" /> },
  { key: 'doubleXpBoosts', label: 'XP em dobro', icon: <BoltRoundedIcon className="text-primary" fontSize="small" /> },
  { key: 'hintBoosts', label: 'Dicas 50/50', icon: <ContentCutRoundedIcon className="text-violet" fontSize="small" /> },
  { key: 'streakFreezes', label: 'Protetores de sequência', icon: <span className="text-info">{rewardVisual('STREAK_FREEZE', 20).icon}</span> },
  ...QUIZ_HELPERS.map((helper) => ({ key: helper.field, label: helper.name, icon: <span className={`flex ${rewardVisual(helper.rewardType, 20).tint} rounded-lg`}>{rewardVisual(helper.rewardType, 20).icon}</span> })),
];

function GrantModal({ user, onClose, onSaved }: { user: UserProfile; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: GrantPayload = {};
    GRANT_FIELDS.forEach(({ key }) => {
      const number = Number(values[key]);
      if (values[key] && Number.isInteger(number) && number !== 0) payload[key] = number;
    });
    if (Object.keys(payload).length === 0) {
      toast.info('Nada para ajustar: preencha ao menos um valor.');
      return;
    }
    setSaving(true);
    try {
      await grantUser(user.id, payload);
      toast.success(`Saldo de ${user.name} ajustado.`);
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  const current = Object.fromEntries(GRANT_FIELDS.map((field) => [field.key, (user[field.key as keyof UserProfile] as number | undefined) ?? 0])) as Record<keyof GrantPayload, number>;

  return (
    <Modal open size="md" title={`Ajustar saldo de ${user.name}`} description="Use valores positivos para dar e negativos para tirar. Nada fica abaixo de zero." onClose={saving ? undefined : onClose}>
      <form className="space-y-3" onSubmit={submit}>
        {GRANT_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-2">{field.icon}</span>
            <span className="flex-1 text-sm font-semibold text-ink">
              {field.label}
              <span className="block text-xs font-normal text-muted">Atual: {current[field.key].toLocaleString('pt-BR')}</span>
            </span>
            <Input type="number" className="w-28 text-center" placeholder="0" value={values[field.key] ?? ''} onChange={(event) => setValues((state) => ({ ...state, [field.key]: event.target.value }))} aria-label={field.label} />
          </div>
        ))}
        <div className="flex justify-end gap-3 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Aplicando...' : 'Aplicar ajuste'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
