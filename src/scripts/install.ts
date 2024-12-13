import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import chalk from 'chalk'
import npmWhich from 'npm-which'

export async function install(claude_name: string, workers_url: string) {
  if (!claude_name || !workers_url) {
    console.error('usage: npx workers-mcp install <claude_name> <workers_url>')
    process.exit(1)
  }

  const claudeConfigPath = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    'Claude',
    'claude_desktop_config.json',
  )
  const mcpConfig = {
    command: npmWhich(process.cwd()).sync('workers-mcp'),
    args: ['run', claude_name, workers_url, process.cwd()],
    env: process.env.NODE_EXTRA_CA_CERTS ? { NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS } : {},
  }

  console.log(`Looking for existing config in: ${chalk.yellow(path.dirname(claudeConfigPath))}`)
  const configDirExists = isDirectory(path.dirname(claudeConfigPath))
  if (configDirExists) {
    const existingConfig = fs.existsSync(claudeConfigPath)
      ? JSON.parse(fs.readFileSync(claudeConfigPath, 'utf8'))
      : { mcpServers: {} }
    const newConfig = {
      ...existingConfig,
      mcpServers: {
        ...existingConfig.mcpServers,
        [claude_name]: mcpConfig,
      },
    }
    fs.writeFileSync(claudeConfigPath, JSON.stringify(newConfig, null, 2))

    console.log(`${chalk.yellow(claude_name)} configured & added to Claude Desktop!`)
    console.log(`Wrote config to ${chalk.yellow(claudeConfigPath)}:`)
    const redactedNewConfig = {
      ...Object.fromEntries(Object.keys(existingConfig).map((k) => [k, '...'])),
      mcpServers: {
        ...Object.fromEntries(Object.keys(existingConfig.mcpServers).map((k) => [k, '...'])),
        [claude_name]: mcpConfig,
      },
    }
    console.log(chalk.gray(JSON.stringify(redactedNewConfig, null, 2)))
  } else {
    const fullConfig = { mcpServers: { [claude_name]: mcpConfig } }
    console.log(
      `Couldn't detect Claude Desktop config at ${claudeConfigPath}.\nTo add the Cloudflare MCP server manually, add the following config to your ${chalk.yellow('claude_desktop_configs.json')} file:\n\n${JSON.stringify(fullConfig, null, 2)}`,
    )
  }
}

export function isDirectory(configPath: string) {
  try {
    return fs.statSync(configPath).isDirectory()
  } catch (error) {
    // ignore error
    return false
  }
}
