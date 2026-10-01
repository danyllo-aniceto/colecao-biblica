# Levantamento e melhorias — outubro/2026

Auditoria do painel admin e da lógica do jogo, com o que foi corrigido/implementado nesta rodada e
o que fica como próximos passos.

## 1. Upload de imagens: por que não funcionava

Eram vários problemas somados (qualquer um deles basta para falhar):

| Problema | Efeito | Correção |
| --- | --- | --- |
| O modo de upload era decidido **no build** (`BLOB_READ_WRITE_TOKEN` presente na hora do build). Conectar o Blob depois exigia um novo deploy. | Sem redeploy, o app continuava no modo "salvar no banco". | O servidor decide na hora (`GET /api/uploads/config`). |
| No modo "banco", a imagem ia inteira em base64 dentro do JSON. Foto de celular (3–6 MB) vira 4–8 MB em base64. | A Vercel recusa corpo acima de **4,5 MB** (erro 413 sem JSON → mensagem genérica). | A imagem é **reduzida no navegador** (WebP, até 1200/1600 px, ~100–300 KB) antes de enviar. |
| O código só enviava com `access: 'public'`. Hoje a Vercel cria **stores privados** (o modo não muda depois de criado). | Store privado recusa upload público; e URL privada não abre numa `<img>`. | Tenta público e, se o store for privado, envia como privado e serve a imagem por `/api/uploads/file/...`. `BLOB_ACCESS` força o modo, se quiser. |
| Ao clicar em **Connect** no painel da Vercel, o store pode ser ligado por **OIDC** (`BLOB_STORE_ID`), sem `BLOB_READ_WRITE_TOKEN`. | O backend respondia "upload não configurado". | Aceita token **ou** OIDC. |
| O `onUploadCompleted` do upload direto calculava a URL de retorno a partir da rota do Express (`/`), mandando o aviso da Vercel para a página inicial. | Avisos perdidos e tentativas repetidas. | O upload agora passa pelo servidor (sem callback). |
| Tipo do arquivo conferido só pela extensão. | Arquivo qualquer renomeado passava. | Tipo conferido pelos bytes (PNG, JPG, WEBP, GIF, AVIF). |

Testes: `backend/src/services/uploads.test.ts` (store público, privado, OIDC, erro) e o teste de
integração do upload em `api.test.ts`. No navegador, uma foto de 10 MB foi reduzida e salva.

## 2. Campos do cadastro de personagem: o que funcionava e o que não

| Campo | Antes | Agora |
| --- | --- | --- |
| Imagem | Não dava para **remover** a imagem ao editar (vazio era ignorado). Upload falhava (item 1). | Arrastar e soltar, escolher, colar link, trocar e remover. |
| **Todos** os opcionais | Apagar o conteúdo ao editar **não salvava** (o backend ignorava vazio/nulo). | `null`/vazio limpa o campo. |
| Resumo curto | Editor rico vazio salvava `<p></p>` e passava como preenchido. Sem limite. | Obrigatório de verdade, contador de 280 caracteres, aparece também para quem ainda não tem a figurinha. |
| História completa | Mesmo problema do vazio. | Validado; aceita imagens. |
| Papel narrativo | Editor rico com imagens para algo que é uma frase curta. | Texto curto (aparece abaixo do nome). Conteúdo antigo é convertido para texto. |
| Período histórico | Editor rico livre: impossível filtrar. | Lista padronizada (12 períodos, na ordem da Bíblia) + "Outro". Permite filtrar e ordenar o álbum pela história. |
| Livros bíblicos | Lista de 66 checkboxes; o filtro do álbum usava "contém" ("João" pegava "1 João"). | Botões por testamento com busca, salvos na ordem canônica; filtro exato. |
| Versículos / palavras-chave | Texto separado por vírgula. | Etiquetas (Enter para adicionar), com sugestões. |
| Genealogia / linha do tempo | Funcionavam; o "modelo pronto" apagava o que existia sem perguntar; prévia redesenhava a cada tecla. | Confirma antes de substituir, prévia só quando para de digitar, ícone de carregamento. |
| Novos | — | **Testamento**, **Publicado/Rascunho** (rascunho não aparece no álbum), checklist de qualidade, prévia da figurinha ao vivo, perguntas do personagem no próprio editor, aviso de alterações não salvas. |
| Rascunhos do editor | Ao cancelar uma edição, o texto não salvo reaparecia na próxima vez. | Editor sempre abre com o que está salvo. |

## 3. Painel admin: o que mudou

- **Visão geral** com números reais (jogadores, ativos na semana, partidas, figurinhas entregues) e
  **pendências** clicáveis (sem imagem, sem perguntas, rascunhos, perguntas inativas).
- **Personagens**: lista paginada no servidor com miniatura, raridade, contagem de perguntas, status e
  filtros (busca, raridade, status, pendência); publicar/despublicar com um toque.
- **Perguntas**: paginação no servidor, filtros (texto, dificuldade, personagem, status), marcar a correta
  tocando na letra, dificuldade ajusta o tempo, **explicação** e **referência bíblica** (mostradas ao
  jogador depois de responder), duplicar, ativar/desativar; alternativas repetidas são recusadas; agora
  dá para tirar o personagem de uma pergunta (antes não era possível voltar a "geral").
- **Recompensas**: chance real em %, criar/excluir recompensas próprias (as do sistema continuam
  protegidas). Corrigido: o campo "multiplicador de XP" da recompensa **não tinha efeito** (o valor vem de
  Configurações) — saiu do formulário; "tempo concedido" era na verdade quantidade de bônus.
- **Loja**: criar itens (promoções, combos) e excluí-los. Corrigido: item desativado **sumia do painel e
  não dava para reativar**; e todo deploy desativava itens que não fossem os fixos.
- **Usuários**: busca por nome/e-mail, filtro por papel, nível/pontos/saldo à vista e **ajuste de saldo**
  (dar/tirar moedas e bônus para suporte e eventos).
- **Configurações** agrupadas (Partida, Economia, Prêmio diário, Bônus, Pacote surpresa) com explicação
  em cada campo.
- A tela atual fica na URL (`?tela=...`): recarregar não perde a tela e dá para mandar link direto.

## 4. Economia: como estava e o que a pesquisa mostrou

**Antes**, as moedas só vinham de um sorteio no fim do quiz geral (exige 7 acertos, 4 prêmios/dia, e
"Moedas" tinha ~19% de chance). Na prática ~40 moedas por dia, enquanto a figurinha mais barata custava
120. A loja ficava quase inalcançável e partidas sem prêmio não rendiam nada.

**Referências** (jogos e estudos parecidos):

- *Trivia Crack/Perguntados*: moedas a cada partida vencida; ajudas como **bomba (elimina 2 erradas)**,
  tempo extra e segunda chance. [triviabliss](https://triviabliss.com/everything-about-power-ups-in-trivia-crack/), [AppleVis](https://www.applevis.com/guides/trivia-crack-cards-gems-complete-tutorial)
- *Duolingo*: **sequência diária** é a maior alavanca de retenção (quem chega a 7 dias tem 3,6× mais
  chance de continuar); o "protetor de sequência" reduziu abandono em 21%; ligas semanais.
  [StriveCloud](https://www.strivecloud.io/blog/gamification-examples-boost-user-retention-duolingo)
- Boas práticas de economia de jogos: prêmio diário crescente em ciclo de 7 dias, **repetidas viram
  recurso**, garantia contra azar (*pity*), toda interação deve fazer o jogador avançar e **as chances
  devem ser publicadas**. [DEV](https://dev.to/hiroshi_takamura_c851fe71/how-to-build-a-reward-economy-for-a-mobile-game-2e3f), [Heroic Labs](https://heroiclabs.com/docs/hiro/guides/gameplay-mechanics/gacha/index.html)

**Implementado** (todos os valores ajustáveis em Configurações):

| Mecânica | Padrão |
| --- | --- |
| Moedas por acerto em toda partida | 2 por acerto (estudo de personagem: 35%) |
| Bônus de partida perfeita (5+ perguntas) | +15 |
| Limite diário de partidas que rendem moedas | 10 (evita repetir o mesmo quiz só para ganhar) |
| Figurinha repetida vira moedas | 15 / 40 / 90 / 200 por raridade |
| Prêmio diário em ciclo de 7 dias | 20, 30, 40… 70 e 120 + dica 50/50 no 7º dia; pular um dia recomeça |
| **Dica 50/50** (novo bônus) | Elimina 2 erradas, uma por partida; loja 140, sorteio, prêmio diário |
| **Pacote surpresa** | Raridade sorteada (60/28/10/2%), pode ser lendária; chances mostradas na loja; 200 moedas |
| **Conquistas** (12) | Pagam moedas uma vez: primeira partida, 10/50 partidas, gabarito, 5 estudos, nível 5/10, 10 figurinhas, lendária, álbum completo, 7 dias seguidos, 5 anotações |

Com isso, um jogador que joga ~3 partidas por dia e resgata o prêmio diário junta algo como 80–120
moedas/dia: uma figurinha comum a cada 1–2 dias e um pacote surpresa por semana guardando. Os preços da
loja continuam os mesmos e o admin pode ajustá-los.

**Também no jogo:**

- Depois de cada resposta aparece o **gabarito com explicação e referência** (aprender é o objetivo do
  app). O cronômetro da próxima pergunta só começa quando o jogador toca em "Próxima" (antes o tempo
  da próxima já corria durante a resposta).
- Abandonar a partida pede confirmação.
- Estudo de personagem lista quem tem perguntas e bloqueia quem não tem (antes dava erro ao começar).
- Ranking paginado com a sua posição sempre visível (antes só os 50 primeiros, e quem estava fora não
  via a própria posição).
- Histórico de partidas paginado e conquistas no perfil; álbum com paginação e filtros por testamento e
  período, e ordem "da história bíblica".

## 5. Segunda rodada: as 10 ideias (implementadas)

| # | Ideia | Como ficou |
| --- | --- | --- |
| 1 | **Protetor de sequência** | Item da loja (250 moedas) e prêmio do sorteio. Se o jogador esquece dias, um protetor por dia é gasto sozinho no próximo resgate e a sequência continua. Máximo guardado em Configurações. |
| 2 | **Missões diárias e semanais** | 3 diárias sorteadas por jogador (mudam todo dia) entre 7 tipos (partidas, acertos, estudo, desafio do dia, partida perfeita, anotação, figurinha nova) e 3 semanais. Progresso calculado das partidas; resgate único por período. Card na tela inicial. |
| 3 | **Garantia contra azar** | Depois de N prêmios seguidos sem figurinha (padrão 5), o próximo sorteio só tem figurinhas. O resultado da partida mostra quantos faltam. |
| 4 | **Liga semanal** | Aba no Ranking: soma dos pontos da semana (segunda a domingo, fuso do Brasil). Top 3 resgata 500/300/150 moedas na semana seguinte. Ranking geral continua na outra aba. |
| 5 | **Importação em lote + reportes** | Admin importa CSV (modelo para baixar, colunas em português, prévia com erro por linha, até 500 por vez). Jogador reporta pergunta no gabarito; admin tem a tela **Reportes** (contador no menu) para editar, desativar, resolver ou descartar. |
| 6 | **Estatística por pergunta** | Cada resposta conta acerto/erro. A lista mostra a taxa de acerto e, com 20+ respostas, a dificuldade sugerida; filtro "Dificuldade a revisar" e botão para aplicar as sugestões. |
| 7 | **Desafio do dia** | Mesmas perguntas para todos (sorteio fixo por dia), uma tentativa (abandonar conta), ranking do dia por acertos e tempo. Card na tela Jogar. |
| 8 | **Fusão de repetidas** | Repetidas agora ficam guardadas (selo "x2" no álbum). O jogador vende pelo valor da raridade ou funde 3 da mesma raridade em uma da raridade acima, de preferência inédita. A **troca entre amigos** ficou de fora: depende de um sistema de amigos que o app ainda não tem. |
| 9 | **Recorte da imagem** | Ao escolher a imagem da figurinha abre o enquadramento na moldura 3:4 (arrastar e zoom); sai em 900×1200. GIF vai direto para não perder a animação; dá para pular o recorte. |
| 10 | **Publicação agendada** | No editor, "Agendar lançamento" com calendário próprio. Até a data o personagem não aparece para os jogadores; o álbum mostra a faixa "Em breve" (só raridade e data, sem revelar quem é). Filtro "Só agendados" no painel. |

Mudança de comportamento: antes a figurinha repetida virava moedas na hora; agora ela é guardada e
o jogador escolhe vender (mesmo valor de antes) ou fundir.

## 6. Ideias para depois

1. Sistema de amigos (convidar, ver o álbum do amigo, **trocar repetidas**).
2. Notificações do PWA (lembrete do prêmio diário e da liga acabando).
3. Eventos temáticos com figurinhas por tempo limitado (Páscoa, Natal).
4. Modo duelo: dois jogadores com as mesmas perguntas, ao vivo ou assíncrono.
5. Trilhas de estudo (ex.: "Vida de Davi") liberando figurinhas em sequência.
