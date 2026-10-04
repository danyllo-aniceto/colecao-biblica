# Modo Tabuleiro — guia de arte e prompts

Cada cenário do tabuleiro pode ter **1 imagem de fundo** (o terreno por onde o caminho passa) e o jogador pode ter **peões** com
imagem própria. Tudo é enviado pelo painel:

- Fundo: **Painel → Campanha → editar o cenário → Imagem do tabuleiro** (a prévia ao lado mostra como fica).
- Peão: **Painel → Visual → Novo item → Peão** (emoji ou imagem, com prévia no tabuleiro).

> **Importante:** o app desenha o caminho e as casas **por cima** da imagem. Por isso o fundo **não tem estrada, casas, setas,
> números, peões nem texto**: é só o terreno, visto **de cima** (como o tampo de um jogo de tabuleiro).

## 1. Fundo do tabuleiro

### Formato

| | |
|---|---|
| Proporção e tamanho | **9:16 vertical**, **1080 × 1920 px** |
| Arquivo | JPG ou WebP, de preferência até ~1 MB (limite do envio: 4 MB) |
| Visão | **de cima (aérea)**, sem linha de horizonte e sem céu |
| Texto, números, setas, casas, estrada | **nenhum** |
| Transparência | nenhuma (cena completa) |

### Por que visto de cima

O tabuleiro tem de 25 a 60 casas e fica bem mais alto que a tela. O app **repete a imagem de cima para baixo, espelhando uma
cópia sim, outra não**, para as emendas sumirem. Isso só fica natural se a arte não tiver "alto" e "baixo" (céu em cima e chão
embaixo). Uma vista aérea do terreno (grama, rio, areia, pedras) funciona de qualquer lado.

### Medidas no celular (para a IA e para quem revisa)

A imagem de 1080 px de largura ocupa a tela inteira do celular (390 px): **1 px do app ≈ 2,8 px da imagem**.

| Elemento do app | No app | Na imagem (1080 × 1920) |
|---|---|---|
| Casa comum | círculo de 44 px | ~122 px |
| Casa especial (poder, provação...) | círculo de 54 px | ~150 px |
| Largura da estrada | 26 px | ~72 px |
| Distância entre o centro de duas casas | 64 px | ~178 px |
| **Corredor** onde o caminho serpenteia | 72% da largura | faixa central de **~780 px** |

- **Corredor central (780 px):** terreno calmo, de cor média e pouco contraste. É aqui que ficam a estrada e as casas.
- **Margens (150 px de cada lado):** é onde moram os detalhes do cenário (árvores, rochas, ondas, tendas, ruínas...), bem
  pequenos e espalhados, nunca grudados no corredor.
- **Cores médias e saturadas, contraste baixo:** as casas têm cores fortes (verde, vermelho, azul, dourado) e precisam
  se destacar do fundo. Evite brancos estourados e pretos profundos.
- O app aplica uma película leve na cor do tema; funciona nos temas claro e escuro.

## 2. Estilo base (cole no início de TODO prompt de fundo)

> Ilustração 2D de jogo mobile casual, estilo cartoon semiplano (semi-flat) com contornos suaves e arredondados, cores
> saturadas porém harmônicas, sombras suaves em camadas, textura de papel muito leve, formas simples e legíveis, acabamento
> limpo e profissional. Vista aérea (de cima para baixo), como o tampo de um jogo de tabuleiro, sem linha de horizonte e sem céu.
> Sem texto, sem letras, sem números, sem marca d'água, sem logotipos. Sem estrada, sem caminho desenhado, sem casas de jogo,
> sem setas. Se houver pessoas, apenas silhuetas pequenas e sem rosto. Tom respeitoso, acolhedor e adequado a todas as idades.

## 3. Modelo

```
[ESTILO BASE]

Fundo vertical 9:16 (1080x1920) para um jogo de tabuleiro, do cenário bíblico "[NOME]", visto de cima.
No centro (faixa de cerca de 70% da largura) o terreno é calmo, de cor média e pouco contraste: [CENTRO].
Nas margens esquerda e direita (cerca de 15% de cada lado) ficam os detalhes do cenário, pequenos e espalhados:
[MARGENS]. A imagem não tem alto nem baixo (pode ser espelhada na vertical sem estranhar).
Sem texto, sem números, sem estrada ou caminho desenhado, sem personagens com rosto, sem moldura.
Paleta dominante: [CORES]. Mantenha exatamente o mesmo estilo, traço e acabamento das imagens de referência.
```

Referências para anexar: o **mapa do cenário** (`map.png` da campanha) para lugar e paleta e, a partir do segundo, o
**fundo do Éden aprovado** para o estilo e o acabamento.

## 4. Prompts por cenário

Em todos, substitua `[ESTILO BASE]` pelo bloco da seção 2 e use o modelo da seção 3.

### Jardim do Éden — `eden` (verde `#3fa34d`)
- **Centro:** gramado macio com manchas de trevo e pequenas flores, um riacho cristalino bem suave cruzando devagar.
- **Margens:** copas de árvores frutíferas vistas de cima, arbustos com frutinhas, pedrinhas lisas na beira do riacho.
- **Cores:** verdes vivos, dourado suave e toques de rosa.

### Arca de Noé — `arca` (azul `#3b8fb8`)
- **Centro:** águas calmas e rasas em azul-turquesa, com reflexos suaves e pequenas ondas redondas.
- **Margens:** ilhotas de lama seca, pedras molhadas, tábuas de madeira boiando e galhos de oliveira.
- **Cores:** azuis, madeira quente e um toque discreto de arco-íris.

### Terra de Canaã — `canaa` (dourado `#c49a3c`)
- **Centro:** colinas douradas de pasto seco com trilhas de terra batida muito suaves, sem formar estrada.
- **Margens:** oliveiras, pequenos rebanhos de ovelhas (pontinhos brancos), tendas de pastor e um poço de pedra.
- **Cores:** dourado, ocre, verde-oliva.

### Egito — `egito` (areia `#d6a540`)
- **Centro:** dunas de areia com ondulações suaves e o rio Nilo, calmo e largo, fazendo uma curva ampla ao fundo.
- **Margens:** palmeiras, papiros, blocos de pedra de templo, pequenos barcos a vela no rio.
- **Cores:** areia, dourado, turquesa do rio e verde dos juncos.

### Deserto do Sinai — `sinai` (laranja queimado `#c8693a`)
- **Centro:** chão de pedra avermelhada e areia com fendas suaves e pegadas muito leves.
- **Margens:** rochedos grandes vistos de cima, cactos e arbustos secos, pontinhos de maná branco espalhados, tendas pequenas.
- **Cores:** laranja queimado, terracota, bege e roxo suave nas sombras.

### Jericó — `jerico` (tijolo `#b5543c`)
- **Centro:** terra seca avermelhada e pedregulhos pequenos, com marcas de tijolo muito sutis no chão.
- **Margens:** trechos de muralha de tijolos vistos de cima, torres redondas, trombetas e tendas de acampamento ao longe.
- **Cores:** tijolo, terracota, areia e cinza-azulado.

### Templo de Salomão — `templo` (ouro `#e0b43a`)
- **Centro:** piso de pedra clara com mosaico dourado muito suave e discreto, sem desenhos grandes.
- **Margens:** colunas e vasos dourados vistos de cima, cedros, candelabros de sete braços pequenos, tapetes azuis e púrpura.
- **Cores:** ouro, marfim, azul-real e púrpura suave.

### Babilônia — `babilonia` (azul-real `#2f5fb3`)
- **Centro:** pavimento de azulejos azuis com padrões repetidos bem discretos (inspirado nos portões de Ishtar).
- **Margens:** jardins suspensos em degraus, leões de pedra dourados, canais de água, tochas apagadas.
- **Cores:** azul-royal, dourado queimado, verde dos jardins.

### Mar da Galileia — `galileia` (turquesa `#2aa1c4`)
- **Centro:** água turquesa com ondas suaves e reflexos de luz, sem espuma forte.
- **Margens:** barcos de pesca de madeira, redes, pedras da margem, juncos e pequenos cardumes (sombras de peixes).
- **Cores:** turquesa, azul-claro, madeira e areia.

### Jerusalém — `jerusalem` (violeta `#8e6bd1`)
- **Centro:** ruas de pedra clara com juntas suaves, em tom lilás, e oliveiras espalhadas.
- **Margens:** muralhas e telhados de pedra, jardim de oliveiras (Getsêmani), uma pedra grande redonda ao lado de um túmulo vazio.
- **Cores:** violeta, pedra clara, verde-oliva e toques de dourado.

## 5. Peões

O peão aparece pequeno (de 28 a 48 px) em cima das casas, então precisa de **silhueta forte e poucos detalhes**.

| | |
|---|---|
| Tamanho | **512 × 512 px**, quadrado |
| Arquivo | **PNG com fundo transparente**, até ~200 KB |
| Posição | objeto centrado, ocupando ~80% da imagem (margem de ~10% em volta) |
| Estilo | "ficha de jogo" 3D macia, contorno grosso e cor sólida, vista levemente de cima |
| Sombra | **sem sombra** (o app já coloca uma) e sem fundo |
| Texto | nenhum |

### Modelo

```
Peão de jogo de tabuleiro em estilo cartoon 3D macio, vista levemente de cima: [OBJETO], com contorno grosso e arredondado,
cores sólidas e saturadas, um brilho suave no canto superior esquerdo e base redonda de ficha. Silhueta forte e simples,
poucos detalhes, legível mesmo bem pequeno. Fundo totalmente transparente, sem sombra no chão, sem texto,
centralizado, ocupando 80% do quadro, 512x512.
```

### Ideias (os mesmos dez da loja, mais os de vitória)

`Maçã dourada do Éden` · `Girafa da Arca` · `Camelo de Canaã` · `Rã do Egito` · `Tábua de pedra do Sinai` · `Trombeta de Jericó` ·
`Menorá do Templo` · `Muralha da Babilônia` · `Barquinho da Galileia` · `Túmulo vazio com a pedra rolada` · `Troféu` (3 vitórias) ·
`Medalha de campeão` (15 vitórias).

## 6. Conferência antes de enviar

- [ ] Sem texto, números, estrada, casas, setas ou rostos.
- [ ] Vista de cima, sem horizonte (a imagem espelhada na vertical não estranha).
- [ ] Centro calmo e de contraste baixo; detalhes só nas margens.
- [ ] Cores médias: testar a prévia do painel nos temas claro e escuro.
- [ ] Mesmo estilo e acabamento dos outros cenários.
- [ ] Peões com fundo transparente, bem centrados e legíveis pequenos (veja a prévia do painel).
