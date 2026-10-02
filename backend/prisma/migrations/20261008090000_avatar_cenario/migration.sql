-- Ícone de perfil (avatar) de cada cenário, entregue junto com a relíquia
ALTER TABLE "scenarios" ADD COLUMN "avatar_cosmetic_id" INTEGER;

ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_avatar_cosmetic_id_fkey" FOREIGN KEY ("avatar_cosmetic_id") REFERENCES "cosmetics"("id") ON DELETE SET NULL ON UPDATE CASCADE;
