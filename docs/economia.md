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
| Limite de figurinhas e pacotes comprados por dia | 2 | 1 |
| Limite de baús comprados por dia (`shop.chestLimitPerDay`, painel → Configurações) | — | 3 |
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
(configurável); ganha baú quem acerta no mínimo 7. Cada baú traz **vários prêmios**: moedas, ajudas e, por chance,
figurinha (no ouro e no diamante ela é garantida).

| Acertos | Baú | Moedas | Ajudas | Figurinha | Extras |
|---|---|---|---|---|---|
| 7 a 14 | Bronze | 10 | 1 | 45% de chance | |
| 15 a 39 | Prata | 25 | 2 | 65% de chance, raras e épicas favorecidas | 12% de item visual (comum ou raro) |
| 40 a 69 | Ouro | 50 | 2 | garantida (10% de uma segunda), mais raras | 22% de item visual (até épico, lendário raro) |
| 70 ou mais | Diamante | 100 | 3 | garantida épica (75%) ou lendária (25%) (20% de uma segunda) | 35% de item visual (raro, épico ou lendário) |

O diamante é só para quem acerta muito (por volta de 90% de acerto chega a 70 em cerca de 1 partida a cada 40) e tem
limite de 1 por dia, dentro dos 5 baús; acima disso vira ouro. A garantia de figurinha (a cada 10 baús sem figurinha)
continua. Ajuda que o jogador já tem no limite vira moedas. A figurinha do baú tem 75% de chance de ser uma que ainda
não se tem; no resto pode vir repetida (as repetidas têm uso: vender, trocar, fundir e subir de nível).

O conteúdo de cada baú fica em `CHEST_SPECS` (`game-rules.ts`) e o **Simulador de baús** do painel abre milhares de baús
com os dados reais e mostra o que cada um entrega, além de uma tabela de ganho por dia conforme a taxa de acerto.

Os cortes de acertos, o limite diário e o mínimo ficam em Configurações. Como a maratona rende mais acertos por partida,
o limite de partidas com moedas por dia caiu de 5 para 3 e o de XP cheio de 6 para 4.

Figurinhas por dia vindas dos baús (simulação): casual ~0,4, regular ~1,4 e dedicado ~2,9. Somam-se à compra na loja
(1 por dia) e às repetidas, que alimentam o nível das figurinhas.

### Itens visuais nos baús

Do baú de prata para cima também podem vir itens visuais (os marcados como "entra em baús" na tela Visual do painel e
que o jogador ainda não tem). A raridade do item sorteado respeita o nível do baú: prata traz comum (60%), rara (35%) e
épica (5%); ouro traz comum, rara, épica e, raramente, lendária; diamante só rara, épica e lendária. O bronze não traz item
visual. Se o jogador já tem todos os itens de uma raridade, ela sai do sorteio.

### Baús na loja

A loja vende baús de bronze (600), prata (1.100) e ouro (2.000), que abrem na hora com a mesma animação. O de diamante
nunca é vendido. Baús, pacotes e figurinhas dividem o limite diário de compras (1 por dia). A loja tem três abas:
Figurinhas (baús, pacote e figurinha por raridade), Poderes e Cosméticos.

### Baú de Esmeralda (figurinha especial)

Quando o jogador junta todos os fragmentos e conquista a figurinha especial na campanha, abre sozinho o **Baú de Esmeralda**
(uma única vez). Ele traz 1.000 moedas, 4 ajudas, uma figurinha épica e uma lendária (de preferência novas), o conjunto de
itens visuais exclusivo (ícone "Pastor das ovelhas", moldura "Luz esmeralda", título "Ovelha do Bom Pastor", cor do nome
"Verde celestial" e reação "Luz da manhã") e, por último, a própria figurinha especial. Não é vendido nem sai em partida.

### Visual dos baús e fundo do quiz

No painel, o Simulador de baús permite subir a arte, o nome e a cor de cada baú (vale no resultado da partida, na loja e
na abertura). Em Campanha, cada cenário pode ter uma imagem de fundo para a tela do quiz, com prévia ao vivo.

## Repetidas: vender a amigos e nível da figurinha

Uma repetida pode virar moedas (vender ao jogo), ir para um amigo, subir o nível da figurinha ou ser fundida.

- **Venda a amigos:** preço padrão por raridade (comum 225, rara 550, épica 1.400, lendária 4.000). O comprador paga o
  preço cheio e o vendedor recebe 90%: a taxa de 10% some do jogo. Só repetidas; a figurinha especial não se vende.
  Segue os limites e a expiração das trocas.
- **Nível da figurinha:** de 1 a 5, gastando repetidas da própria figurinha (nível 2: 1, nível 3: 2, nível 4: 3 e
  nível 5: 5 repetidas). Por enquanto só enfeita (selo "Nv" na carta e na ficha); vai valer no futuro modo de cartas.

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

---

# Reavaliação: curva por cenário, 12 Pedras e moedas da campanha (rascunho)

O que mudou desde a revisão acima: o custo de XP passou a ser **por cenário** (500 no Éden, +120 por cenário, teto 3.000), as
paradas pagam **XP ÷ 10 moedas** (relíquia em dobro), entraram o **baú de nível por nível mais barato**, a **pedra do Peitoral**
(500 moedas a cada 3 cenários, a 12ª +2.000) e a campanha cresce até **46 cenários e 194 níveis** (36 cenários × 4 paradas depois de Jesus).

Simulador atualizado: `npm run simular-economia -w backend -- hoje` (13 cenários, 62 níveis) ou `-- futuro` (campanha completa).
Variáveis para testar ajustes sem editar o arquivo: `XP_STEP`, `XP_CAP`, `COIN_DIV` (divisor das moedas da parada) e `DAYS`.
Modelo: 3 perfis (casual 2 partidas/dia, regular 5, dedicado 12), álbum de 88 figurinhas; os números são medianas de 100 simulações.

## O que a simulação mostra (curva atual: 500, +120, teto 3.000; moedas = XP ÷ 10)

| | Casual | Regular | Dedicado |
|---|---|---|---|
| Fim dos 10 cenários de lançamento (nível 50, Jesus) | ~270 dias | **~75 dias** | ~32 dias |
| Fim do conteúdo de hoje (nível 62) | ~380 dias | **~105 dias** | ~45 dias |
| Campanha completa (nível 194) | nunca em 4 anos | **~630 dias (21 meses)** | ~265 dias (9 meses) |
| Renda de moedas por dia (dia 90) | 178 (era 150) | **517 (era 420)** | 1.054 (era 818) |
| Parte da renda vinda da campanha (60 dias) | 14% (era 5%) | **19% (era 6%)** | 22% (era 6%) |
| Álbum completo (mediana) | +1 ano | ~210 dias (era ~204) | ~99 dias (era ~94) |

Antes = curva por nível, sem moedas por XP (coluna "ECONOMIA NOVA" do simulador: `npm run simular-economia -w backend -- novo`).

## Achados

1. **A campanha virou fonte relevante de moedas** (de ~6% para ~19% da renda do jogador regular). Isso é esperado (as paradas agora
   pagam por esforço), mas empurra a renda ~25% acima do que a revisão anterior calibrou. O álbum, porém, quase não encurtou
   (mediana ~210 dias), porque a velocidade dele vem sobretudo dos baús da partida e das repetidas.
2. **O início ficou bem mais rápido, e o fim muito longo.** O jogador regular chega a Jesus em ~2,5 meses (antes ~6), mas leva 21 meses
   para os 194 níveis; o casual não termina. O dedicado esgota o conteúdo de hoje em 6 semanas: a tela "novos cenários em breve" vai
   aparecer para ele cedo, então o ritmo de lançamento de **um trio a cada ~5 semanas** precisa ser mantido.
3. **Cada nível dá um baú de nível** (20 + 3/nível, teto 80 moedas, mais ajuda e chance de item visual). Com níveis mais baratos o
   jogador regular acumula **129 a 158 níveis em 1 ano** (antes ~70): são o dobro de baús de nível, e o conjunto de itens visuais
   "que saem no baú" e as ajudas se esgotam mais cedo. Vale decidir se o baú de nível continua **por nível** ou passa a ser **a cada
   N níveis / por cenário concluído**.
4. **Níveis depois do último cenário continuam rendendo baú** (sem parada, só o baú de nível). Não quebra nada, mas o dedicado
   chega ao nível ~250 no ano sem conteúdo novo; o aviso "em breve" cobre isso.
5. **Moedas da pedra (500) e do Peitoral Completo (2.000)** somam só ~2% da renda; estão baixas para uma conquista de 1 ano e meio
   (2.000 = ~4 dias de renda de um jogador regular). Podem subir sem risco.

## Sensibilidade: o que cada ajuste faz (campanha completa, jogador regular)

| Ajuste | Dias até o nível 194 | Dias até o nível 62 | Renda dia 90 |
|---|---|---|---|
| Atual: +120, teto 3.000, XP ÷ 10 | 631 (21 meses) | 104 | 517 |
| +100, teto 2.400 | **524 (17 meses)** | 95 | ~517 |
| +80, teto 2.000 | 443 (14,5 meses) | 85 | ~517 |
| Atual, mas moedas XP ÷ 15 | 631 | 104 | 485 |
| Atual, mas moedas XP ÷ 20 | 631 | 106 | 466 |

## Proposta (ainda não aplicada)

- **Curva:** `+100` por cenário com **teto 2.400**: regular termina em ~17 meses, dedicado em ~7, casual segue longo (ele não precisa
  terminar; o objetivo é ver cenários novos a cada poucas semanas).
- **Moedas da parada:** manter XP ÷ 10 até o Éden-Jerusalém (começo generoso) e usar **XP ÷ 15** nos cenários novos? Ou, mais simples,
  **XP ÷ 12** em todos. Efeito na renda do regular: de 517 para ~490.
- **Baú de nível:** a cada **2 níveis** (ou ao concluir cada cenário), dobrando as moedas, para o número de baús ficar perto do que
  era antes da refatoração.
- **Pedra e Peitoral:** 500 → **800** por pedra e 2.000 → **5.000** no Peitoral Completo.

## Perguntas em aberto (precisam de você)

1. **Meta de duração** da campanha completa para o jogador regular: ~14, ~17 ou ~21 meses?
2. **Tamanho real do álbum** hoje (o modelo usa 88 figurinhas). Quanto maior, mais o álbum dura e menos o dinheiro extra da campanha pesa.
3. **Baú de nível:** manter por nível, a cada 2 níveis ou por cenário?
4. Prefere que a campanha dê **mais moedas no começo** (cenários de lançamento) ou a mesma proporção em todos?
