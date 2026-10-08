import type { PowerUpKind, ScenarioRules } from "./engine";

/**
 * Regras do tabuleiro dos cenários das 12 Pedras do Peitoral (3 por pedra). Como os dez de lançamento, cada um tem a sua provação,
 * o seu evento e (quase sempre) um power-up exclusivo, só que montados com as peças que o motor já tem: provação (opcional, com
 * prêmio, perda ou ajuda ao último), perigo que muda de lugar, fogo, muros, tempestade, vigília, abrigos que dão power-up, power-up
 * inicial e a quantidade de atalhos, quedas, casas de poder e provações do caminho. É só dado: o motor lê estes objetos.
 */

type TrialOptions = { optional?: boolean; rewardPower?: boolean; losePower?: boolean; shareWithLast?: number };

const casas = (count: number) => `${count} ${count === 1 ? "casa" : "casas"}`;

/** Provação com o texto montado a partir dos números, para o texto nunca contrariar a regra. */
function trial(name: string, reward: number, penalty: number, options: TrialOptions = {}): ScenarioRules["trial"] {
  const win = [`avança ${casas(reward)}`];
  if (options.rewardPower) win.push("ganha um power-up");
  if (options.shareWithLast) win.push(`adianta o último colocado ${casas(options.shareWithLast)}`);
  const lose = [penalty > 0 ? `recua ${casas(penalty)}` : "não recua"];
  if (options.losePower) lose.push("perde um power-up");
  const text = options.optional
    ? `Arrisque uma pergunta difícil ou recuse e siga o caminho. Acertou, ${win.join(", ")}; errou, ${lose.join(" e ")}.`
    : `Pergunta difícil, tudo ou nada: acertou, ${win.join(", ")}; errou, ${lose.join(" e ")}.`;
  return { name, description: text.replace(/, ([^,;]+); /, (match, last) => (win.length > 1 ? ` e ${last}; ` : match)), reward, penalty, optional: Boolean(options.optional), ...(options.rewardPower ? { rewardPower: true } : {}), ...(options.losePower ? { losePower: true } : {}), ...(options.shareWithLast ? { shareWithLast: options.shareWithLast } : {}) };
}

type Spec = Omit<ScenarioRules, "slug" | "shelterGrants" | "exclusive"> & { shelterGrants?: boolean; exclusive?: PowerUpKind | null };

const make = (slug: string, spec: Spec): ScenarioRules => ({ shelterGrants: false, exclusive: null, ...spec, slug });

export const STONE_BOARD_SCENARIOS: Record<string, ScenarioRules> = Object.fromEntries(
  [
    // 1 · Sardônio
    make("babel", {
      trial: trial("Línguas confundidas", 2, 2, { losePower: true }),
      exclusive: "TRUMPET",
      event: { name: "A torre que ruiu", description: "Três muros barram o caminho (acerte 2 perguntas seguidas) até caírem, na rodada 8. Há mais quedas pelo caminho e a Trombeta derruba um muro na hora." },
      walls: { count: 3, fallsAtRound: 8 },
      density: { fall: 3 },
    }),
    make("betel", {
      trial: trial("Degraus da escada", 3, 2, { optional: true }),
      exclusive: "DOVE",
      event: { name: "A escada de Jacó", description: "O caminho tem muito mais atalhos para cima, como degraus entre o céu e a terra." },
      density: { shortcut: 4 },
    }),
    make("peniel", {
      trial: trial("Luta até o amanhecer", 3, 3, { rewardPower: true }),
      exclusive: "STAFF",
      event: { name: "Luta com o anjo", description: "A provação vale muito: acertou, +3 casas e um power-up; errou, recua 3. O Cajado troca de lugar com um rival." },
    }),
    // 2 · Topázio
    make("horebe", {
      trial: trial("Tire as sandálias", 2, 2, { optional: true }),
      exclusive: "LIGHT",
      event: { name: "A sarça que arde", description: "Há casas de fogo no caminho: quem para nelas recua 2. A Luz elimina 3 alternativas erradas." },
      fire: { count: 4, penalty: 2 },
    }),
    make("tabernaculo", {
      trial: trial("Ofertas ao santuário", 2, 2),
      shelterGrants: true,
      exclusive: "TENT",
      event: { name: "A tenda do encontro", description: "Os abrigos do Tabernáculo também dão um power-up, e a Tenda atravessa uma provação sem arriscar." },
    }),
    make("cidade-davi", {
      trial: trial("Salmo de Davi", 2, 2, { rewardPower: true }),
      exclusive: "WISDOM",
      event: { name: "O cerco dos jebuseus", description: "A cada 4 rodadas flechas caem em novas casas: quem para nelas recua 1 (o escudo protege)." },
      hazard: { name: "Flechas do cerco", description: "Casas atingidas pelas flechas: quem para nelas recua 1.", every: 4, count: 4, penalty: 1, labels: [{ emoji: "🏹", name: "Flechas do cerco" }] },
    }),
    // 3 · Carbúnculo
    make("carmelo", {
      trial: trial("Duelo dos profetas", 3, 3, { optional: true }),
      exclusive: "FOURTH",
      event: { name: "Fogo do céu", description: "A cada 2 rodadas o fogo desce sobre novas casas: quem para nelas recua 3 (o escudo protege). O Manto de Elias dá imunidade por uma rodada." },
      hazard: { name: "Fogo do céu", description: "Casas atingidas pelo fogo: quem para nelas recua 3.", every: 2, count: 2, penalty: 3, labels: [{ emoji: "☄️", name: "Fogo do céu" }] },
    }),
    make("ossos-secos", {
      trial: trial("Profetiza aos ossos", 2, 2, { shareWithLast: 1 }),
      exclusive: "TREE",
      event: { name: "Ossos que se levantam", description: "Vencer a provação também adianta o último colocado 1 casa, e a Árvore da Vida levanta quem ia recuar." },
    }),
    make("pentecostes", {
      trial: { name: "Línguas de fogo", description: "Todos respondem à mesma pergunta, um de cada vez. Só quem acerta avança 3 casas.", reward: 3, penalty: 0, optional: false },
      vigil: true,
      exclusive: "DOVE",
      event: { name: "O Espírito sobre todos", description: "As provações são vigílias: todos respondem juntos e quem acerta avança 3 casas. A Pomba mostra o versículo da pergunta." },
    }),
    // 4 · Esmeralda
    make("campos-belem", {
      trial: trial("Respigar no campo", 2, 1),
      shelterGrants: true,
      exclusive: "MANNA",
      event: { name: "A colheita", description: "Há mais casas de poder, os abrigos dão power-up e a provação perdoa: errou, recua só 1." },
      density: { power: 6 },
    }),
    make("elim", {
      trial: trial("Doze fontes", 2, 1),
      shelterGrants: true,
      exclusive: "TREE",
      event: { name: "O oásis", description: "Sem quedas no caminho, os abrigos dão power-up e a provação perdoa: errou, recua só 1." },
      density: { fall: 0 },
    }),
    make("monte-oliveiras", {
      trial: trial("Vigiar uma hora", 2, 2, { optional: true }),
      exclusive: "LIGHT",
      event: { name: "A noite no monte", description: "A cada 3 rodadas as sombras cobrem novas casas: quem para nelas recua 1 (o escudo protege)." },
      hazard: { name: "Sombras da noite", description: "Casas na sombra: quem para nelas recua 1.", every: 3, count: 3, penalty: 1, labels: [{ emoji: "🌙", name: "Sombras da noite" }] },
    }),
    // 5 · Safira
    make("ur-caldeus", {
      trial: trial("O chamado de Abraão", 3, 2, { optional: true }),
      exclusive: "TENT",
      event: { name: "Sair sem saber para onde", description: "A provação é opcional e vale +3 casas. Há mais atalhos no caminho dos patriarcas." },
      density: { shortcut: 3 },
    }),
    make("susa", {
      trial: trial("Ester diante do rei", 3, 3, { optional: true }),
      exclusive: "STAFF",
      event: { name: "A reviravolta", description: "Quem ousa a provação ganha 3 casas ou perde 3. O Cajado troca de lugar com um rival." },
    }),
    make("ninive", {
      trial: trial("A pregação de Jonas", 2, 0),
      exclusive: "DOVE",
      event: { name: "Nínive se arrependeu", description: "A provação é sem risco: errou, não recua. A Pomba mostra o versículo da pergunta." },
    }),
    // 6 · Diamante
    make("transfiguracao", {
      trial: trial("Três tendas", 2, 2),
      exclusive: "LIGHT",
      startPower: "LIGHT",
      event: { name: "O rosto brilhou como o sol", description: "Todos começam com a Luz na mochila (elimina 3 alternativas erradas)." },
    }),
    make("jordao", {
      trial: trial("O batismo", 2, 2, { rewardPower: true }),
      exclusive: "NET",
      event: { name: "A correnteza", description: "A cada 2 rodadas a correnteza cobre novas casas: quem para nelas recua 1 (o escudo protege). A Rede puxa um rival para trás." },
      hazard: { name: "Correnteza", description: "Casas na correnteza: quem para nelas recua 1.", every: 2, count: 3, penalty: 1, labels: [{ emoji: "🌊", name: "Correnteza do rio" }] },
    }),
    make("manjedoura", {
      trial: trial("Visita dos pastores", 2, 1, { shareWithLast: 2 }),
      shelterGrants: true,
      exclusive: "WISDOM",
      event: { name: "Os últimos serão os primeiros", description: "Vencer a provação adianta o último colocado 2 casas e os abrigos dão power-up." },
    }),
    // 7 · Jacinto
    make("damasco", {
      trial: trial("A luz da estrada", 2, 2, { rewardPower: true }),
      exclusive: "LIGHT",
      event: { name: "Ofuscados pela luz", description: "Em algumas rodadas a luz cega: quem erra a pergunta é levado 2 casas para trás (o escudo protege)." },
      storm: { chance: 0.25, drift: 2 },
    }),
    make("atenas", {
      trial: trial("Debate no Areópago", 2, 2, { rewardPower: true }),
      exclusive: "WISDOM",
      event: { name: "O Deus desconhecido", description: "Há mais casas de poder e a Sabedoria troca a pergunta sem gastar a sua ajuda da vez." },
      density: { power: 6 },
    }),
    make("corinto", {
      trial: trial("Plantar e regar", 2, 2),
      exclusive: "MANNA",
      event: { name: "O istmo", description: "Os navios atravessam o istmo: há muito mais atalhos, mas também uma queda a menos." },
      density: { shortcut: 4, fall: 1 },
    }),
    // 8 · Ágata
    make("efeso", {
      trial: trial("Os livros queimados", 2, 2, { rewardPower: true }),
      exclusive: "NET",
      event: { name: "A fogueira de Éfeso", description: "Há casas de fogo no caminho: quem para nelas recua 2. A Rede puxa um rival para trás." },
      fire: { count: 3, penalty: 2 },
    }),
    make("filipos", {
      trial: trial("Cantar na prisão", 2, 2, { optional: true }),
      exclusive: "TRUMPET",
      event: { name: "O terremoto da meia-noite", description: "Dois muros de prisão barram o caminho (acerte 2 perguntas seguidas) até caírem, na rodada 6. A Trombeta derruba um muro na hora." },
      walls: { count: 2, fallsAtRound: 6 },
    }),
    make("malta", {
      trial: trial("A víbora", 2, 2),
      exclusive: "FOURTH",
      event: { name: "O naufrágio", description: "Em muitas rodadas a tempestade sopra: quem erra a pergunta é levado 1 casa para trás (o escudo protege). O Quarto Homem dá imunidade por uma rodada." },
      storm: { chance: 0.4, drift: 1 },
    }),
    // 9 · Ametista
    make("roma", {
      trial: trial("Todos os caminhos", 2, 2),
      exclusive: "STAFF",
      event: { name: "Estradas romanas", description: "O caminho tem muito mais atalhos e poucas quedas. O Cajado troca de lugar com um rival." },
      density: { shortcut: 5, fall: 1 },
    }),
    make("antioquia", {
      trial: trial("Gente de todo tipo", 2, 2, { shareWithLast: 1 }),
      exclusive: "DOVE",
      startPower: "SWAP",
      event: { name: "Chamados cristãos", description: "Todos começam com Trocar pergunta e vencer a provação adianta o último colocado 1 casa." },
    }),
    make("samaria", {
      trial: trial("A mulher no poço", 2, 2, { shareWithLast: 2 }),
      exclusive: "MANNA",
      event: { name: "O samaritano socorre", description: "Vencer a provação adianta o último colocado 2 casas. A água viva refaz o dado sem gastar a sua ajuda da vez." },
    }),
    // 10 · Berilo
    make("patmos", {
      trial: trial("A visão do fim", 3, 3, { optional: true }),
      exclusive: "DOVE",
      event: { name: "Isolado na ilha", description: "Sem atalhos e sem quedas: só a jornada. A Pomba mostra o versículo da pergunta." },
      density: { shortcut: 0, fall: 0 },
    }),
    make("cesareia", {
      trial: trial("A casa de Cornélio", 2, 2),
      exclusive: "NET",
      event: { name: "A maré do porto", description: "A cada 3 rodadas a maré cobre novas casas: quem para nelas recua 2 (o escudo protege). A Rede puxa um rival para trás." },
      hazard: { name: "Maré do porto", description: "Casas na maré: quem para nelas recua 2.", every: 3, count: 3, penalty: 2, labels: [{ emoji: "⚓", name: "Maré do porto" }] },
    }),
    make("cafarnaum", {
      trial: trial("Pelo telhado", 2, 2, { rewardPower: true }),
      exclusive: "TENT",
      event: { name: "A casa cheia", description: "Há mais casas de poder, e a Tenda atravessa uma provação sem arriscar." },
      density: { power: 6 },
    }),
    // 11 · Ônix
    make("santa-ceia", {
      trial: trial("Lavar os pés", 2, 2, { shareWithLast: 1 }),
      shelterGrants: true,
      exclusive: "MANNA",
      event: { name: "A mesa posta", description: "Os abrigos dão power-up, vencer a provação adianta o último colocado 1 casa e o Maná refaz o dado sem gastar a sua ajuda da vez." },
    }),
    make("getsemani", {
      trial: trial("Vigiar e orar", 3, 3, { optional: true }),
      exclusive: "FOURTH",
      event: { name: "A noite do jardim", description: "A cada 3 rodadas a escuridão cobre novas casas: quem para nelas recua 2 (o escudo protege). O Quarto Homem dá imunidade por uma rodada." },
      hazard: { name: "Escuridão do jardim", description: "Casas na escuridão: quem para nelas recua 2.", every: 3, count: 2, penalty: 2, labels: [{ emoji: "🌑", name: "Escuridão do jardim" }] },
    }),
    make("calvario", {
      trial: trial("Ao pé da cruz", 3, 3, { losePower: true }),
      exclusive: "TREE",
      event: { name: "O caminho da cruz", description: "Há mais quedas pelo caminho e a provação cobra caro: errou, recua 3 e perde um power-up. A Árvore da Vida levanta quem ia recuar." },
      density: { fall: 3 },
    }),
    // 12 · Jaspe
    make("rio-da-vida", {
      trial: trial("Beber da água viva", 2, 1),
      shelterGrants: true,
      exclusive: "TREE",
      event: { name: "A árvore da vida", description: "Mais atalhos, nenhuma queda e abrigos que dão power-up. A provação perdoa: errou, recua só 1." },
      density: { shortcut: 4, fall: 0 },
    }),
    make("nova-jerusalem", {
      trial: trial("Entrar pelas portas", 2, 1),
      exclusive: "WISDOM",
      event: { name: "As doze portas", description: "Há muito mais provações pelo caminho, todas generosas: errou, recua só 1." },
      density: { trial: 5 },
    }),
    make("monte-siao", {
      trial: trial("Subir ao monte", 3, 2, { optional: true }),
      exclusive: "FOURTH",
      startPower: "FOURTH",
      event: { name: "O monte que não se abala", description: "Todos começam com o Quarto Homem (imunidade a recuos por uma rodada) e o caminho não tem quedas." },
      density: { fall: 0 },
    }),
  ].map((rules) => [rules.slug, rules]),
);
