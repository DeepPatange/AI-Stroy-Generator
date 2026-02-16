# Q&A Based Interactive Storytelling Using Generative AI

A comprehensive interactive storytelling system that generates personalized narratives through structured Question-Answer interactions using Large Language Models.

## Project Overview

This M-Tech project implements a multi-module architecture for AI-powered interactive storytelling:

- **User Input Acquisition**: Structured Q&A framework capturing user preferences
- **Context Extraction Engine**: Transforms responses into story parameters
- **Knowledge & Memory Module**: Maintains story state and consistency
- **Prompt Engineering Layer**: Constructs optimized LLM prompts
- **Story Generator**: Integrates with Ollama (local) or OpenAI/Gemini (API)
- **Story Flow Manager**: Ensures narrative coherence and pacing
- **Output Formatter**: Prepares stories for display and download

## Features

- Interactive Q&A-based story creation
- Local LLM support via Ollama (no API costs)
- Real-time story generation with streaming
- Story continuation with user choices
- Narrative coherence and consistency tracking
- Beautiful web interface
- Story download in multiple formats

## Prerequisites

### Required Software

1. **Python 3.10+**
   ```bash
   python --version
   ```

2. **Ollama** (for local LLM)
   - Download from: https://ollama.ai/download
   - Or install via terminal:
   ```bash
   # macOS
   brew install ollama

   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   ```

### Pull a Language Model

After installing Ollama, pull a model:

```bash
# Recommended models (choose one)
ollama pull llama3.2      # Best balance of quality and speed
ollama pull mistral       # Good for creative writing
ollama pull phi           # Smaller, faster model
```

## Installation

### Step 1: Navigate to Project Directory

```bash
cd "/Users/deeppatange/Desktop/Mtech Projects/Projects/Anjali maam "
```

### Step 2: Create Virtual Environment

```bash
# Create virtual environment
python -m venv venv

# Activate it
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

### Step 3: Install Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Download spaCy Model (Optional, for advanced NLP)

```bash
python -m spacy download en_core_web_sm
```

## Running the Application

### Step 1: Start Ollama Server

Open a terminal and run:
```bash
ollama serve
```

Keep this running in the background.

### Step 2: Start the Web Application

In a new terminal:
```bash
# Activate virtual environment if not already
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Run the application
python main.py
```

Or use uvicorn directly:
```bash
uvicorn main:app --reload --port 8000
```

### Step 3: Open in Browser

Navigate to: **http://localhost:8000**

## How to Use

1. **Start a New Story**: Click "New Story" or the application starts automatically
2. **Answer Questions**: Go through the 4 phases of questions:
   - Setting & World: Define where and when your story takes place
   - Characters: Create your protagonist and supporting cast
   - Theme & Genre: Choose the story's genre and emotional tone
   - Plot & Structure: Define conflict type and ending preference
3. **Generate Story**: After answering all questions, the AI generates your story
4. **Continue the Story**: Choose from options or write your own direction
5. **Download**: Save your completed story in TXT, MD, or HTML format

## Project Structure

```
Anjali maam/
├── app/
│   ├── __init__.py
│   ├── modules/
│   │   ├── __init__.py
│   │   ├── user_input.py          # Q&A Framework
│   │   ├── context_extraction.py   # Context Engine
│   │   ├── knowledge_memory.py     # Memory Module
│   │   ├── prompt_engineering.py   # Prompt Layer
│   │   ├── story_generator.py      # LLM Integration
│   │   ├── story_flow_manager.py   # Flow Control
│   │   └── output_formatter.py     # Output Formatting
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── app.js
│   └── templates/
│       └── index.html
├── data/                            # Database storage
├── config.py                        # Configuration
├── main.py                          # FastAPI Application
├── requirements.txt                 # Dependencies
└── README.md                        # This file
```

## Configuration

Edit `config.py` to customize:

```python
# LLM Settings
LLM_PROVIDER = "ollama"              # ollama, openai, gemini
OLLAMA_MODEL = "llama3.2"            # Local model name
TEMPERATURE = 0.8                     # Creativity (0.0-1.0)

# For API providers (future use)
OPENAI_API_KEY = "your-key-here"
GEMINI_API_KEY = "your-key-here"
```

Or create a `.env` file:
```
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
TEMPERATURE=0.8
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Main web interface |
| `/api/status` | GET | Check LLM status |
| `/api/session/new` | POST | Create new session |
| `/api/question/next` | GET | Get next question |
| `/api/response` | POST | Submit answer |
| `/api/story/generate` | POST | Generate initial story |
| `/api/story/continue` | POST | Continue story |
| `/api/story/full/{id}` | GET | Get complete story |
| `/api/story/download/{id}` | GET | Download story |

## Troubleshooting

### "LLM Offline" Error

1. Ensure Ollama is running:
   ```bash
   ollama serve
   ```

2. Verify model is installed:
   ```bash
   ollama list
   ```

3. If no models, pull one:
   ```bash
   ollama pull llama3.2
   ```

### Slow Generation

- Try a smaller model: `ollama pull phi`
- Reduce max_tokens in settings
- Ensure no other heavy processes running

### Import Errors

```bash
pip install -r requirements.txt --upgrade
```

## Technology Stack

- **Backend**: Python 3.10+, FastAPI
- **LLM**: Ollama (local), OpenAI/Gemini (optional)
- **Frontend**: HTML5, CSS3, JavaScript
- **Database**: SQLite (via aiosqlite)
- **NLP**: spaCy (optional)

## Future Enhancements

- Multi-language support
- Voice input/output
- Image generation for scenes
- Collaborative storytelling
- Mobile app version

## Author

**Anjali Madan Jha**
- Roll Number: 124MTCM1008
- Guide: Dr. Vidyullata Devmane
- Department of Computer Engineering
- Shah & Anchor Kutchhi Engineering College

## License

This project is developed as part of M-Tech coursework at SAKEC.

---

*Q&A Based Interactive Storytelling Using Generative AI - January 2026*
