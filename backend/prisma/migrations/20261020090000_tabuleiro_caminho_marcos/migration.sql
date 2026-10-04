-- Tabuleiro: estilo das curvas do caminho e marcos do cenário (editáveis pelo painel)
ALTER TABLE "scenarios" ADD COLUMN "board_path_style" TEXT;
ALTER TABLE "scenarios" ADD COLUMN "board_landmarks" JSONB;
