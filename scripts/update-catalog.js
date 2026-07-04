const fs = require('fs');
const path = require('path');
const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');

const PROJECT_DIR = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(PROJECT_DIR, 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'anime_catalog.json');
const OFFLINE_DATABASE_URL = 'https://github.com/manami-project/anime-offline-database/releases/latest/download/anime-offline-database-minified.json';
const ANIDB_TITLES_URL = 'https://anidb.net/api/anime-titles.xml.gz';
const MAX_DOWNLOAD_BYTES = 250 * 1024 * 1024;

function download(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Zu viele Weiterleitungen'));
            return;
        }

        const request = https.get(url, {
            headers: {
                'User-Agent': 'Anime-Guessr-Catalog-Updater/1.0',
                Accept: '*/*',
            },
            timeout: 30000,
        }, response => {
            if (
                response.statusCode >= 300
                && response.statusCode < 400
                && response.headers.location
            ) {
                response.resume();
                const redirectUrl = new URL(response.headers.location, url).toString();
                download(redirectUrl, redirectCount + 1).then(resolve, reject);
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`Download fehlgeschlagen: HTTP ${response.statusCode}`));
                return;
            }

            const chunks = [];
            let totalBytes = 0;
            response.on('data', chunk => {
                totalBytes += chunk.length;
                if (totalBytes > MAX_DOWNLOAD_BYTES) {
                    request.destroy(new Error('Download ist größer als erlaubt'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
        });

        request.on('timeout', () => request.destroy(new Error('Download-Zeitüberschreitung')));
        request.on('error', reject);
    });
}

function decodeXml(value) {
    return value
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');
}

function parseAniDbTitles(xml) {
    const result = new Map();
    const animePattern = /<anime aid="(\d+)">([\s\S]*?)<\/anime>/g;
    const titlePattern = /<title\b([^>]*)>([\s\S]*?)<\/title>/g;
    let animeMatch;

    while ((animeMatch = animePattern.exec(xml)) !== null) {
        const titles = [];
        let titleMatch;
        titlePattern.lastIndex = 0;

        while ((titleMatch = titlePattern.exec(animeMatch[2])) !== null) {
            const type = titleMatch[1].match(/\btype="([^"]+)"/)?.[1];
            const language = titleMatch[1].match(/\bxml:lang="([^"]+)"/)?.[1];
            if (!type || !language) {
                continue;
            }
            titles.push({
                type,
                language,
                value: decodeXml(titleMatch[2]).trim(),
            });
        }

        result.set(animeMatch[1], titles);
    }

    return result;
}

function chooseTitle(titles, languages) {
    const typePriority = ['official', 'main', 'syn', 'short'];

    for (const language of languages) {
        for (const type of typePriority) {
            const match = titles.find(title => (
                title.language === language
                && title.type === type
                && title.value
            ));
            if (match) {
                return match.value;
            }
        }
    }

    return null;
}

function sourceId(sources, pattern) {
    for (const source of sources) {
        const match = source.match(pattern);
        if (match) {
            return match[1];
        }
    }
    return null;
}

function stableId(anilistId, anidbId, sources) {
    if (anilistId) return `anilist-${anilistId}`;
    if (anidbId) return `anidb-${anidbId}`;
    const digest = crypto.createHash('sha1').update(sources[0] || '').digest('hex').slice(0, 14);
    return `anime-${digest}`;
}

function uniqueStrings(values) {
    const seen = new Set();
    const result = [];

    for (const value of values) {
        const trimmed = String(value || '').trim();
        const key = trimmed.toLocaleLowerCase('de');
        if (!trimmed || seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(trimmed);
    }

    return result;
}

async function main() {
    console.log('Lade anime-offline-database ...');
    const offlineDatabaseBuffer = await download(OFFLINE_DATABASE_URL);
    console.log('Lade mehrsprachige AniDB-Titel ...');
    const aniDbTitlesCompressed = await download(ANIDB_TITLES_URL);

    const offlineDatabase = JSON.parse(offlineDatabaseBuffer.toString('utf8'));
    const aniDbTitlesXml = zlib.gunzipSync(aniDbTitlesCompressed).toString('utf8');
    const aniDbTitles = parseAniDbTitles(aniDbTitlesXml);
    const sourceEntries = Array.isArray(offlineDatabase.data) ? offlineDatabase.data : [];

    console.log(`Verarbeite ${sourceEntries.length} Einträge ...`);
    const anime = sourceEntries.map(entry => {
        const sources = Array.isArray(entry.sources) ? entry.sources : [];
        const anilistId = sourceId(sources, /^https?:\/\/anilist\.co\/anime\/(\d+)/i);
        const anidbId = sourceId(sources, /^https?:\/\/anidb\.net\/anime\/(\d+)/i);
        const localizedTitles = aniDbTitles.get(anidbId) || [];
        const sourceAliases = uniqueStrings(Array.isArray(entry.synonyms) ? entry.synonyms : []);
        const romajiTitle = chooseTitle(localizedTitles, ['x-jat', 'x-kot', 'x-zht'])
            || entry.title
            || null;
        const titles = {
            german: chooseTitle(localizedTitles, ['de']),
            english: chooseTitle(localizedTitles, ['en']) || entry.title || null,
            romaji: romajiTitle,
            native: chooseTitle(localizedTitles, ['ja'])
                || sourceAliases.find(alias => /[\u3040-\u30ff]/u.test(alias))
                || null,
        };
        const primaryTitles = Object.values(titles).filter(Boolean);
        const aliases = sourceAliases
            .filter(alias => !primaryTitles.some(title => title.toLocaleLowerCase('de') === alias.toLocaleLowerCase('de')));

        return {
            id: stableId(anilistId, anidbId, sources),
            anilistId: anilistId ? Number(anilistId) : null,
            anidbId: anidbId ? Number(anidbId) : null,
            titles,
            aliases,
            year: entry.animeSeason?.year || null,
            type: entry.type || null,
            picture: entry.picture || null,
            thumbnail: entry.thumbnail || null,
        };
    });

    anime.sort((a, b) => {
        const titleA = a.titles.german || a.titles.english || a.titles.romaji || '';
        const titleB = b.titles.german || b.titles.english || b.titles.romaji || '';
        return titleA.localeCompare(titleB, 'de');
    });

    const output = {
        version: 1,
        lastUpdate: offlineDatabase.lastUpdate || new Date().toISOString().slice(0, 10),
        source: offlineDatabase.repository || 'https://github.com/manami-project/anime-offline-database',
        license: offlineDatabase.license || null,
        titleSource: 'https://anidb.net/api/anime-titles.xml.gz',
        anime,
    };

    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    const temporaryFile = `${OUTPUT_FILE}.tmp`;
    fs.writeFileSync(temporaryFile, JSON.stringify(output), 'utf8');
    fs.renameSync(temporaryFile, OUTPUT_FILE);
    console.log(`Offline-Katalog gespeichert: ${OUTPUT_FILE}`);
    console.log(`${anime.length} Anime, ${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(error => {
    console.error('Katalog konnte nicht aktualisiert werden:', error);
    process.exitCode = 1;
});
