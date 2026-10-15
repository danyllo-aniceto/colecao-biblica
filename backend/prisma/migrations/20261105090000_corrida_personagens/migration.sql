-- Personagens da Corrida (sprites por pose e sons enviados pelo painel). Os 6 primeiros vêm do seed, só com a cor (sem sprite o app desenha a forma).
CREATE TABLE "runner_characters" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#38bdf8',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "unlock_level" TEXT,
    "sprites" JSONB NOT NULL DEFAULT '{}',
    "sounds" JSONB NOT NULL DEFAULT '{}',
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "runner_characters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "runner_characters_slug_key" ON "runner_characters"("slug");
CREATE INDEX "runner_characters_active_sort_order_idx" ON "runner_characters"("active", "sort_order");

INSERT INTO "runner_characters" ("slug", "name", "description", "color", "sort_order", "system") VALUES
  ('davi', 'Davi', 'O pastor que enfrentou o gigante.', '#38bdf8', 1, true),
  ('debora', 'Débora', 'Juíza e profetisa de Israel.', '#f472b6', 2, true),
  ('elias', 'Elias', 'O profeta da carruagem de fogo.', '#fb923c', 3, true),
  ('ester', 'Ester', 'A rainha que salvou o seu povo.', '#c084fc', 4, true),
  ('jonas', 'Jonas', 'O profeta que passou três dias no peixe.', '#2dd4bf', 5, true),
  ('daniel', 'Daniel', 'Não temeu a cova dos leões.', '#facc15', 6, true);
