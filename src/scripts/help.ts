import chalk from 'chalk'

const DELIM = chalk.blue(new Array(80).fill('=').join(''))
export async function help() {
  console.log(`
💪 Congratulations on installing ${chalk.green('workers-mcp')} 😎

${DELIM}
Note: the below instructions are for manual installation.
Run ${chalk.green('npx workers install')} for a guided installation that automates this process.
${DELIM}

For manual installations, do the following 4 steps:

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
${chalk.yellow('npx workers-mcp install:claude <name-within-claude> <url-to-your-hosted-worker>')}

🎉 You're done! Now start up Claude Desktop and get prompting!

${DELIM}
Note: the above instructions are for manual installation.
Run ${chalk.green('npx workers setup')} for a guided installation that automates this process.
${DELIM}`)
}
