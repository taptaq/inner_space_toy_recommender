import { app, ensureServerReady } from "./app.js";

const port = Number(process.env.PORT || 3010);

void ensureServerReady()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`🚀 [Server] 稳定后端桥梁已启动: http://localhost:${port}`);
      console.log("🔗 [Server] 前端通过 Vite Proxy (/api) 进行量子透传...");
    });
  })
  .catch((error) => {
    console.error("💥 [Server/Init] 服务初始化失败:", error);
    process.exit(1);
  });
