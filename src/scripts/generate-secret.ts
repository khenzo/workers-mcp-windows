import fs from 'node:fs'
import crypto from 'node:crypto'
import chalk from 'chalk'
import { spawn } from 'child_process'

export async function generateSecret(command: string) {
  const secret_path = './.dev.vars'

  if (command === 'generate') {
    console.log(`Generating shared secret...`)
    const random_bytes = crypto.randomBytes(32)
    const random_string = random_bytes.toString('hex')

    const dev_vars = [`SHARED_SECRET=${random_string}`]
    if (fs.existsSync(secret_path)) {
      fs.readFileSync(secret_path, 'utf8')
        .split('\n')
        .forEach((line) => {
          if (!line.startsWith('SHARED_SECRET=')) {
            dev_vars.push(line)
          }
        })
    }
    fs.writeFileSync(secret_path, dev_vars.join('\n'))
    console.log(chalk.yellow(`Wrote SHARED_SECRET to .dev.vars`))
  } else if (command === 'upload') {
    const secret = fs
      .readFileSync(secret_path, 'utf8')
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
