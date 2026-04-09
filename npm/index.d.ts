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
 * @example
 * ```ts
 * import { createRenderer } from "markdown_yo";
 *
 * const md = await createRenderer();
 * const html = md.render("# Hello\n\n**World**");
 * console.log(html);
 * // => <h1>Hello</h1>\n<p><strong>World</strong></p>
 *
 * // With options
 * const html2 = md.render(src, { commonmark: true, html: true });
 * ```
 */
export function createRenderer(
  wasmOptions?: WasmOptions,
): Promise<MarkdownRenderer>;

export default createRenderer;
