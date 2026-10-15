-- Personagens da campanha da Corrida por cenário: abrem ao concluir a fase indicada em unlock_level (id da fase em backend/src/runner/campaign.ts).
INSERT INTO "runner_characters" ("slug", "name", "description", "color", "sort_order", "unlock_level", "system") VALUES
  ('jonatas', 'Jônatas', 'O amigo fiel de Davi.', '#34d399', 7, 'cd-3', true),
  ('joabe', 'Joabe', 'O comandante do exército de Davi.', '#f87171', 8, 'cd-5', true),
  ('moises', 'Moisés', 'Guiou o povo pelo Mar Vermelho.', '#60a5fa', 9, 'mv-2', true),
  ('arao', 'Arão', 'O irmão e porta-voz de Moisés.', '#fbbf24', 10, 'mv-3', true),
  ('miria', 'Miriã', 'A profetisa que cantou à beira do mar.', '#f9a8d4', 11, 'mv-4', true),
  ('ezequiel', 'Ezequiel', 'O profeta do vale dos ossos secos.', '#a3e635', 12, 'vo-3', true)
ON CONFLICT ("slug") DO NOTHING;
