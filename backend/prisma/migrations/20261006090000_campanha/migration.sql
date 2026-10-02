-- Raridade especial (carta única, só pela campanha)
ALTER TYPE "StickerRarity" ADD VALUE 'SPECIAL';

-- CreateTable
CREATE TABLE "scenarios" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "verse" TEXT,
    "verse_reference" TEXT,
    "color" TEXT,
    "map_image_url" TEXT,
    "icon_image_url" TEXT,
    "fragment_character_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenario_nodes" (
    "id" SERIAL NOT NULL,
    "scenario_id" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT,
    "relic" BOOLEAN NOT NULL DEFAULT false,
    "fragment" BOOLEAN NOT NULL DEFAULT false,
    "reward_coins" INTEGER NOT NULL DEFAULT 0,
    "reward_definition_id" INTEGER,
    "reward_cosmetic_id" INTEGER,
    "pos_x" INTEGER,
    "pos_y" INTEGER,

    CONSTRAINT "scenario_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scenarios_slug_key" ON "scenarios"("slug");
CREATE INDEX "scenarios_sort_order_idx" ON "scenarios"("sort_order");
CREATE UNIQUE INDEX "scenario_nodes_level_key" ON "scenario_nodes"("level");
CREATE INDEX "scenario_nodes_scenario_id_idx" ON "scenario_nodes"("scenario_id");

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_fragment_character_id_fkey" FOREIGN KEY ("fragment_character_id") REFERENCES "biblical_characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scenario_nodes" ADD CONSTRAINT "scenario_nodes_scenario_id_fkey" FOREIGN KEY ("scenario_id") REFERENCES "scenarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_nodes" ADD CONSTRAINT "scenario_nodes_reward_definition_id_fkey" FOREIGN KEY ("reward_definition_id") REFERENCES "reward_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scenario_nodes" ADD CONSTRAINT "scenario_nodes_reward_cosmetic_id_fkey" FOREIGN KEY ("reward_cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
