-- Nível da figurinha (sobe com repetidas), venda a amigos e baú de diamante
ALTER TABLE "user_stickers" ADD COLUMN "level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "quiz_matches" ADD COLUMN "chest_tier" TEXT;
ALTER TABLE "trades" ADD COLUMN "price_coins" INTEGER;
ALTER TABLE "trades" ADD COLUMN "seller_coins" INTEGER;
