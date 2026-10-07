-- Avisos animados do Modo Tabuleiro online (o cliente toca só os que ainda não viu)
ALTER TABLE "board_rooms" ADD COLUMN "feed" JSONB NOT NULL DEFAULT '[]';
