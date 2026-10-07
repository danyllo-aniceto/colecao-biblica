-- Capas dos modos de jogo (Quiz, Tabuleiro e Duelo) enviadas pelo painel
CREATE TABLE "game_mode_designs" (
    "id" SERIAL NOT NULL,
    "mode" TEXT NOT NULL,
    "image_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_mode_designs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_mode_designs_mode_key" ON "game_mode_designs"("mode");
