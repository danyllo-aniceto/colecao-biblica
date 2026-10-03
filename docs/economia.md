# Economia do jogo (moedas, XP e figurinhas)

Revisão de balanceamento. Objetivo: o jogador não ter o álbum e a campanha completos em semanas; o jogo
precisa durar meses, com as figurinhas raras sendo uma meta de longo prazo.

Para conferir o efeito de qualquer ajuste antes de publicar: `npm run simular-economia -w backend`
(modelo simplificado, em `backend/src/scripts/simular-economia.cjs`; atualize o bloco `NOVO` dele).

## O que estava desbalanceado

Na simulação de um jogador **regular** (5 partidas por dia), com um álbum de 88 figurinhas:

| | Antes | Depois |
|---|---|---|
| Álbum em 30 dias | 73% | 34% |
| Álbum em 90 dias | 94% | 73% |
| Álbum em 180 dias | 97% | 91% |
| Nível em 90 dias | 46 | 33 |
| Moedas por dia (média) | ~410 | ~300 |

Causas:

1. **Só 23% das moedas vinham das partidas.** O resto vinha de missões, baús de nível, campanha, prêmio
   diário e passe. Baú e campanha pagam por nível, e o nível subia sem limite: quem jogava mais ganhava
   moedas "de graça" sem teto de tempo.
2. **XP sem freio.** 12 partidas num dia rendiam 12 vezes o XP; o jogador dedicado chegava ao nível 46 em 30 dias.
3. **Preços baixos para a renda.** Figurinha comum custava ~1 dia de renda, rara ~1 dia, épica ~2 dias. O
   pacote surpresa (300) valia em média ~700 moedas em figurinhas: era a melhor compra do jogo.
4. **Sorteio generoso.** 3 prêmios por dia, ~30% deles figurinha, com garantia a cada 6 prêmios.

## O que mudou

| Área | Antes | Depois |
|---|---|---|
| Nível 2 / cada nível seguinte | 200 XP / +50 | 300 XP / +100 (nível 50 = 132.300 XP) |
| Freio diário de XP (novo) | sem freio | 6 partidas com XP cheio; depois 25% |
| Figurinha comum / rara / épica | 200 / 450 / 900 | 450 / 1.100 / 2.800 |
| Pacote surpresa | 300 | 750 (chances 66/27/6,5/0,5 %) |
| Limite de figurinhas compradas por dia | 2 | 1 |
| Ajudas da loja (vida, tempo, 50/50...) | 130–250 | 180–350 (+~30%) |
| Prêmios sorteados por dia | 3 | 2 |
| Garantia de figurinha no sorteio | a cada 6 prêmios | a cada 10 |
| Chance de figurinha no sorteio (comum/rara/épica/lendária) | 20 / 8 / 3 / 1 | 9 / 3,5 / 1,2 / 0,4 |
| Moedas no sorteio | 50 | 40 |
| Partidas por dia que rendem moedas | 6 | 5 |
| Bônus de partida perfeita | 20 | 15 |
| Prêmio do 7º dia seguido | 120 | 100 |
| Baú de nível | 30 + 5/nível, teto 150 | 20 + 3/nível, teto 80 |
| Parada da campanha | 20 + 2/nível | 15 + 1,5/nível (relíquia em dobro) |
| Missões diárias | 25 a 50 | 20 a 40 |
| Missões semanais | 150 / 200 / 150 | 100 / 130 / 100 |
| Venda de repetida (comum/rara/épica/lendária) | 15 / 40 / 90 / 200 | 55 / 135 / 340 / 800 |

A venda de repetidas subiu junto com os preços (~12% do valor de compra) para a repetida continuar valendo a pena.
O estudo de personagem não entra na conta: não rende XP, moedas nem prêmios.

## Maratona e baús da partida

O quiz geral virou uma **maratona**: sem escolher o número de perguntas, a partida vai até as 3 vidas acabarem (teto de
100 perguntas, ou até o banco acabar). O **Treino** mantém o número de perguntas escolhido, mas não rende baú. O estudo
de personagem continua como está.

O prêmio sorteado por partida foi trocado por um **baú da partida**, cujo nível vem dos acertos. Até 5 baús por dia
(configurável); ganha baú quem acerta no mínimo 7.

| Acertos | Baú | Moedas garantidas | O que sai |
|---|---|---|---|
| 7 a 14 | Bronze | 6 | sorteio comum (figurinha é mais rara) |
| 15 a 39 | Prata | 15 | sorteio com um pouco mais de chance de figurinha |
| 40 ou mais | Ouro | 30 | sempre figurinha, com raras e épicas favorecidas |

A garantia de figurinha (a cada 10 baús sem figurinha) continua. Os cortes de prata e ouro, o limite diário e o mínimo
de acertos ficam em Configurações. Como a maratona rende mais acertos por partida, o limite de partidas com moedas por dia
caiu de 5 para 3 e o de XP cheio de 6 para 4.

Figurinhas por dia vindas dos baús (simulação): casual ~0,1, regular ~0,5, dedicado ~1. Somam-se à compra na loja (1 por dia).

## Como o ajuste chega ao jogo

A migração `20261011090000_rebalanceamento_economia` troca os valores só onde ainda estão no padrão antigo
(preços da loja, chances do sorteio, configurações e moedas das paradas). O que o admin já tinha ajustado
fica como está. Tudo continua editável no painel (Configurações e Loja), inclusive o freio diário de XP.

## O que fica de fora de propósito

- **Figurinha lendária na loja:** a regra do jogo diz que ela não é comprável. Chega por sorteio, pacote e fusão.
- **Cosméticos (80 a 900 moedas):** ficam como estão; funcionam como uma segunda forma de gastar moedas.

## Premissas e limites do modelo

- Álbum de 88 figurinhas (40 comuns, 25 raras, 15 épicas, 8 lendárias). Quanto mais personagens o admin cadastrar,
  mais o álbum dura.
- A renda depende do perfil: ~150 moedas por dia (casual, 2 partidas), ~300 (regular, 5) e ~400 (dedicado, 12).
- O jogador do modelo gasta tudo na loja, sempre na figurinha mais rara que consegue pagar: é o pior caso para a duração.
- Vale reavaliar com dados reais depois de 3 a 4 semanas de uso (quanto cada jogador ganha por dia e o que compra).
