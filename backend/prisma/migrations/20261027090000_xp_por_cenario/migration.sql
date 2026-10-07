-- O custo de XP passa a ser do cenário (por parada): 500 no primeiro, +120 a cada cenário, teto de 3000.
ALTER TABLE "scenarios" ADD COLUMN "xp_per_stop" INTEGER NOT NULL DEFAULT 500;

UPDATE "scenarios" AS s
SET "xp_per_stop" = LEAST(3000, 500 + 120 * (ranked.position - 1))
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "sort_order", "id") AS position FROM "scenarios") AS ranked
WHERE ranked."id" = s."id";
