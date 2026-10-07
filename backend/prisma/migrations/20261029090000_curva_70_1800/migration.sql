-- Curva de XP por cenário reajustada (meta: campanha completa em 12 a 14 meses para quem joga 5 partidas por dia):
-- 500 XP por parada no primeiro cenário, +70 por cenário, teto de 1800. As moedas das paradas seguem o mesmo padrão
-- (1 moeda a cada 10 XP, de 5 em 5, relíquia em dobro).
UPDATE "scenarios" AS s
SET "xp_per_stop" = LEAST(1800, 500 + 70 * (ranked.position - 1))
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "sort_order", "id") AS position FROM "scenarios") AS ranked
WHERE ranked."id" = s."id";

UPDATE "scenario_nodes" AS n
SET "reward_coins" = GREATEST(5, ROUND(s."xp_per_stop" / 10.0 / 5) * 5)::INTEGER * CASE WHEN n."relic" THEN 2 ELSE 1 END
FROM "scenarios" AS s
WHERE s."id" = n."scenario_id";
