-- Por enquanto a Corrida só tem 7 personagens (e são eles também os bots): Davi, Jônatas, Joabe, Moisés, Arão, Miriã e Ezequiel.
-- Os outros 5 padrão saem do jogo (a coluna de personagem das salas guarda só o identificador, sem chave estrangeira).
DELETE FROM "runner_characters" WHERE "slug" IN ('debora', 'elias', 'ester', 'jonas', 'daniel') AND "system" = true;
UPDATE "runner_characters" SET "active" = true WHERE "slug" IN ('davi', 'jonatas', 'joabe', 'moises', 'arao', 'miria', 'ezequiel');
