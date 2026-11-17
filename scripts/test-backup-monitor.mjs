import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const source = readFileSync(new URL('../deploy/backup-status/monitor.js', import.meta.url), 'utf8')
const token = 'a'.repeat(64)

class Element {
  constructor() {
    this.textContent = ''
    this.className = ''
    this.children = []
  }
  replaceChildren() { this.children = [] }
  append(...children) { this.children.push(...children) }
  setAttribute() {}
}

function page(fetch) {
  const elements = new Map()
  const timers = []
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element())
      return elements.get(id)
    },
    createElement() { return new Element() }
  }
  vm.runInNewContext(source, {
    location: { hash: `#${token}` }, document, fetch, AbortController, Intl,
    setTimeout(callback, delay) { timers.push({ callback, delay }); return timers.length },
    clearTimeout() {}
  })
  return { elements, timers, get: (id) => document.getElementById(id) }
}

const tick = () => new Promise((resolve) => setImmediate(resolve))

test('terminal status renders without heartbeat and hides raw backend messages', async () => {
  const status = {
    action: 'import', phase: 'complete', step: 'ready', updated_at: '2026-11-17T12:00:00Z',
    steps: [{ step: 'accepted', updated_at: '2026-11-17T11:55:00Z' }, { step: 'ready', updated_at: '2026-11-17T12:00:00Z' }],
    message: 'PRIVATE DATABASE PASSWORD'
  }
  const ui = page(async (path) => {
    if (path.endsWith('heartbeat.json')) throw new Error('offline')
    return { ok: true, json: async () => status }
  })
  await tick()
  assert.match(ui.get('summary').textContent, /Восстановление завершено/)
  assert.equal(ui.get('agent').textContent, 'Агент не отвечает')
  assert.doesNotMatch(ui.get('summary').textContent + ui.get('advice').textContent, /PRIVATE/)
})

test('failed step and pre-swap advice use whitelisted fields; lost connection keeps last state', async () => {
  const status = {
    action: 'import', phase: 'failed', step: 'restarting', failed_step: 'validating_archive',
    safe_to_resume: true, reason_code: 'archive_integrity', updated_at: '2026-11-17T12:00:00Z',
    steps: [{ step: 'validating_archive', updated_at: '2026-11-17T11:55:00Z' }, { step: 'restarting', updated_at: '2026-11-17T11:59:00Z' }]
  }
  let connected = true
  const ui = page(async (path) => {
    if (!connected) throw new Error('offline')
    return { ok: true, json: async () => path.endsWith('heartbeat.json') ? { updated_at: new Date().toISOString() } : status }
  })
  await tick()
  assert.equal(ui.get('steps').children[0].className, 'failed')
  assert.notEqual(ui.get('steps').children[1].className, 'failed')
  assert.match(ui.get('advice').textContent, /Рабочие данные не заменялись/)
  const previous = ui.get('summary').textContent
  connected = false
  ui.timers.find((timer) => timer.delay === 2_000).callback()
  await tick()
  assert.equal(ui.get('summary').textContent, previous)
  assert.match(ui.get('connection').textContent, /последнее состояние/)
})
