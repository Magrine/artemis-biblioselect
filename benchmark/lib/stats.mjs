export function mean(xs) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stddev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  const variance = xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(variance);
}

export function summarize(xs) {
  return { n: xs.length, mean: mean(xs), stddev: stddev(xs), min: Math.min(...xs), max: Math.max(...xs) };
}

export function fmtMs(ms) {
  return `${(ms / 1000).toFixed(2)} s`;
}

export function fmtMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
