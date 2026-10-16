-- Vale dos Ossos Secos fica com 3 personagens: Ezequiel (já existia) + Daniel (abre na fase vo-6) e Jeremias (abre na fase vo-9).
INSERT INTO "runner_characters" ("slug", "name", "description", "color", "sort_order", "unlock_level", "scenario_slug", "system") VALUES
  ('daniel', 'Daniel', 'Não temeu a cova dos leões na Babilônia.', '#facc15', 13, 'vo-6', 'vale-dos-ossos-secos', true),
  ('jeremias', 'Jeremias', 'O profeta que chorou por Jerusalém e anunciou esperança.', '#818cf8', 14, 'vo-9', 'vale-dos-ossos-secos', true)
ON CONFLICT ("slug") DO UPDATE SET "scenario_slug" = EXCLUDED."scenario_slug", "unlock_level" = EXCLUDED."unlock_level", "active" = true;
