# API Endpoints - Colecao Biblica Backend

Base URL local: `http://localhost:8080`

Autenticacao: JWT Bearer no header `Authorization: Bearer <accessToken>`.

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
- Resposta: `AuthResponse` com `accessToken` e `refreshToken`

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

### PUT /settings/admin
- Acesso: ADMIN
- Body parcial aceito:
```json
{
  "maxQuestionsPerMatch": 100,
  "startingLives": 3,
  "rewardMatchLimitPerDay": 4,
  "characterStudyXpPercent": 35
}
```

## Quiz (modelo direto)

### POST /quiz/matches/submit
- Acesso: AUTH
- Registra resultado de partida enviada pelo cliente

Body:
```json
{
  "quizType": "GENERAL",
  "questionsAnswered": 10,
  "correctAnswers": 8,
  "wrongAnswers": 2,
  "characterId": null
}
```

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

Body:
```json
{
  "questionId": 101,
  "selectedOption": "A",
  "useExtraTime": false,
  "useExtraLife": false,
  "useXpMultiplier": false
}
```

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
