"""
AI Model Client - Unified interface for multiple AI providers
"""
import logging
from typing import List, Dict, Any, AsyncIterator, Optional
import anthropic
import google.generativeai as genai
from google.cloud import aiplatform
from backend.shared.config import settings

logger = logging.getLogger(__name__)


class AIClient:
    """Unified AI client for multiple providers"""

    def __init__(self):
        # Initialize Anthropic client
        if settings.ANTHROPIC_API_KEY:
            self.anthropic_client = anthropic.AsyncAnthropic(
                api_key=settings.ANTHROPIC_API_KEY
            )
        else:
            self.anthropic_client = None

        # Initialize Google AI client
        if settings.GOOGLE_AI_API_KEY:
            genai.configure(api_key=settings.GOOGLE_AI_API_KEY)

        # Initialize Vertex AI
        if settings.VERTEX_AI_PROJECT:
            aiplatform.init(
                project=settings.VERTEX_AI_PROJECT,
                location=settings.VERTEX_AI_LOCATION
            )

    async def chat_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 4000,
        stream: bool = False,
        system_prompt: Optional[str] = None,
        use_extended_thinking: bool = False,
    ) -> Dict[str, Any] | AsyncIterator[Dict[str, Any]]:
        """
        Get chat completion from the specified model
        """
        if model.startswith("claude"):
            return await self._claude_completion(
                model, messages, temperature, max_tokens, stream, system_prompt, use_extended_thinking
            )
        elif model.startswith("gemini"):
            return await self._gemini_completion(
                model, messages, temperature, max_tokens, stream, system_prompt
            )
        elif model.startswith("gemma"):
            return await self._gemma_completion(
                model, messages, temperature, max_tokens, stream, system_prompt
            )
        else:
            raise ValueError(f"Unsupported model: {model}")

    async def _claude_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        stream: bool,
        system_prompt: Optional[str],
        use_extended_thinking: bool,
    ) -> Dict[str, Any] | AsyncIterator[Dict[str, Any]]:
        """Get completion from Claude models"""
        if not self.anthropic_client:
            raise ValueError("Anthropic API key not configured")

        # Map our model names to Anthropic's model IDs
        model_map = {
            "claude-sonnet-4.5": "claude-sonnet-4.5-20250929",
            "claude-opus-4.1": "claude-opus-4-20250514",
        }
        anthropic_model = model_map.get(model, model)

        # Convert messages to Anthropic format
        claude_messages = []
        for msg in messages:
            claude_messages.append({
                "role": msg["role"],
                "content": msg["content"]
            })

        # Prepare kwargs
        kwargs = {
            "model": anthropic_model,
            "messages": claude_messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if system_prompt:
            kwargs["system"] = system_prompt

        # Add extended thinking if requested
        if use_extended_thinking:
            kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": 10000
            }

        if stream:
            return self._claude_stream(kwargs)
        else:
            response = await self.anthropic_client.messages.create(**kwargs)
            return {
                "id": response.id,
                "model": model,
                "message": {
                    "role": "assistant",
                    "content": response.content[0].text
                },
                "tokens_used": response.usage.input_tokens + response.usage.output_tokens,
                "finish_reason": response.stop_reason,
                "metadata": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                }
            }

    async def _claude_stream(self, kwargs) -> AsyncIterator[Dict[str, Any]]:
        """Stream Claude responses"""
        async with self.anthropic_client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield {
                    "type": "content",
                    "text": text
                }

            # Get final message
            message = await stream.get_final_message()
            yield {
                "type": "done",
                "message": {
                    "id": message.id,
                    "model": kwargs["model"],
                    "tokens_used": message.usage.input_tokens + message.usage.output_tokens,
                    "finish_reason": message.stop_reason
                }
            }

    async def _gemini_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        stream: bool,
        system_prompt: Optional[str],
    ) -> Dict[str, Any] | AsyncIterator[Dict[str, Any]]:
        """Get completion from Gemini models"""

        # Map our model names to Google's model IDs
        model_map = {
            "gemini-2.5-flash": "gemini-2.5-flash",
            "gemini-2.5-pro": "gemini-2.5-pro",
        }
        gemini_model_name = model_map.get(model, model)

        # Use Vertex AI for Gemini
        from vertexai.generative_models import GenerativeModel, GenerationConfig

        gemini_model = GenerativeModel(gemini_model_name)

        # Convert messages to Gemini format
        gemini_messages = []
        for msg in messages:
            role = "user" if msg["role"] == "user" else "model"
            gemini_messages.append({
                "role": role,
                "parts": [{"text": msg["content"]}]
            })

        generation_config = GenerationConfig(
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        if stream:
            return self._gemini_stream(gemini_model, gemini_messages, generation_config, system_prompt)
        else:
            # Add system instruction if provided
            if system_prompt:
                gemini_model = GenerativeModel(
                    gemini_model_name,
                    system_instruction=system_prompt
                )

            response = await gemini_model.generate_content_async(
                gemini_messages,
                generation_config=generation_config
            )

            return {
                "id": f"gemini-{model}",
                "model": model,
                "message": {
                    "role": "assistant",
                    "content": response.text
                },
                "tokens_used": response.usage_metadata.total_token_count if hasattr(response, 'usage_metadata') else 0,
                "finish_reason": "stop",
                "metadata": {
                    "candidates": len(response.candidates) if hasattr(response, 'candidates') else 1
                }
            }

    async def _gemini_stream(self, model, messages, generation_config, system_prompt) -> AsyncIterator[Dict[str, Any]]:
        """Stream Gemini responses"""
        total_tokens = 0

        response = await model.generate_content_async(
            messages,
            generation_config=generation_config,
            stream=True
        )

        async for chunk in response:
            if chunk.text:
                yield {
                    "type": "content",
                    "text": chunk.text
                }

        yield {
            "type": "done",
            "message": {
                "id": "gemini-stream",
                "tokens_used": total_tokens,
                "finish_reason": "stop"
            }
        }

    async def _gemma_completion(
        self,
        model: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        stream: bool,
        system_prompt: Optional[str],
    ) -> Dict[str, Any] | AsyncIterator[Dict[str, Any]]:
        """Get completion from Gemma models (via Vertex AI)"""

        # Gemma models on Vertex AI
        model_map = {
            "gemma-7b": "gemma-7b-it",
            "gemma-2b": "gemma-2b-it",
        }
        gemma_model_name = model_map.get(model, model)

        from vertexai.language_models import ChatModel

        gemma_model = ChatModel.from_pretrained(gemma_model_name)

        # Start chat session
        chat = gemma_model.start_chat()

        # Add system prompt if provided
        if system_prompt:
            chat.send_message(f"System: {system_prompt}")

        # Send messages
        for msg in messages[:-1]:  # All but last message
            if msg["role"] == "user":
                chat.send_message(msg["content"])

        # Get response for last message
        last_message = messages[-1]["content"]
        response = await chat.send_message_async(
            last_message,
            temperature=temperature,
            max_output_tokens=max_tokens,
        )

        return {
            "id": f"gemma-{model}",
            "model": model,
            "message": {
                "role": "assistant",
                "content": response.text
            },
            "tokens_used": 0,  # Gemma doesn't always provide token counts
            "finish_reason": "stop",
            "metadata": {}
        }

    async def generate_embedding(self, text: str) -> List[float]:
        """Generate embeddings using Vertex AI"""
        from vertexai.language_models import TextEmbeddingModel

        model = TextEmbeddingModel.from_pretrained(settings.EMBEDDING_MODEL)
        embeddings = await model.get_embeddings_async([text])

        return embeddings[0].values
