#!/usr/bin/env node
// Generate benchmark sample files by repeating realistic markdown content.

const fs = require('fs');
const path = require('path');

const SAMPLE_BLOCK = `
# Heading 1

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud
exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Heading 2

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu
fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
culpa qui officia deserunt mollit anim id est laborum.

- Item one with **bold** and *italic* text
- Item two with a [link](https://example.com)
- Item three with \`inline code\`
  - Nested item A
  - Nested item B

> Blockquote with some *emphasized* text inside it.
> Second line of the blockquote.

1. First ordered item
2. Second ordered item
3. Third ordered item with **bold**

\`\`\`javascript
function hello(name) {
  console.log("Hello, " + name + "!");
  return true;
}
\`\`\`

Here is a paragraph with an ![image](https://example.com/img.png "title") and
a reference-style link [example][ref1].

[ref1]: https://example.com/reference "Reference Title"

| Column 1 | Column 2 | Column 3 |
| --------- | --------- | --------- |
| Cell 1    | Cell 2    | Cell 3    |
| Cell 4    | Cell 5    | Cell 6    |

---

Another paragraph with HTML entities: &amp; &lt; &gt; &quot; and special chars.

`;

const samplesDir = path.join(__dirname, 'samples');
fs.mkdirSync(samplesDir, { recursive: true });

const sizes = [
  { name: '64K',  bytes: 64 * 1024 },
  { name: '256K', bytes: 256 * 1024 },
  { name: '1M',   bytes: 1024 * 1024 },
  { name: '5M',   bytes: 5 * 1024 * 1024 },
  { name: '20M',  bytes: 20 * 1024 * 1024 },
];

for (const { name, bytes } of sizes) {
  let content = '';
  while (content.length < bytes) {
    content += SAMPLE_BLOCK;
  }
  content = content.slice(0, bytes);
  const filePath = path.join(samplesDir, `sample_${name}.md`);
  fs.writeFileSync(filePath, content);
  console.log(`Generated ${filePath} (${content.length} bytes)`);
}
