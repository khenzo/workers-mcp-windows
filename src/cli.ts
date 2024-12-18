#!/usr/bin/env node

import { generateDocs } from './scripts/generate-docs'
import { secret } from './scripts/secret'
import { installClaude } from './scripts/install-claude'
import { localProxy } from './scripts/local-proxy'
import { help } from './scripts/help'
import { guidedInstallation } from './scripts/guided-installation'

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
} else if (cmd === 'install') {
  await guidedInstallation()
} else if (cmd === 'install:claude') {
  await secret(args[0])
} else if (cmd === 'install:claude') {
  await installClaude(args[0], args[1])
} else if (cmd === 'run') {
  await localProxy(args[0], args[1], args[2])
} else if (cmd === 'help') {
  await help()
} else {
  console.log(`Unknown command: ${cmd}`)
}
