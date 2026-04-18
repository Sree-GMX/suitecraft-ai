from __future__ import annotations

import json
import re
from typing import Any, Optional


def extract_json_payload(response: str) -> Optional[Any]:
    """Extract a JSON object or array from common LLM output shapes."""
    if not response:
        return None

    candidates = []
    fenced_blocks = re.findall(r"```(?:json)?\s*([\s\S]*?)```", response, flags=re.IGNORECASE)
    candidates.extend(block.strip() for block in fenced_blocks if block.strip())
    candidates.append(response.strip())

    for candidate in candidates:
        parsed = _parse_candidate(candidate)
        if parsed is not None:
            return parsed

    return None


def _parse_candidate(candidate: str) -> Optional[Any]:
    direct = _try_json(candidate)
    if direct is not None:
        return direct

    for opener, closer in (("{", "}"), ("[", "]")):
        start = candidate.find(opener)
        end = candidate.rfind(closer)
        if start >= 0 and end > start:
            sliced = candidate[start:end + 1]
            parsed = _try_json(sliced)
            if parsed is not None:
                return parsed

            cleaned = _cleanup_json_like_text(sliced)
            parsed = _try_json(cleaned)
            if parsed is not None:
                return parsed

    return None


def _cleanup_json_like_text(text: str) -> str:
    text = re.sub(r"^\s*```(?:json)?", "", text, flags=re.IGNORECASE | re.MULTILINE)
    text = re.sub(r"```\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"//.*?$", "", text, flags=re.MULTILINE)
    text = re.sub(r"/\*[\s\S]*?\*/", "", text)
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    return text.strip()


def _try_json(text: str) -> Optional[Any]:
    try:
        return json.loads(text)
    except Exception:
        return None
