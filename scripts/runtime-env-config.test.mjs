import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import vm from 'node:vm'

const entrypoint = resolve('docker-entrypoint.sh')

test('runtime config escapes values and omits unset rollout flags', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'delivest-rollout-'))
  const output = join(dir, 'env-config.js')
  try {
    const malicious = 'false";globalThis.injected=true;//\n\t'
    const result = spawnSync('sh', [entrypoint, 'true'], {
      env: {
        ...process.env,
        ENV_CONFIG_PATH: output,
        VITE_API_BASE_URL: 'https://example.test/?q="\\',
        VITE_STOREFRONT_BOOTSTRAP: malicious,
        VITE_STOREFRONT_UPDATES: '',
        VITE_STOREFRONT_BOOTSTRAP_BRANCH_IDS: '11111111-1111-4111-8111-111111111111',
      },
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, result.stderr)
    const context = { window: {} }
    vm.runInNewContext(await readFile(output, 'utf8'), context)
    assert.equal(context.window._env.VITE_STOREFRONT_BOOTSTRAP, malicious)
    assert.equal(context.window._env.VITE_API_BASE_URL, 'https://example.test/?q="\\')
    assert.equal(context.window._env.VITE_STOREFRONT_UPDATES, undefined)
    assert.equal(context.injected, undefined)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
