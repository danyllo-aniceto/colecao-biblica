# Modo Duelo — jogo de figurinhas com amigos (versão 2: casual, estilo Marvel Snap)

Segundo jogo de **sala** do app, irmão do Tabuleiro: **sem XP, sem moedas, sem baús, sem ranking, sem missões**. É para jogar com
amigos (ou treinar contra bots). Reaproveita quase tudo que o Tabuleiro já construiu (salas, convite, link, bots, relógio
preguiçoso, sons e música por cenário) e as figurinhas, os cenários e o **nível da figurinha** que já existem.

## Decisões confirmadas

0. **Sem Times prontos.** Cada jogador monta o próprio Time de 12 figurinhas (até 5 salvos) com as figurinhas que já conquistou e que têm figurinha no Duelo.
   O rival bot joga com um Time sorteado entre todas as figurinhas disponíveis.
1. **Aberto para todos** (sem trava de nível); o marcador "Arena de Duelos" no mapa da campanha fica como atalho decorativo (a fazer).
2. **Time de 12 figurinhas.**
3. **Imagens dos cenários substituíveis pelo painel**, como as outras: campo *Imagem no Duelo de Figurinhas* em Campanha → cenário
   (`scenarios.duel_image_url`); vazio usa o mapa do cenário.
4. Casual: **sem XP, moedas, figurinhas, ranking nem missões**.

## 1. O que o Marvel Snap tem de bom (pesquisa) e o que levamos

| No Marvel Snap | No Duelo |
|---|---|
| Baralho de **12 figurinhas**, mão inicial de 3, compra 1 por turno; só se vê ~8 das 12 | Igual: **Time de 12**. Poucas figurinhas = cada figurinha importa |
| **6 turnos**, partida de ~5 min | Igual. Cabe numa conversa de WhatsApp |
| **Turnos simultâneos**: todos jogam ao mesmo tempo e viram juntos | Igual. Ninguém espera ninguém; funciona sem tempo real (polling) |
| **Energia** = número do turno (turno 3 = 3 de energia) | **Vigor** (não pode ser "Fôlego": o Tabuleiro já usa essa palavra) |
| **3 locais × 4 espaços**; vence quem ganhar 2 locais | **3 cenários × 4 espaços**, vence quem ganhar 2 |
| Locais aparecem no turno 1, 2 e 3; cada um tem uma regra | Idem, e os cenários são os da campanha (arte, cor e **música** já existem) |
| **Prioridade:** quem está ganhando revela primeiro (empate: maior poder total; depois sorteio) | Igual. A ordem de revelação é a parte mais "esperta" do jogo |
| Quantidade de **Dons** variados: *Ao revelar*, *Contínuo*, *Ao fim do turno*, *Ao ser destruída*, mover, destruir, descartar, criar figurinhas, devolver à mão | Mesmo catálogo, com nomes e histórias bíblicas |
| Figurinhas **vanilla** (sem habilidade) definem o "preço justo"; habilidade custa Influência | Mesma ideia: a **Influência** depende do Vigor, **não da raridade** (ninguém vence só por ter mais lendárias) |
| **Snap** (dobrar a aposta) e **Retirada**: blefe e saída honrosa | **Dobrar** e **Desistir da rodada** (perde só 1) |
| **Modo Batalha com amigos**: código de 5 dígitos, **10 de vida**, a aposta vira dano, **sem recompensa**, para testar baralhos | Igual em espírito: série por **vidas**, sem recompensa nenhuma |
| Críticas: **locais aleatórios demais** decidem o jogo (ex.: "25% de destruir figurinhas") | **Regra de ouro: nenhum cenário nem Dom usa dado.** Só decisão do jogador |
| Lançamento **lento de figurinhas** (para dar tempo de explorar) | Figurinhas entram **em lotes** (campo "disponível no duelo" + publicação agendada que já existem) |

## 2. Vocabulário (nenhum termo pressupõe fé)

**Influência** (força da figurinha) · **Vigor** (energia do turno) · **Dom** (habilidade) · **Cenário** (cada coluna) · **Time** (baralho de 12) ·
**Vida** (da série) · **Pronto** (terminar o turno). Evitar "Fé" e "Fôlego" (já usado no Tabuleiro).

## 3. A partida

1. **Preparação:** cada um tem o Time embaralhado (semente guardada no servidor) e 3 figurinhas na mão. O 1º cenário já aparece.
2. **Turnos 1 a 6:** Vigor = nº do turno. O jogador arrasta figurinhas da mão para um cenário (até 4 por lado) e toca em **Pronto 3/6**
   (30 s, relógio preguiçoso do servidor). Quando os dois terminam, as figurinhas **viram na ordem de prioridade**, cada **Ao revelar** resolve na
   ordem em que as figurinhas foram jogadas, e o turno seguinte começa (+1 figurinha na mão; 2º cenário no turno 2, 3º no turno 3).
3. **Fim:** depois do turno 6 conta-se a Influência de cada cenário. Quem ganhar 2 vence a rodada (empate de cenários: maior Influência total;
   persistindo, empate).
4. **Dobrar (como o Snap):** a qualquer momento, **uma vez por pessoa por rodada**, o jogador dobra a aposta na hora (1 → 2 → 4 → 8). Quem não quer
   arriscar pode **desistir da rodada** e perde só o que estava valendo naquele momento. Não dá para desistir no turno em que você mesmo dobrou.
5. **Série (escolhida na sala):** *Rodada única* · *Melhor de 3* · *Vidas* (10 vidas; a aposta vira dano; a partir da rodada 5 a aposta vale em dobro).
   Padrão: **Melhor de 3** (~15 min).

Interação que dá "mais lances": decidir o que **segurar** para um cenário ainda escondido, o que jogar **antes/depois** da prioridade, mover/destruir
figurinhas do rival, copiar, criar figurinhas, **blefar** com Dobrar.

## 4. Dons (o coração do modo)

Gatilhos: **Ao revelar · Contínuo · Início/Fim do turno · Ao fim do duelo · Ao ser destruída · Ao ser movida · Ao ser descartada**.
Efeitos (vocabulário fixo, ~25, o painel monta sem programar): ±Influência, comprar, descartar, mover, destruir, devolver à mão, criar figurinha,
copiar, trocar de lugar, cancelar Dom, impedir destruição, adiar jogada...

| Figurinha | Vigor/Infl. | Dom |
|---|---|---|
| Davi | 2/2 | *Ao revelar:* se o rival tem aqui figurinha de 6+ de Influência, **+6** (Golias). |
| Sansão | 3/4 | *Ao fim do duelo:* se este cenário estiver perdendo, **destrói todas as figurinhas daqui** (colunas do templo). |
| Moisés | 4/4 | *Ao revelar:* **move as figurinhas rivais deste cenário** para os outros (Mar Vermelho). |
| Josué | 3/3 | *Ao revelar:* **cancela os Dons contínuos** das figurinhas rivais aqui (muros de Jericó). |
| Daniel | 2/2 | *Contínuo:* suas figurinhas **neste cenário** não podem ser destruídas nem reduzidas (cova dos leões). |
| Jonas | 1/1 | *Ao revelar:* some e **volta à mão 3 turnos depois com +3**. |
| Abraão | 4/3 | *Ao revelar:* cria um **Descendente** (0 Vigor, Influência 1) em cada cenário com espaço. |
| Elias | 4/3 | *Ao revelar:* **destrói a figurinha de menor Influência** do rival aqui (fogo do céu). |
| José | 3/3 | *Ao revelar:* veja as 2 próximas figurinhas do Time e **compre uma** (sonhos). |
| Rute | 1/1 | *Contínuo:* **+1** cada vez que outra figurinha sua é jogada neste cenário. |
| Gideão | 2/1 | *Contínuo:* **+1 por cada figurinha de Vigor 1** que você tenha em jogo (300 homens). |
| Salomão | 5/5 | *Ao revelar:* **escolha**: +4 aqui, ou compre 2 figurinhas. |
| Pedro | 3/3 | *Contínuo:* figurinhas suas **ao lado** (cenários vizinhos) ganham +1 (a pedra). |
| Golias | 5/12 | *Ao revelar:* **perde 6** se o rival tiver Davi em jogo (figurinha forte, mas com ponto fraco conhecido). |

**Etiquetas** (sinergia, vêm de *papel na história*, testamento e período, editáveis): Rei, Profeta, Juiz, Apóstolo, Patriarca, Mulher de coragem,
Adversário... "Dom: +1 para cada Rei seu" cria arquétipos de Time.

**Orçamento (como as figurinhas "vanilla" do Snap):** Influência sem Dom ≈ **2 × Vigor** (1→2, 2→4, 3→6, 4→8, 5→10, 6→12). Um Dom bom tira 1 a 3 de
Influência; um Dom fraco, 0 a 1. O painel mostra o "orçamento usado" de cada figurinha e avisa quando foge da faixa.
**Figurinhas de custo 5 e 6** devem ser fortes (aprendizado do Snap), são os "finalizadores".

## 5. Cenários do Duelo

Reaproveitam os 10 cenários da campanha (arte do terreno, cor e música). Nenhum usa sorte. O painel permite criar mais.

Éden: figurinhas de Vigor 1 ganham +2 · Arca: duas figurinhas com a mesma etiqueta lado a lado ganham +1 cada · Canaã: quem tem mais figurinhas aqui ganha +3 ·
Egito: no fim de cada turno a figurinha mais fraca de cada lado perde 1 · Sinai: só 2 espaços por lado · Jericó: figurinhas não podem ser movidas ·
Templo: +1 para cada Rei ou Sacerdote seu · Babilônia: a 1ª figurinha jogada por turno vai para outro cenário (você escolhe qual na revelação) ·
Galileia: no turno 4 todas as figurinhas aqui perdem 1 · Jerusalém: o vencedor do cenário ganha +2 de Influência total ·
Torre de Babel: no fim de cada turno a mais forte de cada lado perde 1 · Betel: no fim de cada turno a mais fraca de cada lado ganha +1 ·
Peniel: quem tem menos figurinhas aqui (ao menos 1) ganha +3 · Sarça ardente em Horebe: figurinha sozinha do lado ganha +3 ·
Tabernáculo: a primeira figurinha de cada lado aqui ganha +2 · Cidade de Davi: Vigor 4 ou mais ganha +2. (Cenários das 12 Pedras: toda pedra nova traz a regra do cenário aqui.)

## 6. Quem joga com quem

- **Sala com amigo (online):** o mesmo fluxo do Tabuleiro: código de 5 letras, convite pela lista de amigos e pela conversa, **link `/sala/CÓDIGO`**
  (quem não tem conta vê o convite e cria a conta). 2 jogadores; os outros que entrarem **assistem** (fase final).
- **Bot:** completa a sala ou treina sozinho. Aprendiz (jogadas legais ao acaso), Estudante (usa o Vigor e disputa o cenário com mais diferença),
  Mestre (simula a jogada no motor puro contra jogadas prováveis do rival; não vê a mão dele).
- **Qual Time:** o do próprio jogador, montado só com as figurinhas que ele tem. Há a opção **usar o nível das figurinhas** (desligada = todas valem como nível 1).
- **Tempo real na Vercel:** sem websocket. O servidor decide tudo (a mão e o Time do rival nunca saem dele), o app consulta com `?since=versão`
  (1,5 s em jogo), e o prazo do turno (30 s) é verificado a cada consulta (relógio preguiçoso). 3 turnos estourados = o bot assume.

## 7. Níveis da figurinha (já existem, só ganham função)

Hoje o nível 1 a 5 sobe com **repetidas da própria figurinha** (1, 2, 3 e 5) e só enfeita. No Duelo (em "Meus times"):
**Nv2 +1 Influência · Nv3 número do Dom +1 · Nv4 +1 Influência · Nv5 número do Dom +1 e moldura dourada.** Teto de +2 de Influência ≈ meio Vigor,
então melhora sem quebrar o equilíbrio, e "equilibrado" ignora tudo. Nada a mudar na economia (as repetidas já têm uso: vender, trocar, fundir).

## 8. Sem recompensa de progresso

Segue o Tabuleiro: **nada de XP, moedas, figurinhas, baús, ranking, missões ou estatística de pergunta**. Único prêmio: um contador de **vitórias online**
(sala com 2+ pessoas, confirmadas pelo servidor; vitória contra bot não conta) que libera **versos de figurinha** (novo cosmético `CARD_BACK`, como o
`PAWN`: editável no painel, na loja, por meta ou prêmio). Isso evita farm entre amigos e qualquer corrida por recompensa.

## 9. Desbloqueio e campanha (decidido: aberto a todos)

O Duelo é **livre desde o primeiro acesso**: não tem nível mínimo nem depende da campanha (igual ao Tabuleiro). O nível só entra na
força das figurinhas quando a sala liga "Usar o nível das figurinhas".

## 10. Telas (referência: print do Marvel Snap, retrato)

- **Topo:** adversário (nome, peão/avatar), **turno atual** no centro; você embaixo.
- **Meio:** 3 colunas de cenário (arte do terreno, nome, regra em ícone). Em cima as 4 figurinhas do rival, embaixo as suas; **Influência total de cada lado** em
  números grandes nas bordas do cenário; o lado que vence brilha.
- **Rodapé:** **sua mão** (3 a 7 figurinhas) em leque, **Vigor** no centro, **Pronto 3/6** à direita, **Desistir** à esquerda, **Dobrar** ao lado.
- **Arrastar** a figurinha para o cenário (com som de papel/arrasto) ou tocar na figurinha e tocar no cenário. **Segurar** a figurinha abre o Dom em texto grande.
- **Avisos animados** de cada Dom (o mesmo sistema de `callouts` do Tabuleiro: "Moisés separou as figurinhas do rival!").
- Sons e **música do cenário da rodada**, `Dialog`/`Modal`/componentes do app, mobile primeiro.

## 11. Técnica

- **Motor puro e testado:** `backend/src/duel/engine.ts` (estado serializável, jogadas, prioridade, Dons) + `scenarios.ts` + `bots.ts` + testes de propriedade
  (milhares de partidas bot×bot sem estado inválido, sem figurinha duplicada, sem vazar mão). A mesma lógica roda no navegador para o modo "treino"
  (como o Tabuleiro local).
- **Banco:** `duel_cards` (personagem: Vigor, Influência, etiquetas, Dom em texto, `available`), `duel_decks`
  (Times salvos do jogador, até 5), `duel_rooms` + `duel_room_players` (mesmo molde de `board_rooms`, estado do motor em JSON, `version`, `dueAt`), nova coluna de
  vitórias em duelo no usuário, tipo de cosmético `CARD_BACK`. Salas apagadas após 24 h, como no Tabuleiro.
- **Aproveitar do Tabuleiro** (extrair para `services/rooms/` em vez de copiar): geração de código, convite/link, lobby, bots por nível, relógio preguiçoso,
  polling com versão, substituição por bot, `callouts`.
- **Painel:** aba **Duelo** no personagem (Vigor, Influência, etiquetas, Dom com prévia do texto e **medidor de orçamento**), importação em lote (CSV, como as
  perguntas), **relatório de equilíbrio** (usos e vitórias por figurinha, só de salas com 2 pessoas).
- **Conteúdo inicial:** eu monto um 1º lote de Dons para os personagens que já existem (~40, os mais conhecidos) a partir do cadastro; você revisa no painel.

## 12. Fases (cada uma jogável e testada, como no Tabuleiro)

Legenda: ✅ feito e testado · ⬜ a fazer.

1. **Motor + figurinhas + bot (treino local)** ✅
   - ✅ Motor puro `backend/src/duel/` (3 cenários × 4 espaços, 6 turnos simultâneos, prioridade de revelação, Dons *Ao revelar / Contínuo / Fim do turno /
     Fim do duelo / Ao ser destruída / Quando uma figurinha sua é jogada aqui*, 12 efeitos, dobrar e desistir, níveis da figurinha, visão sem informação escondida),
     10 cenários, 26 figurinhas de partida e 2 Times prontos, séries (única, melhor de 3, vidas) e 3 bots (Aprendiz, Estudante, Mestre).
     40 testes (inclui 300 duelos só de bots e equilíbrio dos Times prontos).
   - ✅ Tela do treino contra bot na aba Jogar: mesa em retrato, arrastar ou tocar para jogar, avisos dos Dons, dobrar/desistir, resumo da rodada, ajuda.
   - ✅ Imagem do cenário no duelo editável no painel (migração `20261022090000_duelo_cenario_imagem`).
2. **Painel + dados** ✅
   - ✅ Vocabulário ampliado: 19 efeitos (os 12 do começo + devolver, descartar, vigor-extra, custo-menos, converter, sacrificar, multiplicar, mover-se,
     ressuscitar, poder na mão, aura em todos, fichas novas), 10 condições; tudo testado (`dsl.test.ts`, 15 testes).
   - ✅ Dom em texto (`backend/src/duel/dsl.ts`): gatilho + efeitos, com erros em português; mesmo código no servidor (importação) e no painel (prévia).
   - ✅ Tabela `duel_cards` (migração `20261023090000_duelo_cartas`) e API `/api/duel`: figurinhas e Times para o jogo, lista paginada do painel com busca,
     exportação, edição, remoção e **importação por planilha com prévia** (13 testes de integração em `duel.test.ts`).
   - ✅ Painel → *Duelo de Figurinhas*: lista, edição com prévia do texto e aviso de equilíbrio, importar/baixar planilha e guia de poderes
     (formato em `docs/duelo-planilha.md`).
   - ✅ O jogo usa as figurinhas cadastradas no painel.
3. **Online** ✅ (sem assistir): salas de 2 pessoas, ou 1 pessoa + bot, no molde do Tabuleiro.
   - ✅ Migração `20261025090000_duelo_salas_online` (`duel_rooms`, `duel_room_players`, `duel_invites`) e API `/api/duel-room` (criar, entrar por código, sair, regras, Time, bots, iniciar,
     colocar/tirar figurinha, Pronto, Dobrar, Desistir, próxima rodada, revanche, convites) + prévia pública `/api/duel-public/:code`. Serviço `services/duel-room.ts`; 10 testes de integração (`duel-room.test.ts`).
   - ✅ Servidor guarda o motor com as duas mãos e só manda `viewFor` do lado de quem pergunta; consulta com `?since=versão`; colocar figurinha na mesa não sobe a versão (é segredo do dono).
   - ✅ Relógio preguiçoso: prazo do turno (30/45/60 s, só começa depois da repetição do turno anterior); vencido, o servidor diz "Pronto" pela pessoa; 3 faltas passam o lugar a um bot; entre rodadas
     espera os dois tocarem em "Próxima rodada" (ou 60 s). Bots jogam o turno assim que ele começa. Série única, melhor de 3 ou vidas, escolhida na sala.
   - ✅ Telas: sala de espera (código, link `/duelo/CODE`, convite de amigo, chat, Time, regras, bot), mesa online com a repetição passo a passo (mesma do treino), cronômetro, placar da série, resumo da rodada, revanche.
   - ⬜ Assistir (3ª pessoa) fica para depois.
4. **Meus Times e níveis** ✅ (adiantado na rodada de ajustes): montador de Time paginado com busca e filtro de Vigor, até 5 Times salvos no servidor (só
   figurinhas conquistadas e figurinhas disponíveis), nível das figurinhas opcional (migração `20261024090000_duelo_times_do_jogador`; Times prontos removidos).
5. **Polimento** (parcial): ✅ mesa estilo Snap com a arena no meio (arte editável, nome, regra escrita e placar hexagonal dos dois lados), turno repetido passo a passo
   com narração, números que contam, figurinhas que entram/saem animadas, histórico "O que aconteceu" e velocidade normal/rápida. ⬜ sons próprios, música do cenário (já toca a do 1º cenário aberto), versos de figurinha e vitórias online, marcador na campanha, relatório de equilíbrio.
6. **Conteúdo** ⬜: novos lotes de figurinhas e cenários.

## 12b. Rodada de experiência de jogo (regras e telas que mudaram)

- **Jogada às cegas:** dá para colocar figurinha numa arena que ainda não apareceu. Ela entra na revelação do turno, mas o cenário (nome, regra) segue escondido até o turno dele; a figurinha só mostra a Influência própria
  e, ao abrir a arena, a regra passa a valer. Arena fechada confere o espaço só na revelação (a figurinha que não couber volta à mão, sem dizer o nome do cenário).
- **Aposta com efeito de verdade:** *Melhor de 3* agora é em **pontos** (cada rodada vale a aposta: dobrada vale 2 pontos e já decide); *Vidas* continua com a aposta virando dano (dobra a partir da rodada 5);
  na *Rodada única* a aposta não vale nada, então **não dá para dobrar**. Desistir depois que o rival dobrou **neste turno** custa só o que valia antes dele dobrar (`retreatCost`, como no Snap).
- **Mesa:** selo grande "VALE ×N" com o que a aposta vale (pontos ou dano), relógio do turno em anel (sala online), aviso destacado quando o rival dobra, Vigor em destaque.
- **Arrastar:** da mão para a arena (inclusive fechada), de uma arena para outra e de volta à mão (para tirar).
- **Animações do turno:** figurinha empurrada/levada/convertida voa para o novo lugar com uma seta; afastada treme e estoura; devolvida à mão voa até a mão do dono; some sobe e desaparece;
  criada surge com brilho; revelada chega virando; mudança de Influência mostra "+3" ou "−2" subindo (`use-card-motion.tsx`).

## 13. Riscos

- **Tom:** o tema é bíblico. Duelos são provações entre figurinhas: efeitos se chamam *afastar*, *silenciar*, *enviar de volta*, não "matar". Jesus fica fora.
- **Equilíbrio:** com ~25 efeitos combináveis surgem interações inesperadas; por isso motor testado em massa, bots que medem o equilíbrio e relatório de uso.
- **Volume de conteúdo:** 88+ figurinhas com Dom único dá trabalho de design. Mitigação: lotes, o 1º já preenchido por mim, importação em CSV.
- **Escala:** polling a 1,5 s por duelo. Sem problema para dezenas de salas; se crescer, trocar por SSE/Pusher sem mexer no motor.

Fontes da pesquisa: [Marvel Snap (visão geral)](https://en.wikipedia.org/wiki/Marvel_Snap), [prioridade e ordem de revelação](https://marvelsnapzone.com/how-priority-changes-the-value-of-tech-cards-in-marvel-snap/), [empates](https://www.pcgamer.com/marvel-snap-how-ties-work/), [tipos de habilidade](https://marvelsnapzone.com/marvel-snap-abilities-guide/), [Modo Batalha](https://www.digitaltrends.com/gaming/marvel-snap-multiplayer-how-to-play-with-friends/), [Snap e Retirada](https://marvelsnapzone.com/snapping/), [locais](https://www.thegamer.com/marvel-snap-complete-locations-guide/), [filosofia de design](https://www.dexerto.com/gaming/how-are-marvel-snap-cards-designed-ben-brode-breaks-down-dev-process-1983450/).
