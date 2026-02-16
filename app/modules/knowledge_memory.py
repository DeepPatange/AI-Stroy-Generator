"""
Module 3: Knowledge and Memory Module
Maintains persistent story state, user preferences, and narrative history
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from datetime import datetime
import json
from pathlib import Path
import sqlite3
import os


class StorySegment(BaseModel):
    """Represents a segment of the generated story"""
    segment_id: int
    content: str
    timestamp: str
    word_count: int
    user_choice: Optional[str] = None


class StoryState(BaseModel):
    """Current state of the story being generated"""
    session_id: str
    story_segments: List[StorySegment] = []
    characters_introduced: List[str] = []
    locations_visited: List[str] = []
    plot_points: List[str] = []
    current_scene: Optional[str] = None
    emotional_arc: List[str] = []
    total_word_count: int = 0


class UserPreferences(BaseModel):
    """Stored user preferences across sessions"""
    user_id: str
    favorite_genres: List[str] = []
    preferred_tone: Optional[str] = None
    content_sensitivities: List[str] = []
    reading_level: str = "adult"
    session_count: int = 0


class KnowledgeMemoryModule:
    """
    Manages persistent storage of story state, user preferences,
    and maintains consistency across story segments.
    """

    def __init__(self, db_path: Optional[str] = None):
        if db_path:
            self.db_path = Path(db_path)
        else:
            self.db_path = Path(__file__).parent.parent.parent / "data" / "storytelling.db"

        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_database()

        # In-memory cache for current session
        self.current_story_state: Optional[StoryState] = None
        self.qa_history: List[Dict[str, str]] = []
        self.context_cache: Dict[str, Any] = {}

    def _init_database(self):
        """Initialize SQLite database with required tables"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        # Sessions table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                user_id TEXT,
                created_at TEXT,
                updated_at TEXT,
                status TEXT DEFAULT 'active'
            )
        ''')

        # Story segments table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS story_segments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                segment_order INTEGER,
                content TEXT,
                user_choice TEXT,
                created_at TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        ''')

        # Story context table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS story_context (
                session_id TEXT PRIMARY KEY,
                context_json TEXT,
                updated_at TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        ''')

        # Q&A history table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS qa_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                question_id TEXT,
                question_text TEXT,
                answer TEXT,
                timestamp TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        ''')

        # User preferences table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT PRIMARY KEY,
                preferences_json TEXT,
                updated_at TEXT
            )
        ''')

        conn.commit()
        conn.close()

    def create_session(self, session_id: str, user_id: str = "anonymous") -> StoryState:
        """Create a new story session"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO sessions (session_id, user_id, created_at, updated_at)
            VALUES (?, ?, ?, ?)
        ''', (session_id, user_id, now, now))

        conn.commit()
        conn.close()

        self.current_story_state = StoryState(session_id=session_id)
        self.qa_history = []
        self.context_cache = {}

        return self.current_story_state

    def add_story_segment(self, session_id: str, content: str, user_choice: Optional[str] = None) -> StorySegment:
        """Add a new story segment to the current session"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        # Get current segment count
        cursor.execute('''
            SELECT COUNT(*) FROM story_segments WHERE session_id = ?
        ''', (session_id,))
        segment_order = cursor.fetchone()[0]

        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO story_segments (session_id, segment_order, content, user_choice, created_at)
            VALUES (?, ?, ?, ?, ?)
        ''', (session_id, segment_order, content, user_choice, now))

        conn.commit()
        conn.close()

        segment = StorySegment(
            segment_id=segment_order,
            content=content,
            timestamp=now,
            word_count=len(content.split()),
            user_choice=user_choice
        )

        # Update in-memory state
        if self.current_story_state and self.current_story_state.session_id == session_id:
            self.current_story_state.story_segments.append(segment)
            self.current_story_state.total_word_count += segment.word_count
            self._extract_story_elements(content)

        return segment

    def _extract_story_elements(self, content: str):
        """Extract and track story elements from generated content"""
        if not self.current_story_state:
            return

        # Simple extraction of quoted names (characters speaking)
        import re
        dialogue_pattern = r'"[^"]*"\s*(?:said|asked|replied|exclaimed|whispered)\s+(\w+)'
        characters = re.findall(dialogue_pattern, content)
        for char in characters:
            if char not in self.current_story_state.characters_introduced:
                self.current_story_state.characters_introduced.append(char)

    def save_qa_response(self, session_id: str, question_id: str, question_text: str, answer: str):
        """Save a Q&A exchange to history"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        now = datetime.now().isoformat()
        cursor.execute('''
            INSERT INTO qa_history (session_id, question_id, question_text, answer, timestamp)
            VALUES (?, ?, ?, ?, ?)
        ''', (session_id, question_id, question_text, answer, now))

        conn.commit()
        conn.close()

        self.qa_history.append({
            "question_id": question_id,
            "question": question_text,
            "answer": answer,
            "timestamp": now
        })

    def save_context(self, session_id: str, context: Dict[str, Any]):
        """Save the story context to database"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        now = datetime.now().isoformat()
        context_json = json.dumps(context, default=str)

        cursor.execute('''
            INSERT OR REPLACE INTO story_context (session_id, context_json, updated_at)
            VALUES (?, ?, ?)
        ''', (session_id, context_json, now))

        conn.commit()
        conn.close()

        self.context_cache = context

    def get_story_segments(self, session_id: str) -> List[StorySegment]:
        """Retrieve all story segments for a session"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            SELECT segment_order, content, user_choice, created_at
            FROM story_segments
            WHERE session_id = ?
            ORDER BY segment_order
        ''', (session_id,))

        rows = cursor.fetchall()
        conn.close()

        segments = []
        for row in rows:
            segments.append(StorySegment(
                segment_id=row[0],
                content=row[1],
                timestamp=row[3],
                word_count=len(row[1].split()),
                user_choice=row[2]
            ))

        return segments

    def get_full_story(self, session_id: str) -> str:
        """Get the complete story text"""
        segments = self.get_story_segments(session_id)
        return "\n\n".join([seg.content for seg in segments])

    def get_qa_history(self, session_id: str) -> List[Dict[str, str]]:
        """Get Q&A history for a session"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            SELECT question_id, question_text, answer, timestamp
            FROM qa_history
            WHERE session_id = ?
            ORDER BY timestamp
        ''', (session_id,))

        rows = cursor.fetchall()
        conn.close()

        return [
            {
                "question_id": row[0],
                "question": row[1],
                "answer": row[2],
                "timestamp": row[3]
            }
            for row in rows
        ]

    def get_context(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve saved context for a session"""
        if self.context_cache:
            return self.context_cache

        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            SELECT context_json FROM story_context WHERE session_id = ?
        ''', (session_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return json.loads(row[0])
        return None

    def get_recent_context(self, session_id: str, num_segments: int = 3) -> str:
        """Get recent story context for continuity"""
        segments = self.get_story_segments(session_id)
        recent = segments[-num_segments:] if len(segments) >= num_segments else segments
        return "\n\n".join([seg.content for seg in recent])

    def update_user_preferences(self, user_id: str, preferences: UserPreferences):
        """Save or update user preferences"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        now = datetime.now().isoformat()
        prefs_json = preferences.model_dump_json()

        cursor.execute('''
            INSERT OR REPLACE INTO user_preferences (user_id, preferences_json, updated_at)
            VALUES (?, ?, ?)
        ''', (user_id, prefs_json, now))

        conn.commit()
        conn.close()

    def get_user_preferences(self, user_id: str) -> Optional[UserPreferences]:
        """Retrieve user preferences"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            SELECT preferences_json FROM user_preferences WHERE user_id = ?
        ''', (user_id,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return UserPreferences.model_validate_json(row[0])
        return None

    def get_story_summary(self, session_id: str) -> Dict[str, Any]:
        """Get a summary of the current story state"""
        segments = self.get_story_segments(session_id)
        qa = self.get_qa_history(session_id)
        context = self.get_context(session_id)

        return {
            "segment_count": len(segments),
            "total_words": sum(seg.word_count for seg in segments),
            "qa_count": len(qa),
            "context": context,
            "characters": self.current_story_state.characters_introduced if self.current_story_state else [],
            "locations": self.current_story_state.locations_visited if self.current_story_state else []
        }

    def end_session(self, session_id: str):
        """Mark a session as completed"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        now = datetime.now().isoformat()
        cursor.execute('''
            UPDATE sessions SET status = 'completed', updated_at = ?
            WHERE session_id = ?
        ''', (now, session_id))

        conn.commit()
        conn.close()

        self.current_story_state = None
        self.qa_history = []
        self.context_cache = {}

    def clear_session_data(self, session_id: str):
        """Delete all data for a session"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('DELETE FROM story_segments WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM qa_history WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM story_context WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))

        conn.commit()
        conn.close()
