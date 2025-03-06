const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'anime_data.json');

// Middleware - muss vor den Routes stehen
app.use(express.static(__dirname));
app.use(express.json({ limit: '1mb' }));  // Größeres Limit für große JSON-Objekte

// Überprüfen, ob die Datei existiert
if (!fs.existsSync(DATA_FILE)) {
    const initialData = Array.from({ length: 7 }, () => []);
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
    console.log('Datei wurde initialisiert');
}

// Anime-Daten laden
app.get('/api/anime', (req, res) => {
    fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
            console.error('Fehler beim Lesen der Datei:', err);
            return res.status(500).json({ error: 'Fehler beim Laden der Daten' });
        }
        try {
            res.json(JSON.parse(data));
        } catch (parseError) {
            console.error('Fehler beim Parsen der JSON-Datei:', parseError);
            res.status(500).json({ error: 'Fehler beim Parsen der Daten' });
        }
    });
});

// Anime-Daten speichern
app.post('/api/anime', (req, res) => {
    console.log('Erhaltene Daten:', req.body);
    
    if (!req.body) {
        console.error('Keine Daten erhalten');
        return res.status(400).json({ error: 'Keine Daten erhalten' });
    }
    
    // Optional: Überprüfen, ob die Daten im erwarteten Format sind
    if (!Array.isArray(req.body) || req.body.length !== 7) {
        console.error('Ungültiges Datenformat:', req.body);
        return res.status(400).json({ error: 'Ungültiges Datenformat. Ein Array mit 7 Elementen wird erwartet.' });
    }
    
    const newData = JSON.stringify(req.body, null, 2);
    fs.writeFile(DATA_FILE, newData, 'utf8', (err) => {
        if (err) {
            console.error('Fehler beim Schreiben der Datei:', err);
            return res.status(500).json({ error: 'Fehler beim Speichern der Daten' });
        }
        res.json({ message: 'Daten erfolgreich gespeichert' });
    });
});

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft auf http://localhost:${PORT}`);
    console.log(`Daten werden in ${DATA_FILE} gespeichert`);
});
