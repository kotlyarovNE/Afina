# backend/app/agent/nodes/report\_analyse.py
from __future__ import annotations

from typing import Dict, Tuple
from langchain_openai import ChatOpenAI


MAX_CHARS_PER_FILE = 20_000  # protect tokens
MAX_FILES = 8


def _clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[обрезано]"


def _files_block(files: Dict[str, str]) -> str:
    items = []
    for i, (name, content) in enumerate(files.items()):
        if i >= MAX_FILES:
            items.append("[Прочее опущено: слишком много файлов]")
            break
        items.append(
            f'<FILE name="{name}">\n{_clip(content, MAX_CHARS_PER_FILE)}\n</FILE>'
        )
    return "\n\n".join(items)


def run_report_analysis(
    analyst_llm: ChatOpenAI,
    files: Dict[str, str],
    user_question: str,
) -> Tuple[str, str]:
    """Run the analysis and return (markdown_table, prompt_snapshot_for_memory)."""
    files_txt = _files_block(files)

    system = "Ты — строгий аудитор ML-отчётов. Проведи проверку по 3 пунктам."

    user = f"""
Вот набор документов разработчиков (распарсено):
{files_txt}

Проведи краткую проверку по 3 пунктам и верни ТОЛЬКО аккуратный Markdown:

Требуется оценить и пояснить:
1) Указаны ли метрики модели? (Да/Нет + одно-два предложения пояснения)
2) Указаны ли ограничения для использования модели в проде? (Да/Нет + пояснение)
3) Описан ли бизнес-смысл модели? (Да/Нет + пояснение)

Оформи в виде таблицы (4 колонки):
| Критерий | Да/Нет | Пояснение | Где в документах (файл/раздел) |
— В последней колонке постарайся указать, где именно это упоминается (если возможно).
— Пиши по-русски, кратко и по делу.
— В конце добавь блок с короткими рекомендациями (bullets) по улучшению отчёта.
"""

    prompt_snapshot = f"[SYSTEM]\n{system}\n\n[USER]\n{user[:4000]}"
    # (сохраняем укороченную копию промпта в память, чтобы не раздувать state)
    analyst_llm = analyst_llm.with_config(metadata={"display": True})
    resp = analyst_llm.invoke([("system", system), ("user", user)])
    md = str(resp.content).strip()

    return md, prompt_snapshot
