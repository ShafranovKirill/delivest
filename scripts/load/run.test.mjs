import test from 'node:test';
import assert from 'node:assert/strict';
import {guard} from './run.mjs';

const id = '00000000-0000-4000-8000-000000000001';
const fixture = {branches: Array.from({length: 5}, () => ({id, products: Array(200).fill(id)}))};
const safe = {run: true, url: 'http://127.0.0.1:4200', database: 'delivest_s5_load_1', env: 'dev', fixture};
test('requires explicit run and isolated loopback target', () => {
  assert.doesNotThrow(() => guard(safe));
  for (const change of [{run: false}, {url: 'http://localhost:4000'},
    {url: 'https://127.0.0.1:4200'}, {url: 'http://example.com:4200'},
    {url: 'http://127.0.0.1:4200/client'}, {url: 'http://user@127.0.0.1:4200'},
    {database: 'delivest'}, {env: 'prod'}, {fixture: {branches: []}}]) {
    assert.throws(() => guard({...safe, ...change}));
  }
  assert.throws(() => guard({...safe, fixture: {branches: fixture.branches.map((b, i) =>
    i ? b : {...b, products: ['bad', ...b.products.slice(1)]})}}));
});
