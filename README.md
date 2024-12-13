# `workers-mcp`

> **Talk to a Cloudflare Worker from Claude Desktop!**

This package provides both the CLI tooling and the in-Worker logic to connect Claude Desktop (or any [MCP Client](https://modelcontextprotocol.io/)) to a Cloudflare Worker on your account, so you can customise it to suit your needs.

## Usage

### Step 1: Generate a new Worker

Use `npx create-cloudflare@latest` to generate a new Worker.

You could also start with an existing one, as long as you route your `fetch` calls appropriately.

Make a new `WorkerEntrypoint` as your default export, then add [RPC methods](https://blog.cloudflare.com/javascript-native-rpc/), documented with JSDoc, that Claude can call:

```ts
export class ExampleWorkerMCP extends WorkerEntrypoint<Env> {
  /**
   * Generates a random number. This is extra random because it had to travel all the way to
   * your nearest Cloudflare PoP to be calculated which... something something lava lamps?
   *
   * @return {string} A message containing a super duper random number
   * */
  async getRandomNumber() {
    return `Your random number is ${Math.random()}`
  }
}
```

> <sub>Yes, I know that `Math.random()` works the same on a Worker as it does on your local machine, but don't tell Claude</sub> 🤫

### Step 2: Install `workers-mcp` & run `help` for instructions

```
npm install workers-mcp
npx workers-mcp help
```

### Step 3: Add  `workers-mcp docgen` to your `deploy` step

```json
  "scripts": {
    "deploy:worker": "workers-mcp docgen src/index.ts && wrangler deploy"
  }
```

### Step 4: Add a `fetch` handler to proxy events to your WorkerEntrypoint

Your Worker must (for now) be available on a public URL for Claude to access it. So we need a fetch handler that both handles auth (we're using simple shared-key auth) and proxies events to the right RPC method.

At the moment, only `ProxySelf` is provided, but `ProxyToServiceBinding` and `ProxyToDurableObject` are planned.

```ts
export class ExampleWorkerMCP extends WorkerEntrypoint<Env> {
  // ...
  
  async fetch(request: Request): Promise<Response> {
    return new ProxyToSelf(this).fetch(request)
  }
}
```

> Note, you may get a TS error as your `Env` doesn't contain the `SHARED_SECRET` variable. We'll add that in the next step.

### Step 5: Generate the secret & do the first deployment

Generate a secret in `.dev.vars` for use locally, then upload it once we have a Worker to attach it to:

```sh
# Generate the secret
npx workers-mcp secret generate
# (Optional) Update Env to include SHARED_SECRET
npx wrangler types
# Generate docs and deploy your Worker
npm run deploy
# Set the secret on our newly created Worker
npx workers-mcp secret upload
```

### Step 6: Install it into Claude

Use the URL from your successful deployment in step 5, and any local alias you choose.

```sh
npx workers-mcp install <local-alias> https://<worker-name>.<my-name>.workers.dev
```

### Step 7: Start Claude Desktop!

Prompt Claude with something that causes it to invoke the function in your Worker:

![image](https://github.com/user-attachments/assets/c16b2631-4eba-4914-8e26-d6ccea0fc578)

### Step 8..♾️: Iterating

After changing your Worker code, you only need to run `npm run deploy` to update both Claude's metadata about your function and your live Worker instance. 

However, if you change the names of your methods, or their parameters, or add or remove methods, Claude will not see the updates until you restart it.