"""
Module 5: LLM Story Generator
Handles story generation using local (Ollama) or FREE API-based LLMs
Supports: Ollama (local), Hugging Face (free), Groq (free & fast)
"""

from typing import Dict, List, Optional, AsyncGenerator
from abc import ABC, abstractmethod
import httpx
import json
import asyncio
from enum import Enum


class LLMProvider(str, Enum):
    OLLAMA = "ollama"
    HUGGINGFACE = "huggingface"
    GROQ = "groq"
    OPENAI = "openai"


class LLMConfig:
    """Configuration for LLM providers"""

    def __init__(
        self,
        provider: LLMProvider = LLMProvider.OLLAMA,
        model: str = "llama3.2",
        base_url: str = "http://localhost:11434",
        api_key: Optional[str] = None,
        temperature: float = 0.8,
        max_tokens: int = 1000,
        top_p: float = 0.9
    ):
        self.provider = provider
        self.model = model
        self.base_url = base_url
        self.api_key = api_key
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.top_p = top_p


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients"""

    @abstractmethod
    async def generate(self, messages: List[Dict[str, str]]) -> str:
        pass

    @abstractmethod
    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        pass


class OllamaClient(BaseLLMClient):
    """Client for local Ollama LLM"""

    def __init__(self, config: LLMConfig):
        self.config = config
        self.base_url = config.base_url

    async def is_available(self) -> bool:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags", timeout=5.0)
                return response.status_code == 200
        except Exception:
            return False

    async def list_models(self) -> List[str]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/api/tags", timeout=10.0)
                if response.status_code == 200:
                    data = response.json()
                    return [model["name"] for model in data.get("models", [])]
        except Exception:
            pass
        return []

    async def generate(self, messages: List[Dict[str, str]]) -> str:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.config.model,
                        "messages": messages,
                        "stream": False,
                        "options": {
                            "temperature": self.config.temperature,
                            "top_p": self.config.top_p,
                            "num_predict": self.config.max_tokens
                        }
                    },
                    timeout=120.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return data.get("message", {}).get("content", "")
                else:
                    return f"Error: {response.status_code} - {response.text}"

        except httpx.TimeoutException:
            return "Error: Request timed out. The model may be loading."
        except Exception as e:
            return f"Error generating story: {str(e)}"

    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.config.model,
                        "messages": messages,
                        "stream": True,
                        "options": {
                            "temperature": self.config.temperature,
                            "top_p": self.config.top_p,
                            "num_predict": self.config.max_tokens
                        }
                    },
                    timeout=120.0
                ) as response:
                    async for line in response.aiter_lines():
                        if line:
                            try:
                                data = json.loads(line)
                                content = data.get("message", {}).get("content", "")
                                if content:
                                    yield content
                            except json.JSONDecodeError:
                                continue
        except Exception as e:
            yield f"Error: {str(e)}"


class HuggingFaceClient(BaseLLMClient):
    """
    Client for Hugging Face Inference API (FREE)
    Get free API key at: https://huggingface.co/settings/tokens
    """

    # Free models available on HuggingFace
    FREE_MODELS = {
        "mistral": "mistralai/Mistral-7B-Instruct-v0.2",
        "zephyr": "HuggingFaceH4/zephyr-7b-beta",
        "llama": "meta-llama/Llama-2-7b-chat-hf",
        "falcon": "tiiuae/falcon-7b-instruct",
        "phi": "microsoft/phi-2"
    }

    def __init__(self, config: LLMConfig):
        self.config = config
        self.base_url = "https://api-inference.huggingface.co/models"

        # Map simple names to full model names
        if config.model in self.FREE_MODELS:
            self.model = self.FREE_MODELS[config.model]
        else:
            self.model = config.model or self.FREE_MODELS["mistral"]

    async def is_available(self) -> bool:
        # HuggingFace is always available (may need API key for some models)
        return True

    async def generate(self, messages: List[Dict[str, str]]) -> str:
        # Convert messages to a single prompt
        prompt = self._format_prompt(messages)

        headers = {
            "Content-Type": "application/json"
        }

        # Add API key if provided (some models work without it)
        if self.config.api_key:
            headers["Authorization"] = f"Bearer {self.config.api_key}"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/{self.model}",
                    headers=headers,
                    json={
                        "inputs": prompt,
                        "parameters": {
                            "temperature": self.config.temperature,
                            "max_new_tokens": self.config.max_tokens,
                            "top_p": self.config.top_p,
                            "return_full_text": False
                        }
                    },
                    timeout=60.0
                )

                if response.status_code == 200:
                    data = response.json()
                    if isinstance(data, list) and len(data) > 0:
                        return data[0].get("generated_text", "")
                    return str(data)
                elif response.status_code == 503:
                    # Model is loading
                    return "Model is loading... Please try again in a moment."
                else:
                    return f"Error: {response.status_code} - {response.text[:200]}"

        except Exception as e:
            return f"Error: {str(e)}"

    def _format_prompt(self, messages: List[Dict[str, str]]) -> str:
        """Format messages into a single prompt for HuggingFace models"""
        prompt_parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if role == "system":
                prompt_parts.append(f"### System:\n{content}\n")
            elif role == "user":
                prompt_parts.append(f"### User:\n{content}\n")
            elif role == "assistant":
                prompt_parts.append(f"### Assistant:\n{content}\n")

        prompt_parts.append("### Assistant:\n")
        return "\n".join(prompt_parts)

    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        # HuggingFace free tier doesn't support streaming, return full response
        result = await self.generate(messages)
        yield result


class GroqClient(BaseLLMClient):
    """
    Client for Groq API (FREE & FAST!)
    Get free API key at: https://console.groq.com/keys
    Models: llama3-8b, llama3-70b, mixtral-8x7b, gemma-7b
    """

    FREE_MODELS = {
        "llama3-8b": "llama-3.1-8b-instant",
        "llama3-70b": "llama-3.1-70b-versatile",
        "mixtral": "mixtral-8x7b-32768",
        "gemma": "gemma2-9b-it",
        "llama3-versatile": "llama-3.3-70b-versatile"
    }

    def __init__(self, config: LLMConfig):
        self.config = config
        self.base_url = "https://api.groq.com/openai/v1"

        # Map simple names to model IDs
        if config.model in self.FREE_MODELS:
            self.model = self.FREE_MODELS[config.model]
        else:
            self.model = config.model or self.FREE_MODELS["llama3-8b"]

    async def is_available(self) -> bool:
        if not self.config.api_key:
            return False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    timeout=10.0
                )
                return response.status_code == 200
        except Exception:
            return False

    async def generate(self, messages: List[Dict[str, str]]) -> str:
        if not self.config.api_key:
            return "Error: Groq API key required. Get free key at: https://console.groq.com/keys"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.config.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": self.config.temperature,
                        "max_tokens": self.config.max_tokens,
                        "top_p": self.config.top_p
                    },
                    timeout=60.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    return f"Error: {response.status_code} - {response.text[:200]}"

        except Exception as e:
            return f"Error: {str(e)}"

    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        if not self.config.api_key:
            yield "Error: Groq API key required"
            return

        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.config.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "messages": messages,
                        "temperature": self.config.temperature,
                        "max_tokens": self.config.max_tokens,
                        "stream": True
                    },
                    timeout=60.0
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                data = json.loads(line[6:])
                                content = data["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except (json.JSONDecodeError, KeyError):
                                continue
        except Exception as e:
            yield f"Error: {str(e)}"


class OpenAIClient(BaseLLMClient):
    """Client for OpenAI API"""

    def __init__(self, config: LLMConfig):
        self.config = config
        self.base_url = "https://api.openai.com/v1"

    async def is_available(self) -> bool:
        if not self.config.api_key:
            return False
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/models",
                    headers={"Authorization": f"Bearer {self.config.api_key}"},
                    timeout=10.0
                )
                return response.status_code == 200
        except Exception:
            return False

    async def generate(self, messages: List[Dict[str, str]]) -> str:
        if not self.config.api_key:
            return "Error: OpenAI API key not configured"

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.config.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.config.model,
                        "messages": messages,
                        "temperature": self.config.temperature,
                        "max_tokens": self.config.max_tokens,
                        "top_p": self.config.top_p
                    },
                    timeout=60.0
                )

                if response.status_code == 200:
                    data = response.json()
                    return data["choices"][0]["message"]["content"]
                else:
                    return f"Error: {response.status_code} - {response.text}"

        except Exception as e:
            return f"Error: {str(e)}"

    async def generate_stream(self, messages: List[Dict[str, str]]) -> AsyncGenerator[str, None]:
        if not self.config.api_key:
            yield "Error: OpenAI API key not configured"
            return

        try:
            async with httpx.AsyncClient() as client:
                async with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.config.api_key}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": self.config.model,
                        "messages": messages,
                        "temperature": self.config.temperature,
                        "max_tokens": self.config.max_tokens,
                        "stream": True
                    },
                    timeout=60.0
                ) as response:
                    async for line in response.aiter_lines():
                        if line.startswith("data: ") and line != "data: [DONE]":
                            try:
                                data = json.loads(line[6:])
                                content = data["choices"][0]["delta"].get("content", "")
                                if content:
                                    yield content
                            except (json.JSONDecodeError, KeyError):
                                continue

        except Exception as e:
            yield f"Error: {str(e)}"


class StoryGenerator:
    """
    Main story generation class that manages LLM interactions.
    Supports multiple FREE LLM providers.
    """

    def __init__(self, config: Optional[LLMConfig] = None):
        self.config = config or LLMConfig()
        self.client = self._create_client()
        self.generation_history: List[Dict[str, str]] = []

    def _create_client(self) -> BaseLLMClient:
        """Create appropriate LLM client based on config"""
        if self.config.provider == LLMProvider.OLLAMA:
            return OllamaClient(self.config)
        elif self.config.provider == LLMProvider.HUGGINGFACE:
            return HuggingFaceClient(self.config)
        elif self.config.provider == LLMProvider.GROQ:
            return GroqClient(self.config)
        elif self.config.provider == LLMProvider.OPENAI:
            return OpenAIClient(self.config)
        else:
            return OllamaClient(self.config)

    def switch_provider(self, provider: LLMProvider, **kwargs):
        """Switch to a different LLM provider"""
        self.config.provider = provider
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        self.client = self._create_client()

    async def check_availability(self) -> Dict[str, any]:
        """Check if the current LLM provider is available"""
        available = await self.client.is_available()

        result = {
            "available": available,
            "provider": self.config.provider.value,
            "model": self.config.model
        }

        if isinstance(self.client, OllamaClient) and available:
            models = await self.client.list_models()
            result["available_models"] = models
            result["model_loaded"] = any(self.config.model in m for m in models)

        return result

    async def generate_story_segment(
        self,
        system_prompt: str,
        user_prompt: str,
        previous_context: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Generate a story segment based on prompts."""
        messages = [{"role": "system", "content": system_prompt}]

        if previous_context:
            messages.extend(previous_context[-6:])

        messages.append({"role": "user", "content": user_prompt})

        result = await self.client.generate(messages)

        self.generation_history.append({
            "role": "assistant",
            "content": result
        })

        return result

    async def generate_story_stream(
        self,
        system_prompt: str,
        user_prompt: str,
        previous_context: Optional[List[Dict[str, str]]] = None
    ) -> AsyncGenerator[str, None]:
        """Generate story with streaming output"""
        messages = [{"role": "system", "content": system_prompt}]

        if previous_context:
            messages.extend(previous_context[-6:])

        messages.append({"role": "user", "content": user_prompt})

        full_response = ""
        async for chunk in self.client.generate_stream(messages):
            full_response += chunk
            yield chunk

        self.generation_history.append({
            "role": "assistant",
            "content": full_response
        })

    async def generate_choices(self, prompt: str) -> List[str]:
        """Generate story continuation choices"""
        messages = [
            {"role": "system", "content": "Generate 4 brief story choices as numbered options. Be creative and engaging."},
            {"role": "user", "content": prompt}
        ]

        result = await self.client.generate(messages)

        choices = []
        lines = result.strip().split("\n")
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith("-")):
                choice = line.lstrip("0123456789.-) ").strip()
                if choice and len(choice) > 5:
                    choices.append(choice)

        return choices[:4] if choices else [
            "Continue with more action and adventure",
            "Develop the characters and relationships",
            "Introduce a new challenge or mystery",
            "Move towards the climax and resolution"
        ]

    def add_to_history(self, role: str, content: str):
        self.generation_history.append({"role": role, "content": content})

    def get_history(self) -> List[Dict[str, str]]:
        return self.generation_history

    def clear_history(self):
        self.generation_history = []

    def update_config(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self.config, key):
                setattr(self.config, key, value)
        # Recreate client with new config
        self.client = self._create_client()
