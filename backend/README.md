# Backend - Colecao Biblica

API Spring Boot com autenticação JWT, refresh token, controle de acesso por role e CRUD de usuários com auditoria.

## Stack

- Java 21
- Spring Boot
- Spring Security
- Spring Data JPA
- PostgreSQL
- JWT

## Regras de acesso

- `POST /users` é público para permitir cadastro.
- `GET /users` e `GET /users/{id}` exigem `ADMIN`.
- `PUT /users/{id}` e `DELETE /users/{id}` exigem que o usuário logado seja o dono da conta ou `ADMIN`.
- Em novas entidades, a regra padrão deve ser `ADMIN`, exceto quando houver exceção explícita de dono da conta.

## Autenticação

### Login

`POST /auth/login`

Exemplo de payload:

```json
{
  "email": "admin@email.com",
  "password": "123456"
}
```

Resposta:

```json
{
  "accessToken": "...",
  "refreshToken": "..."
}
```

### Refresh token

`POST /auth/refresh`

Exemplo de payload:

```json
{
  "refreshToken": "..."
}
```

A resposta devolve um novo par de tokens.

### Usando o token

Para acessar rotas protegidas, envie o header:

```http
Authorization: Bearer SEU_ACCESS_TOKEN
```

## CRUD de usuários

### Criar usuário

`POST /users`

Exemplo:

```json
{
  "name": "João",
  "email": "joao@email.com",
  "password": "123456",
  "role": "USER"
}
```

Se `role` não for enviado, o sistema usa `USER`.

### Listar usuários com paginação e filtro

`GET /users?page=0&size=10&name=joao&email=@email.com&role=ADMIN`

Parâmetros:

- `page`: página atual, começando em 0
- `size`: tamanho da página
- `name`: filtro parcial por nome
- `email`: filtro parcial por email
- `role`: filtro por role (`ADMIN` ou `USER`)

A resposta vem no formato paginado do Spring.

### Buscar usuário por id

`GET /users/{id}`

### Atualizar usuário

`PUT /users/{id}`

Exemplo:

```json
{
  "name": "João Silva",
  "password": "novaSenha"
}
```

### Excluir usuário

`DELETE /users/{id}`

A exclusão é lógica. O registro não é apagado do banco; ele é marcado como removido.

## Auditoria

O usuário guarda:

- `createdAt`
- `updatedAt`
- `createdBy`
- `updatedBy`
- `deleted`
- `deletedAt`
- `deletedBy`

## Como criar uma nova entidade

### 1. Criar a entity

Crie a classe em `src/main/java/backend/model`.

Recomendações:

- use `@Entity`
- adicione campos de auditoria se fizer sentido
- se a entidade também precisar de segurança por login, siga o mesmo padrão do `User`

### 2. Criar o repository

Crie a interface em `src/main/java/backend/repository`.

Se quiser paginação com filtro flexível, faça o repositório estender:

- `JpaRepository`
- `JpaSpecificationExecutor`

### 3. Criar DTOs

Crie DTOs de entrada e saída em `src/main/java/backend/dto`.

Boas práticas:

- não exponha a entity direto no controller
- nunca retorne senha ou dados sensíveis
- use DTO diferente para create e update quando necessário

### 4. Criar o service

Coloque a regra de negócio em `src/main/java/backend/service`.

No service, centralize:

- validação de negócio
- checagem de duplicidade
- conversão entity -> response
- regra de proprietário ou admin, quando a entidade tiver dono

### 5. Criar o controller

No controller, deixe apenas a camada HTTP:

- receber request
- chamar service
- retornar response

Exemplo de padrão para rotas:

- `POST /nova-entidade` para criação pública, se necessário
- `GET /nova-entidade` para listagem paginada
- `GET /nova-entidade/{id}` para busca por id
- `PUT /nova-entidade/{id}` para atualização
- `DELETE /nova-entidade/{id}` para exclusão

### 6. Definir permissão

Regra sugerida:

- criação pública: liberar apenas `POST`
- leitura/listagem: liberar para `ADMIN`
- alteração/exclusão: `ADMIN` ou dono do registro, se a entidade tiver dono
- demais operações administrativas: `ADMIN`

No `SecurityConfig`, adicione os `requestMatchers` da nova rota.

Se a regra for por dono da conta, implemente a validação no service, comparando o usuário autenticado com o dono do registro.

### 7. Se a entidade precisar de paginação e filtro

Use:

- `Pageable` no controller/service
- `Specification` no repository/service

Exemplo de abordagem:

- parâmetros opcionais na query string
- filtro parcial para texto
- retorno em `Page<T>`

### 8. Se a entidade precisar de auditoria

Use o mesmo padrão do `User`:

- `@CreatedDate`
- `@LastModifiedDate`
- `@CreatedBy`
- `@LastModifiedBy`
- soft delete quando precisar preservar histórico

### 9. Se a entidade tiver relacionamento com usuário

Salve quem criou ou alterou usando o usuário autenticado vindo do `SecurityContextHolder`.

## Fluxo recomendado para uma nova entidade

1. Criar entity e repository.
2. Criar DTOs.
3. Criar service com regras de negócio.
4. Criar controller.
5. Definir permissões no `SecurityConfig`.
6. Adicionar auditoria e soft delete se precisar de histórico.
7. Testar com token JWT.

## Exemplo de regra por dono/admin

Se a entidade pertencer a um usuário, a regra padrão é:

- o dono pode editar e excluir o próprio registro
- `ADMIN` pode fazer qualquer operação
- outros usuários não podem alterar

A validação deve ficar no service para evitar bypass por controller.

## Próximo passo sugerido

- criar testes para autenticação, CRUD de usuários, paginação e regras de permissão
- criar a primeira entidade de domínio seguindo esse padrão
