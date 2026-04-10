# WASM Render Returns Empty String for Input Without Trailing Newline

**Status:** Fixed  
**Date:** 2025-04-10  
**Severity:** Critical — all WASM render calls return empty strings for typical input  

## Symptom

Calling `md.render("# Hello")` via the WASM API returns `""` (empty string).  
Adding a trailing newline (`md.render("# Hello\n")`) returns the correct output.

The native CLI was not affected because `echo` and similar tools append `\n` to input.

## Root Cause

`BlockState.new()` in `src/block/state.yo` scans input for line boundaries by looking for `\n` (byte `0x0A`). For input without a trailing newline, the scan loop never pushes a line entry. The sentinel entry appended after the loop gives `line_count = bMarks.len() - 1 = 0`, so `block_tokenize(state, 0, 0)` processes zero lines → empty output.

**Not an RC double-drop bug.** Initial investigation suspected Yo's reference counting ownership model. Extensive analysis confirmed RC is balanced for non-`own` function parameters.

## The Fix

Match markdown-it JS behavior (state_block.mjs line 78):

```js
// JS reference — push line entry on newline OR at end of input
if (ch === 0x0A || pos === len - 1) {
  if (ch !== 0x0A) { pos++ }  // include last char in the line
  this.bMarks.push(start)
  this.eMarks.push(pos)
  // ...
}
```

In `src/block/state.yo`, the condition was changed from:

```rust
if((ch == u8(0x0A)), { ... })
```

to:

```rust
if(((ch == u8(0x0A)) || (pos == (len - i32(1)))), {
  if((ch != u8(0x0A)), { pos = (pos + i32(1)); /* handle indent */ });
  // push line entries...
})
```

Both code paths were fixed:
1. `BlockState.new()` — the main path (fast, no normalization needed)
2. `_build_block_state_from_normalized()` — the normalize path (when `\r` or `\0` present)

## Additional Issue: Stale npm/ WASM Files

The `npm/` directory contains copies of `markdown_yo_wasm_api.js` and `.wasm` that are NOT automatically updated by `yo build wasm_api`. After rebuilding WASM, you must manually copy:

```bash
cp yo-out/wasm32-emscripten/bin/markdown_yo_wasm_api.js npm/
cp yo-out/wasm32-emscripten/bin/markdown_yo_wasm_api.wasm npm/
```

## Verification

After the fix, all tests pass:

```
Test 1 (no newline):  "# Hello"       → "<h1>Hello</h1>\n"      ✓
Test 2 (with newline): "# Hello\n"    → "<h1>Hello</h1>\n"      ✓
Test 3 (paragraph):   "Hello world"   → "<p>Hello world</p>\n"  ✓
Test 4 (multi-line):  "line1\nline2"  → "<p>line1\nline2</p>\n" ✓
Test 5 (empty):       ""              → ""                       ✓
Test 6 (repeat):      "# Repeat"      → "<h1>Repeat</h1>\n"     ✓
Test 7 (bold):        "**bold**"      → "<p><strong>bold</strong></p>\n" ✓
```

Repeated calls all produce correct output.
