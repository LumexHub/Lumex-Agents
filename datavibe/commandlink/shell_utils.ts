import { exec } from "child_process"

/**
 * Execute a shell command and return stdout (trimmed).
 * Rejects with detailed error if command fails or times out.
 * @param command Shell command to run (e.g., "ls -la")
 * @param timeoutMs Optional timeout in milliseconds (default: 30s)
 * @param cwd Optional working directory
 */
export function execCommand(
  command: string,
  timeoutMs: number = 30_000,
  cwd?: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = exec(command, { timeout: timeoutMs, cwd }, (error, stdout, stderr) => {
      if (error) {
        const msg = `Command failed [${command}]: ${stderr || error.message}`
        return reject(new Error(msg))
      }
      resolve(stdout.trim())
    })

    // Safety: handle process errors (spawn, permissions, etc.)
    proc.on("error", (err) => {
      reject(new Error(`Failed to start command [${command}]: ${err.message}`))
    })
  })
}

/**
 * Run multiple commands sequentially and return their results.
 */
export async function execCommands(
  commands: string[],
  timeoutMs: number = 30_000,
  cwd?: string
): Promise<string[]> {
  const results: string[] = []
  for (const cmd of commands) {
    const out = await execCommand(cmd, timeoutMs, cwd)
    results.push(out)
  }
  return results
}
