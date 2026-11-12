---
name: git-commit
description: Whenever you make a commit, use this skill.
---

# Innhold
Commit skal forklare årsaken, hvis mulig i tittelen, i det minste i brødteksten. Melding og innhold skal være på norsk. Melding skal helst ha brødtekst med ytterligere forklaring og detaljer.

## Eksempel bra

```shell
git commit -m "SAK-123 unngå feil X når Y" -m "Dersom en gjør Z, vil det føre til X. Dette er løst ved å gjøre A og B."
```

## Eksempel dårlig
git commit -m "remove initializer"

# Prefiks
I repoet lovisa_core skal commit alltid prefixes med conventional commit, gjerne med kontekst, for eksempel "feat(developer-setup): ..." og med saksnummer i body: "Forklaring...\nRefs: SAK-123"

I alle andre repo skal commit prefikses med Jira-nummer. Det finnes som regel i branch-navnet, GLAD-123-en-feature -> "GLAD-123 ...", hvis ikke spør. Det finnes et unntak, dersom branch heter uten-issue-..., bruk da conventional commit uten Jira-nummer.
