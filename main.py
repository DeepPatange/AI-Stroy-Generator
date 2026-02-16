"""
Q&A Based Interactive Storytelling System
Main FastAPI Application

Run with: uvicorn main:app --reload
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
import uuid

# Import modules
from app.modules.user_input import UserInputAcquisition, QuestionPhase
from app.modules.context_extraction import ContextExtractionEngine, StoryContext
from app.modules.knowledge_memory import KnowledgeMemoryModule
from app.modules.prompt_engineering import PromptEngineeringLayer
from app.modules.story_generator import StoryGenerator, LLMConfig, LLMProvider
from app.modules.story_flow_manager import StoryFlowManager
from app.modules.output_formatter import OutputFormatter

from config import (
    LLM_PROVIDER, OLLAMA_MODEL, OLLAMA_BASE_URL,
    OPENAI_API_KEY, OPENAI_MODEL, TEMPERATURE
)

# Initialize FastAPI app
app = FastAPI(
    title="Q&A Interactive Storytelling",
    description="Generate personalized stories through interactive Q&A",
    version="1.0.0"
)

# Mount static files and templates
app.mount("/static", StaticFiles(directory="app/static"), name="static")
templates = Jinja2Templates(directory="app/templates")

# Initialize components
user_input_module = UserInputAcquisition()
context_engine = ContextExtractionEngine()
memory_module = KnowledgeMemoryModule()
prompt_layer = PromptEngineeringLayer()
flow_manager = StoryFlowManager()
output_formatter = OutputFormatter()

# Initialize LLM
llm_config = LLMConfig(
    provider=LLMProvider(LLM_PROVIDER),
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
    api_key=OPENAI_API_KEY if LLM_PROVIDER == "openai" else None,
    temperature=TEMPERATURE
)
story_generator = StoryGenerator(llm_config)

# Session storage (in-memory for simplicity)
sessions: Dict[str, Dict] = {}


# Request/Response Models
class ResponseSubmission(BaseModel):
    session_id: str
    question_id: str
    answer: str


class StoryGenerationRequest(BaseModel):
    session_id: str
    responses: Dict[str, str]


class StoryContinuationRequest(BaseModel):
    session_id: str
    user_choice: str


class SettingsUpdate(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    temperature: Optional[float] = None
    api_key: Optional[str] = None


# Routes
@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    """Serve the main application page"""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/api/status")
async def get_status():
    """Check system and LLM status"""
    llm_status = await story_generator.check_availability()
    return {
        "status": "online",
        "llm_available": llm_status["available"],
        "provider": llm_status["provider"],
        "model": llm_status["model"],
        "available_models": llm_status.get("available_models", [])
    }


@app.post("/api/session/new")
async def create_session():
    """Create a new storytelling session"""
    session_id = str(uuid.uuid4())

    # Initialize session
    sessions[session_id] = {
        "user_input": UserInputAcquisition(),
        "context_engine": ContextExtractionEngine(),
        "flow_manager": StoryFlowManager(),
        "responses": {},
        "story_segments": [],
        "current_question_index": 0
    }

    # Create database session
    memory_module.create_session(session_id)

    return {"session_id": session_id, "message": "Session created successfully"}


@app.get("/api/question/next")
async def get_next_question(current_id: Optional[str] = None):
    """Get the next question in the Q&A flow"""
    question = user_input_module.get_next_question(current_id)

    if question is None:
        return {"completed": True, "message": "All questions answered"}

    # Calculate progress
    all_questions = []
    for phase in QuestionPhase:
        if phase != QuestionPhase.CONTINUATION:
            all_questions.extend(user_input_module.get_questions_for_phase(phase))

    current_index = 0
    for i, q in enumerate(all_questions):
        if q.id == question.id:
            current_index = i
            break

    progress = {
        "answered": current_index,
        "total": len(all_questions),
        "percentage": int((current_index / len(all_questions)) * 100)
    }

    return {
        "completed": False,
        "question": {
            "id": question.id,
            "phase": question.phase.value,
            "text": question.text,
            "options": question.options,
            "is_required": question.is_required
        },
        "progress": progress
    }


@app.post("/api/response")
async def submit_response(data: ResponseSubmission):
    """Submit a response to a question"""
    if data.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[data.session_id]

    # Store response
    session["responses"][data.question_id] = data.answer
    session["user_input"].add_response(data.question_id, data.answer)

    # Save to database
    question = None
    for phase in QuestionPhase:
        for q in user_input_module.get_questions_for_phase(phase):
            if q.id == data.question_id:
                question = q
                break
        if question:
            break

    if question:
        memory_module.save_qa_response(
            data.session_id,
            data.question_id,
            question.text,
            data.answer
        )

    return {"status": "success", "message": "Response recorded"}


@app.post("/api/story/generate")
async def generate_story(data: StoryGenerationRequest):
    """Generate the initial story based on collected responses"""
    if data.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[data.session_id]

    try:
        # Extract context from responses
        context = session["context_engine"].extract_from_responses(data.responses)

        # Save context
        memory_module.save_context(data.session_id, context.model_dump())

        # Build prompts
        system_prompt = prompt_layer.build_system_prompt(context)
        user_prompt = prompt_layer.build_story_init_prompt(context)

        # Generate story
        story_content = await story_generator.generate_story_segment(
            system_prompt,
            user_prompt
        )

        # Format output
        formatted = output_formatter.format_story_segment(story_content)

        # Analyze for flow tracking
        flow_manager.analyze_segment(story_content, 0)
        flow_manager.update_story_phase()

        # Store segment
        session["story_segments"].append(story_content)
        memory_module.add_story_segment(data.session_id, story_content)

        # Generate choices for continuation
        choice_prompt = prompt_layer.build_choice_prompt(context, story_content)
        choices = await story_generator.generate_choices(choice_prompt)

        return {
            "content": formatted.content,
            "html_content": formatted.html_content,
            "word_count": formatted.word_count,
            "paragraph_count": formatted.paragraph_count,
            "segment_count": 1,
            "phase": flow_manager.current_phase.value,
            "choices": choices
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/story/continue")
async def continue_story(data: StoryContinuationRequest):
    """Continue the story based on user choice"""
    if data.session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[data.session_id]

    try:
        # Get context
        context_data = memory_module.get_context(data.session_id)
        if context_data:
            context = StoryContext(**context_data)
        else:
            context = session["context_engine"].context

        # Get previous content
        previous_content = memory_module.get_recent_context(data.session_id, 2)

        # Build continuation prompt
        system_prompt = prompt_layer.build_system_prompt(context)

        # Check if we should move toward climax or resolution
        if flow_manager.should_suggest_resolution():
            user_prompt = prompt_layer.build_resolution_prompt(context, previous_content)
        elif flow_manager.should_suggest_climax():
            user_prompt = prompt_layer.build_climax_prompt(context, previous_content)
        else:
            user_prompt = prompt_layer.build_continuation_prompt(
                context, previous_content, data.user_choice
            )

        # Generate continuation
        story_content = await story_generator.generate_story_segment(
            system_prompt,
            user_prompt,
            story_generator.get_history()
        )

        # Format output
        formatted = output_formatter.format_story_segment(story_content)

        # Update flow tracking
        segment_index = len(session["story_segments"])
        flow_manager.analyze_segment(story_content, segment_index)
        flow_manager.update_story_phase()

        # Store segment
        session["story_segments"].append(story_content)
        memory_module.add_story_segment(
            data.session_id,
            story_content,
            user_choice=data.user_choice
        )

        # Generate new choices
        choice_prompt = prompt_layer.build_choice_prompt(context, story_content)
        choices = await story_generator.generate_choices(choice_prompt)

        # Get pacing suggestion
        pacing = flow_manager.get_pacing_suggestion()

        return {
            "content": formatted.content,
            "html_content": formatted.html_content,
            "word_count": formatted.word_count,
            "segment_count": len(session["story_segments"]),
            "phase": flow_manager.current_phase.value,
            "choices": choices,
            "pacing_suggestion": pacing
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/story/full/{session_id}")
async def get_full_story(session_id: str):
    """Get the complete story for a session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    full_story = memory_module.get_full_story(session_id)
    formatted = output_formatter.format_full_story(
        sessions[session_id]["story_segments"]
    )

    return {
        "content": formatted.content,
        "html_content": formatted.html_content,
        "word_count": formatted.word_count,
        "segment_count": len(sessions[session_id]["story_segments"])
    }


@app.get("/api/story/download/{session_id}")
async def download_story(session_id: str, format: str = "txt"):
    """Download the complete story"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    formatted = output_formatter.format_full_story(
        sessions[session_id]["story_segments"],
        title="My Interactive Story"
    )

    content = output_formatter.format_for_download(formatted, format)

    return {
        "content": content,
        "filename": f"story.{format}"
    }


@app.post("/api/settings")
async def update_settings(settings: SettingsUpdate):
    """Update LLM settings"""
    if settings.provider:
        story_generator.switch_provider(
            LLMProvider(settings.provider),
            model=settings.model or OLLAMA_MODEL,
            api_key=settings.api_key
        )

    if settings.temperature is not None:
        story_generator.update_config(temperature=settings.temperature)

    if settings.model:
        story_generator.update_config(model=settings.model)

    if settings.api_key:
        story_generator.update_config(api_key=settings.api_key)

    # Re-check availability with new settings
    status = await story_generator.check_availability()

    return {
        "status": "success",
        "message": "Settings updated",
        "llm_available": status["available"],
        "provider": status["provider"],
        "model": status["model"]
    }


@app.get("/api/session/{session_id}/summary")
async def get_session_summary(session_id: str):
    """Get summary of a storytelling session"""
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    summary = memory_module.get_story_summary(session_id)
    flow_summary = flow_manager.get_story_summary()

    return {
        **summary,
        "flow": flow_summary
    }


@app.delete("/api/session/{session_id}")
async def end_session(session_id: str):
    """End and cleanup a session"""
    if session_id in sessions:
        del sessions[session_id]
        memory_module.end_session(session_id)

    return {"status": "success", "message": "Session ended"}


# Run with: uvicorn main:app --reload --port 8000
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
