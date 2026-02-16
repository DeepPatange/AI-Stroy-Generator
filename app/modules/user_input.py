"""
Module 1: User Input Acquisition
Handles Q&A framework for capturing user preferences through structured questioning
"""

from typing import Dict, List, Optional
from pydantic import BaseModel
from enum import Enum


class QuestionPhase(str, Enum):
    SETTING = "setting"
    CHARACTER = "character"
    THEME = "theme"
    PLOT = "plot"
    CONTINUATION = "continuation"


class Question(BaseModel):
    """Represents a single question in the Q&A flow"""
    id: str
    phase: QuestionPhase
    text: str
    options: Optional[List[str]] = None
    is_required: bool = True
    follow_up: Optional[str] = None


class UserResponse(BaseModel):
    """Represents a user's response to a question"""
    question_id: str
    answer: str
    timestamp: Optional[str] = None


class UserInputAcquisition:
    """
    Handles structured Q&A interaction with users to capture story preferences.
    Implements adaptive questioning based on previous responses.
    """

    def __init__(self):
        self.questions_db = self._initialize_questions()
        self.current_phase = QuestionPhase.SETTING
        self.responses: List[UserResponse] = []

    def _initialize_questions(self) -> Dict[str, List[Question]]:
        """Initialize the structured question database"""
        return {
            QuestionPhase.SETTING: [
                Question(
                    id="setting_1",
                    phase=QuestionPhase.SETTING,
                    text="Where should this story take place?",
                    options=[
                        "A magical fantasy realm with castles and dragons",
                        "A futuristic sci-fi world with advanced technology",
                        "The real modern world we live in",
                        "A historical setting from the past",
                        "A mysterious supernatural dimension"
                    ]
                ),
                Question(
                    id="setting_2",
                    phase=QuestionPhase.SETTING,
                    text="What time period appeals to you for this story?",
                    options=[
                        "Ancient times (medieval, mythological)",
                        "Historical past (Victorian, Renaissance, etc.)",
                        "Present day (contemporary)",
                        "Near future (next 50-100 years)",
                        "Distant future (space age, post-apocalyptic)"
                    ]
                ),
                Question(
                    id="setting_3",
                    phase=QuestionPhase.SETTING,
                    text="What kind of atmosphere do you prefer?",
                    options=[
                        "Dark and mysterious",
                        "Bright and adventurous",
                        "Romantic and emotional",
                        "Comedic and lighthearted",
                        "Thrilling and suspenseful"
                    ]
                ),
                Question(
                    id="setting_4",
                    phase=QuestionPhase.SETTING,
                    text="Are there any specific locations you'd like featured?",
                    options=[
                        "Bustling cities and urban environments",
                        "Enchanted forests and natural landscapes",
                        "Space stations or alien planets",
                        "Underwater kingdoms or oceanic adventures",
                        "Mountains, caves, or underground realms"
                    ],
                    is_required=False
                )
            ],
            QuestionPhase.CHARACTER: [
                Question(
                    id="char_1",
                    phase=QuestionPhase.CHARACTER,
                    text="What should be the name of your main character? (Type your answer)",
                    options=None
                ),
                Question(
                    id="char_2",
                    phase=QuestionPhase.CHARACTER,
                    text="What personality traits should your main character have?",
                    options=[
                        "Brave and courageous",
                        "Clever and witty",
                        "Kind and compassionate",
                        "Mysterious and secretive",
                        "Rebellious and independent"
                    ]
                ),
                Question(
                    id="char_3",
                    phase=QuestionPhase.CHARACTER,
                    text="What motivates your character?",
                    options=[
                        "Love and relationships",
                        "Revenge or justice",
                        "Curiosity and discovery",
                        "Duty and responsibility",
                        "Survival and protection",
                        "Redemption and forgiveness"
                    ]
                ),
                Question(
                    id="char_4",
                    phase=QuestionPhase.CHARACTER,
                    text="Should there be companions or allies? What kind?",
                    options=[
                        "A loyal best friend",
                        "A wise mentor figure",
                        "A group of diverse companions",
                        "A mysterious stranger who helps",
                        "A magical creature or pet",
                        "The character journeys alone"
                    ],
                    is_required=False
                ),
                Question(
                    id="char_5",
                    phase=QuestionPhase.CHARACTER,
                    text="What kind of antagonist or obstacle should your character face?",
                    options=[
                        "A powerful villain with dark motives",
                        "A corrupt organization or government",
                        "Forces of nature or supernatural threats",
                        "Internal struggles and personal demons",
                        "A rival with conflicting goals",
                        "An ancient evil awakening"
                    ]
                )
            ],
            QuestionPhase.THEME: [
                Question(
                    id="theme_1",
                    phase=QuestionPhase.THEME,
                    text="What genre best describes your ideal story?",
                    options=[
                        "Fantasy (magic, mythical creatures)",
                        "Science Fiction (technology, space)",
                        "Mystery (puzzles, detective work)",
                        "Romance (love stories, relationships)",
                        "Thriller (suspense, action)",
                        "Adventure (quests, exploration)"
                    ]
                ),
                Question(
                    id="theme_2",
                    phase=QuestionPhase.THEME,
                    text="What emotional journey should the story take?",
                    options=[
                        "Uplifting and inspiring",
                        "Bittersweet with mixed emotions",
                        "Thrilling and exciting",
                        "Thought-provoking and philosophical",
                        "Heartwarming and comforting"
                    ]
                ),
                Question(
                    id="theme_3",
                    phase=QuestionPhase.THEME,
                    text="Are there themes you'd like explored?",
                    options=[
                        "Friendship and loyalty",
                        "Sacrifice and heroism",
                        "Identity and self-discovery",
                        "Power and corruption",
                        "Nature and environment",
                        "Technology and humanity"
                    ],
                    is_required=False
                ),
                Question(
                    id="theme_4",
                    phase=QuestionPhase.THEME,
                    text="What tone do you prefer for the narrative?",
                    options=[
                        "Serious and dramatic",
                        "Lighthearted and fun",
                        "Dark and intense",
                        "Humorous with witty dialogue",
                        "Philosophical and reflective"
                    ]
                )
            ],
            QuestionPhase.PLOT: [
                Question(
                    id="plot_1",
                    phase=QuestionPhase.PLOT,
                    text="What kind of conflict should drive the story?",
                    options=[
                        "Person vs. Person (battles, rivalries)",
                        "Person vs. Nature (survival, disasters)",
                        "Person vs. Self (inner struggles)",
                        "Person vs. Society (rebellion, justice)",
                        "Person vs. Supernatural (magic, gods)"
                    ]
                ),
                Question(
                    id="plot_2",
                    phase=QuestionPhase.PLOT,
                    text="Do you prefer action-heavy plots or character-driven stories?",
                    options=[
                        "Action-heavy with lots of excitement",
                        "Character-driven with deep emotions",
                        "A balanced mix of both",
                        "Mystery-focused with puzzles to solve",
                        "Dialogue-heavy with witty conversations"
                    ]
                ),
                Question(
                    id="plot_3",
                    phase=QuestionPhase.PLOT,
                    text="How complex should the plot be?",
                    options=[
                        "Straightforward and easy to follow",
                        "Moderately complex with some twists",
                        "Intricate with multiple plot threads",
                        "Full of surprises and unexpected turns"
                    ]
                ),
                Question(
                    id="plot_4",
                    phase=QuestionPhase.PLOT,
                    text="What kind of ending appeals to you?",
                    options=[
                        "Happy ending where everything works out",
                        "Bittersweet with some sacrifice",
                        "Ambiguous, leaving some mystery",
                        "Open-ended for continuation",
                        "Unexpected twist ending"
                    ]
                )
            ],
            QuestionPhase.CONTINUATION: [
                Question(
                    id="cont_1",
                    phase=QuestionPhase.CONTINUATION,
                    text="What would you like to happen next in the story?",
                    options=[
                        "Continue with more action and adventure",
                        "Develop the characters and relationships",
                        "Introduce a new challenge or mystery",
                        "Move towards the climax and resolution",
                        "Add a surprising twist"
                    ]
                ),
                Question(
                    id="cont_2",
                    phase=QuestionPhase.CONTINUATION,
                    text="How would you like the story to continue?",
                    options=None  # Free-form input
                )
            ]
        }

    def get_questions_for_phase(self, phase: QuestionPhase) -> List[Question]:
        """Get all questions for a specific phase"""
        return self.questions_db.get(phase, [])

    def get_next_question(self, current_question_id: Optional[str] = None) -> Optional[Question]:
        """
        Get the next question based on current progress.
        Implements adaptive questioning logic.
        """
        phases = list(QuestionPhase)

        if current_question_id is None:
            # Start with first question of first phase
            return self.questions_db[QuestionPhase.SETTING][0]

        # Find current question and return next
        for phase in phases:
            questions = self.questions_db.get(phase, [])
            for i, q in enumerate(questions):
                if q.id == current_question_id:
                    # Check if there's a next question in same phase
                    if i + 1 < len(questions):
                        return questions[i + 1]
                    # Move to next phase
                    current_phase_idx = phases.index(phase)
                    if current_phase_idx + 1 < len(phases) - 1:  # Exclude CONTINUATION
                        next_phase = phases[current_phase_idx + 1]
                        next_questions = self.questions_db.get(next_phase, [])
                        if next_questions:
                            return next_questions[0]
                    return None  # All initial questions completed

        return None

    def add_response(self, question_id: str, answer: str) -> None:
        """Record a user's response"""
        from datetime import datetime
        response = UserResponse(
            question_id=question_id,
            answer=answer,
            timestamp=datetime.now().isoformat()
        )
        self.responses.append(response)

    def get_all_responses(self) -> Dict[str, str]:
        """Get all responses as a dictionary"""
        return {r.question_id: r.answer for r in self.responses}

    def get_continuation_question(self) -> Question:
        """Get a question for story continuation"""
        return self.questions_db[QuestionPhase.CONTINUATION][0]

    def validate_response(self, question: Question, answer: str) -> bool:
        """Validate if a response is acceptable"""
        if not answer or not answer.strip():
            return not question.is_required
        return True

    def reset(self) -> None:
        """Reset all responses for a new session"""
        self.responses = []
        self.current_phase = QuestionPhase.SETTING
