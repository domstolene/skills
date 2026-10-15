---
name: korriger-tilbakemeldinger-i-pr
description: Korriger tilbakemeldinger i en pull request ved å bruke GitHub kommandolinje.
---

Pull request har fått tilbakemeldinger. Bruk gh kommandolinje til å korrigere feilene dersom de stemmer.

Korriger feilene en etter en. For korrigeringer i koden, kun korriger dersom du klarer å lage en regresjonstest som viser problemet som kan oppstå. Foretrekk enkle løsninger og "dette kommer sannsynligvis ikke til å skje" enn å lage kompliserte regresjonstester som viser edge case vi enda ikke har opplevd.

Commit etter feilen er korrigert og kommenter i pr "Fikset i <git-sha>". Ikke legg med flere kommentarer, commit skal dokumentere rettingen tilstrekkelig.

Vent også og se at alle sjekker i PR passerer. Dersom noen feiler, undersøk hvorfor og korriger feilene.

Når alle feil er korrigert, spør om ny review. Vent og se om det kommer flere tilbakemeldinger, og fortsett til alle feil er korrigert.

Når du er ferdig, lag et sammendrag og oppdater PR med *lag-pr* skill (ikke skriv noe om hva du har verifisert i PR-beskrivelsen).