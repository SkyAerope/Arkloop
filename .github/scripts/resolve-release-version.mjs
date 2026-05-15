#!/usr/bin/env node
import fs from 'node:fs'

function fail(message) {
  console.error(message)
  process.exit(1)
}

function normalizeVersion(raw) {
  return raw.trim().replace(/^refs\/tags\//, '').replace(/^v/, '')
}

function resolvePackageVersion(releaseVersion, shouldDateEncode) {
  if (!shouldDateEncode) {
    return releaseVersion
  }

  const dateRelease = releaseVersion.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (dateRelease) {
    const major = Number(dateRelease[1])
    const minor = Number(dateRelease[2])
    const day = Number(dateRelease[3])
    const daily = Number(dateRelease[4])
    if (minor < 1 || minor > 12 || day < 1 || day > 31 || daily < 0 || daily > 99) {
      fail(`invalid date release version: ${releaseVersion}`)
    }
    return `${major}.${minor}.${day * 100 + daily}`
  }

  const incompleteDateRelease = releaseVersion.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (incompleteDateRelease) {
    const minor = Number(incompleteDateRelease[2])
    const day = Number(incompleteDateRelease[3])
    if (minor >= 1 && minor <= 12 && day >= 1 && day <= 31) {
      fail(`date release tags must include the daily sequence: v${releaseVersion}.0`)
    }
  }

  return releaseVersion
}

const inputVersion = process.env.INPUT_VERSION?.trim()
const githubRefName = process.env.GITHUB_REF_NAME?.trim() ?? ''
const releaseTagInput = process.env.RELEASE_TAG?.trim() || (githubRefName.startsWith('v') ? githubRefName : '')
const fallbackVersion = process.env.FALLBACK_VERSION?.trim()
const rawVersion = releaseTagInput || inputVersion || fallbackVersion

if (!rawVersion) {
  fail('missing release version input')
}

const shouldDateEncode = Boolean(inputVersion || releaseTagInput)
const releaseVersion = normalizeVersion(rawVersion)
const dateReleasePattern = /^\d+\.\d+\.\d+\.\d+$/
if ((releaseTagInput || inputVersion?.startsWith('v')) && !dateReleasePattern.test(releaseVersion)) {
  fail(`release tags must use the daily sequence format: vYY.M.D.N`)
}
const tag = `v${releaseVersion}`
const packageVersion = resolvePackageVersion(releaseVersion, shouldDateEncode)

if (packageVersion !== 'dev' && !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  fail(`release version must resolve to a three-part package version, got: ${packageVersion}`)
}

const outputs = {
  tag,
  name: tag,
  release_version: releaseVersion,
  version: packageVersion,
  package_version: packageVersion,
}

const githubOutput = process.env.GITHUB_OUTPUT
if (githubOutput) {
  fs.appendFileSync(
    githubOutput,
    Object.entries(outputs).map(([key, value]) => `${key}=${value}`).join('\n') + '\n',
  )
}

if (process.env.PRINT_JSON === '1') {
  process.stdout.write(`${JSON.stringify(outputs)}\n`)
}
