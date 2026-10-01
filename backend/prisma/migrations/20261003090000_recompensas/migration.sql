-- CreateEnum
CREATE TYPE "CosmeticType" AS ENUM ('AVATAR', 'FRAME', 'TITLE', 'NAME_COLOR', 'REACTION');

-- CreateEnum
CREATE TYPE "CosmeticUnlock" AS ENUM ('FREE', 'SHOP', 'REQUIREMENT', 'REWARD');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RewardType" ADD VALUE 'SKIP_QUESTION';
ALTER TYPE "RewardType" ADD VALUE 'SECOND_CHANCE';
ALTER TYPE "RewardType" ADD VALUE 'CROWD_HELP';
ALTER TYPE "RewardType" ADD VALUE 'VERSE_HINT';
ALTER TYPE "RewardType" ADD VALUE 'FREEZE_TIME';
ALTER TYPE "RewardType" ADD VALUE 'DOUBLE_COINS';
ALTER TYPE "RewardType" ADD VALUE 'COMBO_SHIELD';
ALTER TYPE "RewardType" ADD VALUE 'COSMETIC';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "reaction_id" INTEGER;

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "answers_a" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "answers_b" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "answers_c" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "answers_d" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "quiz_sessions" ADD COLUMN     "best_combo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "combo_coins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "combo_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "combo_shield_armed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "combo_shield_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "combo_streak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "crowd_question_id" INTEGER,
ADD COLUMN     "crowd_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "double_coins_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeze_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "frozen_question_id" INTEGER,
ADD COLUMN     "second_chance_question_id" INTEGER,
ADD COLUMN     "second_chance_removed" CHAR(1),
ADD COLUMN     "second_chance_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "skip_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verse_hint_question_id" INTEGER,
ADD COLUMN     "verse_hint_used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reward_definitions" ADD COLUMN     "boost_amount" INTEGER,
ADD COLUMN     "cosmetic_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_id" INTEGER,
ADD COLUMN     "best_combo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chest_level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "combo_shield_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "crowd_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "double_coins_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "frame_id" INTEGER,
ADD COLUMN     "freeze_time_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "name_color_id" INTEGER,
ADD COLUMN     "second_chance_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "showcase" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "skip_boosts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title_id" INTEGER,
ADD COLUMN     "verse_hint_boosts" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "cosmetics" (
    "id" SERIAL NOT NULL,
    "type" "CosmeticType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rarity" "StickerRarity" NOT NULL DEFAULT 'COMMON',
    "image_url" TEXT,
    "color" TEXT,
    "style" TEXT,
    "unlock" "CosmeticUnlock" NOT NULL,
    "price_coins" INTEGER,
    "requirement" TEXT,
    "requirement_value" INTEGER,
    "in_chest_pool" BOOLEAN NOT NULL DEFAULT false,
    "event_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cosmetics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cosmetics" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "cosmetic_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cosmetics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "character_collections" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reward_coins" INTEGER NOT NULL DEFAULT 0,
    "reward_cosmetic_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pass_tiers" (
    "id" SERIAL NOT NULL,
    "level" INTEGER NOT NULL,
    "required_xp" INTEGER NOT NULL,
    "reward_coins" INTEGER NOT NULL DEFAULT 0,
    "reward_definition_id" INTEGER,
    "reward_cosmetic_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "pass_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_events" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "xp_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "coin_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "color" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CollectionCharacters" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "cosmetics_type_active_idx" ON "cosmetics"("type", "active");

-- CreateIndex
CREATE UNIQUE INDEX "cosmetics_type_name_key" ON "cosmetics"("type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "user_cosmetics_user_id_cosmetic_id_key" ON "user_cosmetics"("user_id", "cosmetic_id");

-- CreateIndex
CREATE UNIQUE INDEX "character_collections_name_key" ON "character_collections"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pass_tiers_level_key" ON "pass_tiers"("level");

-- CreateIndex
CREATE INDEX "game_events_starts_at_ends_at_idx" ON "game_events"("starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "_CollectionCharacters_AB_unique" ON "_CollectionCharacters"("A", "B");

-- CreateIndex
CREATE INDEX "_CollectionCharacters_B_index" ON "_CollectionCharacters"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_fkey" FOREIGN KEY ("avatar_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_frame_id_fkey" FOREIGN KEY ("frame_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_title_id_fkey" FOREIGN KEY ("title_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_name_color_id_fkey" FOREIGN KEY ("name_color_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_definitions" ADD CONSTRAINT "reward_definitions_cosmetic_id_fkey" FOREIGN KEY ("cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_reaction_id_fkey" FOREIGN KEY ("reaction_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cosmetics" ADD CONSTRAINT "cosmetics_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "game_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cosmetics" ADD CONSTRAINT "user_cosmetics_cosmetic_id_fkey" FOREIGN KEY ("cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_collections" ADD CONSTRAINT "character_collections_reward_cosmetic_id_fkey" FOREIGN KEY ("reward_cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_tiers" ADD CONSTRAINT "pass_tiers_reward_definition_id_fkey" FOREIGN KEY ("reward_definition_id") REFERENCES "reward_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pass_tiers" ADD CONSTRAINT "pass_tiers_reward_cosmetic_id_fkey" FOREIGN KEY ("reward_cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionCharacters" ADD CONSTRAINT "_CollectionCharacters_A_fkey" FOREIGN KEY ("A") REFERENCES "biblical_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CollectionCharacters" ADD CONSTRAINT "_CollectionCharacters_B_fkey" FOREIGN KEY ("B") REFERENCES "character_collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Jogadores atuais não recebem baús retroativos: começam a contar a partir do nível de hoje.
UPDATE "users" SET "chest_level" = GREATEST("level", 1);
