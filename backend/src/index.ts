import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT) || 3333;

createApp().listen(port, () => {
  console.log(`API da Coleção Bíblica rodando em http://localhost:${port}/api`);
});
