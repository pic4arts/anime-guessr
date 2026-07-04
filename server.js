const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const LIST_COUNT = 8;
const PROJECT_DIR = __dirname;
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : PROJECT_DIR;
const PUBLIC_DIR = path.join(PROJECT_DIR, 'public');
const DATA_FILE = process.env.ANIME_DATA_FILE
    ? path.resolve(process.env.ANIME_DATA_FILE)
    : path.join(RUNTIME_DIR, 'anime_data.json');
const TEMP_DATA_FILE = `${DATA_FILE}.tmp`;
const IMAGE_DIR = process.env.ANIME_IMAGE_DIR
    ? path.resolve(process.env.ANIME_IMAGE_DIR)
    : path.join(RUNTIME_DIR, 'data', 'images');
const CATALOG_CANDIDATES = [
    path.join(RUNTIME_DIR, 'data', 'anime_catalog.json'),
    path.join(PROJECT_DIR, 'data', 'anime_catalog.json'),
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
let writeQueue = Promise.resolve();
let server;

fs.mkdirSync(IMAGE_DIR, { recursive: true });

app.use(express.static(PUBLIC_DIR));
app.use('/anime-images', express.static(IMAGE_DIR, {
    immutable: true,
    maxAge: '30d',
}));
app.use(express.json({ limit: '5mb' }));

if (!fs.existsSync(DATA_FILE)) {
    const initialData = Array.from({ length: LIST_COUNT }, () => []);
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    console.log('Anime-Listen wurden initialisiert.');
} else {
    try {
        const storedData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        if (Array.isArray(storedData) && storedData.length === LIST_COUNT - 1) {
            storedData.push([]);
            fs.writeFileSync(DATA_FILE, JSON.stringify(storedData, null, 2), 'utf8');
            console.log('Anime-Listen wurden von sieben auf acht Listen erweitert.');
        }
    } catch (error) {
        console.warn('Bestehende Anime-Listen konnten beim Start nicht migriert werden:', error.message);
    }
}

function normalizeSearchText(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('de')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

function loadCatalog() {
    const catalogFile = CATALOG_CANDIDATES.find(candidate => fs.existsSync(candidate));

    if (!catalogFile) {
        console.warn('Kein Offline-Katalog gefunden. Führe "npm run update-catalog" aus.');
        return {
            file: null,
            lastUpdate: null,
            source: null,
            license: null,
            anime: [],
            byId: new Map(),
        };
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(catalogFile, 'utf8'));
        const anime = Array.isArray(parsed.anime) ? parsed.anime : [];

        anime.forEach(entry => {
            if (!entry.titles) {
                entry.titles = {};
            }
            if (!entry.titles.native && Array.isArray(entry.aliases)) {
                entry.titles.native = entry.aliases.find(alias => /[\u3040-\u30ff]/u.test(alias)) || null;
            }
            const titleValues = [
                entry.titles?.german,
                entry.titles?.english,
                entry.titles?.romaji,
                entry.titles?.native,
                ...(Array.isArray(entry.aliases) ? entry.aliases : []),
            ].filter(Boolean);
            entry._searchTitles = titleValues.map(normalizeSearchText).filter(Boolean);
            entry._searchText = entry._searchTitles.join(' | ');
        });

        console.log(`Offline-Katalog geladen: ${anime.length} Anime.`);
        return {
            file: catalogFile,
            lastUpdate: parsed.lastUpdate || null,
            source: parsed.source || null,
            license: parsed.license || null,
            anime,
            byId: new Map(anime.map(entry => [String(entry.id), entry])),
        };
    } catch (error) {
        console.error('Offline-Katalog konnte nicht geladen werden:', error);
        return {
            file: catalogFile,
            lastUpdate: null,
            source: null,
            license: null,
            anime: [],
            byId: new Map(),
        };
    }
}

const catalog = loadCatalog();

function getLocalImage(id) {
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const extensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

    for (const extension of extensions) {
        const filename = `${safeId}.${extension}`;
        if (fs.existsSync(path.join(IMAGE_DIR, filename))) {
            return `/anime-images/${filename}`;
        }
    }

    return null;
}

function publicCatalogEntry(entry) {
    return {
        id: entry.id,
        anilistId: entry.anilistId || null,
        titles: entry.titles || {},
        year: entry.year || null,
        type: entry.type || null,
        image: getLocalImage(entry.id),
    };
}

function scoreCatalogEntry(entry, query) {
    let score = 100;

    for (const title of entry._searchTitles) {
        if (title === query) {
            score = Math.min(score, 0);
        } else if (title.startsWith(query)) {
            score = Math.min(score, 10 + title.length - query.length);
        } else {
            const wordIndex = title.indexOf(` ${query}`);
            if (wordIndex >= 0) {
                score = Math.min(score, 30 + wordIndex);
            } else {
                const index = title.indexOf(query);
                if (index >= 0) {
                    score = Math.min(score, 50 + index);
                }
            }
        }
    }

    return score;
}

app.get('/api/catalog/status', (req, res) => {
    res.json({
        available: catalog.anime.length > 0,
        count: catalog.anime.length,
        lastUpdate: catalog.lastUpdate,
        source: catalog.source,
        license: catalog.license,
    });
});

app.get('/api/catalog/search', (req, res) => {
    const query = normalizeSearchText(req.query.q);

    if (query.length < 2) {
        return res.json([]);
    }

    const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 25);
    const matches = [];

    for (const entry of catalog.anime) {
        if (!entry._searchText.includes(query)) {
            continue;
        }

        matches.push({
            score: scoreCatalogEntry(entry, query),
            entry,
        });
    }

    matches.sort((a, b) => {
        if (a.score !== b.score) {
            return a.score - b.score;
        }

        const yearA = a.entry.year || 9999;
        const yearB = b.entry.year || 9999;
        return yearA - yearB;
    });

    const uniqueMatches = [];
    const seen = new Set();

    for (const match of matches) {
        const entry = match.entry;
        const primaryTitle = entry.titles?.german
            || entry.titles?.english
            || entry.titles?.romaji
            || entry.titles?.native
            || entry.id;
        const key = [
            normalizeSearchText(primaryTitle),
            entry.year || '',
            entry.type || '',
        ].join('|');

        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        uniqueMatches.push(publicCatalogEntry(entry));

        if (uniqueMatches.length >= limit) {
            break;
        }
    }

    res.json(uniqueMatches);
});

app.get('/api/anime', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (error, data) => {
        if (error) {
            console.error('Fehler beim Lesen der Anime-Listen:', error);
            return res.status(500).json({ error: 'Fehler beim Laden der Daten' });
        }

        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            console.error('Fehler beim Parsen der Anime-Listen:', parseError);
            res.status(500).json({ error: 'Fehler beim Parsen der Daten' });
        }
    });
});

function isValidAnimeData(data) {
    if (!Array.isArray(data) || data.length !== LIST_COUNT) {
        return false;
    }

    return data.every(list => Array.isArray(list) && list.every(entry => (
        entry
        && typeof entry === 'object'
        && typeof entry.name === 'string'
        && entry.name.trim().length > 0
        && entry.name.length <= 500
    )));
}

app.post('/api/anime', async (req, res) => {
    if (!isValidAnimeData(req.body)) {
        return res.status(400).json({
            error: 'Ungültiges Datenformat. Es werden acht Anime-Listen erwartet.',
        });
    }

    const newData = JSON.stringify(req.body, null, 2);
    const writeOperation = writeQueue.then(async () => {
        await fs.promises.writeFile(TEMP_DATA_FILE, newData, 'utf8');
        await fs.promises.rename(TEMP_DATA_FILE, DATA_FILE);
    });

    writeQueue = writeOperation.catch(() => {});

    try {
        await writeOperation;
        res.json({ message: 'Daten erfolgreich gespeichert' });
    } catch (error) {
        console.error('Fehler beim Schreiben der Anime-Listen:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Daten' });
    }
});

function requestBuffer(url, options = {}, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            reject(new Error('Zu viele Weiterleitungen'));
            return;
        }

        const transport = url.startsWith('https:') ? https : http;
        const request = transport.request(url, {
            method: options.method || 'GET',
            headers: {
                'User-Agent': 'Anime-Guessr/1.1',
                Accept: options.accept || '*/*',
                ...(options.headers || {}),
            },
            timeout: options.timeout || 6000,
        }, response => {
            if (
                response.statusCode >= 300
                && response.statusCode < 400
                && response.headers.location
            ) {
                response.resume();
                const redirectUrl = new URL(response.headers.location, url).toString();
                requestBuffer(redirectUrl, options, redirectCount + 1).then(resolve, reject);
                return;
            }

            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }

            const chunks = [];
            let totalBytes = 0;

            response.on('data', chunk => {
                totalBytes += chunk.length;
                const maxBytes = options.maxBytes || MAX_IMAGE_BYTES;
                if (totalBytes > maxBytes) {
                    request.destroy(new Error('Antwort ist zu groß'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => {
                resolve({
                    body: Buffer.concat(chunks),
                    contentType: String(response.headers['content-type'] || ''),
                });
            });
        });

        request.on('timeout', () => request.destroy(new Error('Zeitüberschreitung')));
        request.on('error', reject);

        if (options.body) {
            request.write(options.body);
        }
        request.end();
    });
}

async function fetchAniListMedia(anilistId) {
    const query = `
        query ($id: Int!) {
            Media(id: $id, type: ANIME) {
                title {
                    romaji
                    english
                    native
                }
                bannerImage
                coverImage {
                    extraLarge
                    large
                }
            }
        }
    `;
    const body = JSON.stringify({
        query,
        variables: { id: Number(anilistId) },
    });
    const response = await requestBuffer('https://graphql.anilist.co', {
        method: 'POST',
        accept: 'application/json',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        },
        body,
        maxBytes: 1024 * 1024,
    });
    const parsed = JSON.parse(response.body.toString('utf8'));

    if (!parsed.data?.Media) {
        throw new Error(parsed.errors?.[0]?.message || 'AniList-Eintrag nicht gefunden');
    }

    return parsed.data.Media;
}

function imageExtension(contentType, imageUrl) {
    if (contentType.includes('image/png')) return 'png';
    if (contentType.includes('image/webp')) return 'webp';
    if (contentType.includes('image/gif')) return 'gif';
    if (contentType.includes('image/jpeg')) return 'jpg';

    const pathname = new URL(imageUrl).pathname.toLowerCase();
    const extension = path.extname(pathname).slice(1);
    return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(extension) ? extension : 'jpg';
}

async function cacheImage(entry, imageUrl) {
    const existing = getLocalImage(entry.id);
    if (existing) {
        return existing;
    }

    const response = await requestBuffer(imageUrl, {
        accept: 'image/*',
        maxBytes: MAX_IMAGE_BYTES,
        timeout: 10000,
    });

    if (!response.contentType.startsWith('image/')) {
        throw new Error('Die geladene Datei ist kein Bild');
    }

    const extension = imageExtension(response.contentType, imageUrl);
    const safeId = String(entry.id).replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${safeId}.${extension}`;
    const target = path.join(IMAGE_DIR, filename);
    const temporaryTarget = `${target}.tmp`;
    await fs.promises.writeFile(temporaryTarget, response.body);
    await fs.promises.rename(temporaryTarget, target);
    return `/anime-images/${filename}`;
}

app.post('/api/catalog/:id/cache-image', async (req, res) => {
    const entry = catalog.byId.get(String(req.params.id));

    if (!entry) {
        return res.status(404).json({ error: 'Anime nicht im Offline-Katalog gefunden' });
    }

    const result = publicCatalogEntry(entry);
    if (result.image) {
        return res.json(result);
    }

    const fallbackImageUrl = entry.picture || entry.thumbnail || null;
    let imageUrl = fallbackImageUrl;

    try {
        if (entry.anilistId) {
            const media = await fetchAniListMedia(entry.anilistId);
            result.titles = {
                ...result.titles,
                romaji: media.title?.romaji || result.titles.romaji || null,
                english: media.title?.english || result.titles.english || null,
                native: media.title?.native || result.titles.native || null,
            };
            imageUrl = media.bannerImage
                || media.coverImage?.extraLarge
                || media.coverImage?.large
                || imageUrl;
        }

        if (!imageUrl) {
            return res.json(result);
        }

        result.image = await cacheImage(entry, imageUrl);
        res.json(result);
    } catch (error) {
        console.warn(`Bild für ${entry.id} konnte nicht gespeichert werden: ${error.message}`);

        if (fallbackImageUrl && fallbackImageUrl !== imageUrl) {
            try {
                result.image = await cacheImage(entry, fallbackImageUrl);
                return res.json(result);
            } catch (fallbackError) {
                console.warn(`Ersatzbild für ${entry.id} nicht verfügbar: ${fallbackError.message}`);
            }
        }

        res.status(503).json({
            ...result,
            error: 'Bild ist momentan nicht verfügbar. Der Anime wurde trotzdem hinzugefügt.',
        });
    }
});

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({ error: 'Ungültiges JSON' });
    }
    next(error);
});

function startServer() {
    if (server) {
        return server;
    }

    server = app.listen(PORT, () => {
        console.log(`Server läuft auf http://localhost:${PORT}`);
        console.log(`Anime-Listen: ${DATA_FILE}`);
    });
    return server;
}

if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    startServer,
};
