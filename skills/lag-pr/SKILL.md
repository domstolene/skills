---
name: lag-pr
description: Hjelper med å fylle ut hva som er gjort og hvorfor på en strukturert måte
---

Hjelp brukeren med å lage en PR-beskrivelse basert på siste commits fra main-branchen. Begynn med å hente alle relevante commits: `git log main..HEAD`

Sjekk deretter om PR allerede eksisteter: `gh pr view`

Finn saksnummer fra branch eller commitmeldinger: `git branch --show-current`

Pull request skal ha denne formen:

> Tittel: SAK-123: kort beskrivelse (hvorfor eller hva)
>
> ## Hvorfor
> Beskrivelse av hvorfor endringene er gjort.
>
> ## Hva
> Beskrivelse av hva endringene faktisk gjør.
>
> ## Commits
> - commit-hash: commit-message
> - commit-hash: commit-message

Dersom det ikke er åpenbart fra commitmeldinger og endringer hvorfor en endring er gjort, spør brukeren.

La output være kommandoen som skal kjøres med `gh`-cli for å opprette pull requesten, eller endre den dersom PR allerede eksisterer. Spør brukeren om hen vil kjøre kommandoen.