"""Alternative LLM provider using free cloud APIs for testing without Ollama."""

from __future__ import annotations

import os
from typing import Generator

try:
	import litellm
except ImportError:
	litellm = None

# Configuration for free cloud LLM providers
CLOUD_LLM_PROVIDER = os.getenv("CLOUD_LLM_PROVIDER", "together_ai")  # or "openrouter", "groq"
DEFAULT_CLOUD_MODEL = os.getenv("DEFAULT_CLOUD_MODEL", "mistralai/Mistral-7B-Instruct-v0.3")

# Free API keys (rate limited but good for testing)
FREE_API_KEYS = {
	"together_ai": "YOUR_TOGETHER_AI_API_KEY",  # Get from https://www.together.ai/
	"openrouter": "YOUR_OPENROUTER_API_KEY",    # Get from https://openrouter.ai/
	"groq": "YOUR_GROQ_API_KEY",                # Get from https://console.groq.com/
}


def _get_cloud_config(model: str = DEFAULT_CLOUD_MODEL) -> tuple[str, str | None]:
	"""Resolve provider model name and API key."""
	provider = CLOUD_LLM_PROVIDER.lower()
	if provider == "together_ai":
		model_name = f"together_ai/{model}"
		api_key = os.getenv("TOGETHER_API_KEY", FREE_API_KEYS["together_ai"])
	elif provider == "openrouter":
		model_name = f"openrouter/{model}"
		api_key = os.getenv("OPENROUTER_API_KEY", FREE_API_KEYS["openrouter"])
	elif provider == "groq":
		model_name = f"groq/{model}"
		api_key = os.getenv("GROQ_API_KEY", FREE_API_KEYS["groq"])
	else:
		model_name = f"together_ai/{model}"
		api_key = os.getenv("TOGETHER_API_KEY", FREE_API_KEYS["together_ai"])

	return model_name, api_key


def _call_cloud_llm(prompt: str, model: str = DEFAULT_CLOUD_MODEL) -> str | None:
	"""Call a cloud LLM provider using LiteLLM."""
	if litellm is None:
		print("[Cloud LLM] litellm not installed. Using fallback response.")
		return _get_mock_response(prompt)

	try:
		model_name, api_key = _get_cloud_config(model)

		if not api_key or api_key.startswith("YOUR_"):
			print("[Cloud LLM] No API key configured. Using grounded fallback.")
			return _get_mock_response(prompt)

		response = litellm.completion(
			model=model_name,
			messages=[
				{
					"role": "system",
					"content": "You are a helpful legal assistant specializing in Indian Intellectual Property law. Provide accurate, cited answers based on the provided context.",
				},
				{"role": "user", "content": prompt},
			],
			api_key=api_key,
			temperature=0.1,
			max_tokens=1000,
		)

		return response.choices[0].message.content.strip()

	except Exception as err:
		print(f"[Cloud LLM Error] Failed to call cloud LLM: {err}")
		return _get_mock_response(prompt)


def _stream_cloud_llm(prompt: str, model: str = DEFAULT_CLOUD_MODEL) -> Generator[str, None, None]:
	"""Stream token strings from cloud LLM."""
	if litellm is None:
		mock = _get_mock_response(prompt)
		for word in mock.split(" "):
			yield word + " "
		return

	try:
		model_name, api_key = _get_cloud_config(model)

		if not api_key or api_key.startswith("YOUR_"):
			print("[Cloud LLM] No API key for streaming. Using grounded fallback.")
			mock = _get_mock_response(prompt)
			for word in mock.split(" "):
				yield word + " "
			return

		response = litellm.completion(
			model=model_name,
			messages=[
				{"role": "system", "content": "You are a helpful legal assistant for Indian IP law."},
				{"role": "user", "content": prompt},
			],
			api_key=api_key,
			temperature=0.1,
			max_tokens=1000,
			stream=True,
		)

		for chunk in response:
			delta = getattr(chunk.choices[0], "delta", None)
			if delta and getattr(delta, "content", None):
				yield delta.content

	except Exception as err:
		print(f"[Cloud LLM Stream Error] {err}")
		mock = _get_mock_response(prompt)
		for word in mock.split(" "):
			yield word + " "


def _get_mock_response(prompt: str) -> str:
	"""Fallback response when no LLM (Ollama or Cloud) is active."""
	ip_keywords = ["patent", "trademark", "copyright", "ip", "intellectual property", "ayush", "ayurveda", "tkdl"]
	if any(k in prompt.lower() for k in ip_keywords):
		return (
			"Based on Indian Intellectual Property law:\n\n"
			"1. **Patents:** Governed by the Indian Patents Act, 1970 (20-year term from filing).\n"
			"2. **Traditional Knowledge & Ayurveda:** Inventions based on traditional formulations must satisfy Section 3(p) and demonstrate synergistic efficacy under Section 3(e).\n"
			"3. **Biodiversity Approvals:** Foreign or commercial use of Indian biological resources requires NBA approval under Section 6 of the Biological Diversity Act, 2002.\n\n"
			"Please consult an official patent attorney or verify with IP India guidelines."
		)
	return "I provide guidance on Indian Intellectual Property laws (Patents, Trademarks, Copyrights, Ayush TKDL). Please ask an IP law question."