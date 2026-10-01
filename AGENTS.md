# AGENTS.md — markdown_yo

## Project Overview

markdown_yo is a fast, SAX-style markdown-to-HTML parser written in Yo.
It follows markdown-it's parsing rules for output compatibility while using
md4c-inspired architecture for maximum performance.

## Key Files

| File | Purpose |
|------|---------|
| `PLAN.md` | Implementation plan and architecture |
| `build.yo` | Build system configuration |
| `deps.yo` | Dependency management |
| `src/main.yo` | CLI entry point |
| `src/lib.yo` | Public library API |

## Instruction Files

| Area | File |
|------|------|
| Yo syntax rules | `Yo/.github/instructions/yo-syntax.instructions.md` |
| Yo design | `Yo/.github/instructions/yo-design.instructions.md` |
| Project conventions | `.github/instructions/conventions.instructions.md` |
| Testing | `.github/instructions/testing.instructions.md` |
| Performance | `.github/instructions/performance.instructions.md` |

## Architecture

```
Source str ──► Normalize ──► Block Parser ──► Inline Parser ──► Output buffer
                              │                   │
                              ▼                   ▼
                         HtmlRenderer        HtmlRenderer
                         (block events)      (inline events)
                              │                   │
                              └───────┬───────────┘
                                      ▼
                              ArrayList(u8) output
```

- **No Token objects** — block parser calls renderer directly
- **Value-type InlineToken** — lightweight struct with byte offsets, zero RC
- **str slices** — zero-copy references into source buffer
- **Pre-allocated buffers** — reused across paragraphs

## Build & Test

The Yo version is pinned in `.yo-version`; `yo` on your PATH honours it.

```bash
yo build                               # native binary → yo-out/<target>/bin/markdown_yo
yo build wasm_exe                      # WebAssembly build (needs emsdk)
yo test ./tests --parallel 1           # unit tests
node scripts/run_fixture_tests.js      # markdown-it compatibility fixtures
node benchmark/run.js                  # benchmark (run benchmark/generate_samples.js first)
yo fmt --check ./src ./tests ./build.yo
```

CI runs all of these. Run `yo fmt` on every `.yo` file you change: CI fails on
unformatted code. Put an item's comment on the line above it, not after its comma
(`html : bool, // why`). Yo ≤ 0.2.47's formatter moves a comment after a comma
onto the NEXT item (shd101wyy/Yo#1086).

## Releasing

**Always publish through the `release.yml` workflow. Never create or push a
version tag by hand.**

```bash
gh workflow run release.yml --repo shd101wyy/markdown_yo -f bump=patch   # or bump=minor
```

The workflow:
- bumps `npm/package.json` and `yo.toml` to the new version and commits the bump;
- tags that commit `v<version>`;
- builds the native and WASM bundles, creates the GitHub release, and publishes
  to npm.

Yo resolves this package by its `v<version>` tags, so the tag, `yo.toml`, and
`npm/package.json` must agree.

Hand-made tags broke that: v0.0.6 to v0.0.8 were pushed by hand while
`npm/package.json` stayed at 0.0.5. npm missed those versions, and the next
workflow run would have tried to re-create v0.0.6.

## Conventions

- Always use snake_case for naming
- Use `str` slices (not `String`) for referencing source content
- Use value-type structs for parser state and inline tokens
- Reuse buffers: clear ArrayList instead of creating new ones
- Match markdown-it's output byte-for-byte
