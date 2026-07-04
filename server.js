const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const LIST_COUNT = 8;
const MAX_RESOLVE_QUERIES = 500;
const PROJECT_DIR = __dirname;
const RUNTIME_DIR = process.pkg ? path.dirname(process.execPath) : PROJECT_DIR;
const PUBLIC_DIR = path.join(PROJECT_DIR, 'public');
const DATA_FILE = process.env.ANIME_DATA_FILE
    ? path.resolve(process.env.ANIME_DATA_FILE)
    : path.join(RUNTIME_DIR, 'anime_data.json');
const TEMP_DATA_FILE = `${DATA_FILE}.tmp`;
const TOURNAMENT_DATA_FILE = process.env.TOURNAMENT_DATA_FILE
    ? path.resolve(process.env.TOURNAMENT_DATA_FILE)
    : path.join(RUNTIME_DIR, 'tournament_data.json');
const TEMP_TOURNAMENT_DATA_FILE = `${TOURNAMENT_DATA_FILE}.tmp`;
const IMAGE_DIR = process.env.ANIME_IMAGE_DIR
    ? path.resolve(process.env.ANIME_IMAGE_DIR)
    : path.join(RUNTIME_DIR, 'data', 'images');
const CATALOG_CANDIDATES = [
    path.join(RUNTIME_DIR, 'data', 'anime_catalog.json'),
    path.join(PROJECT_DIR, 'data', 'anime_catalog.json'),
];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ANILIST_REQUEST_INTERVAL_MS = 2100;
const IMAGE_REQUEST_INTERVAL_MS = 500;
const MAX_RATE_LIMIT_RETRIES = 2;
let writeQueue = Promise.resolve();
let tournamentWriteQueue = Promise.resolve();
let aniListRequestQueue = Promise.resolve();
let imageRequestQueue = Promise.resolve();
let lastAniListRequestAt = 0;
let lastImageRequestAt = 0;
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

function createEmptyTournamentData() {
    return {
        participants: Array(8).fill(''),
        winners: Array(8).fill(null),
        amvs: Array.from({ length: 8 }, () => ({
            name: '',
            youtubeUrl: '',
        })),
    };
}

function normalizeTournamentData(data) {
    if (
        !data
        || !Array.isArray(data.participants)
        || data.participants.length !== 8
        || !data.participants.every(name => typeof name === 'string' && name.length <= 100)
        || !Array.isArray(data.winners)
        || data.winners.length !== 8
        || !data.winners.every(winner => winner === null || winner === 0 || winner === 1)
    ) {
        return null;
    }

    let amvs = data.amvs;
    if (amvs === undefined) {
        amvs = createEmptyTournamentData().amvs;
    }
    if (
        !Array.isArray(amvs)
        || amvs.length !== 8
        || !amvs.every(amv => (
            amv
            && typeof amv === 'object'
            && typeof amv.name === 'string'
            && amv.name.length <= 200
            && typeof amv.youtubeUrl === 'string'
            && amv.youtubeUrl.length <= 500
        ))
    ) {
        return null;
    }

    return {
        participants: data.participants,
        winners: data.winners,
        amvs: amvs.map(amv => ({
            name: amv.name,
            youtubeUrl: amv.youtubeUrl,
        })),
    };
}

if (!fs.existsSync(TOURNAMENT_DATA_FILE)) {
    fs.writeFileSync(
        TOURNAMENT_DATA_FILE,
        JSON.stringify(createEmptyTournamentData(), null, 2),
        'utf8'
    );
    console.log('Turnier-Teilnehmer wurden initialisiert.');
} else {
    try {
        const storedTournamentData = JSON.parse(
            fs.readFileSync(TOURNAMENT_DATA_FILE, 'utf8')
        );
        const normalizedTournamentData = normalizeTournamentData(storedTournamentData);
        if (normalizedTournamentData && storedTournamentData.amvs === undefined) {
            fs.writeFileSync(
                TOURNAMENT_DATA_FILE,
                JSON.stringify(normalizedTournamentData, null, 2),
                'utf8'
            );
            console.log('Bestehende Turnierdaten wurden um AMV-Informationen erweitert.');
        }
    } catch (error) {
        console.warn('Bestehende Turnierdaten konnten nicht migriert werden:', error.message);
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

function findCatalogEntries(queryValue, requestedLimit = 12, requireAniList = false) {
    const query = normalizeSearchText(queryValue);

    if (query.length < 2) {
        return [];
    }

    const limit = Math.min(Math.max(Number(requestedLimit) || 12, 1), 25);
    const matches = [];

    for (const entry of catalog.anime) {
        if ((requireAniList && !entry.anilistId) || !entry._searchText.includes(query)) {
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

    return uniqueMatches;
}

app.get('/api/catalog/search', (req, res) => {
    res.json(findCatalogEntries(req.query.q, req.query.limit));
});

app.post('/api/catalog/resolve', (req, res) => {
    const queries = req.body?.queries;

    if (
        !Array.isArray(queries)
        || queries.length === 0
        || queries.length > MAX_RESOLVE_QUERIES
        || queries.some(query => typeof query !== 'string' || query.length > 500)
    ) {
        return res.status(400).json({
            error: `Es werden 1 bis ${MAX_RESOLVE_QUERIES} Anime-Titel als Text erwartet.`,
        });
    }

    const matchesByQuery = new Map();
    const results = queries.map(query => {
        const normalizedQuery = normalizeSearchText(query);
        if (!matchesByQuery.has(normalizedQuery)) {
            matchesByQuery.set(
                normalizedQuery,
                findCatalogEntries(query, 1, true)[0] || null
            );
        }

        return {
            query: query.trim(),
            match: matchesByQuery.get(normalizedQuery),
        };
    });

    res.json(results);
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

app.get('/api/tournament', (req, res) => {
    fs.readFile(TOURNAMENT_DATA_FILE, 'utf8', (error, data) => {
        if (error) {
            console.error('Fehler beim Lesen der Turnierdaten:', error);
            return res.status(500).json({ error: 'Fehler beim Laden der Turnierdaten' });
        }

        try {
            const parsed = JSON.parse(data);
            const normalized = normalizeTournamentData(parsed);
            if (!normalized) {
                return res.status(500).json({ error: 'Ungültiges Turnierdatenformat' });
            }
            res.json(normalized);
        } catch (parseError) {
            console.error('Fehler beim Parsen der Turnierdaten:', parseError);
            res.status(500).json({ error: 'Fehler beim Parsen der Turnierdaten' });
        }
    });
});

app.post('/api/tournament', async (req, res) => {
    const normalized = normalizeTournamentData(req.body);
    if (!normalized) {
        return res.status(400).json({
            error: 'Es werden acht Teilnehmer, Rundenergebnisse und AMV-Einträge erwartet.',
        });
    }

    const newData = JSON.stringify(normalized, null, 2);
    const writeOperation = tournamentWriteQueue.then(async () => {
        await fs.promises.writeFile(TEMP_TOURNAMENT_DATA_FILE, newData, 'utf8');
        await fs.promises.rename(TEMP_TOURNAMENT_DATA_FILE, TOURNAMENT_DATA_FILE);
    });

    tournamentWriteQueue = writeOperation.catch(() => {});

    try {
        await writeOperation;
        res.json({ message: 'Turnierdaten erfolgreich gespeichert' });
    } catch (error) {
        console.error('Fehler beim Schreiben der Turnierdaten:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Turnierdaten' });
    }
});

function retryDelayFromHeaders(headers, fallbackMs = 60000) {
    const retryAfterValue = Array.isArray(headers?.['retry-after'])
        ? headers['retry-after'][0]
        : headers?.['retry-after'];
    const retryAfterSeconds = Number(retryAfterValue);

    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
        return Math.max(1000, retryAfterSeconds * 1000);
    }

    if (retryAfterValue) {
        const retryDate = Date.parse(retryAfterValue);
        if (Number.isFinite(retryDate)) {
            return Math.max(1000, retryDate - Date.now());
        }
    }

    const resetValue = Array.isArray(headers?.['x-ratelimit-reset'])
        ? headers['x-ratelimit-reset'][0]
        : headers?.['x-ratelimit-reset'];
    const resetTimestamp = Number(resetValue);
    if (Number.isFinite(resetTimestamp) && resetTimestamp > 0) {
        return Math.max(1000, resetTimestamp * 1000 - Date.now());
    }

    return fallbackMs;
}

function wait(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function requestBufferWithRateLimitRetry(url, options = {}) {
    for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
        try {
            return await requestBuffer(url, options);
        } catch (error) {
            if (error.statusCode !== 429 || attempt === MAX_RATE_LIMIT_RETRIES) {
                throw error;
            }

            console.warn(
                `Rate-Limit erreicht. Nächster Versuch in ${Math.ceil(error.retryAfterMs / 1000)} Sekunden.`
            );
            await wait(error.retryAfterMs);
        }
    }

    throw new Error('Anfrage konnte nach mehreren Versuchen nicht abgeschlossen werden');
}

function enqueueAniListRequest(task) {
    const queuedRequest = aniListRequestQueue.then(async () => {
        const waitTime = Math.max(
            0,
            lastAniListRequestAt + ANILIST_REQUEST_INTERVAL_MS - Date.now()
        );
        if (waitTime > 0) {
            await wait(waitTime);
        }

        lastAniListRequestAt = Date.now();
        return task();
    });

    aniListRequestQueue = queuedRequest.catch(() => {});
    return queuedRequest;
}

function enqueueImageRequest(task) {
    const queuedRequest = imageRequestQueue.then(async () => {
        const waitTime = Math.max(
            0,
            lastImageRequestAt + IMAGE_REQUEST_INTERVAL_MS - Date.now()
        );
        if (waitTime > 0) {
            await wait(waitTime);
        }

        lastImageRequestAt = Date.now();
        return task();
    });

    imageRequestQueue = queuedRequest.catch(() => {});
    return queuedRequest;
}

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
                const error = new Error(`HTTP ${response.statusCode}`);
                error.statusCode = response.statusCode;
                error.retryAfterMs = retryDelayFromHeaders(response.headers);
                response.resume();
                reject(error);
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
    const response = await enqueueAniListRequest(() => requestBufferWithRateLimitRetry(
        'https://graphql.anilist.co',
        {
            method: 'POST',
            accept: 'application/json',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
            },
            body,
            maxBytes: 1024 * 1024,
        }
    ));
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

    const response = await enqueueImageRequest(() => requestBufferWithRateLimitRetry(
        imageUrl,
        {
            accept: 'image/*',
            maxBytes: MAX_IMAGE_BYTES,
            timeout: 10000,
        }
    ));

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
    retryDelayFromHeaders,
    startServer,
};
