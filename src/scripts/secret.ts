import fs from 'node:fs'
import crypto from 'node:crypto'
import chalk from 'chalk'
import { runWranglerWithStdin } from './utils'

export const SECRET_PATH = '.dev.vars'

export function readSharedSecret() {
  return fs
    .readFileSync(SECRET_PATH, 'utf8')
    .split('\n')
    .map((line) => {
      const match = line.match(/SHARED_SECRET=(.*)/)
      return match?.[1]
    })
    .find(Boolean)
}

export function generateSecret() {
  const random_bytes = crypto.randomBytes(32)
  const random_string = random_bytes.toString('hex')

  const dev_vars = [`SHARED_SECRET=${random_string}`]
  if (fs.existsSync(SECRET_PATH)) {
    fs.readFileSync(SECRET_PATH, 'utf8')
      .split('\n')
      .forEach((line) => {
        if (!line.startsWith('SHARED_SECRET=')) {
          dev_vars.push(line)
        }
      })
  }
  fs.writeFileSync(SECRET_PATH, dev_vars.join('\n'))
  return random_string
}

export async function uploadSecret(secret: string) {
  await runWranglerWithStdin(['secret', 'put', 'SHARED_SECRET'], secret)
}

export async function secret(command: string) {
  if (command === 'generate') {
    console.log(`Generating shared secret...`)
    generateSecret()
    console.log(chalk.yellow(`Wrote SHARED_SECRET to .dev.vars`))
  } else if (command === 'upload') {
    const secret = readSharedSecret()

    if (!secret) {
      return console.log(
        [
          chalk.red(`SHARED_SECRET not found in .dev.vars.`),
          `Run ${chalk.yellow('npx workers-mcp secret generate')} to create one`,
        ].join('\n'),
      )
    }
    console.log(`Found secret. Running ${chalk.yellow('wrangler secret put SHARED_SECRET')}`)
    await uploadSecret(secret)

    console.log(chalk.green(`Done!`))
  } else {
    console.log(`Unknown command: ${command}`)
  }
}
