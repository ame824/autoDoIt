# autoDoIt

`autoDoIt` ist ein modulares Vollautomatisierungssystem für Bitburner v3.
Es begleitet einen Spielstand vom frühen Start bis zur BitNode-Progression und
meldet verständlich, wenn noch ein manueller Schritt erforderlich ist.

Die vollständige deutsche und englische Anleitung, Modulübersicht,
Konfiguration und Fehlerbehebung befinden sich im
**[autoDoIt-Wiki](https://github.com/ame824/autoDoIt/wiki)**.

## Nutzung, Forks und Urheberrecht

© ame824 · [grz-gamerz.de](https://grz-gamerz.de) — Alle Rechte vorbehalten.

Das Herunterladen und Ausführen für den persönlichen Gebrauch in Bitburner ist
erlaubt. **GitHub-Forks für persönliche Konfigurationsänderungen sind ebenfalls
ausdrücklich erlaubt**, solange Copyright, Credits, Link zum Original und
Fork-Hinweis sichtbar erhalten bleiben. Solche Forks dürfen den Updater auf
das eigene Repository umstellen und Funktionen in `core/config.js` anpassen.

Nicht erlaubt ist, autoDoIt oder wesentliche Teile davon als selbst
entwickeltes Original auszugeben, die Attribution zu entfernen oder eine
veränderte Fassung als offizielles autoDoIt-Release zu bezeichnen. Die
vollständigen Bedingungen stehen in [LICENSE.md](LICENSE.md); der kurze
Urheberhinweis befindet sich in [NOTICE.md](NOTICE.md).

## Normale Installation

Im Bitburner-Terminal:

```text
wget https://raw.githubusercontent.com/ame824/autoDoIt/main/git-pull.js git-pull.js
run git-pull.js --start
```

Optional mit automatisch eingeblendeter Darknet-Konsole:

```text
run git-pull.js --start --darknet-console
```

Spätere manuelle Aktualisierung:

```text
run git-pull.js
```

## Starter-Installation unter 16 GiB

Für sehr kleine Home-Server:

```text
wget https://raw.githubusercontent.com/ame824/autoDoIt/main/git-pull-lite.js git-pull-lite.js
run git-pull-lite.js
run autoDoIt.js
```

---

`autoDoIt` is a modular full-automation system for Bitburner v3. It guides a
save from the early game through BitNode progression and provides clear
instructions whenever a manual step is still required.

The complete documentation in English and German, including modules,
configuration, and troubleshooting, is available in the
**[autoDoIt Wiki](https://github.com/ame824/autoDoIt/wiki)**.

## Use, forks, and copyright

© ame824 · [grz-gamerz.de](https://grz-gamerz.de) — All rights reserved.

Downloading and running autoDoIt for personal use in Bitburner is permitted.
**GitHub forks for personal configuration changes are explicitly permitted**
as long as the copyright, credits, upstream link, and fork notice remain
visible. Such forks may point the updater at their own repository and adjust
features in `core/config.js`.

It is not permitted to represent autoDoIt or substantial parts of it as an
independently created original, remove the attribution, or present a modified
version as an official autoDoIt release. See [LICENSE.md](LICENSE.md) for the
complete terms and [NOTICE.md](NOTICE.md) for the short attribution notice.

## Normal installation

Run in the Bitburner terminal:

```text
wget https://raw.githubusercontent.com/ame824/autoDoIt/main/git-pull.js git-pull.js
run git-pull.js --start
```

Optionally enable the automatic Darknet console:

```text
run git-pull.js --start --darknet-console
```

Later manual updates:

```text
run git-pull.js
```

## Starter installation below 16 GiB

For very small Home servers:

```text
wget https://raw.githubusercontent.com/ame824/autoDoIt/main/git-pull-lite.js git-pull-lite.js
run git-pull-lite.js
run autoDoIt.js
```
