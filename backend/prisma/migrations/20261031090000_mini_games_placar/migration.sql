-- Melhor pontuação da semana de cada jogador em cada mini game (ranking semanal liberado pelo Peitoral Completo).
CREATE TABLE "mini_game_scores" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "game_id" TEXT NOT NULL,
    "week_key" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mini_game_scores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mini_game_scores_user_id_game_id_week_key_key" ON "mini_game_scores"("user_id", "game_id", "week_key");
CREATE INDEX "mini_game_scores_week_key_score_idx" ON "mini_game_scores"("week_key", "score");

ALTER TABLE "mini_game_scores" ADD CONSTRAINT "mini_game_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
