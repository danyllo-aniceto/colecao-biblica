-- Partida de mini game em andamento: o gabarito fica no servidor e a partida vale uma única vez.
CREATE TABLE "mini_game_runs" (
    "id" TEXT NOT NULL,
    "user_id" INTEGER NOT NULL,
    "game_id" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "mini_game_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mini_game_runs_user_id_game_id_idx" ON "mini_game_runs"("user_id", "game_id");

ALTER TABLE "mini_game_runs" ADD CONSTRAINT "mini_game_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
