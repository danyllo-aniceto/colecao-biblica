# Passes temáticos — cadastro, formatos e prompts de arte

Este guia cobre **6 passes temáticos** prontos para cadastrar: nomes, cores, textos, itens visuais, degraus e **os prompts para gerar cada imagem**. Duas planilhas já estão prontas em `docs/passes/` para você importar no painel e não digitar nada.

## 1. Ordem de cadastro (5 passos)

1. **Itens visuais (planilha):** painel → **Visual** → **Importar itens** → escolha `docs/passes/itens-visuais-passes.csv`. Cria os 48 itens (8 por passe): as 12 reações já ficam prontas (usam emoji, sem imagem), as cores do nome, os títulos, os fundos de perfil e as capas já funcionam só com a **cor**; as **molduras** entram só com a cor (a imagem é opcional) e os **ícones entram desativados** até você enviar a imagem.
2. **Criar os passes:** painel → **Passe e eventos** → **Novo passe**, um por passe, com os dados da seção 4 (nome, descrição, cor, mês fixado). Suba o **banner** de cada um aqui.
3. **Enviar as imagens dos itens:** painel → **Visual** → editar cada item e enviar a imagem (ícone, moldura, fundo de perfil, capa). Ícones: depois de enviar, **ative** o item.
4. **Degraus (planilha):** painel → **Passe e eventos** → em *Degraus do passe* → **Importar planilha** → `docs/passes/degraus-passes.csv`. A coluna *Passe* manda cada degrau para o passe certo (por isso o nome do passe precisa ser igual ao cadastrado no passo 2). Faça o passo 4 **depois** do 1 e do 2: os degraus procuram os itens e os passes pelo nome.
5. **Conferir:** o painel mostra o **calendário dos próximos 12 meses** (qual passe vale em cada mês). Abra o app com uma conta de teste e veja o cartão do passe na tela inicial.

> **Dica:** só deixe um passe valendo (ativo / fixado) quando as imagens dele já estiverem enviadas. Passe **sem mês fixado** entra no rodízio assim que estiver ativo.

## 2. Formatos exatos das imagens

| Imagem | Onde aparece | Tamanho | Arquivo | Observações |
|---|---|---|---|---|
| **Banner do passe** | Fundo do cartão do passe (tela inicial), bem suave | **1600 × 600 px** (8:3) | PNG ou WebP, até ~400 KB | O lado **esquerdo** fica coberto por uma película clara/escura (texto por cima): deixe-o calmo e sem detalhes. Detalhes e brilho no lado **direito**. Sem texto. |
| **Ícone de perfil** | Avatar redondo (perfil, ranking, chat) | **512 × 512 px** (1:1) | PNG, até ~200 KB | Recortado em **círculo**: emblema inteiro dentro de ~70% do centro. Fundo de cor sólida (com degradê sutil). Sem texto, sem transparência. |
| **Moldura** | Anel ao redor do ícone de perfil | **512 × 512 px** (1:1) | **PNG com transparência**, até ~200 KB | O miolo (círculo central de ~78% do diâmetro) **100% transparente** para o ícone aparecer. A decoração fica só no anel externo (~11% da borda). **Nada fora do círculo** (os cantos são cortados). |
| **Fundo de perfil** | Fundo do cartão do perfil (seu perfil e o que os outros veem) | **1600 × 800 px** (2:1) | PNG ou WebP, até ~500 KB | Cobre o cartão (recorta nas bordas conforme a tela). Esquerda mais calma/escura (onde ficam o ícone e o nome), detalhes à direita. Importante só no centro (zona segura de ~60% × 60%). Sem texto. |
| **Capa do álbum** | Folha de abertura do álbum (a "capa" do livro) | **1200 × 1800 px** (2:3, vertical) | PNG ou WebP, até ~700 KB | **Terço inferior escuro e calmo**: o app escreve ali "Meu álbum" e o progresso. Arte principal no centro/alto. Sem texto. A **cor** do item também tinge a lombada/borda do livro. |
| **Reação (opcional)** | Chat entre amigos (96 px na tela) | **256 × 256 px** | PNG/WebP com transparência ou GIF animado (até ~2 MB) | As planilhas já usam **emoji**; só gere imagens se quiser trocar o emoji por arte própria (a animação de entrada é escolhida no painel). |

O painel reduz sozinho imagens grandes (para WebP). GIF animado vai como está.

## 3. Estilo base (cole no começo de TODO prompt)

> **Estilo base (não mude):**
> Ilustração 2D de jogo mobile casual, estilo cartoon semiplano (semi-flat) com contornos suaves e arredondados, cores saturadas porém harmônicas, sombras suaves em camadas, textura de papel muito leve, iluminação quente vinda do canto superior esquerdo, formas simples e legíveis, acabamento limpo e profissional. Sem texto, sem letras, sem números, sem marca d'água, sem logotipos. Se houver pessoas, apenas silhuetas pequenas e sem rosto. Nenhum rosto detalhado, nenhuma imagem realista de Jesus. Tom respeitoso, acolhedor e adequado a todas as idades.

**Para manter a consistência:** gere primeiro o **fundo de perfil** de um passe, aprove e anexe como *referência de estilo* nos prompts das outras 3 imagens do mesmo passe (banner, capa, ícone, moldura): "mantenha exatamente o mesmo estilo, traço, paleta e acabamento da imagem de referência". Se a IA não respeitar o tamanho exato, gere maior na mesma proporção e redimensione/corte depois.

## 4. Os passes

### 4.1 Noite de Belém

| Campo do painel | Valor |
|---|---|
| **Nome** | Noite de Belém |
| **Descrição** | O anúncio do nascimento de Jesus: estrela, pastores e canto dos anjos. |
| **Cor do tema** | `#1b2a5c` |
| **Fixar num mês** | `2026-12` — dezembro de 2026 (Natal) |
| **Paleta da arte** | azul-noite profundo, dourado quente, branco-estrela e toques de verde-pinho |
| **Cores de apoio** | dourado/acento `#f2c94c`, claro `#fff6d6` |

**Itens visuais** (já na planilha; todos *só como prêmio*):

| Tipo | Nome | Raridade | Como fica |
|---|---|---|---|
| Reação | Estrela de Belém ⭐ | Comum | emoji, animação Girar, pacote «Noite de Belém» |
| Cor do nome | Dourado de Belém | Rara | `#f2c94c` |
| Ícone | Manjedoura | Rara | **enviar imagem 512×512** e ativar |
| Reação | Glória nas alturas 👼 | Rara | emoji, animação Subir, pacote «Noite de Belém» |
| Moldura | Moldura Estrela de Belém | Épica | cor `#f2c94c` + imagem opcional (512×512 transparente) |
| Título | Pastor de Belém | Épica | `#f2c94c`, efeito Cintilar |
| Fundo de perfil | Noite em Belém | Épica | cor `#1b2a5c` + **imagem 1600×800** |
| Capa do álbum | Capa Noite de Belém | Lendária | cor `#1b2a5c` + **imagem 1200×1800** |

**Prompts** (cada um começa com o *estilo base* da seção 3):

**Banner do passe — 1600×600 (8:3):**
```
[ESTILO BASE] Banner horizontal 8:3 (1600x600) do passe bíblico "Noite de Belém": a noite em Belém: um céu azul-noite cheio de estrelas, uma estrela dourada muito brilhante no alto, colinas suaves com pastores e ovelhas em silhueta e um estábulo simples iluminado por uma luz dourada. Composição panorâmica: o lado esquerdo é calmo, suave e com poucos detalhes (será coberto por uma película), e o brilho e os detalhes principais ficam no lado direito. Paleta: azul-noite profundo, dourado quente, branco-estrela e toques de verde-pinho. Atmosfera suave e acolhedora, sem texto, sem números, sem personagens com rosto.
```
**Ícone de perfil — 512×512 (1:1):** *item «Manjedoura»*
```
[ESTILO BASE] Ícone quadrado 1:1 (512x512): uma manjedoura de madeira com palha dourada e uma estrela brilhante acima, contorno grosso e arredondado, volume suave e brilho leve. O emblema fica centralizado e ocupa cerca de 70% da área (será recortado em círculo). Fundo de cor sólida azul-noite #1b2a5c com degradê muito sutil. Sem texto, sem moldura, sem transparência.
```
**Moldura — 512×512 PNG transparente:** *item «Moldura Estrela de Belém»*
```
[ESTILO BASE] Moldura circular 1:1 (512x512) com FUNDO TRANSPARENTE para avatar de jogo: um anel decorativo fino formado por uma coroa de ramos de pinheiro com pequenas estrelas douradas e fitinhas vermelhas, e uma estrela maior no topo. O círculo central (78% do diâmetro) é totalmente transparente e vazio; toda a decoração fica só na faixa externa do anel, dentro de um círculo perfeito que toca as bordas da imagem, e nada passa para fora desse círculo. Cores: azul-noite profundo, dourado quente, branco-estrela e toques de verde-pinho. Sem texto, sem fundo, sem sombra projetada fora do anel.
```
**Fundo de perfil — 1600×800 (2:1):** *item «Noite em Belém»*
```
[ESTILO BASE] Imagem horizontal 2:1 (1600x800) para fundo de cartão de perfil: a noite em Belém: um céu azul-noite cheio de estrelas, uma estrela dourada muito brilhante no alto, colinas suaves com pastores e ovelhas em silhueta e um estábulo simples iluminado por uma luz dourada. Composição aberta: o lado esquerdo é mais escuro, calmo e com poucos detalhes (ali ficam o ícone e o nome do jogador), e a cena mais rica e luminosa fica à direita e no centro. Paleta: azul-noite profundo, dourado quente, branco-estrela e toques de verde-pinho. Sem texto, sem números, sem personagens com rosto.
```
**Capa do álbum — 1200×1800 (2:3 vertical):** *item «Capa Noite de Belém»*
```
[ESTILO BASE] Capa vertical 2:3 (1200x1800) de um álbum de figurinhas bíblicas, tema "Noite de Belém": a noite em Belém: um céu azul-noite cheio de estrelas, uma estrela dourada muito brilhante no alto, colinas suaves com pastores e ovelhas em silhueta e um estábulo simples iluminado por uma luz dourada, arte emoldurada por uma borda fina e elegante. A cena principal ocupa o centro e a metade de cima; o terço inferior é mais escuro, calmo e quase sem detalhes (um texto será escrito ali pelo app). Textura sutil de couro/papel, acabamento premium. Paleta: azul-noite profundo, dourado quente, branco-estrela e toques de verde-pinho. Sem texto, sem números, sem personagens com rosto.
```
**Reações em imagem (opcional)** — 256×256, fundo transparente:
```
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma estrela dourada de cinco pontas com brilho suave, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: um anjinho simples com asas e auréola dourada, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
```

### 4.2 Aleluia, Ele Vive!

| Campo do painel | Valor |
|---|---|
| **Nome** | Aleluia, Ele Vive! |
| **Descrição** | A manhã da ressurreição: a tumba vazia, a luz da alvorada e a alegria dos discípulos. |
| **Cor do tema** | `#8e6bd1` |
| **Fixar num mês** | `2027-03` — março de 2027 (Páscoa) |
| **Paleta da arte** | violeta suave, dourado de alvorada, branco-pérola e rosa-aurora |
| **Cores de apoio** | dourado/acento `#f4b942`, claro `#f7f3e8` |

**Itens visuais** (já na planilha; todos *só como prêmio*):

| Tipo | Nome | Raridade | Como fica |
|---|---|---|---|
| Reação | Tumba vazia 🪨 | Comum | emoji, animação Pulo, pacote «Aleluia, Ele Vive!» |
| Cor do nome | Alvorada | Rara | `#f4b942` |
| Ícone | Cruz da Alvorada | Rara | **enviar imagem 512×512** e ativar |
| Reação | Aleluia 🕊️ | Rara | emoji, animação Subir, pacote «Aleluia, Ele Vive!» |
| Moldura | Moldura Luz da Ressurreição | Épica | cor `#f4b942` + imagem opcional (512×512 transparente) |
| Título | Testemunha da Alvorada | Épica | `#f4b942`, efeito Cintilar |
| Fundo de perfil | Manhã da Ressurreição | Épica | cor `#8e6bd1` + **imagem 1600×800** |
| Capa do álbum | Capa da Ressurreição | Lendária | cor `#8e6bd1` + **imagem 1200×1800** |

**Prompts** (cada um começa com o *estilo base* da seção 3):

**Banner do passe — 1600×600 (8:3):**
```
[ESTILO BASE] Banner horizontal 8:3 (1600x600) do passe bíblico "Aleluia, Ele Vive!": a manhã da ressurreição: um jardim ao amanhecer, uma tumba de pedra aberta com a grande pedra rolada ao lado, raios dourados de sol nascente atrás das colinas e lírios brancos no primeiro plano. Composição panorâmica: o lado esquerdo é calmo, suave e com poucos detalhes (será coberto por uma película), e o brilho e os detalhes principais ficam no lado direito. Paleta: violeta suave, dourado de alvorada, branco-pérola e rosa-aurora. Atmosfera suave e acolhedora, sem texto, sem números, sem personagens com rosto.
```
**Ícone de perfil — 512×512 (1:1):** *item «Cruz da Alvorada»*
```
[ESTILO BASE] Ícone quadrado 1:1 (512x512): uma cruz simples de madeira clara com raios dourados de sol nascente atrás, contorno grosso e arredondado, volume suave e brilho leve. O emblema fica centralizado e ocupa cerca de 70% da área (será recortado em círculo). Fundo de cor sólida violeta #8e6bd1 com degradê muito sutil. Sem texto, sem moldura, sem transparência.
```
**Moldura — 512×512 PNG transparente:** *item «Moldura Luz da Ressurreição»*
```
[ESTILO BASE] Moldura circular 1:1 (512x512) com FUNDO TRANSPARENTE para avatar de jogo: um anel decorativo fino formado por raios de luz dourada e pequenos lírios brancos ao redor do anel, com um brilho suave de alvorada. O círculo central (78% do diâmetro) é totalmente transparente e vazio; toda a decoração fica só na faixa externa do anel, dentro de um círculo perfeito que toca as bordas da imagem, e nada passa para fora desse círculo. Cores: violeta suave, dourado de alvorada, branco-pérola e rosa-aurora. Sem texto, sem fundo, sem sombra projetada fora do anel.
```
**Fundo de perfil — 1600×800 (2:1):** *item «Manhã da Ressurreição»*
```
[ESTILO BASE] Imagem horizontal 2:1 (1600x800) para fundo de cartão de perfil: a manhã da ressurreição: um jardim ao amanhecer, uma tumba de pedra aberta com a grande pedra rolada ao lado, raios dourados de sol nascente atrás das colinas e lírios brancos no primeiro plano. Composição aberta: o lado esquerdo é mais escuro, calmo e com poucos detalhes (ali ficam o ícone e o nome do jogador), e a cena mais rica e luminosa fica à direita e no centro. Paleta: violeta suave, dourado de alvorada, branco-pérola e rosa-aurora. Sem texto, sem números, sem personagens com rosto.
```
**Capa do álbum — 1200×1800 (2:3 vertical):** *item «Capa da Ressurreição»*
```
[ESTILO BASE] Capa vertical 2:3 (1200x1800) de um álbum de figurinhas bíblicas, tema "Aleluia, Ele Vive!": a manhã da ressurreição: um jardim ao amanhecer, uma tumba de pedra aberta com a grande pedra rolada ao lado, raios dourados de sol nascente atrás das colinas e lírios brancos no primeiro plano, arte emoldurada por uma borda fina e elegante. A cena principal ocupa o centro e a metade de cima; o terço inferior é mais escuro, calmo e quase sem detalhes (um texto será escrito ali pelo app). Textura sutil de couro/papel, acabamento premium. Paleta: violeta suave, dourado de alvorada, branco-pérola e rosa-aurora. Sem texto, sem números, sem personagens com rosto.
```
**Reações em imagem (opcional)** — 256×256, fundo transparente:
```
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma pedra redonda rolada ao lado de uma entrada de tumba, com brilho dourado saindo de dentro, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma pomba branca de asas abertas com raios dourados, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
```

### 4.3 Fogo do Espírito

| Campo do painel | Valor |
|---|---|
| **Nome** | Fogo do Espírito |
| **Descrição** | O dia em que o Espírito Santo desceu: línguas de fogo, vento forte e coragem para falar. |
| **Cor do tema** | `#e4572e` |
| **Fixar num mês** | `2027-05` — maio de 2027 (Pentecostes) |
| **Paleta da arte** | vermelho-fogo, laranja-brasa, dourado e creme, com fundo escuro quente |
| **Cores de apoio** | dourado/acento `#f2994a`, claro `#ffe3b3` |

**Itens visuais** (já na planilha; todos *só como prêmio*):

| Tipo | Nome | Raridade | Como fica |
|---|---|---|---|
| Reação | Línguas de fogo 🔥 | Comum | emoji, animação Pulsar, pacote «Fogo do Espírito» |
| Cor do nome | Vermelho Pentecostes | Rara | `#e4572e` |
| Ícone | Chama do Espírito | Rara | **enviar imagem 512×512** e ativar |
| Reação | Vento do Espírito 🌬️ | Rara | emoji, animação Girar, pacote «Fogo do Espírito» |
| Moldura | Moldura Línguas de Fogo | Épica | cor `#f2994a` + imagem opcional (512×512 transparente) |
| Título | Cheio do Espírito | Épica | `#f2994a`, efeito Pulsar |
| Fundo de perfil | Cenáculo em Chamas | Épica | cor `#e4572e` + **imagem 1600×800** |
| Capa do álbum | Capa Pentecostes | Lendária | cor `#e4572e` + **imagem 1200×1800** |

**Prompts** (cada um começa com o *estilo base* da seção 3):

**Banner do passe — 1600×600 (8:3):**
```
[ESTILO BASE] Banner horizontal 8:3 (1600x600) do passe bíblico "Fogo do Espírito": o cenáculo em Pentecostes: uma sala de pedra com janelas arqueadas, pequenas chamas douradas flutuando no ar acima de silhuetas sem rosto e um vento em redemoinho laranja atravessando o ambiente. Composição panorâmica: o lado esquerdo é calmo, suave e com poucos detalhes (será coberto por uma película), e o brilho e os detalhes principais ficam no lado direito. Paleta: vermelho-fogo, laranja-brasa, dourado e creme, com fundo escuro quente. Atmosfera suave e acolhedora, sem texto, sem números, sem personagens com rosto.
```
**Ícone de perfil — 512×512 (1:1):** *item «Chama do Espírito»*
```
[ESTILO BASE] Ícone quadrado 1:1 (512x512): uma chama estilizada com três línguas de fogo e uma pomba branca pequena no centro, contorno grosso e arredondado, volume suave e brilho leve. O emblema fica centralizado e ocupa cerca de 70% da área (será recortado em círculo). Fundo de cor sólida vermelho-fogo #e4572e com degradê muito sutil. Sem texto, sem moldura, sem transparência.
```
**Moldura — 512×512 PNG transparente:** *item «Moldura Línguas de Fogo»*
```
[ESTILO BASE] Moldura circular 1:1 (512x512) com FUNDO TRANSPARENTE para avatar de jogo: um anel decorativo fino formado por línguas de fogo estilizadas (vermelho, laranja e dourado) subindo ao redor do anel, com faíscas pequenas. O círculo central (78% do diâmetro) é totalmente transparente e vazio; toda a decoração fica só na faixa externa do anel, dentro de um círculo perfeito que toca as bordas da imagem, e nada passa para fora desse círculo. Cores: vermelho-fogo, laranja-brasa, dourado e creme, com fundo escuro quente. Sem texto, sem fundo, sem sombra projetada fora do anel.
```
**Fundo de perfil — 1600×800 (2:1):** *item «Cenáculo em Chamas»*
```
[ESTILO BASE] Imagem horizontal 2:1 (1600x800) para fundo de cartão de perfil: o cenáculo em Pentecostes: uma sala de pedra com janelas arqueadas, pequenas chamas douradas flutuando no ar acima de silhuetas sem rosto e um vento em redemoinho laranja atravessando o ambiente. Composição aberta: o lado esquerdo é mais escuro, calmo e com poucos detalhes (ali ficam o ícone e o nome do jogador), e a cena mais rica e luminosa fica à direita e no centro. Paleta: vermelho-fogo, laranja-brasa, dourado e creme, com fundo escuro quente. Sem texto, sem números, sem personagens com rosto.
```
**Capa do álbum — 1200×1800 (2:3 vertical):** *item «Capa Pentecostes»*
```
[ESTILO BASE] Capa vertical 2:3 (1200x1800) de um álbum de figurinhas bíblicas, tema "Fogo do Espírito": o cenáculo em Pentecostes: uma sala de pedra com janelas arqueadas, pequenas chamas douradas flutuando no ar acima de silhuetas sem rosto e um vento em redemoinho laranja atravessando o ambiente, arte emoldurada por uma borda fina e elegante. A cena principal ocupa o centro e a metade de cima; o terço inferior é mais escuro, calmo e quase sem detalhes (um texto será escrito ali pelo app). Textura sutil de couro/papel, acabamento premium. Paleta: vermelho-fogo, laranja-brasa, dourado e creme, com fundo escuro quente. Sem texto, sem números, sem personagens com rosto.
```
**Reações em imagem (opcional)** — 256×256, fundo transparente:
```
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma chama estilizada laranja e dourada, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: um redemoinho de vento em espiral azul-claro com folhas, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
```

### 4.4 Travessia do Mar Vermelho

| Campo do painel | Valor |
|---|---|
| **Nome** | Travessia do Mar Vermelho |
| **Descrição** | O povo atravessa o mar a pé enxuto: águas como muralhas e a mão de Deus libertando. |
| **Cor do tema** | `#0e6b8f` |
| **Fixar num mês** | Nenhum — entra no rodízio |
| **Paleta da arte** | azul-turquesa profundo, areia dourada, coral e branco-espuma |
| **Cores de apoio** | dourado/acento `#d6a540`, claro `#e9f6fa` |

**Itens visuais** (já na planilha; todos *só como prêmio*):

| Tipo | Nome | Raridade | Como fica |
|---|---|---|---|
| Reação | Mar aberto 🌊 | Comum | emoji, animação Pulo, pacote «Travessia do Mar Vermelho» |
| Cor do nome | Azul do Mar Vermelho | Rara | `#0e8fb8` |
| Ícone | Cajado de Moisés | Rara | **enviar imagem 512×512** e ativar |
| Reação | Maná do céu 🍞 | Rara | emoji, animação Subir, pacote «Travessia do Mar Vermelho» |
| Moldura | Moldura Muralhas de Água | Épica | cor `#d6a540` + imagem opcional (512×512 transparente) |
| Título | Libertado pelas Águas | Épica | `#0e8fb8`, efeito Onda |
| Fundo de perfil | Mar que se abriu | Épica | cor `#0e6b8f` + **imagem 1600×800** |
| Capa do álbum | Capa da Travessia | Lendária | cor `#0e6b8f` + **imagem 1200×1800** |

**Prompts** (cada um começa com o *estilo base* da seção 3):

**Banner do passe — 1600×600 (8:3):**
```
[ESTILO BASE] Banner horizontal 8:3 (1600x600) do passe bíblico "Travessia do Mar Vermelho": a travessia do Mar Vermelho: um caminho de areia clara no meio do mar, com enormes muralhas de água azul-turquesa dos dois lados, uma coluna de nuvem dourada no céu e silhuetas pequenas de um povo caminhando sem rosto. Composição panorâmica: o lado esquerdo é calmo, suave e com poucos detalhes (será coberto por uma película), e o brilho e os detalhes principais ficam no lado direito. Paleta: azul-turquesa profundo, areia dourada, coral e branco-espuma. Atmosfera suave e acolhedora, sem texto, sem números, sem personagens com rosto.
```
**Ícone de perfil — 512×512 (1:1):** *item «Cajado de Moisés»*
```
[ESTILO BASE] Ícone quadrado 1:1 (512x512): um cajado de pastor de madeira com ondas do mar abertas ao fundo, contorno grosso e arredondado, volume suave e brilho leve. O emblema fica centralizado e ocupa cerca de 70% da área (será recortado em círculo). Fundo de cor sólida turquesa #0e6b8f com degradê muito sutil. Sem texto, sem moldura, sem transparência.
```
**Moldura — 512×512 PNG transparente:** *item «Moldura Muralhas de Água»*
```
[ESTILO BASE] Moldura circular 1:1 (512x512) com FUNDO TRANSPARENTE para avatar de jogo: um anel decorativo fino formado por ondas e espuma azul-turquesa subindo em arco ao redor do anel, com pequenas conchas e gotas douradas. O círculo central (78% do diâmetro) é totalmente transparente e vazio; toda a decoração fica só na faixa externa do anel, dentro de um círculo perfeito que toca as bordas da imagem, e nada passa para fora desse círculo. Cores: azul-turquesa profundo, areia dourada, coral e branco-espuma. Sem texto, sem fundo, sem sombra projetada fora do anel.
```
**Fundo de perfil — 1600×800 (2:1):** *item «Mar que se abriu»*
```
[ESTILO BASE] Imagem horizontal 2:1 (1600x800) para fundo de cartão de perfil: a travessia do Mar Vermelho: um caminho de areia clara no meio do mar, com enormes muralhas de água azul-turquesa dos dois lados, uma coluna de nuvem dourada no céu e silhuetas pequenas de um povo caminhando sem rosto. Composição aberta: o lado esquerdo é mais escuro, calmo e com poucos detalhes (ali ficam o ícone e o nome do jogador), e a cena mais rica e luminosa fica à direita e no centro. Paleta: azul-turquesa profundo, areia dourada, coral e branco-espuma. Sem texto, sem números, sem personagens com rosto.
```
**Capa do álbum — 1200×1800 (2:3 vertical):** *item «Capa da Travessia»*
```
[ESTILO BASE] Capa vertical 2:3 (1200x1800) de um álbum de figurinhas bíblicas, tema "Travessia do Mar Vermelho": a travessia do Mar Vermelho: um caminho de areia clara no meio do mar, com enormes muralhas de água azul-turquesa dos dois lados, uma coluna de nuvem dourada no céu e silhuetas pequenas de um povo caminhando sem rosto, arte emoldurada por uma borda fina e elegante. A cena principal ocupa o centro e a metade de cima; o terço inferior é mais escuro, calmo e quase sem detalhes (um texto será escrito ali pelo app). Textura sutil de couro/papel, acabamento premium. Paleta: azul-turquesa profundo, areia dourada, coral e branco-espuma. Sem texto, sem números, sem personagens com rosto.
```
**Reações em imagem (opcional)** — 256×256, fundo transparente:
```
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma onda estilizada azul-turquesa em formato de muralha com espuma, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: um pão redondo dourado com pequenos flocos caindo do céu, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
```

### 4.5 Davi, o Pastor-Rei

| Campo do painel | Valor |
|---|---|
| **Nome** | Davi, o Pastor-Rei |
| **Descrição** | De pastor de ovelhas a rei de Israel: a harpa, a funda e a coragem de quem confia em Deus. |
| **Cor do tema** | `#6b8e23` |
| **Fixar num mês** | Nenhum — entra no rodízio |
| **Paleta da arte** | verde-oliva, azul-céu, dourado real e creme |
| **Cores de apoio** | dourado/acento `#f2c94c`, claro `#f3f0d6` |

**Itens visuais** (já na planilha; todos *só como prêmio*):

| Tipo | Nome | Raridade | Como fica |
|---|---|---|---|
| Reação | Harpa de Davi 🎶 | Comum | emoji, animação Pulo, pacote «Davi, o Pastor-Rei» |
| Cor do nome | Verde dos Pastos | Rara | `#6b8e23` |
| Ícone | Funda de Davi | Rara | **enviar imagem 512×512** e ativar |
| Reação | Coroa do pastor 👑 | Rara | emoji, animação Pulsar, pacote «Davi, o Pastor-Rei» |
| Moldura | Moldura Coroa de Davi | Épica | cor `#f2c94c` + imagem opcional (512×512 transparente) |
| Título | Salmista de Israel | Épica | `#f2c94c`, efeito Brilho |
| Fundo de perfil | Vale de Elá | Épica | cor `#6b8e23` + **imagem 1600×800** |
| Capa do álbum | Capa Pastor-Rei | Lendária | cor `#6b8e23` + **imagem 1200×1800** |

**Prompts** (cada um começa com o *estilo base* da seção 3):

**Banner do passe — 1600×600 (8:3):**
```
[ESTILO BASE] Banner horizontal 8:3 (1600x600) do passe bíblico "Davi, o Pastor-Rei": o vale de Elá ao entardecer: colinas verdes e douradas, um riacho com pedras lisas em primeiro plano, ovelhas pequenas ao longe e o brilho de uma harpa dourada apoiada numa pedra. Composição panorâmica: o lado esquerdo é calmo, suave e com poucos detalhes (será coberto por uma película), e o brilho e os detalhes principais ficam no lado direito. Paleta: verde-oliva, azul-céu, dourado real e creme. Atmosfera suave e acolhedora, sem texto, sem números, sem personagens com rosto.
```
**Ícone de perfil — 512×512 (1:1):** *item «Funda de Davi»*
```
[ESTILO BASE] Ícone quadrado 1:1 (512x512): uma funda de couro com uma pedra lisa, e uma pequena harpa dourada ao lado, contorno grosso e arredondado, volume suave e brilho leve. O emblema fica centralizado e ocupa cerca de 70% da área (será recortado em círculo). Fundo de cor sólida verde-oliva #6b8e23 com degradê muito sutil. Sem texto, sem moldura, sem transparência.
```
**Moldura — 512×512 PNG transparente:** *item «Moldura Coroa de Davi»*
```
[ESTILO BASE] Moldura circular 1:1 (512x512) com FUNDO TRANSPARENTE para avatar de jogo: um anel decorativo fino formado por uma coroa real dourada formada por folhas de oliveira e pequenas notas musicais ao redor do anel. O círculo central (78% do diâmetro) é totalmente transparente e vazio; toda a decoração fica só na faixa externa do anel, dentro de um círculo perfeito que toca as bordas da imagem, e nada passa para fora desse círculo. Cores: verde-oliva, azul-céu, dourado real e creme. Sem texto, sem fundo, sem sombra projetada fora do anel.
```
**Fundo de perfil — 1600×800 (2:1):** *item «Vale de Elá»*
```
[ESTILO BASE] Imagem horizontal 2:1 (1600x800) para fundo de cartão de perfil: o vale de Elá ao entardecer: colinas verdes e douradas, um riacho com pedras lisas em primeiro plano, ovelhas pequenas ao longe e o brilho de uma harpa dourada apoiada numa pedra. Composição aberta: o lado esquerdo é mais escuro, calmo e com poucos detalhes (ali ficam o ícone e o nome do jogador), e a cena mais rica e luminosa fica à direita e no centro. Paleta: verde-oliva, azul-céu, dourado real e creme. Sem texto, sem números, sem personagens com rosto.
```
**Capa do álbum — 1200×1800 (2:3 vertical):** *item «Capa Pastor-Rei»*
```
[ESTILO BASE] Capa vertical 2:3 (1200x1800) de um álbum de figurinhas bíblicas, tema "Davi, o Pastor-Rei": o vale de Elá ao entardecer: colinas verdes e douradas, um riacho com pedras lisas em primeiro plano, ovelhas pequenas ao longe e o brilho de uma harpa dourada apoiada numa pedra, arte emoldurada por uma borda fina e elegante. A cena principal ocupa o centro e a metade de cima; o terço inferior é mais escuro, calmo e quase sem detalhes (um texto será escrito ali pelo app). Textura sutil de couro/papel, acabamento premium. Paleta: verde-oliva, azul-céu, dourado real e creme. Sem texto, sem números, sem personagens com rosto.
```
**Reações em imagem (opcional)** — 256×256, fundo transparente:
```
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma harpa dourada simples com notas musicais pequenas, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: uma coroa dourada simples com uma pequena pedra azul, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
```

### 4.6 Viagens de Paulo

| Campo do painel | Valor |
|---|---|
| **Nome** | Viagens de Paulo |
| **Descrição** | Do caminho de Damasco aos confins do mundo: mares, estradas e cartas que mudaram a história. |
| **Cor do tema** | `#2a6f97` |
| **Fixar num mês** | Nenhum — entra no rodízio |
| **Paleta da arte** | azul-mediterrâneo, terracota, pergaminho e branco-cal |
| **Cores de apoio** | dourado/acento `#c8693a`, claro `#e9d8a6` |

**Itens visuais** (já na planilha; todos *só como prêmio*):

| Tipo | Nome | Raridade | Como fica |
|---|---|---|---|
| Reação | Navio de Paulo ⛵ | Comum | emoji, animação Quicar, pacote «Viagens de Paulo» |
| Cor do nome | Azul do Mediterrâneo | Rara | `#2a6f97` |
| Ícone | Rolo de Cartas | Rara | **enviar imagem 512×512** e ativar |
| Reação | Carta aos romanos 📜 | Rara | emoji, animação Subir, pacote «Viagens de Paulo» |
| Moldura | Moldura Corda e Leme | Épica | cor `#c8693a` + imagem opcional (512×512 transparente) |
| Título | Apóstolo dos Gentios | Épica | `#c8693a`, efeito Brilho |
| Fundo de perfil | Estrada de Damasco | Épica | cor `#2a6f97` + **imagem 1600×800** |
| Capa do álbum | Capa Viagens de Paulo | Lendária | cor `#2a6f97` + **imagem 1200×1800** |

**Prompts** (cada um começa com o *estilo base* da seção 3):

**Banner do passe — 1600×600 (8:3):**
```
[ESTILO BASE] Banner horizontal 8:3 (1600x600) do passe bíblico "Viagens de Paulo": uma estrada romana de pedra ao pôr do sol, com colinas de oliveiras, um porto distante com um veleiro de vela quadrada e uma luz dourada forte no céu, como a luz do caminho de Damasco. Composição panorâmica: o lado esquerdo é calmo, suave e com poucos detalhes (será coberto por uma película), e o brilho e os detalhes principais ficam no lado direito. Paleta: azul-mediterrâneo, terracota, pergaminho e branco-cal. Atmosfera suave e acolhedora, sem texto, sem números, sem personagens com rosto.
```
**Ícone de perfil — 512×512 (1:1):** *item «Rolo de Cartas»*
```
[ESTILO BASE] Ícone quadrado 1:1 (512x512): um rolo de pergaminho amarrado com fita, uma pena e um pequeno veleiro, contorno grosso e arredondado, volume suave e brilho leve. O emblema fica centralizado e ocupa cerca de 70% da área (será recortado em círculo). Fundo de cor sólida azul-mediterrâneo #2a6f97 com degradê muito sutil. Sem texto, sem moldura, sem transparência.
```
**Moldura — 512×512 PNG transparente:** *item «Moldura Corda e Leme»*
```
[ESTILO BASE] Moldura circular 1:1 (512x512) com FUNDO TRANSPARENTE para avatar de jogo: um anel decorativo fino formado por uma corda trançada de marinheiro com um pequeno leme de madeira e nós de corda ao redor do anel. O círculo central (78% do diâmetro) é totalmente transparente e vazio; toda a decoração fica só na faixa externa do anel, dentro de um círculo perfeito que toca as bordas da imagem, e nada passa para fora desse círculo. Cores: azul-mediterrâneo, terracota, pergaminho e branco-cal. Sem texto, sem fundo, sem sombra projetada fora do anel.
```
**Fundo de perfil — 1600×800 (2:1):** *item «Estrada de Damasco»*
```
[ESTILO BASE] Imagem horizontal 2:1 (1600x800) para fundo de cartão de perfil: uma estrada romana de pedra ao pôr do sol, com colinas de oliveiras, um porto distante com um veleiro de vela quadrada e uma luz dourada forte no céu, como a luz do caminho de Damasco. Composição aberta: o lado esquerdo é mais escuro, calmo e com poucos detalhes (ali ficam o ícone e o nome do jogador), e a cena mais rica e luminosa fica à direita e no centro. Paleta: azul-mediterrâneo, terracota, pergaminho e branco-cal. Sem texto, sem números, sem personagens com rosto.
```
**Capa do álbum — 1200×1800 (2:3 vertical):** *item «Capa Viagens de Paulo»*
```
[ESTILO BASE] Capa vertical 2:3 (1200x1800) de um álbum de figurinhas bíblicas, tema "Viagens de Paulo": uma estrada romana de pedra ao pôr do sol, com colinas de oliveiras, um porto distante com um veleiro de vela quadrada e uma luz dourada forte no céu, como a luz do caminho de Damasco, arte emoldurada por uma borda fina e elegante. A cena principal ocupa o centro e a metade de cima; o terço inferior é mais escuro, calmo e quase sem detalhes (um texto será escrito ali pelo app). Textura sutil de couro/papel, acabamento premium. Paleta: azul-mediterrâneo, terracota, pergaminho e branco-cal. Sem texto, sem números, sem personagens com rosto.
```
**Reações em imagem (opcional)** — 256×256, fundo transparente:
```
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: um veleiro simples de vela quadrada sobre ondas, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
[ESTILO BASE] Figurinha/emoji 1:1 (256x256) com FUNDO TRANSPARENTE: um rolo de pergaminho meio aberto amarrado com fita, contorno grosso e brilho leve, centralizada, ocupando 80% da área.
```

## 5. Degraus (iguais nos 6 passes)

A trilha reinicia todo mês e é liberada pelo **XP do mês**. Os valores seguem a economia atual (docs/economia.md): quem joga bastante chega ao degrau 8 (18.000 XP); quem joga pouco ainda leva os primeiros itens.

| Degrau | XP no mês | Prêmio | Item visual |
|---|---|---|---|
| 1 | 500 | 60 moedas | Reação 1 |
| 2 | 1.500 | Dica 50/50 | Cor do nome |
| 3 | 3.000 | 100 moedas | Ícone |
| 4 | 5.000 | Tempo extra | Reação 2 |
| 5 | 7.500 | Pacote surpresa | Moldura |
| 6 | 10.500 | 200 moedas | Título |
| 7 | 14.000 | Bênção dobrada | Fundo de perfil |
| 8 | 18.000 | 300 moedas | Capa do álbum |

**Se o jogador já tiver o item** (porque este passe já passou antes e ele resgatou): ele recebe moedas pela raridade — comum 50, rara 100, épica 200, lendária 400 — e nos degraus 6 e 8 também uma recompensa extra (Dica 50/50 e Pacote surpresa). Isso já está na planilha; dá para mudar por degrau no painel.

## 6. Checklist final

- [ ] `itens-visuais-passes.csv` importado (48 itens).
- [ ] 6 passes criados com nome **exatamente igual** ao da planilha de degraus; banner enviado.
- [ ] Imagens de ícone (6), moldura (6, opcional), fundo de perfil (6) e capa (6) enviadas; ícones **ativados**.
- [ ] `degraus-passes.csv` importado (48 degraus).
- [ ] Calendário dos próximos meses conferido no painel.
- [ ] Conta de teste: resgatou um degrau, equipou o fundo de perfil e a capa e viu o álbum abrir com a nova capa.
