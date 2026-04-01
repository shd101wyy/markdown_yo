# markdown_yo

A high-performance markdown-to-HTML converter written in [Yo](https://github.com/nicolo-ribaudo/yo-lang), ported from [markdown-it](https://github.com/markdown-it/markdown-it).

## Features

- **98.8% CommonMark compatibility** — 671/679 fixture tests passing
- **2× faster than markdown-it** (native), **1.7× faster** (WASM at 5MB)
- Compiles to native executables (macOS, Linux) and WebAssembly
- Full support: CommonMark, tables, strikethrough, typographer, smartquotes, HTML blocks

## Benchmarks

Comparison against markdown-it (Node.js) — median of 10 runs, 3 warmup:

| Input Size | markdown-it (JS) | Native | Speedup | WASM | Speedup |
|------------|-------------------|--------|---------|------|---------|
| 64 KB      | 1.9 ms            | 1.0 ms | 1.8×    | —    | —       |
| 256 KB     | 7.1 ms            | 3.7 ms | 1.9×    | 12.9 ms | 0.6× |
| 1 MB       | 29.4 ms           | 14.3 ms | 2.1×   | 20.4 ms | 1.4× |
| 5 MB       | 153.8 ms          | 71.8 ms | 2.1×   | 90.0 ms | 1.7× |

*Native: Apple M4, macOS, clang -O2 -flto. WASM: Emscripten, Node.js, -O2 -flto.*
*Native and WASM times use `--repeat 20` to amortize process/WASM startup.*

## Build

```bash
# Build native executable
yo build

# Build WASM target
yo build wasm
```

## Usage

```bash
# Convert a file
markdown_yo file.md > output.html

# Read from stdin
cat file.md | markdown_yo -

# Options
markdown_yo --html --typographer file.md
markdown_yo --commonmark file.md
markdown_yo --help
```

## Run

```bash
yo build run
```

## Test

```bash
# Run fixture tests (requires Node.js + markdown-it)
node scripts/run_fixture_tests.js

# Run with stats
node scripts/run_fixture_tests.js --suite-stats
```

## Benchmark

```bash
# Run all benchmarks (native + WASM vs JS)
node benchmark/run.js

# Run specific size
node benchmark/run.js --size 1M

# Skip WASM
node benchmark/run.js --no-wasm
```
