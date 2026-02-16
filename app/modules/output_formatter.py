"""
Module 7: Output Formatter
Prepares and formats story content for delivery
"""

from typing import Dict, List, Optional
from pydantic import BaseModel
import re
import html


class FormattedStory(BaseModel):
    """Formatted story output"""
    title: Optional[str] = None
    content: str
    html_content: str
    word_count: int
    paragraph_count: int
    has_dialogue: bool


class StoryChoice(BaseModel):
    """A choice option for story continuation"""
    id: int
    text: str
    description: Optional[str] = None


class OutputFormatter:
    """
    Formats and prepares story content for various output formats.
    Handles text cleaning, HTML conversion, and choice presentation.
    """

    def __init__(self):
        self.paragraph_min_length = 50
        self.dialogue_pattern = re.compile(r'"([^"]*)"')

    def format_story_segment(self, raw_text: str) -> FormattedStory:
        """
        Format a raw story segment for display.

        Args:
            raw_text: Raw generated text from LLM

        Returns:
            FormattedStory with cleaned and formatted content
        """
        # Clean the text
        cleaned = self._clean_text(raw_text)

        # Format paragraphs
        paragraphs = self._split_paragraphs(cleaned)
        formatted_paragraphs = [self._format_paragraph(p) for p in paragraphs if p.strip()]

        # Create plain text version
        plain_text = "\n\n".join(formatted_paragraphs)

        # Create HTML version
        html_content = self._to_html(formatted_paragraphs)

        # Analyze content
        word_count = len(plain_text.split())
        has_dialogue = bool(self.dialogue_pattern.search(plain_text))

        return FormattedStory(
            content=plain_text,
            html_content=html_content,
            word_count=word_count,
            paragraph_count=len(formatted_paragraphs),
            has_dialogue=has_dialogue
        )

    def _clean_text(self, text: str) -> str:
        """Clean raw LLM output"""
        # Remove any markdown artifacts
        text = re.sub(r'\*\*([^*]+)\*\*', r'\1', text)  # Bold
        text = re.sub(r'\*([^*]+)\*', r'\1', text)  # Italic
        text = re.sub(r'#{1,6}\s+', '', text)  # Headers

        # Remove multiple newlines
        text = re.sub(r'\n{3,}', '\n\n', text)

        # Clean up spaces
        text = re.sub(r'  +', ' ', text)

        # Remove any system-like prefixes
        text = re.sub(r'^(Story:|Chapter \d+:|Opening:)\s*', '', text.strip())

        return text.strip()

    def _split_paragraphs(self, text: str) -> List[str]:
        """Split text into paragraphs"""
        # Split on double newlines or single newlines that separate distinct thoughts
        paragraphs = text.split('\n\n')

        # Further split long paragraphs at natural break points
        result = []
        for para in paragraphs:
            para = para.strip()
            if len(para) > 500:
                # Try to split at sentence boundaries
                sentences = re.split(r'(?<=[.!?])\s+', para)
                current = ""
                for sentence in sentences:
                    if len(current) + len(sentence) > 400 and current:
                        result.append(current.strip())
                        current = sentence
                    else:
                        current += " " + sentence if current else sentence
                if current:
                    result.append(current.strip())
            else:
                result.append(para)

        return result

    def _format_paragraph(self, paragraph: str) -> str:
        """Format a single paragraph"""
        # Ensure proper spacing after punctuation
        paragraph = re.sub(r'([.!?])([A-Z])', r'\1 \2', paragraph)

        # Ensure proper quote formatting
        paragraph = re.sub(r'"\s+', '"', paragraph)
        paragraph = re.sub(r'\s+"', ' "', paragraph)

        # Capitalize first letter
        if paragraph and paragraph[0].islower():
            paragraph = paragraph[0].upper() + paragraph[1:]

        return paragraph.strip()

    def _to_html(self, paragraphs: List[str]) -> str:
        """Convert paragraphs to HTML format"""
        html_parts = []

        for para in paragraphs:
            # Escape HTML entities
            escaped = html.escape(para)

            # Style dialogue
            escaped = re.sub(
                r'"([^"]*)"',
                r'<span class="dialogue">"\1"</span>',
                escaped
            )

            html_parts.append(f'<p>{escaped}</p>')

        return '\n'.join(html_parts)

    def format_choices(self, choices: List[str]) -> List[StoryChoice]:
        """Format story continuation choices"""
        formatted = []
        for i, choice in enumerate(choices, 1):
            # Clean the choice text
            cleaned = choice.strip()
            cleaned = re.sub(r'^\d+[.)]\s*', '', cleaned)  # Remove numbering

            formatted.append(StoryChoice(
                id=i,
                text=cleaned,
                description=None
            ))

        return formatted

    def format_full_story(
        self,
        segments: List[str],
        title: Optional[str] = None
    ) -> FormattedStory:
        """Format a complete story from multiple segments"""
        # Combine all segments
        combined = "\n\n---\n\n".join(segments)

        # Format as a single piece
        formatted = self.format_story_segment(combined)

        if title:
            formatted.title = title

        return formatted

    def create_story_html_page(
        self,
        story: FormattedStory,
        include_styles: bool = True
    ) -> str:
        """Create a complete HTML page for the story"""
        styles = """
        <style>
            body {
                font-family: 'Georgia', serif;
                max-width: 800px;
                margin: 0 auto;
                padding: 40px 20px;
                line-height: 1.8;
                color: #333;
                background-color: #fafafa;
            }
            h1 {
                text-align: center;
                color: #2c3e50;
                margin-bottom: 40px;
                font-size: 2em;
            }
            p {
                margin-bottom: 1.5em;
                text-indent: 2em;
                text-align: justify;
            }
            p:first-of-type {
                text-indent: 0;
            }
            p:first-of-type::first-letter {
                font-size: 3em;
                float: left;
                line-height: 1;
                padding-right: 8px;
                color: #2c3e50;
            }
            .dialogue {
                color: #1a5276;
            }
            .story-info {
                text-align: center;
                color: #7f8c8d;
                font-size: 0.9em;
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #ddd;
            }
        </style>
        """ if include_styles else ""

        title_html = f"<h1>{html.escape(story.title)}</h1>" if story.title else ""

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{story.title or 'Your Story'}</title>
    {styles}
</head>
<body>
    {title_html}
    <article class="story-content">
        {story.html_content}
    </article>
    <div class="story-info">
        <p>{story.word_count} words | {story.paragraph_count} paragraphs</p>
    </div>
</body>
</html>"""

    def format_for_download(self, story: FormattedStory, format_type: str = "txt") -> str:
        """Format story for download in specified format"""
        if format_type == "txt":
            header = f"{'=' * 50}\n"
            if story.title:
                header += f"{story.title}\n{'=' * 50}\n\n"
            return header + story.content + f"\n\n{'=' * 50}\nWord Count: {story.word_count}"

        elif format_type == "md":
            header = f"# {story.title}\n\n" if story.title else ""
            return header + story.content + f"\n\n---\n*Word Count: {story.word_count}*"

        elif format_type == "html":
            return self.create_story_html_page(story)

        return story.content

    def create_choice_html(self, choices: List[StoryChoice]) -> str:
        """Create HTML for choice buttons"""
        buttons = []
        for choice in choices:
            buttons.append(f'''
                <button class="choice-btn" data-choice-id="{choice.id}" onclick="selectChoice({choice.id})">
                    {html.escape(choice.text)}
                </button>
            ''')

        return f'''
        <div class="story-choices">
            <h3>What happens next?</h3>
            {''.join(buttons)}
        </div>
        '''

    def summarize_story(self, content: str, max_words: int = 100) -> str:
        """Create a brief summary of the story content"""
        words = content.split()
        if len(words) <= max_words:
            return content

        # Take first portion and add ellipsis
        summary = " ".join(words[:max_words])

        # Try to end at a sentence boundary
        last_period = summary.rfind('.')
        if last_period > max_words * 0.7:  # At least 70% of target length
            summary = summary[:last_period + 1]
        else:
            summary += "..."

        return summary
