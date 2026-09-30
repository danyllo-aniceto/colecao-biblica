function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variável de ambiente ${name} não configurada`);
  }
  return value;
}

export const env = {
  get jwtSecret() {
    const secret = required("JWT_SECRET");
    if (secret.length < 32) {
      throw new Error("JWT_SECRET precisa ter pelo menos 32 caracteres");
    }
    return secret;
  },
  get timezone() {
    return process.env.APP_TIMEZONE || "America/Sao_Paulo";
  },
  get blobToken() {
    return process.env.BLOB_READ_WRITE_TOKEN || "";
  },
};
