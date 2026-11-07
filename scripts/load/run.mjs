#!/usr/bin/env node
import {readFileSync, writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {loadavg, freemem, totalmem} from 'node:os';
import {execFileSync} from 'node:child_process';
import {readFileSync as readProcFile, readlinkSync} from 'node:fs';
import {classify, summarize, gate} from './metrics.mjs';

export function guard({run, url, database, env, fixture}) {
  if (!run) throw Error('Pass --run to enable HTTP traffic');
  const target = new URL(url);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || target.protocol !== 'http:' || target.port !== '4200')
    throw Error('S5 target must be HTTP loopback port 4200');
  if (!/^delivest_s5_load[a-z0-9_]*$/.test(database || '') || !['dev', 'test'].includes(env))
    throw Error('S5 requires MIX_ENV=dev/test and DEV_DATABASE=delivest_s5_load*');
  if (!fixture?.branches || fixture.branches.length !== 5 || fixture.branches.some(b => b.products?.length !== 200))
    throw Error('S5 fixture must contain five branches with 200 products each');
  if (fixture.branches.some(b => !/^[0-9a-f-]{36}$/.test(b.id) ||
    b.products.some(id => !/^[0-9a-f-]{36}$/.test(id))))
    throw Error('S5 fixture IDs must be UUIDs');
}

export function verifyLocalServer(database, fixture, env) {
  const listeners = execFileSync('ss', ['-ltnp'], {encoding: 'utf8'});
  const line = listeners.split('\n').find(x => /127\.0\.0\.1:4200\s/.test(x));
  const pid = line?.match(/pid=(\d+)/)?.[1];
  if (!pid) throw Error('Cannot identify loopback:4200 server PID');
  const variables = readProcFile(`/proc/${pid}/environ`, 'utf8').split('\0');
  if (!variables.includes(`DEV_DATABASE=${database}`) || !variables.includes(`MIX_ENV=${env}`))
    throw Error('Loopback:4200 server does not use the requested dev database');
  const cwd = readlinkSync(`/proc/${pid}/cwd`);
  if (!cwd.endsWith('/delivest/server')) throw Error('Loopback:4200 process is outside this server checkout');
  const sql = `SELECT count(*) FROM branches WHERE id IN (${fixture.branches.map(b => `'${b.id}'`).join(',')})`;
  const result = execFileSync('psql', ['-h', '127.0.0.1', '-U', 'postgres', '-d', database, '-Atc', sql],
    {encoding: 'utf8', env: {...process.env, PGPASSWORD: 'postgres'}}).trim();
  if (result !== '5') throw Error('Fixture branch IDs are absent from dedicated database');
  return pid;
}

function resources(pid) {
  const status = readProcFile(`/proc/${pid}/status`, 'utf8');
  const rssKiB = Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1]);
  return {at: new Date().toISOString(), rssKiB, loadavg: loadavg(), freeMemoryBytes: freemem(), totalMemoryBytes: totalmem()};
}

function telemetry() {
  try { return JSON.parse(readFileSync(process.env.S5_TELEMETRY_FILE || '/tmp/delivest-s5-load-telemetry.json')); }
  catch { return null; }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(session, action, method, path, body, samples, base) {
  const startedAt = Date.now();
  const started = performance.now();
  let status = 0, error = null, data = null;
  try {
    const response = await fetch(base + path, {method, signal: AbortSignal.timeout(10000),
      headers: {'accept': 'application/json', ...(body ? {'content-type': 'application/json'} : {}),
        'x-forwarded-for': session.clientIp,
        ...(session.cookie ? {'cookie': session.cookie} : {}),
        ...(action === 'order' ? {'idempotency-key': randomUUID()} : {})},
      body: body ? JSON.stringify(body) : undefined});
    status = response.status;
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) session.cookie = setCookie.split(';')[0];
    data = await response.json();
  } catch (e) { error = e?.name || 'network_error'; }
  const sample = {action, ms: Math.round((performance.now() - started) * 100) / 100,
    startedAt, completedAt: Date.now(), status, error, classification: classify(status, error)};
  if (samples) samples.push(sample);
  return {sample, data};
}

async function setupSession(branch, index, base, samples = null) {
  const session = {branch, cookie: '', cart: null, items: 0, productOffset: 0, tail: Promise.resolve(),
    clientIp: `198.18.${Math.floor(index / 254)}.${index % 254 + 1}`};
  const result = await request(session, 'setup', 'GET', `/client/cart?branch_id=${branch.id}`, null, samples, base);
  if (result.sample.classification !== 'ok' || !result.data?.data?.id)
    throw Error(`Session setup failed: ${JSON.stringify(result.sample)} ${JSON.stringify(result.data)}`);
  session.cart = result.data.data.id;
  return session;
}

function exclusive(session, callback) {
  const next = session.tail.then(callback);
  session.tail = next.catch(() => {});
  return next;
}

async function action(session, step, samples, base) {
  const branch = session.branch;
  if (step % 10 < 8) {
    return request(session, 'menu', 'GET', `/client/branches/${branch.id}/menu`, null, samples, base);
  }
  if (step % 10 < 10) {
    const product = branch.products[20 + (session.productOffset++ % 180)];
    const result = await request(session, 'cart', 'POST', `/client/cart/${session.cart}/items/${product}`, {}, samples, base);
    if (result.sample.classification === 'ok') session.items++;
    return result;
  }
}

async function placeOrder(session, samples, base) {
  const branch = session.branch;
  if (session.items === 0) {
    const product = branch.products[20 + (session.productOffset++ % 180)];
    const added = await request(session, 'cart', 'POST', `/client/cart/${session.cart}/items/${product}`, {}, samples, base);
    if (added.sample.classification !== 'ok') return added;
    session.items++;
  }
  const body = {cart_id: session.cart, branch_id: branch.id, fulfillment_type: 'pickup',
    payment_method: 'cash', customer_phone: '+79990001122', customer_name: 'S5 Load'};
  const result = await request(session, 'order', 'POST', '/client/orders', body, samples, base);
  if (result.sample.classification === 'ok') {
    session.items = 0;
    const refreshed = await request(session, 'setup', 'GET', `/client/cart?branch_id=${branch.id}`, null, null, base);
    if (refreshed.sample.classification !== 'ok' || !refreshed.data?.data?.id)
      throw Error(`Post-order cart refresh failed: ${JSON.stringify(refreshed.sample)}`);
    session.cart = refreshed.data.data.id;
  }
  return result;
}

export async function run(config) {
  guard(config);
  const pid = verifyLocalServer(config.database, config.fixture, config.env);
  const samples = [];
  const setupStarted = Date.now();
  const sessions = await Promise.all(Array.from({length: config.sessions}, (_, i) =>
    setupSession(config.fixture.branches[i % 5], i, config.url)));
  const setupDurationMs = Date.now() - setupStarted;
  const resourcesBefore = resources(pid), telemetryBefore = telemetry();
  const start = Date.now();
  const deadline = Date.now() + config.seconds * 1000;
  let scheduledOrders = 0, completedOrderFlows = 0;
  const orderWorker = (async () => {
    while (Date.now() < deadline) {
      const due = start + scheduledOrders * 1200;
      await sleep(Math.max(0, due - Date.now()));
      if (Date.now() >= deadline) break;
      const session = sessions[scheduledOrders % sessions.length];
      scheduledOrders++;
      await exclusive(session, () => placeOrder(session, samples, config.url));
      completedOrderFlows++;
    }
  })();
  await Promise.all(sessions.map(async (session, i) => {
    let step = i % 10;
    await sleep(Math.floor(i / config.sessions * config.thinkMs));
    while (Date.now() < deadline) {
      await exclusive(session, () => action(session, step++, samples, config.url));
      await sleep(config.thinkMs);
    }
  }));
  await orderWorker;
  const summary = summarize(samples);
  const successfulOrders = samples.filter(x => x.action === 'order' && x.classification === 'ok' &&
    x.completedAt <= deadline).length;
  const expectedOrders = Math.floor(config.seconds * 50 / 60);
  const throughputGate = successfulOrders >= Math.max(1, expectedOrders - 1);
  const resourcesAfter = resources(pid), telemetryAfter = telemetry();
  const sqlDelta = telemetryBefore && telemetryAfter ? {
    count: telemetryAfter.sql_count - telemetryBefore.sql_count,
    totalUs: telemetryAfter.sql_total_us - telemetryBefore.sql_total_us,
    queueUs: telemetryAfter.sql_queue_us - telemetryBefore.sql_queue_us
  } : null;
  return {config: {url: config.url, database: config.database, env: config.env,
      sessions: config.sessions, seconds: config.seconds, thinkMs: config.thinkMs,
      fixtureSeed: config.fixture.seed, actions: '80% menu, 20% cart; separate paced 50 orders/min; pickup/cash/guest',
      scheduledOrders, completedOrderFlows, successfulOrders, expectedOrders,
      achievedOrdersPerMinute: successfulOrders / config.seconds * 60,
      setupDurationMs, measurementDurationMs: config.seconds * 1000,
      drainDurationMs: Math.max(0, Date.now() - deadline),
      startedAt: new Date(start).toISOString(), endedAt: new Date().toISOString()},
    resources: {before: resourcesBefore, after: resourcesAfter},
    telemetry: {before: telemetryBefore, after: telemetryAfter, sqlDelta},
    summary, gate: throughputGate ? gate(summary) : {pass: false, reason: 'order_throughput'}, samples};
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const arg = name => {const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null;};
  const config = {run: process.argv.includes('--run'), url: arg('--url') || 'http://127.0.0.1:4200',
    database: process.env.DEV_DATABASE, env: process.env.MIX_ENV,
    fixture: JSON.parse(readFileSync(arg('--fixture') || '/tmp/delivest-s5-load-fixture.json')),
    sessions: Number(arg('--sessions') || 1), seconds: Number(arg('--seconds') || 15),
    thinkMs: Number(arg('--think-ms') || 10000)};
  if (!Number.isInteger(config.sessions) || config.sessions < 1 || config.sessions > 1000 ||
      !Number.isInteger(config.seconds) || config.seconds < 1 || config.seconds > 7200 ||
      !Number.isInteger(config.thinkMs) || config.thinkMs < 1000)
    throw Error('Invalid sessions/seconds/think-ms');
  const report = await run(config);
  const output = arg('--output') || `/tmp/delivest-s5-load-${Date.now()}.json`;
  writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({output, ...report.summary, gate: report.gate}));
  if (!report.gate.pass) process.exitCode = 2;
}
