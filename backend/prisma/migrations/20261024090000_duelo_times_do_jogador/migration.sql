-- Times prontos saem: cada jogador monta o próprio Time com as figurinhas que tem
ALTER TABLE "duel_cards" DROP COLUMN "teams";

CREATE TABLE "duel_decks" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "character_ids" INTEGER[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "duel_decks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "duel_decks_user_id_slot_key" ON "duel_decks"("user_id", "slot");

ALTER TABLE "duel_decks" ADD CONSTRAINT "duel_decks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
