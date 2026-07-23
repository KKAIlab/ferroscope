import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 4173);
// .mjs must be served as JavaScript: a browser refuses to execute a module delivered
// with a generic binary content type, which would blank the page rather than warn.
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".svg": "image/svg+xml" };

const server = http.createServer((request, response) => {
  const urlPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const requested = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const resolved = path.resolve(root, requested);
  if (!resolved.startsWith(root)) { response.writeHead(403); response.end("Forbidden"); return; }
  fs.stat(resolved, (statError, stat) => {
    const filePath = !statError && stat.isDirectory() ? path.join(resolved, "index.html") : resolved;
    fs.readFile(filePath, (error, content) => {
      if (error) { response.writeHead(error.code === "ENOENT" ? 404 : 500); response.end(error.code === "ENOENT" ? "Not found" : "Server error"); return; }
      response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream", "Cache-Control": "no-store" });
      response.end(content);
    });
  });
});

server.listen(port, "127.0.0.1", () => console.log(`FerroScope preview running at http://127.0.0.1:${port}`));
