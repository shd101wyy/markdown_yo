# Crossnote Integration Plan

## Goal

Add markdown_yo as the **third parser option** in [crossnote](https://github.com/shd101wyy/crossnote) alongside markdown-it and Pandoc. To achieve this, markdown_yo must support the features crossnote relies on from markdown-it.

## Architecture: How crossnote selects parsers

Crossnote's rendering pipeline in `src/markdown-engine/index.ts`:

```
parseMD()
  → onWillParseMarkdown()          ← pre-processing hook
  → transformMarkdown()             ← @import files, directives
  → Parser selection:
      if (usePandocParser)   → pandocRender()
      else if (useYoParser)  → yoRender()      ← NEW
      else                   → md.render()      ← markdown-it
  → cheerio.load(html)              ← load into DOM
  → enhanceWithFencedMath()         ← KaTeX/MathJax rendering
  → enhanceWithFencedDiagrams()     ← Mermaid, PlantUML, etc.
  → enhanceWithFencedCodeChunks()   ← code execution
  → enhanceWithCodeBlockStyling()   ← syntax highlighting
  → enhanceWithResolvedImagePaths() ← path resolution
  → sanitizeRenderedHTML()          ← XSS prevention
  → onDidParseMarkdown()            ← post-processing hook
```

**Key insight:** The post-render enhancers are **parser-agnostic** — they process HTML via cheerio DOM. markdown_yo only needs to produce compatible HTML output. It does NOT need to provide a token/AST API.

## Current State: What markdown_yo supports

### ✅ Already supported

- CommonMark core (98.7% spec compliance, 815/826 tests)
- GFM tables (with alignment)
- GFM strikethrough (`~~text~~`)
- Typographer (smart quotes, dashes, ©, ®, ™, ±, …)
- Linkify (auto-detect URLs)
- Raw HTML pass-through (with XSS sanitization)
- Line breaks mode (`\n` → `<br>`)
- XHTML output mode
- Fenced code blocks with language tags

### ❌ Not yet supported (needed by crossnote)

See gap analysis below.

## Feature Gap Analysis

### Features the parser MUST handle

These require parse-time syntax recognition — they cannot be done in post-processing.

| Feature              | Syntax                   | Priority | Complexity | Notes                                                                                             |
| -------------------- | ------------------------ | -------- | ---------- | ------------------------------------------------------------------------------------------------- |
| **Footnotes**        | `[^1]` + `[^1]: text`    | High     | High       | Block + inline, cross-referencing, backrefs                                                       |
| **Math**             | `$...$`, `$$...$$`       | High     | Medium     | Escape from normal inline parsing; actual rendering done by crossnote's KaTeX/MathJax post-render |
| **Subscript**        | `H~2~O`                  | High     | Low        | Inline delimiter pair, single `~`                                                                 |
| **Superscript**      | `x^2^`                   | High     | Low        | Inline delimiter pair, single `^`                                                                 |
| **Mark/Highlight**   | `==text==`               | High     | Low        | Inline delimiter pair, `==`                                                                       |
| **Definition lists** | `Term\n: Definition`     | Medium   | Medium     | Block-level, Pandoc/PHP-extra style                                                               |
| **Abbreviations**    | `*[abbr]: Full Text`     | Medium   | Medium     | Define + auto-replace throughout doc                                                              |
| **Admonition**       | `!!! type Title`         | Medium   | Medium     | Block-level, indented content, 28 types                                                           |
| **Callout**          | `> [!type] Title`        | Medium   | Low        | Extension of blockquote parsing                                                                   |
| **Wikilinks**        | `[[link\|text]]`         | Medium   | Low        | Inline rule, configurable                                                                         |
| **Critic markup**    | `{--del--}`, `{++ins++}` | Low      | Medium     | 5 inline patterns                                                                                 |
| **Emoji**            | `:smile:`                | Low      | Low        | Lookup table replacement                                                                          |
| **Source map**       | (automatic)              | High     | Medium     | Track source line → output element mapping                                                        |

### Features handled by crossnote post-render (no parser work needed)

These work on HTML output and are parser-agnostic:

| Feature                           | How it works                                        | Parser requirement                             |
| --------------------------------- | --------------------------------------------------- | ---------------------------------------------- |
| Math rendering (KaTeX/MathJax)    | Finds `<code class="language-math">` or math tokens | Parser must output math in recognizable format |
| Diagram rendering (Mermaid, etc.) | Finds `<code class="language-mermaid">` etc.        | Already works — fenced code blocks ✅          |
| Code execution                    | Finds `<pre>` with data attributes                  | Already works — fenced code blocks ✅          |
| Syntax highlighting               | Adds Prism classes to `<code>`                      | Already works ✅                               |
| Image path resolution             | Rewrites `<img src>`                                | Already works ✅                               |
| Extended table syntax             | Processes `^` and `>` markers in cells              | Already works — tables ✅                      |
| Embedded images/SVGs              | Converts file:// to base64                          | Already works ✅                               |
| XSS sanitization                  | Strips dangerous HTML                               | Already works ✅                               |

### Features that could go either way

| Feature                                | Parser approach                        | Post-render approach                 | Recommendation                           |
| -------------------------------------- | -------------------------------------- | ------------------------------------ | ---------------------------------------- |
| Code fence attributes (`{#id .class}`) | Parse info string, add data attributes | crossnote already parses info string | **Post-render** — crossnote handles this |
| Curly bracket attributes (`{#id}`)     | Parse after headings/links/images      | crossnote core rule does this        | **Post-render** — crossnote handles this |
| HTML5 embed                            | Parse image syntax for video/audio     | crossnote plugin handles this        | **Post-render** — crossnote handles this |
| Widget                                 | Parse `![@widget](path)`               | crossnote intercepts image render    | **Post-render** — crossnote handles this |
| Font Awesome emoji                     | Lookup `:fa-*:` patterns               | crossnote can do text replacement    | **Post-render** — crossnote handles this |

## Implementation Phases

### Phase 1: Core Inline Extensions

**Goal:** Support the most common markdown extensions that are universally useful.

1. **Subscript** — `H~2~O` → `<sub>2</sub>`
   - Add inline rule for single `~` delimiter pairs
   - Must not conflict with strikethrough (`~~`)

2. **Superscript** — `x^2^` → `<sup>2</sup>`
   - Add inline rule for single `^` delimiter pairs

3. **Mark/Highlight** — `==text==` → `<mark>text</mark>`
   - Add inline rule for `==` delimiter pairs

4. **Math syntax** — `$...$` and `$$...$$`
   - Inline: `$E=mc^2$` → `<code class="language-math math-inline" data-math-display="false">E=mc^2</code>`
   - Block: `$$\n...\n$$` → `<pre><code class="language-math math-block" data-math-display="true">...</code></pre>`
   - Output format must be compatible with crossnote's `enhanceWithFencedMath`
   - Alternative: output `<span class="math inline">` / `<div class="math display">` (KaTeX convention)
   - **Configurable delimiters** (crossnote allows custom pairs)

### Phase 2: Block Extensions

1. **Footnotes** — `[^1]` references + `[^1]: text` definitions
   - Block rule: collect `[^id]: content` definitions (can be multi-line with indentation)
   - Inline rule: replace `[^id]` with superscript link
   - End-of-document: render footnotes section `<section class="footnotes">`
   - Back-references: each footnote links back to its usage(s)
   - Most complex feature — consider following markdown-it-footnote's output format

2. **Definition lists** — Pandoc/PHP Markdown Extra style

   ```
   Term
   :   Definition 1
   :   Definition 2
   ```

   - Block rule: detect `:   ` pattern after paragraph
   - Output: `<dl><dt>Term</dt><dd>Definition</dd></dl>`

3. **Abbreviations** — `*[HTML]: Hyper Text Markup Language`
   - Block rule: collect `*[abbr]: expansion` definitions
   - Post-parse: replace all occurrences of `abbr` in text with `<abbr title="expansion">abbr</abbr>`
   - Word-boundary aware

4. **Admonition blocks** — `!!! type Title`

   ```
   !!! warning "Be careful"
       This is an admonition body.
       It can span multiple lines.
   ```

   - Block rule: detect `!!!` prefix, parse type and optional title
   - Body: indented content (4 spaces), recursively parsed
   - Output: `<div class="admonition warning"><p class="admonition-title">Be careful</p>...</div>`
   - 28 type aliases (note, abstract, info, tip, success, question, warning, failure, danger, bug, example, quote)

5. **Callout blocks** (GitHub-style) — `> [!NOTE]`
   ```
   > [!WARNING]
   > This is a callout
   ```

   - Extension of blockquote parsing
   - Detect `[!type]` at start of first paragraph inside blockquote
   - Foldable variant: `> [!NOTE]+` (open) / `> [!NOTE]-` (closed)
   - Output: `<div class="callout" data-callout="warning">` or `<details class="callout">`

### Phase 3: Remaining Inline Extensions

1. **Wikilinks** — `[[target]]` or `[[target|display text]]`
   - Inline rule: detect `[[` opening
   - Output: `<a href="target" class="wikilink">display text</a>`
   - Configurable: file extension append, link text case transformation

2. **Critic markup** — 5 patterns
   - `{--deleted text--}` → `<del>deleted text</del>`
   - `{++inserted text++}` → `<ins>inserted text</ins>`
   - `{~~old text~>new text~~}` → `<del>old text</del><ins>new text</ins>`
   - `{==highlighted text==}` → `<mark>highlighted text</mark>`
   - `{>>comment text<<}` → `<span class="critic comment">comment text</span>`
   - Inline rule: char-by-char pattern matching

3. **Emoji** — `:emoji_name:` → Unicode emoji
   - Inline rule: detect `:name:` pattern
   - Lookup table: ~1800 named emoji (gemoji set)
   - Output: Unicode character directly

### Phase 4: Source Map Support

1. **Line tracking** — track source line numbers during parsing
   - Block elements: record start/end line for each block
   - Output: `data-source-line="N"` attribute on block-level HTML elements
   - Essential for crossnote's editor synchronization (scroll sync, click-to-source)

2. **New option**: `source_map: bool` (default: false)
   - When enabled, block-level elements include `data-source-line` attribute
   - May need to add to Options struct and WASM flags bitmask

### Phase 5: Crossnote Integration

1. **Expanded WASM API**
   - Current: `wasm_render(ptr, len, flags)` with 3-bit flags
   - New: Extended flags bitmask or JSON config string
   - New flags needed:
     - `source_map` (bit 3)
     - `enable_footnotes` (bit 4)
     - `enable_subscript` (bit 5)
     - `enable_superscript` (bit 6)
     - `enable_mark` (bit 7)
     - `enable_math` (bit 8)
     - `enable_definition_list` (bit 9)
     - `enable_abbreviation` (bit 10)
     - `enable_admonition` (bit 11)
     - `enable_callout` (bit 12)
     - `enable_wikilink` (bit 13)
     - `enable_critic_markup` (bit 14)
     - `enable_emoji` (bit 15)
   - Alternative: accept JSON config as second string argument

2. **Native CLI feature flags**
   - `--enable-footnotes`, `--enable-math`, `--enable-subscript`, etc.
   - `--disable-footnotes`, `--disable-math`, etc.
   - `--preset crossnote` — enable all crossnote-compatible features at once
   - `--math-inline-delimiters '$,$'` — custom math delimiters

3. **npm package updates**
   - Expand `RenderOptions` interface in `index.d.ts`
   - Update `createRenderer()` API to pass JSON config to `wasm_render_with_config`
   - Bump version

4. **crossnote integration PR**
   - Add `useMarkdownYoParser: boolean` to `NotebookConfig` in `types.ts`
   - Add third branch in `parseMD()` renderer selection
   - Implement `yoRender()` method using WASM (no native binary — must work in vscode.dev)
   - Map crossnote config → markdown_yo JSON config

## WASM API Design (Phase 5)

### Option A: Extended flags bitmask (for simple boolean toggles)

```c
// Existing bits 0-2
#define FLAG_COMMONMARK    (1 << 0)
#define FLAG_HTML          (1 << 1)
#define FLAG_TYPOGRAPHER   (1 << 2)

// New bits 3-15
#define FLAG_SOURCE_MAP    (1 << 3)
#define FLAG_FOOTNOTES     (1 << 4)
#define FLAG_SUBSCRIPT     (1 << 5)
#define FLAG_SUPERSCRIPT   (1 << 6)
#define FLAG_MARK          (1 << 7)
#define FLAG_MATH          (1 << 8)
#define FLAG_DEFLIST       (1 << 9)
#define FLAG_ABBR          (1 << 10)
#define FLAG_ADMONITION    (1 << 11)
#define FLAG_CALLOUT       (1 << 12)
#define FLAG_WIKILINK      (1 << 13)
#define FLAG_CRITIC        (1 << 14)
#define FLAG_EMOJI         (1 << 15)
```

Existing `wasm_render(ptr, len, flags)` continues to work with extended bits. Simple and backward-compatible.

### Option B: JSON config string (for complex config like math delimiters)

```c
// New export:
wasm_render_with_config(input_ptr, input_len, config_ptr, config_len) -> *u8
```

```json
{
  "html": true,
  "typographer": true,
  "source_map": true,
  "footnotes": true,
  "math": {
    "inline_delimiters": [["$", "$"]],
    "block_delimiters": [["$$", "$$"]]
  },
  "wikilink": { "file_extension": ".md" }
}
```

### Recommendation: Both

- Keep `wasm_render(ptr, len, flags)` for simple use cases (backward compatible)
- Add `wasm_render_with_config(ptr, len, config_ptr, config_len)` for crossnote integration (custom math delimiters, wikilink config)
- The JSON config is required because math delimiter customization cannot be expressed as a single bit flag
- crossnote's JS wrapper (`npm/index.js`) will use `wasm_render_with_config` internally

## crossnote Integration Design

### Config changes (`src/notebook/types.ts`)

```typescript
interface NotebookConfig {
  // Existing:
  usePandocParser: boolean;

  // New:
  useMarkdownYoParser: boolean; // @default false
  markdownYoOptions: {
    // Override defaults when using Yo parser
    footnotes: boolean; // @default true
    math: boolean; // @default true
    subscript: boolean; // @default true
    superscript: boolean; // @default true
    mark: boolean; // @default true
    definitionList: boolean; // @default true
    abbreviation: boolean; // @default true
    admonition: boolean; // @default true
    callout: boolean; // @default true
    wikilink: boolean; // @default true
    criticMarkup: boolean; // @default true
    emoji: boolean; // @default true
  };
}
```

### Renderer selection (`src/markdown-engine/index.ts`)

```typescript
let html: string;
if (this.notebook.config.usePandocParser) {
  html = await this.pandocRender(outputString, args);
} else if (this.notebook.config.useMarkdownYoParser) {
  html = await this.yoRender(outputString);
} else {
  html = this.notebook.md.render(outputString);
}
// Post-render pipeline runs for all three parsers — no changes needed
```

### Yo renderer implementation (WASM only)

WASM-only is required because crossnote powers VS Code extensions including the web version (vscode.dev), where native binaries cannot run.

```typescript
private async yoRender(markdown: string): Promise<string> {
  const md = await createRenderer();
  return md.render(markdown, {
    html: true,
    typographer: this.notebook.config.enableTypographer,
    sourceMap: true,
    footnotes: true,
    math: {
      inlineDelimiters: this.notebook.config.mathInlineDelimiters,
      blockDelimiters: this.notebook.config.mathBlockDelimiters,
    },
    subscript: true,
    superscript: true,
    mark: true,
    definitionList: true,
    abbreviation: true,
    admonition: true,
    callout: true,
    wikilink: this.notebook.config.enableWikiLinkSyntax,
    criticMarkup: this.notebook.config.enableCriticMarkupSyntax,
    emoji: this.notebook.config.enableEmojiSyntax,
  });
}
```

## Output Compatibility

For crossnote's post-render pipeline to work, markdown_yo must produce specific HTML structures:

### Math output (for `enhanceWithFencedMath`)

crossnote looks for:

```html
<!-- Inline math -->
<span class="math inline">E=mc^2</span>

<!-- Block math -->
<div class="math display">\int_0^\infty e^{-x} dx = 1</div>
```

Or fenced code blocks:

```html
<pre><code class="language-math">
\int_0^\infty e^{-x} dx = 1
</code></pre>
```

### Admonition output

```html
<div class="admonition warning">
  <p class="admonition-title">Be careful</p>
  <p>Content here.</p>
</div>
```

### Callout output

```html
<div class="callout" data-callout="warning">
  <div class="callout-title">Warning</div>
  <div class="callout-content">
    <p>Content here.</p>
  </div>
</div>
```

### Footnotes output

```html
<p>
  Some text<sup class="footnote-ref"><a href="#fn1" id="fnref1">1</a></sup>
</p>
...
<section class="footnotes">
  <ol>
    <li id="fn1">
      <p>Footnote text. <a href="#fnref1" class="footnote-backref">↩</a></p>
    </li>
  </ol>
</section>
```

### Source map output

```html
<h1 data-source-line="0">Title</h1>
<p data-source-line="2">Paragraph text</p>
```

## Testing Strategy

1. **Per-feature test fixtures** — Add test files in `tests/fixtures/` for each new feature
   - Follow existing format: `name\n.\ninput\n.\nexpected\n.`
   - Use markdown-it plugin output as reference for expected HTML

2. **Compatibility tests** — Verify output matches markdown-it for shared features
   - Run same input through both markdown-it and markdown_yo
   - Compare HTML output (normalize whitespace)

3. **crossnote integration test** — End-to-end test with real crossnote documents
   - Sample notebooks with all features enabled
   - Verify post-render pipeline produces correct results

## Estimated Scope

| Phase     | Features                                  | New LOC (est.) |
| --------- | ----------------------------------------- | -------------- |
| Phase 1   | Sub/Sup/Mark/Math                         | ~800           |
| Phase 2   | Footnotes/Deflist/Abbr/Admonition/Callout | ~2,500         |
| Phase 3   | Wikilink/Critic/Emoji                     | ~1,200         |
| Phase 4   | Source map                                | ~500           |
| Phase 5   | API + crossnote integration               | ~400           |
| **Total** |                                           | **~5,400**     |

Current codebase: ~12,600 LOC → would grow to ~18,000 LOC.

## Design Decisions

1. **Math delimiter configurability** — Yes, support custom math delimiters like crossnote allows. The WASM API must accept delimiter configuration (requires JSON config approach, not just bitmask flags).
2. **WASM only for crossnote** — Use WASM exclusively (no native binary). This is required because crossnote powers VS Code extensions including the web version (vscode.dev), where native binaries cannot run.
3. **Feature flags granularity** — Each feature is individually toggleable. The native CLI also exposes flags to enable/disable each feature (e.g., `--enable-footnotes`, `--disable-math`).
4. **Emoji dataset** — Ship gemoji (~1800 entries) as compile-time data baked into the binary. No runtime loading.
5. **Admonition type list** — Match crossnote's 28 types exactly.
6. **Callout syntax** — Match crossnote's implementation (GitHub-style with foldable `+`/`-` variants, 25 types).
