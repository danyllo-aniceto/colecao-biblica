-- AlterEnum
ALTER TYPE "CosmeticType" ADD VALUE 'BADGE';

-- AlterTable
ALTER TABLE "scenarios" ADD COLUMN     "stone_id" INTEGER;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "badge_id" INTEGER;

-- CreateTable
CREATE TABLE "stones" (
    "id" SERIAL NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tribe" TEXT,
    "color" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "reward_coins" INTEGER NOT NULL DEFAULT 0,
    "reward_cosmetic_id" INTEGER,
    "badge_cosmetic_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "stones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stones_slot_key" ON "stones"("slot");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_stone_id_fkey" FOREIGN KEY ("stone_id") REFERENCES "stones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stones" ADD CONSTRAINT "stones_reward_cosmetic_id_fkey" FOREIGN KEY ("reward_cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stones" ADD CONSTRAINT "stones_badge_cosmetic_id_fkey" FOREIGN KEY ("badge_cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

