-- Cartas do Modo Duelo (uma por personagem, cadastrada no painel ou por planilha)
CREATE TABLE "duel_cards" (
    "id" SERIAL NOT NULL,
    "character_id" INTEGER NOT NULL,
    "cost" INTEGER NOT NULL,
    "power" INTEGER NOT NULL,
    "tags" TEXT[],
    "trigger" TEXT,
    "effects" TEXT,
    "dom_text" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "teams" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duel_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "duel_cards_character_id_key" ON "duel_cards"("character_id");

ALTER TABLE "duel_cards" ADD CONSTRAINT "duel_cards_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "biblical_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
