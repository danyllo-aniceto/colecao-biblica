-- CreateEnum
CREATE TYPE "Testament" AS ENUM ('OLD', 'NEW');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RewardType" ADD VALUE 'STICKER_PACK';
ALTER TYPE "RewardType" ADD VALUE 'FIFTY_FIFTY';

-- AlterTable
ALTER TABLE "biblical_characters" ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "testament" "Testament";

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "bible_reference" TEXT,
ADD COLUMN     "explanation" TEXT;

-- AlterTable
ALTER TABLE "quiz_matches" ADD COLUMN     "coins_gained" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quiz_sessions" ADD COLUMN     "fifty_fifty_question_id" INTEGER,
ADD COLUMN     "fifty_fifty_removed" TEXT,
ADD COLUMN     "fifty_fifty_used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reward_definitions" ADD COLUMN     "hint_amount" INTEGER,
ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "shop_items" ADD COLUMN     "system" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daily_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hint_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_daily_claim" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_code_key" ON "user_achievements"("user_id", "code");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Recompensas e itens da loja que já existiam são os fixos do sistema; os novos
-- criados pelo painel ficam com system = false (podem ser excluídos).
UPDATE "reward_definitions" SET "system" = true;
UPDATE "shop_items" SET "system" = true;
