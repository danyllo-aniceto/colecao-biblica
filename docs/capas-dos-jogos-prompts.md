# Capas dos jogos (aba Jogar) — formato e prompts de imagem

A aba **Jogar** mostra um cartão explicativo para cada jogo: **Quiz Bíblico**, **Tabuleiro** e **Duelo de Figurinhas**. Cada cartão tem uma imagem de capa,
enviada em **Painel → Capas dos jogos**. Sem imagem, o app usa um fundo colorido padrão.

## Formato

- **Horizontal 16:10, 1600 × 1000 px** (o mínimo aceitável é 1200 × 750). PNG, JPG ou WebP; o painel reduz sozinho o que passar de 4 MB.
- O título do jogo é **escrito pelo app por cima da parte de baixo** da imagem (com um degradê escuro nos 40% inferiores). Por isso:
  - **sem texto, letras, números ou logotipos na imagem**;
  - **o assunto principal fica no centro e na metade de cima** (a faixa inferior deve ser calma, sem detalhe importante);
  - as bordas podem ser cortadas em telas diferentes (celular e computador): nada essencial a menos de 8% das bordas.
- Mesmo estilo dos cenários, ícones e capas: **3D de filme de animação, cores vivas e saturadas**, luz quente de fim de tarde, sem humanos.

## Bloco de estilo (cole no começo de cada prompt)

```
Create a horizontal 1600×1000 px, 16:10 FULL 3D ILLUSTRATION for a polished biblical adventure game.

The entire image must be rendered as a high-quality stylized 3D animated feature-film scene, visually consistent with modern Disney/Pixar-style animated movies such as Encanto, Moana, Tangled and Wish.

IMPORTANT STYLE REQUIREMENT:
The ENTIRE IMAGE must be fully 3D. Every object must have visible 3D volume, modeled geometry, depth, polished materials and cinematic lighting.
DO NOT create a 2D illustration. DO NOT use a flat painted look. DO NOT make it look like concept art. DO NOT use flat graphic shapes.

COLORS: VIVID, SATURATED, JOYFUL colors. Rich golden light, deep saturated greens, warm terracotta, bright royal blue sky, glowing amber highlights.
Never muted, never grey, never dull.

COMPOSITION: the main subject sits in the CENTER and in the UPPER HALF of the frame. The LOWER 40% of the frame stays calm and simple (soft ground, soft shadow, gentle gradient) because a title will be written over it by the app.
Strong depth and perspective, a slightly elevated three-quarter camera, warm late-afternoon sunlight from one side, volumetric light rays, soft cinematic shadows, ambient occlusion.

VISUAL QUALITY: premium 3D animated feature-film look, rounded cinematic forms, polished stone, wood, gold, fabric and vegetation materials, handcrafted details, family-friendly biblical adventure atmosphere.

NO text. NO letters. NO numbers. NO words. NO watermark. NO logos. NO UI. NO frame. NO border.
NO flat painted background. NO 2D illustration. NO watercolor. NO photorealism. NO modern objects.
NO horror. NO blood. NO dark demonic imagery. NO human characters. NO faces.

SCENE:
```

## 1. Quiz Bíblico — `QUIZ`

```
A huge ancient open book with thick golden-edged pages rests on a carved limestone pedestal in the center, glowing with warm golden light that rises from its pages in sparkling rays. Around it float a few rolled parchment scrolls with golden ribbons, a brass oil lamp with a bright flame, an hourglass with glowing sand, and a small ornate wooden treasure chest bursting open with colorful collectible sticker cards (rounded rectangles with glossy gold borders and bright blank art) flying out in a spiral. Olive branches and bright flowers frame the pedestal on both sides. Behind it, a luminous sunrise sky with soft clouds and distant green hills. Joyful, magical, inviting mood of learning and discovery.
```

## 2. Tabuleiro — `BOARD`

```
A beautiful 3D diorama game board seen from an elevated three-quarter angle: a wide winding stone-and-earth path with evenly spaced round stepping tiles in bright colors curves across lush green hills, passing small stylized ancient villages, an olive grove and a tiny fortified gate at the far end. In the foreground-center, four glossy wooden pawn pieces in vivid red, blue, yellow and green stand on the path (simple round-headed game pawns, NOT people), and a big carved wooden dice with golden dots floats in the air mid-roll with a small burst of golden sparkles. Colorful triumph flags wave on small poles beside the path. Soft golden sunlight, bright blue sky, fluffy clouds. Playful, adventurous, friendly mood.
```

## 3. Duelo de Figurinhas — `DUEL`

```
Three glowing circular stone arenas in a row on a polished temple courtyard, seen from an elevated three-quarter angle, each lit in a different vivid color (emerald green, royal blue and warm amber). Above each arena hover and fly large collectible sticker cards (rounded rectangles with ornate glossy golden borders, shiny holographic shimmer and bright blank artwork areas) in a dynamic fan, as if being played; two rival groups of three cards face each other from the left and right sides of the center arena. Golden magical sparks and soft light trails connect the cards to the arenas. Ancient limestone columns, olive branches, banners without symbols and a luminous sky with golden clouds in the background. Exciting, strategic, festive mood of a friendly duel.
```

## Dicas

- Se a IA gerar texto ou números nas figurinhas, acrescente `all sticker cards have completely blank, text-free faces`.
- Se a parte de baixo vier cheia de detalhe, acrescente `the bottom 40% is an empty soft warm gradient ground`.
- Para os três ficarem parecidos, use a mesma ferramenta, o mesmo bloco de estilo e, se der, a mesma referência de estilo.

## Imagem ao compartilhar o link do app

Painel → **Compartilhar o app** mostra o link `/api/compartilhar`: quem o recebe no WhatsApp, Telegram ou redes vê um cartão com a imagem e o texto
que explicam o app (e quem abre cai na página inicial). A imagem padrão (`frontend/public/compartilhar.jpg`, 1200 × 630) é gerada de
`frontend/scripts/imagem-compartilhar/modelo.html` (logo, três jogos e "Jogue grátis!"); para refazer: `node scripts/imagem-compartilhar/gerar.mjs`
(precisa do Playwright). Dá para trocar por outra imagem no painel (1200 × 630, de preferência com menos de 300 KB). A página inicial também tem as
tags de compartilhamento; na Vercel o endereço vem do domínio de produção (ou da variável `SITE_URL`).
