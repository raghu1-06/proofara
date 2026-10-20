import os
import time
import json
import re
import httpx
from typing import Dict, Any, Optional, Tuple, List
from .security import decrypt_secret

# Built-in Imperial Simulator Profiles
BUILTIN_MODELS = [
    {
        "id": "nova-7b",
        "name": "Nova-7B (Imperial Fast)",
        "provider": "builtin",
        "provider_type": "builtin",
        "provider_label": "Imperial Simulator",
        "execution_tier": "simulation",
        "latency_ms": 320,
        "is_real": False,
        "is_simulation": True,
        "description": "High-throughput model. Follows instructions well on short outputs, but tends to add polite affixes when unconstrained."
    },
    {
        "id": "meridian-13b",
        "name": "Meridian-13B (Balanced)",
        "provider": "builtin",
        "provider_type": "builtin",
        "provider_label": "Imperial Simulator",
        "execution_tier": "simulation",
        "latency_ms": 680,
        "is_real": False,
        "is_simulation": True,
        "description": "Balanced generalist. Robust on JSON schemas, occasionally includes preamble unless strict format prompt is reinforced."
    },
    {
        "id": "aegis-70b",
        "name": "Aegis-70B (Deep Reasoning)",
        "provider": "builtin",
        "provider_type": "builtin",
        "provider_label": "Imperial Simulator",
        "execution_tier": "simulation",
        "latency_ms": 1450,
        "is_real": False,
        "is_simulation": True,
        "description": "Heavily grounded. Exceptional on factual recall and strict numeric equality; higher latency."
    }
]

# Default popular model options for each real provider
DEFAULT_PROVIDER_MODELS = {
    "openai": ["gpt-4o-mini", "gpt-4o", "o3-mini"],
    "gemini": ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
    "groq": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    "anthropic": ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022"],
    "ollama": ["llama3.2", "llama3.1", "mistral", "qwen2.5", "phi3"],
    "custom": ["custom-model-1"]
}

DEFAULT_BASE_URLS = {
    "openai": "https://api.openai.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta",
    "groq": "https://api.groq.com/openai/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "ollama": os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
    "custom": "http://localhost:8000/v1"
}


class MultiModelExecutor:
    """
    Unified LLM Execution Router supporting:
    - Built-in deterministic simulation models
    - OpenAI & OpenAI-compatible APIs (OpenAI, Groq, OpenRouter, vLLM, DeepSeek)
    - Google Gemini REST API
    - Anthropic Claude Messages API
    - Ollama Local LLM API
    """

    @staticmethod
    def simulate_mock(model_id: str, prompt: str, expected_output: str, eval_method: str) -> str:
        clean_prompt = prompt.strip().lower()
        clean_expected = expected_output.strip()

        if "json" in eval_method.lower() or "{" in clean_expected:
            if model_id == "nova-7b" and "strict" not in clean_prompt:
                return f"```json\n{clean_expected}\n```"
            return clean_expected

        if "single word" in clean_prompt or "only" in clean_prompt:
            if model_id == "nova-7b":
                return f"The answer is {clean_expected}."
            return clean_expected

        if "reasoning" in clean_prompt or "math" in clean_prompt:
            if model_id == "nova-7b" and "complex" in clean_prompt:
                return "The calculated sum equals 42."
            return clean_expected

        if model_id == "nova-7b" and len(clean_expected) > 40:
            return clean_expected + " (Note: verified by Nova)"

        return clean_expected

    @staticmethod
    async def call_openai_compatible(
        base_url: str,
        api_key: str,
        model_name: str,
        prompt: str,
        timeout_s: float = 30.0
    ) -> Tuple[str, int, int]:
        url = base_url.rstrip("/") + "/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else ""
        }
        body = {
            "model": model_name,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.0
        }
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code == 401:
                raise RuntimeError(f"Authentication failed (401 Unauthorized). Verify your API key for {model_name}.")
            if resp.status_code == 429:
                raise RuntimeError(f"Rate limit exceeded (429 Too Many Requests) for {model_name}.")
            if resp.status_code != 200:
                raise RuntimeError(f"OpenAI compatible error ({resp.status_code}): {resp.text}")
            data = resp.json()
            choices = data.get("choices", [])
            if not choices:
                raise RuntimeError("Provider returned no choices in completion response.")
            msg = choices[0].get("message", {})
            output = msg.get("content") or msg.get("refusal") or ""
            usage = data.get("usage", {})
            tokens = usage.get("total_tokens", 0)
            return output.strip(), tokens, resp.status_code

    @staticmethod
    async def call_gemini(
        api_key: str,
        model_name: str,
        prompt: str,
        base_url: Optional[str] = None,
        timeout_s: float = 30.0
    ) -> Tuple[str, int, int]:
        base = (base_url or DEFAULT_BASE_URLS["gemini"]).rstrip("/")
        model_clean = model_name if model_name.startswith("models/") else f"models/{model_name}"
        url = f"{base}/{model_clean}:generateContent?key={api_key}"
        body = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.0
            }
        }
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            resp = await client.post(url, json=body)
            if resp.status_code == 400:
                raise RuntimeError(f"Invalid request or model name ({resp.status_code}): {resp.text}")
            if resp.status_code == 403:
                raise RuntimeError("Gemini authorization failed (403 Forbidden). Verify your Gemini API key.")
            if resp.status_code == 429:
                raise RuntimeError("Gemini quota or rate limit exceeded (429).")
            if resp.status_code != 200:
                raise RuntimeError(f"Gemini error ({resp.status_code}): {resp.text}")
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                feedback = data.get("promptFeedback", {})
                raise RuntimeError(f"Gemini returned no candidates (possible safety filter block): {feedback}")
            parts = candidates[0].get("content", {}).get("parts", [])
            output = "".join([p.get("text", "") for p in parts if "text" in p])
            usage = data.get("usageMetadata", {})
            tokens = usage.get("totalTokenCount", 0)
            return output.strip(), tokens, resp.status_code

    @staticmethod
    async def call_anthropic(
        api_key: str,
        model_name: str,
        prompt: str,
        base_url: Optional[str] = None,
        timeout_s: float = 30.0
    ) -> Tuple[str, int, int]:
        base = (base_url or DEFAULT_BASE_URLS["anthropic"]).rstrip("/")
        url = f"{base}/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body = {
            "model": model_name,
            "max_tokens": 1024,
            "temperature": 0.0,
            "messages": [{"role": "user", "content": prompt}]
        }
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            resp = await client.post(url, headers=headers, json=body)
            if resp.status_code == 401:
                raise RuntimeError(f"Anthropic authentication failed (401 Unauthorized). Verify your Anthropic API key.")
            if resp.status_code == 429:
                raise RuntimeError("Anthropic rate limit exceeded (429).")
            if resp.status_code != 200:
                raise RuntimeError(f"Anthropic error ({resp.status_code}): {resp.text}")
            data = resp.json()
            content_blocks = data.get("content", [])
            output = "".join([b.get("text", "") for b in content_blocks if b.get("type") == "text"])
            usage = data.get("usage", {})
            tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)
            return output.strip(), tokens, resp.status_code

    @staticmethod
    async def call_ollama(
        base_url: str,
        model_name: str,
        prompt: str,
        timeout_s: float = 30.0
    ) -> Tuple[str, int, int]:
        base = (base_url or DEFAULT_BASE_URLS["ollama"]).rstrip("/")
        url = f"{base}/api/generate"
        body = {
            "model": model_name,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.0}
        }
        async with httpx.AsyncClient(timeout=timeout_s) as client:
            resp = await client.post(url, json=body)
            if resp.status_code != 200:
                raise RuntimeError(f"Ollama error ({resp.status_code}): {resp.text}")
            data = resp.json()
            output = data.get("response", "")
            tokens = data.get("eval_count", 0) + data.get("prompt_eval_count", 0)
            return output.strip(), tokens, resp.status_code

    @classmethod
    async def execute_model(
        cls,
        model_id: str,
        prompt: str,
        expected_output: str,
        eval_method: str,
        provider_settings: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Unified dispatch: if model_id is a built-in simulation, uses simulate_mock.
        Otherwise uses the configured real provider (OpenAI, Gemini, Anthropic, Ollama, etc.).
        """
        start_time = time.perf_counter()
        clean_id = model_id.lower().strip()

        # 1. Built-in simulation model
        if clean_id in ["nova-7b", "meridian-13b", "aegis-70b"]:
            # Realistic latency simulation
            latencies = {"nova-7b": 0.28, "meridian-13b": 0.55, "aegis-70b": 1.10}
            sim_time = latencies.get(clean_id, 0.4)
            # Sleep slightly in async mode to represent latency without blocking
            import asyncio
            await asyncio.sleep(sim_time)
            
            output = cls.simulate_mock(clean_id, prompt, expected_output, eval_method)
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "output": output,
                "latency_ms": latency_ms,
                "tokens": len(prompt.split()) + len(output.split()),
                "error": None,
                "is_mock": True,
                "is_simulation": True,
                "execution_tier": "simulation",
                "provider_type": "builtin"
            }

        # 2. Real Model Provider execution
        if not provider_settings:
            return {
                "output": "",
                "latency_ms": 0,
                "tokens": 0,
                "error": f"Model '{model_id}' requires an active AI provider configuration (OpenAI, Gemini, Groq, Ollama, Anthropic). Please configure your API key or local endpoint in Settings.",
                "is_mock": False,
                "is_simulation": False,
                "execution_tier": "cloud",
                "provider_type": "unconfigured"
            }

        p_type = provider_settings.get("provider_type", "").lower()
        tier = "local" if p_type == "ollama" else "cloud"
        raw_key = provider_settings.get("api_key", "")
        api_key = decrypt_secret(raw_key)
        base_url = provider_settings.get("base_url") or DEFAULT_BASE_URLS.get(p_type, "")

        try:
            tokens = 0
            if p_type in ["openai", "groq", "custom"]:
                output, tokens, _ = await cls.call_openai_compatible(base_url, api_key, model_id, prompt)
            elif p_type == "gemini":
                output, tokens, _ = await cls.call_gemini(api_key, model_id, prompt, base_url)
            elif p_type == "anthropic":
                output, tokens, _ = await cls.call_anthropic(api_key, model_id, prompt, base_url)
            elif p_type == "ollama":
                output, tokens, _ = await cls.call_ollama(base_url, model_id, prompt)
            else:
                raise ValueError(f"Unsupported provider type '{p_type}'")

            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "output": output,
                "latency_ms": latency_ms,
                "tokens": tokens,
                "error": None,
                "is_mock": False,
                "is_simulation": False,
                "execution_tier": tier,
                "provider_type": p_type
            }

        except httpx.TimeoutException:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "output": "",
                "latency_ms": latency_ms,
                "tokens": 0,
                "error": f"Provider request timed out after 30 seconds ({p_type})",
                "is_mock": False,
                "is_simulation": False,
                "execution_tier": tier,
                "provider_type": p_type
            }
        except httpx.ConnectError:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "output": "",
                "latency_ms": latency_ms,
                "tokens": 0,
                "error": f"Failed to connect to provider endpoint at {base_url} ({p_type})",
                "is_mock": False,
                "is_simulation": False,
                "execution_tier": tier,
                "provider_type": p_type
            }
        except Exception as e:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return {
                "output": "",
                "latency_ms": latency_ms,
                "tokens": 0,
                "error": f"Model invocation failed: {str(e)}",
                "is_mock": False,
                "is_simulation": False,
                "execution_tier": tier,
                "provider_type": p_type
            }
