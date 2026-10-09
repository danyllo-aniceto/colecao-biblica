-- Capa do cartão e fundo da tela de cada mini game (enviados pelo painel).
CREATE TABLE "mini_game_designs" (
    "id" SERIAL NOT NULL,
    "game_id" TEXT NOT NULL,
    "cover_url" TEXT,
    "background_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mini_game_designs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mini_game_designs_game_id_key" ON "mini_game_designs"("game_id");
