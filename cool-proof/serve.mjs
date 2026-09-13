import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

createServer((req, res) => {
  const file = join("browser", req.url === "/" ? "index.html" : req.url.slice(1));
  try {
    const body = readFileSync(file);
    res.writeHead(200, {
      "content-type": file.endsWith(".html") ? "text/html; charset=utf-8" : "text/javascript",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(4321, () => console.log("probe server on http://localhost:4321"));
