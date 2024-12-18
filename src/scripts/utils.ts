import { spawn } from 'child_process'

export async function runWrangler(args: string[]): Promise<string> {
  const child = spawn('npx', ['wrangler', ...args], {
    stdio: ['inherit', 'pipe', 'inherit'], // Pipe stdout but keep stdin and stderr as inherit
  })

  let output = ''

  // Capture stdout data
  child.stdout.on('data', (data) => {
    output += data.toString()
    process.stdout.write(data) // This pipes to terminal
  })

  // Wait for process to complete
  await new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Process exited with code ${code}`))
      }
    })
    child.on('error', reject)
  })

  return output
}

export async function runWranglerWithStdin(args: string[], stdin: string) {
  const child = spawn('npx', ['wrangler', ...args], {
    stdio: ['pipe', 'inherit', 'inherit'],
  })
  child.stdin.write(stdin + '\n')
  child.stdin.end()

  // Wait for process to complete
  await new Promise((resolve, reject) => {
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(code)
      } else {
        reject(new Error(`Process exited with code ${code}`))
      }
    })
    child.on('error', reject)
  })
}
