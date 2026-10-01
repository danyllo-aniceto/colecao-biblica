-- Equilíbrio do jogo: novos padrões. Só muda o que ainda está no valor padrão antigo
-- (o que o admin já ajustou continua como está).

-- Configurações
UPDATE "game_settings" SET "setting_value" = '3'  WHERE "setting_key" = 'quiz.general.rewardLimitPerDay' AND "setting_value" = '4';
UPDATE "game_settings" SET "setting_value" = '20' WHERE "setting_key" = 'economy.perfectMatchBonusCoins' AND "setting_value" = '15';
UPDATE "game_settings" SET "setting_value" = '6'  WHERE "setting_key" = 'economy.coinMatchLimitPerDay' AND "setting_value" = '10';
UPDATE "game_settings" SET "setting_value" = '62' WHERE "setting_key" = 'pack.odds.common' AND "setting_value" = '60';
UPDATE "game_settings" SET "setting_value" = '9'  WHERE "setting_key" = 'pack.odds.epic' AND "setting_value" = '10';
UPDATE "game_settings" SET "setting_value" = '1'  WHERE "setting_key" = 'pack.odds.legendary' AND "setting_value" = '2';
UPDATE "game_settings" SET "setting_value" = '6'  WHERE "setting_key" = 'reward.pityThreshold' AND "setting_value" = '5';
UPDATE "game_settings" SET "setting_value" = '30' WHERE "setting_key" = 'chest.baseCoins' AND "setting_value" = '40';
UPDATE "game_settings" SET "setting_value" = '5'  WHERE "setting_key" = 'chest.coinsPerLevel' AND "setting_value" = '10';
UPDATE "game_settings" SET "setting_value" = '15' WHERE "setting_key" = 'chest.cosmeticChance' AND "setting_value" = '20';

-- Peso no sorteio das recompensas do sistema
UPDATE "reward_definitions" r SET "drop_chance" = v.novo
FROM (VALUES
  ('Figurinha Comum', 35, 20), ('Figurinha Rara', 20, 8), ('Figurinha Épica', 10, 3), ('Figurinha Lendária', 5, 1),
  ('Moedas', 20, 30), ('XP em dobro', 5, 6), ('Vida extra', 3, 5), ('Tempo extra', 2, 4), ('Dica 50/50', 4, 5),
  ('Pacote surpresa', 3, 2), ('Protetor de sequência', 2, 3),
  ('Pular pergunta', 2, 3), ('Segunda chance', 2, 3), ('Voz da multidão', 2, 3), ('Pista do versículo', 2, 3),
  ('Ampulheta', 2, 3), ('Bênção dobrada', 2, 3), ('Escudo de sequência', 2, 3)
) AS v(nome, antigo, novo)
WHERE r."system" = true AND r."name" = v.nome AND r."drop_chance" = v.antigo;

-- Preços das figurinhas na loja
UPDATE "shop_items" s SET "price_coins" = v.novo
FROM (VALUES ('Figurinha Comum', 120, 200), ('Figurinha Rara', 260, 450), ('Figurinha Épica', 450, 900), ('Pacote surpresa', 200, 300)) AS v(nome, antigo, novo)
WHERE s."system" = true AND s."name" = v.nome AND s."price_coins" = v.antigo;

-- Passe da temporada: trilha para durar o mês
UPDATE "pass_tiers" p SET "required_xp" = v.novo
FROM (VALUES (1, 200, 500), (2, 600, 1500), (3, 1200, 3000), (4, 2000, 5000), (5, 3000, 7500), (6, 4200, 10500), (7, 5600, 14000), (8, 7200, 18000)) AS v(degrau, antigo, novo)
WHERE p."level" = v.degrau AND p."required_xp" = v.antigo;

-- Curva de nível progressiva: cada nível pede 50 XP a mais que o anterior.
-- XP total do nível L = 200(L-1) + 25(L-1)(L-2)  =>  L = floor((sqrt(30625 + 100*xp) - 175) / 50) + 1.
-- O XP de ninguém muda; o nível é recalculado. Baús já abertos não se repetem (chest_level fica).
UPDATE "users" SET "level" = GREATEST(1, FLOOR((SQRT(30625 + 100 * "xp"::numeric) - 175) / 50)::int + 1);
