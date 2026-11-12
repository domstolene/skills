---
name: code-refactoring
description: Use ast-grep for structural code search, AST pattern matching, constrained rewrites, codemods, and API migrations. Activate when a task depends on syntax shape, arguments, or enclosing constructs rather than symbol identity. Complements code-navigation (CodeGraph); not for general exploration, callers, dependencies, impact analysis, or semantic symbol renaming.
---

# Structural search and refactoring with ast-grep

Use ast-grep to answer "which code has this shape?" and to make verified,
syntax-aware changes. Do not use it as an alternative interface for ordinary
code navigation.

## Divide the work with CodeGraph

| Question or task | Tool |
| --- | --- |
| Locate an implementation, read source, follow callers or dependencies | CodeGraph via `code-navigation` |
| Assess impact and select affected tests | CodeGraph via `code-navigation` |
| Match argument lists, repeated expressions, or enclosing syntax | ast-grep |
| Find structurally equivalent code despite whitespace or line breaks | ast-grep |
| Apply the same bounded syntax transformation at multiple sites | ast-grep |
| Rename a resolved symbol and its references | Language-aware rename/refactoring tools |

Use CodeGraph to establish the relevant files and dependencies when these are
unknown. Then run ast-grep on explicit files or a narrow directory. Structural
search does not require a CodeGraph index once its scope is known.

ast-grep matches syntax, not resolved symbols, types, or runtime behavior.
Identical receiver names can refer to different objects; aliases and shadowing
can defeat a syntactic API migration. CodeGraph context, type checks, and tests
are still needed. If semantic identity is essential and cannot be established,
do not automate that rewrite.

## Check the executable

Use `ast-grep --version` and command-specific help before relying on unfamiliar
flags.

If ast-grep is missing, report that prerequisite and ask before installing it.
Do not silently download a CLI, switch to regex replacement, or claim that a
structural query has been verified.

The examples below use the `ast-grep` executable and shell single quotes so
metavariables reach the CLI literally. Use the parser for the actual source
language: JavaScript, TypeScript, and TSX are not interchangeable.

## Workflow

1. **Define the transformation or query.** Identify language, paths, syntax
   variants, exclusions, and expected behavior. For a rewrite, define the
   before/after contract and check for existing edits in the target files.
   Clarify ambiguity that would change which code is modified.
2. **Build a small fixture.** Include representative matches and near misses:
   different argument counts, multiline formatting, comments and string
   lookalikes, different receivers, and nested scopes where relevant. For a
   rewrite, specify the exact expected output too.
3. **Prove the smallest pattern.** Start with `run --pattern`. Add YAML rules
   only when context or constraints are required. Verify both positive and
   negative cases, not just that one match exists.
4. **Inspect scoped repository matches.** Check captured values and every
   distinct syntax variant before proposing a bulk edit. Zero matches are not
   evidence of absence until parser, pattern shape, and file coverage are checked.
5. **Preview, then apply.** Use a rewrite preview without write flags first.
   Apply only to the verified scope; do not broaden paths during application.
6. **Validate the result.** Review the changed hunks for unintended edits, run
   relevant formatting, type checks, and tests, and rerun the original search.
   Account for every remaining match or exclusion. For migrations, rerun the
   rewrite as a preview to check that no further changes are proposed.

Keep temporary fixtures and one-off rules outside product source and remove
them afterward. Persist rules or regression fixtures in the repository only
when the task calls for a reusable codemod or lint rule; follow existing layout.

## Patterns and captures

| Syntax | Meaning |
| --- | --- |
| `$ARG` | One named AST node; names use uppercase letters, digits, and underscores |
| `$$$ARGS` | Zero or more nodes, such as a complete argument list |
| `$_` | An uncaptured single-node wildcard |
| `$VALUE === $VALUE` | Repeated captured names require structurally matching content |

`client.send($ARG)` does not match calls with zero or multiple arguments.
Use `client.send($$$ARGS)` when all arities are intended, and preserve the named
capture in the replacement. Do not use the same capture name for independent
values. Patterns match parsed nodes, not arbitrary text fragments or names
resolved through imports.

Search a known scope:

```shell
ast-grep run --lang typescript --pattern 'legacyClient.request($$$ARGS)' src/api
```

Test a pattern without writing a file:

```shell
printf '%s\n' 'legacyClient.request("/cases", options)' \
  | ast-grep run --lang typescript --pattern 'legacyClient.request($$$ARGS)' --stdin --json
```

Use `--json` for machine-readable matches rather than parsing terminal output.
The default JSON output is an array; match ranges use zero-based lines and
columns. Named single-node captures are in `metaVariables.single`, and
list captures in `metaVariables.multi`.

## Rules for context-sensitive matching

Use a YAML rule when a pattern alone cannot express the question:

- `kind` selects a language-specific Tree-sitter node type.
- `all`, `any`, and `not` combine conditions on the target node.
- `inside` checks ancestors; `has` checks descendants.
- `follows` and `precedes` check sibling relationships.
- `constraints` restricts named captures, for example by node kind or regex.
- An object-style `pattern` with `context` and `selector` disambiguates syntax
  that cannot be parsed correctly as a standalone fragment.

Choose the node returned by the rule deliberately. A function with a `has`
condition returns the function, not the matching call inside it; that matters
when applying a fix.

For example, this rule finds console logging syntactically enclosed by a
TypeScript catch clause:

```yaml
id: console-log-in-catch
language: TypeScript
rule:
  pattern: console.log($$$ARGS)
  inside:
    kind: catch_clause
    stopBy: end
```

Save it as a temporary `console-log-in-catch.yml` and test it against a fixture
before scanning a scoped directory:

```shell
ast-grep scan --rule console-log-in-catch.yml fixtures/example.ts --json
ast-grep scan --rule console-log-in-catch.yml src/api --json
```

### Set traversal boundaries intentionally

Relational rules default to `stopBy: neighbor`, which only checks the immediate
relationship. Use `stopBy: end` when the entire ancestor chain or subtree is
intended; use a stopping rule when traversal must stay within a particular
scope. Do not add `stopBy: end` mechanically.

The catch-clause example also matches calls in nested functions declared inside
the catch. It does not prove that the call executes during error handling.
Likewise, finding a `try` somewhere in a function does not prove that all its
`await` expressions are protected. Define the desired boundary and test nested
functions, lambdas, and methods explicitly.

## Debug unexpected matches or empty results

1. Run the pattern on a known-positive fixture with the correct language.
2. Inspect how the pattern is parsed:

   ```shell
   ast-grep run --lang typescript --pattern 'legacyClient.request($$$ARGS)' \
     --debug-query=ast --stdin < fixtures/example.ts
   ```

3. Use `--debug-query=cst` for punctuation and unnamed nodes, or
   `--debug-query=pattern` for the interpreted matcher. Verify node kinds instead
   of guessing them from another language's grammar.
4. Simplify composite rules, then restore one condition at a time. Check capture
   constraints, target-node selection, and traversal limits.
5. Check file extensions, ignored paths, aliases, qualified names, and syntax
   variants. Explicitly document any coverage limitations; do not disable ignore
   rules across the repository merely to get more matches.

## Safe structural rewrites

Only rewrite after proving both the match set and the replacement on fixtures.
Preserve argument order, evaluation count, side effects, async behavior, and
comments. Captures preserve matched source fragments, but comments or syntax
outside those captures may be lost when replacing a larger node.

For an API migration where the receiver change has already been verified:

```shell
ast-grep run --lang typescript \
  --pattern 'legacyClient.request($$$ARGS)' \
  --rewrite 'newClient.request($$$ARGS)' src/api
```

This previews the diff without modifying files. Once the preview is verified,
the same scoped command can be run with `--interactive` to approve individual
edits. Use `--update-all` only for an already verified bulk rewrite, never as
the initial attempt. YAML rules can express the replacement with `fix`; preview
them with `scan --rule` before using its write flags.

Do not assume the new receiver exists or has equivalent behavior. Handle
imports, types, and other required integration changes with the repository's
existing tools. Use a semantic refactoring tool instead if the migration
depends on symbol resolution.

Finish by reporting the searched scope, verified changes, validation results,
and any intentionally unmatched variants or unresolved limitations.

## Reference

Consult the official documentation when the installed CLI's help is insufficient:

- [Pattern syntax](https://ast-grep.github.io/guide/pattern-syntax.html)
- [Rule reference](https://ast-grep.github.io/reference/rule.html)
- [Rewrite guide](https://ast-grep.github.io/guide/rewrite-code.html)
- [CLI reference](https://ast-grep.github.io/reference/cli.html)
