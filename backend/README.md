# Backend - Colecao Biblica

Backend da aplicacao gamificada de estudo biblico com:
- autenticacao JWT
- quiz geral e quiz por personagem
- sessao de quiz pergunta a pergunta
- recompensas e economia
- colecao de figurinhas
- comentarios privados
- ranking

## Stack

- Java 21
- Spring Boot
- Spring Security
- Spring Data JPA
- PostgreSQL
- JWT
- Maven

## Estrutura por modulo

- Auth e Users
- Characters (figurinhas)
- Questions
- Rewards
- Shop
- Quiz (submit direto + sessao)
- Collection
- Comments
- Ranking
- Settings

Pacotes principais:
- `src/main/java/backend/controller`
- `src/main/java/backend/service`
- `src/main/java/backend/repository`
- `src/main/java/backend/model`
- `src/main/java/backend/dto`

## Executando localmente

## 1) Configurar variaveis

No root do workspace, copie `.env.example` para `.env` e ajuste se necessario.

Variaveis usadas:
- `JWT_SECRET`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `PGADMIN_DEFAULT_EMAIL`
- `PGADMIN_DEFAULT_PASSWORD`

## 2) Subir banco e pgAdmin

No root do projeto:

```bash
docker compose up -d
```

## 3) Subir backend

Dentro de `backend`:

```bash
./mvnw spring-boot:run
```

No Windows PowerShell:

```powershell
.\mvnw.cmd spring-boot:run
```

## 4) Testes

```bash
./mvnw test
```

## Banco e migrations

- O projeto usa `spring.jpa.hibernate.ddl-auto=update`.
- O schema evolui automaticamente conforme as entidades.
- Existe seed inicial em `SeedDataConfig` (exceto profile `test`) com:
  - configuracoes padrao
  - personagens iniciais
  - perguntas iniciais
  - recompensas iniciais
  - itens iniciais de loja

## Seguranca e acesso

Regras centrais (resumo):
- `POST /users` e `/auth/**`: publico
- rotas `/admin` de dominio: ADMIN
- atualizacao/exclusao de usuario: dono ou ADMIN (validado no service)
- demais rotas de jogo: autenticadas

Token JWT no header:

```http
Authorization: Bearer <accessToken>
```

## Quiz: dois modos suportados

## 1) Submit direto

Cliente calcula/manda estatisticas finais e chama:
- `POST /quiz/matches/submit`

## 2) Sessao pergunta a pergunta

Fluxo recomendado:
1. `POST /quiz/sessions/start`
2. `GET /quiz/sessions/active` (ou `GET /quiz/sessions/{sessionId}`)
3. `POST /quiz/sessions/{sessionId}/answer` para cada pergunta
4. sessao finaliza automaticamente ao acabar perguntas ou vidas
5. opcional: `POST /quiz/sessions/{sessionId}/abandon`
6. historico: `GET /quiz/history`

## Validacao e erros

- DTOs de entrada usam Bean Validation (`@Valid`).
- Erros de validacao retornam `400` com campo `fields` detalhando os campos invalidos.
- Erros de negocio usam excecoes customizadas com respostas JSON padronizadas.

## Documentacao de endpoints

Todos os endpoints, acessos e exemplos estao em:

- `docs/endpoints.md`

## Estado atual do backend

Implementado:
- autenticacao e usuarios
- CRUD administrativo de personagens, perguntas, recompensas e loja
- configuracoes de jogo com update administrativo
- quiz com recompensas diarias
- sessao de quiz em andamento (start, status, active, answer, abandon, history)
- colecao do usuario
- comentarios privados
- ranking top 50

## Sugestoes para proxima fase

1. Adicionar documentacao OpenAPI/Swagger.
2. Criar suite de testes de integracao para controllers de quiz.
3. Considerar versionamento de API (`/api/v1`).
4. Avaliar migracao de `ddl-auto=update` para migrations versionadas (Flyway/Liquibase).
