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

2. Set up a local server

## Server Setup

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Install Node.js and npm
1. Download Node.js
   - Visit [Node.js website](https://nodejs.org/)
   - Download the LTS (Long Term Support) version for Windows
   - Run the installer (make sure "Add to PATH" is checked)

2. Verify Installation
   ```powershell
   # Open PowerShell and run:
   node --version
   npm --version
   ```
   You should see version numbers like `v18.17.0` and `9.6.7`

### Project Setup
1. Create Project Structure
   ```powershell
   # Create project directory
   cd D:\dev
   mkdir anime-guessr
   cd anime-guessr

   # Initialize npm project
   npm init -y

   # Install dependencies
   npm install express fs path
   ```

2. Create Required Files
   ```powershell
   # Create server file
   New-Item -Path "server.js" -ItemType "file"

   # Create data directory
   mkdir data
   ```

3. Server Configuration (server.js)
   ```javascript
   // filepath: /D:/dev/anime-guessr/server.js
   const express = require('express');
   const fs = require('fs');
   const path = require('path');
   const app = express();
   const PORT = 3000;
   const DATA_FILE = path.join(__dirname, 'anime_data.json');

   // Middleware
   app.use(express.static(__dirname));
   app.use(express.json({ limit: '1mb' }));

   // Initialize data file if it doesn't exist
   if (!fs.existsSync(DATA_FILE)) {
       const initialData = Array.from({ length: 7 }, () => []);
       fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
       console.log('Data file initialized');
   }

   // API endpoints
   app.get('/api/anime', (req, res) => {
       fs.readFile(DATA_FILE, 'utf8', (err, data) => {
           if (err) {
               console.error('Error reading file:', err);
               return res.status(500).json({ error: 'Error loading data' });
           }
           try {
               res.json(JSON.parse(data));
           } catch (parseError) {
               console.error('Error parsing JSON:', parseError);
               res.status(500).json({ error: 'Error parsing data' });
           }
       });
   });

   app.post('/api/anime', (req, res) => {
       if (!req.body || !Array.isArray(req.body) || req.body.length !== 7) {
           return res.status(400).json({ error: 'Invalid data format' });
       }
       
       const newData = JSON.stringify(req.body, null, 2);
       fs.writeFile(DATA_FILE, newData, 'utf8', (err) => {
           if (err) {
               console.error('Error writing file:', err);
               return res.status(500).json({ error: 'Error saving data' });
           }
           res.json({ message: 'Data saved successfully' });
       });
   });

   // Start server
   app.listen(PORT, () => {
       console.log(`Server running at http://localhost:${PORT}`);
       console.log(`Data is stored in ${DATA_FILE}`);
   });
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

The server stores all data in `anime_data.json`. This file:
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
- 
## Project Structure

```plaintext
anime-guessr/
├── public/
│   ├── index.html      # Frontend interface
│   └── sounds/         # Audio feedback
│       ├── Correct.wav
│       └── Wrong.mp3
├── server.js           # Node.js backend
├── anime_data.json     # Data storage
└── package.json        # Project configuration
```

## Technology Stack

- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Node.js, Express
- **Storage**: Local JSON file system
- **Dependencies**: express, fs, path

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
