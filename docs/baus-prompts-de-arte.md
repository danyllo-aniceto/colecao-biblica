# Baús — guia de arte e prompts

Cada baú (bronze, prata, ouro, diamante e esmeralda) usa **2 imagens**: o baú **fechado** (obrigatória) e o baú **aberto**
(opcional, mas deixa a abertura muito melhor). O tremor, o clarão, as faíscas e os prêmios saindo são feitos pelo
app: não precisa de quadro a quadro.

Envie as imagens em **Painel → Simulador de baús → Visual dos baús** (campos "Baú fechado" e "Baú aberto"), onde dá
para testar a animação na hora.

## Formato (igual nas 8 imagens)

| | |
|---|---|
| Proporção e tamanho | **1:1**, 1024 × 1024 px |
| Fundo | **transparente** (PNG). Se o gerador não fizer, use fundo **magenta chapado `#FF00FF`** e recorte depois |
| Enquadramento | baú **centralizado**, ocupando ~70% da área, visto de frente em 3/4, um pouco de cima |
| Fechado × aberto | **mesma posição, tamanho e ângulo**: a troca entre eles precisa parecer o mesmo baú abrindo |
| Sombra | sem sombra no chão (o app já aplica) |
| Texto | nenhum |

## Cores de cada baú (as mesmas do app)

| Baú | Cor principal | Sombra |
|---|---|---|
| Bronze | `#d98a4a` | `#8a4f1d` |
| Prata | `#cbd5e1` | `#64748b` |
| Ouro | `#fbbf24` | `#b45309` |
| Diamante | `#5ad1ff` | `#0e7bb0` |
| Esmeralda | `#14b8a6` | `#047857` |

## Estilo base (cole no início de TODO prompt)

> Ilustração 2D de jogo mobile casual, estilo cartoon semiplano (semi-flat) com contornos grossos e
> arredondados, cores saturadas porém harmônicas, sombras suaves em camadas, textura de papel muito leve,
> iluminação quente vinda do canto superior esquerdo, formas simples e legíveis, acabamento limpo e profissional.
> Sem texto, sem letras, sem números, sem marca d'água, sem logotipos. Tom acolhedor e adequado a todas as idades.

**Dica de consistência:** gere o **bronze fechado** primeiro. Aprovado, anexe essa imagem como referência nos
outros ("mantenha exatamente o mesmo estilo, traço, ângulo e proporção do baú de referência"). Para cada versão
aberta, anexe o **fechado do mesmo nível** e peça só a abertura.

## Prompts

### Bronze
**Fechado:** `[ESTILO BASE]` Imagem 1:1 (1024x1024), fundo transparente. Um baú de tesouro de madeira simples e rústico,
tampa arredondada, tábuas de madeira clara com veios, cintas e cantoneiras de bronze alaranjado (#d98a4a, sombras
#8a4f1d) com rebites redondos, fechadura redonda simples. Visto de frente em 3/4, um pouco de cima, centralizado,
ocupando 70% da imagem, fechado. Sem sombra no chão, sem texto.
**Aberto:** `[ESTILO BASE]` O mesmo baú de bronze da imagem de referência, na mesma posição, tamanho e ângulo, agora
ABERTO: a tampa levantada para trás (cerca de 110°) e uma luz quente alaranjada saindo de dentro, com alguns raios
suaves subindo e poucas faíscas pequenas. O interior brilha e fica vazio (sem moedas, sem objetos). Fundo
transparente, sem texto.

### Prata
**Fechado:** `[ESTILO BASE]` Imagem 1:1 (1024x1024), fundo transparente. Um baú de tesouro de madeira escura mais refinado,
tampa levemente abaulada, com cintas, cantoneiras e bordas de prata azulada (#cbd5e1, sombras #64748b), rebites
polidos e fechadura com uma pequena gema azul-acinzentada. Visto de frente em 3/4, um pouco de cima, centralizado,
70% da imagem, fechado. Sem sombra no chão, sem texto.
**Aberto:** `[ESTILO BASE]` O mesmo baú de prata da imagem de referência, na mesma posição, tamanho e ângulo, agora
ABERTO: tampa levantada para trás (cerca de 110°), luz branco-azulada brilhando de dentro com raios suaves e
pequenas estrelinhas prateadas. Interior luminoso e vazio. Fundo transparente, sem texto.

### Ouro
**Fechado:** `[ESTILO BASE]` Imagem 1:1 (1024x1024), fundo transparente. Um baú de tesouro nobre de madeira escura rica,
revestido de ouro (#fbbf24, sombras #b45309), com relevos de videiras e folhas nas laterais, uma estrela
dourada no centro da tampa, cantoneiras grandes e uma fechadura grande e ornamentada com pequenas gemas
vermelhas. Visto de frente em 3/4, um pouco de cima, centralizado, 70% da imagem, fechado, com brilho dourado
suave nas bordas. Sem sombra no chão, sem texto.
**Aberto:** `[ESTILO BASE]` O mesmo baú de ouro da imagem de referência, na mesma posição, tamanho e ângulo, agora
ABERTO: tampa levantada para trás (cerca de 110°), uma luz dourada intensa saindo de dentro com raios largos
subindo e faíscas douradas. Interior brilhante e vazio. Fundo transparente, sem texto.

### Diamante
**Fechado:** `[ESTILO BASE]` Imagem 1:1 (1024x1024), fundo transparente. Um baú de tesouro mágico de cristal azul-gelo
(#5ad1ff, sombras #0e7bb0) com painéis facetados semitransparentes, molduras de prata clara, uma grande gema de
diamante lapidada no centro da tampa e outra na fechadura, e um brilho azul etéreo em volta, com poucas
estrelinhas dentro da área da imagem. Visto de frente em 3/4, um pouco de cima, centralizado, 70% da imagem,
fechado. Sem sombra no chão, sem texto.
**Aberto:** `[ESTILO BASE]` O mesmo baú de diamante da imagem de referência, na mesma posição, tamanho e ângulo, agora
ABERTO: tampa de cristal levantada para trás (cerca de 110°), um feixe de luz azul-branca intensa subindo de
dentro, com raios em leque, cristais de gelo brilhando e muitas estrelinhas. Interior luminoso e vazio. Fundo
transparente, sem texto.

### Esmeralda (o baú da figurinha especial)
**Fechado:** `[ESTILO BASE]` Imagem 1:1 (1024x1024), fundo transparente. Um baú de tesouro sagrado e majestoso de madeira muito escura, revestido de esmeralda
verde-água (#14b8a6, sombras #047857) e detalhes de ouro claro, com uma grande gema esmeralda lapidada no centro da tampa, um
ornamento de cajado de pastor e folhas de oliveira em relevo nas laterais, fechadura com gemas verdes. Um brilho verde-água suave em
volta, com poucas estrelinhas dentro da área da imagem. Visto de frente em 3/4, um pouco de cima, centralizado, 70% da imagem,
fechado. Sem sombra no chão, sem texto, sem rostos.
**Aberto:** `[ESTILO BASE]` O mesmo baú de esmeralda da imagem de referência, na mesma posição, tamanho e ângulo, agora ABERTO: tampa levantada para
trás (cerca de 110°), uma luz verde-água e dourada solene subindo de dentro com raios largos em leque, folhas de oliveira brilhando e
muitas estrelinhas. Interior luminoso e vazio. Fundo transparente, sem texto.

O baú de esmeralda não tem imagem pronta: sem a arte enviada, o app usa o desenho padrão (verde-água com uma joia). Ele é aberto sozinho,
uma única vez, quando o jogador conquista a figurinha especial na campanha.

## Sons

Os sons dos baús são **criados pelo próprio app** (não precisa de arquivo): um para a abertura de cada nível, um para o
tique do carretel, três de suspense (rara, épica e lendária) e um para cada prêmio (moedas, ajuda, item visual e figurinha
comum, rara, épica e lendária). No painel, em **Simulador de baús → Sons dos baús**, dá para ouvir todos.
