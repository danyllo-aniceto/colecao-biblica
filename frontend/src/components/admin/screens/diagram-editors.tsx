import { useMemo, useState } from 'react';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SubdirectoryArrowRightRoundedIcon from '@mui/icons-material/SubdirectoryArrowRightRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MermaidDiagram } from '@/components/ui/mermaid-diagram';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import {
  genealogyToMermaid,
  newEventId,
  newPersonId,
  parseGenealogy,
  parseTimeline,
  timelineToMermaid,
  type Person,
  type Timeline,
  type TimelineEvent,
} from '@/lib/diagram-code';
import { useDebouncedValue } from '../use-paged-list';
import { GENEALOGY_TEMPLATES, MermaidField, TIMELINE_TEMPLATES } from './character-fields';

type Mode = 'visual' | 'code';

const PAGE_SIZE = 6;

function Preview({ code }: { code: string }) {
  const preview = useDebouncedValue(code, 500);
  if (!preview.trim()) return null;
  return (
    <div className="rounded-2xl border border-edge bg-surface-2 p-3">
      <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Prévia</p>
      <MermaidDiagram code={preview} className="[&_svg]:h-auto [&_svg]:w-full" />
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <Segmented<Mode>
      aria-label="Jeito de editar"
      value={mode}
      onChange={onChange}
      className="sm:w-80"
      options={[
        { value: 'visual', label: 'Formulário', icon: <AccountTreeRoundedIcon fontSize="small" /> },
        { value: 'code', label: 'Código', icon: <CodeRoundedIcon fontSize="small" /> },
      ]}
    />
  );
}

const iconButton = 'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-ink disabled:pointer-events-none disabled:opacity-30';

// ---------------------------------------------------------------------------
// Árvore genealógica
// ---------------------------------------------------------------------------

/** Quantas gerações acima a pessoa tem (para recuar o cartão e mostrar a árvore). */
function depthOf(person: Person, byId: Map<string, Person>, seen = new Set<string>()): number {
  if (seen.has(person.id)) return 0;
  seen.add(person.id);
  const parent = person.parents.map((id) => byId.get(id)).find(Boolean);
  return parent ? 1 + depthOf(parent, byId, seen) : 0;
}

function descendantsOf(id: string, people: Person[]) {
  const found = new Set<string>();
  let grew = true;
  while (grew) {
    grew = false;
    for (const person of people) {
      if (!found.has(person.id) && person.parents.some((parent) => parent === id || found.has(parent))) {
        found.add(person.id);
        grew = true;
      }
    }
  }
  return found;
}

/** Cadastro da árvore em formulário: nome, quem são os pais e o cônjuge; o diagrama é gerado sozinho. */
export function GenealogyEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initial = useMemo(() => parseGenealogy(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<Mode>(initial ? 'visual' : 'code');
  const [people, setPeople] = useState<Person[]>(initial ?? []);
  const [notice, setNotice] = useState<string | null>(initial ? null : 'Este diagrama tem recursos que o formulário não mostra, então ele abre como código.');
  const paging = usePagination(people, PAGE_SIZE);
  const byId = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);

  function commit(next: Person[]) {
    setPeople(next);
    onChange(genealogyToMermaid(next));
  }

  function update(id: string, patch: Partial<Person>) {
    commit(people.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  function add(parentId?: string) {
    const person: Person = { id: newPersonId(people), name: '', main: false, parents: parentId ? [parentId] : [], spouse: '' };
    let next: Person[];
    if (parentId) {
      // O filho entra logo depois do último descendente do pai/mãe, para a lista seguir a árvore.
      const family = descendantsOf(parentId, people);
      const last = people.reduce((index, item, position) => (item.id === parentId || family.has(item.id) ? position : index), -1);
      next = [...people.slice(0, last + 1), person, ...people.slice(last + 1)];
    } else {
      next = [...people, person];
    }
    commit(next);
    paging.setPage(Math.floor(next.findIndex((item) => item.id === person.id) / PAGE_SIZE));
  }

  function remove(id: string) {
    commit(
      people
        .filter((person) => person.id !== id)
        .map((person) => ({ ...person, parents: person.parents.filter((parent) => parent !== id), spouse: person.spouse === id ? '' : person.spouse })),
    );
  }

  function changeMode(next: Mode) {
    if (next === 'visual') {
      const parsed = parseGenealogy(value);
      if (!parsed) {
        setNotice('O código tem trechos que o formulário não entende. Corrija ou apague os extras para voltar ao formulário.');
        return;
      }
      setPeople(parsed);
    }
    setNotice(null);
    setMode(next);
  }

  const options = (self: Person) => [
    { value: '', label: 'Ninguém' },
    ...people.filter((person) => person.id !== self.id && person.name.trim()).map((person) => ({ value: person.id, label: person.name.trim() })),
  ];

  return (
    <div className="space-y-4">
      <ModeSwitch mode={mode} onChange={changeMode} />
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {mode === 'code' ? (
        <MermaidField value={value} onChange={onChange} templates={GENEALOGY_TEMPLATES} placeholder={'graph TD\n  Abraao[Abraão] --> Isaque[Isaque]'} />
      ) : (
        <>
          <p className="text-sm text-muted">
            Adicione as pessoas da família e diga de quem cada uma é filha. Use <strong>Filho(a)</strong> para criar um descendente já ligado.
          </p>
          <ul className="space-y-3">
            {paging.pageItems.map((person) => {
              const depth = Math.min(depthOf(person, byId), 3);
              return (
                <li key={person.id} className="space-y-3 rounded-2xl border border-edge bg-surface-2 p-3" style={{ marginLeft: `${depth * 0.75}rem` }}>
                  <div className="flex items-end gap-2">
                    <Field label="Nome" className="min-w-0 flex-1">
                      <Input value={person.name} onChange={(event) => update(person.id, { name: event.target.value })} placeholder="Ex.: Isaque" maxLength={60} />
                    </Field>
                    <Tooltip content="Adicionar filho(a)">
                      <button type="button" className={iconButton} aria-label={`Adicionar filho(a) de ${person.name || 'esta pessoa'}`} onClick={() => add(person.id)}>
                        <SubdirectoryArrowRightRoundedIcon fontSize="small" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Remover pessoa">
                      <button type="button" className={`${iconButton} hover:text-danger`} aria-label={`Remover ${person.name || 'pessoa'}`} onClick={() => remove(person.id)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Pai ou mãe">
                      <Select
                        aria-label="Pai ou mãe"
                        value={person.parents[0] ?? ''}
                        options={options(person)}
                        searchable
                        onChange={(next) => update(person.id, { parents: [next, person.parents[1] ?? ''].filter(Boolean) })}
                      />
                    </Field>
                    <Field label="Outro pai ou mãe">
                      <Select
                        aria-label="Outro pai ou mãe"
                        value={person.parents[1] ?? ''}
                        options={options(person)}
                        searchable
                        disabled={!person.parents[0]}
                        onChange={(next) => update(person.id, { parents: [person.parents[0], next].filter(Boolean) })}
                      />
                    </Field>
                    <Field label="Casado(a) com">
                      <Select
                        aria-label="Casado(a) com"
                        value={person.spouse}
                        options={options(person)}
                        searchable
                        onChange={(next) => {
                          // O vínculo vale para os dois lados.
                          commit(
                            people.map((item) => {
                              if (item.id === person.id) return { ...item, spouse: next };
                              if (item.id === next) return { ...item, spouse: person.id };
                              if (item.id === person.spouse) return { ...item, spouse: '' };
                              return item;
                            }),
                          );
                        }}
                      />
                    </Field>
                  </div>
                  <Checkbox checked={person.main} onChange={(main) => update(person.id, { main })} label="Destacar na árvore" description="Fica em dourado, para mostrar o personagem da figurinha e a linhagem dele." />
                </li>
              );
            })}
          </ul>

          {people.length === 0 ? <Alert tone="info">Nenhuma pessoa ainda. Comece adicionando o primeiro nome da árvore.</Alert> : null}

          {people.length > PAGE_SIZE ? (
            <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="pessoas" pageSizeOptions={[PAGE_SIZE]} />
          ) : null}

          <Button variant="secondary" size="sm" onClick={() => add()}>
            <AddRoundedIcon fontSize="small" />
            Adicionar pessoa
          </Button>
          <Preview code={value} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

/** Cadastro da linha do tempo em formulário: época/referência e acontecimento, na ordem em que aparecem. */
export function TimelineEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const initial = useMemo(() => parseTimeline(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [mode, setMode] = useState<Mode>(initial ? 'visual' : 'code');
  const [timeline, setTimeline] = useState<Timeline>(initial ?? { title: '', events: [] });
  const [notice, setNotice] = useState<string | null>(initial ? null : 'Este diagrama não segue o formato de linha do tempo, então ele abre como código.');
  const paging = usePagination(timeline.events, PAGE_SIZE);
  const sections = useMemo(() => [...new Set(timeline.events.map((event) => event.section.trim()).filter(Boolean))], [timeline.events]);

  function commit(next: Timeline) {
    setTimeline(next);
    onChange(timelineToMermaid(next));
  }

  function patch(id: string, change: Partial<TimelineEvent>) {
    commit({ ...timeline, events: timeline.events.map((event) => (event.id === id ? { ...event, ...change } : event)) });
  }

  function add() {
    const last = timeline.events[timeline.events.length - 1];
    const events = [...timeline.events, { id: newEventId(timeline.events), section: last?.section ?? '', when: '', what: '' }];
    commit({ ...timeline, events });
    paging.setPage(Math.floor((events.length - 1) / PAGE_SIZE));
  }

  function move(id: string, direction: -1 | 1) {
    const events = [...timeline.events];
    const index = events.findIndex((event) => event.id === id);
    const target = index + direction;
    if (target < 0 || target >= events.length) return;
    [events[index], events[target]] = [events[target], events[index]];
    commit({ ...timeline, events });
  }

  function changeMode(next: Mode) {
    if (next === 'visual') {
      const parsed = parseTimeline(value);
      if (!parsed) {
        setNotice('O código não está no formato de linha do tempo (precisa começar com "timeline"). Corrija para voltar ao formulário.');
        return;
      }
      setTimeline(parsed);
    }
    setNotice(null);
    setMode(next);
  }

  return (
    <div className="space-y-4">
      <ModeSwitch mode={mode} onChange={changeMode} />
      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {mode === 'code' ? (
        <MermaidField value={value} onChange={onChange} templates={TIMELINE_TEMPLATES} placeholder={'timeline\n  title Eventos importantes\n  Gênesis 12 : Chamado de Abraão'} />
      ) : (
        <>
          <Field label="Título" hint="Opcional. Aparece no topo da linha do tempo.">
            <Input value={timeline.title} onChange={(event) => commit({ ...timeline, title: event.target.value })} placeholder="Ex.: Eventos importantes" maxLength={80} />
          </Field>

          <ol className="space-y-3">
            {paging.pageItems.map((event, position) => {
              const index = paging.page * PAGE_SIZE + position;
              return (
                <li key={event.id} className="space-y-3 rounded-2xl border border-edge bg-surface-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-primary/15 px-2 font-display text-xs font-bold text-primary-strong dark:text-primary">{index + 1}</span>
                    <span className="flex-1" />
                    <Tooltip content="Subir">
                      <button type="button" className={iconButton} aria-label="Subir acontecimento" disabled={index === 0} onClick={() => move(event.id, -1)}>
                        <ArrowUpwardRoundedIcon fontSize="small" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Descer">
                      <button type="button" className={iconButton} aria-label="Descer acontecimento" disabled={index === timeline.events.length - 1} onClick={() => move(event.id, 1)}>
                        <ArrowDownwardRoundedIcon fontSize="small" />
                      </button>
                    </Tooltip>
                    <Tooltip content="Remover">
                      <button type="button" className={`${iconButton} hover:text-danger`} aria-label="Remover acontecimento" onClick={() => commit({ ...timeline, events: timeline.events.filter((item) => item.id !== event.id) })}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </button>
                    </Tooltip>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Field label="Referência ou época">
                      <Input value={event.when} onChange={(change) => patch(event.id, { when: change.target.value })} placeholder="Ex.: Gênesis 12:1" maxLength={60} />
                    </Field>
                    <Field label="O que aconteceu">
                      <Input value={event.what} onChange={(change) => patch(event.id, { what: change.target.value })} placeholder="Ex.: Deus chama Abraão" maxLength={160} />
                    </Field>
                  </div>
                  <Field label="Fase da vida" hint="Opcional. Quem fica sem fase continua na fase anterior.">
                    <Input value={event.section} onChange={(change) => patch(event.id, { section: change.target.value })} placeholder={sections.length ? `Ex.: ${sections[0]}` : 'Ex.: Juventude'} maxLength={40} />
                  </Field>
                </li>
              );
            })}
          </ol>

          {timeline.events.length === 0 ? <Alert tone="info">Nenhum acontecimento ainda. Adicione o primeiro para começar a linha do tempo.</Alert> : null}

          {timeline.events.length > PAGE_SIZE ? (
            <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="acontecimentos" pageSizeOptions={[PAGE_SIZE]} />
          ) : null}

          <Button variant="secondary" size="sm" onClick={add}>
            <AddRoundedIcon fontSize="small" />
            Adicionar acontecimento
          </Button>
          <Preview code={value} />
        </>
      )}
    </div>
  );
}
