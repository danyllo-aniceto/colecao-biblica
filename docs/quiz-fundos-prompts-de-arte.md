# Fundo do quiz por cenário — guia de arte e prompts

Cada cenário da campanha pode ter **1 imagem de fundo** para a tela do quiz. Envie em
**Painel → Campanha → editar o cenário → Fundo do quiz** (a prévia ao lado mostra como fica).
O desafio do dia não usa esse fundo.

## Formato

| | |
|---|---|
| Proporção e tamanho | **9:16 vertical**, **1080 × 1920 px** |
| Arquivo | JPG, WebP ou PNG, de preferência até ~1 MB (no máximo 4 MB) |
| Texto na imagem | **nenhum** |
| Transparência | nenhuma (cena completa) |

## O que o app faz com a imagem

- A imagem cobre a tela inteira (`cover`) e leva por cima uma **película na cor do tema** (40% no topo, 60% embaixo)
  para o texto continuar legível nos temas claro e escuro. Por isso use cores **saturadas** e contraste médio.
- No celular aparece a imagem inteira; no computador (tela larga) aparece só a **faixa central**. Por isso a
  composição precisa funcionar nos dois: o **centro** é uma paisagem ampla e calma, e os detalhes ficam no **topo** e no
  **rodapé**.
- Por cima ficam a barra de progresso (topo), a pergunta e as 4 alternativas coloridas (meio e baixo). Evite objetos
  grandes, rostos ou pontos de luz forte no meio.

## Referências para anexar na IA

1. **Mapa do cenário** (`map.png` da campanha): referência de lugar, paleta e estilo.
2. **O fundo do Éden aprovado**: referência de composição e acabamento para os outros nove.
3. Sempre repita: "mantenha exatamente o mesmo estilo, traço e acabamento das imagens de referência".

## Estilo base (cole no início de TODO prompt)

> Ilustração 2D de jogo mobile casual, estilo cartoon semiplano (semi-flat) com contornos suaves e
> arredondados, cores saturadas porém harmônicas, sombras suaves em camadas, textura de papel muito leve,
> iluminação quente vinda do canto superior esquerdo, formas simples e legíveis, leve vinheta nas bordas,
> acabamento limpo e profissional. Sem texto, sem letras, sem números, sem marca d'água, sem logotipos.
> Se houver pessoas, apenas silhuetas pequenas e sem rosto. Tom respeitoso, acolhedor e adequado a todas as idades.

## Modelo

```
[ESTILO BASE]

Fundo vertical 9:16 (1080x1920) para a tela de perguntas de um jogo, do cenário bíblico "[NOME]".
Composição pensada para ficar atrás de textos e botões: o TOPO (20%) e o RODAPÉ (25%) têm os detalhes do cenário
([TOPO] e [RODAPÉ]); a FAIXA CENTRAL (cerca de 50%) é uma paisagem ampla, suave e calma, sem objetos grandes,
sem rostos e sem pontos de luz forte ([CENTRO]). Sem texto, sem números, sem personagens com rosto, sem moldura.
Paleta dominante: [CORES]. Mantenha exatamente o mesmo estilo, traço e acabamento das imagens de referência.
```

## Prompts por cenário

Em todos, substitua `[ESTILO BASE]` pelo bloco acima e anexe o `map.png` do cenário.

### Jardim do Éden — `eden` (verde `#3fa34d`)
`[ESTILO BASE]` Fundo vertical 9:16 (1080x1920) para a tela de perguntas de um jogo, do cenário bíblico "Jardim do Éden".
Topo: copas de árvores frutíferas com luz dourada filtrando entre as folhas. Rodapé: grama baixa, flores e um riacho
cristalino. Faixa central: uma clareira ampla com névoa dourada suave e gramado aberto. Sem texto, sem personagens com rosto,
sem moldura. Paleta: verdes vivos, dourado suave e toques de rosa. Mesmo estilo e acabamento das imagens de referência.

### Arca de Noé — `arca` (azul `#3b8fb8`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Arca de Noé no Monte Ararate". Topo: céu claro com nuvens macias e um arco-íris
suave. Rodapé: pedras molhadas, lama seca e poças que refletem o céu. Faixa central: águas calmas baixando e colinas distantes,
com a Arca de madeira bem pequena ao longe, no canto, fora do centro. Sem texto, sem rostos. Paleta: azuis, madeira quente,
arco-íris discreto.

### Terra de Canaã — `canaa` (dourado `#c49a3c`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Terra de Canaã". Topo: céu de entardecer com as primeiras estrelas.
Rodapé: terra batida, oliveiras e pequenos rebanhos. Faixa central: colinas douradas suaves e distantes, com uma ou duas
tendas de pastor bem pequenas ao longe, fora do centro. Sem texto, sem rostos. Paleta: dourado, ocre, verde-oliva e azul do
entardecer.

### Egito — `egito` (areia `#d6a540`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Egito". Topo: céu claro e quente com o sol baixo e discreto (sem brilho forte).
Rodapé: dunas, palmeiras e lajes de pedra. Faixa central: dunas suaves e o rio Nilo serpenteando, com pirâmides pequenas no
horizonte, fora do centro. Hieróglifos só como textura nas pedras do rodapé, sem formar texto legível. Sem rostos.
Paleta: areia, ocre, azul-lápis e turquesa.

### Deserto do Sinai — `sinai` (laranja `#c8693a`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Deserto do Sinai". Topo: céu limpo azul-claro com uma coluna de nuvem ao longe.
Rodapé: cascalho, areia e algumas tendas pequenas do acampamento. Faixa central: um vale aberto de dunas suaves, com a montanha do
Sinai ao fundo, bem distante, com uma luz suave no cume. Sem texto, sem rostos. Paleta: laranja queimado, vermelho-terra,
bege e azul-claro.

### Jericó — `jerico` (tijolo `#b5543c`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Jericó". Topo: céu claro e as copas de tamareiras. Rodapé: terra, pedras e
tamareiras de um oásis. Faixa central: uma muralha larga e baixa de tijolos de barro ao longe, com um trecho do muro levemente
rachado e discreto, fora do centro. Sem texto, sem rostos. Paleta: tijolo, terracota e verde de tamareira.

### Templo de Salomão — `templo` (ouro `#e0b43a`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Templo de Salomão". Topo: colunas de bronze e cedros emoldurando a cena, com a
luz quente do fim da tarde. Rodapé: lajes de pedra clara e candelabros dourados pequenos. Faixa central: um pátio amplo de
pedra clara, com a fachada do Templo bem ao longe e suave. Sem texto, sem rostos. Paleta: pedra clara, ouro, cedro e azul-profundo.

### Babilônia — `babilonia` (azul-real `#2f5fb3`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Babilônia". Topo: terraços de jardins suspensos e um zigurate ao fundo.
Rodapé: tijolo esmaltado azul, margem do rio Eufrates e palmeiras. Faixa central: uma muralha azul esmaltada ampla, com relevos
suaves e repetidos de leões e dragões como textura (sem destaque), e o rio ao lado. Sem texto, sem rostos.
Paleta: azul-real, turquesa, ouro e verde dos jardins.

### Mar da Galileia — `galileia` (turquesa `#2aa1c4`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Mar da Galileia". Topo: céu de pôr do sol manso, em laranja e rosa suaves.
Rodapé: margem de pedrinhas, redes secando e a lateral de um barco de pesca de madeira. Faixa central: a água calma do lago com
reflexo suave e colinas verdes distantes, com um ou dois barcos bem pequenos ao longe, fora do centro. Sem texto, sem rostos.
Paleta: turquesa, areia, verde-claro e laranja do pôr do sol.

### Jerusalém — `jerusalem` (violeta `#8e6bd1`)
`[ESTILO BASE]` Fundo vertical 9:16 do cenário "Jerusalém". Topo: céu violeta do amanhecer com uma luz dourada suave.
Rodapé: ruas de pedra clara e oliveiras do Monte das Oliveiras. Faixa central: muralhas e colinas suaves ao longe, com um túmulo
de pedra aberto, bem pequeno e distante, com uma luz dourada discreta, fora do centro. Tom reverente e esperançoso; nada pesado
nem simbólico em excesso (é o fundo de toda pergunta). Sem texto, sem rostos. Paleta: violeta do amanhecer, pedra clara,
verde-oliva e dourado.

## Checklist antes de enviar

- [ ] 1080 × 1920 (9:16), sem texto, sem rostos e sem transparência.
- [ ] Centro calmo e sem objetos grandes; detalhes no topo e no rodapé.
- [ ] Cores saturadas (a película do app suaviza) e contraste médio.
- [ ] Mesmo estilo dos outros cenários (compare lado a lado).
- [ ] Conferido na prévia do painel e no quiz, nos temas claro e escuro.
