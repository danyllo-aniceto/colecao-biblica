-- Moedas das paradas da campanha seguem um padrão só: 1 moeda a cada 10 XP do cenário (de 5 em 5), relíquia em dobro.
UPDATE "scenario_nodes" AS n
SET "reward_coins" = GREATEST(5, ROUND(s."xp_per_stop" / 10.0 / 5) * 5)::INTEGER * CASE WHEN n."relic" THEN 2 ELSE 1 END
FROM "scenarios" AS s
WHERE s."id" = n."scenario_id";
