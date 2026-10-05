-- Rebalanceamento da economia: moedas, preços, sorteios e freio diário de XP.
-- Só altera valores que ainda estão no padrão antigo; o que o admin já ajustou fica como está.

-- Preços da loja (itens do sistema)
UPDATE "shop_items" SET "price_coins" = 450 WHERE "system" = true AND "name" = 'Figurinha Comum' AND "price_coins" = 200;
UPDATE "shop_items" SET "price_coins" = 1100 WHERE "system" = true AND "name" = 'Figurinha Rara' AND "price_coins" = 450;
UPDATE "shop_items" SET "price_coins" = 2800 WHERE "system" = true AND "name" = 'Figurinha Épica' AND "price_coins" = 900;
UPDATE "shop_items" SET "price_coins" = 300 WHERE "system" = true AND "name" = 'XP em dobro' AND "price_coins" = 220;
UPDATE "shop_items" SET "price_coins" = 250 WHERE "system" = true AND "name" = 'Vida extra' AND "price_coins" = 180;
UPDATE "shop_items" SET "price_coins" = 200 WHERE "system" = true AND "name" = 'Tempo extra' AND "price_coins" = 150;
UPDATE "shop_items" SET "price_coins" = 190 WHERE "system" = true AND "name" = 'Dica 50/50' AND "price_coins" = 140;
UPDATE "shop_items" SET "price_coins" = 750 WHERE "system" = true AND "name" = 'Pacote surpresa' AND "price_coins" = 300;
UPDATE "shop_items" SET "price_coins" = 350 WHERE "system" = true AND "name" = 'Protetor de sequência' AND "price_coins" = 250;
UPDATE "shop_items" SET "price_coins" = 220 WHERE "system" = true AND "name" = 'Pular pergunta' AND "price_coins" = 160;
UPDATE "shop_items" SET "price_coins" = 270 WHERE "system" = true AND "name" = 'Segunda chance' AND "price_coins" = 200;
UPDATE "shop_items" SET "price_coins" = 200 WHERE "system" = true AND "name" = 'Voz da multidão' AND "price_coins" = 150;
UPDATE "shop_items" SET "price_coins" = 180 WHERE "system" = true AND "name" = 'Pista do versículo' AND "price_coins" = 130;
UPDATE "shop_items" SET "price_coins" = 230 WHERE "system" = true AND "name" = 'Ampulheta' AND "price_coins" = 170;
UPDATE "shop_items" SET "price_coins" = 330 WHERE "system" = true AND "name" = 'Bênção dobrada' AND "price_coins" = 240;
UPDATE "shop_items" SET "price_coins" = 200 WHERE "system" = true AND "name" = 'Escudo de sequência' AND "price_coins" = 150;

-- Chances dos sorteios de recompensa
UPDATE "reward_definitions" SET "drop_chance" = 9 WHERE "system" = true AND "name" = 'Figurinha Comum' AND "drop_chance" = 20;
UPDATE "reward_definitions" SET "drop_chance" = 3.5 WHERE "system" = true AND "name" = 'Figurinha Rara' AND "drop_chance" = 8;
UPDATE "reward_definitions" SET "drop_chance" = 1.2 WHERE "system" = true AND "name" = 'Figurinha Épica' AND "drop_chance" = 3;
UPDATE "reward_definitions" SET "drop_chance" = 0.4 WHERE "system" = true AND "name" = 'Figurinha Lendária' AND "drop_chance" = 1;
UPDATE "reward_definitions" SET "drop_chance" = 1.5 WHERE "system" = true AND "name" = 'Pacote surpresa' AND "drop_chance" = 2;
UPDATE "reward_definitions" SET "coin_amount" = 40 WHERE "system" = true AND "name" = 'Moedas' AND "coin_amount" = 50;

-- Configurações do jogo
UPDATE "game_settings" SET "setting_value" = '2' WHERE "setting_key" = 'quiz.general.rewardLimitPerDay' AND "setting_value" IN ('3', '3.0');
UPDATE "game_settings" SET "setting_value" = '15' WHERE "setting_key" = 'economy.perfectMatchBonusCoins' AND "setting_value" IN ('20', '20.0');
UPDATE "game_settings" SET "setting_value" = '5' WHERE "setting_key" = 'economy.coinMatchLimitPerDay' AND "setting_value" IN ('6', '6.0');
UPDATE "game_settings" SET "setting_value" = '55' WHERE "setting_key" = 'economy.duplicateCoins.common' AND "setting_value" IN ('15', '15.0');
UPDATE "game_settings" SET "setting_value" = '135' WHERE "setting_key" = 'economy.duplicateCoins.rare' AND "setting_value" IN ('40', '40.0');
UPDATE "game_settings" SET "setting_value" = '340' WHERE "setting_key" = 'economy.duplicateCoins.epic' AND "setting_value" IN ('90', '90.0');
UPDATE "game_settings" SET "setting_value" = '800' WHERE "setting_key" = 'economy.duplicateCoins.legendary' AND "setting_value" IN ('200', '200.0');
UPDATE "game_settings" SET "setting_value" = '100' WHERE "setting_key" = 'daily.day7Coins' AND "setting_value" IN ('120', '120.0');
UPDATE "game_settings" SET "setting_value" = '132' WHERE "setting_key" = 'pack.odds.common' AND "setting_value" IN ('62', '62.0');
UPDATE "game_settings" SET "setting_value" = '54' WHERE "setting_key" = 'pack.odds.rare' AND "setting_value" IN ('28', '28.0');
UPDATE "game_settings" SET "setting_value" = '13' WHERE "setting_key" = 'pack.odds.epic' AND "setting_value" IN ('9', '9.0');
UPDATE "game_settings" SET "setting_value" = '1' WHERE "setting_key" = 'pack.odds.legendary' AND "setting_value" IN ('1', '1.0');
UPDATE "game_settings" SET "setting_value" = '10' WHERE "setting_key" = 'reward.pityThreshold' AND "setting_value" IN ('6', '6.0');
UPDATE "game_settings" SET "setting_value" = '20' WHERE "setting_key" = 'chest.baseCoins' AND "setting_value" IN ('30', '30.0');
UPDATE "game_settings" SET "setting_value" = '3' WHERE "setting_key" = 'chest.coinsPerLevel' AND "setting_value" IN ('5', '5.0');
UPDATE "game_settings" SET "setting_value" = '80' WHERE "setting_key" = 'chest.maxCoins' AND "setting_value" IN ('150', '150.0');
UPDATE "game_settings" SET "setting_value" = '1' WHERE "setting_key" = 'shop.stickerLimitPerDay' AND "setting_value" IN ('2', '2.0');

-- Moedas das paradas da campanha (fórmula nova: 15 + 1,5 por nível; relíquia em dobro)
UPDATE "scenario_nodes" SET "reward_coins" = (CASE WHEN "relic" THEN 2 ELSE 1 END) * (ROUND((15 + 1.5 * "level") / 5.0) * 5)
WHERE "reward_coins" = (CASE WHEN "relic" THEN 2 ELSE 1 END) * (ROUND((20 + 2 * "level") / 5.0) * 5);
