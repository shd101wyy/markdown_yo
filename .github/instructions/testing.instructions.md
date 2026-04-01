# Testing Instructions for markdown_yo

## Running Tests

```bash
# Build Yo compiler first
cd ~/Workspace/Yo && bun run build

# Run markdown_yo tests
cd ~/Workspace/markdown_yo && ~/Workspace/Yo/yo-cli build test

# Run a single test file (always use --parallel 1)
~/Workspace/Yo/yo-cli test ./tests/some_test.test.yo --parallel 1

# Run a specific test by name
~/Workspace/Yo/yo-cli test ./tests/some_test.test.yo --test-name-pattern "Test heading" --parallel 1

# Run with verbose output
~/Workspace/Yo/yo-cli test ./tests/some_test.test.yo --bail -v --parallel 1

# Save output to file (avoid terminal truncation)
~/Workspace/Yo/yo-cli test ./tests/some_test.test.yo --bail -v --parallel 1 &> test_output.txt
```

## Test Types

### Unit Tests (.test.yo)
- Test individual parsing rules
- Test utility functions (HTML escape, entity decode, etc.)
- Test edge cases

### Fixture Tests
- Port markdown-it's `test/fixtures/*.txt` files
- Each fixture: input markdown block + expected HTML block
- Verify byte-identical output

### Benchmark Tests
- Correctness: same output as markdown-it for large inputs
- Performance: wall time and memory usage

## Writing Tests

```rust
// Always import test utilities
open import "std/testing";

// Test function pattern
test "heading level 1", (fn() -> unit)({
  (result : String) = markdown_to_html("# Hello\n");
  assert((result == `<h1>Hello</h1>\n`), "heading h1 mismatch");
});
```

## Correctness Verification

Use the CLI to compare output with markdown-it:
```bash
# Generate HTML with markdown_yo
./yo-out/*/bin/markdown_yo input.md > output_yo.html

# Generate HTML with markdown-it
node -e "const md = require('markdown-it')(); const fs = require('fs'); process.stdout.write(md.render(fs.readFileSync('input.md', 'utf8')))" > output_js.html

# Compare
diff output_yo.html output_js.html
```

## Memory Leak Detection

```bash
# Compile with AddressSanitizer
~/Workspace/Yo/yo-cli compile src/main.yo --release --sanitize address --allocator libc -o test_asan
./test_asan input.md > /dev/null
```
