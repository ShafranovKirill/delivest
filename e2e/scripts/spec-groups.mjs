#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const e2eDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const testsDir = join(e2eDir, 'tests')
const groups = JSON.parse(readFileSync(join(e2eDir, 'spec-groups.json'), 'utf8'))

function specsIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return specsIn(path)
    return entry.isFile() && entry.name.endsWith('.spec.ts')
      ? [relative(testsDir, path).split(sep).join('/')]
      : []
  })
}

function validate() {
  const errors = []
  const actual = new Set(specsIn(testsDir))
  const listed = new Map()
  if (!groups || Array.isArray(groups) || typeof groups !== 'object' || Object.keys(groups).length === 0) {
    throw new Error('Expected a nonempty map of spec groups')
  }

  for (const [group, files] of Object.entries(groups)) {
    if (!/^[a-z][a-z0-9-]*$/.test(group)) errors.push(`Invalid group ID: ${group}`)
    if (!Array.isArray(files) || files.length === 0) {
      errors.push(`Group ${group} must contain spec files`)
      continue
    }
    for (const file of files) {
      if (typeof file !== 'string' || !/^(?:[\w-]+\/)*[\w-]+\.spec\.ts$/.test(file)) {
        errors.push(`Invalid spec path in ${group}: ${String(file)}`)
        continue
      }
      if (listed.has(file)) errors.push(`Duplicate spec ${file} in ${listed.get(file)} and ${group}`)
      listed.set(file, group)
      if (!actual.has(file)) errors.push(`Missing spec file: tests/${file}`)
    }
  }
  for (const file of actual) {
    if (!listed.has(file)) errors.push(`Unassigned spec file: tests/${file}`)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  return { groups: Object.keys(groups).length, specs: actual.size }
}

const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const selectors = group => groups[group].map(file =>
  `(?:^|[\\/])tests[\\/]${escapeRegex(file).replaceAll('/', '[\\/]')}$`)

function selectedGroup(group) {
  if (!Object.hasOwn(groups, group)) throw new Error(`Unknown group: ${group}`)
  return selectors(group)
}

function collect(selectors = [], label = 'full suite') {
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', ...selectors, '--list', '--reporter=json'], {
    cwd: e2eDir, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024
  })
  if (result.error || result.status !== 0) {
    throw new Error(`Playwright collection failed for ${label} (status ${result.status}):\n${result.error || ''}\n${result.stderr || ''}\n${result.stdout || ''}`)
  }
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch (error) {
    throw new Error(`Invalid Playwright JSON for ${label}: ${error.message}\n${result.stdout}\n${result.stderr}`)
  }
  if (report.errors?.length) throw new Error(`Playwright collection errors for ${label}: ${JSON.stringify(report.errors)}`)
  const files = report.suites.map(suite => suite.file.replaceAll('\\', '/').replace(/^tests\//, ''))
  const tests = []
  const visit = suite => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) tests.push(`${spec.id}:${test.projectId}`)
    }
    for (const child of suite.suites || []) visit(child)
  }
  report.suites.forEach(visit)
  if (tests.length === 0) throw new Error(`Playwright collected no tests for ${label}`)
  return { files, tests }
}

function verifyCollection() {
  const full = collect()
  const groupedTests = []
  for (const group of Object.keys(groups)) {
    const selected = collect(selectedGroup(group), group)
    const expected = [...groups[group]].sort()
    if (JSON.stringify([...selected.files].sort()) !== JSON.stringify(expected)) {
      throw new Error(`Playwright selected wrong specs for ${group}: ${JSON.stringify(selected.files)}`)
    }
    groupedTests.push(...selected.tests)
    console.log(`${group}: ${selected.files.length} specs, ${selected.tests.length} tests`)
  }
  if (JSON.stringify(groupedTests.sort()) !== JSON.stringify(full.tests.sort())) {
    throw new Error('Grouped Playwright tests differ from the complete unfiltered collection')
  }
  console.log(`Complete collection: ${full.files.length} specs, ${full.tests.length} tests`)
}

try {
  const [command, group, ...args] = process.argv.slice(2)
  const summary = validate()
  switch (command) {
    case 'validate':
      console.log(`Validated ${summary.specs} specs in ${summary.groups} groups`)
      break
    case 'matrix':
      console.log(JSON.stringify({ include: Object.keys(groups).map(group => ({ group })) }))
      break
    case 'verify-collection':
      verifyCollection()
      break
    case 'run': {
      const result = spawnSync('pnpm', ['exec', 'playwright', 'test', ...selectedGroup(group), ...args], {
        cwd: e2eDir, stdio: 'inherit'
      })
      process.exit(result.status ?? 1)
      break
    }
    default:
      throw new Error('Usage: node scripts/spec-groups.mjs validate|matrix|verify-collection|run <group> [Playwright options]')
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
