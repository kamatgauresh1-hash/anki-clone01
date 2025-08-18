// Anki Clone Application
class AnkiApp {
    constructor() {
        this.currentDeck = null;
        this.cards = [];
        this.decks = [];
        this.currentCardIndex = 0;
        this.isStudying = false;
        this.uploadedImagePath = null;
        
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
            this.decks = await response.json();
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
            deckItem.onclick = () => this.selectDeck(deck);
            deckItem.innerHTML = `
                <div class="deck-name">${deck.name}</div>
                <div class="deck-count">${cardCount} cards</div>
            `;
            deckList.appendChild(deckItem);

            // Add to card form select
            const option = document.createElement('option');
            option.value = deck.id;
            option.textContent = deck.name;
            cardDeckSelect.appendChild(option);
        });
    }

    selectDeck(deck) {
        this.currentDeck = deck;
        
        // Update active state
        document.querySelectorAll('.deck-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');

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
                    <button class="btn btn-primary" onclick="showAddCardModal()">
                        <i class="fas fa-plus"></i> Add Your First Card
                    </button>
                </div>
            `;
        } else {
            // Show cards grid
            const cardsHtml = deckCards.map(card => this.renderCardItem(card)).join('');
            mainContent.innerHTML = `
                <div class="card-grid">
                    ${cardsHtml}
                </div>
                <div style="text-align: center;">
                    <button class="btn btn-primary" onclick="ankiApp.startStudySession()">
                        <i class="fas fa-play"></i> Start Study Session
                    </button>
                </div>
            `;
        }
    }

    renderCardItem(card) {
        const cardTypeClass = card.type === 'image-occlusion' ? 'image-occlusion' : '';
        const lastReviewed = card.lastReviewed ? new Date(card.lastReviewed).toLocaleDateString() : 'Never';
        const nextReview = card.nextReview ? new Date(card.nextReview).toLocaleDateString() : 'Due now';

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
                this.selectDeck(newDeck);
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
            
            // Refresh current view
            if (this.currentDeck) {
                this.showDeckView(this.currentDeck);
            }
            
        } catch (error) {
            console.error('Failed to add card(s):', error);
            alert('Failed to create card(s): ' + error.message);
        }
    }

    startStudySession() {
        if (!this.currentDeck) return;
        
        const deckCards = this.cards.filter(card => card.deckId === this.currentDeck.id);
        const dueCards = deckCards.filter(card => {
            return !card.nextReview || new Date(card.nextReview) <= new Date();
        });

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
            // Create interactive occlusion canvas for study
            occlusionCanvas = `
                <div style="margin: 20px 0;">
                    <div style="position: relative; display: inline-block;">
                        <canvas id="studyOcclusionCanvas" style="border: 2px solid #007bff; cursor: pointer;"></canvas>
                    </div>
                    <div style="margin-top: 15px;">
                        <p style="font-size: 0.9rem; color: #6c757d;">
                            This card focuses on one specific hidden area. Click "Show Answer" to reveal what's hidden.
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
                        ${occlusionCanvas}
                    </div>
                    <div class="card-back">
                        <h3>${card.back || 'Answer'}</h3>
                        ${cardContent}
                        ${occlusionCanvas}
                    </div>
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

                // Show result briefly
                this.showRatingResult(quality, result.sm2Result);
                
                // Move to next card after a delay
                setTimeout(() => {
                    this.currentCardIndex++;
                    this.showStudyCard();
                }, 2000);
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
        // Hide all occlusions to reveal the answer
        this.occlusionsVisible = false;
        this.redrawStudyCanvas();
    }
}

// Global functions for modals
function showAddDeckModal() {
    document.getElementById('addDeckModal').style.display = 'block';
}

function showAddCardModal() {
    document.getElementById('addCardModal').style.display = 'block';
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