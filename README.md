# Anime Guessr

A Node.js web application for managing and tracking anime titles in AMV (Anime Music Video) lists. Built for quiz games and AMV guessing challenges, featuring local data persistence and real-time search.

## Features

- 🎬 7 separate AMV lists for organizing content
- 🔍 Real-time search functionality
- ✅ Track completed/selected entries
- 🔊 Sound feedback for actions
- 💾 Local data persistence
- ⌨️ Keyboard shortcuts for quick actions

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
