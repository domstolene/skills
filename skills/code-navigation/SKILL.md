---
name: code-navigation
description: Activate whenever one needs to navigate, locate, read, or understand source code. Use CodeGraph for code exploration, symbols, file structure, source reading, call relationships, task context, and change impact instead of grep, ripgrep, glob, or raw file reads.
---

# Code navigation with CodeGraph

Use this skill before every code-navigation task, including locating implementations,
reading source, following callers or dependencies, finding prior art, and selecting
tests for a change. Prefer CodeGraph MCP tools when available; otherwise use the
`codegraph` CLI. Do not start code navigation with grep, ripgrep, glob, `read`,
`view`, `cat`, or shell-based source searches.

## Choose the smallest useful query

Run commands from the repository root, or specify `--path <project>` on navigation
commands.

The following commands and flags were checked against CodeGraph CLI 1.6.0.
Use `codegraph <command> --help` if the installed version differs.

| Need | Command |
| --- | --- |
| Explore a feature or area, with source and call paths | `codegraph explore "case handling" --max-files 5` |
| Assemble task-oriented context | `codegraph context "change case validation" --max-nodes 20` |
| Locate a named symbol | `codegraph query "SymbolName" --limit 10` |
| Restrict symbol kind | `codegraph query "SymbolName" --kind class` |
| Read a symbol and its caller/callee trail | `codegraph node "SymbolName"` |
| Disambiguate a symbol by file | `codegraph node "SymbolName" --file path/to/File.java` |
| Read a source file with line numbers and dependents | `codegraph node --file path/to/File.java --offset 1 --limit 120` |
| Get a file's symbol map and dependents without source | `codegraph node --file path/to/File.java --symbols-only` |
| Browse indexed files | `codegraph files --max-depth 3` |
| Find files by directory or glob | `codegraph files --filter maven --pattern "**/*Service.java"` |
| Find incoming calls | `codegraph callers "SymbolName" --limit 20` |
| Find outgoing calls | `codegraph callees "SymbolName" --limit 20` |
| Assess change impact | `codegraph impact "SymbolName" --depth 2` |
| Find tests affected by specific files | `codegraph affected path/to/File.java` |
| Find tests affected by tracked changes | `git diff --name-only HEAD --relative --diff-filter=ACMR -- . \| codegraph affected --stdin --quiet` |

`query`, `files`, `callers`, `callees`, `impact`, and `affected` support `--json`.
For `context`, use `--format json` instead, or `--no-code` for structure only.
`files` also supports `--format flat` and `--format grouped`. `affected` supports
`--depth` and `--filter` to control traversal and test-file matching.

Start with `explore` or `context` for an unfamiliar area, and `query` or `node`
for a known symbol. Follow the returned paths and relationships with focused
`node`, `callers`, and `callees` queries. Limit output and read additional file
ranges only when needed. Check `impact` before changing shared behavior.

## Failing due to missing `codegraph` executable

Ask user if they want it installed: `npm i -g @colbymchenry/codegraph`

## Failing due to missing index

If any command fails because index is missing:

1. If uninitialized, run `codegraph init --yes` to build the initial index.
3. Run `codegraph sync` when source files have changed since indexing, including
   after your own edits or a branch change.
4. Use `codegraph index` only when a full rebuild is necessary.

Do not assume another worktree's index describes this worktree. Surface missing
executables, indexing failures, and stale-index problems instead of silently
switching to text searches. Do not run `uninit`, force initialization, stop
daemons, or change agent installation or telemetry settings as part of navigation.

## Boundaries and fallback

CodeGraph is the default navigation tool, not a replacement for editing, git
diffs, builds, linters, or test execution. Read repository instructions and
non-code documentation with ordinary tools when appropriate.

If CodeGraph cannot answer a specific question, first check index freshness,
symbol ambiguity, and command help. A graph may miss reflective or dynamic
calls, unsupported languages, unindexed files, or literal text. An empty result
does not prove that code or a dependency does not exist.

Use a narrowly scoped text search or direct file read only when CodeGraph is
unavailable, fails after a reasonable recovery attempt, or cannot represent the
required information. State the concrete limitation and fallback scope. Do not
use this exception to perform routine code navigation with grep or raw reads.

Use affected-test results to select validation, not as proof that no other tests
are needed. Run the relevant existing tests and account for graph limitations.
