# Modo Duelo — proposta de design (rascunho para aprovação)

Modo à parte, inspirado em Marvel Snap: partidas curtas, simultâneas, em que **cada carta traz uma regra própria**.
Jogo online contra um amigo ou contra um bot (os "Guardiões"). Nada aqui foi implementado ainda.

## 1. Vocabulário (nenhum termo pressupõe fé)

| Termo | Papel | Observação |
|---|---|---|
| **Influência** | força da carta no cenário | vale para qualquer personagem, inclusive os que não tinham fé (Faraó, Golias) |
| **Fôlego** | "energia" para jogar cartas | sobe 1 por turno (turno 3 = 3 de Fôlego) |
| **Dom** | habilidade da carta | cada carta tem um, ligado à história dela |
| **Cenário** | cada uma das 3 colunas da mesa | vem da campanha (Éden, Egito, Jericó...) e tem regra própria |
| **Time** | baralho do jogador | 10 figurinhas do álbum |
| **Lamparinas** | limite diário de duelos com recompensa | 5, recupera 1 a cada 3 h |

## 2. Como é uma partida

- **Mesa:** 3 cenários × 3 espaços por lado. Vence o cenário quem tiver mais Influência nele. **Vence o duelo quem ganhar 2 cenários**;
  empate de cenários decide pela Influência total.
- **Mão e turnos:** Time de 10 cartas, mão inicial de 3, compra 1 por turno, **6 turnos**. Cada jogador vê ~8 das 10 cartas.
- **Cada turno (simultâneo):** os dois jogam quantas cartas quiserem dentro do Fôlego, escolhem o cenário de cada uma e tocam em
  **Pronto** (30 s). As cartas viram juntas; quem está **ganhando mais cenários revela primeiro** (a ordem importa nos Dons).
- **Cenários aparecem aos poucos:** o 1º no turno 1, o 2º no turno 2, o 3º no turno 3 (dá para planejar).
- **Lances por partida:** 1 a 3 jogadas por turno, mover/destruir/copiar/comprar cartas por causa dos Dons, e a decisão de **segurar**
  uma carta forte para o cenário certo. Duração: 4 a 6 min.
- **Dobrar a aposta (fase final):** uma vez por duelo, o jogador "sela" a aposta e os troféus em jogo dobram; o rival pode recuar.

## 3. Dons: o coração do modo

Cada Dom tem um **gatilho**: *Ao revelar*, *Contínuo*, *Ao fim do duelo*, *Ao ser destruída*, *Ao ser movida*.
São montados com um vocabulário fixo de ~25 efeitos (+/- Influência, comprar, descartar, mover, destruir, copiar, criar
carta "Descendente", impedir efeito, trocar de cenário...), então o painel configura sem programar.

| Carta | Fôlego/Infl. | Dom |
|---|---|---|
| Davi | 2 / 2 | *Ao revelar:* se o rival tem carta de 6+ de Influência aqui, **+6** (Golias). |
| Sansão | 3 / 4 | *Ao fim do duelo:* se este cenário estiver perdendo, **destrói todas as cartas daqui** (colunas do templo). |
| Moisés | 4 / 4 | *Ao revelar:* **move as cartas rivais deste cenário** para os outros (Mar Vermelho). |
| Josué | 3 / 3 | *Ao revelar:* **cancela os Dons contínuos** das cartas rivais aqui (muros de Jericó). |
| Daniel | 2 / 2 | *Contínuo:* suas cartas **neste cenário** não podem ser destruídas nem reduzidas (cova dos leões). |
| Jonas | 1 / 1 | *Ao revelar:* some e **volta à mão 3 turnos depois com +3**. |
| Abraão | 4 / 3 | *Ao revelar:* cria um **Descendente** (1 Fôlego-zero, Influência 1) em cada cenário com espaço. |
| Elias | 4 / 3 | *Ao revelar:* **destrói a carta de menor Influência** do rival aqui (fogo do céu). |
| José | 3 / 3 | *Ao revelar:* veja as 2 próximas cartas do Time e **compre a que quiser** (interpretar o sonho). |
| Rute | 1 / 1 | *Contínuo:* **+1** cada vez que outra carta sua é jogada neste cenário. |
| Gideão | 2 / 1 | *Contínuo:* **+1 por cada carta de Fôlego 1** que você tenha em jogo (300 homens). |
| Salomão | 5 / 5 | *Ao revelar:* **escolha**: +4 aqui, ou compre 2 cartas. |

**Etiquetas (sinergia entre cartas):** vêm do que o cadastro já tem (*papel na história*, testamento, período) e podem ser editadas:
Rei, Profeta, Juiz, Apóstolo, Patriarca, Mulher de coragem, Adversário... Dons como "+1 para cada Rei seu" criam
**arquétipos de Time** (Reis, Profetas, Patriarcas...).

**Equilíbrio dos números:** como no Snap, a **Influência depende do Fôlego, não da raridade** (carta de 2 Fôlego sem Dom ≈ 4;
com Dom, 2 a 3). A raridade muda a complexidade e a "cara" do Dom (lendárias são finalizadoras de 4 a 6 Fôlego), mas **ninguém
vence só por ter mais lendárias**. Jesus (especial da campanha) fica **fora** do modo.

## 4. Cenários do duelo (reaproveitam a campanha e a música do tema)

Éden: cartas de 1 Fôlego ganham +2 · Arca: cartas em par (mesma etiqueta) ganham +1 · Canaã: quem tem mais cartas aqui ganha +3 ·
Egito: no fim de cada turno a carta mais fraca de cada lado perde 1 · Sinai: só 2 espaços por lado · Jericó: cartas não podem ser
movidas · Templo: +1 para cada carta de Rei/Sacerdote · Babilônia: a 1ª carta jogada por turno vai a outro cenário · Galileia: no
turno 4 todas as cartas aqui perdem 1 · Jerusalém: o vencedor do cenário ganha +2 de Influência total.
Toca a **música do tema** do cenário do turno (já temos o motor de som).

## 5. Contra quem jogar

- **Contra o bot (Guardiões):** instantâneo, gera as recompensas. Cada cenário da campanha tem um Guardião (Faraó, Golias,
  Nabucodonosor...), com Time e jeito de jogar próprios e 3 dificuldades. Também é o tutorial.
- **Contra um amigo, online:** convite pelo chat de amigos (igual às trocas). **Ao vivo** (30 s por turno, auto-fim de turno ao estourar;
  3 estouros seguidos = desistência) ou **no seu tempo** (24 h por turno). **Sem moedas nem troféus**, só diversão, missões e
  conquistas: impede dois amigos de combinar vitórias para farmar. Opção **"Duelo equilibrado"** (padrão): todos os níveis de carta valem como nível 1.
- **Como funciona na Vercel:** sem websocket. O servidor decide tudo (mão, compras e jogadas do rival nunca vão para o outro
  jogador antes de revelar) e o app consulta a cada ~1,5 s. Prazo de turno verificado a cada consulta.

## 6. Níveis de carta (as repetidas ganham função)

Nível 1 a 5. Cada nível pede **repetidas + moedas**; repetidas da própria carta valem 1, repetidas de **qualquer outra carta da mesma
raridade** valem ½ (coringa). Valores iniciais (ajustáveis no painel):

| Raridade | Nv2 | Nv3 | Nv4 | Nv5 | Moedas (Nv2→5) |
|---|---|---|---|---|---|
| Comum | 2 | 4 | 8 | 14 | 50 / 100 / 200 / 400 |
| Rara | 2 | 3 | 5 | 8 | 100 / 200 / 400 / 800 |
| Épica | 1 | 2 | 3 | 5 | 200 / 400 / 800 / 1600 |
| Lendária | 1 | 1 | 2 | 3 | 400 / 800 / 1600 / 3200 |

Bônus: **Nv2 +1 Influência · Nv3 Dom +1 (número do efeito) · Nv4 +1 Influência · Nv5 Dom +1 e moldura dourada.** Teto de +2 de
Influência: menos que uma carta de 1 Fôlego, então melhora sem quebrar o equilíbrio. Vender repetidas por moedas continua
valendo; reforçar é a alternativa. (Pressão de moedas: totalmente reforçar uma carta custa muito, é um objetivo de longo prazo.)

## 7. Recompensas e economia (nada de ganhar tudo cedo)

Ficam num **sistema próprio** com tetos diários, para não esvaziar o quiz e a campanha.

- **Lamparinas:** 5, +1 a cada 3 h. Só duelo contra bot gasta e recompensa.
- **Primeira vitória sobre cada Guardião (uma vez):** item visual exclusivo da arena e/ou figurinha. É o prêmio "grande".
- **Vitória repetida:** ~8 moedas + 1 *pergaminho* (moeda do modo), teto de 5 vitórias/dia (≈40 moedas, cerca de 15% do que o jogador já ganha por dia).
- **XP da conta:** pequeno e limitado, ~30 XP/dia (≈13% de uma boa partida de quiz). Duelo não substitui o quiz para subir de nível.
- **Troféus e liga:** vitórias nas dificuldades maiores e na liga semanal de duelos (mesmo molde da liga que já existe).
- **Pergaminhos** compram só **cosméticos de duelo** (versos de carta, molduras de arena, títulos, frases de reação). Nunca força.
- **Missões e conquistas** do app ganham objetivos de duelo, dentro dos mesmos tetos.

## 8. Desbloqueio e campanha

- O modo abre no **nível 10** (fim do cenário 2). Antes disso, aparece trancado na tela de jogar ("Nível 10").
- No **mapa da campanha** entra um marcador especial **"Arena de Duelos"** na parada do nível 10 (bloqueado até lá) e, depois, uma **parada
  de Guardião** no fim de cada cenário. As posições usam o editor de posições que já existe no painel.
- Quem chega ao 10 com menos de 10 figurinhas joga o tutorial com um **Time emprestado**.

## 9. O que muda no código

- **Regras puras testadas:** `services/duel-engine.ts` (estado, jogadas, ordem de revelação, Dons) e `duel-rules.ts` (custos, níveis, tetos), com testes pesados: a graça do modo está na combinação de Dons.
- **Banco:** `CardDuelStats` (Fôlego, Influência, etiquetas, Dom em JSON), `UserCardLevel`, `Duel` (jogadores, modo, estado, turno, prazo, semente), `DuelMove` (histórico para repetição e estatística).
- **API:** criar/entrar/jogar/Pronto/desistir/consultar duelo; bots rodam no servidor ao fechar o turno.
- **Painel:** aba *Duelo* no cadastro do personagem (Fôlego, Influência, etiquetas, Dom com prévia do texto), cadastro de Guardiões, e **relatório de equilíbrio** (taxa de vitória e de uso por carta).
- **App:** montagem do Time, mesa com arrastar carta para o cenário (com os sons), tela de reforço de cartas, convites no chat.
- **Fases:** 1) motor + dados + bot e tutorial; 2) mesa no app, campanha, desbloqueio e recompensas; 3) duelo com amigo; 4) níveis de carta; 5) liga, aposta dobrada e eventos.

## 10. Riscos

- **Tom:** o tema é bíblico. Os duelos são provações entre cartas, sem "matar" personagens (usar "afastar", "silenciar", "enviar de volta"). Jesus fora.
- **Equilíbrio:** com ~25 efeitos há interações imprevistas. Por isso o relatório de equilíbrio e a possibilidade de ajustar Dons sem publicar versão.
- **Escala:** o app consulta a cada 1,5 s durante duelo ao vivo. Baixo risco para dezenas de duelos simultâneos; revisar se crescer.
