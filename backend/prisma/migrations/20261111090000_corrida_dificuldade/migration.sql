ALTER TABLE "runner_levels" ADD COLUMN "difficulty" INTEGER NOT NULL DEFAULT 50;
-- Dificuldade crescente dentro de cada cenário (10, 30, 50, 70, 90) e fases mais longas nas do seed.
UPDATE "runner_levels" l SET "difficulty" = LEAST(95, 10 + 20 * (r.rn - 1)) FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "scenario_id" ORDER BY "sort_order", "id") AS rn FROM "runner_levels") r WHERE l."id" = r."id" AND l."system" = true;
UPDATE "runner_levels" SET "seconds" = 80 WHERE "slug" = 'cd-1' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 95 WHERE "slug" = 'cd-2' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 110 WHERE "slug" = 'cd-3' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 125 WHERE "slug" = 'cd-4' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 140 WHERE "slug" = 'cd-5' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 110 WHERE "slug" = 'mv-1' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 125 WHERE "slug" = 'mv-2' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 140 WHERE "slug" = 'mv-3' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 155 WHERE "slug" = 'mv-4' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 125 WHERE "slug" = 'vo-1' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 140 WHERE "slug" = 'vo-2' AND "system" = true;
UPDATE "runner_levels" SET "seconds" = 155 WHERE "slug" = 'vo-3' AND "system" = true;
