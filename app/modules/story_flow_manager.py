"""
Module 6: Story Flow and Consistency Manager
Ensures narrative coherence and manages story progression
"""

from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel
from enum import Enum
import re


class StoryPhase(str, Enum):
    INTRODUCTION = "introduction"
    RISING_ACTION = "rising_action"
    CLIMAX = "climax"
    FALLING_ACTION = "falling_action"
    RESOLUTION = "resolution"


class ConsistencyIssue(BaseModel):
    """Represents a detected consistency issue"""
    issue_type: str
    description: str
    severity: str  # low, medium, high
    segment_index: int


class CharacterTracker(BaseModel):
    """Tracks character information across the story"""
    name: str
    first_appearance: int  # segment index
    traits: List[str] = []
    relationships: Dict[str, str] = {}
    last_mentioned: int = 0
    status: str = "active"  # active, departed, deceased


class PlotThread(BaseModel):
    """Tracks a plot thread through the story"""
    name: str
    introduced_at: int
    status: str = "active"  # active, resolved, abandoned
    key_events: List[str] = []
    resolution: Optional[str] = None


class StoryFlowManager:
    """
    Manages story flow, tracks consistency, and ensures coherent narrative progression.
    """

    def __init__(self):
        self.current_phase = StoryPhase.INTRODUCTION
        self.characters: Dict[str, CharacterTracker] = {}
        self.plot_threads: List[PlotThread] = []
        self.locations_mentioned: List[str] = []
        self.established_facts: List[str] = []
        self.segment_count = 0
        self.word_count = 0
        self.emotional_beats: List[str] = []

    def analyze_segment(self, segment: str, segment_index: int) -> Dict:
        """
        Analyze a story segment for consistency and flow.
        Returns analysis results and any detected issues.
        """
        analysis = {
            "word_count": len(segment.split()),
            "characters_mentioned": self._extract_characters(segment),
            "locations_mentioned": self._extract_locations(segment),
            "dialogue_count": len(re.findall(r'"[^"]*"', segment)),
            "emotional_tone": self._analyze_tone(segment),
            "issues": []
        }

        # Update word count
        self.word_count += analysis["word_count"]
        self.segment_count = segment_index + 1

        # Check for consistency issues
        issues = self._check_consistency(segment, segment_index, analysis)
        analysis["issues"] = issues

        # Update tracking
        self._update_character_tracking(analysis["characters_mentioned"], segment_index)

        return analysis

    def _extract_characters(self, text: str) -> List[str]:
        """Extract character names from text"""
        # Look for capitalized words that might be names
        # Also look for dialogue attributions
        potential_names = set()

        # Find names in dialogue attributions
        dialogue_pattern = r'"[^"]*"\s*(?:said|asked|replied|exclaimed|whispered|muttered|shouted)\s+(\w+)'
        matches = re.findall(dialogue_pattern, text)
        potential_names.update(matches)

        # Find capitalized proper nouns (simple approach)
        words = text.split()
        for i, word in enumerate(words):
            # Skip first word of sentences
            if i > 0 and words[i-1][-1] not in '.!?"':
                if word[0].isupper() and word.isalpha() and len(word) > 2:
                    potential_names.add(word)

        return list(potential_names)

    def _extract_locations(self, text: str) -> List[str]:
        """Extract location references from text"""
        location_indicators = [
            "in the", "at the", "to the", "from the",
            "near the", "inside the", "outside the",
            "entered the", "left the", "arrived at"
        ]

        locations = []
        text_lower = text.lower()

        for indicator in location_indicators:
            pattern = indicator + r'\s+(\w+(?:\s+\w+)?)'
            matches = re.findall(pattern, text_lower)
            locations.extend(matches)

        return list(set(locations))

    def _analyze_tone(self, text: str) -> str:
        """Analyze the emotional tone of a segment"""
        # Simple keyword-based tone analysis
        tone_keywords = {
            "tense": ["danger", "fear", "threat", "warning", "dark", "shadow", "trembl"],
            "joyful": ["laugh", "smile", "happy", "joy", "delight", "warm", "bright"],
            "sad": ["tears", "cry", "loss", "grief", "sorrow", "pain", "alone"],
            "exciting": ["rush", "race", "heart pound", "thrill", "adventure", "chase"],
            "mysterious": ["mystery", "secret", "hidden", "unknown", "strange", "curious"],
            "romantic": ["love", "heart", "kiss", "embrace", "tender", "passion"]
        }

        text_lower = text.lower()
        tone_scores = {}

        for tone, keywords in tone_keywords.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                tone_scores[tone] = score

        if tone_scores:
            return max(tone_scores, key=tone_scores.get)
        return "neutral"

    def _check_consistency(
        self,
        segment: str,
        segment_index: int,
        analysis: Dict
    ) -> List[ConsistencyIssue]:
        """Check for consistency issues in the segment"""
        issues = []

        # Check character consistency
        for char_name in analysis["characters_mentioned"]:
            if char_name in self.characters:
                tracker = self.characters[char_name]
                # Check if character was marked as departed/deceased
                if tracker.status == "deceased":
                    issues.append(ConsistencyIssue(
                        issue_type="character_continuity",
                        description=f"{char_name} appears but was previously marked as deceased",
                        severity="high",
                        segment_index=segment_index
                    ))

        # Check for very long segments without dialogue
        if analysis["word_count"] > 300 and analysis["dialogue_count"] == 0:
            issues.append(ConsistencyIssue(
                issue_type="pacing",
                description="Long segment without dialogue may affect pacing",
                severity="low",
                segment_index=segment_index
            ))

        return issues

    def _update_character_tracking(self, characters: List[str], segment_index: int):
        """Update character tracking based on segment analysis"""
        for char_name in characters:
            if char_name not in self.characters:
                self.characters[char_name] = CharacterTracker(
                    name=char_name,
                    first_appearance=segment_index
                )
            self.characters[char_name].last_mentioned = segment_index

    def update_story_phase(self) -> StoryPhase:
        """
        Determine and update the current story phase based on progress.
        Uses segment count and word count as indicators.
        """
        # Simple phase progression based on word count
        if self.word_count < 400:
            self.current_phase = StoryPhase.INTRODUCTION
        elif self.word_count < 1200:
            self.current_phase = StoryPhase.RISING_ACTION
        elif self.word_count < 1800:
            self.current_phase = StoryPhase.CLIMAX
        elif self.word_count < 2400:
            self.current_phase = StoryPhase.FALLING_ACTION
        else:
            self.current_phase = StoryPhase.RESOLUTION

        return self.current_phase

    def get_phase_guidance(self) -> str:
        """Get writing guidance based on current story phase"""
        guidance = {
            StoryPhase.INTRODUCTION: """
                Focus on:
                - Establishing the setting and atmosphere
                - Introducing the main character
                - Hinting at the conflict to come
                - Engaging the reader's interest
            """,
            StoryPhase.RISING_ACTION: """
                Focus on:
                - Developing the conflict
                - Deepening character relationships
                - Building tension and stakes
                - Introducing complications
            """,
            StoryPhase.CLIMAX: """
                Focus on:
                - Maximum tension and stakes
                - Pivotal confrontation or decision
                - Character facing their greatest challenge
                - Emotional intensity
            """,
            StoryPhase.FALLING_ACTION: """
                Focus on:
                - Aftermath of the climax
                - Beginning resolution of conflicts
                - Character processing events
                - Moving toward conclusion
            """,
            StoryPhase.RESOLUTION: """
                Focus on:
                - Resolving remaining plot threads
                - Showing character growth
                - Providing emotional closure
                - Ending on a satisfying note
            """
        }
        return guidance.get(self.current_phase, "Continue developing the story naturally.")

    def add_plot_thread(self, name: str, description: str = ""):
        """Add a new plot thread to track"""
        thread = PlotThread(
            name=name,
            introduced_at=self.segment_count,
            key_events=[description] if description else []
        )
        self.plot_threads.append(thread)

    def resolve_plot_thread(self, name: str, resolution: str):
        """Mark a plot thread as resolved"""
        for thread in self.plot_threads:
            if thread.name == name:
                thread.status = "resolved"
                thread.resolution = resolution
                break

    def get_active_threads(self) -> List[PlotThread]:
        """Get all active (unresolved) plot threads"""
        return [t for t in self.plot_threads if t.status == "active"]

    def add_established_fact(self, fact: str):
        """Add a fact that should remain consistent"""
        if fact not in self.established_facts:
            self.established_facts.append(fact)

    def get_story_summary(self) -> Dict:
        """Get a summary of current story state for prompts"""
        return {
            "phase": self.current_phase.value,
            "word_count": self.word_count,
            "segment_count": self.segment_count,
            "characters": list(self.characters.keys()),
            "active_threads": [t.name for t in self.get_active_threads()],
            "locations": self.locations_mentioned[-5:],  # Last 5 locations
            "emotional_progression": self.emotional_beats[-3:]  # Last 3 beats
        }

    def should_suggest_climax(self) -> bool:
        """Check if story should move toward climax"""
        return self.word_count > 1000 and self.current_phase == StoryPhase.RISING_ACTION

    def should_suggest_resolution(self) -> bool:
        """Check if story should move toward resolution"""
        return self.word_count > 1500 and self.current_phase in [
            StoryPhase.CLIMAX, StoryPhase.FALLING_ACTION
        ]

    def get_pacing_suggestion(self) -> Optional[str]:
        """Get suggestion for story pacing"""
        if self.segment_count >= 3 and len(self.characters) < 2:
            return "Consider introducing more characters to create dynamic interactions."

        if self.segment_count >= 4 and not self.plot_threads:
            return "Consider establishing a clear plot thread or conflict."

        if self.should_suggest_climax():
            return "The story is ready to build toward its climax."

        if self.should_suggest_resolution():
            return "Consider moving toward resolution and conclusion."

        return None

    def reset(self):
        """Reset the flow manager for a new story"""
        self.current_phase = StoryPhase.INTRODUCTION
        self.characters = {}
        self.plot_threads = []
        self.locations_mentioned = []
        self.established_facts = []
        self.segment_count = 0
        self.word_count = 0
        self.emotional_beats = []
