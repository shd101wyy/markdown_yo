# markdown_yo

A high-performance markdown-to-HTML converter written in [Yo](https://github.com/nicolo-ribaudo/yo-lang).

Inspired by [markdown-it](https://github.com/markdown-it/markdown-it) (parsing rules & test fixtures), [md4c](https://github.com/mity/md4c) (performance-focused C design), and [markdown-wasm](https://github.com/nicolo-ribaudo/markdown-wasm) (WASM compilation target).

> **See also:** [markdown_it_yo](https://github.com/nicolo-ribaudo/markdown_it_yo) — a separate 1:1 direct port of markdown-it to Yo. markdown_yo is a **custom implementation** optimized for speed, while markdown_it_yo faithfully mirrors the original JS architecture for easier maintenance.

## Architecture

markdown_yo uses a **hybrid SAX + token** architecture:

- **Block parser** — SAX-style (streaming). Block rules (paragraph, heading, list, blockquote, code block, table, etc.) call renderer methods **directly** during parsing — no intermediate block token objects are allocated. For example, the heading rule calls `renderer.open_heading(level)` and `renderer.close_heading(level)` inline.

- **Inline parser** — Token accumulation. Inline rules (emphasis, links, code spans, etc.) push lightweight `InlineToken` value-type structs (~40 bytes each) into a reusable buffer. A post-processing pass resolves delimiter pairs (emphasis, strikethrough), then walks the token buffer calling renderer methods.

- **Renderer** — Pure callback receiver. The `HtmlRenderer` exposes SAX-style methods (`open_paragraph()`, `text()`, `open_link()`, etc.) that write directly to a pre-allocated output buffer (~1.5× input size).

Key design choices for performance:
- **Zero-copy** — all content references are `str` slices into the source buffer
- **Value-type tokens** — `InlineToken` is a plain struct with no reference counting
- **No intermediate AST** — block parsing skips token allocation entirely
- **In-place operations** — tight paragraph compaction, bulk memory copies

This is in contrast to [markdown_it_yo](https://github.com/nicolo-ribaudo/markdown_it_yo), which faithfully mirrors markdown-it's Token-based AST architecture.

## Features

- **98.8% CommonMark compatibility** — 671/679 fixture tests passing
- **2× faster than markdown-it** (native), **1.7× faster** (WASM at 5 MB)
- Compiles to native executables (macOS, Linux) and WebAssembly
- Full support: CommonMark, tables, strikethrough, typographer, smartquotes, HTML blocks

## Benchmarks

Comparison against markdown-it (Node.js) — median of 10 runs, 3 warmup:

| Input Size | markdown-it (JS) | Native | Speedup | WASM | Speedup |
|------------|-------------------|--------|---------|------|---------|
| 1 MB       | 31.1 ms           | 13.8 ms | 2.3×   | 19.8 ms | 1.6× |
| 5 MB       | 154.5 ms          | 68.6 ms | 2.3×   | 87.8 ms | 1.8× |
| 20 MB      | 682.7 ms          | 280.8 ms | 2.4×  | 348.5 ms | 2.0× |

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

## Acknowledgments

- [markdown-it](https://github.com/markdown-it/markdown-it) by Vitaly Puzrin and Alex Kocharin — parsing rules, test fixtures, and CommonMark compliance strategy
- [md4c](https://github.com/mity/md4c) by Martin Mitáš — inspiration for performance-focused C design
- [markdown-wasm](https://github.com/nicolo-ribaudo/markdown-wasm) — inspiration for WASM compilation target
