import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import type { Db } from "../db/prisma";
import { ensureFixedRewards, ensureFixedShopItems } from "./rewards";
import { ensureDefaultSettings } from "./settings";
import { ensureDefaultCampaign } from "./default-campaign";
import { ensureDefaultCosmetics, ensureDefaultPassTiers } from "./default-cosmetics";

type SeedOptions = {
  demoData: boolean;
  admin?: { email: string; password: string; name: string };
  log?: (message: string) => void;
};

async function ensureUser(db: Db, name: string, email: string, password: string, role: Role, log: (message: string) => void) {
  const normalized = email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) {
    return;
  }
  await db.user.create({
    data: { name, email: normalized, password: await bcrypt.hash(password, 10), role, createdBy: normalized, updatedBy: normalized },
  });
  log(`Usuário ${role} criado: ${normalized}`);
}

const DEMO_CHARACTERS = [
  {
    name: "Davi",
    rarity: "RARE",
    shortSummary: "Rei de Israel e homem segundo o coração de Deus",
    fullDescription: "Davi foi pastor, guerreiro e rei. Destacou-se por sua fé, liderança e arrependimento.",
    bibleBooks: "1 Samuel, 2 Samuel, Salmos",
    bibleReferences: "1Sm 16-31; 2Sm 1-24",
    historicalPeriod: "Monarquia unida de Israel",
    narrativeRole: "Rei e salmista",
    curiosities: "Derrotou Golias quando ainda era jovem",
    importantEvents: "Unção por Samuel; derrota de Golias; reinado em Jerusalém",
    keyVerses: "Salmo 23; 1Sm 17",
    keywords: "fé, coragem, liderança",
    question: { text: "Quem derrotou Golias?", difficulty: "EASY", timeLimitSeconds: 30, options: ["Saul", "Davi", "Jônatas", "Samuel"], correct: "B" },
  },
  {
    name: "Ester",
    rarity: "EPIC",
    shortSummary: "Rainha que intercedeu por seu povo",
    fullDescription: "Ester foi usada por Deus para preservar os judeus no império persa.",
    bibleBooks: "Ester",
    bibleReferences: "Et 1-10",
    historicalPeriod: "Período persa",
    narrativeRole: "Intercessora e rainha",
    curiosities: "Seu nome hebraico era Hadassa",
    importantEvents: "Concurso para rainha; denúncia de Hamã; livramento dos judeus",
    keyVerses: "Et 4:14",
    keywords: "coragem, providência, intercessão",
    question: { text: "Em qual livro encontramos a história de Ester?", difficulty: "EASY", timeLimitSeconds: 30, options: ["Rute", "Ester", "Neemias", "Esdras"], correct: "B" },
  },
  {
    name: "Paulo",
    rarity: "LEGENDARY",
    shortSummary: "Apóstolo missionário aos gentios",
    fullDescription: "Paulo, antes Saulo, foi transformado por Cristo e tornou-se um dos principais missionários da igreja primitiva.",
    bibleBooks: "Atos, Romanos, 1-2 Coríntios e outras epístolas",
    bibleReferences: "At 9-28",
    historicalPeriod: "Igreja primitiva",
    narrativeRole: "Apóstolo e teólogo",
    curiosities: "Realizou várias viagens missionárias",
    importantEvents: "Conversão no caminho de Damasco; viagens missionárias; prisões",
    keyVerses: "Rm 8:1; Gl 2:20",
    keywords: "graça, missão, evangelho",
    question: { text: "Qual era o nome de Paulo antes da conversão?", difficulty: "MEDIUM", timeLimitSeconds: 25, options: ["Silas", "Barnabé", "Saulo", "Timóteo"], correct: "C" },
  },
] as const;

async function seedDemoContent(db: Db, log: (message: string) => void) {
  if ((await db.biblicalCharacter.count()) > 0) {
    return;
  }
  const hasQuestions = (await db.question.count()) > 0;
  for (const { question, ...character } of DEMO_CHARACTERS) {
    const created = await db.biblicalCharacter.create({ data: { ...character, createdBy: "SYSTEM" } });
    if (!hasQuestions) {
      const [optionA, optionB, optionC, optionD] = question.options;
      await db.question.create({
        data: {
          text: question.text,
          difficulty: question.difficulty,
          timeLimitSeconds: question.timeLimitSeconds,
          optionA,
          optionB,
          optionC,
          optionD,
          correctOption: question.correct,
          relatedCharacterId: created.id,
        },
      });
    }
  }
  log("Personagens e perguntas de demonstração criados");
}

/**
 * Dados iniciais. Idempotente: roda em todo deploy sem duplicar nada nem
 * desfazer ajustes feitos pelo admin.
 */
export async function runSeed(db: Db, options: SeedOptions) {
  const log = options.log ?? (() => {});

  await ensureDefaultSettings(db);

  if (options.demoData) {
    await ensureUser(db, "Admin Teste", "admin2@email.com", "123456", "ADMIN", log);
    await ensureUser(db, "Usuário Teste", "user@email.com", "123456", "USER", log);
    await ensureUser(db, "Jogador Dois", "outro@email.com", "123456", "USER", log);
    await seedDemoContent(db, log);
  }

  if (options.admin) {
    if (options.admin.password.length < 8) {
      throw new Error("ADMIN_PASSWORD precisa ter pelo menos 8 caracteres");
    }
    await ensureUser(db, options.admin.name, options.admin.email, options.admin.password, "ADMIN", log);
  }

  await ensureFixedRewards(db);
  await ensureFixedShopItems(db);
  await ensureDefaultCosmetics(db);
  await ensureDefaultPassTiers(db);
  await ensureDefaultCampaign(db);
}
