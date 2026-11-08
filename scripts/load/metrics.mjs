export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
}

export function classify(status, error) {
  if (error || status === 0 || status >= 500) return 'technical';
  if (status >= 400) return 'business';
  return 'ok';
}

export function summarize(samples) {
  const byAction = {};
  for (const action of ['menu', 'cart', 'order']) {
    const selected = samples.filter(sample => sample.action === action);
    const times = selected.filter(sample => sample.classification === 'ok').map(sample => sample.ms);
    byAction[action] = {count: selected.length, ok: times.length,
      p50: percentile(times, .50), p95: percentile(times, .95), p99: percentile(times, .99),
      technical: selected.filter(sample => sample.classification === 'technical').length,
      business: selected.filter(sample => sample.classification === 'business').length};
  }
  const technical = samples.filter(sample => sample.classification === 'technical').length;
  const business = samples.filter(sample => sample.classification === 'business').length;
  const limited = samples.filter(sample => sample.status === 429).length;
  return {count: samples.length, technical, business,
    limited, technicalRate: samples.length ? technical / samples.length : null, byAction};
}

export function gate(summary, minimum = 100) {
  const a = summary.byAction;
  if (summary.count < minimum || Object.values(a).some(x => x.ok < 10)) return {pass: false, reason: 'insufficient_samples'};
  if (summary.technicalRate >= .001) return {pass: false, reason: 'technical_errors'};
  if (summary.limited) return {pass: false, reason: 'rate_limited'};
  if (summary.business) return {pass: false, reason: 'unexpected_business_errors'};
  for (const [action, limit] of [['menu', 200], ['cart', 300], ['order', 500]]) {
    if (a[action].p95 > limit) return {pass: false, reason: `${action}_p95`};
  }
  return {pass: true, reason: 'thresholds_met_for_short_run_only'};
}
