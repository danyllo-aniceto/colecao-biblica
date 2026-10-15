# Corrida — prompts prontos (genéricos) para gerar sprites e sons

Copie, troque só o que está entre `{chaves}` e gere. Cada seção é um prompt completo.
Ficha técnica e passo a passo do Painel: `docs/corrida-prompts-de-arte.md`. Estilo base: `docs/prompts-3d-padrao.md`.

## Como trabalhar (ordem que dá mais certo)

1. **Gere a FICHA do personagem primeiro** (prompt 0) e escolha a melhor. Ela é a referência de TODAS as poses (anexe a imagem como referência em cada geração).
2. **Gere UM QUADRO por imagem** (seção "Quadro por quadro" abaixo). É o jeito mais seguro: a IA erra a conta de quadros em tiras.
3. **Nomeie os arquivos na ordem**: `correndo-1.png`, `correndo-2.png`, ... (o Painel ordena pelo nome; dá para reordenar lá também).
4. **Fundo verde chapado (#00FF00)** em tudo. No Painel, ligue **"Remover o fundo verde"** (ou remova por fora, se o personagem tiver roupa verde).
5. **Suba no Painel quadro por quadro:** Painel → Corrida: personagens → Editar → na pose, aba **"Quadro por quadro"** → escolha todos os arquivos da pose de uma vez → confira a prévia animada → **Usar estes quadros**. O Painel monta a tira sozinho (mesma escala, pés na base) e envia. **Tiras de até 6 quadros podem ser enviadas juntas:** escolha o arquivo da tira e, no campo "Quadros nesta imagem" daquele item, informe quantos quadros ela tem (ex.: duas tiras de 6 = 12 quadros, o máximo por pose); o Painel recorta, junta tudo numa tira só e avisa se a imagem não parece ter quadros quadrados.
6. Os quadros podem ser de qualquer tamanho, mas **todos do mesmo tamanho** (ex.: 1024 × 1024, quadrados), personagem de **perfil olhando para a direita** (menos retrato e vitória), **pés encostando na base** da imagem.

---

## Blocos fixos (já vêm dentro dos prompts abaixo; use para montar variações)

**ESTILO**
```
3D animated feature film character in the style of modern Disney / Pixar movies (Encanto, Moana, Tangled, Wish). Stylized cartoon proportions,
slightly larger head, big expressive eyes with bright catchlights, simplified appealing shapes, smooth soft skin, clean readable silhouette,
vibrant saturated colors, soft cinematic lighting, family-friendly, polished 3D render.
```

**FUNDO + NEGATIVOS**
```
Plain flat solid bright green background (#00FF00), no ground, no cast shadow, no floor, no props floating around.
No text, no letters, no numbers, no watermark, no logo, no frame, no border.
No photorealism, no 2D illustration, no flat vector art, no horror, no blood, nothing scary.
```

---

## QUADRO POR QUADRO (recomendado: um quadro por imagem)

**Prompt de um quadro** (troque `{POSE}`, `{N}`/`{TOTAL}` e `{DESCRIÇÃO DO QUADRO}` pela tabela logo abaixo):

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions, same face.
Single animation frame ({N} of {TOTAL}) of the "{POSE}" animation of {PERSONAGEM}. {DESCRIÇÃO DO QUADRO}
One single character only, centered in a square image, full body, {side view facing right | facing the camera}, feet touching the bottom edge of the image,
the character fills about 85% of the image height. Same scale and same camera distance as the other frames of this animation.
{ESTILO}
{FUNDO + NEGATIVOS}
```

**Descrições de cada quadro** (cole no lugar de `{DESCRIÇÃO DO QUADRO}`):

| Pose | Qtde | Quadro a quadro |
|---|---|---|
| **Retrato** | 1 | `Friendly portrait pose facing the camera at a slight three-quarter angle, big smile, one hand waving.` |
| **Parado** | 4 | 1: `Idle standing pose, relaxed, chest slightly lowered after exhaling, arms hanging naturally, gentle smile.` · 2: `Idle standing pose, inhaling: chest slightly raised, shoulders rising a little, same stance.` · 3: `Idle standing pose, full inhale: chest at its highest, head very slightly up, clothing hem lifting a tiny bit.` · 4: `Idle standing pose, exhaling: chest lowering, shoulders relaxing, clothing settling, between frame 3 and frame 1.` (Em TODOS: `side view facing right`, pés **exatamente** no mesmo lugar e na mesma posição; só o tronco, os ombros e o tecido se mexem.) |
| **Correndo** | 4 | 1: `Run cycle, contact pose: right foot forward, left arm forward, body slightly low.` · 2: `Run cycle, passing pose: legs crossing under the body, body at its highest, arms mid-swing.` · 3: `Run cycle, contact pose: left foot forward, right arm forward, body slightly low.` · 4: `Run cycle, passing pose: legs crossing under the body, body at its highest, arms mid-swing (opposite to frame 2).` |
| **Correndo** | 6 | Os 4 acima + intercalar `down pose (body lowest, knee bent absorbing the step)` entre o 1 e o 2 e entre o 3 e o 4. |
| **No ar** | 3 | 1: `Jumping up, both arms raised, knees tucked.` · 2: `At the top of the jump, body stretched, clothing floating.` · 3: `Falling, legs reaching down, arms slightly out.` (Se quiser só 1 quadro: use o 1.) |
| **Voando** | 2 | 1: `Gliding, body horizontal and streamlined, arms forward, {manto/véu/túnica} streaming behind.` · 2: `Same gliding pose, the flowing cloth slightly higher than in frame 1.` |
| **Voando** | 4 | Os 2 acima + 3: `Gliding, cloth at its lowest point` + 4: `Gliding, cloth at mid height, going up`. |
| **Gravidade** | 2 | 1: `Standing firmly in a "magnetic boots" pose: knees slightly bent, arms out for balance, determined happy face.` · 2: `Same pose with a tiny weight shift, clothing swaying slightly.` |
| **Caindo** | 3 | 1: `Surprised face, arms flailing.` · 2: `Tipping over backwards, eyes squeezed shut.` · 3: `Sitting dazed on the ground, little cartoon stars circling the head, harmless and funny.` |
| **Vencendo** | 4 | 1: `Facing the camera, arms down, big smile.` · 2: `Facing the camera, arms raised high, cheering.` · 3: `Facing the camera, small happy jump, feet off the ground.` · 4: `Facing the camera, arms raised again, cheering.` |

> **Dica de consistência:** gere todos os quadros de uma pose na mesma sessão, com a ficha anexada, e mantenha a mesma distância de câmera. Se um quadro sair com o personagem maior/menor, refaça só esse quadro.

---

## IMAGENS EM TIRA (opcional: se a sua ferramenta acerta tiras de quadros)

Os prompts abaixo geram a pose inteira numa tira horizontal. Só use se a IA estiver acertando a contagem e a consistência; senão, prefira "Quadro por quadro". Pode subir a tira na aba "Quadro por quadro" informando quantos quadros ela tem (dá para misturar tiras e quadros soltos, até 12 no total).

### 0) Ficha do personagem (referência — gere esta primeiro)

```
Character turnaround reference sheet of {PERSONAGEM}: {descrição: idade aproximada, cabelo, barba, rosto, túnica/manto, cores principais, objeto simbólico}.
Three full-body views side by side on one image: front view, side view facing right, back view. Neutral standing pose, arms relaxed, same scale and
same baseline, feet at the same height.
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 1) Retrato (1 quadro, aparece no cartão de escolha)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions.
Full-body character portrait of {PERSONAGEM}, facing the camera at a slight three-quarter angle, friendly smile, one hand waving, confident welcoming pose.
Single image, centered, character fills about 85% of the height, feet at the bottom edge.
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 1b) Parado (2 a 6 quadros em ciclo de respiração)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM}: an idle breathing loop in {4} frames side by side in one single row, equal square frames, same scale,
full body, side view facing right, standing still. The feet stay in EXACTLY the same position in every frame; only the chest, shoulders, head and clothing move slightly.
Frame 1: relaxed, chest slightly lowered. Frame 2: inhaling, chest slightly raised. Frame 3: full inhale, chest at its highest, head very slightly up.
Frame 4: exhaling, chest lowering, clothing settling. The last frame flows smoothly into the first (loop). Gentle smile.
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 2) Correndo (4 a 6 quadros em ciclo)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM}: a run cycle in {4 ou 6} frames side by side in one single row, equal square frames, same scale,
feet touching the same baseline in every frame, full body, side view facing right.
Frame order: right foot forward (contact), body low (down), passing pose, left foot forward (contact), body low (down), passing pose.
The body bobs slightly up and down, arms swing opposite to the legs, clothing flutters back. The last frame flows smoothly into the first (loop).
{ESTILO}
{FUNDO + NEGATIVOS}
```
> Com 4 quadros, use só: pé direito à frente, passagem, pé esquerdo à frente, passagem.

### 3) No ar (1 a 3 quadros: subindo, topo, caindo)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM}: {1 ou 3} frames side by side in one row, equal square frames, same scale, full body, side view facing right.
Frame 1: jumping up, both arms raised, knees tucked. {Frame 2: at the top of the jump, body stretched, clothing floating. Frame 3: falling, legs reaching down, arms slightly out.}
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 4) Voando (2 a 4 quadros em ciclo)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM} flying: {2 ou 4} frames side by side in one row, equal square frames, same scale, full body, side view facing right,
body horizontal and streamlined like gliding, arms forward, {manto / véu / túnica / cabelo} streaming behind and moving in the wind.
{Se tiver uma montaria ou objeto que combine com a história, descreva aqui: "riding a small chariot of fire" / "carried by a friendly wave of water" ...}
Frame 2 has the flowing cloth slightly higher than frame 1 so the loop looks like waving. Looping animation.
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 5) Gravidade (1 a 4 quadros — o jogo vira de cabeça para baixo sozinho)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM}: {2} frames side by side in one row, equal square frames, same scale, full body, side view facing right,
standing firmly on the ground in a "magnetic boots" pose: knees slightly bent, arms out for balance, determined happy face, clothing hanging normally.
Frame 2 shows a tiny weight shift (clothing sways). Feet on the same baseline.
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 6) Caindo (1 a 3 quadros, toca uma vez)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM}: {3} frames side by side in one row, equal square frames, same scale, full body, side view facing right.
Comical harmless tumble: frame 1 surprised face, arms flailing; frame 2 tipping over backwards, eyes squeezed shut; frame 3 sitting dazed on the ground with little cartoon stars circling the head.
Funny and charming, no injury, nothing scary.
{ESTILO}
{FUNDO + NEGATIVOS}
```

### 7) Vencendo (2 a 6 quadros em ciclo, de frente)

```
Use the attached character sheet as the exact reference. Same character, same outfit, same proportions in every frame.
Horizontal sprite sheet of {PERSONAGEM}: {4} frames side by side in one row, equal square frames, same scale, full body, facing the camera.
Victory celebration loop: frame 1 arms down and big smile; frame 2 arms raised high; frame 3 small happy jump, feet off the ground; frame 4 arms raised again.
Joyful, grateful, dignified, family-friendly. Feet on the same baseline in frames 1, 2 and 4.
{ESTILO}
{FUNDO + NEGATIVOS}
```

---

## SONS (ferramentas de voz e efeitos: ElevenLabs, Suno SFX, Stable Audio...)

Todos **curtos (menos de 2 s)**, **sem música de fundo**, **sem eco**, formato MP3/WAV, até 12 MB. Para voz, use a **mesma voz** nos 7 sons do personagem.

**Voz base (defina uma vez e reuse):** `{tipo de voz: criança / jovem / adulto / idoso; masculina ou feminina; tom alegre, caloroso, animado}`

1. **Pulo** — `Very short cheerful cartoon voice saying "hup!", {VOZ BASE}, energetic, family-friendly, clean, no background noise, no music, 0.4 seconds.`
2. **Pulo duplo** — `Very short cheerful cartoon voice saying "hup-hup!" with the second hup higher in pitch, {VOZ BASE}, energetic, clean, no background noise, no music, 0.6 seconds.`
3. **Palavra (pegou uma palavra do versículo)** — `Short magical sparkle chime, two rising notes like a glockenspiel, bright and rewarding, clean, no reverb tail, no music, 0.6 seconds.` (Opção com voz: `"olha só!"`, {VOZ BASE}, 0.7 segundos.)
4. **Inverter a gravidade** — `Short playful whoosh with a quick rising pitch and a tiny "pop" at the end, cartoon style, clean, no music, 0.5 seconds.` (Opção com voz: `"uáu!"`, {VOZ BASE}.)
5. **Checkpoint (bandeira)** — `Very short happy two-note fanfare on a small trumpet, triumphant but tiny, clean, no reverb tail, no music, 0.8 seconds.` (Opção com voz: `"marcado!"`.)
6. **Queda (errou)** — `Short comical harmless "oops!" cartoon voice, {VOZ BASE}, funny and soft, not scary, followed by a tiny soft bump sound, clean, no background noise, 0.8 seconds.`
7. **Vitória** — `Short joyful celebration: a cheerful cartoon voice shouting "isso!" followed by a bright three-note fanfare, {VOZ BASE}, family-friendly, clean, no background noise, 1.5 seconds.`

---

## Lista de conferência por personagem

- [ ] Ficha (0) aprovada
- [ ] Retrato (1 quadro)
- [ ] Parado (4 quadros, respirando; pés fixos)
- [ ] Correndo (4–6 quadros)
- [ ] No ar (1–3)
- [ ] Voando (2–4)
- [ ] Gravidade (1–4)
- [ ] Caindo (1–3)
- [ ] Vencendo (2–6)
- [ ] 7 sons (mesma voz)
- [ ] Cadastrado no Painel → Corrida: personagens, aba "Quadro por quadro" em cada pose (a quantidade de quadros é preenchida sozinha)

## Quando for um personagem específico

Me diga o nome e eu preencho `{PERSONAGEM}`, `{descrição}`, o objeto simbólico, a pose de voo que combina com a história e a voz base. Os 6 padrão já cadastrados: Davi, Débora, Elias, Ester, Jonas e Daniel.
