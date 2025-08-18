# 🧠 Anki Clone - Spaced Repetition Learning App

A modern, web-based Anki clone that implements the SM2 (SuperMemo 2) spaced repetition algorithm with support for image occlusion cards.

## ✨ Features

- **SM2 Algorithm**: Implements the proven SuperMemo 2 spaced repetition algorithm
- **Image Occlusion Cards**: Create cards with hidden parts of images for effective learning
- **Deck Management**: Organize cards into multiple study decks
- **Intelligent Scheduling**: Cards are automatically scheduled based on your performance
- **Progress Tracking**: Monitor your learning progress with detailed statistics
- **Modern UI**: Beautiful, responsive interface built with modern web technologies

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone or download the project**
2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```

4. **Open your browser** and go to: `http://localhost:3001`

## 📚 How to Use

### Creating Decks
1. Click "Add Deck" in the sidebar
2. Enter a name and optional description
3. Click "Create Deck"

### Adding Cards
1. Click "Add Card" in the main area
2. Select a deck and card type
3. Fill in the front and back content
4. For image occlusion cards, upload an image
5. Click "Create Card"

### Studying
1. Select a deck from the sidebar
2. Click "Start Study Session"
3. Review cards and rate your performance:
   - **Again (0)**: Complete blackout
   - **Hard (1)**: Difficult to remember
   - **Good (3)**: Correctly remembered
   - **Easy (5)**: Perfect response

## 🔧 Technical Details

### Server
- **Framework**: Express.js
- **Port**: 3001
- **File Upload**: Multer for image handling
- **CORS**: Enabled for cross-origin requests

### SM2 Algorithm
The SuperMemo 2 algorithm calculates optimal intervals between reviews:
- **Easiness Factor**: Adjusts based on performance
- **Interval**: Time until next review
- **Repetitions**: Number of successful reviews

### Card Types
- **Basic**: Standard front/back flashcards
- **Image Occlusion**: Cards with hidden image parts

## 📁 Project Structure

```
anki-clone/
├── anki-server.js          # Main server file
├── package.json            # Dependencies and scripts
├── public/                 # Client-side files
│   ├── anki.html          # Main application page
│   └── js/
│       └── anki-app.js    # Client-side JavaScript
├── uploads/                # Image uploads (auto-created)
└── node_modules/           # Dependencies
```

## 🎯 API Endpoints

- `GET /api/decks` - Get all decks
- `POST /api/decks` - Create new deck
- `GET /api/cards` - Get cards (optionally filtered by deck)
- `POST /api/cards` - Create new card
- `POST /api/cards/:id/review` - Rate a card (0-5)
- `GET /api/cards/due` - Get cards due for review
- `POST /api/upload-image` - Upload image for occlusion cards
- `GET /api/stats` - Get learning statistics

## 🚀 Development

To run in development mode with auto-restart:
```bash
npm run dev
```

## 📝 License

MIT License - feel free to use and modify as needed!

## 🤝 Contributing

This is a learning project, but suggestions and improvements are welcome!

---

**Happy Learning! 🎓** 