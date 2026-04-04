# WASM Demo — Live Markdown Preview

## Goal

Create a browser-based markdown preview page powered by markdown_yo compiled to WebAssembly. The page has an editor on the left and live HTML preview on the right, with configurable options. Deploy as GitHub Pages.

## Current State

- WASM build exists but targets **Node.js CLI** (`-sNODERAWFS`, `-sENVIRONMENT=node`)
- Only `main` is exported — no callable API from JavaScript
- `markdown_to_html(src: String, options: *(Options)) -> String` exists in `src/parser.yo` but is not accessible from JS
- No existing demo/playground page

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser                                        │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │ Editor       │  │ Preview                │   │
│  │ (textarea)   │──│ (rendered HTML)        │   │
│  │              │  │                        │   │
│  └──────────────┘  └────────────────────────┘   │
│         │                     ▲                  │
│         ▼                     │                  │
│  ┌──────────────────────────────────────────┐   │
│  │  app.js                                  │   │
│  │  - debounced input handler               │   │
│  │  - option toggles                        │   │
│  │  - calls Module._wasm_render(…)          │   │
│  │  - sets innerHTML of preview             │   │
│  └──────────────────────────────────────────┘   │
│         │                     ▲                  │
│         ▼                     │                  │
│  ┌──────────────────────────────────────────┐   │
│  │  Emscripten Module (WASM)                │   │
│  │  - wasm_render(ptr, len, flags) → ptr    │   │
│  │  - wasm_result_len() → i32              │   │
│  │  - wasm_free(ptr)                        │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### WASM API Design

We need a C-callable API that Emscripten can export. Since Yo's `String` type is RC-managed, the API boundary uses raw pointers:

```
wasm_render(input_ptr: *(u8), input_len: i32, option_flags: i32) -> *(u8)
```

- **input_ptr/input_len**: markdown source as a byte buffer (UTF-8)
- **option_flags**: bitfield encoding options:
  - bit 0: `html`
  - bit 1: `xhtml_out`
  - bit 2: `breaks`
  - bit 3: `linkify`
  - bit 4: `typographer`
  - bit 5: `enable_table`
  - bit 6: `enable_strikethrough`
- **Returns**: pointer to null-terminated UTF-8 result string (malloc'd)

Additional exports:
- `wasm_result_len() -> i32` — length of last result (avoids scanning for null)
- `wasm_free(ptr: *(u8))` — free a result pointer

The JS side:
```js
const inputBytes = new TextEncoder().encode(markdownText);
const inputPtr = Module._malloc(inputBytes.length);
Module.HEAPU8.set(inputBytes, inputPtr);

const resultPtr = Module._wasm_render(inputPtr, inputBytes.length, optionFlags);
const resultLen = Module._wasm_result_len();
const html = new TextDecoder().decode(
  Module.HEAPU8.subarray(resultPtr, resultPtr + resultLen)
);

Module._wasm_free(resultPtr);
Module._free(inputPtr);
```

### Why Not `ccall('wasm_render', 'string', ['string'], [text])`?

Emscripten's `ccall` with `'string'` type uses `strlen` to determine the output length, which requires null-terminated strings and scans the entire output. Using raw pointers with an explicit length function is more efficient, especially for large markdown documents that produce large HTML.

## Phases

### Phase 1: WASM API (`src/wasm_api.yo`)

Create a new Yo source file that exports C-callable functions:

1. `wasm_render(input_ptr, input_len, option_flags)` — parse markdown, return HTML pointer
2. `wasm_result_len()` — return last result length
3. `wasm_free(ptr)` — free result memory

The file will:
- Import `markdown_to_html` and `Options` from the library
- Build an `Options` struct from the bitfield
- Construct a `String` from the raw pointer (zero-copy slice → String)
- Call `markdown_to_html`
- Copy the result to a malloc'd buffer and return the pointer

### Phase 2: Browser WASM Build Target (`build.yo`)

Add a new build target `demo` that compiles `src/wasm_api.yo` for the browser:

Key differences from the Node.js WASM build:
- `-sENVIRONMENT=web` — browser only (smaller output)
- `-sMODULARIZE=1 -sEXPORT_NAME=createMarkdownYo` — exports a factory function
- `--no-entry` — no `main` function needed (library mode)
- `-sEXPORTED_FUNCTIONS` — explicitly export our API functions + `_malloc` + `_free`
- No `-sNODERAWFS` or `-sEXIT_RUNTIME` (those are Node.js-specific)

### Phase 3: Demo Page (`demo/`)

Create `demo/` directory with:

#### `demo/index.html`
- Split layout: editor (left 50%) | preview (right 50%)
- Options toolbar at top with checkboxes (html, xhtml, breaks, linkify, typographer, tables, strikethrough)
- CommonMark preset toggle
- Responsive: stacks vertically on mobile
- Loading spinner while WASM initializes
- No external dependencies (no jQuery, no Bootstrap) — pure vanilla HTML/CSS/JS

#### `demo/style.css`
- Clean, modern design
- Monospace font for editor
- Proper code block styling in preview
- Dark/light mode support via `prefers-color-scheme`
- Full-height layout

#### `demo/app.js`
- Load WASM module via `createMarkdownYo()`
- Debounced input handler (~150ms) for live preview
- Option toggle handlers
- Default sample markdown content
- Permalink support (encode markdown + options in URL hash)
- Performance indicator (render time in ms)
- Error handling for WASM load failure

#### `demo/sample.md`
- Default markdown content showcasing features (headings, lists, code, tables, links, etc.)

### Phase 4: Build & Deploy

#### `scripts/build_demo.sh`
1. Build WASM demo target: `yo build demo`
2. Copy `.wasm` and `.js` artifacts to `demo/`
3. Result: `demo/` is a self-contained deployable directory

#### `.github/workflows/pages.yml`
1. Trigger: push to `master` branch
2. Steps: checkout → install Yo → install Emscripten → `yo build demo` → copy artifacts → deploy `demo/` to GitHub Pages

### Phase 5: README Update

Add "Live Demo" section to README.md with link to the GitHub Pages URL.

## File Structure

```
demo/
├── index.html          # Main page
├── style.css           # Styles
├── app.js              # JavaScript controller
└── sample.md           # Default sample content

src/
├── wasm_api.yo         # NEW: Browser WASM API entry point
├── main.yo             # Existing CLI entry point (unchanged)
├── lib.yo              # Existing library exports (unchanged)
└── ...

.github/workflows/
├── ci.yml              # Existing CI (unchanged)
└── pages.yml           # NEW: GitHub Pages deployment
```

## Open Questions

1. **String zero-copy**: Can we construct a Yo `String` from a raw pointer without copying? If `String._bytes` is an `ArrayList(u8)`, we need to wrap the pointer. If not possible, we'll memcpy the input — acceptable for a demo.

2. **WASM binary size**: The current Node.js WASM is 391 KB. The browser version should be similar or smaller (no Node.js filesystem code). We could add `--closure 1` to minimize the JS glue.

3. **CodeMirror vs textarea**: A plain `<textarea>` is simplest (zero deps). CodeMirror adds syntax highlighting but ~200KB of JS. For a demo, textarea is fine — can upgrade later.
