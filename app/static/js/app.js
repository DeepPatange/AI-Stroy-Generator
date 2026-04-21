/**
 * StoryForge AI - Enhanced Interactive Storytelling Application
 * All questions on one page with question count selector
 */

class StoryForgeApp {
    constructor() {
        // Core state
        this.sessionId = null;
        this.responses = {};
        this.storySegments = [];
        this.isGenerating = false;
        this.allQuestions = [];
        this.questionCount = 12;

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

        this.audioContext = null;
        this.ambientSound = null;

        // Narration (TTS)
        this.narration = { utter: null, playing: false, queue: [], index: 0 };

        // Image generation
        this.imageCache = {};

        // Ambient music
        this.isAmbientEnabled = localStorage.getItem('storyforge-ambient') !== 'false';
        this.ambient = { audio: null, currentGenre: null, fadeTimer: null };

        this.phaseNames = {
            'setting': 'World Building',
            'character': 'Characters',
            'theme': 'Theme & Genre',
            'plot': 'Plot Structure',
            'continuation': 'Story Time'
        };

        this.phaseIcons = {
            'setting': '\uD83C\uDF0D',
            'character': '\uD83D\uDC64',
            'theme': '\uD83C\uDFAD',
            'plot': '\uD83D\uDCD6'
        };

        this.moodThemes = {
            'neutral': { color: '#6366f1', icon: '\uD83D\uDE10', sound: 'ambient' },
            'happy': { color: '#22c55e', icon: '\uD83D\uDE0A', sound: 'upbeat' },
            'sad': { color: '#3b82f6', icon: '\uD83D\uDE22', sound: 'melancholy' },
            'tense': { color: '#ef4444', icon: '\uD83D\uDE30', sound: 'suspense' },
            'romantic': { color: '#ec4899', icon: '\uD83D\uDC95', sound: 'romantic' },
            'mysterious': { color: '#8b5cf6', icon: '\uD83D\uDD2E', sound: 'mystery' },
            'adventurous': { color: '#f59e0b', icon: '\u2694\uFE0F', sound: 'adventure' }
        };

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
        // Show landing page by default
        this.showLanding();
    }

    // ==================== Landing Page ====================
    showLanding() {
        document.getElementById('landingSection').classList.remove('hidden');
        document.getElementById('allQuestionsSection')?.classList.add('hidden');
        document.getElementById('storySection')?.classList.remove('active');
        document.getElementById('loadingSection')?.classList.remove('active');
    }

    setQuestionCount(count, btn) {
        this.questionCount = count;
        document.querySelectorAll('.count-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.playSound('click');
    }

    async startQuestionnaire() {
        try {
            this.stopNarration?.();
            this.stopAmbient?.();
            // Create session
            const sessionRes = await fetch('/api/session/new', { method: 'POST' });
            const sessionData = await sessionRes.json();
            this.sessionId = sessionData.session_id;
            this.responses = {};
            this.storySegments = [];
            this.storyHistory = [];
            this.characters = [];
            this.customQuestions = [];
            this.currentChapter = 1;
            this.currentMood = 'neutral';

            // Fetch all questions
            const questionsRes = await fetch('/api/questions/all');
            const questionsData = await questionsRes.json();

            // Flatten and limit questions
            this.allQuestions = [];
            const phaseOrder = ['setting', 'character', 'theme', 'plot'];
            for (const phase of phaseOrder) {
                const phaseQuestions = questionsData.phases[phase] || [];
                this.allQuestions.push(...phaseQuestions);
            }

            // Limit to selected count
            const visibleQuestions = this.allQuestions.slice(0, this.questionCount);

            // Render all questions
            this.renderAllQuestions(visibleQuestions);

            // Switch view
            document.getElementById('landingSection').classList.add('hidden');
            document.getElementById('allQuestionsSection').classList.remove('hidden');

            // Update progress
            document.getElementById('progressTotal').textContent = visibleQuestions.length;
            this.updateFormProgress();

            this.playSound('success');
            this.addToHistory('start', {});

        } catch (error) {
            console.error('Failed to start:', error);
            this.showNotification('Failed to start session', 'error');
        }
    }

    renderAllQuestions(questions) {
        const form = document.getElementById('questionsForm');
        let currentPhase = '';
        let html = '';

        questions.forEach((q, index) => {
            // Phase header
            if (q.phase !== currentPhase) {
                currentPhase = q.phase;
                html += `
                    <div class="phase-header">
                        <span class="phase-icon">${this.phaseIcons[q.phase] || ''}</span>
                        <span class="phase-name">${this.phaseNames[q.phase] || q.phase}</span>
                    </div>
                `;
            }

            html += `
                <div class="question-card" data-question-id="${q.id}" data-index="${index}">
                    <div class="question-number-badge">${index + 1}</div>
                    <h3 class="question-text">${this.escapeHtml(q.text)}</h3>
            `;

            if (q.options && q.options.length > 0) {
                html += `<div class="options-grid">`;
                q.options.forEach(option => {
                    html += `
                        <button type="button" class="option-btn"
                            data-question="${q.id}"
                            data-value="${this.escapeHtml(option)}"
                            onclick="app.selectQuestionOption(this)">
                            ${this.escapeHtml(option)}
                        </button>
                    `;
                });
                html += `
                    <button type="button" class="option-btn option-btn-custom"
                        data-question="${q.id}"
                        onclick="app.toggleCustomAnswer('${q.id}', this)">
                        ✎ Write my own
                    </button>
                `;
                html += `</div>`;
                html += `
                    <div class="custom-answer-container hidden" data-custom-for="${q.id}">
                        <textarea class="text-input" data-custom-question="${q.id}"
                            rows="2" placeholder="Type your own answer..."
                            oninput="app.handleCustomAnswerInput(this)"></textarea>
                    </div>
                `;
            } else {
                html += `
                    <div class="text-input-container active">
                        <textarea class="text-input" data-question="${q.id}"
                            rows="2" placeholder="Type your answer here..."
                            oninput="app.handleTextInput(this)"></textarea>
                    </div>
                `;
            }

            html += `</div>`;
        });

        // Custom question composer trigger (end of form)
        html += `
            <div class="custom-q-section">
                <div class="custom-q-divider">Have something specific in mind?</div>
                <div id="customQuestionsList"></div>
                <button type="button" class="btn btn-ghost add-custom-q-btn" onclick="app.openCustomQuestionComposer()">
                    + Add Your Own Question
                </button>
                <div class="custom-q-composer hidden" id="customQuestionComposer">
                    <input type="text" class="setting-input" id="customQText" placeholder="Your question (e.g., 'Should the ending be ambiguous?')">
                    <textarea class="text-input" id="customQAnswer" rows="2" placeholder="Your answer or preference..."></textarea>
                    <div class="custom-q-actions">
                        <button type="button" class="btn btn-ghost" onclick="app.cancelCustomQuestion()">Cancel</button>
                        <button type="button" class="btn btn-primary" onclick="app.saveCustomQuestion()">Add</button>
                    </div>
                </div>
            </div>
        `;

        form.innerHTML = html;
    }

    selectQuestionOption(btn) {
        const questionId = btn.dataset.question;
        document.querySelectorAll(`.option-btn[data-question="${questionId}"]`)
            .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        document.querySelector(`.custom-answer-container[data-custom-for="${questionId}"]`)?.classList.add('hidden');

        this.responses[questionId] = btn.dataset.value;
        this.playSound('click');
        this.updateFormProgress();
    }

    handleTextInput(textarea) {
        const questionId = textarea.dataset.question;
        const value = textarea.value.trim();
        if (value) {
            this.responses[questionId] = value;
        } else {
            delete this.responses[questionId];
        }
        this.updateFormProgress();
    }

    // ==================== Custom Answer ====================
    toggleCustomAnswer(questionId, btn) {
        const container = document.querySelector(`.custom-answer-container[data-custom-for="${questionId}"]`);
        if (!container) return;
        const isActive = btn.classList.toggle('selected');
        container.classList.toggle('hidden', !isActive);
        if (isActive) {
            document.querySelectorAll(`.option-btn[data-question="${questionId}"]`)
                .forEach(b => { if (b !== btn) b.classList.remove('selected'); });
            const ta = container.querySelector('textarea');
            ta?.focus();
            const existing = ta?.value.trim();
            if (existing) this.responses[questionId] = existing;
            else delete this.responses[questionId];
        } else {
            delete this.responses[questionId];
        }
        this.playSound('click');
        this.updateFormProgress();
    }

    handleCustomAnswerInput(textarea) {
        const questionId = textarea.dataset.customQuestion;
        const value = textarea.value.trim();
        if (value) this.responses[questionId] = value;
        else delete this.responses[questionId];
        this.updateFormProgress();
    }

    // ==================== Custom Questions ====================
    openCustomQuestionComposer() {
        const composer = document.getElementById('customQuestionComposer');
        const trigger = document.querySelector('.add-custom-q-btn');
        if (!composer) return;
        composer.classList.remove('hidden');
        trigger?.classList.add('hidden');
        document.getElementById('customQText')?.focus();
    }

    cancelCustomQuestion() {
        const composer = document.getElementById('customQuestionComposer');
        const trigger = document.querySelector('.add-custom-q-btn');
        composer?.classList.add('hidden');
        trigger?.classList.remove('hidden');
        const qt = document.getElementById('customQText');
        const qa = document.getElementById('customQAnswer');
        if (qt) qt.value = '';
        if (qa) qa.value = '';
    }

    saveCustomQuestion() {
        const qt = document.getElementById('customQText');
        const qa = document.getElementById('customQAnswer');
        const question = qt?.value.trim();
        const answer = qa?.value.trim();
        if (!question || !answer) {
            this.showNotification('Please enter both a question and answer', 'error');
            return;
        }
        const n = (this.customQuestions ||= []).length + 1;
        const id = `custom_q_${n}`;
        const combined = `${question} -> ${answer}`;
        this.customQuestions.push({ id, question, answer });
        this.responses[id] = combined;

        const list = document.getElementById('customQuestionsList');
        if (list) {
            const card = document.createElement('div');
            card.className = 'custom-q-card';
            card.dataset.id = id;
            card.innerHTML = `
                <div class="custom-q-badge">Your Q</div>
                <div class="custom-q-body">
                    <div class="custom-q-question">${this.escapeHtml(question)}</div>
                    <div class="custom-q-answer">${this.escapeHtml(answer)}</div>
                </div>
                <button type="button" class="custom-q-remove" title="Remove">×</button>
            `;
            card.querySelector('.custom-q-remove').addEventListener('click', () => this.removeCustomQuestion(id));
            list.appendChild(card);
        }

        this.cancelCustomQuestion();
        this.playSound('success');
        this.updateFormProgress();
    }

    removeCustomQuestion(id) {
        this.customQuestions = (this.customQuestions || []).filter(c => c.id !== id);
        delete this.responses[id];
        document.querySelector(`.custom-q-card[data-id="${id}"]`)?.remove();
        this.updateFormProgress();
    }

    updateFormProgress() {
        const baseCount = Math.min(this.questionCount, this.allQuestions.length);
        const customCount = (this.customQuestions || []).length;
        const total = baseCount + customCount;
        const answered = Object.keys(this.responses).length;
        const percentage = Math.min(100, Math.round((answered / total) * 100));

        document.getElementById('progressCurrent').textContent = answered;
        document.getElementById('progressTotal').textContent = total;
        document.getElementById('progressFill').style.width = `${percentage}%`;

        const generateBtn = document.getElementById('generateBtn');
        if (generateBtn) {
            generateBtn.disabled = answered < Math.ceil(baseCount / 2);
        }
    }

    backToLanding() {
        document.getElementById('allQuestionsSection').classList.add('hidden');
        document.getElementById('landingSection').classList.remove('hidden');
    }

    async submitAllAndGenerate() {
        if (this.isGenerating) return;
        this.isGenerating = true;

        // Submit all responses to backend
        try {
            for (const [questionId, answer] of Object.entries(this.responses)) {
                await fetch('/api/response', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        session_id: this.sessionId,
                        question_id: questionId,
                        answer: answer
                    })
                });
            }

            // Generate story
            this.showLoading(true, 'Crafting your story...');
            document.getElementById('allQuestionsSection').classList.add('hidden');

            const response = await fetch('/api/story/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: this.sessionId,
                    responses: this.responses
                })
            });

            const data = await response.json();
            if (data.detail) throw new Error(data.detail);

            await this.displayStory(data);
            this.playSound('success');
            this.showNotification('Your story is ready!', 'success');

        } catch (error) {
            console.error('Generation failed:', error);
            this.showNotification(`Generation failed: ${error.message}`, 'error');
            document.getElementById('allQuestionsSection').classList.remove('hidden');
        } finally {
            this.showLoading(false);
            this.isGenerating = false;
        }
    }

    // ==================== Theme System ====================
    applyTheme() {
        document.documentElement.setAttribute('data-theme', this.theme);
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.innerHTML = this.theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19';
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
        // Action buttons
        document.getElementById('newStoryBtn')?.addEventListener('click', () => this.confirmNewStory());
        document.getElementById('downloadBtn')?.addEventListener('click', () => this.showExportOptions());
        document.getElementById('continueBtn')?.addEventListener('click', () => this.showContinueOptions());

        document.getElementById('themeToggle')?.addEventListener('click', () => this.toggleTheme());
        document.getElementById('readingModeBtn')?.addEventListener('click', () => this.toggleReadingMode());
        document.getElementById('saveStoryBtn')?.addEventListener('click', () => this.saveCurrentStory());
        document.getElementById('loadStoryBtn')?.addEventListener('click', () => this.showSavedStories());
        document.getElementById('bookmarkBtn')?.addEventListener('click', () => this.addBookmark());
        document.getElementById('undoBtn')?.addEventListener('click', () => this.undo());
        document.getElementById('redoBtn')?.addEventListener('click', () => this.redo());
        document.getElementById('soundToggle')?.addEventListener('click', () => this.toggleSound());

        // New features
        document.getElementById('narrateBtn')?.addEventListener('click', () => this.toggleNarration());
        document.getElementById('ambientBtn')?.addEventListener('click', () => this.toggleAmbient());
        document.getElementById('storyMapBtn')?.addEventListener('click', () => this.showStoryMap());
        document.getElementById('charGraphBtn')?.addEventListener('click', () => this.showCharacterGraph());
        document.getElementById('adminBtn')?.addEventListener('click', () => this.showAdminPanel());

        // Reflect persisted ambient state on the button
        const amb = document.getElementById('ambientBtn');
        if (amb) {
            amb.classList.toggle('active', this.isAmbientEnabled);
            amb.title = this.isAmbientEnabled ? 'Ambient Music: On' : 'Ambient Music: Off';
        }

        // Settings
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettings')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('settingsOverlay')?.addEventListener('click', () => this.closeSettings());
        document.getElementById('saveSettings')?.addEventListener('click', () => this.saveSettings());

        document.getElementById('temperature')?.addEventListener('input', (e) => {
            const val = e.target.value;
            const labels = { '0.1': 'Very Precise', '0.2': 'Precise', '0.3': 'Focused', '0.4': 'Moderate', '0.5': 'Balanced', '0.6': 'Creative', '0.7': 'Very Creative', '0.8': 'Imaginative', '0.9': 'Wild', '1.0': 'Maximum Chaos' };
            document.getElementById('tempValue').textContent = `${val} - ${labels[val] || 'Balanced'}`;
        });

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
        if (soundBtn) soundBtn.innerHTML = this.isSoundEnabled ? '\uD83D\uDD0A' : '\uD83D\uDD07';
        if (!this.isSoundEnabled && this.ambientSound) this.stopAmbientSound();
        this.showNotification(`Sound ${this.isSoundEnabled ? 'enabled' : 'disabled'}`, 'info');
    }

    playSound(type) {
        if (!this.isSoundEnabled) return;
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);

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

    // ==================== Ambient Music (real tracks, hotlinked) ====================
    getAmbientTrack(genre) {
        // Royalty-free SoundHelix demo tracks — stable, algorithmically generated.
        const tracks = {
            fantasy:   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3',
            scifi:     'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
            mystery:   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3',
            romance:   'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
            thriller:  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
            adventure: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            horror:    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
            comedy:    'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
        };
        return tracks[genre] || tracks.adventure;
    }

    detectGenre() {
        const theme = (this.responses['theme_1'] || '').toLowerCase();
        const setting = (this.responses['setting_1'] || '').toLowerCase();
        const hay = theme + ' ' + setting;
        const map = [
            ['horror',   ['horror', 'terrifying', 'nightmare']],
            ['thriller', ['thriller', 'suspense', 'action']],
            ['mystery',  ['mystery', 'detective', 'puzzle', 'whodunit']],
            ['romance',  ['romance', 'love']],
            ['comedy',   ['comedy', 'humor', 'funny', 'witty']],
            ['scifi',    ['sci-fi', 'science fiction', 'futuristic', 'space', 'technology']],
            ['fantasy',  ['fantasy', 'magic', 'magical', 'dragon', 'castle']],
            ['adventure',['adventure', 'quest', 'explore']]
        ];
        for (const [g, kws] of map) if (kws.some(k => hay.includes(k))) return g;
        return 'adventure';
    }

    startAmbient(genre) {
        if (!this.isAmbientEnabled || !this.isSoundEnabled) return;
        if (this.ambient.currentGenre === genre && this.ambient.audio) return;
        this.stopAmbient();

        const url = this.getAmbientTrack(genre);
        const audio = new Audio(url);
        audio.loop = true;
        audio.preload = 'auto';
        audio.volume = 0;

        // Fade in over ~2.4s
        const targetVol = 0.35;
        const steps = 24;
        let step = 0;
        const fade = () => {
            step++;
            audio.volume = Math.min(targetVol, (step / steps) * targetVol);
            if (step < steps) this.ambient.fadeTimer = setTimeout(fade, 100);
        };

        const onReady = () => {
            audio.play().then(() => {
                this.ambient.fadeTimer = setTimeout(fade, 100);
                this.showNotification(`Playing ${genre} music`, 'info');
            }).catch(err => {
                console.warn('[ambient] play blocked:', err.message);
                this.showNotification('Click 🎵 after any page interaction to start music', 'info');
            });
        };

        audio.addEventListener('canplay', onReady, { once: true });
        audio.addEventListener('error', () => {
            console.warn('[ambient] failed to load:', url);
            this.showNotification('Music track failed to load', 'error');
        });

        this.ambient = { audio, currentGenre: genre, fadeTimer: null };
    }

    stopAmbient() {
        const { audio, fadeTimer } = this.ambient;
        if (fadeTimer) { clearTimeout(fadeTimer); }
        if (!audio) {
            this.ambient = { audio: null, currentGenre: null, fadeTimer: null };
            return;
        }
        // Fade out over ~0.8s
        const steps = 8;
        let step = 0;
        const startVol = audio.volume;
        const fadeOut = () => {
            step++;
            try { audio.volume = Math.max(0, startVol * (1 - step / steps)); } catch (_) {}
            if (step < steps) {
                setTimeout(fadeOut, 100);
            } else {
                try { audio.pause(); audio.src = ''; } catch (_) {}
            }
        };
        fadeOut();
        this.ambient = { audio: null, currentGenre: null, fadeTimer: null };
    }

    toggleAmbient() {
        this.isAmbientEnabled = !this.isAmbientEnabled;
        localStorage.setItem('storyforge-ambient', this.isAmbientEnabled);
        const btn = document.getElementById('ambientBtn');
        if (btn) {
            btn.classList.toggle('active', this.isAmbientEnabled);
            btn.title = this.isAmbientEnabled ? 'Ambient Music: On' : 'Ambient Music: Off';
        }
        if (!this.isAmbientEnabled) {
            this.stopAmbient();
            this.showNotification('Ambient music off', 'info');
            return;
        }
        // Ensure master sound is on — ambient needs it
        if (!this.isSoundEnabled) {
            this.isSoundEnabled = true;
            localStorage.setItem('storyforge-sound', 'true');
            const sb = document.getElementById('soundToggle');
            if (sb) sb.innerHTML = '🔊';
        }
        const genre = this.storySegments.length > 0 ? this.detectGenre() : 'fantasy';
        this.startAmbient(genre);
    }

    // Kept for backward compatibility (old sound-toggle path)
    stopAmbientSound() { this.stopAmbient(); }

    // ==================== Typing Animation ====================
    async typeText(element, text, speed = 20) {
        if (!this.isTypingEnabled) { element.innerHTML = text; return; }
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
                    element.insertBefore(document.createTextNode(char), cursor);
                    i++;
                    const variance = Math.random() * 20 - 10;
                    const charSpeed = char === ' ' ? speed * 0.5 : speed + variance;
                    if (this.isSoundEnabled && i % 5 === 0) this.playSound('typing');
                    setTimeout(typeChar, Math.max(5, charSpeed));
                } else {
                    cursor.remove();
                    element.innerHTML = text;
                    resolve();
                }
            };
            typeChar();
        });
    }

    // ==================== Mood System ====================
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
        let maxScore = 0, detectedMood = 'neutral';
        for (const [mood, keywords] of Object.entries(moodKeywords)) {
            const score = keywords.filter(kw => textLower.includes(kw)).length;
            if (score > maxScore) { maxScore = score; detectedMood = mood; }
        }
        return detectedMood;
    }

    updateMoodIndicator(mood) {
        this.currentMood = mood;
        const moodData = this.moodThemes[mood] || this.moodThemes.neutral;
        const indicator = document.getElementById('moodIndicator');
        if (indicator) {
            indicator.innerHTML = `<span class="mood-icon">${moodData.icon}</span><span class="mood-text">${mood.charAt(0).toUpperCase() + mood.slice(1)}</span>`;
            indicator.style.setProperty('--mood-color', moodData.color);
        }
        document.documentElement.style.setProperty('--current-mood-color', moodData.color);
    }

    // ==================== Character System ====================
    extractCharacters(text) {
        const namePattern = /\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]+){0,2})\b/g;
        const excludeWords = new Set([
            'The','This','That','Then','When','What','Where','Who','How','Why',
            'But','And','For','With','Before','After','Once','While','During',
            'Although','However','Meanwhile','Because','Since','Until','Though',
            'Chapter','Part','Story','Day','Night','Morning','Evening','Afternoon',
            'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
            'January','February','March','April','May','June','July','August',
            'September','October','November','December',
            'She','His','Her','They','Their','Its','Our','Your','Him','Himself','Herself','Themselves',
            'Oh','Ah','Hey','Well','Yes','Okay','Sure','Suddenly','Finally','Perhaps','Maybe','Indeed',
            'North','South','East','West','Heaven','Hell','God','Fate','Destiny','Chapter','Epilogue','Prologue'
        ]);
        // Skip words at sentence start by detecting them specifically
        const sentenceStarts = new Set();
        (text.match(/(?:^|[.!?]\s+)([A-Z][a-z]{2,})/g) || [])
            .forEach(m => sentenceStarts.add(m.replace(/^[.!?\s]+/, '')));

        const matches = text.match(namePattern) || [];
        matches.forEach(name => {
            const first = name.split(' ')[0];
            if (excludeWords.has(first)) return;
            // Reject names that only ever appear at sentence start (likely just capitalized words)
            const elsewhere = new RegExp(`[^.!?]\\s${first}\\b`).test(text);
            if (!elsewhere && sentenceStarts.has(first)) return;

            let char = this.characters.find(c => c.name === name);
            if (char) {
                char.appearances = (char.appearances || 1) + 1;
            } else {
                let hash = 0;
                for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
                this.characters.push({
                    name,
                    firstAppearance: this.currentChapter,
                    appearances: 1,
                    portrait: `hsl(${Math.abs(hash) % 360}, 70%, 60%)`
                });
            }
        });
        this.updateCharacterPanel();
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
                <div class="character-avatar" style="background: ${c.portrait}">${c.name.charAt(0)}</div>
                <div class="character-info">
                    <span class="character-name">${this.escapeHtml(c.name)}</span>
                    <span class="character-chapter">Ch. ${c.firstAppearance}</span>
                </div>
            </div>
        `).join('');
    }

    // ==================== Story Display ====================
    async displayStory(data) {
        document.getElementById('landingSection')?.classList.add('hidden');
        document.getElementById('allQuestionsSection')?.classList.add('hidden');
        document.getElementById('storySection')?.classList.add('active');

        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            storyContent.innerHTML = '';
            const chapterMarker = document.createElement('div');
            chapterMarker.className = 'chapter-marker';
            chapterMarker.innerHTML = `<div class="chapter-number">Chapter 1</div><div class="chapter-title">The Beginning</div><div class="chapter-divider"></div>`;
            storyContent.appendChild(chapterMarker);

            const segmentIndex = 0;
            storyContent.appendChild(this.createImageCard(data.content, segmentIndex));

            const contentDiv = document.createElement('div');
            contentDiv.className = 'story-segment';
            contentDiv.dataset.index = segmentIndex;
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
        const mood = this.analyzeMood(data.content);
        this.updateMoodIndicator(mood);
        this.extractCharacters(data.content);
        if (data.choices?.length > 0) this.displayChoices(data.choices);

        this.startAmbient(this.detectGenre());
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
        storyChoices.innerHTML = `<div class="choices-title">What happens next?</div>`;
        choices.forEach(choice => {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = choice;
            btn.addEventListener('click', () => this.selectChoice(choice));
            storyChoices.appendChild(btn);
        });
        const customBtn = document.createElement('button');
        customBtn.className = 'choice-btn custom-choice';
        customBtn.textContent = 'Write your own direction...';
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
                body: JSON.stringify({ session_id: this.sessionId, user_choice: choice })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Server error: ${response.status}`);
            }
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            await this.appendToStory(data);
            if (this.storySegments.length % 3 === 0) this.addChapterMarker();
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
            divider.textContent = '\u2022 \u2022 \u2022';
            storyContent.appendChild(divider);

            const segmentIndex = this.storySegments.length;
            storyContent.appendChild(this.createImageCard(data.content, segmentIndex));

            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'story-segment';
            segmentDiv.dataset.index = segmentIndex;
            storyContent.appendChild(segmentDiv);

            if (this.isTypingEnabled && data.content) {
                await this.typeText(segmentDiv, data.html_content || `<p>${this.escapeHtml(data.content)}</p>`);
            } else {
                segmentDiv.innerHTML = data.html_content || `<p>${this.escapeHtml(data.content)}</p>`;
            }
        }

        this.storySegments.push(data.content);
        this.updateStats(data);
        const mood = this.analyzeMood(data.content);
        if (mood !== this.currentMood) this.addToHistory('mood_change', { from: this.currentMood, to: mood });
        this.updateMoodIndicator(mood);
        this.extractCharacters(data.content);
        if (data.choices?.length > 0) this.displayChoices(data.choices);
        storyContent.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }

    addChapterMarker(title = null) {
        this.currentChapter++;
        const chapterTitle = title || `Chapter ${this.currentChapter}`;
        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            const marker = document.createElement('div');
            marker.className = 'chapter-marker';
            marker.innerHTML = `<div class="chapter-number">Chapter ${this.currentChapter}</div><div class="chapter-title">${chapterTitle}</div><div class="chapter-divider"></div>`;
            storyContent.appendChild(marker);
        }
        this.playSound('chapter');
        this.showNotification(`${chapterTitle} begins!`, 'info');
    }

    showCustomInput() {
        const storyChoices = document.getElementById('storyChoices');
        if (!storyChoices) return;
        storyChoices.innerHTML = `
            <div class="choices-title">What would you like to happen?</div>
            <textarea id="customChoice" class="text-input" rows="3" placeholder="Describe what you want to happen next..."></textarea>
            <div class="nav-buttons" style="margin-top: 16px;">
                <button class="btn btn-ghost" onclick="app.showContinueOptions()">Cancel</button>
                <button class="btn btn-primary" onclick="app.submitCustomChoice()">Continue Story</button>
            </div>
        `;
        document.getElementById('customChoice')?.focus();
    }

    showContinueOptions() {
        this.displayChoices([
            "Continue with more action and adventure",
            "Develop the characters and relationships",
            "Introduce a surprising twist",
            "Build towards the climax"
        ]);
    }

    submitCustomChoice() {
        const input = document.getElementById('customChoice');
        const choice = input?.value.trim();
        if (choice) this.selectChoice(choice);
    }

    // ==================== Bookmark System ====================
    addBookmark() {
        if (this.storySegments.length === 0) { this.showNotification('No story content to bookmark', 'error'); return; }
        this.bookmarks.push({
            id: Date.now(), sessionId: this.sessionId,
            segmentIndex: this.storySegments.length - 1,
            preview: this.storySegments[this.storySegments.length - 1].substring(0, 100) + '...',
            chapter: this.currentChapter, timestamp: new Date().toISOString(), mood: this.currentMood
        });
        localStorage.setItem('storyforge-bookmarks', JSON.stringify(this.bookmarks));
        this.playSound('success');
        this.showNotification('Bookmark added!', 'success');
    }

    // ==================== Save/Load System ====================
    saveCurrentStory() {
        if (this.storySegments.length === 0) { this.showNotification('No story to save', 'error'); return; }
        const storyData = {
            id: this.sessionId, title: this.generateStoryTitle(),
            segments: this.storySegments, responses: this.responses,
            chapter: this.currentChapter, mood: this.currentMood,
            characters: this.characters, timestamp: new Date().toISOString(),
            wordCount: this.storySegments.join(' ').split(/\s+/).length
        };
        const existingIndex = this.savedStories.findIndex(s => s.id === this.sessionId);
        if (existingIndex >= 0) this.savedStories[existingIndex] = storyData;
        else this.savedStories.push(storyData);
        localStorage.setItem('storyforge-stories', JSON.stringify(this.savedStories));
        this.playSound('success');
        this.showNotification('Story saved!', 'success');
    }

    generateStoryTitle() {
        if (this.responses['setting_1']) return `${this.responses['setting_1'].split(' ').slice(0, 3).join(' ')} Adventure`;
        return `Story ${new Date().toLocaleDateString()}`;
    }

    loadSavedStories() {
        this.savedStories = JSON.parse(localStorage.getItem('storyforge-stories') || '[]');
    }

    showSavedStories() {
        const modal = this.createModal('Saved Stories', `
            <div class="saved-stories-list">
                ${this.savedStories.length === 0 ? '<p class="empty-state">No saved stories yet.</p>' : ''}
                ${this.savedStories.map(s => `
                    <div class="saved-story-item" data-id="${s.id}">
                        <div class="story-item-header"><h4>${this.escapeHtml(s.title)}</h4><span class="story-date">${new Date(s.timestamp).toLocaleDateString()}</span></div>
                        <div class="story-item-meta"><span>${s.chapter} chapters</span><span>${s.wordCount} words</span></div>
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

        document.getElementById('landingSection')?.classList.add('hidden');
        document.getElementById('allQuestionsSection')?.classList.add('hidden');
        document.getElementById('storySection')?.classList.add('active');

        const storyContent = document.getElementById('storyContent');
        if (storyContent) {
            storyContent.innerHTML = story.segments.map((seg, i) => `
                <div class="story-segment" data-index="${i}"><p>${this.escapeHtml(seg)}</p></div>
                ${i < story.segments.length - 1 ? '<div class="story-divider">\u2022 \u2022 \u2022</div>' : ''}
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

    // ==================== Undo/Redo ====================
    saveState() {
        this.undoStack.push({ segments: [...this.storySegments], chapter: this.currentChapter, mood: this.currentMood });
        this.redoStack = [];
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) { this.showNotification('Nothing to undo', 'info'); return; }
        this.redoStack.push({ segments: [...this.storySegments], chapter: this.currentChapter, mood: this.currentMood });
        const prev = this.undoStack.pop();
        this.storySegments = prev.segments; this.currentChapter = prev.chapter; this.currentMood = prev.mood;
        this.refreshStoryDisplay(); this.updateUndoRedoButtons();
        this.showNotification('Undone!', 'info');
    }

    redo() {
        if (this.redoStack.length === 0) { this.showNotification('Nothing to redo', 'info'); return; }
        this.undoStack.push({ segments: [...this.storySegments], chapter: this.currentChapter, mood: this.currentMood });
        const next = this.redoStack.pop();
        this.storySegments = next.segments; this.currentChapter = next.chapter; this.currentMood = next.mood;
        this.refreshStoryDisplay(); this.updateUndoRedoButtons();
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
                <div class="story-segment" data-index="${i}"><p>${this.escapeHtml(seg)}</p></div>
                ${i < this.storySegments.length - 1 ? '<div class="story-divider">\u2022 \u2022 \u2022</div>' : ''}
            `).join('');
        }
        this.updateStats();
        this.updateMoodIndicator(this.currentMood);
    }

    // ==================== Story History ====================
    addToHistory(action, data) {
        this.storyHistory.push({ action, data, timestamp: new Date().toISOString(), chapter: this.currentChapter });
    }

    // ==================== Export ====================
    showExportOptions() {
        const modal = this.createModal('Export Story', `
            <div class="export-options">
                <button class="export-btn" onclick="app.downloadAs('txt')"><span class="export-icon">TXT</span><span class="export-label">Plain Text</span></button>
                <button class="export-btn" onclick="app.downloadAs('html')"><span class="export-icon">HTML</span><span class="export-label">Web Page</span></button>
                <button class="export-btn" onclick="app.downloadAs('md')"><span class="export-icon">MD</span><span class="export-label">Markdown</span></button>
                <button class="export-btn" onclick="app.copyToClipboard()"><span class="export-icon">COPY</span><span class="export-label">Clipboard</span></button>
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
                mimeType = 'text/plain'; extension = 'txt'; break;
            case 'html':
                content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${this.escapeHtml(title)}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.8}h1{text-align:center;color:#6366f1}.segment{margin:2em 0}.divider{text-align:center;color:#999;margin:2em 0}</style></head><body><h1>${this.escapeHtml(title)}</h1>${this.storySegments.map(seg => `<div class="segment"><p>${this.escapeHtml(seg)}</p></div><div class="divider">\u2022 \u2022 \u2022</div>`).join('')}<p style="text-align:center;color:#666;margin-top:3em">Generated by StoryForge AI</p></body></html>`;
                mimeType = 'text/html'; extension = 'html'; break;
            case 'md':
                content = `# ${title}\n\n${this.storySegments.map((seg, i) => `## Part ${i + 1}\n\n${seg}`).join('\n\n---\n\n')}\n\n---\n*Generated by StoryForge AI*`;
                mimeType = 'text/markdown'; extension = 'md'; break;
        }
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${title.replace(/\s+/g, '_')}.${extension}`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.closeAllModals();
        this.showNotification(`Exported as ${extension.toUpperCase()}!`, 'success');
    }

    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.storySegments.join('\n\n---\n\n'));
            this.showNotification('Copied to clipboard!', 'success');
        } catch (err) { this.showNotification('Failed to copy', 'error'); }
        this.closeAllModals();
    }

    downloadStory() { this.showExportOptions(); }

    // ==================== Modal System ====================
    createModal(title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<div class="modal"><div class="modal-header"><h3>${title}</h3><button class="modal-close" onclick="app.closeAllModals()">&times;</button></div><div class="modal-content">${content}</div></div>`;
        return modal;
    }

    closeAllModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.remove()); }

    // ==================== LLM Status ====================
    async checkLLMStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();
            const statusDot = document.getElementById('statusDot');
            const statusText = document.getElementById('statusText');
            if (data.llm_available) {
                statusDot?.classList.add('online');
                statusText.textContent = `Connected to ${data.model}`;
            } else {
                statusDot?.classList.remove('online');
                statusText.textContent = 'AI Offline - Configure in Settings';
                this.showNotification('Configure an AI provider in Settings to generate stories', 'error');
            }
        } catch (error) {
            console.error('Status check failed:', error);
            document.getElementById('statusText').textContent = 'Connection Error';
        }
    }

    confirmNewStory() {
        if (this.storySegments.length > 0) {
            const modal = this.createModal('Start New Story?', `
                <p>You have an ongoing story. Save before starting new?</p>
                <div class="modal-actions">
                    <button class="btn btn-ghost" onclick="app.closeAllModals(); app.showLanding();">Don't Save</button>
                    <button class="btn btn-primary" onclick="app.saveCurrentStory(); app.closeAllModals(); app.showLanding();">Save & New</button>
                </div>
            `);
            document.body.appendChild(modal);
        } else {
            this.showLanding();
        }
    }

    // ==================== Settings ====================
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

    // ==================== Utilities ====================
    showLoading(show, message = 'Loading...') {
        const loadingSection = document.getElementById('loadingSection');
        const loadingText = document.getElementById('loadingText');
        if (show) {
            loadingSection?.classList.add('active');
            if (loadingText) loadingText.textContent = message;
        } else {
            loadingSection?.classList.remove('active');
            if (this.storySegments?.length > 0) document.getElementById('storySection')?.classList.add('active');
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        const notificationText = notification?.querySelector('.notification-text');
        const notificationIcon = notification?.querySelector('.notification-icon');
        if (!notification) return;
        const icons = { success: '\u2705', error: '\u274C', info: '\u2139\uFE0F', warning: '\u26A0\uFE0F' };
        if (notificationIcon) notificationIcon.textContent = icons[type] || '\u2139\uFE0F';
        if (notificationText) notificationText.textContent = message;
        notification.className = `notification ${type} show`;
        setTimeout(() => notification.classList.remove('show'), 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ==================== Image Generation (Pollinations.ai) ====================
    extractSceneSentence(text) {
        if (!text) return '';
        // strip dialogue (smart + straight quotes), markdown/HTML, collapse whitespace
        let clean = text
            .replace(/["“”][^"“”]{0,400}["“”]/g, ' ')
            .replace(/['‘’][^'‘’]{3,400}['‘’]/g, ' ')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[*_`#>]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const sentences = clean.split(/(?<=[.!?])\s+/).filter(s => s.length > 12);
        // score: reward concrete/visual cues, penalize inner-thought verbs
        const thoughtWords = /\b(thought|remembered|wondered|realized|knew|felt|considered|pondered|imagined|recalled)\b/i;
        const visualHints = /\b(stood|rose|loomed|stretched|glowed|shone|towered|sprawled|crashed|swept|flickered|blazed|crept|descended|soared|spread|unfolded|gleamed|shimmered|rippled|burst)\b/i;

        let best = sentences[0] || clean;
        let bestScore = -1;
        for (const s of sentences.slice(0, 5)) {
            let score = 0;
            if (visualHints.test(s)) score += 2;
            if (thoughtWords.test(s)) score -= 2;
            score += Math.min(3, (s.match(/\b[A-Z][a-z]+/g) || []).length);
            if (score > bestScore) { bestScore = score; best = s; }
        }
        return best.trim();
    }

    buildImagePrompt(segmentText, { short = false } = {}) {
        const scene = this.extractSceneSentence(segmentText);
        const scenePart = (scene || '').split(/\s+/).slice(0, short ? 10 : 16).join(' ');

        const settingRaw = (this.responses['setting_1'] || '').toLowerCase();
        let sceneHint = '';
        if (settingRaw.includes('fantasy') || settingRaw.includes('magical')) sceneHint = 'fantasy';
        else if (settingRaw.includes('sci-fi') || settingRaw.includes('futuristic') || settingRaw.includes('space')) sceneHint = 'sci-fi';
        else if (settingRaw.includes('historical') || settingRaw.includes('medieval') || settingRaw.includes('victorian')) sceneHint = 'historical';
        else if (settingRaw.includes('supernatural') || settingRaw.includes('paranormal')) sceneHint = 'dark supernatural';

        const mood = this.currentMood && this.currentMood !== 'neutral' ? this.currentMood : '';
        const style = short ? 'digital illustration' : 'cinematic digital illustration, atmospheric lighting';
        const parts = [scenePart, sceneHint, mood, style].filter(Boolean);

        return parts.join(', ')
            .replace(/[<>"{}|\\^`\[\]]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, short ? 140 : 200);
    }

    imageUrlFor(segmentText, seed, opts = {}) {
        const prompt = this.buildImagePrompt(segmentText, opts);
        const params = new URLSearchParams({
            width: '768', height: '432', nologo: 'true', seed: String(seed)
        });
        return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;
    }

    // Serial queue so we don't fire N image requests in parallel — Pollinations rate-limits ~1/sec per IP.
    _enqueueImageLoad(startFn) {
        this._imgQueue ||= Promise.resolve();
        this._imgQueue = this._imgQueue.then(() => new Promise(resolve => {
            const done = () => resolve();
            startFn(done);
            // Always release the lock after 1200ms so the queue keeps moving even if the image takes longer.
            setTimeout(done, 1200);
        }));
    }

    createImageCard(segmentText, segmentIndex) {
        const card = document.createElement('figure');
        card.className = 'story-image-card';
        card.dataset.segmentIndex = segmentIndex;

        const seed = ((this.sessionId || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 0) + segmentIndex * 31) % 1000000;
        const url = this.imageUrlFor(segmentText, seed);
        this.imageCache[segmentIndex] = url;

        card.innerHTML = `
            <div class="story-image-wrap">
                <div class="story-image-skeleton">
                    <div class="skeleton-shimmer"></div>
                    <span class="skeleton-label">Illustrating this scene…</span>
                </div>
                <img class="story-image" alt="Scene illustration" referrerpolicy="no-referrer">
                <button class="story-image-refresh" title="Regenerate image" type="button">↻</button>
            </div>
        `;

        const img = card.querySelector('img');
        const skel = card.querySelector('.story-image-skeleton');
        const label = skel.querySelector('.skeleton-label');
        const refresh = card.querySelector('.story-image-refresh');

        let attempt = 0;
        const maxAttempts = 3;
        let watchdog = null;

        const tryLoad = (src) => {
            if (watchdog) clearTimeout(watchdog);
            this.imageCache[segmentIndex] = src;
            this._enqueueImageLoad((release) => {
                img.src = src;
                watchdog = setTimeout(() => { img.dispatchEvent(new Event('error')); release(); }, 35000);
                const onAny = () => { release(); img.removeEventListener('load', onAny); img.removeEventListener('error', onAny); };
                img.addEventListener('load', onAny);
                img.addEventListener('error', onAny);
            });
        };

        img.addEventListener('load', () => {
            if (watchdog) clearTimeout(watchdog);
            img.classList.add('loaded');
            skel.style.display = 'none';
        });

        img.addEventListener('error', () => {
            if (watchdog) clearTimeout(watchdog);
            attempt += 1;
            if (attempt < maxAttempts) {
                if (label) label.textContent = `Retrying (${attempt}/${maxAttempts - 1})…`;
                const newSeed = Math.floor(Math.random() * 1000000);
                const short = attempt >= 2;
                setTimeout(() => tryLoad(this.imageUrlFor(segmentText, newSeed, { short })), 1200 * attempt);
            } else {
                console.warn('[image] all retries failed for segment', segmentIndex, 'last src:', img.src);
                skel.innerHTML = `
                    <span class="skeleton-label">Image generator is slow or unavailable.</span>
                    <button class="story-image-retry" type="button">Try again</button>
                `;
                skel.querySelector('.story-image-retry')?.addEventListener('click', () => {
                    attempt = 0;
                    skel.innerHTML = `<div class="skeleton-shimmer"></div><span class="skeleton-label">Illustrating this scene…</span>`;
                    tryLoad(this.imageUrlFor(segmentText, Math.floor(Math.random() * 1000000)));
                });
            }
        });

        refresh.addEventListener('click', () => {
            attempt = 0;
            skel.innerHTML = `<div class="skeleton-shimmer"></div><span class="skeleton-label">Illustrating this scene…</span>`;
            skel.style.display = 'flex';
            img.classList.remove('loaded');
            tryLoad(this.imageUrlFor(segmentText, Math.floor(Math.random() * 1000000)));
        });

        tryLoad(url);
        return card;
    }

    // ==================== Narration (browser TTS) ====================
    toggleNarration() {
        if (!('speechSynthesis' in window)) {
            this.showNotification('Speech synthesis not supported in this browser', 'error');
            return;
        }
        if (this.narration.playing) {
            if (window.speechSynthesis.paused) {
                window.speechSynthesis.resume();
            } else {
                window.speechSynthesis.pause();
                this.updateNarrateButton('paused');
                return;
            }
            this.updateNarrateButton('playing');
            return;
        }
        if (this.storySegments.length === 0) {
            this.showNotification('No story content to narrate yet', 'info');
            return;
        }
        this.narration.queue = [...this.storySegments];
        this.narration.index = 0;
        this.narration.playing = true;
        this.speakNext();
        this.updateNarrateButton('playing');
    }

    speakNext() {
        if (this.narration.index >= this.narration.queue.length) {
            this.narration.playing = false;
            this.updateNarrateButton('idle');
            return;
        }
        const text = this.narration.queue[this.narration.index];
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.95;
        utter.pitch = 1.0;
        utter.onend = () => {
            this.narration.index += 1;
            if (this.narration.playing) this.speakNext();
        };
        utter.onerror = () => {
            this.narration.playing = false;
            this.updateNarrateButton('idle');
        };
        this.narration.utter = utter;
        window.speechSynthesis.speak(utter);
    }

    stopNarration() {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
        this.narration.playing = false;
        this.narration.utter = null;
        this.updateNarrateButton('idle');
    }

    updateNarrateButton(state) {
        const btn = document.getElementById('narrateBtn');
        if (!btn) return;
        const icons = { idle: '🔊', playing: '⏸️', paused: '▶️' };
        btn.innerHTML = icons[state] || icons.idle;
        btn.classList.toggle('active', state !== 'idle');
        btn.title = state === 'idle' ? 'Narrate Story' : (state === 'paused' ? 'Resume Narration' : 'Pause Narration');
    }

    // ==================== Story Map (D3 tree) ====================
    showStoryMap() {
        if (typeof d3 === 'undefined') {
            this.showNotification('Visualization library not loaded', 'error');
            return;
        }
        if (this.storySegments.length === 0) {
            this.showNotification('No story yet. Generate one first.', 'info');
            return;
        }

        const modal = this.createModal('Story Map', `<div class="graph-container" id="storyMapGraph"></div>`);
        modal.classList.add('modal-wide');
        document.body.appendChild(modal);

        const choices = this.storyHistory.filter(h => h.action === 'choice').map(h => h.data?.choice || '');
        const root = { name: 'Start', children: [] };
        let cursor = root;
        for (let i = 0; i < this.storySegments.length; i++) {
            const node = {
                name: `Ch. ${i + 1}`,
                preview: this.storySegments[i].substring(0, 80) + '…',
                choice: i > 0 ? (choices[i - 1] || '') : '',
                children: []
            };
            cursor.children.push(node);
            cursor = node;
        }

        const container = document.getElementById('storyMapGraph');
        const width = container.clientWidth || 720;
        const height = 420;

        const svg = d3.select(container).append('svg')
            .attr('width', width).attr('height', height)
            .attr('viewBox', [0, 0, width, height]);

        const g = svg.append('g').attr('transform', 'translate(40,40)');

        const hierarchy = d3.hierarchy(root);
        const treeLayout = d3.tree().size([width - 80, height - 80]);
        treeLayout(hierarchy);

        g.selectAll('path.link')
            .data(hierarchy.links())
            .join('path')
            .attr('class', 'link')
            .attr('fill', 'none')
            .attr('stroke', 'var(--accent-2)')
            .attr('stroke-opacity', 0.55)
            .attr('stroke-width', 1.8)
            .attr('d', d3.linkVertical().x(d => d.x).y(d => d.y));

        const nodeGroup = g.selectAll('g.node')
            .data(hierarchy.descendants())
            .join('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        nodeGroup.append('circle')
            .attr('r', 9)
            .attr('fill', (d, i) => i === 0 ? 'var(--accent-cta)' : 'var(--accent-1)')
            .attr('stroke', 'var(--bg-primary)')
            .attr('stroke-width', 2);

        nodeGroup.append('text')
            .attr('dy', -14)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', 'var(--text-primary)')
            .text(d => d.data.name);

        nodeGroup.append('title').text(d => d.data.preview || d.data.name);
    }

    // ==================== Character Graph (D3 force) ====================
    showCharacterGraph() {
        if (typeof d3 === 'undefined') {
            this.showNotification('Visualization library not loaded', 'error');
            return;
        }
        const filtered = this.characters.filter(c => (c.appearances || 1) >= 2);
        if (filtered.length === 0) {
            this.showNotification('Not enough character data yet — generate more chapters.', 'info');
            return;
        }

        const body = `
            <p class="graph-note">Edges show how often characters appear in the same chapter. Node size reflects mention count. This is a co-appearance graph, not a verified relationship model.</p>
            <div class="graph-container" id="charGraph"></div>
        `;
        const modal = this.createModal('Character Relationships', body);
        modal.classList.add('modal-wide');
        document.body.appendChild(modal);

        const nodes = filtered.map(c => ({
            id: c.name, color: c.portrait,
            chapter: c.firstAppearance,
            appearances: c.appearances || 1
        }));
        const links = [];
        this.storySegments.forEach(seg => {
            const present = filtered.filter(c => seg.includes(c.name)).map(c => c.name);
            for (let i = 0; i < present.length; i++) {
                for (let j = i + 1; j < present.length; j++) {
                    const key = [present[i], present[j]].sort().join('||');
                    let link = links.find(l => l._k === key);
                    if (link) link.value += 1;
                    else links.push({ _k: key, source: present[i], target: present[j], value: 1 });
                }
            }
        });

        const container = document.getElementById('charGraph');
        const width = container.clientWidth || 720;
        const height = 420;

        const svg = d3.select(container).append('svg')
            .attr('width', width).attr('height', height)
            .attr('viewBox', [0, 0, width, height]);

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id).distance(110))
            .force('charge', d3.forceManyBody().strength(-220))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide(34));

        const link = svg.append('g').attr('stroke', 'var(--accent-2)').attr('stroke-opacity', 0.4)
            .selectAll('line').data(links).join('line')
            .attr('stroke-width', d => Math.max(1, Math.sqrt(d.value)));

        const node = svg.append('g').selectAll('g').data(nodes).join('g')
            .call(d3.drag()
                .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }));

        const maxApp = Math.max(...nodes.map(n => n.appearances), 1);
        const radius = d => 16 + Math.round((d.appearances / maxApp) * 14);

        node.append('circle').attr('r', radius).attr('fill', d => d.color || 'var(--accent-1)')
            .attr('stroke', 'var(--bg-primary)').attr('stroke-width', 2);

        node.append('text').text(d => d.id.charAt(0))
            .attr('text-anchor', 'middle').attr('dy', '0.35em')
            .attr('fill', 'white').attr('font-weight', '700').attr('font-size', '14px');

        node.append('text').text(d => `${d.id} (${d.appearances})`)
            .attr('text-anchor', 'middle').attr('dy', d => radius(d) + 16)
            .attr('fill', 'var(--text-primary)').attr('font-size', '11px');

        simulation.on('tick', () => {
            link.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
            node.attr('transform', d => `translate(${d.x},${d.y})`);
        });
    }

    // ==================== Admin (question browser) ====================
    async showAdminPanel() {
        try {
            const res = await fetch('/api/questions/all');
            const data = await res.json();
            const phases = data.phases || {};
            const phaseOrder = ['setting', 'character', 'theme', 'plot'];
            const total = phaseOrder.reduce((n, p) => n + (phases[p]?.length || 0), 0);

            const body = `
                <div class="admin-summary">${total} questions across ${phaseOrder.length} phases</div>
                <div class="admin-phases">
                    ${phaseOrder.map(p => `
                        <details class="admin-phase" ${p === 'setting' ? 'open' : ''}>
                            <summary>
                                <span class="phase-icon">${this.phaseIcons[p] || ''}</span>
                                <span class="phase-name">${this.phaseNames[p] || p}</span>
                                <span class="admin-count">${phases[p]?.length || 0}</span>
                            </summary>
                            <ol class="admin-q-list">
                                ${(phases[p] || []).map(q => `
                                    <li class="admin-q-item">
                                        <div class="admin-q-text">${this.escapeHtml(q.text)}</div>
                                        ${q.options && q.options.length ? `
                                            <div class="admin-q-options">
                                                ${q.options.map(o => `<span class="admin-opt">${this.escapeHtml(o)}</span>`).join('')}
                                            </div>
                                        ` : '<div class="admin-q-free">Free-text answer</div>'}
                                        <div class="admin-q-meta">
                                            <code>${this.escapeHtml(q.id)}</code>
                                            ${q.is_required ? '<span class="admin-req">Required</span>' : '<span class="admin-opt-tag">Optional</span>'}
                                        </div>
                                    </li>
                                `).join('')}
                            </ol>
                        </details>
                    `).join('')}
                </div>
                <p class="admin-note">Read-only view. Edit questions in <code>app/modules/user_input.py</code> and restart the server.</p>
            `;
            const modal = this.createModal('Question Browser', body);
            modal.classList.add('modal-wide');
            document.body.appendChild(modal);
        } catch (err) {
            this.showNotification('Failed to load questions', 'error');
        }
    }
}

// Initialize
let app;
document.addEventListener('DOMContentLoaded', () => { app = new StoryForgeApp(); });
