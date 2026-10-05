-- Modo Tabuleiro: peão como item visual (emoji ou imagem) e imagem do tabuleiro de cada cenário
ALTER TYPE "CosmeticType" ADD VALUE 'PAWN';

ALTER TABLE "scenarios" ADD COLUMN "board_image_url" TEXT;
