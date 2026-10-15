-- Por enquanto só Davi começa liberado e os personagens dos cenários abrem pela campanha; os outros 5 padrão ficam desativados (o Painel reativa).
UPDATE "runner_characters" SET "active" = false WHERE "slug" IN ('debora', 'elias', 'ester', 'jonas', 'daniel');
