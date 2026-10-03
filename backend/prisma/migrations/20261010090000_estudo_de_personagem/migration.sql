-- Estudo de personagem: acertos acumulados por jogador e personagem (sem prêmios)
CREATE TABLE "character_studies" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "character_id" INTEGER NOT NULL,
    "correct_answers" INTEGER NOT NULL DEFAULT 0,
    "questions_answered" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_studies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "character_studies_user_id_character_id_key" ON "character_studies"("user_id", "character_id");

ALTER TABLE "character_studies" ADD CONSTRAINT "character_studies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "character_studies" ADD CONSTRAINT "character_studies_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "biblical_characters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
