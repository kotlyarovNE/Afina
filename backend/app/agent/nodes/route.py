# backend/app/agent/nodes/route.py
from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI


class IntentResp(BaseModel):
    intent: Literal["ANALYZE", "ASK_PREV_REPORT", "GENERAL"] = Field(
        ..., description="Куда направить вопрос"
    )


def classify_intent(llm: ChatOpenAI, user_text: str) -> str:
    """LLM classification for routing.

    Uses JSON structured output. Falls back to GENERAL on parse errors.
    """
    if not user_text:
        return "GENERAL"

    sys = (
        "Ты — маршрутизатор. Верни JSON c ключом 'intent' в одном из значений: \n"
        "- ANALYZE — пользователь хочет запустить/сделать анализ по документам, сформировать отчёт.\n"
        "- ASK_PREV_REPORT — вопрос про ранее выполненный анализ/отчёт.\n"
        "- GENERAL — прочие вопросы.\n"
        "Строго JSON, без лишнего текста."
    )
    prompt = [
        ("system", sys),
        ("user", f"Сообщение: {user_text}"),
    ]
    try:
        model = llm.bind(response_format={"type": "json_object"})
        resp = model.invoke(prompt)
        import json

        data = json.loads(resp.content)
        intent = data.get("intent")
        if intent in {"ANALYZE", "ASK_PREV_REPORT", "GENERAL"}:
            return intent
    except Exception:
        pass
    return "GENERAL"


class ConfirmResp(BaseModel):
    yes: bool


def is_affirmative(llm: ChatOpenAI, user_text: str) -> bool:
    sys = 'Определи, выражает ли фраза согласие запустить анализ. Верни JSON {"yes": true|false}.'
    prompt = [("system", sys), ("user", user_text)]
    try:
        model = llm.bind(response_format={"type": "json_object"})
        resp = model.invoke(prompt)
        import json

        data = json.loads(resp.content)
        return bool(data.get("yes"))
    except Exception:
        # Fallback heuristics
        txt = user_text.lower()
        return any(
            w in txt for w in ["да", "ок", "хорошо", "запускай", "давай", "go", "ok"]
        )
