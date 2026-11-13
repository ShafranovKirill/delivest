import test from 'node:test';
import assert from 'node:assert/strict';
import {percentile, classify, summarize, gate} from './metrics.mjs';

test('nearest rank percentiles and empty sample', () => {
  assert.equal(percentile([4, 1, 3, 2], .95), 4);
  assert.equal(percentile([], .5), null);
});

test('technical and business failures remain separate', () => {
  assert.equal(classify(500), 'technical');
  assert.equal(classify(429), 'business');
  assert.equal(classify(0, 'timeout'), 'technical');
  const s = summarize([{action: 'menu', classification: 'technical', ms: 12},
    {action: 'menu', classification: 'business', ms: 13},
    {action: 'menu', classification: 'ok', ms: 14}]);
  assert.equal(s.technical, 1);
  assert.equal(s.business, 1);
  assert.equal(s.limited, 0);
  assert.equal(s.byAction.menu.p95, 14);
});

test('gate requires enough successful actions and applies all limits', () => {
  const samples = ['menu', 'cart', 'order'].flatMap(action =>
    Array.from({length: 40}, () => ({action, classification: 'ok', ms: 100})));
  assert.equal(gate(summarize(samples)).pass, true);
  assert.equal(gate(summarize(samples.slice(0, 10))).reason, 'insufficient_samples');
  for (let i = 0; i < 3; i++) samples[i].ms = 300;
  assert.equal(gate(summarize(samples)).reason, 'menu_p95');
  samples[0].classification = 'business';
  samples[0].status = 429;
  assert.equal(gate(summarize(samples)).reason, 'rate_limited');
  samples[0].status = 422;
  assert.equal(gate(summarize(samples)).reason, 'unexpected_business_errors');
});
