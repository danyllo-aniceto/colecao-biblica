import type { Db } from "../db/prisma";
import { defaultXpPerStop, nodeCoins } from "./game-rules";
import { ensureScenarioAvatar } from "./scenario-avatar";
import { syncUserLevels } from "./xp-curve";

type DefaultScenario = {
  slug: string;
  name: string;
  description: string;
  verse: string;
  verseReference: string;
  /** Cor de destaque (#rrggbb) e do título de relíquia. */
  color: string;
  /** Primeiro e último nível do cenário: uma parada por nível; a última é a relíquia. */
  startLevel: number;
  endLevel: number;
  relicTitle: string;
  /** Estilo da moldura e emoji da reação exclusivos do cenário. */
  frameStyle: string;
  reaction: string;
  /** Pedra do Peitoral que este cenário ajuda a conquistar (3 cenários por pedra). Esses cenários não dão fragmento de Jesus. */
  stoneSlot?: number;
};

/**
 * Caminho de lançamento: 10 cenários e 50 níveis. O XP por nível cresce (200 + 50 por nível),
 * então os cenários começam curtos e ficam maiores; o 10º entrega a figurinha especial (Jesus).
 */
export const DEFAULT_SCENARIOS: DefaultScenario[] = [
  { slug: "eden", name: "Jardim do Éden", description: "O começo de tudo: o jardim que Deus plantou.", verse: "Deus viu tudo o que havia feito, e tudo havia ficado muito bom.", verseReference: "Gênesis 1:31", color: "#3fa34d", startLevel: 1, endLevel: 4, relicTitle: "Guardião do Éden", frameStyle: "laurel", reaction: "🍎" },
  { slug: "arca", name: "Arca de Noé", description: "A aliança de Deus depois do dilúvio, no Monte Ararate.", verse: "Porei meu arco-íris nas nuvens, e ele será o sinal da minha aliança com a terra.", verseReference: "Gênesis 9:13", color: "#3b8fb8", startLevel: 5, endLevel: 8, relicTitle: "Construtor da Arca", frameStyle: "ice", reaction: "🌈" },
  { slug: "canaa", name: "Terra de Canaã", description: "A jornada de Abraão, de Ur até a terra prometida.", verse: "Farei de você um grande povo, e o abençoarei; engrandecerei o seu nome, e você será uma bênção.", verseReference: "Gênesis 12:2", color: "#c49a3c", startLevel: 9, endLevel: 13, relicTitle: "Filho de Abraão", frameStyle: "wood", reaction: "⛺" },
  { slug: "egito", name: "Egito", description: "Do faraó às pragas e à travessia do Mar Vermelho.", verse: "O Senhor lutará por vocês; tão somente acalmem-se.", verseReference: "Êxodo 14:14", color: "#d6a540", startLevel: 14, endLevel: 18, relicTitle: "Libertado do Egito", frameStyle: "gold", reaction: "🐫" },
  { slug: "sinai", name: "Deserto do Sinai", description: "Quarenta anos de caminhada, o maná e a lei no monte.", verse: "Não terás outros deuses além de mim.", verseReference: "Êxodo 20:3", color: "#c8693a", startLevel: 19, endLevel: 23, relicTitle: "Peregrino do Deserto", frameStyle: "fire", reaction: "⛰️" },
  { slug: "jerico", name: "Jericó", description: "Os muros que caíram diante da fé do povo.", verse: "Pela fé caíram os muros de Jericó, depois de serem rodeados durante sete dias.", verseReference: "Hebreus 11:30", color: "#b5543c", startLevel: 24, endLevel: 28, relicTitle: "Trombeta de Jericó", frameStyle: "copper", reaction: "📯" },
  { slug: "templo", name: "Templo de Salomão", description: "A casa do Senhor em Jerusalém, com ouro, cedro e a Arca.", verse: "Alegrei-me quando me disseram: Vamos à casa do Senhor!", verseReference: "Salmo 122:1", color: "#e0b43a", startLevel: 29, endLevel: 33, relicTitle: "Sábio como Salomão", frameStyle: "royal", reaction: "🕎" },
  { slug: "babilonia", name: "Babilônia", description: "O exílio, a fornalha e a cova dos leões.", verse: "Ele livra e salva; faz sinais e maravilhas nos céus e na terra. Ele livrou Daniel do poder dos leões.", verseReference: "Daniel 6:27", color: "#2f5fb3", startLevel: 34, endLevel: 38, relicTitle: "Fiel na Babilônia", frameStyle: "silver", reaction: "🦁" },
  { slug: "galileia", name: "Mar da Galileia", description: "Barcos, redes e os primeiros discípulos de Jesus.", verse: "Venham, sigam-me, e eu os farei pescadores de homens.", verseReference: "Mateus 4:19", color: "#2aa1c4", startLevel: 39, endLevel: 44, relicTitle: "Pescador de Homens", frameStyle: "aurora", reaction: "⛵" },
  { slug: "jerusalem", name: "Jerusalém", description: "Do Monte das Oliveiras ao túmulo vazio.", verse: "Ele não está aqui; ressuscitou, como tinha dito.", verseReference: "Mateus 28:6", color: "#8e6bd1", startLevel: 45, endLevel: 50, relicTitle: "Testemunha da Ressurreição", frameStyle: "pearl", reaction: "🕊️" },
];

/**
 * Continuação da campanha, depois da figurinha de Jesus: as 12 Pedras do Peitoral (Êxodo 28). A cada 3 cenários, 1 pedra.
 * Todos têm 4 paradas; a 4ª é a relíquia. Plano completo em docs/campanha-12-pedras.md.
 */
export const STONE_SCENARIOS_DEFAULT: DefaultScenario[] = [
  { slug: "babel", name: "Torre de Babel", description: "A cidade e a torre que quiseram chegar ao céu: o Senhor confundiu as línguas e espalhou os povos.", verse: "Por isso foi chamada Babel, porque ali o Senhor confundiu a língua de toda a terra.", verseReference: "Gênesis 11:9", color: "#c8553d", startLevel: 51, endLevel: 54, relicTitle: "Sobrevivente de Babel", frameStyle: "copper", reaction: "🧱", stoneSlot: 1 },
  { slug: "betel", name: "Betel", description: "O sonho de Jacó: uma escada entre a terra e o céu.", verse: "Certamente o Senhor está neste lugar, e eu não sabia.", verseReference: "Gênesis 28:16", color: "#7a6fc4", startLevel: 55, endLevel: 58, relicTitle: "Sonhador de Betel", frameStyle: "galaxy", reaction: "🪜", stoneSlot: 1 },
  { slug: "peniel", name: "Peniel", description: "Jacó luta até o amanhecer e recebe um novo nome.", verse: "Não deixarei você ir enquanto não me abençoar.", verseReference: "Gênesis 32:26", color: "#2f8f9d", startLevel: 59, endLevel: 62, relicTitle: "Lutador de Peniel", frameStyle: "aurora", reaction: "🌅", stoneSlot: 1 },
  { slug: "horebe", name: "Sarça ardente em Horebe", description: "Moisés vê uma sarça que arde sem se consumir e ouve o chamado de Deus.", verse: "O anjo do Senhor lhe apareceu numa chama de fogo, do meio de uma sarça. Moisés viu que a sarça queimava, mas não se consumia.", verseReference: "Êxodo 3:2", color: "#e2742f", startLevel: 63, endLevel: 66, relicTitle: "Descalço diante da Sarça", frameStyle: "fire", reaction: "🔥", stoneSlot: 2 },
  { slug: "tabernaculo", name: "Tabernáculo", description: "A tenda onde Deus habitou no meio do povo, no deserto.", verse: "E me farão um santuário, para que eu habite no meio deles.", verseReference: "Êxodo 25:8", color: "#c9a227", startLevel: 67, endLevel: 70, relicTitle: "Servo do Tabernáculo", frameStyle: "gold", reaction: "🪔", stoneSlot: 2 },
  { slug: "cidade-davi", name: "Cidade de Davi", description: "Sião, a fortaleza conquistada por Davi, onde ele reinou e cantou salmos.", verse: "Davi, porém, conquistou a fortaleza de Sião, que é a Cidade de Davi.", verseReference: "2 Samuel 5:7", color: "#8f9a3c", startLevel: 71, endLevel: 74, relicTitle: "Harpista de Sião", frameStyle: "laurel", reaction: "🎵", stoneSlot: 2 },
  { slug: "carmelo", name: "Monte Carmelo", description: "O monte onde Elias desafiou os profetas de Baal e o fogo do Senhor desceu do céu.", verse: "Quando todo o povo viu isso, prostraram-se e disseram: O Senhor é Deus! O Senhor é Deus!", verseReference: "1 Reis 18:39", color: "#d6402a", startLevel: 75, endLevel: 78, relicTitle: "Testemunha do Carmelo", frameStyle: "sunset", reaction: "☁️", stoneSlot: 3 },
  { slug: "ossos-secos", name: "Vale dos Ossos Secos", description: "O vale da visão de Ezequiel, onde ossos secos voltam à vida pelo sopro de Deus.", verse: "Assim diz o Senhor Soberano a estes ossos: Farei entrar em vocês um espírito, e vocês viverão.", verseReference: "Ezequiel 37:5", color: "#a67c52", startLevel: 79, endLevel: 82, relicTitle: "Voz do Vale", frameStyle: "pearl", reaction: "🌬️", stoneSlot: 3 },
  { slug: "pentecostes", name: "Pentecostes", description: "Jerusalém, no dia de Pentecostes: os discípulos reunidos numa sala recebem o Espírito Santo, com línguas de fogo sobre cada um.", verse: "Quando chegou o dia de Pentecostes, todos estavam juntos num só lugar.", verseReference: "Atos 2:1", color: "#e0a03c", startLevel: 83, endLevel: 86, relicTitle: "Cheio do Espírito", frameStyle: "pentecost", reaction: "✨", stoneSlot: 3 },
  { slug: "campos-belem", name: "Campos de Belém", description: "Os campos de cevada de Belém, onde Rute respigou e encontrou abrigo e esperança.", verse: "Aonde você for, irei; onde você ficar, ficarei. O seu povo será o meu povo, e o seu Deus será o meu Deus.", verseReference: "Rute 1:16", color: "#9bb43a", startLevel: 87, endLevel: 90, relicTitle: "Respigador de Belém", frameStyle: "laurel", reaction: "🌾", stoneSlot: 4 },
  { slug: "elim", name: "Oásis de Elim", description: "O oásis do deserto, com doze fontes e setenta palmeiras, onde o povo descansou.", verse: "Depois chegaram a Elim, onde havia doze fontes de água e setenta palmeiras, e acamparam ali, junto às águas.", verseReference: "Êxodo 15:27", color: "#2fa66a", startLevel: 91, endLevel: 94, relicTitle: "Descansado em Elim", frameStyle: "ice", reaction: "🌴", stoneSlot: 4 },
  { slug: "monte-oliveiras", name: "Monte das Oliveiras", description: "A colina de oliveiras diante de Jerusalém, lugar de ensino, oração e despedida de Jesus.", verse: "Depois de cantarem um hino, saíram para o monte das Oliveiras.", verseReference: "Mateus 26:30", color: "#7a9a5b", startLevel: 95, endLevel: 98, relicTitle: "Vigia das Oliveiras", frameStyle: "silver", reaction: "🫒", stoneSlot: 4 },
];

/** Todos os cenários criados no deploy, na ordem do caminho. */
const ALL_SCENARIOS = [...DEFAULT_SCENARIOS, ...STONE_SCENARIOS_DEFAULT];

/** Nome da figurinha especial entregue pelos fragmentos. */
export const SPECIAL_CHARACTER_NAME = "Jesus";

/** Recompensas de ajuda que entram de vez em quando no caminho (se existirem no catálogo). */
const HELPER_REWARDS = ["Dica 50/50", "Pular pergunta", "Pacote surpresa", "Bênção dobrada"];

/**
 * Itens exclusivos do cenário, ganhos ao longo do caminho (nesta ordem, nas paradas antes da relíquia):
 * reação, cor do nome e moldura. A relíquia dá o título.
 */
function scenarioCosmetics(scenario: DefaultScenario, index: number) {
  return [
    { type: "REACTION" as const, name: `Reação: ${scenario.name}`, rarity: "COMMON" as const, style: scenario.reaction },
    { type: "NAME_COLOR" as const, name: `Cor: ${scenario.name}`, rarity: "RARE" as const, color: scenario.color },
    { type: "FRAME" as const, name: `Moldura: ${scenario.name}`, rarity: "EPIC" as const, color: scenario.color, style: scenario.frameStyle },
  ].map((item, step) => ({ ...item, description: `Exclusivo do cenário ${scenario.name}.`, unlock: "REWARD" as const, system: true, sortOrder: 800 + index * 10 + step }));
}

async function ensureSpecialCharacter(db: Db) {
  const existing = await db.biblicalCharacter.findUnique({ where: { name: SPECIAL_CHARACTER_NAME } });
  if (existing) {
    return existing.rarity === "SPECIAL" ? existing : db.biblicalCharacter.update({ where: { id: existing.id }, data: { rarity: "SPECIAL" } });
  }
  return db.biblicalCharacter.create({
    data: {
      name: SPECIAL_CHARACTER_NAME,
      rarity: "SPECIAL",
      testament: "NEW",
      shortSummary: "O Filho de Deus, Salvador do mundo",
      fullDescription: "Jesus Cristo, o Filho de Deus, nasceu em Belém, pregou o Reino de Deus, morreu na cruz e ressuscitou ao terceiro dia.",
      bibleBooks: "Mateus, Marcos, Lucas e João",
      bibleReferences: "Mt 1-28; Mc 1-16; Lc 1-24; Jo 1-21",
      historicalPeriod: "Século I",
      narrativeRole: "Messias e Salvador",
      keyVerses: "Jo 3:16; Jo 14:6",
      keywords: "salvação, graça, amor, ressurreição",
      createdBy: "SYSTEM",
    },
  });
}

/** Todo cenário tem seu ícone de perfil (também os criados antes desse recurso). */
async function ensureAllScenarioAvatars(db: Db) {
  for (const scenario of await db.scenario.findMany({ where: { avatarCosmeticId: null } })) {
    await ensureScenarioAvatar(db, scenario);
  }
}

/**
 * Cria a campanha de lançamento. Só mexe nos cenários que ainda não existem (por `slug`):
 * mapas, textos e recompensas ajustados pelo admin nunca são sobrescritos.
 */
export async function ensureDefaultCampaign(db: Db) {
  const existing = new Set((await db.scenario.findMany({ select: { slug: true } })).map((scenario) => scenario.slug));
  if (ALL_SCENARIOS.every((scenario) => existing.has(scenario.slug))) {
    await ensureAllScenarioAvatars(db);
    await syncUserLevels(db);
    return;
  }

  const special = await ensureSpecialCharacter(db);
  const stoneIds = new Map((await db.stone.findMany({ select: { id: true, slot: true } })).map((stone) => [stone.slot, stone.id]));
  const helpers = new Map(
    (await db.rewardDefinition.findMany({ where: { name: { in: HELPER_REWARDS } }, select: { id: true, name: true } })).map((reward) => [reward.name, reward.id]),
  );

  for (const [index, scenario] of ALL_SCENARIOS.entries()) {
    if (existing.has(scenario.slug)) continue;
    const title = await db.cosmetic.findFirst({ where: { type: "TITLE", name: scenario.relicTitle }, select: { id: true } });
    const relicTitleId =
      title?.id ??
      (
        await db.cosmetic.create({
          data: {
            type: "TITLE",
            name: scenario.relicTitle,
            description: `Relíquia do cenário ${scenario.name}.`,
            rarity: "EPIC",
            color: scenario.color,
            style: "glow",
            unlock: "REWARD",
            system: true,
            sortOrder: 900 + index,
          },
        })
      ).id;

    const itemIds: number[] = [];
    for (const item of scenarioCosmetics(scenario, index)) {
      const found = await db.cosmetic.findFirst({ where: { type: item.type, name: item.name }, select: { id: true } });
      itemIds.push(found?.id ?? (await db.cosmetic.create({ data: item })).id);
    }

    const created = await db.scenario.create({
      data: {
        slug: scenario.slug,
        name: scenario.name,
        description: scenario.description,
        verse: scenario.verse,
        verseReference: scenario.verseReference,
        color: scenario.color,
        sortOrder: (index + 1) * 10,
        xpPerStop: defaultXpPerStop(index),
        fragmentCharacterId: scenario.stoneSlot ? null : special.id,
        stoneId: stoneIds.get(scenario.stoneSlot ?? 0) ?? null,
        system: true,
      },
    });

    const levels = Array.from({ length: scenario.endLevel - scenario.startLevel + 1 }, (_, step) => scenario.startLevel + step);
    await db.scenarioNode.createMany({
      data: levels.map((level, step) => {
        const relic = level === scenario.endLevel;
        const helperName = !relic && step % 3 === 2 ? HELPER_REWARDS[(index + step) % HELPER_REWARDS.length] : null;
        return {
          scenarioId: created.id,
          level,
          relic,
          fragment: relic && !scenario.stoneSlot,
          title: relic ? `Relíquia: ${scenario.relicTitle}` : null,
          rewardCoins: nodeCoins(defaultXpPerStop(index), relic),
          rewardDefinitionId: helperName ? (helpers.get(helperName) ?? null) : null,
          rewardCosmeticId: relic ? relicTitleId : (itemIds[step] ?? null),
        };
      }),
      skipDuplicates: true,
    });
  }
  await ensureAllScenarioAvatars(db);
  await syncUserLevels(db);
}
