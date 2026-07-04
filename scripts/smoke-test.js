const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'anime-guessr-test-'));
process.env.ANIME_DATA_FILE = path.join(temporaryDirectory, 'anime_data.json');
process.env.ANIME_IMAGE_DIR = path.join(temporaryDirectory, 'images');
fs.writeFileSync(
    process.env.ANIME_DATA_FILE,
    JSON.stringify(Array.from({ length: 7 }, () => [])),
    'utf8'
);

const { app } = require('../server');

function request(port, pathname, options = {}) {
    return new Promise((resolve, reject) => {
        const body = options.body ? JSON.stringify(options.body) : null;
        const requestOptions = {
            hostname: '127.0.0.1',
            port,
            path: pathname,
            method: options.method || 'GET',
            headers: body
                ? {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                }
                : {},
        };
        const clientRequest = http.request(requestOptions, response => {
            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => {
                const text = Buffer.concat(chunks).toString('utf8');
                let parsed = null;
                try {
                    parsed = JSON.parse(text);
                } catch (error) {
                    parsed = text;
                }
                resolve({
                    status: response.statusCode,
                    body: parsed,
                });
            });
        });

        clientRequest.on('error', reject);
        if (body) {
            clientRequest.write(body);
        }
        clientRequest.end();
    });
}

async function main() {
    const testServer = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
        testServer.once('listening', resolve);
        testServer.once('error', reject);
    });
    const port = testServer.address().port;

    try {
        const status = await request(port, '/api/catalog/status');
        assert.strictEqual(status.status, 200);
        assert.ok(status.body.count > 40000, 'Der Offline-Katalog ist unvollständig');

        const migrated = await request(port, '/api/anime');
        assert.strictEqual(migrated.body.length, 8, 'Sieben bestehende Listen wurden nicht migriert');

        const german = await request(port, '/api/catalog/search?q=Apothekerin&limit=1');
        assert.strictEqual(german.status, 200);
        assert.ok(german.body[0].titles.german, 'Deutscher Titel fehlt');

        const english = await request(port, '/api/catalog/search?q=Death%20Note&limit=1');
        assert.strictEqual(english.body[0].titles.english, 'Death Note');

        const japanese = await request(
            port,
            '/api/catalog/search?q=%E8%91%AC%E9%80%81%E3%81%AE%E3%83%95%E3%83%AA%E3%83%BC%E3%83%AC%E3%83%B3&limit=1'
        );
        assert.ok(
            /[\u3040-\u30ff]/u.test(japanese.body[0].titles.native),
            'Japanischer Originaltitel fehlt'
        );

        const lists = [
            [{
                catalogId: english.body[0].id,
                name: 'Death Note',
                titles: english.body[0].titles,
                selected: false,
            }],
            [],
            [],
            [],
            [],
            [],
            [],
            [],
        ];
        const saved = await request(port, '/api/anime', {
            method: 'POST',
            body: lists,
        });
        assert.strictEqual(saved.status, 200);

        const loaded = await request(port, '/api/anime');
        assert.strictEqual(loaded.body[0][0].name, 'Death Note');

        const page = await request(port, '/');
        assert.strictEqual(page.status, 200);
        assert.ok(page.body.includes('Anime hinzufügen'));
        assert.ok(page.body.includes('catalogSearch'));

        console.log('Smoke-Test erfolgreich: Katalogsuche, Sprachen, Persistenz und Frontend.');
    } finally {
        await new Promise(resolve => testServer.close(resolve));
        const resolvedTemp = path.resolve(temporaryDirectory);
        const resolvedSystemTemp = path.resolve(os.tmpdir());
        if (!resolvedTemp.startsWith(`${resolvedSystemTemp}${path.sep}`)) {
            throw new Error(`Unsicheres temporäres Verzeichnis: ${resolvedTemp}`);
        }
        fs.rmSync(resolvedTemp, { recursive: true, force: true });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
