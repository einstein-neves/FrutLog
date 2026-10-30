const fs = require("fs");
const http = require("http");
const path = require("path");
const handler = require("./api/[...route]");

const port = Number(process.env.PORT || 3000);
const frontend = __dirname;
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const blockedFiles = new Set([".env", ".env.example", ".gitignore", "server.js", "package.json", "install.cmd"]);

function sendStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  const relative = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath).replace(/^\/+/, "");
  const target = path.resolve(frontend, relative);

  // Evitar directory traversal
  const rel = path.relative(frontend, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }).end("Acesso negado");
    return;
  }

  // Bloquear arquivos sensíveis e configurações
  const baseName = path.basename(target).toLowerCase();
  const extName = path.extname(target).toLowerCase();
  if (
    baseName.startsWith(".") ||
    blockedFiles.has(baseName) ||
    extName === ".sql" ||
    extName === ".cmd" ||
    rel.startsWith("supabase") ||
    rel.startsWith("scripts") ||
    rel.startsWith("api")
  ) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }).end("Acesso negado");
    return;
  }

  fs.readFile(target, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.code === "ENOENT" ? "Arquivo nao encontrado" : "Erro ao ler arquivo");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extName] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
}

http.createServer((req, res) => {
  if (new URL(req.url, "http://localhost").pathname.startsWith("/api")) return handler(req, res);
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  sendStatic(req, res);
}).listen(port, () => console.log(`FrutLog em http://localhost:${port} (API: /api)`));
