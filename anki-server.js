const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Create uploads directory if it doesn't exist
const ensureUploadsDir = async () => {
  try {
    await fs.access('uploads');
  } catch {
    await fs.mkdir('uploads');
  }
};

// SM2 Algorithm implementation
class SM2 {
  constructor() {
    this.easiness = 2.5;
    this.interval = 1;
    this.repetitions = 0;
  }

  calculateNextReview(quality) {
    // quality: 0-5 (0 = complete blackout, 5 = perfect response)
    if (quality < 0 || quality > 5) {
      throw new Error('Quality must be between 0 and 5');
    }

    // Calculate new easiness factor
    this.easiness = Math.max(1.3, this.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

    // Calculate new interval
    if (quality >= 3) {
      if (this.repetitions === 0) {
        this.interval = 1;
      } else if (this.repetitions === 1) {
        this.interval = 6;
      } else {
        this.interval = Math.round(this.interval * this.easiness);
      }
      this.repetitions++;
    } else {
      this.repetitions = 0;
      this.interval = 1;
    }

    return {
      easiness: this.easiness,
      interval: this.interval,
      repetitions: this.repetitions,
      nextReview: new Date(Date.now() + this.interval * 24 * 60 * 60 * 1000)
    };
  }

  reset() {
    this.easiness = 2.5;
    this.interval = 1;
    this.repetitions = 0;
  }
}

// Data storage (in production, use a proper database)
let cards = [];
let decks = [];

// Initialize with sample data
const initializeData = () => {
  if (decks.length === 0) {
    decks.push({
      id: 'default',
      name: 'Default Deck',
      description: 'Your default study deck',
      createdAt: new Date().toISOString()
    });
  }
};

// Routes
app.get('/api/decks', (req, res) => {
  initializeData();
  res.json(decks);
});

app.post('/api/decks', (req, res) => {
  console.log('POST /api/decks received:', req.body);
  const { name, description } = req.body;
  const newDeck = {
    id: Date.now().toString(),
    name,
    description: description || '',
    createdAt: new Date().toISOString()
  };
  console.log('Creating new deck:', newDeck);
  decks.push(newDeck);
  console.log('Decks after creation:', decks);
  res.json(newDeck);
});

app.get('/api/cards', (req, res) => {
  const { deckId } = req.query;
  let filteredCards = cards;
  if (deckId) {
    filteredCards = cards.filter(card => card.deckId === deckId);
  }
  res.json(filteredCards);
});

app.post('/api/cards', (req, res) => {
  console.log('POST /api/cards received:', req.body);
  const { front, back, deckId, type, imagePath, occlusionData } = req.body;
  const newCard = {
    id: Date.now().toString(),
    front,
    back,
    deckId: deckId || 'default',
    type: type || 'basic',
    imagePath,
    occlusionData,
    bookmarked: false,
    sm2: new SM2(),
    createdAt: new Date().toISOString(),
    lastReviewed: null,
    nextReview: null
  };
  console.log('Creating new card:', newCard);
  cards.push(newCard);
  console.log('Cards after creation:', cards);
  res.json(newCard);
});

app.post('/api/cards/:id/review', (req, res) => {
  const { id } = req.params;
  const { quality } = req.body;
  
  const card = cards.find(c => c.id === id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const result = card.sm2.calculateNextReview(quality);
  card.lastReviewed = new Date().toISOString();
  card.nextReview = result.nextReview;

  res.json({
    card,
    sm2Result: result
  });
});

app.post('/api/cards/:id/reset', (req, res) => {
  const { id } = req.params;
  const card = cards.find(c => c.id === id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  card.sm2.reset();
  card.lastReviewed = null;
  card.nextReview = null;

  res.json(card);
});

app.get('/api/cards/due', (req, res) => {
  const now = new Date();
  const dueCards = cards.filter(card => {
    return !card.nextReview || new Date(card.nextReview) <= now;
  });
  res.json(dueCards);
});

// Image upload endpoint
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }
  
  const imagePath = `/uploads/${req.file.filename}`;
  res.json({ 
    success: true, 
    imagePath,
    filename: req.file.filename 
  });
});

// Update a card
app.put('/api/cards/:id', (req, res) => {
  const { id } = req.params;
  const card = cards.find(c => c.id === id);
  if (!card) {
    return res.status(404).json({ error: 'Card not found' });
  }

  const { front, back, deckId, bookmarked, imagePath, occlusionData, type } = req.body;
  if (typeof front !== 'undefined') card.front = front;
  if (typeof back !== 'undefined') card.back = back;
  if (typeof deckId !== 'undefined') card.deckId = deckId;
  if (typeof bookmarked !== 'undefined') card.bookmarked = !!bookmarked;
  if (typeof imagePath !== 'undefined') card.imagePath = imagePath;
  if (typeof occlusionData !== 'undefined') card.occlusionData = occlusionData;
  if (typeof type !== 'undefined') card.type = type;

  res.json(card);
});

// Delete a card
app.delete('/api/cards/:id', (req, res) => {
  const { id } = req.params;
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Card not found' });
  }
  const [removed] = cards.splice(index, 1);
  res.json({ success: true, removed });
});

// Bulk delete
app.post('/api/cards/bulk-delete', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }
  const before = cards.length;
  cards = cards.filter(c => !ids.includes(c.id));
  const deleted = before - cards.length;
  res.json({ success: true, deleted });
});

// Bulk move to another deck
app.post('/api/cards/bulk-move', (req, res) => {
  const { ids, deckId } = req.body;
  if (!Array.isArray(ids) || !deckId) {
    return res.status(400).json({ error: 'ids array and deckId are required' });
  }
  let updated = 0;
  cards.forEach(c => {
    if (ids.includes(c.id)) {
      c.deckId = deckId;
      updated++;
    }
  });
  res.json({ success: true, updated });
});

// Get statistics
app.get('/api/stats', (req, res) => {
  const totalCards = cards.length;
  const reviewedCards = cards.filter(card => card.lastReviewed).length;
  const dueCards = cards.filter(card => {
    return !card.nextReview || new Date(card.nextReview) <= new Date();
  }).length;

  const stats = {
    totalCards,
    reviewedCards,
    dueCards,
    completionRate: totalCards > 0 ? (reviewedCards / totalCards) * 100 : 0
  };

  res.json(stats);
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'anki.html'));
});

// Start server
const startServer = async () => {
  await ensureUploadsDir();
  app.listen(PORT, () => {
    console.log(`Anki server running on http://localhost:${PORT}`);
    console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
  });
};

startServer().catch(console.error); 