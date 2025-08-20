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
      createdAt: new Date().toISOString(),
      options: {
        newCardsPerDay: 20,
        maxReviewsPerDay: 200,
        newOrder: 'added', // 'added' | 'random'
        learningStepsMinutes: [25, 1440],
        graduatingIntervalDays: 3,
        easyIntervalDays: 4,
        startingEasePercent: 250,
        easyBonusPercent: 150,
        hardIntervalPercent: 120,
        intervalModifierPercent: 100,
        maximumIntervalDays: 36500,
        buryRelatedReviews: true,
        lapseStepsMinutes: [1440],
        newIntervalPercent: 20,
        minimumIntervalDays: 1,
        leechThreshold: 4
      }
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
    createdAt: new Date().toISOString(),
    options: {
      newCardsPerDay: 20,
      maxReviewsPerDay: 200,
      newOrder: 'added',
      learningStepsMinutes: [25, 1440],
      graduatingIntervalDays: 3,
      easyIntervalDays: 4,
      startingEasePercent: 250,
      easyBonusPercent: 150,
      hardIntervalPercent: 120,
      intervalModifierPercent: 100,
      maximumIntervalDays: 36500,
      buryRelatedReviews: true,
      lapseStepsMinutes: [1440],
      newIntervalPercent: 20,
      minimumIntervalDays: 1,
      leechThreshold: 4
    }
  };
  console.log('Creating new deck:', newDeck);
  decks.push(newDeck);
  console.log('Decks after creation:', decks);
  res.json(newDeck);
});

// Update a deck (name/description/options)
app.put('/api/decks/:id', (req, res) => {
  const { id } = req.params;
  const deck = decks.find(d => d.id === id);
  if (!deck) {
    return res.status(404).json({ error: 'Deck not found' });
  }
  const { name, description, options } = req.body;
  if (typeof name !== 'undefined') deck.name = name;
  if (typeof description !== 'undefined') deck.description = description;
  if (typeof options !== 'undefined' && options && typeof options === 'object') {
    deck.options = {
      ...deck.options,
      ...options
    };
  }
  res.json(deck);
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
  const deckForCard = decks.find(d => d.id === (deckId || 'default'));
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
    nextReview: null,
    learningStepIndex: 0
  };
  // Apply deck starting ease if available
  try {
    const startingEasePercent = deckForCard && deckForCard.options && deckForCard.options.startingEasePercent;
    if (startingEasePercent) {
      newCard.sm2.easiness = Math.max(1.3, (startingEasePercent / 100));
    }
  } catch {}
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

  const deck = decks.find(d => d.id === card.deckId);
  const opts = deck && deck.options ? deck.options : null;
  const steps = (opts && Array.isArray(opts.learningStepsMinutes) && opts.learningStepsMinutes.length > 0)
    ? opts.learningStepsMinutes
    : [];

  // Learning steps handling for brand new cards before SM2 graduation
  if (card.sm2.repetitions === 0 && steps.length > 0) {
    const now = Date.now();
    const currentStepIndex = Number.isInteger(card.learningStepIndex) ? card.learningStepIndex : 0;
    if (quality === 0) {
      // Again -> first step
      const minutes = steps[0];
      card.learningStepIndex = 0;
      card.lastReviewed = new Date().toISOString();
      card.nextReview = new Date(now + minutes * 60 * 1000);
      return res.json({ card, sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: (minutes / 1440) } });
    }
    if (quality === 1) {
      // Hard -> halfway to next step (e.g., 12h if next step is 1 day)
      if (currentStepIndex < steps.length - 1) {
        const nextIndex = currentStepIndex + 1;
        const halfToNext = Math.round(steps[nextIndex] / 2);
        const minutes = Math.max(steps[currentStepIndex], halfToNext);
        // Don't advance step index on hard; keep practicing current block
        card.learningStepIndex = currentStepIndex;
        card.lastReviewed = new Date().toISOString();
        card.nextReview = new Date(now + minutes * 60 * 1000);
        return res.json({ card, sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: (minutes / 1440) } });
      } else {
        // No next step: repeat current step with hard interval percent if available, else same step
        const baseMin = steps[currentStepIndex];
        const hardPct = opts && typeof opts.hardIntervalPercent === 'number' ? opts.hardIntervalPercent : 120;
        const minutes = Math.max(baseMin, Math.round(baseMin * (hardPct / 100)));
        card.learningStepIndex = currentStepIndex;
        card.lastReviewed = new Date().toISOString();
        card.nextReview = new Date(now + minutes * 60 * 1000);
        return res.json({ card, sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: (minutes / 1440) } });
      }
    }
    if (quality === 3) {
      // Good -> next step if available; else graduate to graduating interval
      if (currentStepIndex < steps.length - 1) {
        const nextIndex = currentStepIndex + 1;
        const minutes = steps[nextIndex];
        card.learningStepIndex = nextIndex;
        card.lastReviewed = new Date().toISOString();
        card.nextReview = new Date(now + minutes * 60 * 1000);
        return res.json({ card, sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: (minutes / 1440) } });
      } else {
        const gradDays = (opts && typeof opts.graduatingIntervalDays === 'number') ? Math.max(1, Math.round(opts.graduatingIntervalDays)) : 3;
        card.learningStepIndex = null;
        card.sm2.repetitions = 1; // graduate
        card.sm2.interval = gradDays;
        card.lastReviewed = new Date().toISOString();
        card.nextReview = new Date(now + gradDays * 24 * 60 * 60 * 1000);
        return res.json({ card, sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: gradDays } });
      }
    }
    if (quality === 5) {
      // Easy -> graduate immediately to easy interval
      const easyDays = (opts && typeof opts.easyIntervalDays === 'number') ? Math.max(1, Math.round(opts.easyIntervalDays)) : 4;
      card.learningStepIndex = null;
      card.sm2.repetitions = 1;
      card.sm2.interval = easyDays;
      card.lastReviewed = new Date().toISOString();
      card.nextReview = new Date(now + easyDays * 24 * 60 * 60 * 1000);
      return res.json({ card, sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: easyDays } });
    }
    // For any other quality, fall through to SM2
  }

  // Handle lapses for mature cards: send to lapse steps when quality < 3
  const lapseSteps = (opts && Array.isArray(opts.lapseStepsMinutes) && opts.lapseStepsMinutes.length > 0)
    ? opts.lapseStepsMinutes
    : [];
  if (quality < 3 && card.sm2.repetitions > 0 && lapseSteps.length > 0) {
    const now = Date.now();
    const minutes = lapseSteps[0];
    // Optional: leech handling by counting lapses
    card.lapses = (card.lapses || 0) + 1;
    if (opts && typeof opts.leechThreshold === 'number' && card.lapses >= opts.leechThreshold) {
      // For simplicity, bookmark as a proxy for flagging leech
      card.bookmarked = true;
    }
    card.learningStepIndex = 0; // enter lapse learning
    card.sm2.repetitions = 0;   // reset reps to re-graduate
    // Reduce interval by new interval percent
    if (typeof opts.newIntervalPercent === 'number') {
      const reduced = Math.max(1, Math.round(card.sm2.interval * (opts.newIntervalPercent / 100)));
      card.sm2.interval = reduced;
    }
    // Minimum interval clamp (applies after coming back from lapse graduation)
    if (typeof opts.minimumIntervalDays === 'number') {
      card.sm2.interval = Math.max(card.sm2.interval, Math.round(opts.minimumIntervalDays));
    }
    card.lastReviewed = new Date().toISOString();
    card.nextReview = new Date(now + minutes * 60 * 1000);
    return res.json({
      card,
      sm2Result: { ...card.sm2, nextReview: card.nextReview, interval: (minutes / 1440) }
    });
  }

  const preRepetitions = card.sm2.repetitions;
  const result = card.sm2.calculateNextReview(quality);

  // On graduation from learning, clear step tracking
  if (card.sm2.repetitions > 0) {
    card.learningStepIndex = null;
  }

  // Apply deck-specific modifiers
  try {
    // First successful review intervals for new cards
    const isFirstSuccess = quality >= 3 && preRepetitions === 0;
    if (opts && isFirstSuccess) {
      if (quality >= 5 && typeof opts.easyIntervalDays === 'number') {
        result.interval = Math.max(1, Math.round(opts.easyIntervalDays));
      } else if (quality >= 3 && typeof opts.graduatingIntervalDays === 'number') {
        result.interval = Math.max(1, Math.round(opts.graduatingIntervalDays));
      }
    }

    // Apply easy/hard bonuses to interval after SM2 calc
    if (opts) {
      if (quality >= 5 && typeof opts.easyBonusPercent === 'number') {
        result.interval = Math.round(result.interval * (opts.easyBonusPercent / 100));
      }
      if (quality === 1 && typeof opts.hardIntervalPercent === 'number') {
        result.interval = Math.max(1, Math.round(result.interval * (opts.hardIntervalPercent / 100)));
      }
      if (typeof opts.intervalModifierPercent === 'number') {
        result.interval = Math.max(1, Math.round(result.interval * (opts.intervalModifierPercent / 100)));
      }
      if (typeof opts.maximumIntervalDays === 'number') {
        result.interval = Math.min(result.interval, Math.round(opts.maximumIntervalDays));
      }
    }

    result.nextReview = new Date(Date.now() + result.interval * 24 * 60 * 60 * 1000);
    // Keep SM2 state consistent
    card.sm2.interval = result.interval;
  } catch {}
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