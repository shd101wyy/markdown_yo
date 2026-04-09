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
 * ```
 */
async function createRenderer(wasmOptions) {
  let loader;
  if (createMarkdownYo) {
    loader = createMarkdownYo;
  } else {
    // ESM / browser dynamic import
    const mod = await import("./markdown_yo_demo.js");
    loader = mod.default || mod.createMarkdownYo || mod;
  }

  const Module = await loader(wasmOptions || {});
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
      const inputBytes = encoder.encode(markdown);
      const inputPtr = Module._malloc(inputBytes.length);
      try {
        Module.HEAPU8.set(inputBytes, inputPtr);
        const flags = buildFlags(options);
        const resultPtr = Module._wasm_render(
          inputPtr,
          inputBytes.length,
          flags,
        );
        const resultLen = Module._wasm_result_len();
        const resultBytes = Module.HEAPU8.slice(
          resultPtr,
          resultPtr + resultLen,
        );
        Module._wasm_free(resultPtr);
        return decoder.decode(resultBytes);
      } finally {
        Module._free(inputPtr);
      }
    },

    /**
     * Free WASM module resources.
     * After calling destroy(), the renderer should not be used.
     */
    destroy() {
      // Emscripten modules don't have a standard destroy, but we clear the ref
      Module = null;
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
