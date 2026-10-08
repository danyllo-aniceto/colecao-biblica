# Mini games — decisões e checklist

Ideia do dono do jogo: ao completar o Peitoral (ou ao longo dele), liberar um **outro modo de jogo** com mini games que usam os
personagens, cenários e versículos que o app já tem. Vale também para a próxima campanha.

## Regras que já valem (CLAUDE.md)

- Toda lista tem `Pagination`; nada com a cara do navegador; carregamento com `Spinner`; tokens de tema; mobile primeiro.
- Como no Tabuleiro e no Duelo: o modo **não mexe** no ranking, nas missões nem nas estatísticas das perguntas. Prêmio pequeno e limitado por dia.
- Regra pura do mini game em arquivo sem dependências (testável), como `board/` e `duel/`.

## Como liberar (decidido)

**Uma pedra libera um mini game** (12 pedras = 12 jogos: caça-palavras, forca, quebra-cabeça, memória, versículo em pedaços, quem sou eu?, labirinto,
linha do tempo, palavras cruzadas, mapa, árvore genealógica, interconexão). O **Peitoral Completo** libera o **ranking semanal** dos mini games e a
entrada na **Galeria dos Peitorais**. **Mini games não dão XP.** Sem baú no final.

## Os jogos

| Jogo | Como funciona | O que precisa de dado novo |
|---|---|---|
| Caça-palavras | Grade gerada com nomes de personagens/lugares do tema escolhido; tempo e dicas. | Nada (usa os nomes). |
| Forca | Palavra = personagem, lugar ou livro; dica = descrição da figurinha. | Nada. |
| Quebra-cabeça | Peças da figurinha, do mapa do cenário ou da arte do álbum; 9/16/25 peças. | Nada (a arte já existe). |
| Labirinto | Labirinto gerado; em cada bifurcação uma pergunta decide o caminho certo. | Nada (usa as perguntas). |
| Quem sou eu? | Dicas que aparecem uma a uma; menos dicas = mais pontos. | Dicas por personagem (a descrição serve no começo). |
| Memória | Pares: personagem ↔ feito, lugar ↔ versículo. | Nada. |
| Complete o versículo | Lacunas para preencher com palavras embaralhadas. | Nada (versículos dos cenários e das perguntas). |
| Versículo embaralhado | Ordenar as palavras do versículo. | Nada. |
| Quem disse isso? | Uma frase ou versículo; escolher o personagem. | Fala por personagem. |
| Linha do tempo | Chegam personagens/cenários aleatórios na mão; encaixar na linha; quanto mais perto da posição certa, mais pontos. | Ordem cronológica (campo novo em personagem e cenário). |
| Mapa | Posicionar o cenário num mapa; pontos pela proximidade. | Coordenadas por cenário. |
| Árvore genealógica | Montar a linhagem (Adão → Noé → Abraão → Davi → Jesus). | Pai/mãe por personagem. |
| Interconexão | Ligar duas figurinhas por uma corrente de relações (Isaías profetizou a Ezequias, Ezequias governou Jerusalém, Jesus pregou em Jerusalém); menos elos = mais pontos. | Grafo de relações (tabela nova, o maior trabalho de conteúdo). |
| Palavras cruzadas | Grade gerada com as dicas das figurinhas. | Dica curta por personagem. |
| Pescaria | Arcade: pescar só os peixes certos no mar da Galileia (reflexo). | Nada. |
| Torre de Babel | Arcade de empilhar blocos no tempo certo. | Nada. |

## Ordem sugerida

1. **Base:** hub do modo, liberação, desafio diário (1 por dia), prêmio limitado, ranking semanal só do modo.
2. **Sem conteúdo novo:** caça-palavras, forca, quebra-cabeça, memória, versículo embaralhado/complete o versículo, labirinto com perguntas.
3. **Com campo novo no painel:** linha do tempo (cronologia), mapa (coordenadas), quem sou eu (dicas), árvore genealógica.
4. **Com grafo de relações:** interconexão e palavras cruzadas.

## Recompensas do final do Peitoral (além do que já dá)

Decidido: 2.000 moedas, brasão, moldura, ranking semanal dos mini games e Galeria dos Peitorais (sem baú). Ideias ainda abertas: título "Sumo Sacerdote";
fundo de perfil; Galeria dos Peitorais (quem completou, e quando); baú temático; figurinha lendária do Arão (nunca `SPECIAL`, que é só de Jesus);
liberar o hub de mini games. Evitar bônus permanente de moedas (mexe na economia).

## Checklist

- [x] Base: catálogo e liberação por pedra, ranking semanal (tabela `mini_game_scores`, só quem completou o Peitoral), Galeria dos Peitorais, telas (cartão na aba Jogar,
  Jogos/Ranking/Galeria), capa `MINIGAMES` no painel.
- [x] Prêmio: pontos no ranking semanal e 10 moedas na 1ª vitória do dia em cada jogo (até 3 jogos por dia).
- [x] Jogos sem conteúdo novo: caça-palavras, forca, quebra-cabeça (3 × 3, trocar peças), memória (cenário ↔ referência), versículo em pedaços (ordenar), labirinto (sem perguntas ainda).
- [ ] Versículo: variante com lacunas. Labirinto: perguntas nas bifurcações. Memória: pares personagem ↔ figurinha.
- [ ] Jogos com campo novo no painel: quem sou eu (dicas), linha do tempo (cronologia), mapa (coordenadas), árvore genealógica (pai/mãe).
- [ ] Jogos com grafo de relações: interconexão e palavras cruzadas.
