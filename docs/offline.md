# Modo offline

O app é um PWA: depois de aberto uma vez com internet, funciona sem conexão no que não depende do servidor.

## O que funciona sem internet
- **Abrir o app e navegar**: o pré-cache (`vite.config.ts`) guarda todo o JS/CSS do jogador, fontes e logo; ficam de fora só o painel do admin e os diagramas (entram no cache ao serem usados).
- **Álbum, ficha da figurinha, perfil, loja (só ver), ranking, missões, conquistas, campanha (só ver), amigos (só ver)**: leituras da API em `CACHEABLE_API_PATHS` (`src/sw.ts`), rede primeiro e cópia no aparelho como reserva. Apagadas no login/logout.
- **Imagens**: cache de imagens do service worker (250 itens, 30 dias) + `lib/image-warmup.ts`, que baixa em segundo plano as figurinhas conquistadas.
- **Tabuleiro no mesmo aparelho**: motor roda no navegador; as perguntas vêm do pacote guardado em `localStorage` (`lib/board-api.ts`, atualizado a cada 12 h e a cada partida criada com internet).
- **Duelo contra o computador**: motor no navegador; figurinhas e Times vêm do cache da API.

- **Corrida (campanha)**: a lista de cenários/fases e o progresso abrem offline (`/api/runner/campaign` e `/progress` em `CACHEABLE_API_PATHS`); dá para jogar a campanha sem internet: a partida (os toques) fica numa fila no aparelho (`corrida-progress.ts`) e o servidor a confere quando a conexão volta. A trilha do cenário exige internet.

## O que exige internet
Quiz (gabarito no servidor), mini games (partida no servidor), compras/resgates/baús, salas online do Tabuleiro e do Duelo, amigos/trocas/chat, gravar Times, música dos cenários.

## Regras para novas telas
- Leitura nova que deva abrir offline: acrescente o caminho em `CACHEABLE_API_PATHS`. Nunca coloque ali sala/partida em andamento nem nada com `?since=`.
- Ação que muda dados offline mostra o erro de conexão em toast (já é o padrão de `fetchApi`); desative o botão com `usePwa().isOnline` quando fizer sentido.
- Modo de jogo que roda no aparelho entra em `WORKS_OFFLINE` (`play-hub.tsx`).
