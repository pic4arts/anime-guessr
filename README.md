# Anime Guessr

A web-based application for managing and tracking anime titles across multiple AMV (Anime Music Video) lists. Perfect for anime quiz games or AMV guessing challenges.

## Features

- 📝 Manage 7 different AMV lists
- 🔍 Search functionality with real-time filtering
- ✅ Mark entries as selected/completed
- ➕ Add multiple anime titles at once
- 📝 Edit existing entries
- 🗑️ Delete entries
- 🔊 Sound feedback for actions
- 💾 Automatic data saving
- 🎯 Quick marking of search results

## Setup

1. Clone the repository:
```bash
git clone https://github.com/pic4arts/anime-guessr.git
cd anime-guessr
```

2. Create a local copy of the required sound files:
- `Correct.wav` - Sound for correct selections
- `Wrong.mp3` - Sound for wrong answers

3. Set up a local server

## Server Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Installation

1. **Install Dependencies**
```bash
npm init -y
npm install express cors
```

2. **Create Server File**
```javascript
// filepath: /D:/dev/anime-guessr/server.js
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const dataPath = path.join(__dirname, 'public', 'data.json');

// API Endpoints
app.get('/api/anime', async (req, res) => {
    try {
        const exists = await fs.access(dataPath).then(() => true).catch(() => false);
        if (!exists) {
            const defaultData = Array.from({ length: 7 }, () => []);
            await fs.writeFile(dataPath, JSON.stringify(defaultData));
            return res.json(defaultData);
        }
        
        const data = await fs.readFile(dataPath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Fehler beim Laden:', error);
        res.status(500).send('Fehler beim Laden der Daten');
    }
});

app.post('/api/anime', async (req, res) => {
    try {
        const data = req.body;
        if (!Array.isArray(data) || data.length !== 7) {
            return res.status(400).send('Ungültiges Datenformat');
        }
        
        await fs.writeFile(dataPath, JSON.stringify(data));
        res.json({ success: true });
    } catch (error) {
        console.error('Fehler beim Speichern:', error);
        res.status(500).send('Fehler beim Speichern der Daten');
    }
});

app.listen(port, () => {
    console.log(`Server läuft auf http://localhost:${port}`);
});
```

3. **Project Structure**
```
anime-guessr/
├── public/
│   ├── index.html
│   ├── sounds/
│   │   ├── Correct.wav
│   │   └── Wrong.mp3
│   └── data.json (will be created automatically)
├── server.js
├── package.json
└── README.md
```

4. **Update package.json**
```json
{
  "name": "anime-guessr",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.17.1",
    "cors": "^2.8.5"
  }
}
```

### Running the Server

1. **Start the Server**
```bash
node server.js
```
Or using npm:
```bash
npm start
```

2. **Access the Application**
- Open `http://localhost:3000` in your browser
- The API endpoints will be available at:
  - GET `http://localhost:3000/api/anime`
  - POST `http://localhost:3000/api/anime`

### Troubleshooting

- If port 3000 is already in use, change the port number in `server.js`
- Make sure all files are in the correct directory structure
- Check the console for any error messages
- Ensure all dependencies are installed (`npm install`)

### Data Persistence

The server stores all data in `public/data.json`. This file:
- Is created automatically if it doesn't exist
- Persists between server restarts
- Can be backed up by copying the file
- Should not be edited manually while the server is running

## Usage

1. **Adding Anime**
   - Type or paste one or multiple anime titles in the textarea
   - Press "Hinzufügen" or Enter to add them

2. **Managing Entries**
   - Click an entry to mark it as selected
   - Use the edit button (✏️) to modify an entry
   - Use the delete button (🗑️) to remove an entry

3. **Searching**
   - Type in the search box to filter entries
   - Press Enter while searching to mark all filtered entries

4. **Saving Data**
   - Click "Daten speichern" to manually save changes
   - Changes are also saved automatically after modifications

## API Endpoints

The application expects the following API endpoints:

- `GET /api/anime` - Retrieve saved anime lists
- `POST /api/anime` - Save updated anime lists

## Development

### Technologies Used
- HTML5
- CSS3
- JavaScript (ES6+)
- Font Awesome icons
- Web Audio API

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
