# [EXPERIMENTAL] MCP Workers

Tooling to connect a local LLM (like Claude Desktop) to your Cloudflare Workers

```
1️⃣   run workers-mcp docgen src/index.ts before each 'wrangler deploy', e.g.

  "scripts": {
    "deploy:worker": "workers-mcp docgen src/index.ts && wrangler deploy"
  }


2️⃣   Within your Worker, add ProxyToSelf to your .fetch handler:

  class MyWorker extends WorkerEntrypoint {
    // rpc methods here

    async fetch(request: Request): Promise<Response> {
      return new ProxyToSelf(this).fetch(request)
    }
  }


3️⃣   Generate a new shared-secret for auth, run workers-mcp secret generate
    then upload it with workers-mcp secret upload.

4️⃣   Deploy your worker then install it with npx workers-mcp install <name-within-claude> <url-to-your-hosted-worker>
```