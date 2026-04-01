const md = require('markdown-it')();
const fs = require('fs');
const content = fs.readFileSync('tests/fixtures/commonmark/good.txt', 'utf8');
const lines = content.split('\n');

const failLines = [394,417,426,741,2427,2813,2826,2840,3347,3837,3850,4488,4510,4861,4878,5012,5404,5596,5689,5713,5733,7607,7899,8128,8556,9033,9044,9133];

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
    if (failLines.includes(parseInt(srcLine))) {
      let parts = [];
      let current = [];
      let inSection = false;
      for (let k = i + 1; k < j; k++) {
        if (lines[k] === '.') {
          if (inSection) {
            parts.push(current.join('\n'));
            current = [];
          }
          inSection = true;
        } else if (inSection) {
          current.push(lines[k]);
        }
      }
      if (current.length > 0) parts.push(current.join('\n'));

      if (parts.length >= 2) {
        const input = parts[0];
        const expected = parts[1];
        const actual = md.render(input);
        const actualTrimmed = actual.replace(/\n$/, '');
        if (actualTrimmed !== expected) {
          console.log('FIXTURE MISMATCH src line:', srcLine);
          console.log('  Fixture expects:', JSON.stringify(expected).slice(0, 120));
          console.log('  markdown-it gives:', JSON.stringify(actualTrimmed).slice(0, 120));
          console.log();
        }
      }
    }
    i = j;
  } else {
    i++;
  }
}
console.log('Done');
