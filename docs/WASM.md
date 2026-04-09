# markdown_yo — WebAssembly API

A high-performance Markdown-to-HTML converter compiled to WebAssembly.

## Installation

```bash
npm install markdown_yo
```

## Quick Start

```js
import { createRenderer } from "markdown_yo";

const md = await createRenderer();
const html = md.render("# Hello\n\n**World**");
console.log(html);
// <h1>Hello</h1>
// <p><strong>World</strong></p>
```

## API

### `createRenderer(wasmOptions?): Promise<MarkdownRenderer>`

Creates a new renderer instance by loading the WebAssembly module.
Call this once and reuse the returned renderer for all conversions.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `wasmOptions` | `WasmOptions` | Optional. Configuration for the Emscripten module loader. |

**`WasmOptions`:**

| Property | Type | Description |
|----------|------|-------------|
| `locateFile` | `(path: string, prefix: string) => string` | Custom resolver for the `.wasm` file location |

**Returns:** `Promise<MarkdownRenderer>`

---

### `MarkdownRenderer.render(markdown, options?): string`

Render a Markdown string to HTML.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `markdown` | `string` | The Markdown source text |
| `options` | `RenderOptions` | Optional. Rendering options |

**`RenderOptions`:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `commonmark` | `boolean` | `false` | Use CommonMark-compliant parsing |
| `html` | `boolean` | `false` | Allow raw HTML tags in output |
| `typographer` | `boolean` | `false` | Enable typographic replacements (`"` → `"`, `--` → `—`, etc.) |
| `subscript` | `boolean` | `false` | Enable `~subscript~` syntax → `<sub>` |
| `superscript` | `boolean` | `false` | Enable `^superscript^` syntax → `<sup>` |
| `mark` | `boolean` | `false` | Enable `==highlight==` syntax → `<mark>` |
| `math` | `boolean` | `false` | Enable `$inline$` and `$$block$$` math syntax |
| `fullFeatures` | `boolean` | `false` | Enable all optional features at once |

**Returns:** `string` — the rendered HTML

---

### `MarkdownRenderer.destroy(): void`

Release WASM module resources. The renderer should not be used after calling this.

## Examples

### Node.js

```js
const { createRenderer } = require("markdown_yo");

async function main() {
  const md = await createRenderer();

  // Basic rendering
  console.log(md.render("# Title\n\nA paragraph with **bold** text."));

  // With CommonMark mode
  console.log(md.render(source, { commonmark: true }));

  // Allow HTML passthrough
  console.log(md.render("<div>raw html</div>", { html: true }));

  md.destroy();
}

main();
```

### Browser (bundler)

```js
import { createRenderer } from "markdown_yo";

const md = await createRenderer();
document.getElementById("preview").innerHTML = md.render(markdownSource);
```

### Browser (script tag)

```html
<script src="https://unpkg.com/markdown_yo/markdown_yo_demo.js"></script>
<script src="https://unpkg.com/markdown_yo/index.js"></script>
<script>
  markdownYo.createRenderer().then((md) => {
    const html = md.render("# Hello from **markdown_yo**!");
    document.body.innerHTML = html;
  });
</script>
```

### Custom WASM file location

If you host the `.wasm` file separately (e.g., on a CDN), use `locateFile`:

```js
const md = await createRenderer({
  locateFile: (path) => `https://cdn.example.com/wasm/${path}`,
});
```

### TypeScript

```ts
import { createRenderer, type RenderOptions } from "markdown_yo";

const md = await createRenderer();

const opts: RenderOptions = { commonmark: true, html: true };
const html: string = md.render("# Hello", opts);
```

## Supported Markdown Features

- **CommonMark** — 815/826 spec tests pass (98.7%)
- **GFM Tables** — pipe tables with alignment
- **Strikethrough** — `~~text~~`
- **Fenced code blocks** — with language info strings
- **HTML passthrough** — when `html: true` is set
- **Typographic replacements** — when `typographer: true` is set
- **Subscript** — `~text~` → `<sub>text</sub>` (when `subscript: true`)
- **Superscript** — `^text^` → `<sup>text</sup>` (when `superscript: true`)
- **Mark/Highlight** — `==text==` → `<mark>text</mark>` (when `mark: true`)
- **Math** — `$inline$` and `$$block$$` math (when `math: true`)

## Live Demo

Try it in the browser: **https://shd101wyy.github.io/markdown_yo/**

## Building from Source

Requires the [Yo compiler](https://github.com/shd101wyy/Yo) and [Emscripten](https://emscripten.org/).

```bash
# Install Yo compiler
npm install -g @shd101wyy/yo

# Build the WASM demo target
yo build demo

# Output files:
#   yo-out/wasm32-emscripten/bin/markdown_yo_demo.js
#   yo-out/wasm32-emscripten/bin/markdown_yo_demo.wasm
```
