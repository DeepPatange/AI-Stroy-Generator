/**
 * StoryForge AI - Enhanced Interactive Storytelling Application
 * Professional-grade frontend with advanced features
 */

class StoryForgeApp {
    constructor() {
        // Core state
        this.sessionId = null;
        this.currentQuestionId = null;
        this.currentPhase = 'setting';
        this.questionIndex = 0;
        this.responses = {};
        this.storySegments = [];
        this.isGenerating = false;

        // Enhanced state
        this.theme = localStorage.getItem('storyforge-theme') || 'dark';
        this.bookmarks = JSON.parse(localStorage.getItem('storyforge-bookmarks') || '[]');
        this.savedStories = JSON.parse(localStorage.getItem('storyforge-stories') || '[]');
        this.storyHistory = [];
        this.currentChapter = 1;
        this.undoStack = [];
        this.redoStack = [];
        this.isReadingMode = false;
        this.isTypingEnabled = true;
        this.isSoundEnabled = localStorage.getItem('storyforge-sound') !== 'false';
        this.currentMood = 'neutral';
        this.characters = [];

        // Audio context
        this.audioContext = null;
        this.ambientSound = null;

        this.phaseNames = {
            'setting': '🌍 World Building',
            'character': '👤 Characters',
            'theme': '🎭 Theme & Genre',
            'plot': '📖 Plot Structure',
            'continuation': '✨ Story Time'
        };

        this.moodThemes = {
            'neutral': { color: '#6366f1', icon: '😐', sound: 'ambient' },
            'happy': { color: '#22c55e', icon: '😊', sound: 'upbeat' },
            'sad': { color: '#3b82f6', icon: '😢', sound: 'melancholy' },
            'tense': { color: '#ef4444', icon: '😰', sound: 'suspense' },
            'romantic': { color: '#ec4899', icon: '💕', sound: 'romantic' },
            'mysterious': { color: '#8b5cf6', icon: '🔮', sound: 'mystery' },
            'adventurous': { color: '#f59e0b', icon: '⚔️', sound: 'adventure' }
        };

        // Keyboard shortcuts
        this.shortcuts = {
            'ctrl+s': () => this.saveCurrentStory(),
            'ctrl+z': () => this.undo(),
            'ctrl+y': () => this.redo(),
            'ctrl+b': () => this.addBookmark(),
            'ctrl+d': () => this.downloadStory(),
            'ctrl+r': () => this.toggleReadingMode(),
            'ctrl+t': () => this.toggleTheme(),
            'escape': () => this.exitReadingMode()
        };

        this.init();
    }

    async init() {
        this.applyTheme();
        await this.checkLLMStatus();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupSettingsListeners();
        this.loadSavedStories();
        await this.startNewSession();
    }

    // ==================== Theme System ====================
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.innerHTML = this.theme === 'dark' ? '☀️' : '🌙';
        }
    }

    toggleTheme() {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem('storyforge-theme', this.theme);
        this.applyTheme();
        this.showNotification(`Switched to ${this.theme} mode`, 'success');
    }

    // ==================== Event Listeners ====================
    setupEventListeners() {
        // Navigation buttons
        document.getElementById('nextBtn')?.addEventListener('click', () => this.handleNext());
        document.getElementById('backBtn')?.addEventListener('click', () => this.handleBack());

        // Action buttons
        document.getElementById('newStoryBtn')?.addEventListener('click', () => this.confirmNewStory());
        document.getElementById('downloadBtn')?.addEventListener('click', () => this.showExportOptions());
        document.getElementById('continueBtn')?.addEventListener('click', () => this.showContinueOptions());

        // Enhanced action buttons
        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('readingModeBtn')?.addEventListener('click', () => this.toggleReadingMode());
        document.getElementById('saveStoryBtn')?.addEventListener('click', () => this.saveCurrentStory());
        document.getElementById('loadStoryBtn')?.addEventListener('click', () => this.showSavedStories());
        document.getElementById('bookmarkBtn')?.addEventListener('click', () => this.addBookmark());
        document.getElementById('historyBtn')?.addEventListener('click', () => this.showStoryHistory());
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('redoBtn')?.addEventListener('click', () => this.redo());
        document.getElementById('soundToggle')?.addEventListener('click', () => this.toggleSound());

        // Text input
        document.getElementById('textInput')?.addEventListener('input', () => this.updateNextButtonState());

        // Settings
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettings')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('settingsOverlay')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());

        // Temperature slider
        document.getElementById('temperature')?.addEventListener('input', (e) => {
            const val = e.target.value;
            const labels = { '0.1': 'Very Precise', '0.2': 'Precise', '0.3': 'Focused', '0.4': 'Moderate', '0.5': 'Balanced', '0.6': 'Creative', '0.7': 'Very Creative', '0.8': 'Imaginative', '0.9': 'Wild', '1.0': 'Maximum Chaos' };
            document.getElementById('tempValue').textContent = `${val} - ${labels[val] || 'Balanced'}`;
        });

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeAllModals();
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            const key = `${e.ctrlKey || e.metaKey ? 'ctrl+' : ''}${e.key.toLowerCase()}`;
            if (this.shortcuts[key]) {
                e.preventDefault();
                this.shortcuts[key]();
            }
        });
    }

    setupSettingsListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeSettings();
                this.closeAllModals();
                if (this.isReadingMode) this.exitReadingMode();
            }
        });
    }

    // ==================== Reading Mode ====================
    toggleReadingMode() {
        this.isReadingMode = !this.isReadingMode;
        document.body.classList.toggle('reading-mode', this.isReadingMode);

        if (this.isReadingMode) {
            this.showNotification('Reading mode enabled. Press ESC to exit.', 'info');
        }
    }

    exitReadingMode() {
        if (this.isReadingMode) {
            this.isReadingMode = false;
            document.body.classList.remove('reading-mode');
        }
    }

    // ==================== Sound System ====================
    toggleSound() {
        this.isSoundEnabled = !this.isSoundEnabled;
        localStorage.setItem('storyforge-sound', this.isSoundEnabled);

        const soundBtn = document.getElementById('soundToggle');
        if (soundBtn) {
            soundBtn.innerHTML = this.isSoundEnabled ? '🔊' : '🔇';
        }

        if (!this.isSoundEnabled && this.ambientSound) {
            this.stopAmbientSound();
        }

        this.showNotification(`Sound ${this.isSoundEnabled ? 'enabled' : 'disabled'}`, 'info');
    }

    playSound(type) {
        if (!this.isSoundEnabled) return;

        // Create audio context if needed
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

        // Different sounds for different actions
        const sounds = {
            'click': { freq: 800, duration: 0.1, type: 'sine' },
            'success': { freq: 523.25, duration: 0.2, type: 'sine' },
            'error': { freq: 200, duration: 0.3, type: 'square' },
            'typing': { freq: 1000, duration: 0.05, type: 'sine' },
            'chapter': { freq: 659.25, duration: 0.4, type: 'triangle' }
        };

        const sound = sounds[type] || sounds.click;
        oscillator.type = sound.type;
        oscillator.frequency.setValueAtTime(sound.freq, this.audioContext.currentTime);
        gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration);

        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + sound.duration);
    }

    stopAmbientSound() {
        if (this.ambientSound) {
            this.ambientSound.stop();
            this.ambientSound = null;
        }
    }

    // ==================== Typing Animation ====================
    async typeText(element, text, speed = 20) {
        if (!this.isTypingEnabled) {
            element.innerHTML = text;
            return;
        }

        element.innerHTML = '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = text;
        const textContent = tempDiv.textContent;

        let i = 0;
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';
        cursor.textContent = '|';
        element.appendChild(cursor);

        return new Promise((resolve) => {
            const typeChar = () => {
                if (i < textContent.length) {
                    const char = textContent.charAt(i);
                    const textNode = document.createTextNode(char);
                    element.insertBefore(textNode, cursor);
                    i++;

                    // Vary speed for natural feel
                    const variance = Math.random() * 20 - 10;
                    const charSpeed = char === ' ' ? speed * 0.5 : speed + variance;

                    if (this.isSoundEnabled && i % 5 === 0) {
                        this.playSound('typing');
                    }

                    setTimeout(typeChar, Math.max(5, charSpeed));
                } else {
                    cursor.remove();
                    element.innerHTML = text; // Restore HTML formatting
                    resolve();
                }
            };
            typeChar();
        });
    }

    // ==================== Story Mood System ====================
    analyzeMood(text) {
        const moodKeywords = {
            'happy': ['joy', 'happy', 'laugh', 'smile', 'celebrate', 'wonderful', 'excited', 'love'],
            'sad': ['sad', 'cry', 'tears', 'grief', 'loss', 'lonely', 'despair', 'heartbreak'],
            'tense': ['danger', 'fear', 'threat', 'chase', 'escape', 'battle', 'fight', 'war'],
            'romantic': ['love', 'heart', 'kiss', 'embrace', 'passion', 'romantic', 'beautiful'],
            'mysterious': ['mystery', 'secret', 'hidden', 'strange', 'unknown', 'shadow', 'whisper'],
            'adventurous': ['adventure', 'journey', 'quest', 'explore', 'discover', 'treasure', 'hero']
        };

        const textLower = text.toLowerCase();
        let maxScore = 0;
        let detectedMood = 'neutral';

        for (const [mood, keywords] of Object.entries(moodKeywords)) {
            const score = keywords.filter(kw => textLower.includes(kw)).length;
            if (score > maxScore) {
                maxScore = score;
                detectedMood = mood;
            }
        }

        return detectedMood;
    }

    updateMoodIndicator(mood) {
        this.currentMood = mood;
        const moodData = this.moodThemes[mood] || this.moodThemes.neutral;

        const indicator = document.getElementById('moodIndicator');
        if (indicator) {
            indicator.innerHTML = `
                <span class="mood-icon">${moodData.icon}</span>
                <span class="mood-text">${mood.charAt(0).toUpperCase() + mood.slice(1)}</span>
            `;
            indicator.style.setProperty('--mood-color', moodData.color);
        }

        // Update accent color based on mood
        document.documentElement.style.setProperty('--current-mood-color', moodData.color);
    }

    // ==================== Chapter System ====================
    addChapterMarker(title = null) {
        this.currentChapter++;
        const chapterTitle = title || `Chapter ${this.currentChapter}`;

        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            const chapterMarker = document.createElement('div');
            chapterMarker.className = 'chapter-marker';
            chapterMarker.innerHTML = `
                <div class="chapter-number">Chapter ${this.currentChapter}</div>
                <div class="chapter-title">${chapterTitle}</div>
                <div class="chapter-divider"></div>
            `;
            storyContent.appendChild(chapterMarker);
        }

        this.playSound('chapter');
        this.showNotification(`${chapterTitle} begins!`, 'info');
    }

    // ==================== Bookmark System ====================
    addBookmark() {
        if (this.storySegments.length === 0) {
            this.showNotification('No story content to bookmark', 'error');
            return;
        }

        const bookmark = {
            id: Date.now(),
            sessionId: this.sessionId,
            segmentIndex: this.storySegments.length - 1,
            preview: this.storySegments[this.storySegments.length - 1].substring(0, 100) + '...',
            chapter: this.currentChapter,
            timestamp: new Date().toISOString(),
            mood: this.currentMood
        };

        this.bookmarks.push(bookmark);
        localStorage.setItem('storyforge-bookmarks', JSON.stringify(this.bookmarks));

        this.playSound('success');
        this.showNotification('Bookmark added!', 'success');
        this.updateBookmarkButton();
    }

    updateBookmarkButton() {
        const btn = document.getElementById('bookmarkBtn');
        if (btn) {
            const count = this.bookmarks.filter(b => b.sessionId === this.sessionId).length;
            btn.innerHTML = `🔖 ${count > 0 ? `(${count})` : ''}`;
        }
    }

    showBookmarks() {
        const sessionBookmarks = this.bookmarks.filter(b => b.sessionId === this.sessionId);

        const modal = this.createModal('Bookmarks', `
            <div class="bookmarks-list">
                ${sessionBookmarks.length === 0 ? '<p class="empty-state">No bookmarks yet. Press Ctrl+B to add one.</p>' : ''}
                ${sessionBookmarks.map(b => `
                    <div class="bookmark-item" data-id="${b.id}">
                        <div class="bookmark-header">
                            <span class="bookmark-chapter">Chapter ${b.chapter}</span>
                            <span class="bookmark-mood">${this.moodThemes[b.mood]?.icon || '😐'}</span>
                        </div>
                        <p class="bookmark-preview">${this.escapeHtml(b.preview)}</p>
                        <div class="bookmark-actions">
                            <button class="btn-small" onclick="app.jumpToBookmark(${b.id})">Jump to</button>
                            <button class="btn-small btn-danger" onclick="app.deleteBookmark(${b.id})">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);

        document.body.appendChild(modal);
    }

    jumpToBookmark(bookmarkId) {
        const bookmark = this.bookmarks.find(b => b.id === bookmarkId);
        if (bookmark) {
            const storyContent = document.getElementById('storyContent');
            const segments = storyContent?.querySelectorAll('.story-segment');
            if (segments && segments[bookmark.segmentIndex]) {
                segments[bookmark.segmentIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
                segments[bookmark.segmentIndex].classList.add('highlight-segment');
                setTimeout(() => segments[bookmark.segmentIndex].classList.remove('highlight-segment'), 2000);
            }
            this.closeAllModals();
        }
    }

    deleteBookmark(bookmarkId) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== bookmarkId);
        localStorage.setItem('storyforge-bookmarks', JSON.stringify(this.bookmarks));
        this.showNotification('Bookmark deleted', 'info');
        this.closeAllModals();
        this.showBookmarks();
    }

    // ==================== Save/Load System ====================
    saveCurrentStory() {
        if (this.storySegments.length === 0) {
            this.showNotification('No story to save', 'error');
            return;
        }

        const storyData = {
            id: this.sessionId,
            title: this.generateStoryTitle(),
            segments: this.storySegments,
            responses: this.responses,
            chapter: this.currentChapter,
            mood: this.currentMood,
            characters: this.characters,
            timestamp: new Date().toISOString(),
            wordCount: this.storySegments.join(' ').split(/\s+/).length
        };

        // Update or add story
        const existingIndex = this.savedStories.findIndex(s => s.id === this.sessionId);
        if (existingIndex >= 0) {
            this.savedStories[existingIndex] = storyData;
        } else {
            this.savedStories.push(storyData);
        }

        localStorage.setItem('storyforge-stories', JSON.stringify(this.savedStories));
        this.playSound('success');
        this.showNotification('Story saved!', 'success');
    }

    generateStoryTitle() {
        if (this.responses['setting_type']) {
            return `${this.responses['setting_type']} Adventure`;
        }
        return `Story ${new Date().toLocaleDateString()}`;
    }

    loadSavedStories() {
        this.savedStories = JSON.parse(localStorage.getItem('storyforge-stories') || '[]');
    }

    showSavedStories() {
        const modal = this.createModal('Saved Stories', `
            <div class="saved-stories-list">
                ${this.savedStories.length === 0 ? '<p class="empty-state">No saved stories. Press Ctrl+S to save your current story.</p>' : ''}
                ${this.savedStories.map(s => `
                    <div class="saved-story-item" data-id="${s.id}">
                        <div class="story-item-header">
                            <h4>${this.escapeHtml(s.title)}</h4>
                            <span class="story-date">${new Date(s.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div class="story-item-meta">
                            <span>📖 ${s.chapter} chapters</span>
                            <span>📝 ${s.wordCount} words</span>
                            <span>${this.moodThemes[s.mood]?.icon || '😐'} ${s.mood}</span>
                        </div>
                        <div class="story-item-actions">
                            <button class="btn-small btn-primary" onclick="app.loadStory('${s.id}')">Load</button>
                            <button class="btn-small btn-danger" onclick="app.deleteStory('${s.id}')">Delete</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `);

        document.body.appendChild(modal);
    }

    async loadStory(storyId) {
        const story = this.savedStories.find(s => s.id === storyId);
        if (!story) return;

        this.sessionId = story.id;
        this.storySegments = story.segments;
        this.responses = story.responses;
        this.currentChapter = story.chapter;
        this.currentMood = story.mood;
        this.characters = story.characters || [];

        // Rebuild story display
        this.showSection('story');
        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            storyContent.innerHTML = story.segments.map((seg, i) => `
                <div class="story-segment" data-index="${i}">
                    <p>${this.escapeHtml(seg)}</p>
                </div>
                ${i < story.segments.length - 1 ? '<div class="story-divider">• • •</div>' : ''}
            `).join('');
        }

        this.updateMoodIndicator(story.mood);
        this.updateStats();
        this.closeAllModals();
        this.showNotification('Story loaded!', 'success');
    }

    deleteStory(storyId) {
        this.savedStories = this.savedStories.filter(s => s.id !== storyId);
        localStorage.setItem('storyforge-stories', JSON.stringify(this.savedStories));
        this.showNotification('Story deleted', 'info');
        this.closeAllModals();
        this.showSavedStories();
    }

    // ==================== Undo/Redo System ====================
    saveState() {
        this.undoStack.push({
            segments: [...this.storySegments],
            chapter: this.currentChapter,
            mood: this.currentMood
        });
        this.redoStack = []; // Clear redo stack on new action
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) {
            this.showNotification('Nothing to undo', 'info');
            return;
        }

        // Save current state to redo stack
        this.redoStack.push({
            segments: [...this.storySegments],
            chapter: this.currentChapter,
            mood: this.currentMood
        });

        // Restore previous state
        const prevState = this.undoStack.pop();
        this.storySegments = prevState.segments;
        this.currentChapter = prevState.chapter;
        this.currentMood = prevState.mood;

        this.refreshStoryDisplay();
        this.updateUndoRedoButtons();
        this.showNotification('Undone!', 'info');
    }

    redo() {
        if (this.redoStack.length === 0) {
            this.showNotification('Nothing to redo', 'info');
            return;
        }

        // Save current state to undo stack
        this.undoStack.push({
            segments: [...this.storySegments],
            chapter: this.currentChapter,
            mood: this.currentMood
        });

        // Restore next state
        const nextState = this.redoStack.pop();
        this.storySegments = nextState.segments;
        this.currentChapter = nextState.chapter;
        this.currentMood = nextState.mood;

        this.refreshStoryDisplay();
        this.updateUndoRedoButtons();
        this.showNotification('Redone!', 'info');
    }

    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    refreshStoryDisplay() {
        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            storyContent.innerHTML = this.storySegments.map((seg, i) => `
                <div class="story-segment" data-index="${i}">
                    <p>${this.escapeHtml(seg)}</p>
                </div>
                ${i < this.storySegments.length - 1 ? '<div class="story-divider">• • •</div>' : ''}
            `).join('');
        }
        this.updateStats();
        this.updateMoodIndicator(this.currentMood);
    }

    // ==================== Story History ====================
    addToHistory(action, data) {
        this.storyHistory.push({
            action,
            data,
            timestamp: new Date().toISOString(),
            chapter: this.currentChapter
        });
    }

    showStoryHistory() {
        const modal = this.createModal('Story Journey', `
            <div class="story-history">
                <div class="history-timeline">
                    ${this.storyHistory.map((h, i) => `
                        <div class="history-item ${h.action}">
                            <div class="history-marker">${i + 1}</div>
                            <div class="history-content">
                                <span class="history-action">${this.formatHistoryAction(h.action)}</span>
                                <span class="history-time">${new Date(h.timestamp).toLocaleTimeString()}</span>
                                ${h.data?.choice ? `<p class="history-choice">"${this.escapeHtml(h.data.choice.substring(0, 50))}..."</p>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `);

        document.body.appendChild(modal);
    }

    formatHistoryAction(action) {
        const actions = {
            'start': '🚀 Story Started',
            'choice': '🎯 Made Choice',
            'chapter': '📖 New Chapter',
            'bookmark': '🔖 Bookmarked',
            'mood_change': '🎭 Mood Shifted'
        };
        return actions[action] || action;
    }

    // ==================== Story Branching Visualization ====================
    showBranchVisualization() {
        const modal = this.createModal('Story Path', `
            <div class="branch-visualization">
                <svg id="branchSvg" class="branch-svg"></svg>
                <div class="branch-legend">
                    <span class="legend-item"><span class="dot current"></span> Current Path</span>
                    <span class="legend-item"><span class="dot choice"></span> Choice Made</span>
                </div>
            </div>
        `);

        document.body.appendChild(modal);
        this.drawBranchTree();
    }

    drawBranchTree() {
        const svg = document.getElementById('branchSvg');
        if (!svg) return;

        const width = svg.clientWidth || 400;
        const height = Math.max(300, this.storyHistory.length * 60);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        let y = 40;
        let html = '';

        this.storyHistory.forEach((h, i) => {
            const x = width / 2;
            const color = h.action === 'choice' ? '#a855f7' : '#6366f1';

            // Node
            html += `<circle cx="${x}" cy="${y}" r="12" fill="${color}" class="branch-node"/>`;
            html += `<text x="${x + 25}" y="${y + 5}" class="branch-label">${this.formatHistoryAction(h.action)}</text>`;

            // Connection line
            if (i > 0) {
                html += `<line x1="${x}" y1="${y - 40}" x2="${x}" y2="${y - 12}" stroke="${color}" stroke-width="2"/>`;
            }

            y += 60;
        });

        svg.innerHTML = html;
    }

    // ==================== Character System ====================
    extractCharacters(text) {
        // Simple character extraction - looks for capitalized names
        const namePattern = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\b/g;
        const excludeWords = new Set(['The', 'This', 'That', 'Then', 'When', 'What', 'Where', 'Who', 'How', 'But', 'And', 'For', 'With']);

        const matches = text.match(namePattern) || [];
        const names = matches.filter(name => !excludeWords.has(name) && name.length > 2);

        names.forEach(name => {
            if (!this.characters.find(c => c.name === name)) {
                this.characters.push({
                    name,
                    firstAppearance: this.currentChapter,
                    portrait: this.generateCharacterPortrait(name)
                });
            }
        });

        this.updateCharacterPanel();
    }

    generateCharacterPortrait(name) {
        // Generate a consistent color based on name
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }

    updateCharacterPanel() {
        const panel = document.getElementById('characterPanel');
        if (!panel) return;

        if (this.characters.length === 0) {
            panel.innerHTML = '<p class="empty-characters">Characters will appear as your story unfolds...</p>';
            return;
        }

        panel.innerHTML = this.characters.map(c => `
            <div class="character-card">
                <div class="character-avatar" style="background: ${c.portrait}">
                    ${c.name.charAt(0)}
                </div>
                <div class="character-info">
                    <span class="character-name">${this.escapeHtml(c.name)}</span>
                    <span class="character-chapter">Ch. ${c.firstAppearance}</span>
                </div>
            </div>
        `).join('');
    }

    // ==================== Export System ====================
    showExportOptions() {
        const modal = this.createModal('Export Story', `
            <div class="export-options">
                <button class="export-btn" onclick="app.downloadAs('txt')">
                    <span class="export-icon">📄</span>
                    <span class="export-label">Plain Text (.txt)</span>
                </button>
                <button class="export-btn" onclick="app.downloadAs('html')">
                    <span class="export-icon">🌐</span>
                    <span class="export-label">Web Page (.html)</span>
                </button>
                <button class="export-btn" onclick="app.downloadAs('md')">
                    <span class="export-icon">📝</span>
                    <span class="export-label">Markdown (.md)</span>
                </button>
                <button class="export-btn" onclick="app.downloadAs('json')">
                    <span class="export-icon">📦</span>
                    <span class="export-label">JSON Data (.json)</span>
                </button>
                <button class="export-btn" onclick="app.copyToClipboard()">
                    <span class="export-icon">📋</span>
                    <span class="export-label">Copy to Clipboard</span>
                </button>
            </div>
        `);

        document.body.appendChild(modal);
    }

    downloadAs(format) {
        const title = this.generateStoryTitle();
        let content, mimeType, extension;

        switch (format) {
            case 'txt':
                content = `${title}\n${'='.repeat(title.length)}\n\n${this.storySegments.join('\n\n---\n\n')}`;
                mimeType = 'text/plain';
                extension = 'txt';
                break;

            case 'html':
                content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>${this.escapeHtml(title)}</title>
    <style>
        body { font-family: Georgia, serif; max-width: 800px; margin: 40px auto; padding: 20px; line-height: 1.8; }
        h1 { text-align: center; color: #6366f1; }
        .segment { margin: 2em 0; }
        .divider { text-align: center; color: #999; margin: 2em 0; }
        .chapter { font-size: 1.5em; color: #8b5cf6; margin: 2em 0; text-align: center; }
    </style>
</head>
<body>
    <h1>${this.escapeHtml(title)}</h1>
    ${this.storySegments.map(seg => `<div class="segment"><p>${this.escapeHtml(seg)}</p></div><div class="divider">• • •</div>`).join('')}
    <p style="text-align: center; color: #666; margin-top: 3em;">Generated by StoryForge AI</p>
</body>
</html>`;
                mimeType = 'text/html';
                extension = 'html';
                break;

            case 'md':
                content = `# ${title}\n\n${this.storySegments.map((seg, i) => `## Part ${i + 1}\n\n${seg}`).join('\n\n---\n\n')}\n\n---\n*Generated by StoryForge AI*`;
                mimeType = 'text/markdown';
                extension = 'md';
                break;

            case 'json':
                content = JSON.stringify({
                    title,
                    segments: this.storySegments,
                    responses: this.responses,
                    characters: this.characters,
                    mood: this.currentMood,
                    chapters: this.currentChapter,
                    exportedAt: new Date().toISOString()
                }, null, 2);
                mimeType = 'application/json';
                extension = 'json';
                break;
        }

        this.downloadFile(content, `${title.replace(/\s+/g, '_')}.${extension}`, mimeType);
        this.closeAllModals();
        this.showNotification(`Exported as ${extension.toUpperCase()}!`, 'success');
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async copyToClipboard() {
        const text = this.storySegments.join('\n\n---\n\n');
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Story copied to clipboard!', 'success');
        } catch (err) {
            this.showNotification('Failed to copy', 'error');
        }
        this.closeAllModals();
    }

    // ==================== Modal System ====================
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="app.closeAllModals()">×</button>
                </div>
                <div class="modal-content">
                    ${content}
                </div>
            </div>
        `;
        return modal;
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
    }

    // ==================== Original Functionality (Enhanced) ====================
    async checkLLMStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();

            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');

            if (data.llm_available) {
                statusDot?.classList.add('online');
                statusText.textContent = `✓ Connected to ${data.model}`;
            } else {
                statusDot?.classList.remove('online');
                statusText.textContent = '⚠ AI Offline - Start Ollama';
                this.showNotification('Start Ollama to generate stories: ollama serve', 'error');
            }
        } catch (error) {
            console.error('Status check failed:', error);
            document.getElementById('statusText').textContent = '⚠ Connection Error';
        }
    }

    confirmNewStory() {
        if (this.storySegments.length > 0) {
            const modal = this.createModal('Start New Story?', `
                <p>You have an ongoing story. Do you want to save it before starting a new one?</p>
                <div class="modal-actions">
                    <button class="btn btn-ghost" onclick="app.closeAllModals(); app.startNewSession();">Don't Save</button>
                    <button class="btn btn-primary" onclick="app.saveCurrentStory(); app.closeAllModals(); app.startNewSession();">Save & Start New</button>
                </div>
            `);
            document.body.appendChild(modal);
        } else {
            this.startNewSession();
        }
    }

    async startNewSession() {
        try {
            const response = await fetch('/api/session/new', { method: 'POST' });
            const data = await response.json();

            this.sessionId = data.session_id;
            this.responses = {};
            this.storySegments = [];
            this.questionIndex = 0;
            this.currentChapter = 1;
            this.undoStack = [];
            this.redoStack = [];
            this.storyHistory = [];
            this.characters = [];
            this.currentMood = 'neutral';

            // Reset UI
            this.showSection('question');
            await this.loadNextQuestion();
            this.updateUndoRedoButtons();
            this.updateMoodIndicator('neutral');
            this.updateCharacterPanel();

            this.addToHistory('start', {});
            this.playSound('success');
            this.showNotification('New story session started!', 'success');
        } catch (error) {
            console.error('Session creation failed:', error);
            this.showNotification('Failed to start session', 'error');
        }
    }

    async loadNextQuestion(currentId = null) {
        try {
            const url = currentId ? `/api/question/next?current_id=${currentId}` : '/api/question/next';
            const response = await fetch(url);
            const data = await response.json();

            if (data.completed) {
                await this.generateStory();
                return;
            }

            this.currentQuestionId = data.question.id;
            this.currentPhase = data.question.phase;
            this.questionIndex++;

            this.renderQuestion(data.question);
            this.updateProgress(data.progress);

        } catch (error) {
            console.error('Failed to load question:', error);
            this.showNotification('Failed to load question', 'error');
        }
    }

    renderQuestion(question) {
        const phaseBadge = document.getElementById('phaseBadge');
        if (phaseBadge) {
            phaseBadge.textContent = this.phaseNames[question.phase] || question.phase;
        }

        const questionNumber = document.getElementById('questionNumber');
        if (questionNumber) {
            questionNumber.textContent = `Question ${this.questionIndex}`;
        }

        const questionText = document.getElementById('questionText');
        if (questionText) {
            questionText.textContent = question.text;
        }

        const optionsContainer = document.getElementById('optionsContainer');
        const textInputContainer = document.getElementById('textInputContainer');

        if (question.options && question.options.length > 0) {
            optionsContainer.style.display = 'grid';
            textInputContainer.classList.remove('active');

            optionsContainer.innerHTML = question.options.map((option) => `
                <button class="option-btn" data-value="${this.escapeHtml(option)}" onclick="app.selectOption(this)">
                    ${this.escapeHtml(option)}
                </button>
            `).join('');
        } else {
            optionsContainer.style.display = 'none';
            textInputContainer.classList.add('active');

            const textInput = document.getElementById('textInput');
            if (textInput) {
                textInput.value = '';
                textInput.focus();
            }
        }

        this.updateNextButtonState();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    selectOption(button) {
        document.querySelectorAll('.option-btn').forEach(btn => btn.classList.remove('selected'));
        button.classList.add('selected');
        this.playSound('click');
        this.updateNextButtonState();
    }

    updateNextButtonState() {
        const nextBtn = document.getElementById('nextBtn');
        if (!nextBtn) return;

        const selectedOption = document.querySelector('.option-btn.selected');
        const textInput = document.getElementById('textInput');
        const textInputContainer = document.getElementById('textInputContainer');

        let hasAnswer = false;
        if (textInputContainer?.classList.contains('active')) {
            hasAnswer = textInput?.value.trim().length > 0;
        } else {
            hasAnswer = selectedOption !== null;
        }

        nextBtn.disabled = !hasAnswer;
    }

    async handleNext() {
        let answer = '';

        const selectedOption = document.querySelector('.option-btn.selected');
        const textInput = document.getElementById('textInput');
        const textInputContainer = document.getElementById('textInputContainer');

        if (textInputContainer?.classList.contains('active')) {
            answer = textInput?.value.trim() || '';
        } else if (selectedOption) {
            answer = selectedOption.dataset.value;
        }

        if (!answer) return;

        this.responses[this.currentQuestionId] = answer;
        this.playSound('click');

        try {
            await fetch('/api/response', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    question_id: this.currentQuestionId,
                    answer: answer
                })
            });

            await this.loadNextQuestion(this.currentQuestionId);

        } catch (error) {
            console.error('Failed to submit response:', error);
            this.showNotification('Failed to save answer', 'error');
        }
    }

    handleBack() {
        this.showNotification('Going back...', 'info');
    }

    updateProgress(progress) {
        const progressFill = document.getElementById('progressFill');
        const progressCurrent = document.getElementById('progressCurrent');
        const progressTotal = document.getElementById('progressTotal');

        if (progressFill) progressFill.style.width = `${progress.percentage}%`;
        if (progressCurrent) progressCurrent.textContent = progress.answered;
        if (progressTotal) progressTotal.textContent = progress.total;
    }

    async generateStory() {
        this.showLoading(true, 'Crafting your story...');

        try {
            const response = await fetch('/api/story/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    responses: this.responses
                })
            });

            const data = await response.json();

            if (data.error) throw new Error(data.error);

            await this.displayStory(data);
            this.playSound('success');
            this.showNotification('Your story is ready!', 'success');

        } catch (error) {
            console.error('Story generation failed:', error);
            this.showNotification(`Generation failed: ${error.message}`, 'error');
            this.showSection('question');
        } finally {
            this.showLoading(false);
        }
    }

    async displayStory(data) {
        this.showSection('story');

        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            storyContent.innerHTML = '';

            // Add chapter marker for first chapter
            const chapterMarker = document.createElement('div');
            chapterMarker.className = 'chapter-marker';
            chapterMarker.innerHTML = `
                <div class="chapter-number">Chapter 1</div>
                <div class="chapter-title">The Beginning</div>
                <div class="chapter-divider"></div>
            `;
            storyContent.appendChild(chapterMarker);

            // Add story content with typing animation
            const contentDiv = document.createElement('div');
            contentDiv.className = 'story-segment';
            storyContent.appendChild(contentDiv);

            if (this.isTypingEnabled && data.content) {
                await this.typeText(contentDiv, data.html_content || `<p>${this.escapeHtml(data.content)}</p>`);
            } else {
                contentDiv.innerHTML = data.html_content || `<p>${this.escapeHtml(data.content)}</p>`;
            }
        }

        this.updateStats(data);
        this.storySegments.push(data.content);
        this.saveState();

        // Analyze mood and characters
        const mood = this.analyzeMood(data.content);
        this.updateMoodIndicator(mood);
        this.extractCharacters(data.content);

        if (data.choices?.length > 0) {
            this.displayChoices(data.choices);
        }
    }

    updateStats(data) {
        const wordCount = data?.word_count || this.storySegments.join(' ').split(/\s+/).length;
        const segmentCount = data?.segment_count || this.storySegments.length;

        document.getElementById('wordCount').textContent = wordCount;
        document.getElementById('segmentCount').textContent = segmentCount;
    }

    displayChoices(choices) {
        const storyChoices = document.getElementById('storyChoices');
        if (!storyChoices) return;

        storyChoices.innerHTML = `
            <div class="choices-title">What happens next?</div>
        `;

        choices.forEach((choice) => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice;
            btn.addEventListener('click', () => this.selectChoice(choice));
            storyChoices.appendChild(btn);
        });

        const customBtn = document.createElement('button');
        customBtn.className = 'choice-btn custom-choice';
        customBtn.textContent = '✏️ Write your own direction...';
        customBtn.addEventListener('click', () => this.showCustomInput());
        storyChoices.appendChild(customBtn);

        storyChoices.style.display = 'block';
    }

    async selectChoice(choice) {
        if (!this.sessionId) {
            this.showNotification('Session expired. Please start a new story.', 'error');
            return;
        }

        this.saveState();
        this.addToHistory('choice', { choice });
        this.showLoading(true, 'Continuing your story...');
        this.playSound('click');

        try {
            const response = await fetch('/api/story/continue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    user_choice: choice
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }

            const data = await response.json();
            if (data.error) throw new Error(data.error);

            await this.appendToStory(data);

            // Check if we should add a chapter marker (every 3 segments)
            if (this.storySegments.length % 3 === 0) {
                this.addChapterMarker();
            }

        } catch (error) {
            console.error('Continue failed:', error);
            this.showNotification(`Failed to continue: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async appendToStory(data) {
        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            const divider = document.createElement('div');
            divider.className = 'story-divider';
            divider.textContent = '• • •';
            storyContent.appendChild(divider);

            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'story-segment';
            segmentDiv.dataset.index = this.storySegments.length;
            storyContent.appendChild(segmentDiv);

            if (this.isTypingEnabled && data.content) {
                await this.typeText(segmentDiv, data.html_content || `<p>${this.escapeHtml(data.content)}</p>`);
            } else {
                segmentDiv.innerHTML = data.html_content || `<p>${this.escapeHtml(data.content)}</p>`;
            }
        }

        this.storySegments.push(data.content);
        this.updateStats(data);

        // Analyze mood and characters
        const mood = this.analyzeMood(data.content);
        if (mood !== this.currentMood) {
            this.addToHistory('mood_change', { from: this.currentMood, to: mood });
        }
        this.updateMoodIndicator(mood);
        this.extractCharacters(data.content);

        if (data.choices?.length > 0) {
            this.displayChoices(data.choices);
        }

        storyContent.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    showCustomInput() {
        const storyChoices = document.getElementById('storyChoices');
        if (!storyChoices) return;

        storyChoices.innerHTML = `
            <div class="choices-title">What would you like to happen?</div>
            <textarea id="customChoice" class="text-input" rows="3"
                placeholder="Describe what you want to happen next..."></textarea>
            <div class="nav-buttons" style="margin-top: 16px;">
                <button class="btn btn-ghost" onclick="app.showContinueOptions()">Cancel</button>
                <button class="btn btn-primary" onclick="app.submitCustomChoice()">Continue Story</button>
            </div>
        `;

        document.getElementById('customChoice')?.focus();
    }

    showContinueOptions() {
        const defaultChoices = [
            "Continue with more action and adventure",
            "Develop the characters and relationships",
            "Introduce a surprising twist",
            "Build towards the climax"
        ];
        this.displayChoices(defaultChoices);
    }

    submitCustomChoice() {
        const input = document.getElementById('customChoice');
        const choice = input?.value.trim();
        if (choice) this.selectChoice(choice);
    }

    downloadStory() {
        this.showExportOptions();
    }

    showLoading(show, message = 'Loading...') {
        const loadingSection = document.getElementById('loadingSection');
        const loadingText = document.getElementById('loadingText');

        if (show) {
            document.getElementById('questionSection')?.classList.add('hidden');
            document.getElementById('storySection')?.classList.remove('active');
            loadingSection?.classList.add('active');
            if (loadingText) loadingText.textContent = message;
        } else {
            loadingSection?.classList.remove('active');
            if (this.storySegments && this.storySegments.length > 0) {
                document.getElementById('storySection')?.classList.add('active');
            }
        }
    }

    showSection(section) {
        const questionSection = document.getElementById('questionSection');
        const storySection = document.getElementById('storySection');
        const loadingSection = document.getElementById('loadingSection');

        questionSection?.classList.remove('hidden');
        storySection?.classList.remove('active');
        loadingSection?.classList.remove('active');

        if (section === 'question') {
            questionSection?.classList.remove('hidden');
        } else if (section === 'story') {
            questionSection?.classList.add('hidden');
            storySection?.classList.add('active');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = notification?.querySelector('.notification-text');
        const notificationIcon = notification?.querySelector('.notification-icon');

        if (!notification) return;

        const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
        if (notificationIcon) notificationIcon.textContent = icons[type] || 'ℹ️';
        if (notificationText) notificationText.textContent = message;

        notification.className = `notification ${type} show`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 4000);
    }

    openSettings() {
        document.getElementById('settingsPanel')?.classList.add('active');
        document.getElementById('settingsOverlay')?.classList.add('active');
    }

    closeSettings() {
        document.getElementById('settingsPanel')?.classList.remove('active');
        document.getElementById('settingsOverlay')?.classList.remove('active');
    }

    async saveSettings() {
        const settings = {
            provider: document.getElementById('llmProvider')?.value,
            model: document.getElementById('modelName')?.value,
            temperature: parseFloat(document.getElementById('temperature')?.value),
            api_key: document.getElementById('apiKey')?.value
        };

        try {
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            this.showNotification('Settings saved!', 'success');
            this.closeSettings();
            await this.checkLLMStatus();

        } catch (error) {
            this.showNotification('Failed to save settings', 'error');
        }
    }
}

// Initialize the app
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new StoryForgeApp();
});
