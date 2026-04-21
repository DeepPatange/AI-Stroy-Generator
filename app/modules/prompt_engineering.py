"""
Module 4: Prompt Engineering Layer
Constructs optimized prompts for LLM-based story generation
"""

from typing import Dict, List, Optional, Any
from .context_extraction import StoryContext


class PromptTemplate:
    """Base template for prompts"""

    SYSTEM_PROMPT = """You are a creative storytelling AI assistant. Your role is to generate engaging,
coherent, and personalized stories based on user preferences. Follow these guidelines:

1. Maintain consistency with established story elements (characters, settings, plot points)
2. Match the requested tone and genre throughout the narrative
3. Create vivid descriptions and engaging dialogue
4. Develop characters with depth and motivation
5. Build tension and maintain pacing appropriate to the story type
6. Keep responses focused and within the requested length
7. End segments at natural break points that encourage continuation

Always stay true to the user's specified preferences while adding creative flourishes that enhance the narrative."""

    STORY_INIT_TEMPLATE = """Create the opening of a {genre} story with the following specifications:

**Setting:** {setting_description}
**Time Period:** {time_period}
**Atmosphere:** {atmosphere}

**Main Character:** {protagonist_name}
- Personality: {protagonist_personality}
- Motivation: {protagonist_motivation}

**Antagonist/Conflict:** {antagonist}
**Conflict Type:** {conflict_type}

**Themes:** {themes}
**Tone:** {tone}
**Plot Style:** {plot_style}

Write an engaging opening (approximately 300-400 words) that:
1. Introduces the main character in their world
2. Establishes the setting and atmosphere
3. Hints at the conflict to come
4. Hooks the reader's interest
5. Sets up the emotional journey

Begin the story now:"""

    CONTINUATION_TEMPLATE = """Continue the story based on the following context:

**Story So Far:**
{previous_content}

**User's Direction:** {user_choice}

**Remember:**
- Protagonist: {protagonist_name} ({protagonist_personality})
- Genre: {genre}
- Tone: {tone}
- Current themes: {themes}

Write the next segment (approximately 250-350 words) that:
1. Naturally continues from where we left off
2. Incorporates the user's desired direction
3. Maintains character consistency
4. Advances the plot meaningfully
5. Ends at an interesting point for continuation

Continue the story:"""

    CLIMAX_TEMPLATE = """The story is building towards its climax. Continue with heightened tension:

**Story Context:**
{previous_content}

**Character:** {protagonist_name} facing {antagonist}
**Core Conflict:** {conflict_type}
**Emotional Stakes:** {emotional_journey}

Write a climactic segment (300-400 words) with:
1. Increased tension and stakes
2. Character facing their greatest challenge
3. Emotional intensity matching the {tone} tone
4. A pivotal moment or decision

Continue towards the climax:"""

    RESOLUTION_TEMPLATE = """Bring the story to a {ending_type} conclusion:

**Story Summary:**
{story_summary}

**Character Arc:** {protagonist_name}'s journey of {protagonist_motivation}
**Themes to Resolve:** {themes}
**Preferred Ending:** {ending_preference}

Write a satisfying conclusion (300-400 words) that:
1. Resolves the main conflict
2. Shows character growth
3. Addresses key themes
4. Provides emotional closure
5. Matches the {ending_preference} ending style

Conclude the story:"""

    CHOICE_GENERATION_TEMPLATE = """Based on the current story state, generate meaningful choices for the reader:

**Current Scene:**
{current_scene}

**Character:** {protagonist_name}
**Genre:** {genre}

Generate 3-4 distinct choices that:
1. Are meaningful and affect the story direction
2. Stay consistent with the established world and characters
3. Offer different types of experiences (action, dialogue, exploration, etc.)
4. Are written as brief, engaging options

Format each choice on a new line, starting with a number."""


class PromptEngineeringLayer:
    """
    Constructs dynamic prompts for LLM story generation.
    Adapts prompts based on context, user preferences, and story state.
    """

    def __init__(self):
        self.templates = PromptTemplate()

    def build_system_prompt(self, context: Optional[StoryContext] = None) -> str:
        """Build the system prompt with optional context adjustments"""
        base_prompt = self.templates.SYSTEM_PROMPT

        if context:
            # Add genre-specific instructions
            genre_additions = self._get_genre_instructions(context.genre)
            if genre_additions:
                base_prompt += f"\n\nGenre-specific guidance for {context.genre}:\n{genre_additions}"

            # Add tone adjustments
            tone_additions = self._get_tone_instructions(context.tone)
            if tone_additions:
                base_prompt += f"\n\nTone guidance:\n{tone_additions}"

        return base_prompt

    def _get_genre_instructions(self, genre: Optional[str]) -> str:
        """Get genre-specific writing instructions"""
        genre_guides = {
            "fantasy": """- Include magical elements and wonder
- Build a rich, immersive world with its own rules
- Create mythical creatures or beings when appropriate
- Use evocative, descriptive language for magical scenes""",

            "science_fiction": """- Ground technology in plausible science
- Explore the human impact of technological change
- Create a consistent future world with clear rules
- Balance exposition with action and character""",

            "mystery": """- Plant clues and red herrings naturally
- Build suspense through careful pacing
- Keep the reader guessing but play fair
- Develop a logical solution that fits the clues""",

            "romance": """- Focus on emotional development between characters
- Create meaningful moments of connection
- Build tension through obstacles and misunderstandings
- Show character growth through relationship dynamics""",

            "thriller": """- Maintain a fast pace with constant tension
- Create a sense of danger and urgency
- Use short, punchy sentences during action scenes
- Build to climactic confrontations""",

            "adventure": """- Create exciting set pieces and action sequences
- Include exploration and discovery
- Balance action with character moments
- Build a sense of wonder and excitement"""
        }
        return genre_guides.get(genre, "")

    def _get_tone_instructions(self, tone: Optional[str]) -> str:
        """Get tone-specific writing instructions"""
        tone_guides = {
            "serious": """- Use measured, thoughtful prose
- Explore complex emotions and motivations
- Avoid frivolity during important moments
- Create weight and significance in key scenes""",

            "lighthearted": """- Include humor and playful moments
- Keep the overall mood upbeat
- Allow characters to have fun
- Don't dwell on dark themes""",

            "dark": """- Explore shadows and moral complexity
- Create atmosphere through description
- Don't shy away from difficult themes
- Build tension through uncertainty""",

            "humorous": """- Include witty dialogue and banter
- Find humor in situations and characters
- Use comedic timing in prose
- Balance humor with story progression""",

            "philosophical": """- Explore deeper meanings and questions
- Give characters reflective moments
- Weave themes throughout the narrative
- Create thought-provoking scenarios"""
        }
        return tone_guides.get(tone, "")

    def build_story_init_prompt(self, context: StoryContext) -> str:
        """Build the initial story generation prompt"""
        # Prepare protagonist info
        protagonist_name = context.protagonist.name if context.protagonist else "the protagonist"
        protagonist_personality = ", ".join(context.protagonist.personality) if context.protagonist and context.protagonist.personality else "determined"
        protagonist_motivation = context.protagonist.motivation if context.protagonist and context.protagonist.motivation else "their goal"

        # Build setting description
        setting_desc = self._build_setting_description(context)

        prompt = self.templates.STORY_INIT_TEMPLATE.format(
            genre=context.genre or "adventure",
            setting_description=setting_desc,
            time_period=context.time_period or "unspecified time",
            atmosphere=context.atmosphere or "engaging",
            protagonist_name=protagonist_name,
            protagonist_personality=protagonist_personality,
            protagonist_motivation=protagonist_motivation,
            antagonist=context.antagonist or "unknown forces",
            conflict_type=context.conflict_type or "external challenges",
            themes=", ".join(context.themes) if context.themes else "adventure and discovery",
            tone=context.tone or "balanced",
            plot_style=context.plot_style or "engaging narrative"
        )

        if context.custom_elements:
            extras = "\n".join(f"- {v}" for v in context.custom_elements.values() if v)
            if extras:
                prompt += "\n\nAdditional user preferences to honor:\n" + extras

        return prompt

    def _build_setting_description(self, context: StoryContext) -> str:
        """Build a descriptive setting string"""
        parts = []

        if context.setting_type:
            setting_descriptions = {
                "fantasy": "a magical realm where wonder and danger intertwine",
                "scifi": "a technologically advanced world of the future",
                "modern": "the contemporary world we know",
                "historical": "a richly detailed historical period",
                "supernatural": "a world where the supernatural bleeds into reality"
            }
            parts.append(setting_descriptions.get(context.setting_type, context.setting_type))

        if context.locations:
            location_str = ", ".join(context.locations)
            parts.append(f"featuring {location_str}")

        return " ".join(parts) if parts else "an engaging world"

    def build_continuation_prompt(
        self,
        context: StoryContext,
        previous_content: str,
        user_choice: str
    ) -> str:
        """Build a prompt for story continuation"""
        protagonist_name = context.protagonist.name if context.protagonist else "the protagonist"
        protagonist_personality = ", ".join(context.protagonist.personality) if context.protagonist and context.protagonist.personality else "determined"

        # Truncate previous content if too long (keep last ~500 words)
        words = previous_content.split()
        if len(words) > 500:
            previous_content = "... " + " ".join(words[-500:])

        prompt = self.templates.CONTINUATION_TEMPLATE.format(
            previous_content=previous_content,
            user_choice=user_choice,
            protagonist_name=protagonist_name,
            protagonist_personality=protagonist_personality,
            genre=context.genre or "adventure",
            tone=context.tone or "balanced",
            themes=", ".join(context.themes) if context.themes else "the story themes"
        )

        return prompt

    def build_climax_prompt(
        self,
        context: StoryContext,
        previous_content: str
    ) -> str:
        """Build a prompt for climactic story moment"""
        protagonist_name = context.protagonist.name if context.protagonist else "the protagonist"

        prompt = self.templates.CLIMAX_TEMPLATE.format(
            previous_content=previous_content[-1500:],  # Last ~1500 chars
            protagonist_name=protagonist_name,
            antagonist=context.antagonist or "their greatest challenge",
            conflict_type=context.conflict_type or "the central conflict",
            emotional_journey=context.emotional_journey or "their journey",
            tone=context.tone or "intense"
        )

        return prompt

    def build_resolution_prompt(
        self,
        context: StoryContext,
        story_summary: str
    ) -> str:
        """Build a prompt for story resolution"""
        protagonist_name = context.protagonist.name if context.protagonist else "the protagonist"

        # Map ending preferences to types
        ending_type_map = {
            "Happy ending where everything works out": "happy and satisfying",
            "Bittersweet with some sacrifice": "bittersweet",
            "Ambiguous, leaving some mystery": "ambiguous",
            "Open-ended for continuation": "open-ended",
            "Unexpected twist ending": "surprising twist"
        }

        ending_type = "satisfying"
        for key, value in ending_type_map.items():
            if context.ending_preference and key.lower() in context.ending_preference.lower():
                ending_type = value
                break

        prompt = self.templates.RESOLUTION_TEMPLATE.format(
            ending_type=ending_type,
            story_summary=story_summary,
            protagonist_name=protagonist_name,
            protagonist_motivation=context.protagonist.motivation if context.protagonist else "their goal",
            themes=", ".join(context.themes) if context.themes else "the story themes",
            ending_preference=context.ending_preference or "satisfying"
        )

        return prompt

    def build_choice_prompt(
        self,
        context: StoryContext,
        current_scene: str
    ) -> str:
        """Build a prompt for generating story choices"""
        protagonist_name = context.protagonist.name if context.protagonist else "the protagonist"

        prompt = self.templates.CHOICE_GENERATION_TEMPLATE.format(
            current_scene=current_scene[-800:],  # Last ~800 chars
            protagonist_name=protagonist_name,
            genre=context.genre or "adventure"
        )

        return prompt

    def build_custom_prompt(
        self,
        instruction: str,
        context: StoryContext,
        additional_context: Optional[str] = None
    ) -> str:
        """Build a custom prompt with context"""
        parts = [instruction]

        # Add story context
        context_parts = []
        if context.protagonist:
            context_parts.append(f"Protagonist: {context.protagonist.name}")
        if context.genre:
            context_parts.append(f"Genre: {context.genre}")
        if context.tone:
            context_parts.append(f"Tone: {context.tone}")

        if context_parts:
            parts.append("\n\nStory Context:\n" + "\n".join(context_parts))

        if additional_context:
            parts.append(f"\n\nAdditional Context:\n{additional_context}")

        return "\n".join(parts)

    def format_messages_for_llm(
        self,
        system_prompt: str,
        user_prompt: str,
        conversation_history: Optional[List[Dict[str, str]]] = None
    ) -> List[Dict[str, str]]:
        """Format prompts into message format for LLM API"""
        messages = [{"role": "system", "content": system_prompt}]

        # Add conversation history if provided
        if conversation_history:
            for msg in conversation_history[-10:]:  # Keep last 10 exchanges
                messages.append(msg)

        # Add current user prompt
        messages.append({"role": "user", "content": user_prompt})

        return messages
