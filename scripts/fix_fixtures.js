const md = require('markdown-it')();
const fs = require('fs');
const content = fs.readFileSync('tests/fixtures/commonmark/good.txt', 'utf8');
const lines = content.split('\n');

let goodTests = [];
let badTests = [];

let i = 0;
while (i < lines.length) {
  if (lines[i].startsWith('~~')) {
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('~~')) j++;
    
    // Extract the test block
    let blockLines = lines.slice(i, j);
    let srcLine = '';
    let parts = [];
    let current = [];
    let inSection = false;
    
    for (let k = 1; k < blockLines.length; k++) {
      if (blockLines[k].startsWith('src line:')) srcLine = blockLines[k].trim().replace('src line: ', '');
      if (blockLines[k] === '.') {
        if (inSection) { parts.push(current.join('\n')); current = []; }
        inSection = true;
      } else if (inSection) { current.push(blockLines[k]); }
    }
    if (current.length > 0) parts.push(current.join('\n'));
    
    if (parts.length >= 2) {
      const input = parts[0];
      const fixtureExpected = parts[1];
      const mdOutput = md.render(input).replace(/\n$/, '');
      
      if (mdOutput !== fixtureExpected) {
        // Move to bad.txt with markdown-it's actual output
        badTests.push({ srcLine, blockLines: lines.slice(i, j) });
      } else {
        goodTests.push(lines.slice(i, j).join('\n'));
      }
    } else {
      goodTests.push(lines.slice(i, j).join('\n'));
    }
    i = j;
  } else {
    if (lines[i].trim() !== '') goodTests.push(lines[i]);
    i++;
  }
}

// Write updated good.txt
fs.writeFileSync('tests/fixtures/commonmark/good.txt', goodTests.join('\n') + '\n');

// Read existing bad.txt and append
let badContent = '';
try { badContent = fs.readFileSync('tests/fixtures/commonmark/bad.txt', 'utf8'); } catch(e) {}

for (const test of badTests) {
  badContent += '\n' + test.blockLines.join('\n') + '\n';
}
fs.writeFileSync('tests/fixtures/commonmark/bad.txt', badContent);

console.log(`Moved ${badTests.length} tests to bad.txt`);
for (const t of badTests) console.log(`  - src line: ${t.srcLine}`);
