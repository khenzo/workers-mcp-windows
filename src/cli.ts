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
💪 Congratulations on installing ${chalk.green('workers-mcp')} 😎

Get started in 4 easy steps:

${chalk.underline.green(`Step 1`)}
Add ${chalk.yellow('workers-mcp docgen src/index.ts')} as part of your 'wrangler deploy' step, e.g.
${chalk.gray(`
  "scripts": {
    "deploy:worker": "workers-mcp docgen src/index.ts && wrangler deploy"
  }
`)}
${chalk.underline.green(`Step 2`)}
Within your Worker, add ${chalk.yellow('ProxyToSelf')} to your .fetch handler:
${chalk.gray(`
  import { ProxyToSelf } from 'workers-mcp'
  
  class MyWorker extends WorkerEntrypoint {
    // rpc methods here
    
    async fetch(request: Request): Promise<Response> {
      return new ProxyToSelf(this).fetch(request)
    }
  }
`)}
${chalk.underline.green(`Step 3`)}
Generate a new shared secret and do the first-deployment dance:

• ${chalk.yellow('npx workers-mcp secret generate')}
• ${chalk.yellow('npm run deploy')}
• ${chalk.yellow('npx workers-mcp secret upload')}
• (optional) ${chalk.yellow('npx wrangler types')}

${chalk.underline.green(`Step 4`)}
Install it, choosing a new name & using the URL from your first deployment above:
${chalk.yellow('npx workers-mcp install <name-within-claude> <url-to-your-hosted-worker>')}

🎉 You're done! Now start up Claude Desktop and get prompting!
`)
} else {
  console.log(`Unknown command: ${cmd}`)
}
