import fs from 'node:fs'
import crypto from 'node:crypto'
import chalk from 'chalk'
import { spawn } from 'child_process'

export async function generateSecret(command: string) {
  const secretPath = './.dev.vars'

  if (command === 'generate') {
    console.log(`Generating shared secret...`)
    const randomBytes = crypto.randomBytes(32)
    const randomString = randomBytes.toString('hex')

    const dev_vars = [`SHARED_SECRET=${randomString}`]
    if (fs.existsSync(secretPath)) {
      fs.readFileSync(secretPath, 'utf8')
        .split('\n')
        .forEach((line) => {
          if (!line.startsWith('SHARED_SECRET=')) {
            dev_vars.push(line)
          }
        })
    }
    fs.writeFileSync(secretPath, dev_vars.join('\n'))
    console.log(chalk.yellow(`Wrote SHARED_SECRET to .dev.vars`))
  } else if (command === 'upload') {
    const secret = fs
      .readFileSync(secretPath, 'utf8')
      .split('\n')
      .map((line) => {
        const match = line.match(/SHARED_SECRET=(.*)/)
        return match?.[1]
      })
      .find(Boolean)

    if (!secret) {
      return console.log(
        [
          chalk.red(`SHARED_SECRET not found in .dev.vars.`),
          `Run ${chalk.yellow('npx workers-mcp secret generate')} to create one`,
        ].join('\n'),
      )
    }
    console.log(`Found secret. Running ${chalk.yellow('wrangler secret put SHARED_SECRET')}`)

    const child = spawn('npx', ['wrangler', 'secret', 'put', 'SHARED_SECRET'], {
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    child.stdin.write(secret + '\n')
    child.stdin.end()
    // Wait for child to complete
    await new Promise((resolve) => child.on('exit', resolve))

    console.log(chalk.green(`Done!`))
  } else {
    console.log(`Unknown command: ${command}`)
  }
}
