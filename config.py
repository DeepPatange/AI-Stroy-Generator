"""
Configuration settings for Q&A Based Interactive Storytelling System
"""
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base directory
BASE_DIR = Path(__file__).resolve().parent

# LLM Configuration
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # Options: "ollama", "openai", "gemini"
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")  # Local model name
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

# OpenAI Configuration (for future use)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")

# Google Gemini Configuration (for future use)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-pro")

# Story Generation Settings
MAX_STORY_LENGTH = 2000  # Maximum words per story segment
TEMPERATURE = 0.8  # Creativity level (0.0 - 1.0)
TOP_P = 0.9

# Database
DATABASE_PATH = BASE_DIR / "data" / "storytelling.db"

# Session Settings
SESSION_TIMEOUT = 3600  # 1 hour in seconds
MAX_CONTEXT_HISTORY = 20  # Maximum Q&A pairs to keep in context

# Question Categories
QUESTION_PHASES = [
    "setting",      # Phase 1: Setting and World
    "character",    # Phase 2: Character Development
    "theme",        # Phase 3: Theme and Genre
    "plot"          # Phase 4: Plot and Structure
]
