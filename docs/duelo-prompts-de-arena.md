# Duelo de Cartas — prompts de imagem das arenas

Cada cenário do Duelo pode ter uma imagem própria (painel → Campanha → cenário → **Imagem no Duelo de Cartas**). Vazia, o jogo usa o mapa do cenário.

## Formato

- **Quadrada, 1024 × 1024 px** (PNG ou JPG; WebP também serve). Fica em torno de 125 × 135 px no celular, cortada para caber (`object-cover`).
- **Composição centralizada**: tudo que importa fica no miolo (cerca de 60% do quadro). As bordas podem ser cortadas.
- **Sem texto, sem letras, sem personagens com rosto, sem moldura e sem estrada/trilha.** O nome e a regra da arena aparecem escritos por cima.
- **Sem objetos pequenos ou detalhes finos**: a imagem aparece pequena e coberta por um degradê escuro (mais escuro em cima e embaixo).
- Tons médios, sem branco puro nem preto puro; um ponto de luz suave no meio.

## Prompt-base (cole antes de cada cenário)

```
Square 1:1 illustration, 1024x1024, stylized semi-realistic digital painting for a mobile card game, biblical setting,
warm rich colors, soft cinematic light, painterly texture. Centered composition with the subject in the middle 60% of the
frame, calm and uncluttered edges, gentle depth of field, medium contrast. NO text, NO letters, NO logos, NO frame or border,
NO people's faces, NO modern objects. Scene:
```

## Cenários

| Cenário | Cena (acrescente ao prompt-base) |
|---|---|
| Jardim do Éden | `lush garden at golden hour, a single tree with glowing red fruit in the center, river and soft mist, flowers and ferns` |
| Arca de Noé | `a huge wooden ark on calm water at dawn, a rainbow arching softly over it, a dove in the distance, pastel sky` |
| Terra de Canaã | `rolling green hills with vineyards and a few shepherd tents, a large cluster of grapes in the foreground, warm sunlight` |
| Egito | `sandy desert at sunset with a pyramid and the Nile in the distance, dry golden haze, a lone palm tree, hot orange sky` |
| Deserto do Sinai | `rocky mountain peak wrapped in dark clouds with a faint lightning glow at the summit, barren desert below, dramatic but calm center` |
| Jericó | `tall ancient stone city walls under a clear sky, a ram's horn lying in the sand in the foreground, dusty warm light` |
| Templo de Salomão | `golden temple interior with tall cedar columns, a seven-branch lamp glowing in the center, warm candle light, rich gold and deep red` |
| Babilônia | `monumental ancient city with blue glazed brick gate and hanging gardens at dusk, a lion statue in the foreground, deep blue and gold` |
| Mar da Galileia | `small wooden fishing boat on a calm sea at sunrise, soft clouds, distant hills, fishing net on the deck, serene teal and peach tones` |
| Jerusalém | `ancient walled city on a hill at golden hour, a white dove flying in the center sky, warm stone buildings, gentle rays of light` |

## Dicas

- Gere em 1024 × 1024; se a ferramenta só faz outras proporções, gere 1:1 com margem e corte o centro.
- Se o resultado vier muito claro ou cheio de detalhes, acrescente `low contrast, simplified shapes, darker edges (vignette)`.
- Mantenha o mesmo estilo nos 10 para a mesa ficar coerente (use a mesma semente/estilo de referência quando a ferramenta permitir).
