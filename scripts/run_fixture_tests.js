#!/usr/bin/env node
// Run all markdown-it fixture tests, comparing Yo output against JS markdown-it.
//
// Usage:
//   node scripts/run_fixture_tests.js           # Run all fixture suites
//   node scripts/run_fixture_tests.js --verbose  # Show each test result
//   node scripts/run_fixture_tests.js --suite tables  # Run only one suite

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const verbose =
  process.argv.includes("--verbose") || process.argv.includes("-v");
const suiteFilter = (() => {
  const idx = process.argv.indexOf("--suite");
  return idx >= 0 ? process.argv[idx + 1] : null;
})();

const md = require("markdown-it");
const fixturesDir = path.join(__dirname, "..", "tests", "fixtures");

// Resolve Yo binary — search yo-out/<target>/bin/
const yoOutDir = path.join(__dirname, "..", "yo-out");
let yoBin = null;
if (fs.existsSync(yoOutDir)) {
  for (const target of fs.readdirSync(yoOutDir)) {
    const candidate = path.join(yoOutDir, target, "bin", "markdown_yo");
    if (fs.existsSync(candidate)) {
      yoBin = candidate;
      break;
    }
  }
}
if (!yoBin) {
  console.error(
    `ERROR: Binary not found in yo-out/*/bin/markdown_yo\nRun \`yo build\` first.`,
  );
  process.exit(1);
}

// Define test suites with their options
const suites = [
  // markdown-it fixtures (default options: html=false, typographer=false)
  {
    name: "commonmark_extras",
    file: "markdown_it/commonmark_extras.txt",
    opts: { html: true, langPrefix: "", typographer: true, linkify: true },
    yoFlags: ["--html", "--typographer", "--no-lang-prefix"],
  },
  { name: "fatal", file: "markdown_it/fatal.txt", opts: {}, yoFlags: [] },
  {
    name: "normalize",
    file: "markdown_it/normalize.txt",
    opts: {},
    yoFlags: [],
  },
  {
    name: "strikethrough",
    file: "markdown_it/strikethrough.txt",
    opts: { html: true, langPrefix: "", typographer: true, linkify: true },
    yoFlags: ["--html", "--typographer", "--no-lang-prefix"],
  },
  {
    name: "tables",
    file: "markdown_it/tables.txt",
    opts: { html: true, langPrefix: "", typographer: true, linkify: true },
    yoFlags: ["--html", "--typographer", "--no-lang-prefix"],
  },
  {
    name: "typographer",
    file: "markdown_it/typographer.txt",
    opts: { html: true, langPrefix: "", typographer: true, linkify: true },
    yoFlags: ["--html", "--typographer", "--no-lang-prefix"],
  },
  {
    name: "smartquotes",
    file: "markdown_it/smartquotes.txt",
    opts: { html: true, langPrefix: "", typographer: true, linkify: true },
    yoFlags: ["--html", "--typographer", "--no-lang-prefix"],
  },
  {
    name: "xss",
    file: "markdown_it/xss.txt",
    opts: { html: true, langPrefix: "", typographer: true, linkify: true },
    yoFlags: ["--html", "--typographer", "--no-lang-prefix"],
  },
  // commonmark fixtures
  {
    name: "commonmark_good",
    file: "commonmark/good.txt",
    opts: "commonmark",
    yoFlags: ["--commonmark"],
  },
];

function parseFixtures(content) {
  const fixtures = [];
  const lines = content.split("\n");
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }

    let title = "";
    while (i < lines.length && lines[i].trim() !== ".") {
      title += (title ? " " : "") + lines[i].trim();
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip '.'

    const inputLines = [];
    while (i < lines.length && lines[i] !== ".") {
      inputLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip '.'

    const expectedLines = [];
    while (i < lines.length && lines[i] !== ".") {
      expectedLines.push(lines[i]);
      i++;
    }
    if (i >= lines.length) break;
    i++; // skip '.'

    fixtures.push({
      title,
      input: inputLines.join("\n") + "\n",
      expected: expectedLines.join("\n") + "\n",
    });
  }

  return fixtures;
}

function runYo(input, flags) {
  try {
    return execSync([yoBin, ...flags, "-"].join(" "), {
      input,
      encoding: "utf8",
      timeout: 10000,
      shell: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    return `[ERROR: ${e.message}]`;
  }
}

let totalPassed = 0,
  totalFailed = 0,
  totalSkipped = 0,
  totalTests = 0;
const failedTests = [];

for (const suite of suites) {
  if (suiteFilter && suite.name !== suiteFilter) continue;

  const fixturePath = path.join(fixturesDir, suite.file);
  if (!fs.existsSync(fixturePath)) {
    console.log(`⊘ SKIP suite: ${suite.name} (file not found: ${suite.file})`);
    continue;
  }

  const content = fs.readFileSync(fixturePath, "utf8");
  const fixtures = parseFixtures(content);
  const mdInstance =
    typeof suite.opts === "string" ? md(suite.opts) : md(suite.opts);

  let suitePassed = 0,
    suiteFailed = 0,
    suiteSkipped = 0;

  for (const fix of fixtures) {
    totalTests++;
    const jsOutput = mdInstance.render(fix.input);
    const jsMatch = jsOutput === fix.expected;

    if (!jsMatch) {
      suiteSkipped++;
      totalSkipped++;
      if (verbose) {
        console.log(`  ⊘ SKIP: ${fix.title} (JS mismatch)`);
      }
      continue;
    }

    const yoOutput = runYo(fix.input, suite.yoFlags);
    if (yoOutput === fix.expected) {
      suitePassed++;
      totalPassed++;
      if (verbose) {
        console.log(`  ✓ ${fix.title}`);
      }
    } else {
      suiteFailed++;
      totalFailed++;
      failedTests.push({
        suite: suite.name,
        title: fix.title,
        expected: fix.expected,
        got: yoOutput,
      });
      if (verbose) {
        console.log(`  ✗ ${fix.title}`);
        console.log(
          `    Expected: ${fix.expected.trim().split("\n").slice(0, 3).join("\n    ")}`,
        );
        console.log(
          `    Got:      ${yoOutput.trim().split("\n").slice(0, 3).join("\n    ")}`,
        );
      }
    }
  }

  const status = suiteFailed > 0 ? "✗" : "✓";
  console.log(
    `${status} ${suite.name}: ${suitePassed} passed, ${suiteFailed} failed, ${suiteSkipped} skipped (${fixtures.length} total)`,
  );
}

console.log(`\n${"═".repeat(60)}`);
console.log(
  `Total: ${totalPassed} passed, ${totalFailed} failed, ${totalSkipped} skipped (${totalTests} total)`,
);

if (failedTests.length > 0 && !verbose) {
  console.log(`\nFirst ${Math.min(5, failedTests.length)} failures:`);
  for (const f of failedTests.slice(0, 5)) {
    console.log(`  [${f.suite}] ${f.title}`);
    console.log(`    Expected: ${f.expected.trim().split("\n")[0]}`);
    console.log(`    Got:      ${f.got.trim().split("\n")[0]}`);
  }
}

process.exit(totalFailed > 0 ? 1 : 0);
