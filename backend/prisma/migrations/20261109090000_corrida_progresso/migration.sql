-- Progresso do jogador na campanha da Corrida: melhor resultado de cada fase, conferido pelo servidor (estrelas = terminou, todas as palavras, sem cair).
CREATE TABLE "runner_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "level_slug" TEXT NOT NULL,
    "best_permille" INTEGER NOT NULL DEFAULT 0,
    "best_words" INTEGER NOT NULL DEFAULT 0,
    "finished" BOOLEAN NOT NULL DEFAULT false,
    "all_words" BOOLEAN NOT NULL DEFAULT false,
    "clean" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runner_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runner_progress_user_id_level_slug_key" ON "runner_progress"("user_id", "level_slug");

ALTER TABLE "runner_progress" ADD CONSTRAINT "runner_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
