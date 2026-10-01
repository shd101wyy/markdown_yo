# The inline special-character table leaked on every render

**Status:** Fixed
**Date:** 2026-10-01
**Severity:** Major — every `markdown_to_html` call leaked one 256-byte allocation, so a long-running host (the WASM build inside an editor preview) grew without bound

## Symptom

Found when CI first ran `yo test ./tests` on Linux, where the test runner checks
for leaks. The escape-dense regression test failed with
`Memory leak detected`. `leaks --atExit` on macOS shows one leaked block
(320 bytes) per call for ANY input, plain text included:

```
ROOT LEAK: <calloc in InlineState.reusable>
  markdown_to_html → BlockState.new → InlineState.reusable → _init_special_table
```

## Root Cause

`InlineState.reusable` called `_init_special_table()`, which callocs a
256-byte lookup table and stores it in the raw `special_table : *u8` field.
Nothing frees a raw pointer field, so every InlineState, one per
`markdown_to_html` call, dropped its table.

## Fix

The table is constant, so it is now built once and shared through
`_get_special_table()`. This is the same lazy singleton `utils.yo` already uses
for the HTML-escape table.

`leaks --atExit` reports 0 leaks for the 5000-quote repro, for plain text, and
for the CLI on a table document. The fixture suite still passes
(1056 passed, 0 failed, 11 skipped).

## Regression test

The Linux CI leak check over `tests/main.test.yo`: both tests call
`markdown_to_html` and failed on this leak before the fix.
