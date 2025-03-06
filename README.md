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

3. Set up a local server (e.g., using Python):
```bash
python -m http.server 8000
```

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

### Project Structure
```
anime-guessr/
├── index.html     # Main application file
├── Correct.wav    # Sound for correct selections
├── Wrong.mp3      # Sound for wrong answers
└── README.md      # This file
```

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
