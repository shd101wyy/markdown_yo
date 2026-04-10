#!/usr/bin/env node
// Generates src/data/emoji_data.yo from markdown-it-emoji full dataset.
// Usage: node scripts/generate_emoji_data.mjs > src/data/emoji_data.yo

import data from '../node_modules/markdown-it-emoji/lib/data/full.mjs';

const entries = Object.entries(data);
entries.sort((a, b) => a[0].localeCompare(b[0]));

function toHex(byte) {
  return '0x' + byte.toString(16).padStart(2, '0');
}

function utf8Bytes(str) {
  return [...Buffer.from(str, 'utf8')];
}

function emitPushBytes(bytes, indent) {
  return bytes.map(b => `${indent}_ := buf.*.push(u8(${toHex(b)}));`).join('\n');
}

function emitNameCheck(name, offset, indent) {
  // Build chain of byte checks for chars after the first
  const checks = [];
  for (let i = offset; i < name.length; i++) {
    checks.push(`((name_ptr &+ usize(${i})).* == u8(${toHex(name.charCodeAt(i))}))`);
  }
  if (checks.length === 0) return 'true';
  if (checks.length === 1) return checks[0];
  // Nest left-to-right for Yo: ((a && b) && c)
  let result = checks[0];
  for (let i = 1; i < checks.length; i++) {
    result = `(${result} && ${checks[i]})`;
  }
  return result;
}

// Group by first character, then by name length within each group
const byFirstChar = {};
for (const [name, emoji] of entries) {
  const ch = name.charCodeAt(0);
  if (!(ch in byFirstChar)) byFirstChar[ch] = {};
  const len = name.length;
  if (!(len in byFirstChar[ch])) byFirstChar[ch][len] = [];
  byFirstChar[ch][len].push([name, emoji]);
}

// Generate the Yo function
let out = '';
out += '// markdown_yo — Emoji shortname lookup table\n';
out += '// Auto-generated from markdown-it-emoji full.mjs\n';
out += `// ${entries.length} emoji entries\n`;
out += '//\n';
out += '// DO NOT EDIT — regenerate with: node scripts/generate_emoji_data.mjs > src/data/emoji_data.yo\n';
out += '\n';
out += '{ ArrayList } :: import "std/collections/array_list";\n';
out += '\n';
out += 'lookup_emoji :: (fn(name_ptr: *(u8), name_len: i32, buf: *(ArrayList(u8))) -> bool)({\n';
out += '  if((name_len < i32(1)), { return false; });\n';
out += '  if((name_len > i32(40)), { return false; });\n';
out += '  (ch0 : i32) = i32(name_ptr.*);\n';
out += '  cond(\n';

const firstChars = Object.keys(byFirstChar).map(Number).sort((a, b) => a - b);

for (let ci = 0; ci < firstChars.length; ci++) {
  const ch = firstChars[ci];
  const byLen = byFirstChar[ch];
  const lengths = Object.keys(byLen).map(Number).sort((a, b) => a - b);

  out += `    (ch0 == i32(${toHex(ch)})) => {\n`;
  out += '      cond(\n';

  for (let li = 0; li < lengths.length; li++) {
    const len = lengths[li];
    const nameEmojis = byLen[len];
    out += `        (name_len == i32(${len})) => {\n`;

    for (const [name, emoji] of nameEmojis) {
      const bytes = utf8Bytes(emoji);
      const check = emitNameCheck(name, 1, '');
      out += `          if(${check}, {\n`;
      out += emitPushBytes(bytes, '            ');
      out += '\n            return true;\n';
      out += '          });\n';
    }
    out += '          false\n';
    out += '        }';
    if (li < lengths.length - 1) out += ',';
    out += '\n';
  }

  out += '        ,true => false\n';
  out += '      )\n';
  out += '    }';
  if (ci < firstChars.length - 1) out += ',';
  out += '\n';
  }

out += '    ,true => false\n';
out += '  )\n';
out += '});\n';
out += '\n';
out += 'export lookup_emoji;\n';

process.stdout.write(out);
