-- Baús à venda na loja, visual dos baús e fundo do quiz por cenário
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'CHEST_BRONZE';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'CHEST_SILVER';
ALTER TYPE "RewardType" ADD VALUE IF NOT EXISTS 'CHEST_GOLD';

ALTER TABLE "scenarios" ADD COLUMN "quiz_background_url" TEXT;

CREATE TABLE "chest_designs" (
    "id" SERIAL NOT NULL,
    "tier" TEXT NOT NULL,
    "image_url" TEXT,
    "name" TEXT,
    "color" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chest_designs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "chest_designs_tier_key" ON "chest_designs"("tier");
