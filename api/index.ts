import { app, ensureServerReady } from "../src/server/app.ts";

export function normalizeVercelApiRequestUrl(currentUrl: string) {
  const parsedUrl = new URL(currentUrl, "http://localhost");
  const path = parsedUrl.searchParams.get("path");

  if (!path) {
    return currentUrl;
  }

  parsedUrl.searchParams.delete("path");
  const search = parsedUrl.searchParams.toString();
  return `/api/${path}${search ? `?${search}` : ""}`;
}

function restoreOriginalApiUrl(request: unknown) {
  const req = request as { url?: string };
  req.url = normalizeVercelApiRequestUrl(req.url || "/api");
}

export default async function handler(req: unknown, res: unknown) {
  try {
    await ensureServerReady();
    restoreOriginalApiUrl(req);
    return app(req as Parameters<typeof app>[0], res as Parameters<typeof app>[1]);
  } catch (error) {
    console.error("💥 [Vercel/API] 服务初始化失败:", error);

    const response = res as {
      statusCode: number;
      setHeader: (name: string, value: string) => void;
      end: (body: string) => void;
    };

    response.statusCode = 500;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(
      JSON.stringify({
        error: "Server initialization failed",
        details: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}
