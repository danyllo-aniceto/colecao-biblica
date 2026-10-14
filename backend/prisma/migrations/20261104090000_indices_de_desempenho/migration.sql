-- Índices nas chaves estrangeiras consultadas ou apagadas em cascata (sem eles, cada exclusão de personagem
-- ou pergunta varre a tabela inteira).
CREATE INDEX IF NOT EXISTS "user_stickers_character_id_idx" ON "user_stickers"("character_id");
CREATE INDEX IF NOT EXISTS "character_studies_character_id_idx" ON "character_studies"("character_id");
CREATE INDEX IF NOT EXISTS "user_comments_character_id_idx" ON "user_comments"("character_id");
CREATE INDEX IF NOT EXISTS "quiz_sessions_character_id_idx" ON "quiz_sessions"("character_id");
CREATE INDEX IF NOT EXISTS "question_reports_question_id_idx" ON "question_reports"("question_id");
CREATE INDEX IF NOT EXISTS "question_reports_user_id_idx" ON "question_reports"("user_id");
CREATE INDEX IF NOT EXISTS "messages_trade_id_idx" ON "messages"("trade_id");
CREATE INDEX IF NOT EXISTS "user_cosmetics_cosmetic_id_idx" ON "user_cosmetics"("cosmetic_id");
