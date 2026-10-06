# Padrão de prompts de arte — estilo 3D animado (Disney/Pixar)

Este é o **molde único** de todas as imagens do app a partir da campanha das 12 Pedras. Os guias antigos
(`campanha-prompts-de-arte.md`, `quiz-fundos-prompts-de-arte.md`, `tabuleiro-prompts-de-arte.md`, ...) ainda falam em
"2D semi-flat com textura de papel": **para arte nova vale este documento**.

> Quando pedirem "me dá o prompt de X para o cenário Y", basta preencher os blocos abaixo com o lugar, a paleta e a
> composição do cenário. Os blocos em **MAIÚSCULAS** são fixos; só o que está entre `{chaves}` muda.

## 1. Blocos fixos

**ESTILO (cenários, mapas, fundos, banners, capas)** — abre todo prompt de ambiente:

```
3D animated feature film environment in the style of modern Disney / Pixar animated movies, with the visual feeling
of Encanto, Moana, Tangled and Wish. Stylized cartoon 3D proportions, rounded appealing shapes, clean readable
silhouettes, polished cinematic 3D render, vibrant saturated colors, soft cinematic lighting, warm golden
illumination coming from the upper-left corner, gentle shadows, subtle ambient occlusion, smooth {materiais do
cenário} materials, charming handcrafted details.
```

**ESTILO (personagem)** — abre todo prompt de figurinha/personagem:

```
3D animated feature film character in the style of modern Disney / Pixar movies (like Encanto, Moana, Tangled, Wish).
Stylized cartoon proportions: slightly larger head, big expressive eyes with bright catchlights, simplified and
appealing facial shapes, smooth soft skin with gentle subsurface glow, clean readable silhouette. Soft cinematic
lighting, vibrant saturated colors, warm, peaceful and dignified mood. The background is a painted 2D concept-art
backdrop with soft shapes and simplified details, contrasting with the 3D character. Family-friendly, charming,
polished 3D render.
```

**ESTILO (peão/objeto/ícone)**:

```
3D animated feature film prop in the style of modern high-end animated movies, with the visual feeling of Encanto,
Moana, Tangled and Wish. Stylized cartoon 3D proportions, rounded appealing shapes, clean readable silhouette,
polished cinematic 3D render, vibrant harmonious colors, soft cinematic lighting, warm golden illumination, gentle
shadows, subtle ambient occlusion, smooth materials and charming handcrafted details.
```

**NEGATIVOS comuns** (fecham todo prompt; some os específicos de cada peça):

```
No text, no letters, no numbers, no words, no watermark, no logos, no frame, no border.
No photorealism. No 2D illustration. No flat vector art. No semi-flat art. No paper texture.
No visible detailed faces (people only as tiny distant silhouettes). No horror, no dark gritty atmosphere.
```

Regras que se repetem em todos: **sem texto/letras/números**, **sem rosto detalhado** em cenário, **nenhuma imagem
realista de Jesus**, tom respeitoso e para todas as idades, **sem branco puro nem preto puro** (contraste médio),
formas grandes e legíveis (o jogo é no celular).

## 2. Peças de um cenário (formato de cada uma)

| Peça | Onde entra | Formato | Cuidados de composição |
|---|---|---|---|
| **Mapa do caminho** | Campanha (`mapImageUrl`) | 3:4, 1536×2048 | Vista elevada ¾; **caminho largo em zigue-zague de baixo para cima, totalmente livre**; destino (portão/monumento) no topo; elementos só nas laterais; topo e rodapé mais suaves |
| **Ícone do cenário** | Campanha + avatar (`iconImageUrl`) | 1:1, 512×512 | Emblema único ocupando ~70% e centrado (vira avatar redondo); fundo sólido da cor do cenário com gradiente quase imperceptível; opaco |
| **Fundo do quiz** | `quizBackgroundUrl` | 9:16, 1080×1920 | **Centro largo, calmo e limpo** (pergunta); detalhes em ~20% topo e ~25% rodapé; funciona também recortado na faixa central (desktop); sem personagens; opaco |
| **Imagem do duelo** | `duelImageUrl` (arena) | 1:1, 1024×1024 | Cena centralizada ocupando 60–70%; formas grandes; sem pessoas/rosto; sem estrada |
| **Terreno do tabuleiro** | `boardImageUrl` | 9:16, 1080×1920 | **Vista 100% de cima**, sem horizonte/céu; centro ~70% calmo e sem objetos; detalhes só nas margens (~15% cada lado); sem estrada/caminho/casas (o app desenha a trilha); sem "em cima/embaixo" (será espelhada) |
| **Música do tema** | `musicUrl` | MP3 instrumental em loop | Ver `campanha-prompts-de-musica.md` |
| **Banner** | perfil/eventos | 8:3, 1600×600 | Lado esquerdo escuro e vazio (camada translúcida da interface); detalhes à direita |
| **Fundo de perfil** | cosmético `PROFILE_BG` | 2:1, 1600×800 | Terço esquerdo calmo (ícone e nome do jogador); luz e riqueza à direita |
| **Capa de álbum** | cosmético `ALBUM_COVER` | 2:3, 1200×1800 | Cena na metade superior/central; **terço inferior escuro e quase vazio** (o app põe texto) |
| **Peão do tabuleiro** | cosmético `PAWN` | 1:1, 512×512 PNG **transparente** | Objeto sobre base redonda de ficha, ~80% do quadro, vista levemente de cima, flutuando, sem sombra projetada, legível em tamanho pequeno |

## 3. Esqueleto de cada peça

Preencha `{...}`; o resto é fixo. (Todos terminam com os NEGATIVOS comuns + os específicos da peça.)

### 3.1 Mapa do caminho

```
{ESTILO ambiente}

The environment should feel like it belongs to the same animated universe as high-quality 3D animated feature film
characters. Foreground and middle-ground elements are fully stylized 3D, while distant structures and sky have the
appearance of a painted 2D concept-art backdrop.

VERTICAL MOBILE GAME MAP, exact 1536x2048 pixels, 3:4 aspect ratio.
Create a spectacular stylized 3D environment representing {lugar}.
Use an elevated three-quarter game-map perspective.
Show {elementos marcantes do lugar, 3 a 5 itens}.
In the distance, show {elemento grandioso ao fundo}.
The MOST IMPORTANT STRUCTURAL ELEMENT is a wide MAIN PATH made from {material do caminho}.
The path begins near the bottom and travels upward through a clearly visible zig-zag pattern.
KEEP THE MAIN PATH COMPLETELY CLEAR AND UNOBSTRUCTED. Do not place large buildings, trees, statues or other major
elements directly on the path.
Near the top, create {destino: portão/monumento/relíquia}. It is the main destination and strongest focal point.
Place {vegetação, construções pequenas, água} mainly along the sides.
Use cinematic {luz do cenário}, soft shadows and atmospheric depth.
Color palette: {5 cores}.
Overall mood: {5 adjetivos}.
```

### 3.2 Fundo do quiz

```
{ESTILO ambiente}
Create a VERTICAL 9:16 BACKGROUND, exact 1080x1920 pixels.
Use the attached campaign map.png as a reference for the LOCATION, ENVIRONMENT, COLOR PALETTE and VISUAL IDENTITY.
Use the approved Garden of Eden background as a composition and rendering reference.
IMPORTANT: maintain EXACTLY the same 3D animated feature film style, rendering quality, materials, lighting language
and overall finish as the reference images.
BIBLICAL ENVIRONMENT: {LUGAR}.
COMPOSITION: Keep the CENTER wide, calm and visually uncluttered for quiz content.
TOP 20%: {elementos altos/distantes}.
CENTER 55%: {elemento largo e monumental, repetição sutil, detalhes pequenos e secundários}.
BOTTOM 25%: {chão, água, vegetação, cores ricas}.
Use {paleta}. The scene should feel {clima}.
No large characters. No visible faces. No transparency. Full opaque background.
The composition must work both as a full mobile 9:16 background and when cropped to the central horizontal area on
desktop screens.
```

### 3.3 Imagem do duelo (arena)

```
{ESTILO ambiente, com "smooth {material} materials"}
Create a SQUARE 1:1 ARENA IMAGE, exact 1024x1024 pixels.
CENTERED SCENE: {cena central}, forming the main composition, occupying approximately 60–70% of the frame.
{um único elemento de destaque no céu/centro, como silhueta simples}. Soft {luz} passing through the atmosphere.
Keep the architecture simplified with large readable shapes rather than many tiny details.
The overall atmosphere should feel {clima}.
No people, no faces, no road, no modern objects, no pure white, no pure black. Medium contrast, simplified shapes and
clean mobile-friendly composition.
```

### 3.4 Terreno do tabuleiro (vista de cima)

```
Create a 1080×1920 px vertical 9:16 game board background, no transparency, inspired by a premium 3D animated
feature-film environment (Encanto, Moana, Tangled, Wish).
The scene represents {tema}, viewed from a perfectly vertical top-down perspective. The camera is directly above,
looking straight down. No horizon, no sky, no perspective angle.
The central 70% is dominated by {superfície calma: água/areia/relva/pedra lisa}, pristine, smooth, low-contrast,
with no objects in it.
Along the left and right outer margins (~15% each side) add composed details: {3 a 4 elementos decorativos}.
There must be no road, no path, no trail, no bridge, no buildings, no people, no faces, no animals, no clutter, no
game-board spaces, no arrows, no numbers, no letters, no text, no logos, no watermark and no decorative frame.
The image must have no obvious top or bottom, so it can be flipped or mirrored without looking strange.
Color palette: {paleta}.
Negative prompt: photorealism, 2D illustration, semi-flat art, vector art, paper texture, clutter, horizon, sky,
perspective view, {o que não pode aparecer no tema}.
```

### 3.5 Ícone do cenário / emblema

```
{ESTILO objeto}
Create a SQUARE PROFILE ICON, exact 512x512 pixels.
{o emblema: objeto principal + detalhe luminoso}, warm, {clima}, with {materiais} and subtle {cor} illumination.
It forms one cohesive emblem occupying approximately 70% of the canvas, centered perfectly, highly recognizable when
cropped into a circular player avatar.
BACKGROUND: solid {cor do cenário} (approximately {#hex}) with an extremely subtle cinematic gradient and soft
atmospheric glow behind the emblem.
No transparency. No text, letters, numbers, words, watermark, logo or decorative frame.
The final result should look like a premium 3D collectible profile icon from a polished Bible-themed adventure game.
```

### 3.6 Banner / fundo de perfil / capa de álbum

Mesmo bloco de ambiente + "BIBLICAL THEME: "{tema}"" + descrição da cena + **COMPOSITION** (onde fica o vazio, ver
tabela da seção 2) + **PALETTE**. Banner: `horizontal 8:3 BANNER, exact 1600x600`; perfil: `horizontal 2:1 PROFILE
BACKGROUND, exact 1600x800`; capa: `vertical 2:3 ALBUM COVER, exact 1200x1800`, "premium collectible Bible album
illustration".

### 3.7 Peão do tabuleiro (em português, PNG transparente)

```
Peão de jogo de tabuleiro em estilo 3D animated feature film, inspirado visualmente em animações modernas de alta
qualidade como Encanto, Moana, Tangled e Wish. {O objeto/animal estilizado}, pousado sobre a base redonda de ficha,
representando {significado}. {Formas e detalhes simplificados}. Vista levemente de cima, com perspectiva suave de
brinquedo colecionável. Silhueta forte, simples e extremamente legível mesmo em tamanho pequeno, poucos detalhes,
formas arredondadas, materiais suaves e polidos, cores sólidas e harmoniosas, brilho cinematográfico suave no canto
superior esquerdo e uma base redonda de ficha elegante. Base em tom {cor}. Objeto centralizado, ocupando
aproximadamente 80% do quadro. Fundo totalmente transparente, sem sombra projetada, sem chão, objeto flutuando, sem
texto, sem letras, sem números, sem símbolos, sem personagens humanos, sem moldura, 512×512 px, PNG.
```

### 3.8 Personagem (figurinha)

Seções, nesta ordem. A parte que mais importa é **FACE DESIGN + IMPORTANT CHARACTER DESIGN**: cada personagem precisa
de uma identidade facial única e dizer explicitamente que não repete a de nenhum outro.

```
{ESTILO personagem}

CAMERA:
Vertical 3:4 composition. Medium close-up, waist-up framing, character fills approximately 75% of the image. Slight
three-quarter view from a little below eye level, {efeito: calm and patriarchal presence...}. Body turned slightly to
the side while the face looks toward something off-camera, not directly at the viewer. Keep the entire head inside the
frame with a small amount of space above it.

CHARACTER:
{Nome, quem é na Bíblia, idade aparente, pele (tom quente, sem traços europeus), cabelo, barba, olhos}.
{Roupas da época, tecidos artesanais, cores, acessórios; sem anacronismo}.

FACE DESIGN:
Create a completely distinctive facial identity for {Nome}, clearly different from {lista de personagens já feitos}.
{Formato do rosto; testa e linha do cabelo; sobrancelhas; olhos (forma, distância, pálpebras); nariz (forma
específica, "avoid a generic nose"); maçãs do rosto; mandíbula; queixo; lábios e uma leve assimetria memorável;
rugas coerentes com a idade}.
Overall facial identity: {resumo em uma frase de 6 a 8 traços}. {Emoção que o rosto transmite}.

ACTION: {o que faz, objeto na mão, postura, expressão}.
BACKGROUND: {cenário pintado em 2D, simplificado e desfocado, para o 3D ser o foco}.
COLOR ACCENT: {paleta da figurinha}.
LIGHTING: {luz lateral, realce em cabelo/barba/maçãs, luz de contorno, sombras suaves}.

IMPORTANT CHARACTER DESIGN:
{Nome} must have a highly recognizable facial identity that does not resemble any previously generated biblical
character. Do NOT reuse facial proportions, eye shape, nose structure, cheekbone placement, jawline, chin shape,
eyebrow design or mouth structure from {lista}. {Traços-âncora repetidos aqui}.

NEGATIVE:
No European/Nordic facial features, no pale white skin, no blue eyes, no blond hair, no medieval European clothing,
no Roman clothing (salvo se for romano), no modern clothing, no crown/royal jewelry (salvo se for rei), no fantasy
armor, no modern objects, no exaggerated muscles, no generic biblical character face, no duplicated facial structure,
no photorealism, no anime, no 2D character, no horror, no dark fantasy.

{linha de palavras-chave: animated movie still, medium close-up, waist-up, {período}, {Nome}, biblical character,
Middle Eastern appearance, {objetos}, {lugar}, expressive face, cinematic lighting, polished 3D cartoon character,
Disney Pixar style}
```

Exemplo completo aprovado: **Isaque** (rosto oval longo, olhos próximos e caídos, nariz longo e estreito de ponta
levemente caída, queixo proeminente arredondado, boca levemente assimétrica; túnica creme, manto marrom-avermelhado,
cajado de pastor junto a um poço, acampamento patriarcal ao entardecer).

## 4. Dicas de consistência

- Gere primeiro o **mapa** e anexe-o como referência no **fundo do quiz**, no **ícone** e na **arena do duelo** do mesmo
  cenário ("use the attached campaign map as reference for LOCATION, PALETTE and VISUAL IDENTITY").
- Anexe também um cenário já aprovado (Éden) como referência de **acabamento**.
- Cada cenário tem uma **paleta de 4 a 5 cores** que se repete em todas as peças dele (mapa, ícone, quiz, duelo,
  tabuleiro, música com o mesmo clima).
- Peças com área vazia reservada para a interface (banner, perfil, capa, quiz) precisam dizer **onde** o vazio fica.
