# Modo Duelo — jogo de cartas com amigos (versão 2: casual, estilo Marvel Snap)

Segundo jogo de **sala** do app, irmão do Tabuleiro: **sem XP, sem moedas, sem baús, sem ranking, sem missões**. É para jogar com
amigos (ou treinar contra bots). Reaproveita quase tudo que o Tabuleiro já construiu (salas, convite, link, bots, relógio
preguiçoso, sons e música por cenário) e as figurinhas, os cenários e o **nível da figurinha** que já existem.

Nada aqui foi implementado ainda. Este documento é a proposta para aprovação.

## 1. O que o Marvel Snap tem de bom (pesquisa) e o que levamos

| No Marvel Snap | No Duelo |
|---|---|
| Baralho de **12 cartas**, mão inicial de 3, compra 1 por turno; só se vê ~8 das 12 | Igual: **Time de 12**. Poucas cartas = cada carta importa |
| **6 turnos**, partida de ~5 min | Igual. Cabe numa conversa de WhatsApp |
| **Turnos simultâneos**: todos jogam ao mesmo tempo e viram juntos | Igual. Ninguém espera ninguém; funciona sem tempo real (polling) |
| **Energia** = número do turno (turno 3 = 3 de energia) | **Vigor** (não pode ser "Fôlego": o Tabuleiro já usa essa palavra) |
| **3 locais × 4 espaços**; vence quem ganhar 2 locais | **3 cenários × 4 espaços**, vence quem ganhar 2 |
| Locais aparecem no turno 1, 2 e 3; cada um tem uma regra | Idem, e os cenários são os da campanha (arte, cor e **música** já existem) |
| **Prioridade:** quem está ganhando revela primeiro (empate: maior poder total; depois sorteio) | Igual. A ordem de revelação é a parte mais "esperta" do jogo |
| Quantidade de **Dons** variados: *Ao revelar*, *Contínuo*, *Ao fim do turno*, *Ao ser destruída*, mover, destruir, descartar, criar cartas, devolver à mão | Mesmo catálogo, com nomes e histórias bíblicas |
| Cartas **vanilla** (sem habilidade) definem o "preço justo"; habilidade custa Influência | Mesma ideia: a **Influência** depende do Vigor, **não da raridade** (ninguém vence só por ter mais lendárias) |
| **Snap** (dobrar a aposta) e **Retirada**: blefe e saída honrosa | **Dobrar** e **Desistir da rodada** (perde só 1) |
| **Modo Batalha com amigos**: código de 5 dígitos, **10 de vida**, a aposta vira dano, **sem recompensa**, para testar baralhos | Igual em espírito: série por **vidas**, sem recompensa nenhuma |
| Críticas: **locais aleatórios demais** decidem o jogo (ex.: "25% de destruir cartas") | **Regra de ouro: nenhum cenário nem Dom usa dado.** Só decisão do jogador |
| Lançamento **lento de cartas** (para dar tempo de explorar) | Cartas entram **em lotes** (campo "disponível no duelo" + publicação agendada que já existem) |

## 2. Vocabulário (nenhum termo pressupõe fé)

**Influência** (força da carta) · **Vigor** (energia do turno) · **Dom** (habilidade) · **Cenário** (cada coluna) · **Time** (baralho de 12) ·
**Vida** (da série) · **Pronto** (terminar o turno). Evitar "Fé" e "Fôlego" (já usado no Tabuleiro).

## 3. A partida

1. **Preparação:** cada um tem o Time embaralhado (semente guardada no servidor) e 3 cartas na mão. O 1º cenário já aparece.
2. **Turnos 1 a 6:** Vigor = nº do turno. O jogador arrasta cartas da mão para um cenário (até 4 por lado) e toca em **Pronto 3/6**
   (30 s, relógio preguiçoso do servidor). Quando os dois terminam, as cartas **viram na ordem de prioridade**, cada **Ao revelar** resolve na
   ordem em que as cartas foram jogadas, e o turno seguinte começa (+1 carta na mão; 2º cenário no turno 2, 3º no turno 3).
3. **Fim:** depois do turno 6 conta-se a Influência de cada cenário. Quem ganhar 2 vence a rodada (empate de cenários: maior Influência total;
   persistindo, empate).
4. **Dobrar:** a qualquer momento, **uma vez por pessoa por rodada**, o jogador "dobra a aposta" (1 → 2 → 4 → 8). O rival aceita ou **desiste da
   rodada** (perde o valor anterior). Quem desistiu não vê o fim. Não pode desistir no mesmo turno em que dobrou.
5. **Série (escolhida na sala):** *Rodada única* · *Melhor de 3* · *Vidas* (10 vidas; a aposta vira dano; a partir da rodada 5 a aposta vale em dobro).
   Padrão: **Melhor de 3** (~15 min).

Interação que dá "mais lances": decidir o que **segurar** para um cenário ainda escondido, o que jogar **antes/depois** da prioridade, mover/destruir
cartas do rival, copiar, criar cartas, **blefar** com Dobrar.

## 4. Dons (o coração do modo)

Gatilhos: **Ao revelar · Contínuo · Início/Fim do turno · Ao fim do duelo · Ao ser destruída · Ao ser movida · Ao ser descartada**.
Efeitos (vocabulário fixo, ~25, o painel monta sem programar): ±Influência, comprar, descartar, mover, destruir, devolver à mão, criar carta,
copiar, trocar de lugar, cancelar Dom, impedir destruição, adiar jogada...

| Carta | Vigor/Infl. | Dom |
|---|---|---|
| Davi | 2/2 | *Ao revelar:* se o rival tem aqui carta de 6+ de Influência, **+6** (Golias). |
| Sansão | 3/4 | *Ao fim do duelo:* se este cenário estiver perdendo, **destrói todas as cartas daqui** (colunas do templo). |
| Moisés | 4/4 | *Ao revelar:* **move as cartas rivais deste cenário** para os outros (Mar Vermelho). |
| Josué | 3/3 | *Ao revelar:* **cancela os Dons contínuos** das cartas rivais aqui (muros de Jericó). |
| Daniel | 2/2 | *Contínuo:* suas cartas **neste cenário** não podem ser destruídas nem reduzidas (cova dos leões). |
| Jonas | 1/1 | *Ao revelar:* some e **volta à mão 3 turnos depois com +3**. |
| Abraão | 4/3 | *Ao revelar:* cria um **Descendente** (0 Vigor, Influência 1) em cada cenário com espaço. |
| Elias | 4/3 | *Ao revelar:* **destrói a carta de menor Influência** do rival aqui (fogo do céu). |
| José | 3/3 | *Ao revelar:* veja as 2 próximas cartas do Time e **compre uma** (sonhos). |
| Rute | 1/1 | *Contínuo:* **+1** cada vez que outra carta sua é jogada neste cenário. |
| Gideão | 2/1 | *Contínuo:* **+1 por cada carta de Vigor 1** que você tenha em jogo (300 homens). |
| Salomão | 5/5 | *Ao revelar:* **escolha**: +4 aqui, ou compre 2 cartas. |
| Pedro | 3/3 | *Contínuo:* cartas suas **ao lado** (cenários vizinhos) ganham +1 (a pedra). |
| Golias | 5/9 | *Ao revelar:* **+2 para cada carta sua** neste cenário... *e perde o Dom se Davi estiver na mesa.* |

**Etiquetas** (sinergia, vêm de *papel na história*, testamento e período, editáveis): Rei, Profeta, Juiz, Apóstolo, Patriarca, Mulher de coragem,
Adversário... "Dom: +1 para cada Rei seu" cria arquétipos de Time.

**Orçamento (como as cartas "vanilla" do Snap):** Influência sem Dom ≈ **2 × Vigor** (1→2, 2→4, 3→6, 4→8, 5→10, 6→12). Um Dom bom tira 1 a 3 de
Influência; um Dom fraco, 0 a 1. O painel mostra o "orçamento usado" de cada carta e avisa quando foge da faixa.
**Cartas de custo 5 e 6** devem ser fortes (aprendizado do Snap), são os "finalizadores".

## 5. Cenários do Duelo

Reaproveitam os 10 cenários da campanha (arte do terreno, cor e música). Nenhum usa sorte. O painel permite criar mais.

Éden: cartas de Vigor 1 ganham +2 · Arca: duas cartas com a mesma etiqueta lado a lado ganham +1 cada · Canaã: quem tem mais cartas aqui ganha +3 ·
Egito: no fim de cada turno a carta mais fraca de cada lado perde 1 · Sinai: só 2 espaços por lado · Jericó: cartas não podem ser movidas ·
Templo: +1 para cada Rei ou Sacerdote seu · Babilônia: a 1ª carta jogada por turno vai para outro cenário (você escolhe qual na revelação) ·
Galileia: no turno 4 todas as cartas aqui perdem 1 · Jerusalém: o vencedor do cenário ganha +2 de Influência total.

## 6. Quem joga com quem

- **Sala com amigo (online):** o mesmo fluxo do Tabuleiro: código de 5 letras, convite pela lista de amigos e pela conversa, **link `/sala/CÓDIGO`**
  (quem não tem conta vê o convite e cria a conta). 2 jogadores; os outros que entrarem **assistem** (fase final).
- **Bot:** completa a sala ou treina sozinho. Aprendiz (jogadas legais ao acaso), Estudante (usa o Vigor e disputa o cenário com mais diferença),
  Mestre (simula a jogada no motor puro contra jogadas prováveis do rival; não vê a mão dele).
- **Qual Time:** escolha por sala. **Times prontos** (padrão: 12 cartas temáticas iguais para todos, ex.: *Reis de Israel*, *Profetas*,
  *Patriarcas*, *Mulheres de coragem*), **Meus times** com os níveis das figurinhas valendo, ou **Meus times equilibrado** (níveis ignorados).
  Assim quem tem poucas figurinhas também joga, e ninguém é "forçado" a ter coleção grande.
- **Tempo real na Vercel:** sem websocket. O servidor decide tudo (a mão e o Time do rival nunca saem dele), o app consulta com `?since=versão`
  (1,5 s em jogo), e o prazo do turno (30 s) é verificado a cada consulta (relógio preguiçoso). 3 turnos estourados = o bot assume.

## 7. Níveis da figurinha (já existem, só ganham função)

Hoje o nível 1 a 5 sobe com **repetidas da própria carta** (1, 2, 3 e 5) e só enfeita. No Duelo (em "Meus times"):
**Nv2 +1 Influência · Nv3 número do Dom +1 · Nv4 +1 Influência · Nv5 número do Dom +1 e moldura dourada.** Teto de +2 de Influência ≈ meio Vigor,
então melhora sem quebrar o equilíbrio, e "equilibrado" ignora tudo. Nada a mudar na economia (as repetidas já têm uso: vender, trocar, fundir).

## 8. Sem recompensa de progresso

Segue o Tabuleiro: **nada de XP, moedas, figurinhas, baús, ranking, missões ou estatística de pergunta**. Único prêmio: um contador de **vitórias online**
(sala com 2+ pessoas, confirmadas pelo servidor; vitória contra bot não conta) que libera **versos de carta** (novo cosmético `CARD_BACK`, como o
`PAWN`: editável no painel, na loja, por meta ou prêmio). Isso evita farm entre amigos e qualquer corrida por recompensa.

## 9. Desbloqueio e campanha (decisão a confirmar)

Você tinha pedido que o modo abrisse num nível e aparecesse no mapa. Mantive: **abre no nível 10** (fim do 2º cenário), com um marcador
**"Arena de Duelos"** trancado no mapa da campanha e, depois, aberto. Como o modo é casual, também dá para deixá-lo aberto a todos como o Tabuleiro
(com "Times prontos" ninguém precisa de coleção). Recomendo: **aberto a todos** com o marcador no mapa só como atalho decorativo, ou
trancado no nível 10 se quiser que seja um prêmio da campanha. Sua escolha.

## 10. Telas (referência: print do Marvel Snap, retrato)

- **Topo:** adversário (nome, peão/avatar), **turno atual** no centro; você embaixo.
- **Meio:** 3 colunas de cenário (arte do terreno, nome, regra em ícone). Em cima as 4 cartas do rival, embaixo as suas; **Influência total de cada lado** em
  números grandes nas bordas do cenário; o lado que vence brilha.
- **Rodapé:** **sua mão** (3 a 7 cartas) em leque, **Vigor** no centro, **Pronto 3/6** à direita, **Desistir** à esquerda, **Dobrar** ao lado.
- **Arrastar** a carta para o cenário (com som de papel/arrasto) ou tocar na carta e tocar no cenário. **Segurar** a carta abre o Dom em texto grande.
- **Avisos animados** de cada Dom (o mesmo sistema de `callouts` do Tabuleiro: "Moisés separou as cartas do rival!").
- Sons e **música do cenário da rodada**, `Dialog`/`Modal`/componentes do app, mobile primeiro.

## 11. Técnica

- **Motor puro e testado:** `backend/src/duel/engine.ts` (estado serializável, jogadas, prioridade, Dons) + `scenarios.ts` + `bots.ts` + testes de propriedade
  (milhares de partidas bot×bot sem estado inválido, sem carta duplicada, sem vazar mão). A mesma lógica roda no navegador para o modo "treino"
  (como o Tabuleiro local).
- **Banco:** `duel_card_stats` (personagem: Vigor, Influência, etiquetas, Dom em JSON, `disponivel`), `duel_ready_decks` (Times prontos), `duel_decks`
  (Times salvos do jogador, até 5), `duel_rooms` + `duel_room_players` (mesmo molde de `board_rooms`, estado do motor em JSON, `version`, `dueAt`), nova coluna de
  vitórias em duelo no usuário, tipo de cosmético `CARD_BACK`. Salas apagadas após 24 h, como no Tabuleiro.
- **Aproveitar do Tabuleiro** (extrair para `services/rooms/` em vez de copiar): geração de código, convite/link, lobby, bots por nível, relógio preguiçoso,
  polling com versão, substituição por bot, `callouts`.
- **Painel:** aba **Duelo** no personagem (Vigor, Influência, etiquetas, Dom com prévia do texto e **medidor de orçamento**), importação em lote (CSV, como as
  perguntas), cadastro de Times prontos e de cenários de duelo, **relatório de equilíbrio** (usos, vitórias por carta e por Time, só de salas com 2 pessoas).
- **Conteúdo inicial:** eu monto um 1º lote de Dons para os personagens que já existem (~40, os mais conhecidos) a partir do cadastro; você revisa no painel.

## 12. Fases (cada uma jogável e testada, como no Tabuleiro)

1. **Motor + cartas + bot (local/treino):** regras, 10 cenários, ~12 Dons, vs bot no navegador, sem servidor. Tela da mesa com arrastar.
2. **Painel + dados:** aba Duelo, Times prontos, importação, primeiro lote de cartas.
3. **Online:** salas, convite, link, relógio, assistir, série por vidas, Dobrar/Desistir.
4. **Meus times e níveis:** montador de Time (paginado), Times salvos, níveis valendo, modo equilibrado.
5. **Polimento:** sons, música, avisos, versos de carta, vitórias online, marcador na campanha, relatório de equilíbrio.
6. **Conteúdo:** novos lotes de cartas e cenários.

## 13. Riscos

- **Tom:** o tema é bíblico. Duelos são provações entre cartas: efeitos se chamam *afastar*, *silenciar*, *enviar de volta*, não "matar". Jesus fica fora.
- **Equilíbrio:** com ~25 efeitos combináveis surgem interações inesperadas; por isso Times prontos, motor testado em massa e relatório de uso.
- **Volume de conteúdo:** 88+ cartas com Dom único dá trabalho de design. Mitigação: lotes, o 1º já preenchido por mim, importação em CSV.
- **Escala:** polling a 1,5 s por duelo. Sem problema para dezenas de salas; se crescer, trocar por SSE/Pusher sem mexer no motor.

Fontes da pesquisa: [Marvel Snap (visão geral)](https://en.wikipedia.org/wiki/Marvel_Snap), [prioridade e ordem de revelação](https://marvelsnapzone.com/how-priority-changes-the-value-of-tech-cards-in-marvel-snap/), [empates](https://www.pcgamer.com/marvel-snap-how-ties-work/), [tipos de habilidade](https://marvelsnapzone.com/marvel-snap-abilities-guide/), [Modo Batalha](https://www.digitaltrends.com/gaming/marvel-snap-multiplayer-how-to-play-with-friends/), [Snap e Retirada](https://marvelsnapzone.com/snapping/), [locais](https://www.thegamer.com/marvel-snap-complete-locations-guide/), [filosofia de design](https://www.dexerto.com/gaming/how-are-marvel-snap-cards-designed-ben-brode-breaks-down-dev-process-1983450/).
