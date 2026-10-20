import json
import re
from typing import Tuple, Optional

# Supported Model Profiles (Mock/Local Adapter with transparent deterministic behavior)
AVAILABLE_MODELS = [
    {
        "id": "nova-7b",
        "name": "Nova-7B (Imperial Fast)",
        "provider": "Mock / Deterministic Adapter",
        "latency_ms": 320,
        "description": "High-throughput model. Follows instructions well on short outputs, but tends to add polite affixes when unconstrained."
    },
    {
        "id": "meridian-13b",
        "name": "Meridian-13B (Balanced)",
        "provider": "Mock / Deterministic Adapter",
        "latency_ms": 680,
        "description": "Balanced generalist. Robust on JSON schemas, occasionally includes preamble unless strict format prompt is reinforced."
    },
    {
        "id": "aegis-70b",
        "name": "Aegis-70B (Deep Reasoning)",
        "provider": "Mock / Deterministic Adapter",
        "latency_ms": 1450,
        "description": "Heavily grounded. Exceptional on factual recall and strict numeric equality; higher latency."
    }
]

class ModelAdapter:
    """
    Deterministic Model Execution Adapter.
    Generates realistic, inspectable outputs without requiring paid API keys.
    Easily replaceable with real OpenAI/Anthropic/Ollama adapters.
    """
    @staticmethod
    def generate(model_id: str, prompt: str, expected_output: str, eval_method: str) -> str:
        clean_prompt = prompt.strip().lower()
        clean_expected = expected_output.strip()

        # Specific simulation modes based on prompt context & model tendencies
        if "json" in eval_method.lower() or "{" in clean_expected:
            if model_id == "nova-7b" and "strict" not in clean_prompt:
                # Nova-7B failure pattern: adds markdown commentary wrapper
                return f"```json\n{clean_expected}\n```"
            return clean_expected

        if "single word" in clean_prompt or "only" in clean_prompt:
            if model_id == "nova-7b":
                # Simulated instruction-following drift: adds explanatory politeness
                return f"The answer is {clean_expected}."
            elif model_id == "meridian-13b":
                return clean_expected
            else:
                return clean_expected

        if "reasoning" in clean_prompt or "math" in clean_prompt:
            if model_id == "nova-7b" and "complex" in clean_prompt:
                # Simulated calculation discrepancy
                return "The calculated sum equals 42."
            return clean_expected

        # Default mock generation:
        # Meridian and Aegis succeed on standard cases, Nova occasionally produces variation
        if model_id == "nova-7b" and len(clean_expected) > 40:
            return clean_expected + " (Note: verified by Nova)"
        
        return clean_expected

class EvaluationEngine:
    """
    Deterministic Evaluation Engine supporting exact match, normalized match,
    substring inclusion, and JSON structure validation.
    """
    @staticmethod
    def evaluate(method: str, expected: str, actual: str) -> Tuple[bool, Optional[str]]:
        method_norm = method.strip().lower()
        
        try:
            if "exact" in method_norm:
                passed = (expected.strip() == actual.strip())
                error = None if passed else f"Expected exact string '{expected.strip()}', but received '{actual.strip()}'"
                return passed, error

            elif "normalized" in method_norm:
                norm_exp = re.sub(r'\s+', ' ', expected.strip().lower())
                norm_act = re.sub(r'\s+', ' ', actual.strip().lower())
                passed = (norm_exp == norm_act)
                error = None if passed else f"Normalized comparison mismatch. Cleaned expected: '{norm_exp}', got: '{norm_act}'"
                return passed, error

            elif "substring" in method_norm or "contains" in method_norm:
                passed = (expected.strip().lower() in actual.strip().lower())
                error = None if passed else f"Required substring '{expected.strip()}' was not detected in actual output."
                return passed, error

            elif "json" in method_norm or "structured" in method_norm:
                # Check JSON validity of actual output
                try:
                    # Strip markdown codeblocks if present to test content
                    cleaned_act = actual.strip()
                    if cleaned_act.startswith("```json") and cleaned_act.endswith("```"):
                        cleaned_act = cleaned_act[7:-3].strip()
                    elif cleaned_act.startswith("```") and cleaned_act.endswith("```"):
                        cleaned_act = cleaned_act[3:-3].strip()

                    act_obj = json.loads(cleaned_act)
                    exp_obj = json.loads(expected.strip())
                    passed = (act_obj == exp_obj)
                    error = None if passed else f"JSON data structure mismatch between expected and actual output keys/values."
                    return passed, error
                except json.JSONDecodeError as jde:
                    return False, f"Invalid JSON format produced: {str(jde)}"

            else:
                # Fallback to normalized match
                norm_exp = expected.strip().lower()
                norm_act = actual.strip().lower()
                passed = (norm_exp == norm_act)
                error = None if passed else "Content did not match expected criteria."
                return passed, error

        except Exception as e:
            return False, f"Evaluation execution exception: {str(e)}"
