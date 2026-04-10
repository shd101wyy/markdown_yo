# markdown_yo

A high-performance markdown-to-HTML converter written in [Yo](https://github.com/shd101wyy/Yo).

Inspired by [markdown-it](https://github.com/markdown-it/markdown-it) (parsing rules & test fixtures), [md4c](https://github.com/mity/md4c) (performance-focused C design), and [markdown-wasm](https://github.com/rsms/markdown-wasm) (WASM compilation target).

> **See also:** [markdown_it_yo](https://github.com/shd101wyy/markdown_it_yo) — a separate 1:1 direct port of markdown-it to Yo. markdown_yo is a **custom implementation** optimized for speed, while markdown_it_yo faithfully mirrors the original JS architecture for easier maintenance.

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

This is in contrast to [markdown_it_yo](https://github.com/shd101wyy/markdown_it_yo), which faithfully mirrors markdown-it's Token-based AST architecture.

## Features

- **98.7% CommonMark compatibility** — 815/826 spec tests passing
- **5-8× faster than markdown-it** (native), **2-6× faster** (WASM) at ≥1 MB
- Compiles to native executables (macOS, Linux, Windows) and WebAssembly
- Full support: CommonMark, tables, strikethrough, typographer, smartquotes, HTML blocks
- **Inline extensions**: subscript (`~sub~`), superscript (`^sup^`), mark/highlight (`==mark==`), math (`$...$`, `$$...$$`), emoji (`:smile:`), wikilinks (`[[page]]`), critic markup (`{++add++}`, `{--del--}`, etc.)
- **Block extensions**: abbreviations, definition lists, admonitions (`!!! type`), callouts (`> [!type]`), footnotes (`[^id]`)
- **Source map**: optional `data-source-line` attributes on block-level elements for editor integration
- [**Live Demo**](#live-demo) — try it in the browser via WebAssembly

## npm Package (WebAssembly)

Use markdown_yo in JavaScript/TypeScript via WebAssembly:

```bash
npm install markdown_yo
```

```js
import { createRenderer } from "markdown_yo";

const md = await createRenderer();
const html = md.render("# Hello\n\n**World**");
// <h1>Hello</h1>
// <p><strong>World</strong></p>

// With options
md.render(src, { commonmark: true, html: true, typographer: true });

// Enable inline extensions
md.render("H~2~O is ==water==", { subscript: true, mark: true });
// <p>H<sub>2</sub>O is <mark>water</mark></p>

// Enable all optional features at once
md.render(src, { fullFeatures: true });

// Source map for editor integration
md.render(src, { sourceMap: true });
// Block elements get data-source-line="N" attributes
```

See [docs/WASM.md](docs/WASM.md) for the full API reference, browser usage, and examples.

## Live Demo

Try markdown_yo in the browser — no install needed:

👉 **[Live Demo](https://shd101wyy.github.io/markdown_yo/)**

The demo compiles markdown_yo to WebAssembly (383 KB) and renders markdown in real-time as you type. Options for CommonMark mode, HTML tags, and typographic replacements are available.

## Benchmarks

Comparison against markdown-it (Node.js) — median of 10 runs, 3 warmup:

| Input Size | markdown-it (JS) | Native   | Speedup | WASM     | Speedup |
| ---------- | ---------------- | -------- | ------- | -------- | ------- |
| 64 KB      | 1.6 ms           | 0.4 ms   | 4.5×    | 12.9 ms  | 0.1×    |
| 256 KB     | 6.7 ms           | 1.2 ms   | 5.3×    | 13.1 ms  | 0.5×    |
| 1 MB       | 28.8 ms          | 4.8 ms   | 6.0×    | 13.5 ms  | 2.1×    |
| 5 MB       | 158.9 ms         | 23.3 ms  | 6.8×    | 32.6 ms  | 4.9×    |
| 20 MB      | 722.8 ms         | 95.4 ms  | 7.6×    | 121.5 ms | 6.0×    |

_Native: Apple M4, macOS, clang -O3 -flto. WASM: Emscripten, Node.js, -O3 -flto._
_Native and WASM times use `--repeat 20` to amortize process/WASM startup._
_WASM overhead at small sizes (64K, 256K) is dominated by Node.js WASM compilation startup (~12ms)._

## Build

```bash
# Build native executable
yo build

# Build WASM CLI target (Node.js NODERAWFS)
yo build wasm_exe

# Build WASM API module (browser + Node.js)
yo build wasm_api
./scripts/build_demo.sh  # or manually: copy yo-out/wasm32-emscripten/bin/markdown_yo_wasm_api.{js,wasm} to demo/
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

# Inline extensions
markdown_yo --subscript --superscript --mark --math file.md
markdown_yo --emoji --wikilink --critic file.md

# Block extensions
markdown_yo --abbr --deflist --admonition --callout --footnote file.md

# Enable all extensions at once
markdown_yo --full-features file.md

# Source map (adds data-source-line attributes for editor integration)
markdown_yo --source-map file.md

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

## Optimizations Applied

Key performance techniques beyond the SAX architecture:

- **Block-start dispatch table** — 128-byte lookup table maps first char → candidate rules, skipping irrelevant block rules entirely
- **Combined inline pre-scan table** — 256-byte table encodes 3-way dispatch (0=safe, 1=inline-special, 2=HTML-escape-only) for inline content processing
- **Escape-HTML lookup table** — 256-byte table with direct pointer writes for `&amp;`, `&lt;`, `&gt;`, `&quot;`; eliminates branches in the hot escape path
- **Reusable buffers** — InlineState holds pre-allocated buffers for validation, entities, and link parsing, avoiding per-token allocations
- **Fence batch emit** — fenced code blocks with no indent emit the entire content range in one `escape_html_buf` call
- **Table 3-way cell dispatch** — table cells use the combined special_table: special→full inline parse, HTML-char→escape only, pure text→direct memcpy
- **Deferred table allocation** — column alignment arrays are counted in silent mode, allocated only when rendering
- **Pre-allocated output buffer** — renderer allocates ~1.5× input size upfront, growing only for pathological inputs
- **Borrow-chain RC optimization** — Yo compiler eliminates redundant `dup`/`drop` calls for borrowed references (e.g., HashMap lookups), removing RC overhead from the hot path

## Acknowledgments

- [markdown-it](https://github.com/markdown-it/markdown-it) by Vitaly Puzrin and Alex Kocharin — parsing rules, test fixtures, and CommonMark compliance strategy
- [md4c](https://github.com/mity/md4c) by Martin Mitáš — inspiration for performance-focused C design
- [markdown-wasm](https://github.com/rsms/markdown-wasm) — inspiration for WASM compilation target
