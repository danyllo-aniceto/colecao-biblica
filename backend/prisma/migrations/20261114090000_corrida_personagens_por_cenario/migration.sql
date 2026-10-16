-- Cada cenário da Corrida tem um grupo de personagens (3 por cenário). O Davi começa liberado mas pertence à Cidade de Davi.
ALTER TABLE "runner_characters" ADD COLUMN "scenario_slug" TEXT;
UPDATE "runner_characters" SET "scenario_slug" = 'cidade-de-davi' WHERE "slug" IN ('davi', 'jonatas', 'joabe');
UPDATE "runner_characters" SET "scenario_slug" = 'mar-vermelho' WHERE "slug" IN ('moises', 'arao', 'miria');
UPDATE "runner_characters" SET "scenario_slug" = 'vale-dos-ossos-secos' WHERE "slug" = 'ezequiel';
