import { confirm, intro, isCancel, log, outro, select, text } from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { generateSecret, readSharedSecret, SECRET_PATH, uploadSecret } from './secret'
import { EXAMPLE_JS, EXAMPLE_TS, runCommand } from './utils'
import { generateDocs } from './generate-docs'
import { scheduler } from 'node:timers/promises'
import { installClaude } from './install-claude'

const DELAY = 200

export async function guidedInstallation() {
  console.log(`\n💪 Congratulations on installing ${chalk.green('workers-mcp')} 😎\n`)
  intro(`Let's get started...`)
  await scheduler.wait(DELAY)
  try {
    const index_script = await determineIndexScript()
    await scheduler.wait(DELAY)
    const script_name = await addDocgen(index_script)
    await scheduler.wait(DELAY)
    await generateAndUploadSecret()
    await scheduler.wait(DELAY)
    await replaceSource(index_script)
    const url = await doDeploy(index_script, script_name)
    await scheduler.wait(DELAY)
    await install(url)
    outro(`🤙 All done!`)
  } catch (e) {
    log.error(chalk.red('ERROR') + ' ' + (e as Error).message)
    process.exit(1)
  }
}

async function determineIndexScript() {
  // TODO: use wrangler config to find this
  const paths = ['src/index.ts', 'src/index.js']
  const index_script = paths.find(fs.pathExistsSync)
  if (!index_script) {
    throw new Error(`Could not find a valid worker entrypoint file. Checked ${paths.join(',')}`)
  }
  return index_script
}

async function addDocgen(index_script: string) {
  log.info(
    `${chalk.bold('Step 1')}: adding ${chalk.yellow(`'workers-mcp docgen ${index_script}'`)} as part of your ${chalk.yellow('wrangler deploy')} step`,
  )

  const package_json_path = path.resolve(process.cwd(), 'package.json')
  if (!fs.existsSync(package_json_path)) {
    throw new Error(`Could not find ${chalk.yellow(package_json_path)}. Are you running in the right directory?`)
  }

  const package_json: { scripts: Record<string, string> } = await fs.readJSON(package_json_path)
  const { scripts = {} } = package_json
  const auto_choice = Object.entries(scripts).find(
    ([key, val]) => key.match(/deploy|publish|release/) && val.match(/wrangler deploy/),
  )
  if (auto_choice) {
    const [key, value] = auto_choice
    if (value.match(/workers-mcp docgen/)) {
      log.success(
        `NPM script ${chalk.green(key)} already contains ${chalk.yellow(`'workers-mcp docgen'`)}.\nKeeping existing value:\n\n  ${chalk.grey(`"${key}": "${value}"`)}`,
      )
      return
    }

    const new_value = `workers-mcp docgen ${index_script} && ${value}`
    log.step(
      [
        `Found NPM script key ${chalk.green(key)} that contains ${chalk.yellow(`'wrangler deploy'`)}. Applying update:`,
        '',
        chalk.red(`--- "${key}": "${value}"`),
        chalk.green(`+++ "${key}": "${new_value}"`),
      ].join('\n'),
    )
    const confirmed = await confirm({ message: 'Proceed?' })
    if (isCancel(confirmed)) throw new Error(`Cancelled.`)
    if (confirmed) {
      scripts[key] = new_value
      await fs.writeJSON(package_json_path, package_json, { spaces: 2 })
      log.success(`Updated package.json!`)
      return key
    } else {
      log.warn(`Skipping! You should add ${chalk.yellow(`'workers-mcp docgen ${index_script}`)} yourself manually.`)
    }
  } else {
    log.step(`Found the following NPM scripts:\n${chalk.grey(JSON.stringify(scripts, null, 2))}`)
    const choice = await select({
      message: `Which script would you like to prepend with ${chalk.yellow(`workers-mcp docgen ${index_script} &&`)}?`,
      options: Object.keys(scripts)
        .map((key) => ({ value: key, label: `"${key}"` }))
        .concat({ value: '', label: '<skip>' }),
    })
    if (isCancel(choice)) throw new Error(`Cancelled.`)
    if (choice === '') {
      log.warn(`Skipping! You should add ${chalk.yellow(`'workers-mcp docgen ${index_script}'`)} yourself manually.`)
    } else {
      const value = scripts[choice]
      const new_value = `workers-mcp docgen ${index_script} && ${value}`

      log.step(
        [
          `Applying update:`,
          chalk.red(`--- "${choice}": "${value}"`),
          chalk.green(`+++ "${choice}": "${new_value}"`),
        ].join('\n'),
      )
      scripts[choice] = new_value
      await fs.writeJSON(package_json_path, package_json, { spaces: 2 })
      log.success(`Updated package.json!`)
      return choice
    }
  }
}

async function generateAndUploadSecret() {
  log.info(`${chalk.bold('Step 2')}: generating and uploading a shared secret`)

  let do_upload = true
  let secret: string | null = null

  const dev_vars_exists = await fs.pathExists(SECRET_PATH)
  if (dev_vars_exists) {
    const existing_secret = readSharedSecret()
    if (existing_secret?.length === 64) {
      log.success(`SHARED_SECRET already present in ${chalk.yellow(SECRET_PATH)}. It may already be uploaded.`)
      log.warn(`To reupload it, run ${chalk.yellow('npx workers-mcp secret upload')} manually.`)
      secret = existing_secret
      const confirmed = await confirm({
        message: `Do you want to rerun ${chalk.yellow('wrangler secret put')} just in case?`,
        initialValue: false,
      })
      if (isCancel(confirmed)) throw new Error(`Cancelled.`)
      do_upload = confirmed
    } else {
      log.warn(`SHARED_SECRET present in ${chalk.yellow(SECRET_PATH)} but appears invalid.`)
      const confirmed = await confirm({
        message: `Do you want to regenerate it?`,
      })

      if (isCancel(confirmed)) throw new Error(`Cancelled.`)
      if (confirmed) {
        secret = generateSecret()
        log.success(`Generated and stored SHARED_SECRET in .dev.vars`)
      } else {
        log.warn(
          `Ok, skipping secret generation & upload!\nRun ${chalk.yellow('npx workers-mcp secret upload')} manually if required.`,
        )
        do_upload = false
      }
    }
  } else {
    secret = generateSecret()
    log.success(`Generated and stored SHARED_SECRET in ${chalk.yellow('.dev.vars')}`)
  }

  if (do_upload && secret) {
    log.step(`Uploading shared secret using ${chalk.yellow('wrangler secret put')}:`)
    await uploadSecret(secret)
    console.log('\n')
    if (await fs.pathExists('worker-configuration.d.ts')) {
      log.step(`Secret uploaded! Regenerating ${chalk.yellow('worker-configuration.d.ts')}:`)
      await runCommand('npx', ['wrangler', 'types'])
    }
    log.success(`Done!`)
  }
}

async function replaceSource(index_script: string) {
  log.info(
    [
      `${chalk.bold('Step 3')}: applying changes to ${chalk.yellow(index_script)}`,
      chalk.gray(
        `${chalk.yellow('workers-mcp')} requires exporting a WorkerEntrypoint with a ${chalk.yellow('ProxyToSelf')} or ${chalk.yellow('ProxyToDO')} helper with each method annotated using JSDoc.`,
      ),
    ].join('\n'),
  )

  const example_script = index_script.endsWith(`.ts`) ? EXAMPLE_TS : EXAMPLE_JS
  log.step(`For example, a "hello world" MCP Worker looks like\n${chalk.gray(example_script)}`)

  const source = fs.readFileSync(index_script, 'utf8')

  // TODO: do something far more sophisticated here to detect if this has already applied:
  const imports_a_proxy_method = source.match(/import.*Proxy.*workers-mcp/)
  const exports_an_entrypoint = source.match(/export default.*extends WorkerEntrypoint/)
  if (imports_a_proxy_method && exports_an_entrypoint) {
    log.success(`Your ${chalk.yellow(index_script)} seems to be already set up! Skipping...`)
  } else {
    const confirmed = await confirm({
      message: `Would you like to replace the contents of ${chalk.yellow(index_script)} with the above example code?`,
    })
    if (isCancel(confirmed)) throw new Error(`Cancelled.`)
    if (confirmed) {
      await fs.writeFile(index_script, example_script)
      log.success(`Success! ${chalk.yellow(index_script)} written.`)
    }
  }
}

async function doDeploy(index_script: string, script_name?: string) {
  log.info([`${chalk.bold('Step 4')}: deploying your code!`].join('\n'))

  const stdout = await (script_name
    ? runCommand('npm', ['run', script_name])
    : generateDocs(index_script).then(() => runCommand('npx', ['wrangler', 'deploy'])))

  const url = stdout
    .split('\n')
    .map((line) => line.match(/(https:\/\/.*)/))
    .find(Boolean)?.[1]

  if (!url) {
    throw new Error(
      `Unable to determine which URL your worker was deployed to.\nPlease run ${chalk.yellow('npx workers-mcp install:claude <name-within-claude> <url-to-your-hosted-worker>')} manually.`,
    )
  }

  log.success(`Success! Worker deployed to ${chalk.yellow(url)}`)

  return url
}

async function install(url: string) {
  log.info(`${chalk.bold('Step 5')}: installing on Claude Desktop`)

  const claude_name = await text({
    message: 'What name should we use for this worker within Claude?',
    initialValue: path.basename(process.cwd()),
  })
  if (isCancel(claude_name)) throw new Error(`Cancelled.`)

  if (claude_name === '') {
    log.warn(
      `Skipping! Please run ${chalk.yellow('npx workers-mcp install:claude <name-within-claude> <url-to-your-hosted-worker>')} manually.`,
    )
  } else {
    await installClaude(claude_name, url)
  }
}
