# SpanishVideoMaster

A B2-level Spanish learning application for Vietnamese learners using YouTube videos with real-time synchronized subtitles and translations.

## Features

- 🎥 **YouTube Video Integration** - Learn Spanish through authentic video content
- 📝 **Real-time Synchronized Captions** - Karaoke-style subtitles that highlight in sync with video playback
- 🌐 **Multi-language Support** - Spanish, Vietnamese, and English subtitles
- 📚 **Interactive Word Dictionary** - Click any word for instant translation and verb conjugation
- ✅ **B2-level DELE Listening Tests** - Practice with DELE-style comprehension questions
- 📊 **Progress Tracking** - Monitor your learning progress and error analysis
- 🔄 **Automatic Transcript Fetching** - Supports both manual and auto-generated YouTube captions
- 🌍 **Unlimited Translation** - Powered by Google Translate API

## Tech Stack

### Frontend
- React 18+
- Vite
- Tailwind CSS
- React Player

### Backend
- Express.js
- Node.js
- YouTube Caption Extractor
- Google Translate API

## Prerequisites

- Node.js 18.16.0 or higher
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd "AI code"
```

2. Install dependencies:
```bash
npm install
```

## Running the Application

### Start the Backend Server

```bash
node server.js
```

Server runs on `http://localhost:3002`

### Start the Frontend Development Server

```bash
npm run dev
```

Frontend runs on `http://localhost:3000`

## API Endpoints

### GET `/api/health`
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "message": "Server is running"
}
```

### GET `/api/transcript/:videoId`
Fetch YouTube video transcript

**Parameters:**
- `videoId` - YouTube video ID
- `lang` (optional) - Language code (default: 'es')

**Response:**
```json
{
  "transcript": [
    {
      "text": "Hola mundo",
      "start": 0,
      "duration": 2.5
    }
  ],
  "method": "es",
  "count": 100
}
```

### POST `/api/translate`
Translate text from Spanish to Vietnamese

**Request Body:**
```json
{
  "text": "Hola mundo"
}
```

**Response:**
```json
{
  "translation": "Xin chào thế giới"
}
```

## Project Structure

```
.
├── src/
│   ├── App.jsx           # Main React component
│   ├── main.jsx          # React entry point
│   └── index.css         # Tailwind CSS
├── server.js             # Express backend server
├── index.html            # HTML template
├── vite.config.js        # Vite configuration
├── tailwind.config.js    # Tailwind CSS configuration
├── postcss.config.js     # PostCSS configuration
└── package.json          # Project dependencies
```

## Features in Detail

### Real-time Caption Synchronization
- Captions automatically highlight as the video plays
- Click any caption to jump to that timestamp
- Smooth scrolling keeps active caption in view

### Translation System
- Primary: Google Translate API (unlimited, free)
- Fallback: MyMemory API (rate-limited)
- Automatic fallback handling

### Transcript Fetching
- Primary: youtube-caption-extractor (supports auto-generated)
- Fallback: youtube-transcript library
- Multiple language support with automatic fallback to Spanish

## Development

### Debug Scripts

- `debug-captions.mjs` - Debug YouTube caption URL structures
- `test-video.mjs` - Test transcript fetching
- `test-api.mjs` - Test API endpoints
- `test-transcript.mjs` - Test transcript parsing

### Running Debug Scripts

```bash
node debug-captions.mjs
node test-video.mjs
```

## Known Issues

- Some Node packages recommend Node.js >= 20.18.1 (currently using 18.16.0)
- MyMemory API has daily rate limits (13 hours cooldown after limit)

## Future Enhancements

- Verb conjugation tables
- Vocabulary tracking and flashcards
- Speaking practice with speech recognition
- Downloadable lesson materials
- User authentication and profile management

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
