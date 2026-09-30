/// <reference types="vite/client" />

/** Identificador do build (commit), definido no vite.config.ts. */
declare const __BUILD_ID__: string;
/** "blob" quando o Vercel Blob está configurado; "inline" no desenvolvimento. */
declare const __IMAGE_UPLOADS__: "blob" | "inline";
