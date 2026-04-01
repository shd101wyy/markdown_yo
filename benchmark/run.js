#!/usr/bin/env node
// Benchmark harness: compares markdown-it (JS) vs markdown_yo (native + WASM).
//
// Usage:
//   node benchmark/run.js              # Run all benchmarks
//   node benchmark/run.js --size 1M    # Run only 1M benchmark
//   node benchmark/run.js --warmup 3 --iterations 10
//   node benchmark/run.js --no-wasm    # Skip WASM benchmarks

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

// Parse CLI args
const args = process.argv.slice(2);
const getArg = (name, defaultVal) => {
  const idx = args.indexOf(name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultVal;
};

const sizeFilter = getArg('--size', null);
const WARMUP = parseInt(getArg('--warmup', '3'));
const ITERATIONS = parseInt(getArg('--iterations', '10'));
const skipWasm = args.includes('--no-wasm');

// Paths
const samplesDir = path.join(__dirname, 'samples');
const nativeBin = path.join(__dirname, '..', 'yo-out', 'aarch64-macos', 'bin', 'markdown_yo');
const wasmJs = path.join(__dirname, '..', 'yo-out', 'wasm32-emscripten', 'bin', 'markdown_yo_wasm.js');

// Generate samples if missing
if (!fs.existsSync(samplesDir) || fs.readdirSync(samplesDir).length === 0) {
  console.log('Generating benchmark samples...');
  execSync(`node ${path.join(__dirname, 'generate_samples.js')}`, { stdio: 'inherit' });
}

// Check native binary
if (!fs.existsSync(nativeBin)) {
  console.error(`Native binary not found at ${nativeBin}`);
  console.error('Build with: yo build');
  process.exit(1);
}

// Check WASM binary
const hasWasm = !skipWasm && fs.existsSync(wasmJs);
if (!skipWasm && !hasWasm) {
  console.log('WASM binary not found — skipping WASM benchmarks.');
  console.log(`Build with: yo build wasm\n`);
}

// Load markdown-it
const markdownit = require('markdown-it');

// Discover sample files
let samples = fs.readdirSync(samplesDir)
  .filter(f => f.endsWith('.md'))
  .sort((a, b) => {
    const sizeOrder = { '64K': 0, '256K': 1, '1M': 2, '5M': 3 };
    const getSize = name => {
      const m = name.match(/sample_(\w+)\.md/);
      return m ? (sizeOrder[m[1]] ?? 99) : 99;
    };
    return getSize(a) - getSize(b);
  });

if (sizeFilter) {
  samples = samples.filter(f => f.includes(sizeFilter));
}

if (samples.length === 0) {
  console.error('No sample files found!');
  process.exit(1);
}

// Benchmark function
function benchmarkJS(content, warmup, iterations) {
  const md = markdownit({ html: true });
  // Warmup
  for (let i = 0; i < warmup; i++) md.render(content);
  // Measure
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    md.render(content);
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6); // ms
  }
  return times;
}

function benchmarkNative(filePath, warmup, iterations) {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    execFileSync(nativeBin, [filePath], { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 });
  }
  // Measure with --repeat to amortize process startup
  const REPEAT = 20;
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    execFileSync(nativeBin, ['--repeat', String(REPEAT), filePath], { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 });
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6 / REPEAT); // ms per iteration
  }
  return times;
}

function benchmarkWasm(filePath, warmup, iterations) {
  // Warmup
  for (let i = 0; i < warmup; i++) {
    execFileSync('node', [wasmJs, filePath], { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 });
  }
  // Measure with --repeat to amortize WASM startup
  const REPEAT = 20;
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    execFileSync('node', [wasmJs, '--repeat', String(REPEAT), filePath], { stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 100 * 1024 * 1024 });
    const end = process.hrtime.bigint();
    times.push(Number(end - start) / 1e6 / REPEAT); // ms per iteration
  }
  return times;
}

function stats(times) {
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  const min = times[0];
  const max = times[times.length - 1];
  return { median, mean, min, max };
}

// Run benchmarks
console.log(`\n${'═'.repeat(72)}`);
console.log(`  markdown_yo Benchmark — ${WARMUP} warmup, ${ITERATIONS} iterations`);
console.log(`${'═'.repeat(72)}\n`);

const results = [];

for (const sample of samples) {
  const filePath = path.join(samplesDir, sample);
  const content = fs.readFileSync(filePath, 'utf8');
  const sizeKB = (content.length / 1024).toFixed(0);
  const sizeName = sample.replace('sample_', '').replace('.md', '');

  process.stdout.write(`  ${sizeName.padEnd(6)} (${sizeKB} KB):\n`);

  // JS benchmark
  const jsTimes = benchmarkJS(content, WARMUP, ITERATIONS);
  const jsStats = stats(jsTimes);
  const jsSpeedup = '1.0';
  process.stdout.write(`    JS       ${jsStats.median.toFixed(1).padStart(8)} ms  (baseline)\n`);

  // Native benchmark
  const nativeTimes = benchmarkNative(filePath, WARMUP, ITERATIONS);
  const nativeStats = stats(nativeTimes);
  const nativeSpeedup = (jsStats.median / nativeStats.median).toFixed(1);
  process.stdout.write(`    Native   ${nativeStats.median.toFixed(1).padStart(8)} ms  ${nativeSpeedup}×\n`);

  // WASM benchmark
  let wasmStats = null;
  let wasmSpeedup = null;
  if (hasWasm) {
    const wasmTimes = benchmarkWasm(filePath, WARMUP, ITERATIONS);
    wasmStats = stats(wasmTimes);
    wasmSpeedup = (jsStats.median / wasmStats.median).toFixed(1);
    process.stdout.write(`    WASM     ${wasmStats.median.toFixed(1).padStart(8)} ms  ${wasmSpeedup}×\n`);
  }

  results.push({ sizeName, sizeKB, jsStats, nativeStats, wasmStats, nativeSpeedup, wasmSpeedup });
}

// Summary table
console.log(`\n${'─'.repeat(72)}`);
console.log('  Summary (median times):');
console.log(`${'─'.repeat(72)}`);

const hdr = '  ' + 'Size'.padEnd(8) + 'markdown-it (JS)'.padEnd(20) + 'Native'.padEnd(16) + 'Speedup'.padEnd(10);
if (hasWasm) {
  console.log(hdr + 'WASM'.padEnd(16) + 'Speedup');
} else {
  console.log(hdr);
}
console.log(`  ${'─'.repeat(hasWasm ? 68 : 52)}`);

for (const r of results) {
  let line = '  ' +
    r.sizeName.padEnd(8) +
    `${r.jsStats.median.toFixed(1)} ms`.padEnd(20) +
    `${r.nativeStats.median.toFixed(1)} ms`.padEnd(16) +
    `${r.nativeSpeedup}×`.padEnd(10);
  if (hasWasm && r.wasmStats) {
    line += `${r.wasmStats.median.toFixed(1)} ms`.padEnd(16) + `${r.wasmSpeedup}×`;
  }
  console.log(line);
}

console.log(`${'═'.repeat(72)}\n`);
