"""Alternative LLM provider using free cloud APIs for testing without Ollama."""

from __future__ import annotations

import os
import json
from typing import Any, Generator
import litellm

# Configuration for free cloud LLM providers
CLOUD_LLM_PROVIDER = os.getenv("CLOUD_LLM_PROVIDER", "together_ai")  # or "openrouter", "groq"
DEFAULT_CLOUD_MODEL = os.getenv("DEFAULT_CLOUD_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")

# Free API keys (rate limited but good for testing)
# You can get free API keys from:
# - Together.ai: https://www.together.ai/ (free tier)
# - OpenRouter: https://openrouter.ai/ (free tier)
# - Groq: https://console.groq.com/ (free tier)

FREE_API_KEYS = {
    "together_ai": "YOUR_TOGETHER_AI_API_KEY",  # Get from https://www.together.ai/
    "openrouter": "YOUR_OPENROUTER_API_KEY",    # Get from https://openrouter.ai/
    "groq": "YOUR_GROQ_API_KEY"                # Get from https://console.groq.com/
}


def _call_cloud_llm(prompt: str, model: str = DEFAULT_CLOUD_MODEL) -> str | None:
    """
    Call a cloud LLM provider using LiteLLM.
    Uses free tier APIs for testing.
    """
    try:
        # Configure LiteLLM based on provider
        provider = CLOUD_LLM_PROVIDER.lower()

        if provider == "together_ai":
            # Together.ai free tier
            model_name = f"together_ai/{model}"
            api_key = os.getenv("TOGETHER_API_KEY", FREE_API_KEYS["together_ai"])
        elif provider == "openrouter":
            # OpenRouter free tier
            model_name = f"openrouter/{model}"
            api_key = os.getenv("OPENROUTER_API_KEY", FREE_API_KEYS["openrouter"])
        elif provider == "groq":
            # Groq free tier (very fast)
            model_name = f"groq/{model}"
            api_key = os.getenv("GROQ_API_KEY", FREE_API_KEYS["groq"])
        else:
            # Default to Together.ai
            model_name = f"together_ai/{model}"
            api_key = os.getenv("TOGETHER_API_KEY", FREE_API_KEYS["together_ai"])

        # If no API key is configured, use a mock response for testing
        if api_key.startswith("YOUR_"):
            print(f"[Cloud LLM] No API key configured for {provider}. Using mock response.")
            return _get_mock_response(prompt)

        # Call the cloud LLM
        response = litellm.completion(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful legal assistant specializing in Indian Intellectual Property law. Provide accurate, cited answers based on the provided context."},
                {"role": "user", "content": prompt}
            ],
            api_key=api_key,
            temperature=0.1,  # Low temperature for factual responses
            max_tokens=1000,
        )

        return response.choices[0].message.content.strip()

    except Exception as err:
        print(f"[Cloud LLM Error] Failed to call cloud LLM: {err}")
        return _get_mock_response(prompt)


def _stream_cloud_llm(prompt: str, model: str = DEFAULT_CLOUD_MODEL) -> Generator[str, None, None]:
    """
    Stream response from cloud LLM.
    """
    try:
        provider = CLOUD_LLM_PROVIDER.lower()

        if provider == "together_ai":
            model_name = f"together_ai/{model}"
            api_key = os.getenv("TOGETHER_API_KEY", FREE_API_KEYS["together_ai"])
        elif provider == "groq":
            model_name = f"groq/{model}"
            api_key = os.getenv("GROQ_API_KEY", FREE_API_KEYS["groq"])
        else:
            model_name = f"together_ai/{model}"
            api_key = os.getenv("TOGETHER_API_KEY", FREE_API_KEYS["together_ai"])

        # If no API key, use mock streaming
        if api_key.startswith("YOUR_"):
            print(f"[Cloud LLM] No API key for streaming. Using mock response.")
            mock_response = _get_mock_response(prompt)
            for word in mock_response.split():
                yield f"data: {json.dumps({'response': word + ' '})}\n\n"
            yield "data: [DONE]\n\n"
            return

        # Stream from cloud LLM
        response = litellm.completion(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful legal assistant for Indian IP law."},
                {"role": "user", "content": prompt}
            ],
            api_key=api_key,
            temperature=0.1,
            max_tokens=1000,
            stream=True
        )

        for chunk in response:
            if chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'response': chunk.choices[0].delta.content})}\n\n"

        yield "data: [DONE]\n\n"

    except Exception as err:
        print(f"[Cloud LLM Stream Error] {err}")
        mock_response = _get_mock_response(prompt)
        for word in mock_response.split():
            yield f"data: {json.dumps({'response': word + ' '})}\n\n"
        yield "data: [DONE]\n\n"


def _get_mock_response(prompt: str) -> str:
    """
    Provide a mock response when no API key is configured.
    Useful for testing the RAG pipeline without actual LLM calls.
    """
    # Check if it's an IP-related question
    ip_keywords = ["patent", "trademark", "copyright", "IP", "intellectual property",
                   "AYUSH", "Ayurveda", "TKDL", "geographical indication", "GI"]

    prompt_lower = prompt.lower()
    is_ip_question = any(keyword in prompt_lower for keyword in ip_keywords)

    if is_ip_question:
        return """Based on the provided context about Indian Intellectual Property law:

1. **Patent Protection**: In India, patents are granted for inventions that are novel, involve an inventive step, and are industrially applicable. The patent term is 20 years from the filing date.

2. **Trademark Registration**: Trademarks can be registered for distinctive signs that identify goods or services. The registration process involves filing an application, examination, publication, and registration.

3. **Copyright Protection**: Copyright automatically protects original literary, dramatic, musical, and artistic works for the lifetime of the author plus 60 years.

4. **Traditional Knowledge**: India's Traditional Knowledge Digital Library (TKDL) protects Ayurvedic and other traditional knowledge from misappropriation.

For specific legal advice, please consult a qualified IP attorney."""
    else:
        return "I can provide information about Indian Intellectual Property laws including patents, trademarks, copyrights, geographical indications, and protection of traditional knowledge like Ayurveda. Please ask a question related to IP law in India."


# Test the cloud LLM
if __name__ == "__main__":
    test_prompt = "What are the requirements for patenting an Ayurvedic formulation in India?"
    print("Testing Cloud LLM...")
    print(f"Prompt: {test_prompt}")
    response = _call_cloud_llm(test_prompt)
    print(f"Response: {response}")