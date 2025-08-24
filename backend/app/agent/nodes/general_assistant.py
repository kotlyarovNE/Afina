# backend/app/agent/nodes/general\_assistant.py
from __future__ import annotations

from langchain_openai import ChatOpenAI


def build_general_assistant_llm(model_name: str = "gpt-4o-mini") -> ChatOpenAI:
    # zero temperature for factual/tool usage; streaming enabled for SSE
    return ChatOpenAI(model=model_name, temperature=0, streaming=True)
