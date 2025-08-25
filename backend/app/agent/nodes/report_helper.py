# backend/app/agent/nodes/report\_helper.py
from __future__ import annotations

from typing import List
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage


def answer_about_last_report(
    llm: ChatOpenAI,
    short_history: List[BaseMessage],
    last_report_user: str,
    last_report_assistant: str,
) -> str:
    system = "Ты помогаешь отвечать на вопросы по уже выполненному анализу отчёта."

    intro = (
        "Ниже краткая история последних сообщений чата, затем — пара сообщений из последнего анализа."
        " Отвечай по существу, опираясь на прошлый анализ; если информации в нём нет — так и скажи."
    )

    user_blocks = [
        "История (последние сообщения):\n"
        + "\n".join(
            f"- {'User' if isinstance(m, HumanMessage) else 'Assistant'}: {m.content}"
            for m in short_history
        ),
        "Фрагменты из последнего анализа:\n"
        f"- Пользователь тогда спросил: {last_report_user}\n"
        f"- Ответ анализа (фрагмент Markdown):\n{last_report_assistant[:3000]}",
        "Теперь ответь на текущий вопрос пользователя, ссылаясь на анализ, если уместно.",
    ]

    messages = [("system", system), ("user", intro + "\n\n" + "\n\n".join(user_blocks))]
    #print(messages)
    llm = llm.with_config(metadata={"display": True})
    resp = llm.invoke(messages)
    return str(resp.content)
