"""
LLM factory.

Default: Groq (ChatGroq).
If `OPENROUTER_API_KEY` is set in `.env`, use OpenRouter via an OpenAI-compatible
Chat client pointed at `https://openrouter.ai/api/v1`.
"""
import json
import re
import threading
from functools import lru_cache

from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.language_models.chat_models import BaseChatModel
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.core.logging import logger


_thread_local = threading.local()


def get_llm() -> BaseChatModel:
    """
    Per-thread singleton LLM client.

    This avoids sharing a single client across threads when we run candidate
    pipelines concurrently inside a Celery task.
    """
    llm = getattr(_thread_local, "llm", None)
    if llm is None:
        if settings.OPENROUTER_API_KEY:
            # Import lazily so Groq-only installs still work.
            from langchain_openai import ChatOpenAI

            llm = ChatOpenAI(
                api_key=settings.OPENROUTER_API_KEY,
                model=settings.OPENROUTER_MODEL or settings.GROQ_MODEL,
                temperature=0.0,
                max_tokens=settings.GROQ_MAX_TOKENS,
                # OpenRouter is OpenAI-compatible
                openai_api_base="https://openrouter.ai/api/v1",
            )
        else:
            llm = ChatGroq(
                api_key=settings.GROQ_API_KEY,
                model=settings.GROQ_MODEL,
                temperature=0.0,
                max_tokens=settings.GROQ_MAX_TOKENS,
            )
        _thread_local.llm = llm
    return llm


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
def llm_call(system_prompt: str, user_prompt: str) -> str:
    """Make a chat completion call and return the raw string response."""
    llm = get_llm()
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ]
    response = llm.invoke(messages)
    return response.content


def llm_call_json(system_prompt: str, user_prompt: str) -> dict:
    """Make an LLM call and parse the response as JSON."""
    raw = llm_call(system_prompt, user_prompt)

    # Strip markdown code fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw).strip().rstrip("```").strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Attempt to find JSON object within the response
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if match:
            return json.loads(match.group())
        logger.error("llm_json_parse_failed", raw=raw[:300])
        raise ValueError(f"LLM returned non-JSON: {raw[:200]}")
