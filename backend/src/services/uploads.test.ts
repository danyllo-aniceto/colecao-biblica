import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const put = vi.fn();
vi.mock("@vercel/blob", () => ({ put, get: vi.fn() }));

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

async function freshModule() {
  vi.resetModules();
  return import("./uploads");
}

describe("upload de imagens", () => {
  beforeEach(() => {
    put.mockReset();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_store123_segredo");
    vi.stubEnv("BLOB_ACCESS", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reconhece o formato pelos bytes", async () => {
    const { detectImageType } = await freshModule();
    expect(detectImageType(PNG)?.type).toBe("image/png");
    expect(detectImageType(Buffer.from("texto qualquer"))).toBeNull();
  });

  it("store público: devolve a URL direta do Blob", async () => {
    put.mockResolvedValue({ url: "https://x.public.blob.vercel-storage.com/personagens/davi-abc.png", pathname: "personagens/davi-abc.png" });
    const { saveImage } = await freshModule();
    const saved = await saveImage(PNG, "personagens", "Davi Rei.PNG");
    expect(saved).toEqual({ url: "https://x.public.blob.vercel-storage.com/personagens/davi-abc.png", storage: "public" });
    expect(put).toHaveBeenCalledWith("personagens/davi-rei.png", PNG, expect.objectContaining({ access: "public", contentType: "image/png", addRandomSuffix: true }));
  });

  it("store privado: tenta público, cai para privado, serve pela API e lembra o modo", async () => {
    put.mockImplementation(async (pathname: string, _body: Buffer, options: { access: string }) => {
      if (options.access === "public") throw new Error("Vercel Blob: Cannot use public access on a private store.");
      return { url: `https://x.private.blob.vercel-storage.com/${pathname}`, pathname: `${pathname.replace(".png", "")}-xyz.png` };
    });
    const { saveImage } = await freshModule();
    const first = await saveImage(PNG, "conteudo", "mapa.png");
    expect(first).toEqual({ url: "/api/uploads/file/conteudo/mapa-xyz.png", storage: "private" });

    put.mockClear();
    await saveImage(PNG, "conteudo", "mapa.png");
    expect(put).toHaveBeenCalledTimes(1);
    expect(put.mock.calls[0][2]).toMatchObject({ access: "private" });
  });

  it("OIDC (só BLOB_STORE_ID): envia sem token explícito", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BLOB_STORE_ID", "store_123");
    put.mockResolvedValue({ url: "https://x.public.blob.vercel-storage.com/a.png", pathname: "a.png" });
    const { saveImage, uploadsConfigured } = await freshModule();
    expect(uploadsConfigured()).toBe(true);
    await saveImage(PNG, "personagens", "a.png");
    expect(put.mock.calls[0][2]).not.toHaveProperty("token");
  });

  it("erro do Blob vira mensagem clara", async () => {
    put.mockRejectedValue(new Error("Vercel Blob: Access denied, please provide a valid token for this resource."));
    vi.stubEnv("BLOB_ACCESS", "public");
    const { saveImage } = await freshModule();
    await expect(saveImage(PNG, "personagens", "a.png")).rejects.toThrow(/Não foi possível salvar a imagem no Vercel Blob: .*Access denied/);
  });

  it("valida caminhos servidos pela API", async () => {
    const { isValidUploadPath } = await freshModule();
    expect(isValidUploadPath("personagens/davi-xyz.png")).toBe(true);
    expect(isValidUploadPath("../segredo")).toBe(false);
    expect(isValidUploadPath("outra/coisa.png")).toBe(false);
  });

  it("reconhece áudio pelos bytes e recusa o que não é áudio", async () => {
    const { detectAudioType } = await freshModule();
    expect(detectAudioType(Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "binary"))?.type).toBe("audio/mpeg");
    expect(detectAudioType(Buffer.from([0xff, 0xfb, 0x90, 0x00]))?.type).toBe("audio/mpeg");
    expect(detectAudioType(Buffer.from("OggS\x00\x02", "binary"))?.type).toBe("audio/ogg");
    expect(detectAudioType(PNG)).toBeNull();
  });

  it("música vai para o Blob na pasta própria", async () => {
    put.mockResolvedValue({ url: "https://store.public.blob.vercel-storage.com/musicas/tema-abc.mp3", pathname: "musicas/tema-abc.mp3" });
    const { saveAudio } = await freshModule();
    const result = await saveAudio(Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "binary"), "Tema do Éden.mp3");
    expect(result.url).toContain("musicas/tema-abc.mp3");
    expect(put.mock.calls[0][0]).toBe("musicas/tema-do-eden.mp3");
    await expect(saveAudio(PNG, "foto.png")).rejects.toThrow(/Formato não suportado/);
  });

  it("música sem Blob configurado pede o link", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("BLOB_STORE_ID", "");
    const { saveAudio } = await freshModule();
    await expect(saveAudio(Buffer.from("ID3\x04\x00\x00\x00\x00\x00\x00", "binary"), "a.mp3")).rejects.toThrow(/Vercel Blob/);
  });
});
