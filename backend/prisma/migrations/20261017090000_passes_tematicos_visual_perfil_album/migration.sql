-- Novos itens visuais: fundo de perfil e capa do álbum
ALTER TYPE "CosmeticType" ADD VALUE 'PROFILE_BG';
ALTER TYPE "CosmeticType" ADD VALUE 'ALBUM_COVER';

ALTER TABLE "users" ADD COLUMN "profile_bg_id" INTEGER;
ALTER TABLE "users" ADD COLUMN "album_cover_id" INTEGER;
ALTER TABLE "users" ADD CONSTRAINT "users_profile_bg_id_fkey" FOREIGN KEY ("profile_bg_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "users_album_cover_id_fkey" FOREIGN KEY ("album_cover_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Passes temáticos: o passe atual vira o primeiro passe e os degraus passam a pertencer a ele
CREATE TABLE "passes" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "image_url" TEXT,
    "pinned_month" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "passes" ("name", "description", "active", "sort_order") VALUES ('Passe da temporada', 'A trilha mensal de prêmios.', true, 0);

ALTER TABLE "pass_tiers" ADD COLUMN "pass_id" INTEGER;
ALTER TABLE "pass_tiers" ADD COLUMN "duplicate_coins" INTEGER;
ALTER TABLE "pass_tiers" ADD COLUMN "duplicate_reward_definition_id" INTEGER;
UPDATE "pass_tiers" SET "pass_id" = (SELECT MIN("id") FROM "passes");
ALTER TABLE "pass_tiers" ALTER COLUMN "pass_id" SET NOT NULL;

DROP INDEX "pass_tiers_level_key";
CREATE UNIQUE INDEX "pass_tiers_pass_id_level_key" ON "pass_tiers"("pass_id", "level");

ALTER TABLE "pass_tiers" ADD CONSTRAINT "pass_tiers_pass_id_fkey" FOREIGN KEY ("pass_id") REFERENCES "passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pass_tiers" ADD CONSTRAINT "pass_tiers_duplicate_reward_definition_id_fkey" FOREIGN KEY ("duplicate_reward_definition_id") REFERENCES "reward_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
