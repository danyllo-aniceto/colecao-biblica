import { Router } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { visibleCharacter } from "../services/visibility";

/** Dados públicos da página inicial (sem login). */
export const landingRouter = Router();

/** Personagens de exemplo mostrados na página inicial: nome, raridade e imagem já cadastrados. */
export const LANDING_STICKERS = ["Rute", "Davi", "Ester", "Paulo"] as const;

landingRouter.get(
  "/stickers",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.biblicalCharacter.findMany({
      where: { name: { in: [...LANDING_STICKERS] }, ...visibleCharacter() },
      select: { name: true, rarity: true, imageUrl: true },
    });
    res.json(LANDING_STICKERS.flatMap((name) => rows.filter((row) => row.name === name)));
  }),
);

/**
 * Página de compartilhamento do app (`/api/compartilhar`): quem recebe o link no WhatsApp, Telegram, etc. vê um cartão com a
 * imagem que explica o app; quem abre o link é levado direto à página inicial. A imagem é a enviada no painel (se houver)
 * ou a padrão (`/compartilhar.jpg`). Os aplicativos de mensagem não executam JavaScript, por isso as tags ficam no HTML.
 */
export const sharePageRouter = Router();

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const SHARE_TITLE = "Coleção Bíblica";
export const SHARE_TEXT = "Aprenda a Bíblia jogando! Quiz, álbum de figurinhas dos personagens e jogos para jogar com os amigos. Jogue grátis.";

sharePageRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const proto = (req.get("x-forwarded-proto") ?? req.protocol).split(",")[0].trim() === "http" ? "http" : "https";
    const hostHeader = (req.get("x-forwarded-host") ?? req.get("host") ?? "").split(",")[0].trim();
    const host = /^[a-z0-9.-]+(:\d+)?$/i.test(hostHeader) ? hostHeader : "";
    const origin = host ? `${proto}://${host}` : "";
    const custom = (await prisma.gameModeDesign.findUnique({ where: { mode: "SHARE" }, select: { imageUrl: true } }))?.imageUrl ?? null;
    const image = custom ? (custom.startsWith("/") ? `${origin}${custom}` : custom) : `${origin}/compartilhar.jpg`;
    const size = custom ? "" : `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`;
    const title = escapeHtml(SHARE_TITLE);
    const text = escapeHtml(SHARE_TEXT);
    const url = escapeHtml(`${origin}/`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title>
<meta name="description" content="${text}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${title}"><meta property="og:locale" content="pt_BR">
<meta property="og:title" content="${title}: aprenda a Bíblia jogando"><meta property="og:description" content="${text}">
<meta property="og:url" content="${url}"><meta property="og:image" content="${escapeHtml(image)}">${size}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${text}"><meta name="twitter:image" content="${escapeHtml(image)}">
<meta http-equiv="refresh" content="0;url=/"><script>location.replace("/")</script></head>
<body><p><a href="/">Abrir ${title}</a></p></body></html>`);
  }),
);
