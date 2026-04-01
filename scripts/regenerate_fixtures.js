const md = require('markdown-it')();
const fs = require('fs');
const content = fs.readFileSync('tests/fixtures/commonmark/spec.txt', 'utf8');

// Parse the spec.txt which uses CommonMark example format:
// ```````````````````````````````` example
// input
// .
// expected output
// ````````````````````````````````

const exampleRegex = /^`{32,} example\n([\s\S]*?)^`{32,}$/gm;
let match;
let goodTests = [];
let badTests = [];
let totalTests = 0;
let matchCount = 0;
let mismatchCount = 0;

// Track line numbers in spec.txt
const specLines = content.split('\n');
let lineNum = 0;

while ((match = exampleRegex.exec(content)) !== null) {
  totalTests++;
  const body = match[1];
  const dotIndex = body.indexOf('\n.\n');
  if (dotIndex === -1) continue;
  
  const input = body.substring(0, dotIndex);
  const expected = body.substring(dotIndex + 3).replace(/\n$/, '');
  
  // Calculate source line number
  const matchStart = match.index;
  let srcLine = 0;
  for (let i = 0; i < matchStart; i++) {
    if (content[i] === '\n') srcLine++;
  }
  srcLine += 1; // 1-indexed
  
  // Run through markdown-it
  const mdOutput = md.render(input).replace(/\n$/, '');
  
  const testBlock = `~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
src line: ${srcLine}

.
${input}
.
${expected}
.
`;
  
  if (mdOutput === expected) {
    matchCount++;
    goodTests.push(testBlock);
  } else {
    mismatchCount++;
    badTests.push(testBlock);
  }
}

fs.writeFileSync('tests/fixtures/commonmark/good.txt', goodTests.join('\n'));
fs.writeFileSync('tests/fixtures/commonmark/bad.txt', badTests.join('\n'));

console.log(`Total examples: ${totalTests}`);
console.log(`Matches (good.txt): ${matchCount}`);
console.log(`Mismatches (bad.txt): ${mismatchCount}`);
