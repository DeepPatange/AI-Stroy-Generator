"""
Module 2: Context Extraction Engine
Transforms user inputs into structured story parameters
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel
from enum import Enum
import re


class Genre(str, Enum):
    FANTASY = "fantasy"
    SCIFI = "science_fiction"
    MYSTERY = "mystery"
    ROMANCE = "romance"
    THRILLER = "thriller"
    ADVENTURE = "adventure"
    HORROR = "horror"


class Tone(str, Enum):
    SERIOUS = "serious"
    LIGHTHEARTED = "lighthearted"
    DARK = "dark"
    HUMOROUS = "humorous"
    PHILOSOPHICAL = "philosophical"


class ConflictType(str, Enum):
    PERSON_VS_PERSON = "person_vs_person"
    PERSON_VS_NATURE = "person_vs_nature"
    PERSON_VS_SELF = "person_vs_self"
    PERSON_VS_SOCIETY = "person_vs_society"
    PERSON_VS_SUPERNATURAL = "person_vs_supernatural"


class Character(BaseModel):
    """Represents a character in the story"""
    name: str
    role: str  # protagonist, antagonist, ally, mentor
    personality: List[str] = []
    motivation: Optional[str] = None
    description: Optional[str] = None


class StoryContext(BaseModel):
    """Complete story context extracted from user inputs"""
    # Setting
    setting_type: Optional[str] = None
    time_period: Optional[str] = None
    atmosphere: Optional[str] = None
    locations: List[str] = []

    # Characters
    protagonist: Optional[Character] = None
    antagonist: Optional[str] = None
    allies: List[str] = []

    # Theme
    genre: Optional[str] = None
    emotional_journey: Optional[str] = None
    themes: List[str] = []
    tone: Optional[str] = None

    # Plot
    conflict_type: Optional[str] = None
    plot_style: Optional[str] = None
    complexity: Optional[str] = None
    ending_preference: Optional[str] = None

    # Additional context
    custom_elements: Dict[str, str] = {}
    continuation_preference: Optional[str] = None


class ContextExtractionEngine:
    """
    Extracts structured story parameters from user Q&A responses.
    Maps free-form and multiple-choice answers to story attributes.
    """

    def __init__(self):
        self.context = StoryContext()
        self._setup_mappings()

    def _setup_mappings(self):
        """Setup keyword mappings for context extraction"""
        self.setting_keywords = {
            "fantasy": ["fantasy", "magic", "castle", "dragon", "magical"],
            "scifi": ["sci-fi", "future", "technology", "space", "futuristic"],
            "modern": ["modern", "real", "contemporary", "present"],
            "historical": ["historical", "past", "medieval", "victorian"],
            "supernatural": ["supernatural", "mysterious", "paranormal"]
        }

        self.genre_keywords = {
            Genre.FANTASY: ["fantasy", "magic", "mythical", "enchanted"],
            Genre.SCIFI: ["science fiction", "sci-fi", "technology", "space"],
            Genre.MYSTERY: ["mystery", "detective", "puzzle", "whodunit"],
            Genre.ROMANCE: ["romance", "love", "relationship"],
            Genre.THRILLER: ["thriller", "suspense", "action"],
            Genre.ADVENTURE: ["adventure", "quest", "exploration"]
        }

        self.tone_keywords = {
            Tone.SERIOUS: ["serious", "dramatic", "intense"],
            Tone.LIGHTHEARTED: ["lighthearted", "fun", "playful"],
            Tone.DARK: ["dark", "gritty", "intense"],
            Tone.HUMOROUS: ["humorous", "funny", "witty", "comedy"],
            Tone.PHILOSOPHICAL: ["philosophical", "reflective", "deep"]
        }

    def extract_from_responses(self, responses: Dict[str, str]) -> StoryContext:
        """
        Extract complete story context from user responses.
        Maps question IDs to context attributes.
        """
        for question_id, answer in responses.items():
            self._process_response(question_id, answer)

        return self.context

    def _process_response(self, question_id: str, answer: str):
        """Process a single response and update context"""
        answer_lower = answer.lower()

        # Setting questions
        if question_id == "setting_1":
            self.context.setting_type = self._extract_setting_type(answer_lower)
        elif question_id == "setting_2":
            self.context.time_period = answer
        elif question_id == "setting_3":
            self.context.atmosphere = answer
        elif question_id == "setting_4":
            self.context.locations = self._extract_locations(answer)

        # Character questions
        elif question_id == "char_1":
            self.context.protagonist = Character(
                name=answer.strip(),
                role="protagonist"
            )
        elif question_id == "char_2":
            if self.context.protagonist:
                self.context.protagonist.personality = self._extract_traits(answer)
        elif question_id == "char_3":
            if self.context.protagonist:
                self.context.protagonist.motivation = answer
        elif question_id == "char_4":
            self.context.allies = self._extract_allies(answer)
        elif question_id == "char_5":
            self.context.antagonist = answer

        # Theme questions
        elif question_id == "theme_1":
            self.context.genre = self._extract_genre(answer_lower)
        elif question_id == "theme_2":
            self.context.emotional_journey = answer
        elif question_id == "theme_3":
            self.context.themes = self._extract_themes(answer)
        elif question_id == "theme_4":
            self.context.tone = self._extract_tone(answer_lower)

        # Plot questions
        elif question_id == "plot_1":
            self.context.conflict_type = self._extract_conflict(answer_lower)
        elif question_id == "plot_2":
            self.context.plot_style = answer
        elif question_id == "plot_3":
            self.context.complexity = answer
        elif question_id == "plot_4":
            self.context.ending_preference = answer

        # Continuation
        elif question_id.startswith("cont_"):
            self.context.continuation_preference = answer

        # Custom (user-added questions or overridden answers)
        elif question_id.startswith("custom_"):
            self.context.custom_elements[question_id] = answer

    def _extract_setting_type(self, answer: str) -> str:
        """Extract setting type from answer"""
        for setting, keywords in self.setting_keywords.items():
            for keyword in keywords:
                if keyword in answer:
                    return setting
        return "fantasy"  # Default

    def _extract_locations(self, answer: str) -> List[str]:
        """Extract location preferences"""
        locations = []
        location_keywords = {
            "city": ["city", "urban", "town", "metropolis"],
            "forest": ["forest", "woods", "jungle", "nature"],
            "space": ["space", "planet", "station", "galaxy"],
            "ocean": ["ocean", "underwater", "sea", "marine"],
            "mountain": ["mountain", "cave", "underground"]
        }
        for loc, keywords in location_keywords.items():
            for keyword in keywords:
                if keyword in answer.lower():
                    locations.append(loc)
                    break
        return locations if locations else ["varied"]

    def _extract_traits(self, answer: str) -> List[str]:
        """Extract personality traits"""
        trait_map = {
            "brave": ["brave", "courageous", "fearless"],
            "clever": ["clever", "witty", "intelligent", "smart"],
            "kind": ["kind", "compassionate", "caring"],
            "mysterious": ["mysterious", "secretive", "enigmatic"],
            "rebellious": ["rebellious", "independent", "defiant"]
        }
        traits = []
        answer_lower = answer.lower()
        for trait, keywords in trait_map.items():
            for keyword in keywords:
                if keyword in answer_lower:
                    traits.append(trait)
                    break
        return traits if traits else ["determined"]

    def _extract_allies(self, answer: str) -> List[str]:
        """Extract ally types"""
        ally_types = []
        answer_lower = answer.lower()

        if "friend" in answer_lower:
            ally_types.append("loyal friend")
        if "mentor" in answer_lower:
            ally_types.append("wise mentor")
        if "group" in answer_lower or "companions" in answer_lower:
            ally_types.append("diverse companions")
        if "stranger" in answer_lower:
            ally_types.append("mysterious stranger")
        if "creature" in answer_lower or "pet" in answer_lower:
            ally_types.append("magical creature")
        if "alone" in answer_lower:
            ally_types.append("solo journey")

        return ally_types if ally_types else ["companions"]

    def _extract_genre(self, answer: str) -> str:
        """Extract genre from answer"""
        for genre, keywords in self.genre_keywords.items():
            for keyword in keywords:
                if keyword in answer:
                    return genre.value
        return Genre.ADVENTURE.value

    def _extract_themes(self, answer: str) -> List[str]:
        """Extract themes from answer"""
        themes = []
        theme_keywords = {
            "friendship": ["friendship", "loyalty", "companion"],
            "sacrifice": ["sacrifice", "heroism", "hero"],
            "identity": ["identity", "self-discovery", "who am i"],
            "power": ["power", "corruption", "control"],
            "nature": ["nature", "environment", "natural"],
            "technology": ["technology", "humanity", "machine"]
        }
        answer_lower = answer.lower()
        for theme, keywords in theme_keywords.items():
            for keyword in keywords:
                if keyword in answer_lower:
                    themes.append(theme)
                    break
        return themes if themes else ["adventure"]

    def _extract_tone(self, answer: str) -> str:
        """Extract narrative tone"""
        for tone, keywords in self.tone_keywords.items():
            for keyword in keywords:
                if keyword in answer:
                    return tone.value
        return Tone.LIGHTHEARTED.value

    def _extract_conflict(self, answer: str) -> str:
        """Extract conflict type"""
        if "person" in answer and "person" in answer[answer.find("person")+6:]:
            return ConflictType.PERSON_VS_PERSON.value
        elif "nature" in answer or "survival" in answer:
            return ConflictType.PERSON_VS_NATURE.value
        elif "self" in answer or "inner" in answer:
            return ConflictType.PERSON_VS_SELF.value
        elif "society" in answer or "rebellion" in answer:
            return ConflictType.PERSON_VS_SOCIETY.value
        elif "supernatural" in answer or "magic" in answer or "god" in answer:
            return ConflictType.PERSON_VS_SUPERNATURAL.value
        return ConflictType.PERSON_VS_PERSON.value

    def extract_entities(self, text: str) -> Dict[str, List[str]]:
        """
        Extract named entities from free-form text.
        Simple regex-based extraction for names, places, etc.
        """
        entities = {
            "names": [],
            "places": [],
            "objects": []
        }

        # Extract capitalized words as potential names/places
        capitalized = re.findall(r'\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)*\b', text)
        for word in capitalized:
            if len(word) > 2:
                entities["names"].append(word)

        return entities

    def get_context_summary(self) -> str:
        """Generate a summary of the current story context"""
        summary_parts = []

        if self.context.setting_type:
            summary_parts.append(f"Setting: {self.context.setting_type}")
        if self.context.time_period:
            summary_parts.append(f"Time: {self.context.time_period}")
        if self.context.protagonist:
            summary_parts.append(f"Protagonist: {self.context.protagonist.name}")
        if self.context.genre:
            summary_parts.append(f"Genre: {self.context.genre}")
        if self.context.tone:
            summary_parts.append(f"Tone: {self.context.tone}")

        return " | ".join(summary_parts) if summary_parts else "No context established yet"

    def update_context(self, key: str, value: Any) -> None:
        """Update a specific context attribute"""
        if hasattr(self.context, key):
            setattr(self.context, key, value)
        else:
            self.context.custom_elements[key] = str(value)

    def reset(self) -> None:
        """Reset the context for a new story"""
        self.context = StoryContext()
