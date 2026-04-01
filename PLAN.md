# markdown_yo — Plan

A fast, SAX-style markdown-to-HTML parser written in Yo, designed to match
markdown-it's default output while achieving md4c-level performance.

## Goals

1. **Output compatibility**: Byte-identical HTML with markdown-it (default preset)
2. **Performance**: 5–10× faster than markdown-it (Node.js) on native, ≥2× on WASM
3. **Targets**: Native (macOS, Linux, Windows) and WASM (Emscripten)
4. **Zero-copy**: str slices into source buffer wherever possible
5. **Minimal allocation**: No Token objects, no intermediate AST, arena-style inline buffer

## Architecture

### Why SAX-style?

In our markdown_it_yo port, profiling showed **30.6% of time in malloc/free** from
Token and String allocations. The md4c parser proves that a SAX-style (callback-driven)
approach eliminates this overhead entirely.

### Design: SAX core + markdown-it rules

```
Source bytes (str)
  │
  ├─ Normalize (CRLF→LF, null→U+FFFD)
  │
  ├─ Block Parser (line-by-line)
  │   ├─ Calls renderer directly for block open/close events
  │   └─ When inline content found → delegates to Inline Parser
  │
  ├─ Inline Parser (per-paragraph)
  │   ├─ Tokenizes into lightweight InlineToken buffer (value types, reused)
  │   ├─ Post-processes delimiters (balance_pairs, emphasis, strikethrough)
  │   └─ Iterates resolved tokens → calls renderer
  │
  └─ HTML Renderer (callback receiver)
      └─ Writes directly to pre-allocated output buffer (ArrayList(u8))
```

**Key difference from md4c**: We follow markdown-it's parsing rules (not CommonMark),
including its specific behaviors for emphasis, lists, HTML blocks, etc.

**Key difference from markdown_it_yo**: No Token objects, no intermediate token array
for blocks, no String allocations for content/markup/info fields. Everything is either
a direct renderer call or a lightweight value-type InlineToken with byte offsets.

### Data Types

```rust
// Block-level: no data structure — renderer called directly during parsing.
// The block parser maintains a small stack of open containers (blockquote depth,
// list nesting) but does not allocate tokens.

// Inline-level: lightweight value-type token for delimiter post-processing
InlineToken :: struct(
  type_name : InlineType,  // enum (~20 variants)
  start : i32,             // byte offset in source
  end : i32,               // byte offset in source
  nesting : i32,           // -1, 0, 1
  level : i32,
  // Extra fields for links, images, code:
  info_start : i32,        // href/src start
  info_end : i32,          // href/src end
  title_start : i32,       // title start
  title_end : i32,         // title end
  markup_char : u8,        // '*', '_', '~', '`'
  markup_len : u8,         // number of marker chars
  block : bool,
  hidden : bool
);
// ~40 bytes, all value types, zero RC overhead.
// An ArrayList(InlineToken) is pre-allocated once and reused per paragraph.

// Delimiter for emphasis/strikethrough resolution (same as markdown-it)
Delimiter :: struct(
  marker : u8,
  length : i32,
  token_idx : i32,
  end : i32,
  open : bool,
  close : bool
);
```

### Renderer Interface

```rust
// The parser calls these methods directly on the renderer during parsing.
// No intermediate event enum — direct function calls are faster.
HtmlRenderer :: struct(
  buf : ArrayList(u8),     // output buffer
  img_nest : i32,          // inside <img> alt text?
  options : Options
);

// Methods called by block parser:
//   open_paragraph, close_paragraph,
//   open_heading(level), close_heading(level),
//   open_blockquote, close_blockquote,
//   open_list(ordered, start), close_list(ordered),
//   open_list_item, close_list_item,
//   code_block(content: str, info: str),
//   html_block(content: str),
//   hr,
//   open_table, close_table, etc.

// Methods called by inline parser (after post-processing):
//   text(content: str),
//   code_inline(content: str),
//   open_em, close_em,
//   open_strong, close_strong,
//   open_link(href: str, title: str), close_link,
//   image(src: str, alt: str, title: str),
//   softbreak, hardbreak,
//   html_inline(content: str),
//   entity(content: str)
```

### Shared State

```rust
// Block parser state — same line-marker approach as markdown-it
BlockState :: struct(
  src : str,                  // source bytes (borrowed, not owned)
  src_bytes : *(u8),          // raw pointer for fast access
  src_len : i32,
  b_marks : ArrayList(i32),   // line begin positions
  e_marks : ArrayList(i32),   // line end positions
  t_shift : ArrayList(i32),   // first non-space offset
  s_count : ArrayList(i32),   // indent (spaces, tabs expanded)
  bs_count : ArrayList(i32),  // blockquote compensation
  line : i32,
  line_max : i32,
  blk_indent : i32,
  tight : bool,
  dd_indent : i32,
  list_indent : i32,
  parent_type : ParentType,   // enum: Root, Blockquote, List, Paragraph
  level : i32,
  // References discovered during parsing
  references : HashMap(String, Reference),
  // Renderer pointer (for direct calls)
  renderer : *(HtmlRenderer),
  // Options
  options : *(Options)
);

// Inline parser state
InlineState :: struct(
  src : str,                  // inline content (borrowed)
  src_bytes : *(u8),
  pos : i32,
  pos_max : i32,
  level : i32,
  pending_start : i32,        // start of pending text (byte offset, not String!)
  pending_end : i32,
  tokens : ArrayList(InlineToken),   // reusable buffer
  delimiters : ArrayList(Delimiter),
  prev_delimiters : ArrayList(ArrayList(Delimiter)),
  cache : HashMap(i32, i32),
  backticks : HashMap(i32, i32),
  backticks_scanned : bool,
  link_level : i32,
  // Renderer and env for direct calls
  renderer : *(HtmlRenderer),
  env : *(Env),
  options : *(Options)
);
```

## Module Structure

```
src/
  main.yo              — CLI: read file/stdin, parse, output HTML
  lib.yo               — Public API: markdown_to_html(src: str) -> String

  parser.yo            — Top-level orchestrator: normalize → block parse → output
  options.yo           — Options struct + presets (default, commonmark)

  block/
    state.yo           — BlockState struct
    parser.yo          — Block rule dispatch loop
    code.yo            — Indented code blocks
    fence.yo           — Fenced code blocks
    heading.yo         — ATX headings (#)
    lheading.yo        — Setext headings (=== / ---)
    hr.yo              — Horizontal rules
    blockquote.yo      — Block quotes
    list.yo            — Ordered + unordered lists
    paragraph.yo       — Paragraph (fallback)
    table.yo           — GFM tables
    html_block.yo      — HTML blocks
    reference.yo       — Link reference definitions

  inline/
    state.yo           — InlineState struct
    parser.yo          — Inline rule dispatch + post-processing
    text.yo            — Plain text
    newline.yo         — Hard/soft breaks
    escape.yo          — Backslash escapes
    backticks.yo       — Inline code
    emphasis.yo        — Bold/italic (* _)
    strikethrough.yo   — ~~text~~ (GFM)
    link.yo            — [text](url) links
    image.yo           — ![alt](url) images
    autolink.yo        — <url> autolinks
    html_inline.yo     — Inline HTML
    entity.yo          — HTML entities
    balance_pairs.yo   — Delimiter resolution
    fragments_join.yo  — Fragment merging

  renderer.yo          — HtmlRenderer: SAX callbacks → HTML buffer

  common/
    utils.yo           — is_space, is_md_ascii_punct, normalize_reference, etc.
    html_escape.yo     — HTML entity escaping (run-batch optimized)
    entities.yo        — HTML entity decoding
    entities_data.yo   — Entity lookup table (copied from markdown_it_yo)
    html_blocks.yo     — HTML block tag names
    html_re.yo         — HTML tag regex patterns
    unicode_casefold.yo — Unicode case-folding data

  helpers/
    parse_link_destination.yo
    parse_link_label.yo
    parse_link_title.yo

  mdurl/
    parse.yo           — URL parsing
    encode.yo          — URL percent-encoding
    decode.yo          — URL percent-decoding
    format.yo          — URL formatting

tests/
  (test files)

benchmark/
  run.js               — Benchmark harness (JS + native + WASM)
  samples/             — Generated benchmark input files
```

## Implementation Phases

### Phase 0: Foundation
- [ ] Types: Options, ParentType, InlineType, Align enums
- [ ] HtmlRenderer struct with output buffer and escape utilities
- [ ] BlockState and InlineState structs
- [ ] Common utilities: is_space, is_white_space, char_code_at, etc.
- [ ] HTML escaping (run-batch optimized, ported from markdown_it_yo)
- [ ] Normalize pass (CRLF → LF, null → U+FFFD)
- [ ] CLI skeleton: read file/stdin, call parse, write output

### Phase 1: Block Parser (core structure)
- [ ] Line marker precomputation (b_marks, e_marks, t_shift, s_count)
- [ ] Block dispatch loop (try rules in order, same as markdown-it)
- [ ] paragraph (fallback rule)
- [ ] heading (ATX: # ... ######)
- [ ] lheading (setext: === / ---)
- [ ] hr (horizontal rule)
- [ ] code (4-space indent)
- [ ] fence (``` / ~~~)
- [ ] blockquote (> prefix, nested)
- [ ] list (ordered + unordered, loose/tight)
- [ ] html_block (6 patterns)
- [ ] reference (link definitions, stored in env)
- [ ] table (GFM pipe tables)

### Phase 2: Inline Parser
- [ ] Inline dispatch loop with pending text buffering
- [ ] text (optimized skip loop)
- [ ] newline (hard/soft break detection)
- [ ] escape (backslash sequences)
- [ ] backticks (inline code with matching counts)
- [ ] emphasis (open/close with scan_delims)
- [ ] strikethrough (~~text~~)
- [ ] link ([text](url) + reference links)
- [ ] image (![alt](src) + reference images)
- [ ] autolink (<url> and <email>)
- [ ] html_inline (<tag> patterns)
- [ ] entity (&amp; &#123; &#xAF;)
- [ ] balance_pairs post-processor
- [ ] emphasis post-processor
- [ ] strikethrough post-processor
- [ ] fragments_join post-processor

### Phase 3: HTML Renderer
- [ ] Block event handlers (open/close tags, code blocks, HR, tables)
- [ ] Inline event handlers (text, code, emphasis, links, images, breaks)
- [ ] Attribute rendering (link href/title, image src/alt/title)
- [ ] Table alignment attributes
- [ ] img alt text (suppress nested HTML in alt context)
- [ ] Entity pass-through
- [ ] XHTML mode support

### Phase 4: Helpers & Utilities
- [ ] parse_link_destination
- [ ] parse_link_label
- [ ] parse_link_title
- [ ] HTML entity data table (port from markdown_it_yo)
- [ ] URL encode/decode/parse/format (port from markdown_it_yo)
- [ ] Unicode case-folding for reference normalization
- [ ] normalize_reference function
- [ ] HTML block tag list + regex patterns

### Phase 5: Core Post-Processing (optional features)
- [ ] linkify (auto-detect URLs, requires options.linkify)
- [ ] replacements (typographer: (c)→©, ...→…)
- [ ] smartquotes (typographer: "text"→"text")

### Phase 6: Testing & Correctness
- [ ] Port markdown-it's 815 fixture tests to Yo test format
- [ ] Byte-identical output verification against markdown-it
- [ ] Edge case tests (nested emphasis, complex lists, HTML blocks)
- [ ] Memory leak check with AddressSanitizer
- [ ] CLI: --help, file input, stdin pipe, error handling

### Phase 7: Benchmarks & WASM
- [ ] Native benchmark harness (1MB, 5MB, 20MB inputs)
- [ ] WASM (Emscripten) build configuration in build.yo
- [ ] WASM benchmark (Node.js WASM runtime)
- [ ] Memory usage profiling (RSS, peak heap)
- [ ] Comparative benchmark table: markdown-it vs markdown_yo (native) vs markdown_yo (WASM)
- [ ] README with results and methodology

## Performance Strategy

### Why this will be fast

| Bottleneck in markdown_it_yo | Eliminated by |
|------------------------------|---------------|
| malloc/free 30.6% | No Token objects; str slices; arena inline buffer |
| Token.__drop 5.0% | Value-type InlineToken, zero RC |
| ArrayList.__dispose 4.6% | Reuse buffers across paragraphs |
| String.from 2.3% | str slices into source; no String copies |
| bzero 3.7% | Fewer allocations to zero-initialize |

### Key techniques
1. **Zero-copy strings**: All content references are `str` slices (pointer + length) into the source buffer
2. **Reusable inline buffer**: ArrayList(InlineToken) allocated once, cleared per paragraph
3. **Direct renderer calls**: No intermediate event enum — function calls are cheaper
4. **Pre-allocated output**: Output buffer sized at ~1.5× input length
5. **Run-batch HTML escaping**: Scan for safe runs, memcpy in bulk (from markdown_it_yo)
6. **Pointer-based hot loops**: `*(u8)` access in inner parsing loops
7. **Enum-based dispatch**: All type matching via integer comparison

### Target performance

| Input | markdown-it (JS) | markdown_yo target |
|-------|-------------------|-------------------|
| 1 MB  | ~110ms           | <15ms (7×)        |
| 5 MB  | ~420ms           | <70ms (6×)        |
| 20 MB | ~1700ms          | <300ms (5×)       |

## Compatibility Strategy

We match **markdown-it default preset** behavior exactly:
- GFM tables: enabled
- Strikethrough: enabled
- HTML tags: disabled by default (`html: false`)
- XHTML output: disabled by default
- Typographer: disabled by default
- Line breaks: disabled by default
- Max nesting: 100

### Key markdown-it behaviors to preserve
1. **Emphasis algorithm**: Pandoc-style delimiter matching (different from CommonMark)
2. **List continuation**: markdown-it's specific indentation rules
3. **HTML block patterns**: 6 specific patterns with different termination rules
4. **Link reference normalization**: Unicode case-folding + whitespace collapsing
5. **Fence info string**: Only first word used as language class
6. **Table alignment**: `align` attribute (not CSS class)
7. **Tight lists**: Suppress `<p>` inside tight lists

### Testing approach
- Convert markdown-it's `test/fixtures/*.txt` format to Yo test assertions
- Each fixture has input markdown + expected HTML
- Automated comparison script to catch any divergence

## Utilities Reuse

The following modules can be ported directly from markdown_it_yo (they're pure
functions with no state or Token dependency):
- `common/entities_data.yo` — HTML entity lookup table
- `common/unicode_casefold.yo` — Case-folding data
- `common/html_blocks.yo` — HTML block tag list
- `mdurl/*.yo` — URL parsing/encoding/decoding/formatting
- `common/punycode.yo` — International domain name encoding

## Open Questions

1. **Linkify**: markdown-it uses the `linkify-it` library for URL auto-detection.
   Do we need full linkify support in v1, or can we defer it?
2. **Plugin system**: markdown-it's Ruler class allows runtime rule enable/disable.
   For v1 we hardcode rules (like markdown_it_yo). Plugin support can come later.
3. **Streaming API**: Should we support streaming large files, or is whole-file
   parsing sufficient? (md4c supports streaming; markdown-it doesn't.)
