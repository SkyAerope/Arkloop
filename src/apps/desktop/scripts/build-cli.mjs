#!/usr/bin/env node

import { execFileSync } from 'child_process'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { parseArgs } from 'util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workspaceRoot = resolve(__dirname, '..', '..', '..', '..')
const outDir = resolve(__dirname, '..', 'cli-bin')

const ALL_TARGETS = [
  { platform: 'darwin', arch: 'arm64' },
  { platform: 'darwin', arch: 'x64' },
  { platform: 'linux', arch: 'x64' },
  { platform: 'linux', arch: 'arm64' },
  { platform: 'win32', arch: 'x64' },
]

const PLATFORM_MAP = { darwin: 'darwin', linux: 'linux', win32: 'windows' }
const ARCH_MAP = { arm64: 'arm64', x64: 'amd64' }

function binaryName(platform, arch) {
  const name = `ark-${platform}-${arch}`
  return platform === 'win32' ? `${name}.exe` : name
}

function currentTarget() {
  const platform = process.platform
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  return { platform, arch }
}

function buildTarget({ platform, arch }) {
  const goos = PLATFORM_MAP[platform]
  const goarch = ARCH_MAP[arch]
  if (!goos) throw new Error(`unsupported platform: ${platform}`)
  if (!goarch) throw new Error(`unsupported arch: ${arch}`)

  const outFile = resolve(outDir, binaryName(platform, arch))
  mkdirSync(outDir, { recursive: true })

  const cgoEnabled = platform === 'darwin' ? '1' : '0'
  console.log(`[build-cli] ${platform}/${arch} -> GOOS=${goos} GOARCH=${goarch} CGO_ENABLED=${cgoEnabled}`)
  console.log(`[build-cli] output: ${outFile}`)

  execFileSync('go', [
    'build',
    '-tags', 'desktop',
    '-trimpath',
    '-ldflags', `-s -w -X main.version=${process.env.ARKLOOP_RELEASE_VERSION || 'dev'}`,
    '-o', outFile,
    './src/services/cli/cmd/ark',
  ], {
    cwd: workspaceRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      GOOS: goos,
      GOARCH: goarch,
      CGO_ENABLED: cgoEnabled,
    },
  })

  console.log(`[build-cli] done: ${platform}/${arch}`)
}

function printHelp() {
  console.log(`Usage: build-cli.mjs [options]

Options:
  --platform <name>   Target platform: darwin, linux, win32 (default: current)
  --arch <name>       Target arch: arm64, x64 (default: current)
  --all               Build for all supported platform/arch combos
  --help              Show this help

Supported targets:
${ALL_TARGETS.map(t => `  ${t.platform}/${t.arch}`).join('\n')}`)
}

const { values } = parseArgs({
  options: {
    platform: { type: 'string' },
    arch: { type: 'string' },
    all: { type: 'boolean', default: false },
    help: { type: 'boolean', default: false },
  },
  strict: true,
})

if (values.help) {
  printHelp()
  process.exit(0)
}

if (values.all) {
  for (const target of ALL_TARGETS) buildTarget(target)
} else {
  const target = {
    platform: values.platform ?? currentTarget().platform,
    arch: values.arch ?? currentTarget().arch,
  }
  buildTarget(target)
}
