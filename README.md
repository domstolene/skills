# Skills for KI-agenter

En samling gjenbrukbare agent-skills. Hver skill er en mappe under `skills/`
med en `SKILL.md` som inneholder YAML-metadata og instruksjoner.

## Tilgjengelige skills

<!-- skills:start -->

| Skill | Beskrivelse |
| --- | --- |
| [korriger-tilbakemeldinger-i-pr](./skills/korriger-tilbakemeldinger-i-pr/SKILL.md) | Korriger tilbakemeldinger i en pull request ved å bruke GitHub kommandolinje. |

<!-- skills:end -->

Oversikten mellom markørene genereres av `pnpm readme:update`.


## Installere

For å installere en eller flere skills fra repoet, kjør:

```shell
pnpm skills:install
```

Skriptet oppretter én symbolsk lenke per valgt skill i hver av mappene
i hjemmemappen:

```text
~/.agent/skills/oppsummer-endringer -> /sti/til/klonen/skills/oppsummer-endringer
~/.copilot/skills/oppsummer-endringer -> /sti/til/klonen/skills/oppsummer-endringer
```

Uten argumenter viser skriptet en nummerert meny. Skriv ett eller flere nummer
eller navn separert med komma, eller `alle`. Enter avbryter uten å installere.

For å oppdatere skills, henter du siste endringer fra main:

```shell
git pull origin main
```

Dersom du vet hvilken skill du ønsker, kan du angi det som parametre på kommandolinje:

```shell
pnpm skills:install -- oppsummer-endringer
pnpm skills:install -- --all
pnpm skills:install -- --list
pnpm skills:install -- --help
```

- For å velge installerte skills og fjerne lenkene i `~/.agent/skills` og
  `~/.copilot/skills`, kjør `pnpm skills:remove`. Velg på samme måte som ved
  installering. `pnpm skills:remove -- --all` fjerner alle identifiserte lenker.
- Siden lenker brukes, vil lokale filendringer bli aktive med en gang i begge installasjonene.
- Nye skills må velges og installeres; de installeres ikke automatisk ved pull.
- Samme installasjon kan kjøres flere ganger. Riktige lenker beholdes.
- Eksisterende mapper, filer, andre lenker og brutte lenker overskrives aldri.
  Ved konflikt stopper skriptet med feilmelding og feilkode. Skills installert
  før konflikten beholdes. Flytt eller fjern konflikten manuelt før nytt forsøk.
- Behold klonen på samme sted. Flytting/sletting av klonen eller sletting av en
  installert skill gjør lenken ubrukelig.
- Fjerning sletter bare symbolske lenker som peker på skill-mappen i denne
  klonen, ikke kildemappen under `skills/`. Eksisterende mapper, filer, andre
  lenker og brutte lenker beholdes.
- Eventuelle kopier fra den tidligere installasjonen i repoets `.agent/skills`
  brukes ikke lenger og fjernes ikke automatisk.


## Legge til skills

```text
skills/
  min-skill/
    SKILL.md
    scripts/       (valgfritt)
    references/    (valgfritt)
    assets/        (valgfritt)
```

Start `SKILL.md` slik:

```yaml
---
name: min-skill
description: Beskriv hva skillen gjør og når agenten skal bruke den.
---
```

Skriv konkrete instruksjoner under metadataene. `name` må være identisk med
mappenavnet, maksimalt 64 tegn, og bestå av små bokstaver, tall og enkle bindestreker
mellom ordene. `description` må være 1–1024 tegn; YAML-flerlinjetekst støttes.
Lenk eventuelle ressurser relativt fra `SKILL.md`. Se
[eksempelskillen](./skills/oppsummer-endringer/SKILL.md) og
[Agent Skills-spesifikasjonen](https://agentskills.io/specification).

Alle ikke-skjulte undermapper direkte under `skills/` må være gyldige skills.
Skriptet melder feil ved manglende filer eller ugyldige metadata, i stedet for
å skjule dem fra oversikten. Ekstra ressursmapper legges inne i den enkelte skill.

List skills, oppdater oversikten, og kontroller før innsjekking:

```shell
pnpm readme:check
pnpm readme:update
pnpm skills:list
pnpm test
```

`readme:update` skriver bare mellom markørene og viser samtidig oversikten i
terminalen. `readme:check` endrer ingenting og feiler hvis oversikten er utdatert.
Commit både nye skills og oppdatert README.
