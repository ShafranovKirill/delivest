import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [name, ...rest] = value.split('=')
  return [name.replace(/^--/, ''), rest.join('=')]
}))
const base = args.api ?? 'http://localhost:4000'
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('Local benchmark only')
const mode = args.mode ?? 'before'
if (!['before', 'after'].includes(mode)) throw new Error('mode must be before or after')
const pid = Number(args.pid)
if (!Number.isInteger(pid) || pid < 1) throw new Error('Pass the measured backend --pid')
const ticks = Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim())
async function processStats() {
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8')
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const status = await readFile(`/proc/${pid}/status`, 'utf8')
  return { cpu_seconds: (Number(fields[11]) + Number(fields[12])) / ticks,
    rss_kib: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0) }
}
let http = 0
async function request(path, jar, method = 'GET', publicRequest = false) {
  const response = await fetch(base + path, {
    method, headers: publicRequest ? {} : { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
  })
  http++
  if (!response.ok) throw new Error(`${method} ${path}: ${response.status}`)
  if (!publicRequest) for (const cookie of response.headers.getSetCookie()) {
    const value = cookie.split(';')[0]
    const split = value.indexOf('=')
    jar.set(value.slice(0, split), value.slice(split + 1))
  }
  return response.json()
}
const bootstrap = await request('/client/branches', new Map())
const branch = bootstrap.data.find(item => item.slug === (args.slug ?? 'demo-center'))
if (!branch) throw new Error('Demo branch not found')
const visitors = Array.from({ length: 5 }, () => new Map())
async function scenario(jar) {
  if (mode === 'before') {
    await request('/client/franchise', jar)
    await request('/client/branches', jar)
    await request(`/client/branches/slug/${branch.slug}/select`, jar, 'POST')
    await request(`/client/branches/${branch.id}/menu`, jar)
    await request(`/client/${branch.id}/stocks`, jar)
    await request(`/client/branches/${branch.id}/advertising/config`, jar)
    await request(`/client/cart?branch_id=${branch.id}`, jar)
    await request('/client/orders/active', jar)
    await request('/client/socket_token', jar)
  } else {
    await request(`/client/storefront/v1/bootstrap?slug=${branch.slug}&locale=ru`, jar, 'GET', true)
    await request(`/client/session/bootstrap?branch_id=${branch.id}`, jar)
  }
}
// Match restored empty carts in both versions, not new vs existing visitors.
for (const jar of visitors) {
  await request(`/client/cart?branch_id=${branch.id}`, jar)
  await scenario(jar)
}
http = 0
const startStats = await processStats()
const start = performance.now()
await Promise.all(visitors.map(async jar => {
  for (let i = 0; i < 20; i++) await scenario(jar)
}))
const elapsed_ms = performance.now() - start
const endStats = await processStats()
const result = {
  mode, captured_at: new Date().toISOString(), scenarios: 100, concurrency: visitors.length,
  http_requests: http, elapsed_ms: Math.round(elapsed_ms),
  backend_cpu_seconds: endStats.cpu_seconds - startStats.cpu_seconds,
  backend_cpu_seconds_normalized_per_1000: (endStats.cpu_seconds - startStats.cpu_seconds) * 10,
  backend_rss_kib_before: startStats.rss_kib, backend_rss_kib_after: endStats.rss_kib,
  cpu_tick_seconds: 1 / ticks,
  note: 'Local warm API replay, no browser/network throttling. 100 measured scenarios; per1000 is normalized. PostgreSQL CPU not measured. Background backend work is included.',
}
await writeFile(args.output ?? '/tmp/storefront-load.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify(result, null, 2))
