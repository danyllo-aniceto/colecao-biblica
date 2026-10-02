# Modo Campanha — guia de arte e prompts

Este guia padroniza as imagens dos cenários para ficarem todas com **o mesmo estilo, formato e tamanho**.
Cada cenário precisa de **2 imagens**: o **mapa** (o caminho) e o **ícone** (o emblema do cenário).

## 1. Onde colocar os arquivos

Sem mexer em código: salve as imagens com estes nomes e o app passa a usá-las.

```
frontend/public/campaign/<slug>/map.png    ← mapa do cenário
frontend/public/campaign/<slug>/icon.png   ← ícone do cenário
```

| Cenário | slug | Níveis | Paradas | Cor de destaque |
|---|---|---|---|---|
| Jardim do Éden | `eden` | 1–4 | 4 | verde `#3fa34d` |
| Arca de Noé | `arca` | 5–8 | 4 | azul `#3b8fb8` |
| Terra de Canaã | `canaa` | 9–13 | 5 | dourado `#c49a3c` |
| Egito | `egito` | 14–18 | 5 | areia `#d6a540` |
| Deserto do Sinai | `sinai` | 19–23 | 5 | laranja queimado `#c8693a` |
| Jericó | `jerico` | 24–28 | 5 | tijolo `#b5543c` |
| Templo de Salomão | `templo` | 29–33 | 5 | ouro `#e0b43a` |
| Babilônia | `babilonia` | 34–38 | 5 | azul-real `#2f5fb3` |
| Mar da Galileia | `galileia` | 39–44 | 6 | turquesa `#2aa1c4` |
| Jerusalém | `jerusalem` | 45–50 | 6 | violeta `#8e6bd1` |

Se faltar um arquivo, o app mostra um degradê com a cor do cenário e um ícone padrão, então dá para ir
entregando aos poucos. Mais tarde o painel poderá trocar as imagens por upload.

## 2. Formato (igual para todos)

| | Mapa | Ícone |
|---|---|---|
| Proporção | **3:4 vertical** | **1:1 quadrado** |
| Tamanho | **1536 × 2048 px** | **512 × 512 px** |
| Arquivo | PNG (ou WebP), até ~1,5 MB | PNG, até ~200 KB |
| Texto na imagem | **nenhum** | **nenhum** |
| Fundo | cena completa, sem transparência | cor sólida do cenário (sem transparência) |

**O ícone também vira prêmio:** o mesmo arquivo é o **ícone de perfil** (avatar redondo) que o jogador ganha ao resgatar a relíquia do cenário. Trocar o ícone no painel atualiza o avatar sozinho. Como ele é recortado em círculo, o emblema precisa caber no centro.

**Zona segura do ícone:** o app arredonda os cantos (e, como avatar, corta em círculo) e corta um pouco. Mantenha o desenho no centro
(cerca de 70% da área); as bordas ficam só com a cor de fundo.

## 3. O caminho no mapa (importante)

O app desenha **por cima** do mapa uma trilha pontilhada e as paradas (círculos numerados). Elas sobem
**de baixo para cima em zigue-zague**. Para a arte combinar, imagine o caminho passando por estes pontos
(em % da largura e da altura, contando do canto superior esquerdo):

| Paradas | Pontos (x%, y%) — da 1ª parada, embaixo, até a última, em cima |
|---|---|
| 4 | (22,90) → (62,64) → (30,38) → (70,12) |
| 5 | (22,90) → (62,70) → (30,51) → (70,32) → (38,12) |
| 6 | (22,90) → (62,74) → (30,59) → (70,43) → (38,28) → (78,12) |

A última parada (em cima) é a **relíquia** do cenário: vale um ponto de destaque na cena (um monumento,
portal ou lugar marcante perto do topo). Regras de composição:

- Um **caminho de terra/pedra sinuoso e largo** do rodapé até o topo, alternando esquerda e direita.
- Deixe a trilha **livre de objetos grandes** e de detalhes muito contrastantes (as paradas ficam por cima).
- Cena em **vista de cima inclinada** (como mapa de jogo), horizonte alto, nada de sol forte no centro.
- Topo e rodapé mais escuros/suaves: o app coloca um selo de nível e a barra de progresso perto deles.

## 4. Estilo único (cole no início de TODO prompt)

> **Estilo base (não mude):**
> Ilustração 2D de jogo mobile casual, estilo cartoon semiplano (semi-flat) com contornos suaves e
> arredondados, cores saturadas porém harmônicas, sombras suaves em camadas, textura de papel muito leve,
> iluminação quente vinda do canto superior esquerdo, formas simples e legíveis, leve vinheta nas bordas,
> acabamento limpo e profissional. Sem texto, sem letras, sem números, sem marca d'água, sem logotipos.
> Se houver pessoas, apenas silhuetas pequenas e sem rosto. Nenhum rosto detalhado, nenhuma imagem
> realista de Jesus. Tom respeitoso, acolhedor e adequado a todas as idades.

**Dica para manter a consistência:** gere primeiro o mapa e o ícone do Éden, aprove o resultado e anexe
essas duas imagens como *referência de estilo* nos prompts dos outros cenários
("mantenha exatamente o mesmo estilo, traço e acabamento da imagem de referência").

## 5. Modelos de prompt

### 5.1 Modelo do mapa

```
[ESTILO BASE colado aqui]

Mapa vertical 3:4 (1536x2048) do cenário bíblico "[NOME DO CENÁRIO]": [DESCRIÇÃO DA CENA].
Vista de cima inclinada, como mapa de jogo. Um caminho largo e sinuoso de [MATERIAL DO CAMINHO]
sobe do rodapé até o topo em zigue-zague (começa embaixo à esquerda, vai e volta entre esquerda e direita).
Perto do topo, [MARCO DA RELÍQUIA], como ponto de destaque. O caminho fica livre de objetos grandes.
Paleta dominante: [CORES]. Sem texto, sem números, sem personagens com rosto.
```

### 5.2 Modelo do ícone

```
[ESTILO BASE colado aqui]

Ícone quadrado 1:1 (512x512) do cenário bíblico "[NOME DO CENÁRIO]": um único emblema centralizado
representando [ELEMENTO PRINCIPAL], com contorno grosso e arredondado, volume suave e brilho leve.
O emblema ocupa cerca de 70% da área; o fundo é uma cor sólida [COR DE DESTAQUE] com um degradê muito sutil.
Sem texto, sem moldura, sem transparência.
```

## 6. Prompts prontos por cenário

Substitua `[ESTILO BASE]` pelo bloco da seção 4.

### Jardim do Éden — `eden`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 (1536x2048) do cenário bíblico "Jardim do Éden": um jardim exuberante
com árvores frutíferas, flores, um riacho cristalino e névoa dourada. Vista de cima inclinada, como mapa de jogo.
Um caminho largo e sinuoso de terra clara e grama baixa sobe do rodapé até o topo em zigue-zague. Perto do topo,
uma grande árvore de copa dourada ao centro de uma clareira, como ponto de destaque. O caminho fica livre de objetos
grandes. Paleta dominante: verdes vivos, dourado suave e toques de rosa. Sem texto, sem personagens com rosto.
**Ícone:** `[ESTILO BASE]` Ícone 1:1 (512x512): uma árvore frutífera de copa redonda com uma maçã dourada,
contorno grosso, fundo verde sólido `#3fa34d` com degradê sutil, emblema centralizado em 70% da área.

### Arca de Noé — `arca`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Arca de Noé no Monte Ararate": águas baixando, uma colina
rochosa, animais pequenos em pares ao longe e um arco-íris suave no céu ao fundo. Vista de cima inclinada.
Caminho largo e sinuoso de pedra e lama seca do rodapé ao topo, em zigue-zague. Perto do topo, a Arca de madeira
pousada no cume, como destaque. Caminho livre de objetos grandes. Paleta: azuis, madeira quente, arco-íris discreto.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: uma arca de madeira estilizada com um pequeno arco-íris acima, fundo azul
sólido `#3b8fb8`.

### Terra de Canaã — `canaa`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Terra de Canaã": colinas douradas, oliveiras, tendas de
pastores, rebanhos pequenos e um céu estrelado ao entardecer. Vista de cima inclinada. Caminho largo e sinuoso de
terra batida do rodapé ao topo em zigue-zague. Perto do topo, um altar de pedras e uma grande árvore (carvalho de
Manre), como destaque. Paleta: dourado, ocre, verde-oliva e azul do entardecer.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: uma tenda de pastor sob uma estrela brilhante, fundo dourado sólido `#c49a3c`.

### Egito — `egito`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Egito": dunas de areia, o rio Nilo serpenteando, palmeiras,
pirâmides e uma esfinge ao longe, hieróglifos apenas como textura decorativa nas pedras (sem formar texto legível).
Vista de cima inclinada. Caminho largo e sinuoso de areia clara e lajes de pedra do rodapé ao topo em zigue-zague.
Perto do topo, um portal de templo egípcio com duas colunas, como destaque. Paleta: areia, ocre, azul-lápis e turquesa.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: uma pirâmide com o olho de Hórus estilizado acima, fundo areia sólido `#d6a540`.

### Deserto do Sinai — `sinai`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Deserto do Sinai": montanhas áridas avermelhadas, dunas,
acampamento de tendas, uma coluna de nuvem ao fundo e um céu limpo. Vista de cima inclinada. Caminho largo e
sinuoso de cascalho e areia do rodapé ao topo em zigue-zague. Perto do topo, a montanha do Sinai com uma luz
suave no cume, como destaque. Paleta: laranja queimado, vermelho-terra, bege e azul-claro.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: duas tábuas de pedra arredondadas sobre uma montanha, fundo laranja sólido `#c8693a`.

### Jericó — `jerico`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Jericó": uma cidade murada de tijolos de barro em um oásis
de tamareiras, trombetas de chifre de carneiro decorativas no chão, céu claro. Vista de cima inclinada. Caminho
largo e sinuoso de pedra e terra do rodapé ao topo em zigue-zague, contornando as muralhas. Perto do topo, o
portão da cidade com um trecho do muro rachando, como destaque. Paleta: tijolo, terracota, verde de tamareira.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: uma muralha de tijolos com uma trombeta (shofar) à frente, fundo tijolo sólido `#b5543c`.

### Templo de Salomão — `templo`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Templo de Salomão": pátios de pedra clara, colunas de
bronze, cedros, candelabros dourados e a luz quente do fim da tarde sobre Jerusalém. Vista de cima inclinada.
Caminho largo e sinuoso de lajes de pedra do rodapé ao topo em zigue-zague. Perto do topo, a fachada do Templo
com portas douradas, como destaque. Paleta: pedra clara, ouro, cedro e azul-profundo.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: um candelabro de sete braços (menorá) dourado, fundo ouro sólido `#e0b43a`.

### Babilônia — `babilonia`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Babilônia": muralhas azuis esmaltadas com relevos de
leões e dragões, jardins suspensos em terraços, o rio Eufrates, palmeiras e um zigurate ao fundo. Vista de cima
inclinada. Caminho largo e sinuoso de tijolo esmaltado do rodapé ao topo em zigue-zague. Perto do topo, o grande
portão azul com leões, como destaque. Paleta: azul-real, turquesa, ouro e verde dos jardins.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: um leão estilizado sobre um portão azul, fundo azul-real sólido `#2f5fb3`.

### Mar da Galileia — `galileia`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Mar da Galileia": margem de pedrinhas, barcos de pesca
de madeira, redes secando, colinas verdes ao fundo e um pôr do sol manso. Vista de cima inclinada. Caminho largo
e sinuoso de areia e pedrinhas ao longo da margem, do rodapé ao topo em zigue-zague. Perto do topo, uma colina
suave com uma figueira, como destaque. Paleta: turquesa, areia, verde-claro e laranja do pôr do sol.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: um barco de pesca com vela simples sobre ondas suaves, fundo turquesa sólido `#2aa1c4`.

### Jerusalém — `jerusalem`
**Mapa:** `[ESTILO BASE]` Mapa vertical 3:4 do cenário "Jerusalém": ruas de pedra, muralhas, oliveiras do Monte
das Oliveiras, uma colina com três cruzes ao longe em silhueta discreta e um túmulo de pedra aberto com luz suave.
Vista de cima inclinada. Caminho largo e sinuoso de pedra do rodapé ao topo em zigue-zague. Perto do topo, o túmulo
vazio com a pedra rolada e uma luz dourada, como destaque. Tom reverente e esperançoso. Paleta: violeta do
amanhecer, pedra clara, verde-oliva e dourado.
**Ícone:** `[ESTILO BASE]` Ícone 1:1: um túmulo de pedra com a pedra rolada e raios de luz dourada, fundo violeta sólido `#8e6bd1`.

## 7. Carta especial de Jesus

A carta fica no mesmo formato das outras figurinhas do álbum (use a mesma proporção das demais cartas) e
tem a raridade **Especial**, com moldura **verde-água** (`#14b8a6`). Sugestão de prompt, com o mesmo estilo:

```
[ESTILO BASE]
Arte de carta colecionável (mesma proporção das outras cartas do álbum): "Jesus", representado de forma
reverente e simbólica, de costas ou em silhueta suave de longe, com túnica clara, no alto de uma colina ao
amanhecer, com luz dourada e verde-água ao redor, um cajado de pastor e ovelhas pequenas aos pés.
Sem rosto detalhado. Composição vertical, centro com luz radiante, bordas escuras suaves.
Sem texto e sem moldura (a moldura é desenhada pelo app).
```

> Fragmentos: a carta é entregue ao juntar os 10 fragmentos (um em cada relíquia). Se quiser, dá para
> criar depois uma arte "em quebra-cabeça" mostrando as peças que já foram conquistadas.

## 8. Checklist antes de enviar

- [ ] Mapa 1536×2048 (3:4) e ícone 512×512 (1:1).
- [ ] Nenhum texto, número ou marca d'água na imagem.
- [ ] Caminho livre de objetos grandes e passando perto dos pontos da seção 3.
- [ ] Mesmo estilo dos outros cenários (compare lado a lado).
- [ ] Testa no tema claro e no escuro (o mapa fica igual; só as bordas do app mudam).
- [ ] Nome do arquivo: `map.png` / `icon.png` dentro da pasta com o `slug` do cenário.
