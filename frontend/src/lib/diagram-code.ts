/**
 * Conversão entre os formulários visuais do painel (árvore genealógica e linha do tempo)
 * e o código Mermaid guardado no personagem. O banco continua guardando Mermaid, então
 * o que já foi cadastrado segue funcionando e pode ser aberto no formulário.
 */

// ---------------------------------------------------------------------------
// Árvore genealógica
// ---------------------------------------------------------------------------

export type Person = {
  id: string;
  name: string;
  /** Destaque (cor dourada) para o personagem da figurinha. */
  main: boolean;
  /** Ids dos pais (no máximo dois). */
  parents: string[];
  /** Id do cônjuge, quando tem. */
  spouse: string;
};

export function newPersonId(people: Person[]) {
  let index = people.length + 1;
  while (people.some((person) => person.id === `p${index}`)) index += 1;
  return `p${index}`;
}

const cleanLabel = (value: string) => value.replace(/["\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

export function genealogyToMermaid(people: Person[]) {
  const named = people.filter((person) => cleanLabel(person.name));
  if (named.length === 0) return '';
  const ids = new Set(named.map((person) => person.id));
  const lines = ['graph TD'];
  for (const person of named) lines.push(`  ${person.id}["${cleanLabel(person.name)}"]`);

  const spouses = new Set<string>();
  for (const person of named) {
    for (const parent of person.parents) if (ids.has(parent) && parent !== person.id) lines.push(`  ${parent} --> ${person.id}`);
    if (person.spouse && ids.has(person.spouse) && person.spouse !== person.id) {
      const key = [person.id, person.spouse].sort().join('|');
      if (!spouses.has(key)) {
        spouses.add(key);
        lines.push(`  ${person.id} --- ${person.spouse}`);
      }
    }
  }

  const mains = named.filter((person) => person.main).map((person) => person.id);
  lines.push('', 'classDef principal fill:#FDE68A,stroke:#B45309,color:#111827;');
  if (mains.length > 0) lines.push(`class ${mains.join(',')} principal;`);
  return lines.join('\n');
}

const NODE = /^([A-Za-z_]\w*)(?:\s*(?:\[\s*"?([^\]]*?)"?\s*\]|\(\s*"?([^)]*?)"?\s*\)))?$/;

/** Lê um Mermaid simples de árvore. Devolve null quando tem algo que o formulário não representa. */
export function parseGenealogy(code: string): Person[] | null {
  const source = code.trim();
  if (!source) return [];
  const byId = new Map<string, Person>();
  const order: string[] = [];

  const touch = (id: string, label?: string) => {
    let person = byId.get(id);
    if (!person) {
      person = { id, name: id, main: false, parents: [], spouse: '' };
      byId.set(id, person);
      order.push(id);
    }
    if (label) person.name = label;
    return person;
  };
  const readNode = (raw: string) => {
    const match = NODE.exec(raw.trim());
    if (!match) return null;
    return touch(match[1], (match[2] ?? match[3] ?? '').trim() || undefined);
  };

  let sawHeader = false;
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/;$/, '').trim();
    if (!line || line.startsWith('%%')) continue;
    if (/^(graph|flowchart)\s+(TD|TB)$/i.test(line)) {
      sawHeader = true;
      continue;
    }
    if (!sawHeader) return null;
    if (/^classDef\b/.test(line)) continue;
    const klass = /^class\s+([\w,\s]+?)\s+(\w+)$/.exec(line);
    if (klass) {
      if (klass[2] === 'principal') for (const id of klass[1].split(',')) if (id.trim()) touch(id.trim()).main = true;
      continue;
    }
    const parts = line.split(/\s*(-->|---)\s*/);
    const people = parts.filter((_, index) => index % 2 === 0).map(readNode);
    if (people.some((person) => !person)) return null;
    for (let index = 0; index < people.length - 1; index += 1) {
      const from = people[index]!;
      const to = people[index + 1]!;
      if (parts[index * 2 + 1] === '-->') {
        if (to.parents.length >= 2 && !to.parents.includes(from.id)) return null;
        if (!to.parents.includes(from.id)) to.parents.push(from.id);
      } else {
        if ((from.spouse && from.spouse !== to.id) || (to.spouse && to.spouse !== from.id)) return null;
        from.spouse = to.id;
        to.spouse = from.id;
      }
    }
  }
  return sawHeader ? order.map((id) => byId.get(id)!) : null;
}

// ---------------------------------------------------------------------------
// Linha do tempo
// ---------------------------------------------------------------------------

export type TimelineEvent = {
  id: string;
  /** Fase da vida (opcional). Eventos seguidos com a mesma fase ficam agrupados. */
  section: string;
  /** Referência ou época: "Gênesis 12:1", "1900 a.C.". */
  when: string;
  what: string;
};

export type Timeline = { title: string; events: TimelineEvent[] };

// O Mermaid usa ":" para separar época e acontecimento, então "Gênesis 12:1" quebraria o diagrama.
// Trocamos pelo dois-pontos de modificador, idêntico na tela, e desfazemos ao abrir o formulário.
const COLON = '꞉';
const toMermaidText = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/:/g, COLON).replace(/;/g, ',').replace(/%%/g, '').replace(/\s+/g, ' ').trim();
const fromMermaidText = (value: string) => value.replaceAll(COLON, ':').trim();

export function newEventId(events: TimelineEvent[]) {
  let index = events.length + 1;
  while (events.some((event) => event.id === `e${index}`)) index += 1;
  return `e${index}`;
}

export function timelineToMermaid({ title, events }: Timeline) {
  const filled = events.filter((event) => toMermaidText(event.when) && toMermaidText(event.what));
  if (filled.length === 0) return '';
  const lines = ['timeline'];
  if (toMermaidText(title)) lines.push(`  title ${toMermaidText(title)}`);
  let section: string | null = null;
  let last: { when: string; index: number } | null = null;
  const anySection = filled.some((event) => toMermaidText(event.section));
  let inherited = '';
  for (const event of filled) {
    // No Mermaid não dá para sair de uma fase: quem fica sem fase herda a anterior (ou "Geral").
    inherited = toMermaidText(event.section) || inherited || (anySection ? 'Geral' : '');
    const sectionName = inherited;
    if (sectionName !== (section ?? '')) {
      section = sectionName;
      last = null;
      if (sectionName) lines.push(`  section ${sectionName}`);
    }
    const when = toMermaidText(event.when);
    const what = toMermaidText(event.what);
    // Mesma época em seguida: vira mais um acontecimento na mesma linha.
    if (last && last.when === when) lines[last.index] += ` : ${what}`;
    else {
      lines.push(`  ${section ? '  ' : ''}${when} : ${what}`);
      last = { when, index: lines.length - 1 };
    }
  }
  return lines.join('\n');
}

export function parseTimeline(code: string): Timeline | null {
  const source = code.trim();
  if (!source) return { title: '', events: [] };
  const lines = source.split(/\r?\n/).map((line) => line.trim());
  if (!/^timeline$/i.test(lines[0] ?? '')) return null;
  const result: Timeline = { title: '', events: [] };
  let section = '';
  let previous: { when: string } | null = null;
  const add = (when: string, what: string) => result.events.push({ id: `e${result.events.length + 1}`, section, when, what });

  for (const line of lines.slice(1)) {
    if (!line || line.startsWith('%%')) continue;
    const title = /^title\s+(.*)$/i.exec(line);
    if (title) {
      result.title = fromMermaidText(title[1]);
      continue;
    }
    const sec = /^section\s+(.*)$/i.exec(line);
    if (sec) {
      section = fromMermaidText(sec[1]);
      previous = null;
      continue;
    }
    if (/^(classDef|class|direction)\b/i.test(line)) continue;
    const parts = line.split(/\s*:\s*/).map(fromMermaidText);
    if (line.startsWith(':')) {
      // Continuação: mais um acontecimento da época anterior.
      if (!previous) return null;
      for (const what of parts.slice(1)) if (what) add(previous.when, what);
      continue;
    }
    const [when, ...whats] = parts;
    if (!when) return null;
    previous = { when };
    if (whats.length === 0) add(when, '');
    for (const what of whats) add(when, what);
  }
  return result;
}
