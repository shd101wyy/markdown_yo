# Escape-dense text overflows the HTML output buffer

**Status:** Fixed
**Date:** 2026-10-01
**Severity:** Critical — a heap buffer overflow on ordinary input; `"`-heavy text writes past the output buffer's capacity

## Symptom

A paragraph of 5000 `"` characters aborts the native binary:

```
set_len: new length exceeds capacity
```

(rc=134). By the time `set_len` panics, the bytes have already been written
past the end of the allocation. Shorter runs of escapes between safe text
overflow without the panic, because a later `extend_from_ptr` regrows the
buffer before `set_len` is reached.

## Root Cause

`escape_html_buf` (`src/common/utils.yo`) reserved
`input_len + input_len / 8 + 64` bytes, then wrote each escape sequence
through a raw pointer into the reserved space and declared the new length with
`set_len`. Escapes expand by up to 6× (`"` → `&quot;`), so any input where more
than about 1 byte in 40 is a `"` outgrows that reservation. Nothing re-checked
the capacity before the raw writes.

## Fix

Each escape sequence is now appended with `extend_from_ptr`, which grows the
buffer when it must. The up-front `ensure_total_capacity` stays as a
performance hint. All other `set_len` calls in the tree only shrink a list, and
they are now `truncate`, which also drops the removed elements.

Measured on macOS arm64, best of 7 runs:

- `README.md` × 400: unchanged (19.2 → 18.9 ms).
- Text that is about 30% escape characters: 10.9 → 12.8 ms.

`node benchmark/run.js` is unchanged.

## Regression test

`tests/main.test.yo`, "escape-dense text grows the output instead of
overflowing it": 5000 `"` must render to exactly 30008 bytes. It fails with the
old `escape_html_buf` (abort, exit code 6) and passes with the new one.
GuardMalloc is clean on the 5000-quote repro.
