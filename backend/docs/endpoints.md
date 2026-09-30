# API Endpoints - Colecao Biblica Backend

Base URL local: `http://localhost:8080`

Autenticacao: JWT Bearer no header `Authorization: Bearer <accessToken>`.

Token ausente, invalido ou expirado em rota protegida retorna `401`. O cliente deve
chamar `POST /auth/refresh` e repetir a requisicao; se o refresh tambem retornar `401`,
a sessao acabou e o usuario precisa logar de novo.

## Legenda de acesso

- PUBLIC: sem token
- AUTH: usuario autenticado (USER ou ADMIN)
- ADMIN: apenas ROLE_ADMIN

## Auth

### POST /auth/login
- Acesso: PUBLIC
- Body:
```json
{
  "email": "admin@email.com",
  "password": "123456"
}
```
- Resposta: `AuthResponse` com `accessToken` (1h) e `refreshToken` (7 dias)
- E-mail inexistente ou senha errada: `401` com a mesma mensagem ("E-mail ou senha invalidos")

### POST /auth/refresh
- Acesso: PUBLIC
- Body:
```json
{
  "refreshToken": "..."
}
```
- Resposta: novo par de tokens

## Usuarios

### POST /users
- Acesso: PUBLIC
- Cria usuario (role padrao USER)

### GET /users
- Acesso: ADMIN
- Query params opcionais: `page`, `size`, `name`, `email`, `role`

### GET /users/{id}
- Acesso: ADMIN

### PUT /users/{id}
- Acesso: AUTH
- Regra de negocio: dono da conta ou ADMIN

### DELETE /users/{id}
- Acesso: AUTH
- Regra de negocio: dono da conta ou ADMIN (soft delete)

## Personagens (Figurinhas)

### GET /characters
- Acesso: AUTH

### GET /characters/{id}
- Acesso: AUTH

### POST /characters/admin
- Acesso: ADMIN

### PUT /characters/admin/{id}
- Acesso: ADMIN

### DELETE /characters/admin/{id}
- Acesso: ADMIN

## Perguntas

### GET /questions
- Acesso: AUTH

### GET /questions/{id}
- Acesso: AUTH

### GET /questions/general/random?limit=10
- Acesso: AUTH

### GET /questions/characters/{characterId}/random?limit=10
- Acesso: AUTH

### POST /questions/admin
- Acesso: ADMIN

### PUT /questions/admin/{id}
- Acesso: ADMIN

### DELETE /questions/admin/{id}
- Acesso: ADMIN

## Recompensas

### GET /rewards
- Acesso: AUTH

### POST /rewards/admin
- Acesso: ADMIN

### PUT /rewards/admin/{id}
- Acesso: ADMIN

### DELETE /rewards/admin/{id}
- Acesso: ADMIN

## Loja

### GET /shop
- Acesso: AUTH

### POST /shop/buy/{shopItemId}
- Acesso: AUTH
- Operacao transacional: debita moedas e aplica a recompensa juntos
- Retorna `400` sem cobrar quando a compra nao teria efeito (bonus no limite
  de acumulo ou todas as figurinhas daquela raridade ja obtidas)
- Resposta (`ShopPurchaseResponse`):
```json
{
  "item": { "id": 3, "name": "Figurinha Épica", "priceCoins": 450 },
  "rewardType": "STICKER",
  "characterId": 2,
  "characterName": "Ester",
  "characterRarity": "EPIC",
  "characterUnlocked": true,
  "userCoins": 1400,
  "extraLifeBoosts": 0,
  "extraTimeBoosts": 1,
  "doubleXpBoosts": 0
}
```

### POST /shop/admin
- Acesso: ADMIN

### PUT /shop/admin/{id}
- Acesso: ADMIN

### DELETE /shop/admin/{id}
- Acesso: ADMIN

## Configuracoes de jogo

### GET /settings
- Acesso: AUTH
- Retorna configuracoes efetivas:
  - `maxQuestionsPerMatch`
  - `startingLives`
  - `rewardMatchLimitPerDay`
  - `characterStudyXpPercent`
  - `maxExtraLifeBoosts`, `maxExtraTimeBoosts`, `maxDoubleXpBoosts`
  - `doubleXpMultiplier`
  - `extraTimeSeconds` (segundos somados pelo bonus de tempo extra)
  - `rewardMinCorrectAnswers` (acertos minimos no quiz geral para concorrer a recompensa;
    limitado automaticamente ao total de perguntas ativas)
  - `characterStickerMinAccuracyPercent` (aproveitamento minimo no estudo de personagem
    para ganhar a figurinha)

### PUT /settings/admin
- Acesso: ADMIN
- Body parcial aceito:
```json
{
  "maxQuestionsPerMatch": 100,
  "startingLives": 3,
  "rewardMatchLimitPerDay": 4,
  "characterStudyXpPercent": 35,
  "extraTimeSeconds": 15,
  "rewardMinCorrectAnswers": 7,
  "characterStickerMinAccuracyPercent": 70
}
```

Os valores padrao so sao criados quando ainda nao existem; alteracoes do admin
sobrevivem a reinicializacoes (o mesmo vale para chance de drop das recompensas
e preco/descricao/status dos itens da loja).

## Quiz por sessao (pergunta a pergunta)

### POST /quiz/sessions/start
- Acesso: AUTH
- Inicia sessao de quiz

Body exemplo (geral):
```json
{
  "quizType": "GENERAL",
  "questionLimit": 10
}
```

Body exemplo (personagem):
```json
{
  "quizType": "CHARACTER_STUDY",
  "characterId": 1,
  "questionLimit": 10
}
```

### GET /quiz/sessions/active
- Acesso: AUTH
- Retorna sessao ativa do usuario logado

### GET /quiz/sessions/{sessionId}
- Acesso: AUTH
- Retorna status detalhado da sessao

### POST /quiz/sessions/{sessionId}/answer
- Acesso: AUTH
- Responde pergunta atual e avanca sessao
- O tempo e validado no servidor: resposta enviada depois do prazo da pergunta
  (limite + tempo extra + 3s de tolerancia) conta como erro, com `timedOut: true`
- `selectedOption` pode ser omitido/nulo quando o tempo acabou sem resposta
- `useExtraLife`: se a resposta estiver errada, consome uma vida extra no lugar de uma vida
- `useXpMultiplier`: ativa o XP em dobro para toda a partida

Body:
```json
{
  "questionId": 101,
  "selectedOption": "A",
  "useExtraLife": false,
  "useXpMultiplier": false
}
```

Resposta: `correct`, `timedOut`, `livesRemaining`, `correctAnswers`, `wrongAnswers`,
`finished`, `extraTimeUsed`, `extraLifeUsed`, `xpMultiplierUsed`, `nextQuestion`
(com `timeLimitSeconds` e `remainingSeconds`) e `matchResult` quando `finished`.

### POST /quiz/sessions/{sessionId}/extra-time
- Acesso: AUTH
- Consome um bonus de tempo extra e soma `extraTimeSeconds` ao prazo da pergunta atual
- Uma vez por partida; `400` se o tempo da pergunta ja acabou ou se nao houver bonus
- Resposta: status da sessao com `currentQuestion.remainingSeconds` atualizado

### Regras de recompensa ao finalizar
- Quiz geral: sorteia uma recompensa se `correctAnswers >= rewardMinCorrectAnswers`
  e o usuario ainda nao atingiu `rewardMatchLimitPerDay` (dia no fuso `APP_TIMEZONE`)
- Estudo de personagem: XP reduzido a `characterStudyXpPercent`; a figurinha do
  personagem e concedida com aproveitamento >= `characterStickerMinAccuracyPercent`

### POST /quiz/sessions/{sessionId}/abandon
- Acesso: AUTH
- Marca sessao em andamento como ABANDONED

### GET /quiz/history?limit=20
- Acesso: AUTH
- Retorna historico do usuario:
  - sessoes (`quiz_sessions`)
  - partidas finalizadas (`quiz_matches`)

## Colecao

### GET /collection/my
- Acesso: AUTH
- Lista figurinhas adquiridas pelo usuario

### GET /collection/my/progress
- Acesso: AUTH
- Retorna progresso da colecao (`owned`, `total`)

## Comentarios privados

### GET /comments/my
- Acesso: AUTH

### POST /comments
- Acesso: AUTH
- Body:
```json
{
  "characterId": 1,
  "text": "Minha anotacao de estudo"
}
```

### PUT /comments/{id}
- Acesso: AUTH
- Atualiza apenas comentario do proprio usuario

## Ranking

### GET /ranking
- Acesso: AUTH
- Top 50 por `totalScore` (desempate por `xp`)

## Erros padronizados

Erros usam formato JSON com:
- `timestamp`
- `status`
- `error`
- `message`

Para validacao de payload (`@Valid`), tambem retorna:
- `fields` com mapa `campo -> mensagem`
