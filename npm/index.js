/**
 * markdown_yo — High-performance Markdown-to-HTML converter (WebAssembly)
 *
 * @example
 * ```js
 * import { createRenderer } from "markdown_yo";
 * const md = await createRenderer();
 * const html = md.render("# Hello\n\nWorld");
 * ```
 */

// Re-export the Emscripten module loader
const createMarkdownYo =
  typeof require !== "undefined"
    ? require("./markdown_yo_demo.js")
    : undefined;

/**
 * Render options for markdown conversion.
 * @typedef {Object} RenderOptions
 * @property {boolean} [commonmark=false] - Use CommonMark-compliant parsing
 * @property {boolean} [html=false] - Allow raw HTML tags in output
 * @property {boolean} [typographer=false] - Enable typographic replacements
 * @property {boolean} [subscript=false] - Enable ~subscript~ syntax
 * @property {boolean} [superscript=false] - Enable ^superscript^ syntax
 * @property {boolean} [mark=false] - Enable ==highlight== syntax
 * @property {boolean} [math=false] - Enable $inline$ and $$block$$ math
 * @property {boolean} [emoji=false] - Enable :emoji: shortcodes
 * @property {boolean} [wikilink=false] - Enable [[wikilinks]]
 * @property {boolean} [critic=false] - Enable critic markup ({++add++}, {--del--}, etc.)
 * @property {boolean} [abbr=false] - Enable abbreviations (*[abbr]: expansion)
 * @property {boolean} [deflist=false] - Enable definition lists (Term + : Definition)
 * @property {boolean} [admonition=false] - Enable admonition blocks (!!! type title)
 * @property {boolean} [callout=false] - Enable callout blocks (> [!type] title)
 * @property {boolean} [footnote=false] - Enable footnotes ([^id] refs and ^[inline])
 * @property {boolean} [sourceMap=false] - Emit data-source-line attributes on block elements
 * @property {boolean} [fullFeatures=false] - Enable all optional features
 */

/**
 * A markdown renderer instance backed by WebAssembly.
 * @typedef {Object} MarkdownRenderer
 * @property {function(string, RenderOptions=): string} render - Render markdown to HTML
 * @property {function(): void} destroy - Free WASM resources
 */

/**
 * Build a flags bitmask from options.
 * @param {RenderOptions} [options]
 * @returns {number}
 */
function buildFlags(options) {
  if (!options) return 0;
  let flags = 0;
  if (options.commonmark) flags |= 1;
  if (options.html) flags |= 2;
  if (options.typographer) flags |= 4;
  if (options.subscript || options.fullFeatures) flags |= 8;
  if (options.superscript || options.fullFeatures) flags |= 16;
  if (options.mark || options.fullFeatures) flags |= 32;
  if (options.math || options.fullFeatures) flags |= 64;
  if (options.emoji || options.fullFeatures) flags |= 128;
  if (options.wikilink || options.fullFeatures) flags |= 256;
  if (options.critic || options.fullFeatures) flags |= 512;
  if (options.abbr || options.fullFeatures) flags |= 1024;
  if (options.deflist || options.fullFeatures) flags |= 2048;
  if (options.admonition || options.fullFeatures) flags |= 4096;
  if (options.callout || options.fullFeatures) flags |= 8192;
  if (options.footnote || options.fullFeatures) flags |= 16384;
  if (options.sourceMap) flags |= 32768;
  return flags;
}

/**
 * Create a markdown renderer instance.
 *
 * Loads the WebAssembly module and returns a renderer with a simple
 * `render(markdown, options?)` API.
 *
 * @param {Object} [wasmOptions] - Options passed to the Emscripten module loader
 * @param {string} [wasmOptions.locateFile] - Custom path resolver for .wasm file
 * @param {RenderOptions} [defaultOptions] - Default rendering options applied to every render() call
 * @returns {Promise<MarkdownRenderer>}
 *
 * @example
 * ```js
 * import { createRenderer } from "markdown_yo";
 *
 * const md = await createRenderer();
 * console.log(md.render("**bold**"));
 * // => <p><strong>bold</strong></p>
 *
 * console.log(md.render("# Title", { commonmark: true, html: true }));
 *
 * // Set default options once — applied to all render() calls
 * const md2 = await createRenderer(null, { html: true, fullFeatures: true });
 * console.log(md2.render("H~2~O"));
 * // => <p>H<sub>2</sub>O</p>
 * ```
 */
async function createRenderer(wasmOptions, defaultOptions) {
  let loader;
  if (createMarkdownYo) {
    loader = createMarkdownYo;
  } else {
    // ESM / browser dynamic import
    const mod = await import("./markdown_yo_demo.js");
    loader = mod.default || mod.createMarkdownYo || mod;
  }

  let wasmModule = await loader(wasmOptions || {});
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return {
    /**
     * Render a markdown string to HTML.
     * @param {string} markdown - The markdown source text
     * @param {RenderOptions} [options] - Rendering options
     * @returns {string} The rendered HTML
     */
    render(markdown, options) {
      const merged = defaultOptions
        ? { ...defaultOptions, ...options }
        : options;
      const inputBytes = encoder.encode(markdown);
      const inputPtr = wasmModule._malloc(inputBytes.length);
      try {
        wasmModule.HEAPU8.set(inputBytes, inputPtr);
        const flags = buildFlags(merged);
        const resultPtr = wasmModule._wasm_render(
          inputPtr,
          inputBytes.length,
          flags,
        );
        const resultLen = wasmModule._wasm_result_len();
        const resultBytes = wasmModule.HEAPU8.slice(
          resultPtr,
          resultPtr + resultLen,
        );
        wasmModule._wasm_free(resultPtr);
        return decoder.decode(resultBytes);
      } finally {
        wasmModule._free(inputPtr);
      }
    },

    /**
     * Free WASM module resources.
     * After calling destroy(), the renderer should not be used.
     */
    destroy() {
      // Emscripten modules don't have a standard destroy, but we clear the ref
      wasmModule = null;
    },
  };
}

// CommonJS + ESM compatible exports
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createRenderer };
  module.exports.createRenderer = createRenderer;
  module.exports.default = createRenderer;
} else if (typeof globalThis !== "undefined") {
  globalThis.markdownYo = { createRenderer };
}
