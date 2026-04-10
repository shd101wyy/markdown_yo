// markdown_yo demo — WASM bridge + live preview

const SAMPLE = `# markdown_yo

A **fast** Markdown parser compiled to WebAssembly.

## Features

- CommonMark compliant (815/826 tests pass)
- 5–7× faster than markdown-it (native)
- Zero dependencies
- Written in [Yo](https://github.com/shd101wyy/Yo)

## Code Example

\`\`\`javascript
const { createRenderer } = require("@aspect-build/markdown_yo");
const renderer = createRenderer();
const html = await renderer.render("# Hello", { html: true, math: true });
\`\`\`

\`\`\`python
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
\`\`\`

## Table

| Feature       | markdown_yo | markdown-it |
|---------------|:-----------:|:-----------:|
| CommonMark    | ✓           | ✓           |
| GFM tables    | ✓           | plugin      |
| Strikethrough | ✓           | plugin      |
| Math          | ✓           | plugin      |
| WASM          | ✓           | —           |

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

---

## Inline Extensions

- Subscript: H~2~O
- Superscript: x^2^ + y^2^ = z^2^
- ==Highlighted text==
- Emoji: :rocket: :heart: :tada:

## Math

Inline math: $E = mc^2$

Display math:

$$
\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}
$$

## Footnotes

Here is a footnote reference[^1], and another[^2].

[^1]: This is the first footnote.
[^2]: This is the second footnote with **formatting**.

## Definition List

Term 1
:   Definition for term 1

Term 2
:   Definition for term 2a
:   Definition for term 2b

## Abbreviations

*[HTML]: Hyper Text Markup Language
*[CSS]: Cascading Style Sheets
*[WASM]: WebAssembly

This page uses HTML, CSS, and WASM.

## Admonition

!!! note "Important"
    This is an admonition block with **markdown** support.

!!! warning
    Be careful with raw HTML when the HTML option is enabled.

## Callout

> [!tip]
> Callouts work like GitHub-flavored alerts.

> [!warning]
> This is a warning callout.

## HTML (enable "HTML" option)

<details>
<summary>Click to expand</summary>

This is hidden content with **markdown** inside.

</details>

## Emphasis & More

This is *italic*, this is **bold**, and this is ***both***.

This has \`inline code\` and ~~strikethrough~~.

Visit [GitHub](https://github.com) for more.

### Lists

1. First item
2. Second item
   - Nested bullet
   - Another one
3. Third item
`;

let Module = null;
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const loading = document.getElementById('loading');
const renderTimeEl = document.getElementById('render-time');

// Option checkboxes and their flag bits
const OPTIONS = [
  // { id, bit }
  { id: 'opt-html',        bit: 1 },       // bit 1 = html
  { id: 'opt-typographer',  bit: 2 },       // bit 2 = typographer (bit 0 commonmark removed from UI)
  { id: 'opt-subscript',    bit: 3 },
  { id: 'opt-superscript',  bit: 4 },
  { id: 'opt-mark',         bit: 5 },
  { id: 'opt-math',         bit: 6 },
  { id: 'opt-emoji',        bit: 7 },
  { id: 'opt-wikilink',     bit: 8 },
  { id: 'opt-critic',       bit: 9 },
  { id: 'opt-abbr',         bit: 10 },
  { id: 'opt-deflist',      bit: 11 },
  { id: 'opt-admonition',   bit: 12 },
  { id: 'opt-callout',      bit: 13 },
  { id: 'opt-footnote',     bit: 14 },
  // bit 15 = source_map (not in UI)
  { id: 'opt-breaks',       bit: 16 },
  // bit 17 = xhtml_out (not in UI)
];

function getFlags() {
  let flags = 0;
  for (const opt of OPTIONS) {
    const el = document.getElementById(opt.id);
    if (el && el.checked) flags |= (1 << opt.bit);
  }
  return flags;
}

// Post-process: apply syntax highlighting and MathJax typesetting
function postProcess() {
  // Syntax highlighting
  preview.querySelectorAll('pre code[class*="language-"]').forEach(block => {
    hljs.highlightElement(block);
  });

  // MathJax: find mathjax-exps elements and typeset
  if (window.MathJax && window.MathJax.typesetPromise) {
    // Replace mathjax-exps wrappers with raw delimiters for MathJax
    preview.querySelectorAll('.mathjax-exps').forEach(el => {
      const text = el.textContent;
      el.textContent = text; // reset to plain text for MathJax to pick up
    });
    MathJax.typesetPromise([preview]).catch(err => console.warn('MathJax error:', err));
  }
}

function render() {
  if (!Module) return;

  const src = editor.value;
  const encoder = new TextEncoder();
  const inputBytes = encoder.encode(src);

  const inputPtr = Module._malloc(inputBytes.length);
  Module.HEAPU8.set(inputBytes, inputPtr);

  const t0 = performance.now();
  const resultPtr = Module._wasm_render(inputPtr, inputBytes.length, getFlags());
  const resultLen = Module._wasm_result_len();
  const t1 = performance.now();

  const resultBytes = Module.HEAPU8.subarray(resultPtr, resultPtr + resultLen);
  const html = new TextDecoder().decode(resultBytes);

  Module._wasm_free(resultPtr);
  Module._free(inputPtr);

  preview.innerHTML = html;
  renderTimeEl.textContent = (t1 - t0).toFixed(1) + ' ms';

  // Apply highlighting and math rendering
  postProcess();
}

// Debounce helper
let timer = null;
function debouncedRender() {
  clearTimeout(timer);
  timer = setTimeout(render, 120);
}

// Set up event listeners
editor.addEventListener('input', debouncedRender);
for (const opt of OPTIONS) {
  const el = document.getElementById(opt.id);
  if (el) el.addEventListener('change', render);
}

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
