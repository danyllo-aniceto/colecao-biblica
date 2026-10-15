# Corrida — guia de arte dos personagens (sprites) e sons

Tudo é enviado pelo **Painel → Corrida: personagens** (sem mexer no código). Sem sprite, o jogo desenha um quadrado na cor de reserva; sem som, toca o som padrão do modo.
O estilo segue o **molde único** de `docs/prompts-3d-padrao.md` (3D animado estilo Disney/Pixar, família, sem texto).

## 0. Jeito mais fácil: um quadro por imagem

No Painel, em cada pose, a aba **"Quadro por quadro"** recebe vários arquivos de uma vez (um por quadro, na ordem do nome do arquivo), mostra a prévia animada, **tira o fundo verde #00FF00** se você ligar a opção e monta a tira sozinho (mesma escala, pés na base). Os prompts por quadro estão em `docs/corrida-prompts-prontos.md`. **Tiras de até 6 quadros podem ser enviadas juntas** na mesma aba: em cada arquivo, o campo "Quadros nesta imagem" diz quantos quadrados a tira tem (duas tiras de 6 = 12 quadros, o máximo por pose); o Painel recorta, junta e avisa se a largura não divide pelo número de quadros ou se o quadro não é quadrado. A ficha abaixo vale para quem preferir enviar a tira já pronta.

## 1. Ficha técnica dos sprites

- **Uma imagem por pose**, com os **quadros lado a lado** numa tira horizontal; todos os quadros **quadrados e do mesmo tamanho**.
- **256 × 256 px por quadro**; no máximo **6 quadros por imagem** (6 × 256 = 1536 px; o envio reduz imagens acima de 1600 px, o que só deixaria os quadros menores).
- **Fundo transparente** (PNG ou WebP). IA costuma entregar fundo sólido: peça **fundo verde-limão chapado (#00FF00)** ou cinza liso e depois remova o fundo (remove.bg, Photoroom...).
- **De perfil, olhando para a direita** (o jogo corre para a direita). Nada de sombra no chão, texto ou moldura.
- **Pés sempre na base do quadro**, no mesmo lugar em todos os quadros e poses; a cabeça cabe com ~10% de folga. O personagem ocupa uns 85% da altura do quadro.
- O jogo desenha o sprite com ~48 px de altura na fase (a caixa de colisão é 32 px), então **silhueta grande e legível** vale mais que detalhe fino.
- Cuidado com **consistência** entre quadros: gere primeiro a **ficha do personagem** (frente, perfil, costas) e use-a como referência para todas as poses.

| Pose | Quadros | O que mostrar |
|---|---|---|
| **Retrato** | 1 | Corpo inteiro (ou meio corpo), de frente/¾, sorrindo. Aparece no cartão de escolha. Opcional: sem ele usa a corrida. |
| **Parado** | 2 a 6 (4) | De perfil olhando para a direita, em pé, **respirando** (ciclo de 4 quadros: o tronco sobe e desce um pouco). **Os pés ficam exatamente no mesmo lugar em todos os quadros.** Aparece antes da largada, na escolha do personagem e sempre que ele está no chão sem andar. Sem esta pose, o jogo usa o 1º quadro de "Correndo", parado. |
| **Correndo** | 4 a 6 | Ciclo de corrida em loop (o último quadro emenda no primeiro). |
| **No ar** | 1 a 3 | Pulando/caindo, braços para cima ou abertos. |
| **Voando** | 2 a 4 | Planando de lado (capa/manto ao vento, ou em cima de algo que combine com a história). Ciclo curto. |
| **Gravidade** | 1 a 4 | Pose "colada" no chão. No teto o jogo vira a imagem de cabeça para baixo sozinho. |
| **Caindo** | 1 a 3 | Tropeçando/desmontando (cômico, sem sangue nem susto). Toca uma vez. |
| **Vencendo** | 2 a 6 | Comemorando de frente (aparece na tela de resultado, em ciclo). |

## 2. Prompt de cada pose

Abra com o bloco **ESTILO (personagem)** de `docs/prompts-3d-padrao.md` e preencha:

```
{PERSONAGEM}: {descrição: idade, cabelo, barba, túnica/manto, cores, objeto simbólico}.
Horizontal sprite sheet, {N} frames side by side in a single row, equal square frames, same character in every frame, same scale,
feet on the same baseline, full body, side view facing right (except the portrait and win poses, which face the camera).
Pose sequence: {descrição dos quadros: "run cycle, contact - passing - contact - passing" / "jumping up, arms raised" / ...}.
Plain flat bright green background (#00FF00), no ground, no shadow, no text, no letters, no numbers, no watermark, no frame, no border.
No photorealism, no flat vector art, no horror. Family-friendly.
```

Exemplos de `{descrição dos quadros}`:

- **Correndo (4):** `run cycle in 4 frames: right foot forward, passing pose, left foot forward, passing pose; the body bobs slightly up and down`.
- **No ar (1):** `mid-air jump pose, both arms raised, knees tucked`.
- **Voando (2):** `gliding pose, cloak flowing back, frame 2 with the cloak slightly higher than frame 1`.
- **Caindo (1):** `comically tumbling backwards, dizzy stars, eyes squeezed shut`.
- **Vencendo (4):** `celebration in 4 frames: arms down, arms up, jump, arms up again; big smile, facing the camera`.

Ideia de pose "Voando" por personagem (liga com a história): Elias (carruagem de fogo), Jonas (levado pela onda), Davi (de manto ao vento), Ester (véu), Daniel (com leão amigo ao lado).

## 3. Sons (opcionais, por personagem)

Arquivo **curto (menos de 2 s)**, MP3/M4A/OGG/WAV, até 12 MB. Sem arquivo, toca o som padrão. Um som por evento:

| Som | Quando toca | Ideia |
|---|---|---|
| **Pulo** | A cada pulo | "hup!" curto e alegre, voz do personagem |
| **Pulo duplo** | Segundo pulo no ar | "hup-hup!" mais agudo |
| **Palavra** | Pegou uma palavra do versículo | brilho/sininho ou "olha só!" |
| **Inverter gravidade** | Trocou chão/teto | "uáu!" ou whoosh |
| **Checkpoint** | Passou numa bandeira | "marcado!" ou fanfarra curtinha |
| **Queda** | Errou | "ai!" cômico (nada assustador) |
| **Vitória** | Concluiu a fase / ganhou a corrida | comemoração curta |

Prompt de som (para ferramentas de efeitos/voz): `Short cheerful cartoon voice "{texto}" of a {idade/tipo} {personagem}, family-friendly, clean, no background noise, no music, {duração} seconds`.
Para efeitos sem voz: `Short {descrição} sound effect, clean, no reverb, no music, under 1 second`.

## 4. Passo a passo no Painel

1. Painel → **Corrida: personagens** → **Editar** (ou **Novo personagem**).
2. Nome, descrição (frase do cartão), ordem na lista e **cor de reserva**.
3. Em cada pose: **Enviar imagem** (ou colar o link) e informar a **quantidade de quadros**; a prévia anima para conferir.
4. Sons: enviar os arquivos (dá para ouvir a prévia no próprio campo).
5. **Salvar.** O app atualiza sozinho na próxima vez que o jogador abrir a Corrida. Desativar esconde o personagem sem excluir.
