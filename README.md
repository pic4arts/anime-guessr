# Anime Guessr

Lokale Webanwendung zum Verwalten von sieben AMV-Anime-Listen.

## Funktionen

- Sieben getrennte AMV-Listen
- Lokaler Offline-Katalog mit deutscher, englischer, Romaji- und Originalschreibweise
- Autocomplete-Suche ohne Internetverbindung
- Auswahl, Bearbeitung und Löschen von Listeneinträgen
- Automatisches, lokales Speichern in `anime_data.json`
- Optionale Banner-/Cover-Vorschau beim Überfahren eines Anime
- Einmal geladene Bilder funktionieren anschließend offline
- Bestehende Einträge im alten Format `{ "name": "...", "selected": false }` bleiben kompatibel

## Start

```powershell
npm install
npm start
```

Danach ist die Anwendung unter `http://localhost:3000` erreichbar.

## Vollständigen Offline-Katalog erzeugen

Das Repository enthält einen kleinen Startkatalog, damit die Funktion direkt ausprobiert werden kann. Für den vollständigen Katalog:

```powershell
npm run update-catalog
```

Dieser Befehl lädt die aktuelle `anime-offline-database` und den mehrsprachigen AniDB-Titeldump, führt beide zusammen und schreibt das Ergebnis nach `data/anime_catalog.json`. Die Aktualisierung benötigt Internet; die spätere Suche nicht.

AniDB bittet darum, den Titeldump höchstens einmal täglich abzurufen.

## Bedienung

1. Im Feld „Anime hinzufügen“ mindestens zwei Zeichen eingeben.
2. Einen Treffer aus dem lokalen Katalog auswählen.
3. „Hinzufügen“ drücken.
4. Beim Hinzufügen versucht die Anwendung im Hintergrund, ein Banner oder Cover zu speichern. Ohne Internet wird der Anime trotzdem hinzugefügt.
5. Ein Klick auf einen Listeneintrag markiert ihn. Enter in der Listensuche markiert alle sichtbaren Treffer.

Wenn ein Anime nicht im Katalog vorhanden ist, kann er weiterhin als eigener Titel hinzugefügt werden.

## Datenspeicherung

| Pfad | Inhalt |
| --- | --- |
| `anime_data.json` | Persönliche AMV-Listen |
| `data/anime_catalog.json` | Lokal durchsuchbarer Anime-Katalog |
| `data/images/` | Lokal gespeicherte Banner und Cover |

Der Katalog und die Bilder werden nicht für die normale Nutzung aus dem Internet nachgeladen. Nur das optionale Speichern eines Bildes benötigt beim ersten Mal eine Verbindung.

## Build

```powershell
npm run build
```

Die statischen Dateien und der Startkatalog werden über die `pkg`-Konfiguration in den Build aufgenommen. Persönliche Listen und gecachte Bilder werden neben der ausführbaren Datei gespeichert.

## Tests

```powershell
npm test
```

Der Smoke-Test verwendet ein isoliertes temporäres Verzeichnis und verändert die echten AMV-Listen nicht.

## Datenquellen und Lizenzen

Siehe [THIRD_PARTY_DATA.md](THIRD_PARTY_DATA.md).

Der Programmcode steht unter der MIT-Lizenz. Importierte Datensätze und Bilder unterliegen ihren eigenen Bedingungen.
