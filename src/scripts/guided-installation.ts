import { confirm, intro, log, outro, select } from '@clack/prompts'
import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import { generateSecret, readSharedSecret, SECRET_PATH, uploadSecret } from './secret'
import { runWrangler } from './utils'

export async function guidedInstallation() {
  console.log(`\n💪 Congratulations on installing ${chalk.green('workers-mcp')} 😎\n`)
  intro(`Let's get started...`)
  try {
    await doInitialDeploy()
    await addDocgen()
    await generateAndUploadSecret()
    outro(`🤙 All done!`)
  } catch (e) {
    log.error(chalk.red('ERROR') + ' ' + (e as Error).message)
    process.exit(1)
  }
}

async function doInitialDeploy() {
  log.info(
    [
      `${chalk.bold('Step 1')}: doing an initial deployment`,
      chalk.grey(
        `Your worker must be deployed at least once before the secret upload step will work, so let's do so now.`,
      ),
    ].join('\n'),
  )
  if (process.env.SKIP_DEPLOYMENT === 'true') {
    log.warn(`Skipping deployment due to ${chalk.yellow('SKIP_DEPLOYMENT=true')}.`)
  } else {
    log.step(`Set SKIP_DEPLOYMENT=true to skip this step in future.`)
    const stdout = await runWrangler(['deploy'])
    console.log('\n')
  }
}

async function addDocgen() {
  log.info(
    `${chalk.bold('Step 2')}: running ${chalk.yellow('workers-mcp docgen src/index.ts')} as part of your ${chalk.yellow('wrangler deploy')} step`,
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
      return log.success(
        `NPM script ${chalk.green(key)} already contains ${chalk.yellow(`'workers-mcp docgen'`)}.\nKeeping existing value:\n\n  ${chalk.grey(`"${key}": "${value}"`)}`,
      )
    }

    const new_value = 'workers-mcp docgen src/index.ts && ' + value
    log.step(
      [
        `Found NPM script key ${chalk.green(key)} that contains ${chalk.yellow(`'wrangler deploy'`)}. Applying update:`,
        '',
        chalk.red(`--- "${key}": "${value}"`),
        chalk.green(`+++ "${key}": "${new_value}"`),
      ].join('\n'),
    )
    if (await confirm({ message: 'Proceed?' })) {
      scripts[key] = new_value
      await fs.writeJSON(package_json_path, package_json, { spaces: 2 })
      log.success(`Updated package.json!`)
    } else {
      log.warn(`Skipping! You should add ${chalk.yellow(`'workers-mcp docgen src/index.ts'`)} yourself manually.`)
    }
  } else {
    log.step(`Found the following NPM scripts:\n${chalk.grey(JSON.stringify(scripts, null, 2))}`)
    const choice = await select({
      message: `Which script would you like to prepend with ${chalk.yellow('workers-mcp docgen src/index.ts &&')}?`,
      options: Object.keys(scripts)
        .map((key) => ({ value: key, label: `"${key}"` }))
        .concat({ value: '', label: '<skip>' }),
    })
    if (choice === '' || typeof choice !== 'string') {
      log.warn(`Skipping! You should add ${chalk.yellow(`'workers-mcp docgen src/index.ts'`)} yourself manually.`)
    } else {
      const value = scripts[choice]
      const new_value = 'workers-mcp docgen src/index.ts && ' + value

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
    }
  }
}

async function generateAndUploadSecret() {
  log.info(`${chalk.bold('Step 3')}: generate and uploading a shared secret`)

  let do_upload = true
  let secret: string | null = null

  const dev_vars_exists = await fs.pathExists(SECRET_PATH)
  if (dev_vars_exists) {
    const existing_secret = readSharedSecret()
    if (existing_secret?.length === 64) {
      log.success(`SHARED_SECRET already present in ${chalk.yellow(SECRET_PATH)}. It may already be uploaded.`)
      secret = existing_secret
      do_upload = (await confirm({
        message: `Do you want to rerun ${chalk.yellow('wrangler secret put')} just in case?`,
        initialValue: false,
      })) as boolean
    } else {
      log.warn(`SHARED_SECRET present in ${chalk.yellow(SECRET_PATH)} but appears invalid.`)
      if (
        await confirm({
          message: `Do you want to regenerate it?`,
        })
      ) {
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
      await runWrangler(['types'])
    }
    log.success(`Done!`)
  }
}
