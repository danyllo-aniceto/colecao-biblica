# Frontend

App React + Vite da Coleção Bíblica. A API fica no mesmo domínio, em `/api`
(no desenvolvimento o Vite repassa `/api` para `http://localhost:3333`).
Para rodar tudo junto, veja o README da raiz (`npm run dev`).

## Funcionalidades

- Tela inicial com Login e Cadastro na mesma interface.
- Painel do usuário: figurinhas, quiz, loja, ranking e configurações da conta.
- Painel do admin (carregado só para admins): usuários, personagens, perguntas,
  recompensas, loja e configurações do jogo.
- Sessão com renovação automática: `src/lib/http.ts` renova o access token via
  `POST /api/auth/refresh` ao receber `401` e repete a requisição. Só desloga se o
  refresh for recusado (falha de rede não derruba a sessão).
- Quiz com cronômetro sincronizado com o servidor, envio automático ao fim do
  tempo e bônus (tempo extra, vida extra, XP em dobro).
- Tema claro/escuro aplicado antes da primeira pintura (script em `index.html`); a
  variante `dark:` do Tailwind segue o tema escolhido no app.

## Scripts

- `npm run dev`: servidor de desenvolvimento (porta 5173)
- `npm run build`: checagem de tipos + build de produção em `dist/`
- `npm run preview`: serve o build (porta 4173), útil para testar o PWA
- `npm run typecheck`: só a checagem de tipos
- `npm run icons`: regenera os ícones do PWA a partir de `src/assets/logo.png`

## PWA

O app é instalável (Android, desktop e iPhone) e funciona offline com os dados já vistos.

| Arquivo | Papel |
| --- | --- |
| `vite.config.ts` | Manifest (nome, ícones, cores, `start_url: /dashboard`) e lista de pré-cache |
| `src/sw.ts` | Service worker (Workbox): pré-cache, rotas de cache e mensagens |
| `src/components/pwa/pwa-provider.tsx` | Registro do worker, aviso de nova versão, aviso de offline, prompt de instalação |
| `src/components/pwa/install-app-button.tsx` | Botão "Instalar app" (prompt nativo ou instruções no iPhone) |
| `public/icons/` | Ícones gerados por `npm run icons` |

Estratégias de cache do service worker:

- **App (HTML, JS principal, CSS, fontes, ícones):** pré-cacheados na instalação;
  qualquer rota abre offline (é uma SPA).
- **Demais arquivos do build** (painel admin, diagramas): guardados na primeira vez em que são usados.
- **Imagens** (inclusive as do Vercel Blob): cache, revalidando em segundo plano.
- **API:** somente leituras (personagens, coleção, ranking, loja, perfil, comentários,
  histórico e regras) com rede primeiro e cópia para uso offline. Quiz, compras e
  autenticação nunca usam cache. O cache da API é apagado no login e no logout.

Atualizações: cada deploy gera um `sw.js` diferente. Quando o navegador encontra a
versão nova, o app mostra "Uma nova versão do app está disponível" e troca de versão
quando o usuário aceita. A versão (commit) aparece no fim da tela de perfil.

O service worker só é registrado no build de produção (`npm run build && npm run preview`);
em `npm run dev` qualquer worker antigo é removido para não atrapalhar o hot reload.

## Sistema visual

- Tokens em `src/globals.css` (temas Dia e Noite), expostos ao Tailwind como `bg-surface`,
  `text-ink`, `text-muted`, `bg-primary`, `bg-accent`, `border-edge` etc. Os nomes antigos
  (`--bg-primary`, `--text-primary`, `--gold`...) apontam para os novos.
- Fontes: Fredoka (`font-display`) e Nunito (texto), empacotadas via `@fontsource`.
- Classes de jogo: `panel`, `btn-3d`, `rarity` + `data-rarity` (`rarity-frame`, `rarity-text`,
  `rarity-bg`, `rarity-chip`) e animações `animate-fade-up`, `animate-pop-in`, `animate-float`.
- Componentes de jogo em `src/components/game/` (moedas, bônus, XP, nível, figurinha, modal)
  e seções do painel em `src/components/user/sections/`.

## Componentes reutilizáveis

- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/label.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/table.tsx`

## Próximos passos

- Atalhos no ícone do app (manifest `shortcuts`) para Quiz e Figurinhas.
