import { serve } from "bun";
import index from "./index.html";

const backendURL = process.env.BACKEND_URL ?? "http://localhost:8081";

async function proxyToBackend(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const target = new URL(url.pathname + url.search, backendURL);
  const headers = new Headers(req.headers);
  headers.delete("host");

  return fetch(target, {
    method: req.method,
    headers,
    body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
  });
}

const server = serve({
  routes: {
    "/api/**": proxyToBackend,
    "/*": index,
  },

  // GitHub aggregation (repo list + trends) can exceed the default 10s on cold cache.
  idleTimeout: 120,

  development: process.env.NODE_ENV !== "production" && {
    hmr: true,
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
