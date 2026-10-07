// Gera frontend/public/compartilhar.jpg (1200×630) a partir do modelo.html.
// Uso (precisa do Playwright instalado): node scripts/imagem-compartilhar/gerar.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.join(here, "modelo.html")).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(here, "../../public/compartilhar.jpg"), type: "jpeg", quality: 88 });
await browser.close();
