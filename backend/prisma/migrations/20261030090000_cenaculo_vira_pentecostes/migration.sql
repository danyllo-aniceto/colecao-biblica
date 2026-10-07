-- O cenário "Cenáculo" virou "Pentecostes" (a Santa Ceia ganha cenário próprio). Renomeia o que o seed já tinha criado, sem duplicar:
-- cenário, itens exclusivos dele e o título da parada. Só mexe se o Cenáculo existe e o Pentecostes ainda não.
UPDATE "scenarios"
SET "slug" = 'pentecostes',
    "name" = 'Pentecostes',
    "description" = 'Jerusalém, no dia de Pentecostes: os discípulos reunidos numa sala recebem o Espírito Santo, com línguas de fogo sobre cada um.'
WHERE "slug" = 'cenaculo' AND NOT EXISTS (SELECT 1 FROM "scenarios" WHERE "slug" = 'pentecostes');

UPDATE "cosmetics" AS c
SET "name" = m."novo",
    "description" = REPLACE(COALESCE(c."description", ''), 'Cenáculo', 'Pentecostes'),
    "image_url" = CASE WHEN c."image_url" = '/campaign/cenaculo/icon.png' THEN '/campaign/pentecostes/icon.png' ELSE c."image_url" END
FROM (VALUES
  ('REACTION', 'Reação: Cenáculo', 'Reação: Pentecostes'),
  ('NAME_COLOR', 'Cor: Cenáculo', 'Cor: Pentecostes'),
  ('FRAME', 'Moldura: Cenáculo', 'Moldura: Pentecostes'),
  ('AVATAR', 'Ícone: Cenáculo', 'Ícone: Pentecostes'),
  ('TITLE', 'Reunido no Cenáculo', 'Cheio do Espírito')
) AS m("tipo", "antigo", "novo")
WHERE c."type"::text = m."tipo" AND c."name" = m."antigo"
  AND NOT EXISTS (SELECT 1 FROM "cosmetics" x WHERE x."type" = c."type" AND x."name" = m."novo");

UPDATE "scenario_nodes"
SET "title" = REPLACE("title", 'Reunido no Cenáculo', 'Cheio do Espírito')
WHERE "title" LIKE '%Reunido no Cenáculo%';
