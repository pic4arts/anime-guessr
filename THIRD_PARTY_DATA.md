# Datenquellen

Der lokale Anime-Katalog wird mit `npm run update-catalog` aus zwei Quellen erzeugt:

1. [anime-offline-database](https://github.com/manami-project/anime-offline-database)
   - Anime-Metadaten, Synonyme und Querverweise zu AniList und AniDB
   - Lizenz: Open Data Commons Open Database License (ODbL) v1.0 und Database Contents License (DbCL) v1.0
   - Der genaue Lizenzname und die Lizenz-URL werden zusätzlich in `data/anime_catalog.json` gespeichert.

2. [AniDB Anime Titles Dump](https://wiki.anidb.net/API)
   - Sprachmarkierte deutsche, englische und japanische Titel
   - Der Dump ist laut AniDB für clientseitige Anime-Suchen vorgesehen und darf höchstens einmal pro Tag abgerufen werden.

Optional fragt die Anwendung beim Hinzufügen eines einzelnen Anime dessen Titel und Bild über die [AniList GraphQL API](https://docs.anilist.co/) ab. Das Bild wird in `data/images/` gespeichert und danach lokal ausgeliefert. Es findet kein Massenabruf von AniList-Daten statt.

Die Rechte an Bildern und Anime-Titeln verbleiben bei den jeweiligen Rechteinhabern. Der MIT-Lizenztext des Programmcodes erstreckt sich nicht automatisch auf importierte Datensätze oder Bilder.
