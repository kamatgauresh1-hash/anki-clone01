// Anki Clone Application
class AnkiApp {
    constructor() {
        this.currentDeck = null;
        this.cards = [];
        this.decks = [];
        this.currentCardIndex = 0;
        this.isStudying = false;
        this.uploadedImagePath = null;
        this.cardBrowserActive = false;
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.selectedCardId = null;
        this.selectionMode = false;
        this.selectedCardIds = new Set();
        
        this.init();
    }

    async init() {
        await this.loadDecks();
        await this.loadCards();
        this.setupEventListeners();
        this.updateStats();
        this.showWelcomeView();
    }

    setupEventListeners() {
        // Add deck form
        document.getElementById('addDeckForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addDeck();
        });

        // Add card form
        document.getElementById('addCardForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addCard();
        });

        // Image upload handling
        this.setupImageUpload();

        // Close browser menu on outside click
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('browserDropdown');
            const isKebab = e.target && (e.target.classList && e.target.classList.contains('kebab-btn'));
            if (menu && menu.classList.contains('active') && !menu.contains(e.target) && !isKebab) {
                menu.classList.remove('active');
            }
        });
    }

    setupImageUpload() {
        const uploadArea = document.getElementById('imageUploadArea');
        const fileInput = document.getElementById('cardImage');

        // Click to browse
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleImageUpload(e.target.files[0]);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                this.handleImageUpload(e.dataTransfer.files[0]);
            }
        });

        // Setup occlusion canvas
        this.setupOcclusionCanvas();
    }

    setupOcclusionCanvas() {
        this.occlusions = [];
        this.isDrawing = false;
        this.isMoving = false;
        this.startX = 0;
        this.startY = 0;
        this.selectedOcclusion = null;
        this.moveOffsetX = 0;
        this.moveOffsetY = 0;
        
        const canvas = document.getElementById('occlusionCanvas');
        const ctx = canvas.getContext('2d');
        
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Check if clicking on existing occlusion
            this.selectedOcclusion = this.getOcclusionAt(mouseX, mouseY);
            
            if (this.selectedOcclusion) {
                // Start moving occlusion
                this.isMoving = true;
                this.moveOffsetX = mouseX - this.selectedOcclusion.x;
                this.moveOffsetY = mouseY - this.selectedOcclusion.y;
            } else {
                // Start drawing new occlusion
                this.isDrawing = true;
                this.startX = mouseX;
                this.startY = mouseY;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            const currentX = e.clientX - rect.left;
            const currentY = e.clientY - rect.top;
            
            if (this.isMoving && this.selectedOcclusion) {
                // Move occlusion
                this.selectedOcclusion.x = currentX - this.moveOffsetX;
                this.selectedOcclusion.y = currentY - this.moveOffsetY;
                this.redrawCanvas();
            } else if (this.isDrawing) {
                // Redraw canvas with existing occlusions
                this.redrawCanvas();
                
                // Draw current rectangle being created
                ctx.strokeStyle = '#ff0000';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.strokeRect(
                    this.startX,
                    this.startY,
                    currentX - this.startX,
                    currentY - this.startY
                );
            }
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (this.isDrawing) {
                this.isDrawing = false;
                const rect = canvas.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;
                
                // Add occlusion rectangle
                const occlusion = {
                    x: Math.min(this.startX, endX),
                    y: Math.min(this.startY, endY),
                    width: Math.abs(endX - this.startX),
                    height: Math.abs(endY - this.startY)
                };
                
                if (occlusion.width > 10 && occlusion.height > 10) {
                    this.occlusions.push(occlusion);
                    this.redrawCanvas();
                }
            }
            
            if (this.isMoving) {
                this.isMoving = false;
                this.selectedOcclusion = null;
            }
        });
        
        // Double click to remove occlusion
        canvas.addEventListener('dblclick', (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const occlusionToRemove = this.getOcclusionAt(mouseX, mouseY);
            if (occlusionToRemove) {
                const index = this.occlusions.indexOf(occlusionToRemove);
                if (index > -1) {
                    this.occlusions.splice(index, 1);
                    this.redrawCanvas();
                }
            }
        });
    }

    getOcclusionAt(x, y) {
        return this.occlusions.find(occlusion => 
            x >= occlusion.x && 
            x <= occlusion.x + occlusion.width &&
            y >= occlusion.y && 
            y <= occlusion.y + occlusion.height
        );
    }

    redrawCanvas() {
        const canvas = document.getElementById('occlusionCanvas');
        const ctx = canvas.getContext('2d');
        const img = document.getElementById('imagePreview');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw image
        if (img.complete) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
        
        // Draw all occlusions
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.occlusions.forEach((occlusion, index) => {
            ctx.fillRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
            
            // Add number label on occlusion
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                (index + 1).toString(), 
                occlusion.x + occlusion.width / 2, 
                occlusion.y + occlusion.height / 2 + 6
            );
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        });
    }

    clearOcclusions() {
        this.occlusions = [];
        this.redrawCanvas();
    }

    undoLastOcclusion() {
        if (this.occlusions.length > 0) {
            this.occlusions.pop();
            this.redrawCanvas();
        }
    }

    async handleImageUpload(file) {
        const formData = new FormData();
        formData.append('image', file);

        try {
            const response = await fetch('/api/upload-image', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                this.uploadedImagePath = result.imagePath;
                
                // Show preview
                const preview = document.getElementById('imagePreview');
                preview.src = result.imagePath;
                preview.classList.remove('hidden');
                
                // Setup canvas for occlusion
                preview.onload = () => {
                    const canvas = document.getElementById('occlusionCanvas');
                    const container = document.getElementById('occlusionCanvasContainer');
                    
                    // Set canvas size to match image
                    canvas.width = preview.naturalWidth;
                    canvas.height = preview.naturalHeight;
                    
                    // Scale canvas to fit in modal (max 400px width)
                    const maxWidth = 400;
                    const scale = Math.min(maxWidth / preview.naturalWidth, 1);
                    canvas.style.width = (preview.naturalWidth * scale) + 'px';
                    canvas.style.height = (preview.naturalHeight * scale) + 'px';
                    
                    // Show occlusion tools
                    container.classList.remove('hidden');
                    
                    // Clear any existing occlusions
                    this.occlusions = [];
                    this.redrawCanvas();
                };
            } else {
                alert('Failed to upload image');
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload image');
        }
    }

    async loadDecks() {
        try {
            const response = await fetch('/api/decks');
            const decks = await response.json();
            // Merge default options for any deck missing options
            this.decks = decks.map(d => ({
                ...d,
                options: { ...this.getDefaultDeckOptions(), ...(d.options || {}) }
            }));
            this.renderDecks();
        } catch (error) {
            console.error('Failed to load decks:', error);
        }
    }

    async loadCards() {
        try {
            const response = await fetch('/api/cards');
            this.cards = await response.json();
        } catch (error) {
            console.error('Failed to load cards:', error);
        }
    }

    renderDecks() {
        const deckList = document.getElementById('deckList');
        const cardDeckSelect = document.getElementById('cardDeck');
        
        // Clear existing lists
        deckList.innerHTML = '';
        cardDeckSelect.innerHTML = '';

        this.decks.forEach(deck => {
            const cardCount = this.cards.filter(card => card.deckId === deck.id).length;
            
            // Add to sidebar deck list
            const deckItem = document.createElement('li');
            deckItem.className = 'deck-item';
            deckItem.innerHTML = `
                <div style="flex:1;" onclick="ankiApp.selectDeckById('${deck.id}', event)">
                    <div class=\"deck-name\">${deck.name}</div>
                    <div class=\"deck-count\">${cardCount} cards</div>
                </div>
                <button class="deck-kebab" title="Deck options" onclick="ankiApp.openDeckOptions(event, '${deck.id}')">⋯</button>
            `;
            deckList.appendChild(deckItem);

            // Add to card form select
            const option = document.createElement('option');
            option.value = deck.id;
            option.textContent = deck.name;
            cardDeckSelect.appendChild(option);
        });
    }

    getDefaultDeckOptions() {
        return {
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
        };
    }

    selectDeckById(deckId, event) {
        const deck = this.decks.find(d => d.id === deckId);
        if (deck) this.selectDeck(deck, event);
    }

    openDeckOptions(event, deckId) {
        event.stopPropagation();
        const deck = this.decks.find(d => d.id === deckId);
        if (!deck) return;
        this.currentDeck = deck;
        // Prefill modal
        document.getElementById('deckOptionsName').value = deck.name || '';
        document.getElementById('deckOptionsDescription').value = deck.description || '';
        const opts = (deck.options) || { newCardsPerDay: 20, maxReviewsPerDay: 200, newOrder: 'added', learningStepsMinutes: [25,1440], graduatingIntervalDays: 3, easyIntervalDays: 4, startingEasePercent: 250 };
        document.getElementById('newCardsPerDay').value = opts.newCardsPerDay ?? 20;
        document.getElementById('maxReviewsPerDay').value = opts.maxReviewsPerDay ?? 200;
        document.getElementById('newOrder').value = opts.newOrder || 'added';
        document.getElementById('learningStepsMinutes').value = (opts.learningStepsMinutes && Array.isArray(opts.learningStepsMinutes)) ? opts.learningStepsMinutes.join(',') : '25,1440';
        document.getElementById('graduatingIntervalDays').value = opts.graduatingIntervalDays ?? 3;
        document.getElementById('easyIntervalDays').value = opts.easyIntervalDays ?? 4;
        document.getElementById('startingEasePercent').value = opts.startingEasePercent ?? 250;
        document.getElementById('easyBonusPercent').value = (opts.easyBonusPercent ?? 150);
        document.getElementById('hardIntervalPercent').value = (opts.hardIntervalPercent ?? 120);
        document.getElementById('intervalModifierPercent').value = (opts.intervalModifierPercent ?? 100);
        document.getElementById('maximumIntervalDays').value = (opts.maximumIntervalDays ?? 36500);
        document.getElementById('buryRelatedReviews').checked = (typeof opts.buryRelatedReviews === 'boolean') ? opts.buryRelatedReviews : true;
        document.getElementById('lapseStepsMinutes').value = (opts.lapseStepsMinutes && Array.isArray(opts.lapseStepsMinutes)) ? opts.lapseStepsMinutes.join(',') : '1440';
        document.getElementById('newIntervalPercent').value = (opts.newIntervalPercent ?? 20);
        document.getElementById('minimumIntervalDays').value = (opts.minimumIntervalDays ?? 1);
        document.getElementById('leechThreshold').value = (opts.leechThreshold ?? 4);
        document.getElementById('deckOptionsModal').style.display = 'block';
        // Attach handler once
        const form = document.getElementById('deckOptionsForm');
        form.onsubmit = (e) => {
            e.preventDefault();
            this.saveDeckOptions(deckId);
        };
    }

    async saveDeckOptions(deckId) {
        const deck = this.decks.find(d => d.id === deckId);
        if (!deck) return;
        const name = document.getElementById('deckOptionsName').value;
        const description = document.getElementById('deckOptionsDescription').value;
        const newCardsPerDay = parseInt(document.getElementById('newCardsPerDay').value, 10) || 0;
        const maxReviewsPerDay = parseInt(document.getElementById('maxReviewsPerDay').value, 10) || 0;
        const newOrder = document.getElementById('newOrder').value;
        const stepsStr = document.getElementById('learningStepsMinutes').value || '';
        const learningStepsMinutes = stepsStr.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n) && n > 0);
        const graduatingIntervalDays = parseInt(document.getElementById('graduatingIntervalDays').value, 10) || 3;
        const easyIntervalDays = parseInt(document.getElementById('easyIntervalDays').value, 10) || 4;
        const startingEasePercent = parseInt(document.getElementById('startingEasePercent').value, 10) || 250;
        const easyBonusPercent = parseInt(document.getElementById('easyBonusPercent').value, 10) || 150;
        const hardIntervalPercent = parseInt(document.getElementById('hardIntervalPercent').value, 10) || 120;
        const intervalModifierPercent = parseInt(document.getElementById('intervalModifierPercent').value, 10) || 100;
        const maximumIntervalDays = parseInt(document.getElementById('maximumIntervalDays').value, 10) || 36500;
        const buryRelatedReviews = !!document.getElementById('buryRelatedReviews').checked;
        try {
            const res = await fetch(`/api/decks/${deckId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    description,
                    options: { newCardsPerDay, maxReviewsPerDay, newOrder, learningStepsMinutes, graduatingIntervalDays, easyIntervalDays, startingEasePercent, easyBonusPercent, hardIntervalPercent, intervalModifierPercent, maximumIntervalDays, buryRelatedReviews, lapseStepsMinutes: (document.getElementById('lapseStepsMinutes').value || '').split(',').map(s=>parseInt(s.trim(),10)).filter(n=>!Number.isNaN(n) && n>0), newIntervalPercent, minimumIntervalDays, leechThreshold }
                })
            });
            if (res.ok) {
                const updated = await res.json();
                const idx = this.decks.findIndex(d => d.id === deckId);
                if (idx !== -1) this.decks[idx] = updated;
                this.renderDecks();
                closeModal('deckOptionsModal');
                if (this.currentDeck && this.currentDeck.id === deckId) {
                    this.selectDeck(updated, null);
                }
            } else {
                const t = await res.text();
                alert('Failed to save deck options: ' + t);
            }
        } catch (e) {
            console.error('Failed to save deck options', e);
            alert('Failed to save deck options');
        }
    }

    selectDeck(deck, event) {
        this.currentDeck = deck;
        
        // Update active state
        document.querySelectorAll('.deck-item').forEach(item => {
            item.classList.remove('active');
        });
        if (event && event.currentTarget) {
            const li = event.currentTarget.classList.contains('deck-item')
                ? event.currentTarget
                : event.currentTarget.closest('.deck-item');
            if (li) li.classList.add('active');
        }

        // Ensure the card browser is closed so only the deck view shows
        if (this.cardBrowserActive) {
            this.closeCardBrowser();
        }

        // Update content
        document.getElementById('contentTitle').textContent = deck.name;
        this.showDeckView(deck);
    }

    showDeckView(deck) {
        const deckCards = this.cards.filter(card => card.deckId === deck.id);
        const mainContent = document.getElementById('mainContent');

        if (deckCards.length === 0) {
            mainContent.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-inbox" style="font-size: 4rem; color: #dee2e6; margin-bottom: 20px;"></i>
                    <h3 style="color: #6c757d; margin-bottom: 15px;">No cards in this deck yet</h3>
                    <p style="color: #6c757d; margin-bottom: 30px;">Start by adding some cards to begin studying!</p>
                    <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                        <button class="btn btn-primary" onclick="showAddCardModal()">
                            <i class="fas fa-plus"></i> Add Your First Card
                        </button>
                        <button class="btn btn-secondary" onclick="ankiApp.showCardBrowser()">
                            <i class="fas fa-list"></i> Card Manager
                        </button>
                    </div>
                </div>
            `;
        } else {
            mainContent.innerHTML = `
                <div style="text-align: center; padding: 60px 20px;">
                    <div style="margin-bottom:20px;">
                        <button class="btn btn-primary" onclick="ankiApp.startStudySession()">
                            <i class="fas fa-play"></i> Study Now
                        </button>
                    </div>
                    <div>
                        <button class="btn btn-secondary" onclick="ankiApp.showCardBrowser()">
                            <i class="fas fa-list"></i> Card Manager
                        </button>
                    </div>
                </div>
            `;
        }
    }

    renderCardItem(card) {
        const cardTypeClass = card.type === 'image-occlusion' ? 'image-occlusion' : '';
        const lastReviewed = card.lastReviewed ? new Date(card.lastReviewed).toLocaleString() : 'Never';
        const nextReview = card.nextReview ? new Date(card.nextReview).toLocaleString() : 'Due now';

        return `
            <div class="card-item">
                <div class="card-front">${card.front}</div>
                <div class="card-back">${card.back}</div>
                ${card.imagePath ? `<img src="${card.imagePath}" alt="Card image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 10px 0;">` : ''}
                <div class="card-meta">
                    <span class="card-type ${cardTypeClass}">${card.type}</span>
                    <div>
                        <div>Last: ${lastReviewed}</div>
                        <div>Next: ${nextReview}</div>
                    </div>
                </div>
            </div>
        `;
    }

    showWelcomeView() {
        // Close card browser if it's open
        if (this.cardBrowserActive) {
            this.closeCardBrowser();
        }
        
        // Reset current deck
        this.currentDeck = null;
        
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <i class="fas fa-brain" style="font-size: 4rem; color: #007bff; margin-bottom: 20px;"></i>
                <h3 style="color: #495057; margin-bottom: 15px;">Welcome to Anki Clone!</h3>
                <p style="color: #6c757d; margin-bottom: 30px; max-width: 600px; margin-left: auto; margin-right: auto;">
                    This is a spaced repetition learning application that uses the SM2 algorithm to help you memorize information effectively. 
                    Create decks, add cards, and study with intelligent scheduling.
                </p>
                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn btn-primary" onclick="showAddDeckModal()">
                        <i class="fas fa-plus"></i> Create Your First Deck
                    </button>
                    <button class="btn btn-secondary" onclick="ankiApp.showStatsView()">
                        <i class="fas fa-chart-bar"></i> View Statistics
                    </button>
                </div>
            </div>
        `;
    }

    showStatsView() {
        // Close card browser if it's open
        if (this.cardBrowserActive) {
            this.closeCardBrowser();
        }
        
        // Reset current deck
        this.currentDeck = null;
        
        const mainContent = document.getElementById('mainContent');
        document.getElementById('contentTitle').textContent = 'Statistics';
        
        const stats = this.calculateStats();
        mainContent.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${stats.totalCards}</div>
                    <div class="stat-label">Total Cards</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.reviewedCards}</div>
                    <div class="stat-label">Reviewed Cards</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.dueCards}</div>
                    <div class="stat-label">Due Today</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${stats.completionRate.toFixed(1)}%</div>
                    <div class="stat-label">Completion Rate</div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 30px;">
                <button class="btn btn-primary" onclick="ankiApp.showWelcomeView()">
                    <i class="fas fa-home"></i> Back to Home
                </button>
            </div>
        `;
    }

    calculateStats() {
        const totalCards = this.cards.length;
        const reviewedCards = this.cards.filter(card => card.lastReviewed).length;
        const now = new Date();
        const dueCards = this.cards.filter(card => {
            return !card.nextReview || new Date(card.nextReview) <= now;
        }).length;
        const completionRate = totalCards > 0 ? (reviewedCards / totalCards) * 100 : 0;

        return { totalCards, reviewedCards, dueCards, completionRate };
    }

    updateStats() {
        const stats = this.calculateStats();
        const statsGrid = document.getElementById('statsGrid');
        
        statsGrid.innerHTML = `
            <div class="stat-card">
                <div class="stat-number">${stats.totalCards}</div>
                <div class="stat-label">Total Cards</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.dueCards}</div>
                <div class="stat-label">Due Today</div>
            </div>
        `;
    }

    async addDeck() {
        const name = document.getElementById('deckName').value;
        const description = document.getElementById('deckDescription').value;

        console.log('Adding deck:', { name, description });

        try {
            const response = await fetch('/api/decks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, description })
            });

            console.log('Response status:', response.status);
            console.log('Response ok:', response.ok);

            if (response.ok) {
                const newDeck = await response.json();
                console.log('New deck created:', newDeck);
                this.decks.push(newDeck);
                this.renderDecks();
                this.updateStats();
                closeModal('addDeckModal');
                
                // Clear form
                document.getElementById('deckName').value = '';
                document.getElementById('deckDescription').value = '';
                
                // Select the new deck
                this.selectDeck(newDeck, null);
            } else {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                alert('Failed to create deck: ' + errorText);
            }
        } catch (error) {
            console.error('Failed to add deck:', error);
            alert('Failed to create deck: ' + error.message);
        }
    }

    async addCard() {
        const deckId = document.getElementById('cardDeck').value;
        const type = document.getElementById('cardType').value;
        const front = document.getElementById('cardFront').value || '';
        const back = document.getElementById('cardBack').value || '';
        const imagePath = this.uploadedImagePath;

        console.log('Adding card:', { deckId, type, front, back, imagePath, occlusions: this.occlusions });

        if (type === 'image-occlusion' && this.occlusions.length === 0) {
            alert('Please add at least one occlusion before creating the card.');
            return;
        }

        try {
            if (type === 'image-occlusion') {
                // Create multiple cards - one for each occlusion
                const createdCards = [];
                
                for (let i = 0; i < this.occlusions.length; i++) {
                    const occlusion = this.occlusions[i];
                    const cardNumber = i + 1;
                    
                    const response = await fetch('/api/cards', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            deckId,
                            type: 'image-occlusion',
                            front: front || `Occlusion ${cardNumber}`,
                            back: back || `This is what was hidden behind occlusion ${cardNumber}`,
                            imagePath,
                            occlusionData: [occlusion], // Single occlusion per card
                            occlusionIndex: i
                        })
                    });

                    if (response.ok) {
                        const newCard = await response.json();
                        this.cards.push(newCard);
                        createdCards.push(newCard);
                        console.log(`Created occlusion card ${cardNumber}:`, newCard);
                    } else {
                        const errorText = await response.text();
                        console.error(`Failed to create occlusion card ${cardNumber}:`, errorText);
                        alert(`Failed to create occlusion card ${cardNumber}: ${errorText}`);
                        return;
                    }
                }
                
                console.log(`Successfully created ${createdCards.length} occlusion cards`);
                alert(`Successfully created ${createdCards.length} occlusion cards!`);
                
            } else {
                // Regular card creation
                const response = await fetch('/api/cards', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        deckId,
                        type,
                        front,
                        back,
                        imagePath: null,
                        occlusionData: null
                    })
                });

                if (response.ok) {
                    const newCard = await response.json();
                    this.cards.push(newCard);
                    console.log('New card created:', newCard);
                } else {
                    const errorText = await response.text();
                    console.error('Server error:', errorText);
                    alert('Failed to create card: ' + errorText);
                    return;
                }
            }

            // Clear form and update UI
            this.updateStats();
            closeModal('addCardModal');
            
            // Clear form
            document.getElementById('cardFront').value = '';
            document.getElementById('cardBack').value = '';
            document.getElementById('cardImage').value = '';
            document.getElementById('imagePreview').classList.add('hidden');
            document.getElementById('occlusionCanvasContainer').classList.add('hidden');
            this.uploadedImagePath = null;
            this.occlusions = [];
            
            // Refresh current view and card browser
            if (this.currentDeck) {
                this.showDeckView(this.currentDeck);
                if (this.cardBrowserActive) {
                    this.populateCardBrowser();
                    this.updateBrowserStats();
                }
            }
            
        } catch (error) {
            console.error('Failed to add card(s):', error);
            alert('Failed to create card(s): ' + error.message);
        }
    }

    startStudySession() {
        if (!this.currentDeck) return;
        
        const deckCards = this.cards.filter(card => card.deckId === this.currentDeck.id);

        // Apply deck options for study limits/order
        const options = (this.currentDeck && this.currentDeck.options) || { newCardsPerDay: 20, maxReviewsPerDay: 200, newOrder: 'added', buryRelatedReviews: true };

        // Separate due reviews and new cards
        const now = new Date();
        let dueReviews = deckCards.filter(card => card.lastReviewed && (!card.nextReview || new Date(card.nextReview) <= now));
        let newCards = deckCards.filter(card => !card.lastReviewed);
        // Order new cards
        if (options.newOrder === 'random') {
            newCards = newCards.sort(() => Math.random() - 0.5);
        } // else keep as added order
        // Apply daily limits
        dueReviews = dueReviews.slice(0, Math.max(0, options.maxReviewsPerDay || 0));
        newCards = newCards.slice(0, Math.max(0, options.newCardsPerDay || 0));
        let dueCards = [...dueReviews, ...newCards];

        // Bury related reviews (siblings) for image-occlusion cards if enabled
        if (options.buryRelatedReviews) {
            const seenImages = new Set();
            const filtered = [];
            for (const c of dueCards) {
                if (c.type === 'image-occlusion' && c.imagePath) {
                    if (seenImages.has(c.imagePath)) continue; // skip sibling
                    seenImages.add(c.imagePath);
                }
                filtered.push(c);
            }
            dueCards = filtered;
        }

        if (dueCards.length === 0) {
            alert('No cards due for review in this deck!');
            return;
        }

        this.isStudying = true;
        this.currentCardIndex = 0;
        this.studyCards = dueCards;
        this.showStudyCard();
    }

    showStudyCard() {
        if (this.currentCardIndex >= this.studyCards.length) {
            this.endStudySession();
            return;
        }

        const card = this.studyCards[this.currentCardIndex];
        const mainContent = document.getElementById('mainContent');
        document.getElementById('contentTitle').textContent = `Studying: ${this.currentDeck.name}`;

        let cardContent = '';
        let occlusionCanvas = '';
        
        if (card.type === 'image-occlusion' && card.imagePath) {
            // Create interactive occlusion canvas for study (rendered once below front/back)
            occlusionCanvas = `
                <div style="margin: 20px 0;">
                    <div style="position: relative; display: inline-block;">
                        <canvas id="studyOcclusionCanvas" style="border: 2px solid #007bff; cursor: pointer;"></canvas>
                    </div>
                    <div style="margin-top: 15px;">
                        <p style="font-size: 0.9rem; color: #6c757d;">
                            Click "Show Answer" to reveal the original image without occlusions.
                        </p>
                    </div>
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="study-area">
                <div class="study-card" id="studyCard">
                    <div class="card-front">
                        <h3>${card.front || 'Image Occlusion Card'}</h3>
                        ${cardContent}
                    </div>
                    <div class="card-back">
                        <h3>${card.back || 'Answer'}</h3>
                        ${cardContent}
                    </div>
                    ${occlusionCanvas}
                </div>
                
                <div style="margin-bottom: 20px;">
                    <button class="btn btn-secondary" onclick="ankiApp.flipCard()">
                        <i class="fas fa-eye"></i> Show Answer
                    </button>
                </div>
                
                <div class="quality-buttons" id="qualityButtons" style="display: none;">
                    <button class="quality-btn again" onclick="ankiApp.rateCard(0)">
                        Again (0)
                    </button>
                    <button class="btn quality-btn hard" onclick="ankiApp.rateCard(1)">
                        Hard (1)
                    </button>
                    <button class="btn quality-btn good" onclick="ankiApp.rateCard(3)">
                        Good (3)
                    </button>
                    <button class="btn quality-btn easy" onclick="ankiApp.rateCard(5)">
                        Easy (5)
                    </button>
                </div>
                
                <div style="margin-top: 20px; color: #6c757d;">
                    Card ${this.currentCardIndex + 1} of ${this.studyCards.length}
                </div>
            </div>
        `;

        // Setup study occlusion canvas if it's an image occlusion card
        if (card.type === 'image-occlusion' && card.imagePath) {
            this.setupStudyOcclusionCanvas(card);
        }
    }

    flipCard() {
        const studyCard = document.getElementById('studyCard');
        const qualityButtons = document.getElementById('qualityButtons');
        
        studyCard.classList.add('flipped');
        qualityButtons.style.display = 'flex';
        
        // Populate quality buttons with predicted next review intervals
        this.populateQualityButtonsWithIntervals();
        
        // For image occlusion cards, reveal the specific occlusion
        if (this.currentStudyCard && this.currentStudyCard.type === 'image-occlusion') {
            this.revealOcclusion();
        }
    }

    async rateCard(quality) {
        const card = this.studyCards[this.currentCardIndex];
        
        try {
            const response = await fetch(`/api/cards/${card.id}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ quality })
            });

            if (response.ok) {
                const result = await response.json();
                
                // Update the card in our local array
                const cardIndex = this.cards.findIndex(c => c.id === card.id);
                if (cardIndex !== -1) {
                    this.cards[cardIndex] = result.card;
                }
                // Immediately move to the next card
                this.currentCardIndex++;
                this.showStudyCard();
            }
        } catch (error) {
            console.error('Failed to rate card:', error);
            alert('Failed to save rating');
        }
    }

    showRatingResult(quality, sm2Result) {
        const qualityLabels = ['Again', 'Hard', 'Good', 'Easy'];
        const qualityLabel = qualityLabels[Math.min(quality, 3)] || 'Unknown';
        
        const mainContent = document.getElementById('mainContent');
        mainContent.innerHTML = `
            <div class="study-area">
                <div class="study-card">
                    <h3 style="color: #28a745; margin-bottom: 20px;">
                        <i class="fas fa-check-circle"></i> ${qualityLabel}!
                    </h3>
                    <p style="margin-bottom: 15px;">Next review in ${sm2Result.interval} day(s)</p>
                    <p style="color: #6c757d;">Easiness factor: ${sm2Result.easiness.toFixed(2)}</p>
                </div>
            </div>
        `;
    }

    endStudySession() {
        this.isStudying = false;
        this.updateStats();
        
        // Close card browser if it's open
        if (this.cardBrowserActive) {
            this.closeCardBrowser();
        }
        
        if (this.currentDeck) {
            this.showDeckView(this.currentDeck);
        } else {
            this.showWelcomeView();
        }
    }

    setupStudyOcclusionCanvas(card) {
        const canvas = document.getElementById('studyOcclusionCanvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Set canvas size
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            
            // Scale canvas to fit (max 500px width)
            const maxWidth = 500;
            const scale = Math.min(maxWidth / img.naturalWidth, 1);
            canvas.style.width = (img.naturalWidth * scale) + 'px';
            canvas.style.height = (img.naturalHeight * scale) + 'px';
            
            // Store card data for interaction
            this.currentStudyCard = card;
            this.studyOcclusions = [...(card.occlusionData || [])];
            this.occlusionsVisible = true;
            
            this.redrawStudyCanvas();
        };
        
        img.src = card.imagePath;
    }

    redrawStudyCanvas() {
        const canvas = document.getElementById('studyOcclusionCanvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // Draw occlusions if visible (during study, show all occlusions)
            if (this.occlusionsVisible) {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                this.studyOcclusions.forEach((occlusion, index) => {
                    ctx.fillRect(occlusion.x, occlusion.y, occlusion.width, occlusion.height);
                    
                    // Add number label on occlusion
                    ctx.fillStyle = 'white';
                    ctx.font = '16px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        (index + 1).toString(), 
                        occlusion.x + occlusion.width / 2, 
                        occlusion.y + occlusion.height / 2 + 6
                    );
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
                });
            }
        };
        
        img.src = this.currentStudyCard.imagePath;
    }

    revealOcclusion() {
        // Hide all occlusions to reveal the answer and show original image
        this.occlusionsVisible = false;
        this.redrawStudyCanvas();
    }

    // Populate the quality buttons with predicted intervals based on current SM2 state
    populateQualityButtonsWithIntervals() {
        const qualityButtons = document.getElementById('qualityButtons');
        if (!qualityButtons) return;
        
        const currentCard = this.studyCards && this.studyCards[this.currentCardIndex];
        if (!currentCard || !currentCard.sm2) return;
        const againBtn = qualityButtons.querySelector('.quality-btn.again');
        const hardBtn = qualityButtons.querySelector('.quality-btn.hard');
        const goodBtn = qualityButtons.querySelector('.quality-btn.good');
        const easyBtn = qualityButtons.querySelector('.quality-btn.easy');

        const deckOpts = (this.currentDeck && this.currentDeck.options) || {};
        let learningSteps = Array.isArray(deckOpts.learningStepsMinutes) ? deckOpts.learningStepsMinutes : [];
        if (!learningSteps || learningSteps.length === 0) {
            learningSteps = [25, 1440];
        }
        const isLearning = (currentCard.sm2.repetitions === 0) || (typeof currentCard.learningStepIndex === 'number');

        const formatMinutes = (m) => {
            if (m >= 1440) {
                const days = Math.round(m / 1440);
                return days === 1 ? '1 day' : `${days} days`;
            } else if (m >= 60) {
                const hours = Math.round(m / 60);
                return hours === 1 ? '1 hour' : `${hours} hours`;
            }
            return `${Math.max(1, Math.round(m))} min`;
        };

        if (isLearning && learningSteps.length > 0) {
            const idx = typeof currentCard.learningStepIndex === 'number' ? currentCard.learningStepIndex : 0;
            const first = learningSteps[0];
            const nextIdx = Math.min(idx + 1, learningSteps.length - 1);
            const nextMinutes = learningSteps[nextIdx];

            // Again -> first step
            if (againBtn) againBtn.textContent = `Again (${formatMinutes(first)})`;
            // Hard -> roughly half of next step if available; otherwise repeat/scale current step
            let hardMinutes;
            if (learningSteps.length > 1 && nextIdx !== idx) {
                hardMinutes = Math.max(learningSteps[idx], Math.round(nextMinutes / 2));
            } else {
                const hardPct = deckOpts.hardIntervalPercent ?? 120;
                const base = learningSteps[idx] || first;
                hardMinutes = Math.max(base, Math.round(base * (hardPct / 100)));
            }
            if (hardBtn) hardBtn.textContent = `Hard (${formatMinutes(hardMinutes)})`;
            // Good -> next step or graduate
            if (idx < learningSteps.length - 1) {
                if (goodBtn) goodBtn.textContent = `Good (${formatMinutes(nextMinutes)})`;
            } else {
                const gradDays = deckOpts.graduatingIntervalDays ?? 3;
                if (goodBtn) goodBtn.textContent = `Good (${this.formatIntervalDays(gradDays)})`;
            }
            // Easy -> graduate immediately to easy interval
            const easyDays = deckOpts.easyIntervalDays ?? 4;
            if (easyBtn) easyBtn.textContent = `Easy (${this.formatIntervalDays(easyDays)})`;
            return;
        }

        // Default: show SM2-based predictions (approximate)
        const sm2State = { ...currentCard.sm2 };
        const again = this.simulateSm2Next(sm2State, 0);
        const hard = this.simulateSm2Next({ ...currentCard.sm2 }, 1);
        const good = this.simulateSm2Next({ ...currentCard.sm2 }, 3);
        const easy = this.simulateSm2Next({ ...currentCard.sm2 }, 5);

        if (againBtn) againBtn.textContent = `Again (${this.formatIntervalDays(again.interval)})`;
        if (hardBtn) hardBtn.textContent = `Hard (${this.formatIntervalDays(hard.interval)})`;
        if (goodBtn) goodBtn.textContent = `Good (${this.formatIntervalDays(good.interval)})`;
        if (easyBtn) easyBtn.textContent = `Easy (${this.formatIntervalDays(easy.interval)})`;
    }
    
    // Simulate SM2 next review calculation (mirrors server logic)
    simulateSm2Next(sm2State, quality) {
        const result = { ...sm2State };
        if (quality < 0 || quality > 5) return result;
        
        result.easiness = Math.max(1.3, result.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
        if (quality >= 3) {
            if (result.repetitions === 0) {
                result.interval = 1;
            } else if (result.repetitions === 1) {
                result.interval = 6;
            } else {
                result.interval = Math.round(result.interval * result.easiness);
            }
            result.repetitions = result.repetitions + 1;
        } else {
            result.repetitions = 0;
            result.interval = 1;
        }
        return result;
    }
    
    formatIntervalDays(days) {
        const n = Math.max(1, Math.round(days));
        return n === 1 ? '1 day' : `${n} days`;
    }

    // Card Browser Methods
    showCardBrowser() {
        if (!this.currentDeck) return;
        
        this.cardBrowserActive = true;
        document.getElementById('cardBrowser').classList.add('active');
        document.getElementById('mainContentContainer').classList.add('with-browser');
        this.populateCardBrowser();
        this.updateBrowserStats();
    }

    closeCardBrowser() {
        this.cardBrowserActive = false;
        document.getElementById('cardBrowser').classList.remove('active');
        document.getElementById('mainContentContainer').classList.remove('with-browser');
        this.selectedCardId = null;
    }

    populateCardBrowser() {
        if (!this.currentDeck) return;
        
        const deckCards = this.cards.filter(card => card.deckId === this.currentDeck.id);
        const browserCardList = document.getElementById('browserCardList');
        
        if (deckCards.length === 0) {
            browserCardList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #6c757d;">
                    <i class="fas fa-inbox" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>No cards in this deck</p>
                </div>
            `;
            return;
        }

        const filteredCards = this.getFilteredCards(deckCards);
        
        if (filteredCards.length === 0) {
            let message = 'No cards found';
            if (this.searchQuery) {
                message = `No cards match "${this.searchQuery}"`;
            } else if (this.currentFilter !== 'all') {
                message = `No ${this.currentFilter} cards found`;
            }
            
            browserCardList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #6c757d;">
                    <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 10px;"></i>
                    <p>${message}</p>
                    <p style="font-size: 0.8rem; margin-top: 10px;">Try adjusting your search or filters</p>
                </div>
            `;
        } else {
            // Group image-occlusion cards by imagePath (keep occlusion order) and number the entire list
            const groups = new Map();
            const nonImageCards = [];
            filteredCards.forEach(card => {
                if (card.type === 'image-occlusion' && card.imagePath) {
                    const key = card.imagePath;
                    if (!groups.has(key)) groups.set(key, []);
                    groups.get(key).push(card);
                } else {
                    nonImageCards.push(card);
                }
            });
            const orderedCards = [];
            Array.from(groups.keys()).sort().forEach(key => {
                const arr = groups.get(key);
                arr.sort((a, b) => {
                    const ai = (typeof a.occlusionIndex === 'number') ? a.occlusionIndex : 0;
                    const bi = (typeof b.occlusionIndex === 'number') ? b.occlusionIndex : 0;
                    return ai - bi;
                });
                orderedCards.push(...arr);
            });
            orderedCards.push(...nonImageCards);

            const cardsHtml = orderedCards.map((card, idx) => this.renderBrowserCardItem(card, idx + 1)).join('');
            browserCardList.innerHTML = cardsHtml;
        }
    }

    renderBrowserCardItem(card, index) {
        const cardTypeClass = card.type === 'image-occlusion' ? 'image-occlusion' : '';
        const lastReviewed = card.lastReviewed ? new Date(card.lastReviewed).toLocaleString() : 'Never';
        const nextReview = card.nextReview ? new Date(card.nextReview).toLocaleString() : 'Due now';
        const isSelected = this.selectedCardId === card.id ? 'selected' : '';
        const isChecked = this.selectedCardIds && this.selectedCardIds.has(card.id);

        const selectionCheckbox = this.selectionMode ? `
            <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="ankiApp.toggleSelectCard(event, '${card.id}')" style="margin-right: 8px;">
        ` : '';

        const bookmarkBtn = `
            <button onclick="ankiApp.toggleBookmark(event, '${card.id}')" style="background:none;border:none;cursor:pointer;float:right;color:${card.bookmarked ? '#f59f00' : '#6c757d'}" title="Toggle bookmark">
                <i class="${card.bookmarked ? 'fas' : 'far'} fa-bookmark"></i>
            </button>
        `;

        return `
            <div class="browser-card-item ${isSelected}" onclick="ankiApp.selectBrowserCard('${card.id}')">
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div style="display:flex; align-items:center;">
                        ${selectionCheckbox}
                        <span style="min-width:28px; display:inline-block; color:#6c757d;">${index ? index + '.' : ''}</span>
                        <div class="browser-card-front">${card.front || 'Image Occlusion Card'}</div>
                    </div>
                    ${bookmarkBtn}
                </div>
                <div class="browser-card-back">${card.back || 'Answer'}</div>
                <div class="browser-card-meta">
                    <span class="browser-card-type ${cardTypeClass}">${card.type}</span>
                    <div>
                        <div>Last: ${lastReviewed}</div>
                        <div>Next: ${nextReview}</div>
                    </div>
                </div>
            </div>
        `;
    }

    selectBrowserCard(cardId) {
        this.selectedCardId = cardId;
        this.populateCardBrowser(); // Re-render to show selection
        
        // Find the selected card and show its details in the main content
        const selectedCard = this.cards.find(card => card.id === cardId);
        if (selectedCard) {
            this.showCardDetails(selectedCard);
        }
    }

    // Browser menu controls
    toggleBrowserMenu(event) {
        event.stopPropagation();
        const menu = document.getElementById('browserDropdown');
        if (menu) menu.classList.toggle('active');
    }

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        if (!this.selectionMode) {
            this.selectedCardIds.clear();
        }
        this.populateCardBrowser();
    }

    toggleSelectCard(event, cardId) {
        event.stopPropagation();
        if (!this.selectionMode) return;
        if (this.selectedCardIds.has(cardId)) {
            this.selectedCardIds.delete(cardId);
        } else {
            this.selectedCardIds.add(cardId);
        }
        this.populateCardBrowser();
    }

    selectAllInBrowser() {
        if (!this.currentDeck) return;
        this.selectionMode = true;
        const deckCards = this.cards.filter(card => card.deckId === this.currentDeck.id);
        const filtered = this.getFilteredCards(deckCards);
        this.selectedCardIds = new Set(filtered.map(c => c.id));
        this.populateCardBrowser();
    }

    async bulkDeleteSelected() {
        const ids = Array.from(this.selectedCardIds);
        if (ids.length === 0) {
            alert('No cards selected');
            return;
        }
        if (!confirm(`Delete ${ids.length} selected card(s)? This cannot be undone.`)) return;
        try {
            const res = await fetch('/api/cards/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            if (res.ok) {
                this.cards = this.cards.filter(c => !this.selectedCardIds.has(c.id));
                this.selectedCardIds.clear();
                this.selectionMode = false;
                this.populateCardBrowser();
                this.updateBrowserStats();
                this.updateStats();
                if (this.currentDeck) this.showDeckView(this.currentDeck);
            } else {
                const t = await res.text();
                alert('Failed to delete: ' + t);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to delete selected cards');
        }
    }

    async bulkMoveSelected() {
        const ids = Array.from(this.selectedCardIds);
        if (ids.length === 0) {
            alert('No cards selected');
            return;
        }
        if (!this.decks || this.decks.length === 0) {
            alert('No decks available');
            return;
        }
        const options = this.decks.map((d, i) => `${i + 1}. ${d.name}`).join('\n');
        const answer = prompt(`Move selected to which deck? Enter number:\n${options}`);
        if (!answer) return;
        const idx = parseInt(answer, 10) - 1;
        if (Number.isNaN(idx) || idx < 0 || idx >= this.decks.length) {
            alert('Invalid selection');
            return;
        }
        const targetDeck = this.decks[idx];
        try {
            const res = await fetch('/api/cards/bulk-move', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids, deckId: targetDeck.id })
            });
            if (res.ok) {
                this.cards.forEach(c => { if (this.selectedCardIds.has(c.id)) c.deckId = targetDeck.id; });
                this.selectedCardIds.clear();
                this.selectionMode = false;
                this.populateCardBrowser();
                this.updateBrowserStats();
                this.updateStats();
                if (this.currentDeck) this.showDeckView(this.currentDeck);
                alert(`Moved to ${targetDeck.name}`);
            } else {
                const t = await res.text();
                alert('Failed to move: ' + t);
            }
        } catch (e) {
            console.error(e);
            alert('Failed to move selected cards');
        }
    }

    async toggleBookmark(event, cardId) {
        event.stopPropagation();
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;
        try {
            const res = await fetch(`/api/cards/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookmarked: !card.bookmarked })
            });
            if (res.ok) {
                const updated = await res.json();
                const idx = this.cards.findIndex(c => c.id === cardId);
                if (idx !== -1) this.cards[idx] = updated;
                this.populateCardBrowser();
            }
        } catch (e) {
            console.error('Failed to toggle bookmark', e);
        }
    }

    showCardDetails(card) {
        const mainContent = document.getElementById('mainContent');
        document.getElementById('contentTitle').textContent = `Card Details: ${card.front || 'Image Occlusion'}`;
        
        const cardTypeClass = card.type === 'image-occlusion' ? 'image-occlusion' : '';
        const lastReviewed = card.lastReviewed ? new Date(card.lastReviewed).toLocaleString() : 'Never';
        const nextReview = card.nextReview ? new Date(card.nextReview).toLocaleString() : 'Due now';

        let imageContent = '';
        if (card.imagePath) {
            imageContent = `
                <div style="margin: 20px 0;">
                    <img src="${card.imagePath}" alt="Card image" style="max-width: 100%; height: auto; border-radius: 8px;">
                </div>
            `;
        }

        mainContent.innerHTML = `
            <div class="card-item" style="max-width: 800px; margin: 0 auto;">
                <div class="card-front">${card.front || 'Image Occlusion Card'}</div>
                <div class="card-back">${card.back || 'Answer'}</div>
                ${imageContent}
                <div class="card-meta">
                    <span class="card-type ${cardTypeClass}">${card.type}</span>
                    <div>
                        <div>Last reviewed: ${lastReviewed}</div>
                        <div>Next review: ${nextReview}</div>
                    </div>
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn btn-primary" onclick="ankiApp.editCard('${card.id}')">
                        <i class="fas fa-edit"></i> Edit Card
                    </button>
                    <button class="btn btn-secondary" onclick="ankiApp.deleteCard('${card.id}')">
                        <i class="fas fa-trash"></i> Delete Card
                    </button>
                </div>
            </div>
        `;
    }

    getFilteredCards(deckCards) {
        let filtered = deckCards;

        // Apply search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            filtered = filtered.filter(card => 
                (card.front && card.front.toLowerCase().includes(query)) ||
                (card.back && card.back.toLowerCase().includes(query))
            );
        }

        // Apply type filter
        switch (this.currentFilter) {
            case 'due':
                const now = new Date();
                filtered = filtered.filter(card => 
                    !card.nextReview || new Date(card.nextReview) <= now
                );
                break;
            case 'new':
                filtered = filtered.filter(card => !card.lastReviewed);
                break;
            case 'image-occlusion':
                filtered = filtered.filter(card => card.type === 'image-occlusion');
                break;
            case 'all':
            default:
                break;
        }

        return filtered;
    }

    filterCards() {
        this.searchQuery = document.getElementById('browserSearch').value;
        this.populateCardBrowser();
        this.updateBrowserStats();
    }

    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.populateCardBrowser();
        this.updateBrowserStats();
    }

    updateBrowserStats() {
        if (!this.currentDeck) return;
        
        const deckCards = this.cards.filter(card => card.deckId === this.currentDeck.id);
        const filteredCards = this.getFilteredCards(deckCards);
        const totalCards = deckCards.length;
        const dueCards = deckCards.filter(card => {
            return !card.nextReview || new Date(card.nextReview) <= new Date();
        }).length;
        const newCards = deckCards.filter(card => !card.lastReviewed).length;
        const imageCards = deckCards.filter(card => card.type === 'image-occlusion').length;

        const browserStats = document.getElementById('browserStats');
        browserStats.innerHTML = `
            <div class="stat-row">
                <span>Total Cards:</span>
                <span class="stat-value">${totalCards}</span>
            </div>
            <div class="stat-row">
                <span>Due Today:</span>
                <span class="stat-value">${dueCards}</span>
            </div>
            <div class="stat-row">
                <span>New Cards:</span>
                <span class="stat-value">${newCards}</span>
            </div>
            <div class="stat-row">
                <span>Image Cards:</span>
                <span class="stat-value">${imageCards}</span>
            </div>
            <div class="stat-row">
                <span>Filtered:</span>
                <span class="stat-value">${filteredCards.length}</span>
            </div>
        `;
    }

    async editCard(cardId) {
        const card = this.cards.find(c => c.id === cardId);
        if (!card) return;
        const newFront = prompt('Edit Front:', card.front || '');
        if (newFront === null) return;
        const newBack = prompt('Edit Back:', card.back || '');
        if (newBack === null) return;
        try {
            const res = await fetch(`/api/cards/${cardId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ front: newFront, back: newBack })
            });
            if (res.ok) {
                const updated = await res.json();
                const idx = this.cards.findIndex(c => c.id === cardId);
                if (idx !== -1) this.cards[idx] = updated;
                this.populateCardBrowser();
                this.updateBrowserStats();
                this.showCardDetails(updated);
            } else {
                const t = await res.text();
                alert('Failed to edit card: ' + t);
            }
        } catch (e) {
            console.error('Failed to edit card', e);
        }
    }

    async deleteCard(cardId) {
        if (!confirm('Delete this card? This cannot be undone.')) return;
        try {
            const res = await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
            if (res.ok) {
                this.cards = this.cards.filter(c => c.id !== cardId);
                if (this.selectedCardId === cardId) this.selectedCardId = null;
                this.populateCardBrowser();
                this.updateBrowserStats();
                if (this.currentDeck) this.showDeckView(this.currentDeck);
                document.getElementById('mainContent').innerHTML = '<p style="color:#6c757d">Card deleted.</p>';
            } else {
                const t = await res.text();
                alert('Failed to delete card: ' + t);
            }
        } catch (e) {
            console.error('Failed to delete card', e);
        }
    }
}

// Global functions for modals
function showAddDeckModal() {
    document.getElementById('addDeckModal').style.display = 'block';
}

function showAddCardModal() {
    document.getElementById('addCardModal').style.display = 'block';
    // Prefill deck selection with the currently viewed deck
    try {
        if (ankiApp && ankiApp.currentDeck) {
            const select = document.getElementById('cardDeck');
            if (select) {
                select.value = ankiApp.currentDeck.id;
            }
        }
    } catch (e) {
        // no-op
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function toggleCardTypeFields() {
    const cardType = document.getElementById('cardType').value;
    const imageFields = document.getElementById('imageOcclusionFields');
    
    if (cardType === 'image-occlusion') {
        imageFields.classList.remove('hidden');
    } else {
        imageFields.classList.add('hidden');
    }
}

// Global functions for image occlusion
function clearOcclusions() {
    if (ankiApp) {
        ankiApp.clearOcclusions();
    }
}

function undoLastOcclusion() {
    if (ankiApp) {
        ankiApp.undoLastOcclusion();
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Initialize the application
let ankiApp;
document.addEventListener('DOMContentLoaded', () => {
    ankiApp = new AnkiApp();
}); 