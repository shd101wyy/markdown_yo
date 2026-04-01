const md = require('markdown-it')();
const { execSync } = require('child_process');
const fs = require('fs');
const content = fs.readFileSync('tests/fixtures/commonmark/good.txt', 'utf8');
const lines = content.split('\n');

const mismatchLines = [2427,2813,2826,2840,7607,7899,8556,9033,9044,9133];

let i = 0;
while (i < lines.length) {
  if (lines[i].startsWith('~~')) {
    let srcLine = '';
    let j = i + 1;
    while (j < lines.length && !lines[j].startsWith('~~')) {
      if (lines[j].startsWith('src line:')) {
        srcLine = lines[j].trim().replace('src line: ', '');
      }
      j++;
    }
    if (mismatchLines.includes(parseInt(srcLine))) {
      let parts = [];
      let current = [];
      let inSection = false;
      for (let k = i + 1; k < j; k++) {
        if (lines[k] === '.') {
          if (inSection) { parts.push(current.join('\n')); current = []; }
          inSection = true;
        } else if (inSection) { current.push(lines[k]); }
      }
      if (current.length > 0) parts.push(current.join('\n'));
      
      if (parts.length >= 2) {
        const input = parts[0];
        const mdExpected = md.render(input).replace(/\n$/, '');
        try {
          const ourOutput = execSync(
            `printf '%s' ${JSON.stringify(input)} | ./yo-out/aarch64-macos/bin/markdown_yo --commonmark -`,
            { encoding: 'utf8', timeout: 5000 }
          ).replace(/\n$/, '');
          if (ourOutput === mdExpected) {
            console.log(`✓ src line ${srcLine}: matches markdown-it`);
          } else {
            console.log(`✗ src line ${srcLine}: DIFFERS from markdown-it`);
            console.log(`  markdown-it: ${JSON.stringify(mdExpected).slice(0,100)}`);
            console.log(`  our output:  ${JSON.stringify(ourOutput).slice(0,100)}`);
          }
        } catch(e) {
          console.log(`✗ src line ${srcLine}: ERROR running our binary`);
        }
      }
    }
    i = j;
  } else { i++; }
}
