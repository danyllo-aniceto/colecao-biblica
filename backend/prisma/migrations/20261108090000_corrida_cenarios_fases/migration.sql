-- Cenários e fases da campanha da Corrida (o Painel cria, edita e testa as fases). O seed é a campanha atual.
CREATE TABLE "runner_scenarios" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "story" TEXT,
    "sky_top" TEXT NOT NULL DEFAULT '#0f172a',
    "sky_bottom" TEXT NOT NULL DEFAULT '#1e3a5f',
    "art" JSONB NOT NULL DEFAULT '{}',
    "music_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runner_scenarios_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runner_levels" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "scenario_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "seed" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "form_order" JSONB NOT NULL DEFAULT '["RUN"]',
    "verse_ref" TEXT NOT NULL,
    "verse_text" TEXT NOT NULL,
    "forks" BOOLEAN NOT NULL DEFAULT true,
    "powers" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runner_levels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runner_scenarios_slug_key" ON "runner_scenarios"("slug");
CREATE INDEX "runner_scenarios_active_sort_order_idx" ON "runner_scenarios"("active", "sort_order");
CREATE UNIQUE INDEX "runner_levels_slug_key" ON "runner_levels"("slug");
CREATE INDEX "runner_levels_scenario_id_sort_order_idx" ON "runner_levels"("scenario_id", "sort_order");

ALTER TABLE "runner_levels" ADD CONSTRAINT "runner_levels_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "runner_scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "runner_scenarios" ("slug","name","story","sky_top","sky_bottom","sort_order","system") VALUES ('cidade-de-davi', 'Cidade de Davi', 'Jerusalém, a cidade do rei Davi, o pastor que virou rei.', '#1c1917', '#78350f', 1, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('cd-1', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'cidade-de-davi'), 'O pastor', 101, 50, '["RUN"]'::jsonb, 'Salmos 23:1', 'O Senhor é o meu pastor; nada me faltará.', 1, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('cd-2', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'cidade-de-davi'), 'A luz de Davi', 102, 60, '["RUN","FLY"]'::jsonb, 'Salmos 27:1', 'O Senhor é a minha luz e a minha salvação; a quem temerei?', 2, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('cd-3', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'cidade-de-davi'), 'Rei em Jerusalém', 103, 70, '["RUN","FLY","RUN"]'::jsonb, '2 Samuel 5:10', 'Davi ia crescendo em poder, porque o Senhor Deus dos Exércitos era com ele.', 3, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('cd-4', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'cidade-de-davi'), 'Refúgio e fortaleza', 104, 80, '["RUN","FLY","RUN","GRAVITY"]'::jsonb, 'Salmos 46:1', 'Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia.', 4, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('cd-5', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'cidade-de-davi'), 'Os montes de Sião', 105, 90, '["RUN","FLY","RUN","GRAVITY"]'::jsonb, 'Salmos 121:1', 'Levanto os meus olhos para os montes, de onde vem o meu socorro.', 5, true);
INSERT INTO "runner_scenarios" ("slug","name","story","sky_top","sky_bottom","sort_order","system") VALUES ('mar-vermelho', 'Mar Vermelho', 'As águas se abriram para o povo de Deus passar em seco.', '#0c1a3a', '#7f1d1d', 2, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('mv-1', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'mar-vermelho'), 'Não temais', 201, 70, '["RUN","FLY"]'::jsonb, 'Êxodo 14:13', 'Não temais; estai quietos e vede o livramento do Senhor.', 1, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('mv-2', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'mar-vermelho'), 'O Senhor pelejará', 202, 80, '["RUN","GRAVITY","RUN"]'::jsonb, 'Êxodo 14:14', 'O Senhor pelejará por vós, e vós vos calareis.', 2, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('mv-3', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'mar-vermelho'), 'Cântico da vitória', 203, 90, '["RUN","FLY","RUN","GRAVITY"]'::jsonb, 'Êxodo 15:2', 'O Senhor é a minha força e o meu cântico; ele me foi por salvação.', 3, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('mv-4', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'mar-vermelho'), 'Caminho pelo mar', 204, 100, '["RUN","FLY","RUN","GRAVITY"]'::jsonb, 'Salmos 77:19', 'O teu caminho foi pelo mar, e as tuas veredas, pelas grandes águas.', 4, true);
INSERT INTO "runner_scenarios" ("slug","name","story","sky_top","sky_bottom","sort_order","system") VALUES ('vale-dos-ossos-secos', 'Vale dos Ossos Secos', 'O vale onde o Espírito de Deus devolveu a vida aos ossos.', '#18181b', '#365314', 3, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('vo-1', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'vale-dos-ossos-secos'), 'Viverão estes ossos?', 301, 80, '["RUN","FLY","RUN","GRAVITY"]'::jsonb, 'Ezequiel 37:3', 'Filho do homem, porventura viverão estes ossos?', 1, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('vo-2', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'vale-dos-ossos-secos'), 'O sopro de vida', 302, 90, '["RUN","FLY","RUN","GRAVITY"]'::jsonb, 'Ezequiel 37:5', 'Eis que farei entrar o espírito em vós, e vivereis.', 2, true);
INSERT INTO "runner_levels" ("slug","scenario_id","name","seed","seconds","form_order","verse_ref","verse_text","sort_order","system") VALUES ('vo-3', (SELECT "id" FROM "runner_scenarios" WHERE "slug" = 'vale-dos-ossos-secos'), 'Um coração novo', 303, 100, '["GRAVITY","RUN","FLY","RUN"]'::jsonb, 'Ezequiel 36:26', 'Dar-vos-ei um coração novo e porei dentro de vós um espírito novo.', 3, true);
