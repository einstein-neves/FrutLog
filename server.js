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
}

// Allow only files needed by the browser UI. This keeps future server/config
// files private by default, including files under the Git metadata directory.
const publicRoots = new Set(["css", "imagem", "js"]);
const publicFiles = new Set(["index.html", "login.html", "admin.html", "eng.html", "tec.html", "senha-temporaria.html"]);
const publicExtensions = new Set([".css", ".html", ".js", ".jpg", ".jpeg", ".png", ".svg", ".ico"]);

function sendStatic(req, res) {
  const requestPath = new URL(req.url, "http://localhost").pathname;
  let relative;
  try {
    relative = requestPath === "/" ? "index.html" : decodeURIComponent(requestPath).replace(/^\/+/, "");
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Caminho inválido");
    return;
  }
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
  const firstSegment = rel.split(path.sep)[0].toLowerCase();
  if (
    baseName.startsWith(".") ||
    !publicExtensions.has(extName) ||
    (!publicFiles.has(rel.toLowerCase()) && !publicRoots.has(firstSegment))
  ) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }).end("Acesso negado");
    return;
  }

  fs.realpath(target, (pathError, resolvedTarget) => {
    const resolvedRelative = pathError ? "" : path.relative(frontend, resolvedTarget);
    if (pathError || resolvedRelative.startsWith("..") || path.isAbsolute(resolvedRelative)) {
      res.writeHead(pathError?.code === "ENOENT" ? 404 : 403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(pathError?.code === "ENOENT" ? "Arquivo não encontrado" : "Acesso negado");
      return;
    }
    fs.readFile(resolvedTarget, (error, data) => {
    if (error) {
      res.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(error.code === "ENOENT" ? "Arquivo não encontrado" : "Erro ao ler arquivo");
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extName] || "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-cache"
    });
    res.end(req.method === "HEAD" ? undefined : data);
    });
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
