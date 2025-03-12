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

## Usage

1. **Adding Anime**
   - Type or paste one or multiple anime titles in the textarea
   - Each entry is separated by a line break
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

## Installation

1. **Download the latest release**
   - Download `anime-guessr.zip` from the Releases page
   - Extract to your preferred location
   - Run `start.bat` to launch the application

2. **Manual Setup (Development)**
```powershell
# Clone repository
git clone https://github.com/pic4arts/anime-guessr.git
cd anime-guessr

# Install dependencies
npm install

# Build executable
npm run build

# Start application
.\start.bat
```

## Project Structure

```plaintext
anime-guessr/
├── public/
│   ├── index.html          # Frontend interface
│   └── sounds/             # Audio feedback files
│       ├── Correct.wav
│       └── Wrong.mp3
├── server.js               # Node.js backend
├── start.js               # Server startup script
├── start.bat              # Windows startup batch file
├── package.json           # Project configuration
└── .gitignore             # Git ignore rules
```

## Development

### Prerequisites
- Node.js (v14 or higher)
- npm (Node Package Manager)

### Building the Executable

```powershell
# Install dependencies
npm install

# Build executable
npm run build
```

### Development Server

```powershell
# Start server in development mode
npm start
```

The application will be available at `http://localhost:3000`

## Data Storage

- All data is stored locally in `anime_data.json`
- Each AMV list is saved independently
- Data persists between sessions
- Automatic saving after modifications

## Troubleshooting

1. **Server won't start**
   - Check if port 3000 is available
   - Ensure Node.js is installed correctly
   - Check console for error messages

2. **Sound not working**
   - Verify sound files exist in `public/sounds/`
   - Check system audio settings
   - Try refreshing the page

3. **Changes not saving**
   - Check write permissions in application directory
   - Verify `anime_data.json` is not read-only
   - Check console for save errors

## License

MIT License - See LICENSE file for details

## Author

pic4arts
