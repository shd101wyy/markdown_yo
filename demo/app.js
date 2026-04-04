// markdown_yo demo — WASM bridge + live preview

const SAMPLE = `# markdown_yo

A **fast** Markdown parser compiled to WebAssembly.

## Features

- CommonMark compliant (815/826 tests pass)
- 5–7× faster than markdown-it (native)
- Zero dependencies
- Written in [Yo](https://github.com/aspect-build/Yo)

## Code Example

\`\`\`rust
markdown_to_html :: (fn(src: String, opts: *(Options)) -> String)({
  // Block parse → inline parse → HTML render
  // All in a single pass with SAX-style output
});
\`\`\`

## Table

| Feature       | markdown_yo | markdown-it |
|---------------|:-----------:|:-----------:|
| CommonMark    | ✓           | ✓           |
| GFM tables    | ✓           | plugin      |
| Strikethrough | ✓           | plugin      |
| WASM          | ✓           | —           |

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

---

### Lists

1. First item
2. Second item
   - Nested bullet
   - Another one
3. Third item

### Emphasis

This is *italic*, this is **bold**, and this is ***both***.

This has \`inline code\` and ~~strikethrough~~.

### Links & Images

Visit [GitHub](https://github.com) for more.

### HTML (enable "HTML tags" option)

<details>
<summary>Click to expand</summary>

This is hidden content with **markdown** inside.

</details>
`;

let Module = null;
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const loading = document.getElementById('loading');
const renderTimeEl = document.getElementById('render-time');
const optCommonmark = document.getElementById('opt-commonmark');
const optHtml = document.getElementById('opt-html');
const optTypographer = document.getElementById('opt-typographer');

// Build flags bitmask from checkboxes
function getFlags() {
  let flags = 0;
  if (optCommonmark.checked)  flags |= 1;
  if (optHtml.checked)        flags |= 2;
  if (optTypographer.checked) flags |= 4;
  return flags;
}

// Render markdown via WASM
function render() {
  if (!Module) return;

  const src = editor.value;
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(src);

  // Allocate input buffer in WASM memory
  const inputPtr = Module._malloc(inputBytes.length);
  Module.HEAPU8.set(inputBytes, inputPtr);

  const t0 = performance.now();
  const resultPtr = Module._wasm_render(inputPtr, inputBytes.length, getFlags());
  const resultLen = Module._wasm_result_len();
  const t1 = performance.now();

  // Read result from WASM memory
  const resultBytes = Module.HEAPU8.subarray(resultPtr, resultPtr + resultLen);
  const html = new TextDecoder().decode(resultBytes);

  // Free WASM memory
  Module._wasm_free(resultPtr);
  Module._free(inputPtr);

  preview.innerHTML = html;
  renderTimeEl.textContent = (t1 - t0).toFixed(1) + ' ms';
}

// Debounce helper
let timer = null;
function debouncedRender() {
  clearTimeout(timer);
  timer = setTimeout(render, 120);
}

// Set up event listeners
editor.addEventListener('input', debouncedRender);
optCommonmark.addEventListener('change', render);
optHtml.addEventListener('change', render);
optTypographer.addEventListener('change', render);

// Load WASM module
createMarkdownYo().then(mod => {
  Module = mod;
  loading.classList.add('hidden');
  editor.value = SAMPLE;
  render();
}).catch(err => {
  loading.textContent = 'Failed to load WebAssembly: ' + err.message;
  console.error(err);
});
