-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'RESOLVED', 'DISMISSED');

-- AlterEnum
ALTER TYPE "QuizType" ADD VALUE 'DAILY_CHALLENGE';

-- AlterEnum
ALTER TYPE "RewardType" ADD VALUE 'STREAK_FREEZE';

-- AlterTable
ALTER TABLE "biblical_characters" ADD COLUMN     "publish_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "times_answered" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "times_correct" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "user_stickers" ADD COLUMN     "duplicates" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sticker_pity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streak_freezes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "user_claims" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "period_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_reports" (
    "id" SERIAL NOT NULL,
    "question_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "message" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,

    CONSTRAINT "question_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_claims_user_id_kind_code_period_key_key" ON "user_claims"("user_id", "kind", "code", "period_key");

-- CreateIndex
CREATE INDEX "question_reports_status_created_at_idx" ON "question_reports"("status", "created_at");

-- AddForeignKey
ALTER TABLE "user_claims" ADD CONSTRAINT "user_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_reports" ADD CONSTRAINT "question_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Ranking do desafio do dia e da liga semanal: partidas por tipo e data.
CREATE INDEX "quiz_matches_quiz_type_finished_at_idx" ON "quiz_matches"("quiz_type", "finished_at");
