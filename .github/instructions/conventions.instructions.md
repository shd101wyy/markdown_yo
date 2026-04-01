# Conventions for markdown_yo

## Naming
- snake_case for all identifiers (functions, variables, types, files)
- Module files use snake_case: `html_escape.yo`, `parse_link_label.yo`
- Enum variants use PascalCase: `InlineType.CodeInline`, `ParentType.Blockquote`

## Performance Rules
- **Never allocate String for source content references.** Use `str` slices (pointer + length into source buffer).
- **Never create Token objects for block-level parsing.** Call renderer methods directly.
- **Reuse ArrayList buffers** — call `.clear()` instead of creating new lists.
- **Pre-allocate output buffer** at ~1.5× input size.
- **Use pointer-based access** (`*(u8)`) in hot inner loops.
- **Avoid HashMap in hot paths** — use direct array indexing or enum dispatch.

## String Types
- `str` — for referencing substrings of source input (zero-copy, no allocation)
- `String` — only for output buffer content and values that must outlive the source
- Template strings `` ` `` — for constant String values (e.g., HTML tag literals)

## Module Organization
- One file per block/inline rule
- State structs in `block/state.yo` and `inline/state.yo`
- Shared utilities in `common/`
- URL utilities in `mdurl/`
- Link parsing helpers in `helpers/`

## Testing
- Test fixtures follow markdown-it format: input markdown → expected HTML
- Each test verifies byte-identical output with markdown-it
- Use `assert(condition, "message")` with descriptive messages
- Run tests with: `~/Workspace/Yo/yo-cli build test`

## Porting from markdown-it
- Follow markdown-it's rule structure closely for maintainability
- Keep the same function names where possible (camelCase → snake_case)
- Keep the same algorithm/logic — don't "optimize" the parsing rules themselves
- Optimize the data representation (Token → direct calls / value-type InlineToken)
- When in doubt, check markdown-it source at `~/Workspace/markdown_it_yo/node_modules/markdown-it/`

## Porting from markdown_it_yo
- Utility modules (entities, unicode, URL) can be copied directly
- Remove all Token/String dependencies — replace with str slices
- Remove Ruler class — hardcode rule chains (same as markdown_it_yo)

## Compatibility Target
- **markdown-it default preset**: tables + strikethrough enabled, HTML disabled
- Byte-identical HTML output for all 815 fixture tests
- Same edge case behavior (emphasis, lists, HTML blocks, etc.)
