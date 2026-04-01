# Performance Instructions for markdown_yo

## Design Principles

### Zero-copy parsing
- Source input is a `str` (borrowed slice). Never copy it into String.
- All content references (text, code, info strings) are byte offset pairs into the source.
- Only the final HTML output allocates memory (one ArrayList(u8) buffer).

### Value-type inline tokens
- InlineToken is a value-type struct (~40 bytes), not a heap-allocated object.
- ArrayList(InlineToken) is pre-allocated once and `.clear()`-ed per paragraph.
- Delimiter structs are also value types in an ArrayList.

### Direct renderer calls
- Block parser calls renderer methods directly (no intermediate data structure).
- After inline post-processing, iterate InlineToken array and call renderer methods.
- No enum-based event dispatch — direct function calls avoid branch misprediction.

### Output buffer
- Pre-allocate at 1.5× input size (HTML is typically 1.5-2× the markdown size).
- Use `push_str` / `extend_from_slice` for bulk appends.
- HTML escape uses run-batch optimization: find safe runs, memcpy in bulk.

## Profiling

```bash
# macOS: Instruments
xcrun xctrace record --template 'Time Profiler' --launch ./yo-out/*/bin/markdown_yo -- benchmark/samples/bench_5mb.md > /dev/null

# Linux: perf
perf record -g ./yo-out/*/bin/markdown_yo benchmark/samples/bench_5mb.md > /dev/null
perf report
```

## Benchmarking

```bash
# Run full benchmark suite
node benchmark/run.js

# Quick single-run timing
time ./yo-out/*/bin/markdown_yo benchmark/samples/bench_5mb.md > /dev/null

# Memory usage (macOS)
/usr/bin/time -l ./yo-out/*/bin/markdown_yo benchmark/samples/bench_5mb.md > /dev/null
```

## Performance Targets

| Input | markdown-it | markdown_yo target | Speedup |
|-------|-------------|--------------------|---------|
| 1 MB  | ~110ms      | <15ms              | 7×      |
| 5 MB  | ~420ms      | <70ms              | 6×      |
| 20 MB | ~1700ms     | <300ms             | 5×      |

## Anti-patterns to Avoid

- ❌ Allocating String for source substrings → use `str` slices
- ❌ Creating Token objects for block events → call renderer directly
- ❌ Using HashMap for small lookups → use array indexing or switch
- ❌ Calling `.clone()` / `.dup()` on strings in hot paths
- ❌ Re-allocating ArrayList per paragraph → `.clear()` and reuse
- ❌ Using `String.from("literal")` → use template string `` `literal` ``
