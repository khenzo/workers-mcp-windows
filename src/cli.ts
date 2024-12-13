#!/usr/bin/env node

import chalk from 'chalk'
import { generateDocs } from './scripts/generate-docs'
import { generateSecret } from './scripts/generate-secret'
import { install } from './scripts/install'
import { localProxy } from './scripts/local-proxy'

export function log(...args: any[]) {
  const msg = `[DEBUG ${new Date().toISOString()}] ${args.join(' ')}\n`
  process.stderr.write(msg)
}

// Handle process events
process.on('uncaughtException', (error) => {
  log('Uncaught exception:', error)
})

process.on('unhandledRejection', (error) => {
  log('Unhandled rejection:', error)
})

const [cmd, ...args] = process.argv.slice(2)

if (cmd === 'docgen') {
  await generateDocs(args[0])
} else if (cmd === 'secret') {
  await generateSecret(args[0])
} else if (cmd === 'install') {
  await install(args[0], args[1])
} else if (cmd === 'run') {
  await localProxy(args[0], args[1], args[2])
} else if (cmd === 'help') {
  console.log(`
${chalk.green('[[ WORKERS MCP ]]')}

1️⃣   run ${chalk.yellow('workers-mcp docgen src/index.ts')} before each 'wrangler deploy', e.g.
${chalk.gray(`
  "scripts": {
    "deploy:worker": "workers-mcp docgen src/index.ts && wrangler deploy"
  }
`)}

2️⃣   Within your Worker, add ${chalk.yellow('ProxyToSelf')} to your .fetch handler:
${chalk.gray(`
  class MyWorker extends WorkerEntrypoint {
    // rpc methods here
    
    async fetch(request: Request): Promise<Response> {
      return new ProxyToSelf(this).fetch(request)
    }
  }
`)}

3️⃣   Generate a new shared-secret for auth, run ${chalk.yellow('workers-mcp secret generate')}
    then upload it with ${chalk.yellow('workers-mcp secret upload')}.

4️⃣   Deploy your worker then install it with ${chalk.yellow('npx workers-mcp install <name-within-claude> <url-to-your-hosted-worker>')}
`)
} else {
  console.log(`Unknown command: ${cmd}`)
}
