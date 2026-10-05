-- Quiz geral em maratona (até as vidas acabarem) e baús da partida por desempenho
ALTER TABLE "quiz_sessions" ADD COLUMN "training" BOOLEAN NOT NULL DEFAULT false;

-- Baús por dia (antes: prêmios sorteados por dia)
UPDATE "game_settings" SET "setting_value" = '5' WHERE "setting_key" = 'quiz.general.rewardLimitPerDay' AND "setting_value" IN ('2', '3');

-- Maratona rende mais acertos por partida: menos partidas por dia com moedas e com XP cheio
UPDATE "game_settings" SET "setting_value" = '3' WHERE "setting_key" = 'economy.coinMatchLimitPerDay' AND "setting_value" IN ('5', '6');
UPDATE "game_settings" SET "setting_value" = '4' WHERE "setting_key" = 'quiz.general.xpFullMatchesPerDay' AND "setting_value" = '6';
