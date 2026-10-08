# Mini games — proposta (ainda não implementado)

Ideia do dono do jogo: ao completar o Peitoral (ou ao longo dele), liberar um **outro modo de jogo** com mini games que usam os
personagens, cenários e versículos que o app já tem. Vale também para a próxima campanha.

## Regras que já valem (CLAUDE.md)

- Toda lista tem `Pagination`; nada com a cara do navegador; carregamento com `Spinner`; tokens de tema; mobile primeiro.
- Como no Tabuleiro e no Duelo: o modo **não mexe** no ranking, nas missões nem nas estatísticas das perguntas. Prêmio pequeno e limitado por dia.
- Regra pura do mini game em arquivo sem dependências (testável), como `board/` e `duel/`.

## Como liberar

Proposta: **uma pedra libera um mini game** (12 pedras = 12 jogos) e o **Peitoral Completo** libera o hub completo com o desafio diário
e o ranking semanal. Assim o modo aparece cedo (a campanha dura 12–14 meses) e o final continua valendo. Alternativa: tudo só no final.

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

Já dá: 2.000 moedas, brasão e moldura de prestígio. Ideias a escolher: título "Sumo Sacerdote"; peão, reação e arena exclusivos;
fundo de perfil; Galeria dos Peitorais (quem completou, e quando); baú temático; figurinha lendária do Arão (nunca `SPECIAL`, que é só de Jesus);
liberar o hub de mini games. Evitar bônus permanente de moedas (mexe na economia).
