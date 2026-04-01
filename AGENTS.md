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

```bash
# Build (from Yo directory)
cd ~/Workspace/Yo && bun run build

# Build markdown_yo
cd ~/Workspace/markdown_yo && ~/Workspace/Yo/yo-cli build

# Run
~/Workspace/Yo/yo-cli build run

# Test
~/Workspace/Yo/yo-cli build test

# Benchmark
node benchmark/run.js
```

## Conventions

- Always use snake_case for naming
- Use `str` slices (not `String`) for referencing source content
- Use value-type structs for parser state and inline tokens
- Reuse buffers: clear ArrayList instead of creating new ones
- Match markdown-it's output byte-for-byte
