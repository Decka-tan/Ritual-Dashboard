const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const root = path.resolve(__dirname, '..')
const logDir = path.join(root, 'logs')
const lockPath = path.join(logDir, 'refresh.lock')
const logPath = path.join(logDir, 'refresh.log')

function timestamp() {
  return new Date().toISOString()
}

function log(message) {
  const line = `[${timestamp()}] ${message}`
  console.log(line)
  fs.appendFileSync(logPath, `${line}\n`)
}

function resolveCommand(command) {
  if (process.platform === 'win32' && command === 'npm') return 'npm.cmd'
  if (process.platform === 'win32' && command === 'npx') return 'npx.cmd'
  return command
}

function run(command, args) {
  const executable = resolveCommand(command)
  log(`RUN ${command} ${args.join(' ')}`)
  const result = spawnSync(executable, args, {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
    encoding: 'utf8',
  })

  if (result.stdout) fs.appendFileSync(logPath, result.stdout)
  if (result.stderr) fs.appendFileSync(logPath, result.stderr)

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`)
  }
}

function ensureNotLocked() {
  fs.mkdirSync(logDir, { recursive: true })

  if (!fs.existsSync(lockPath)) return

  const stat = fs.statSync(lockPath)
  const ageMinutes = (Date.now() - stat.mtimeMs) / 60000
  if (ageMinutes > 120) {
    log(`Removing stale lock older than 120 minutes: ${lockPath}`)
    fs.rmSync(lockPath, { force: true })
    return
  }

  throw new Error(`Refresh already running. Lock exists: ${lockPath}`)
}

function main() {
  ensureNotLocked()
  fs.writeFileSync(lockPath, String(process.pid))

  try {
    log('Refresh started')
    run('node', ['scripts/sync-sheet.cjs'])
    run('node', ['scripts/capture-previews.cjs'])
    run('node', ['node_modules/vite/bin/vite.js', 'build'])
    log('Refresh completed')
  } finally {
    fs.rmSync(lockPath, { force: true })
  }
}

try {
  main()
} catch (error) {
  log(`ERROR ${error.message}`)
  process.exit(1)
}
