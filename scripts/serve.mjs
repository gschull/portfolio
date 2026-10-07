import http from "node:http";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const routes = new Map([
  ["/", ["index.html", "text/html"]],
  ["/index.html", ["index.html", "text/html"]],
  ["/styles.css", ["styles.css", "text/css"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/data/projects.json", ["data/projects.json", "application/json"]]
]);
const port = Number(process.env.PORT || 4173);
const server = http.createServer(async (request, response) => {
  const route = routes.get(new URL(request.url, "http://localhost").pathname);
  if (!route) { response.writeHead(404).end("Not found"); return; }
  try {
    const body = await readFile(new URL(route[0], root));
    response.writeHead(200, { "Content-Type": `${route[1]}; charset=utf-8`, "Cache-Control": "no-store" }).end(body);
  } catch (error) {
    console.error("Preview file could not be served:", error.message);
    response.writeHead(500).end("Preview file could not be served");
  }
});
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`Portfolio preview: http://127.0.0.1:${port}`));
