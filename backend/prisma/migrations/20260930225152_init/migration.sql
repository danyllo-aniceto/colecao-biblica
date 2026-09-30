-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "StickerRarity" AS ENUM ('COMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('STICKER', 'EXTRA_LIFE', 'EXTRA_TIME', 'XP_MULTIPLIER', 'COINS');

-- CreateEnum
CREATE TYPE "ShopItemType" AS ENUM ('STICKER', 'GAME_BONUS', 'ECONOMY');

-- CreateEnum
CREATE TYPE "QuizType" AS ENUM ('GENERAL', 'CHARACTER_STUDY');

-- CreateEnum
CREATE TYPE "QuizSessionStatus" AS ENUM ('IN_PROGRESS', 'FINISHED', 'ABANDONED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "coins" INTEGER NOT NULL DEFAULT 0,
    "total_score" INTEGER NOT NULL DEFAULT 0,
    "extra_life_boosts" INTEGER NOT NULL DEFAULT 0,
    "extra_time_boosts" INTEGER NOT NULL DEFAULT 0,
    "double_xp_boosts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "deleted_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biblical_characters" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "rarity" "StickerRarity" NOT NULL,
    "short_summary" TEXT NOT NULL,
    "full_description" TEXT NOT NULL,
    "bible_books" TEXT,
    "bible_references" TEXT,
    "historical_period" TEXT,
    "narrative_role" TEXT,
    "genealogy" TEXT,
    "curiosities" TEXT,
    "important_events" TEXT,
    "key_verses" TEXT,
    "keywords" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biblical_characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" SERIAL NOT NULL,
    "text" TEXT NOT NULL,
    "difficulty" "QuestionDifficulty" NOT NULL,
    "time_limit_seconds" INTEGER NOT NULL,
    "option_a" TEXT NOT NULL,
    "option_b" TEXT NOT NULL,
    "option_c" TEXT NOT NULL,
    "option_d" TEXT NOT NULL,
    "correct_option" CHAR(1) NOT NULL,
    "character_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_definitions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "reward_type" "RewardType" NOT NULL,
    "sticker_rarity" "StickerRarity",
    "sticker_character_id" INTEGER,
    "coin_amount" INTEGER,
    "extra_lives" INTEGER,
    "extra_time_seconds" INTEGER,
    "xp_multiplier" DOUBLE PRECISION,
    "drop_chance" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "reward_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "item_type" "ShopItemType" NOT NULL,
    "price_coins" INTEGER NOT NULL,
    "reward_definition_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "shop_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stickers" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_stickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_comments" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_matches" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quiz_type" "QuizType" NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3) NOT NULL,
    "questions_answered" INTEGER NOT NULL,
    "correct_answers" INTEGER NOT NULL,
    "wrong_answers" INTEGER NOT NULL,
    "xp_gained" INTEGER NOT NULL,
    "score_gained" INTEGER NOT NULL,
    "reward_granted" BOOLEAN NOT NULL DEFAULT false,
    "reward_granted_name" TEXT,

    CONSTRAINT "quiz_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quiz_sessions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "quiz_type" "QuizType" NOT NULL,
    "character_id" INTEGER,
    "status" "QuizSessionStatus" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "total_questions" INTEGER NOT NULL,
    "current_question_index" INTEGER NOT NULL DEFAULT 0,
    "lives_remaining" INTEGER NOT NULL,
    "correct_answers" INTEGER NOT NULL DEFAULT 0,
    "wrong_answers" INTEGER NOT NULL DEFAULT 0,
    "xp_multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "extra_time_used" BOOLEAN NOT NULL DEFAULT false,
    "extra_life_used" BOOLEAN NOT NULL DEFAULT false,
    "xp_multiplier_used" BOOLEAN NOT NULL DEFAULT false,
    "question_ids" INTEGER[],
    "current_question_started_at" TIMESTAMP(3),
    "current_question_extra_seconds" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quiz_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_settings" (
    "id" SERIAL NOT NULL,
    "setting_key" TEXT NOT NULL,
    "setting_value" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "game_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_total_score_xp_idx" ON "users"("total_score", "xp");

-- CreateIndex
CREATE UNIQUE INDEX "biblical_characters_name_key" ON "biblical_characters"("name");

-- CreateIndex
CREATE INDEX "questions_active_character_id_idx" ON "questions"("active", "character_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_definitions_name_key" ON "reward_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "shop_items_name_key" ON "shop_items"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_stickers_user_id_character_id_key" ON "user_stickers"("user_id", "character_id");

-- CreateIndex
CREATE INDEX "user_comments_user_id_updated_at_idx" ON "user_comments"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "quiz_matches_user_id_finished_at_idx" ON "quiz_matches"("user_id", "finished_at");

-- CreateIndex
CREATE INDEX "quiz_sessions_user_id_status_idx" ON "quiz_sessions"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "game_settings_setting_key_key" ON "game_settings"("setting_key");

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "biblical_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_definitions" ADD CONSTRAINT "reward_definitions_sticker_character_id_fkey" FOREIGN KEY ("sticker_character_id") REFERENCES "biblical_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_items" ADD CONSTRAINT "shop_items_reward_definition_id_fkey" FOREIGN KEY ("reward_definition_id") REFERENCES "reward_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stickers" ADD CONSTRAINT "user_stickers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_stickers" ADD CONSTRAINT "user_stickers_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "biblical_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comments" ADD CONSTRAINT "user_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_comments" ADD CONSTRAINT "user_comments_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "biblical_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_matches" ADD CONSTRAINT "quiz_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "biblical_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- No máximo uma partida em andamento por usuário (evita duas sessões abertas por cliques simultâneos).
CREATE UNIQUE INDEX "quiz_sessions_one_in_progress_per_user" ON "quiz_sessions"("user_id") WHERE "status" = 'IN_PROGRESS';
