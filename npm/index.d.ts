/**
 * Rendering options for markdown conversion.
 */
export interface RenderOptions {
  /** Use CommonMark-compliant parsing (default: false) */
  commonmark?: boolean;
  /** Allow raw HTML tags in output (default: false) */
  html?: boolean;
  /** Enable typographic replacements (default: false) */
  typographer?: boolean;
  /** Enable ~subscript~ syntax (default: false) */
  subscript?: boolean;
  /** Enable ^superscript^ syntax (default: false) */
  superscript?: boolean;
  /** Enable ==highlight== syntax (default: false) */
  mark?: boolean;
  /** Enable $inline$ and $$block$$ math syntax (default: false) */
  math?: boolean;
  /** Enable :emoji: shortcodes (default: false) */
  emoji?: boolean;
  /** Enable [[wikilinks]] (default: false) */
  wikilink?: boolean;
  /** Enable critic markup ({++add++}, {--del--}, etc.) (default: false) */
  critic?: boolean;
  /** Enable abbreviations (*[abbr]: expansion) (default: false) */
  abbr?: boolean;
  /** Enable definition lists (Term + : Definition) (default: false) */
  deflist?: boolean;
  /** Enable admonition blocks (!!! type title) (default: false) */
  admonition?: boolean;
  /** Enable callout blocks (> [!type] title) (default: false) */
  callout?: boolean;
  /** Enable footnotes ([^id] refs and ^[inline]) (default: false) */
  footnote?: boolean;
  /** Emit data-source-line attributes on block elements (default: false) */
  sourceMap?: boolean;
  /** Enable all optional features (default: false) */
  fullFeatures?: boolean;
}

/**
 * A markdown renderer instance backed by WebAssembly.
 */
export interface MarkdownRenderer {
  /**
   * Render a markdown string to HTML.
   * @param markdown - The markdown source text
   * @param options - Rendering options
   * @returns The rendered HTML string
   */
  render(markdown: string, options?: RenderOptions): string;

  /**
   * Free WASM module resources.
   * After calling destroy(), the renderer should not be used.
   */
  destroy(): void;
}

/**
 * Options for the Emscripten module loader.
 */
export interface WasmOptions {
  /** Custom path resolver for the .wasm file */
  locateFile?: (path: string, prefix: string) => string;
  [key: string]: unknown;
}

/**
 * Create a markdown renderer instance.
 *
 * Loads the WebAssembly module and returns a renderer with a simple
 * `render(markdown, options?)` API.
 *
 * @param wasmOptions - Options passed to the Emscripten module loader
 * @param defaultOptions - Default rendering options applied to every render() call.
 *   Per-call options override defaults.
 *
 * @example
 * ```ts
 * import { createRenderer } from "markdown_yo";
 *
 * const md = await createRenderer();
 * const html = md.render("# Hello\n\n**World**");
 * console.log(html);
 * // => <h1>Hello</h1>\n<p><strong>World</strong></p>
 *
 * // With per-call options
 * const html2 = md.render(src, { commonmark: true, html: true });
 *
 * // Set default options once
 * const md2 = await createRenderer(null, { html: true, fullFeatures: true });
 * md2.render("H~2~O"); // => <p>H<sub>2</sub>O</p>
 * ```
 */
export function createRenderer(
  wasmOptions?: WasmOptions | null,
  defaultOptions?: RenderOptions,
): Promise<MarkdownRenderer>;

export default createRenderer;
