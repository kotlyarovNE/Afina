# app/agent/agent.py
from __future__ import annotations
from typing import TypedDict, Annotated, Sequence, Optional, Literal
from pathlib import Path

from ddgs import DDGS
from langchain_core.tools import tool
from langchain_core.messages import (
    AnyMessage, AIMessage, HumanMessage, SystemMessage
)
from langchain_core.runnables import RunnableConfig
from langchain_openai import ChatOpenAI

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.prebuilt import ToolNode

# ---------- 0) Пути ----------
# .../app/agent/agent.py -> BASE_DIR = .../app
BASE_DIR = Path(__file__).resolve().parents[1]
UPLOADS_DIR = BASE_DIR / "uploads"

# ---------- 1) Инструмент поиска ----------
@tool("search_web", return_direct=False)
def search_web(query: str, max_results: int = 5) -> str:
    """Ищет в DuckDuckGo (регион ru-ru, период — неделя) и
    возвращает до max_results строк в формате: 'title: snippet -- url'."""
    with DDGS() as ddgs:
        hits = ddgs.text(query, region="ru-ru", time="w", max_results=max_results)
        lines = []
        for hit in hits[:max_results]:
            title = hit.get("title", "").strip()
            body = hit.get("body", "").strip()
            href = hit.get("href", "").strip()
            lines.append(f"{title}: {body} -- {href}")
        return "\n".join(lines)

TOOLS = [search_web]

# ---------- 2) Схема состояния ----------
class AgentState(TypedDict):
    messages: Annotated[Sequence[AnyMessage], add_messages]
    chat_id: str
    analysis_summary: Optional[str]
    branch: Optional[Literal["analyze", "general"]]
    file_names: Optional[Sequence[str]]         # NEW

# ---------- 3) LLM и системные подсказки ----------
assistant_llm = ChatOpenAI(model="gpt-4o", temperature=0).bind_tools(TOOLS)

SYSTEM_GENERAL = (
    "Ты полезный ассистент. Отвечай кратко и по делу. "
    "Если пользователь явно просит «поищи в интернете», используй инструмент search_web. "
    "Если не уверен в фактах, предложи поиск (search_web), а затем дай ответ на основе найденного."
)

SYSTEM_ANALYZE = (
    "Ты эксперт по ревью отчётов о разработке ML/DS моделей. "
    "Твоя задача — провести качественную проверку по загруженным документам.\n\n"
    "Проверь 3 вещи и ответь структурировано:\n"
    "1) Детально ли задокументированы параметры модели в отчёте?\n"
    "2) Есть ли ограничения у модели в отчёте?\n"
    "3) Прописана ли степень значимости у модели?\n\n"
    "Используй ТОЛЬКО предоставленное содержимое файлов (если они есть). "
    "Если информации не хватает — честно напиши, чего именно не хватает."
)

# ---------- 4) Утилиты ----------
ALLOWED_EXT = {
    ".txt", ".md", ".markdown", ".log", ".json", ".csv", ".tsv", ".yaml", ".yml",
    ".pdf", ".docx", ".xlsx", ".pptx"  # бинарники отметим как [skip], если без парсеров
}

def load_corpus_by_names(file_names: Sequence[str] | None, max_chars: int = 40_000) -> str:
    """Собираем текст только из указанных файлов в app/uploads."""
    if not file_names:
        return ""
    buf, acc = [], 0
    for name in file_names:
        p = UPLOADS_DIR / name
        if not (p.exists() and p.is_file()):
            continue
        ext = p.suffix.lower()
        text = ""
        try:
            if ext == ".pdf":
                try:
                    from pypdf import PdfReader  # pip install pypdf
                    text = ""
                    reader = PdfReader(str(p))
                    for page in reader.pages:
                        text += page.extract_text() or ""
                except Exception:
                    text = f"[skip pdf: {p.name}]"
            elif ext in {".docx", ".xlsx", ".pptx"}:
                # Можно подключить: python-docx, openpyxl, python-pptx
                text = f"[skip binary: {p.name}]"
            elif ext in ALLOWED_EXT:
                text = p.read_text(encoding="utf-8", errors="ignore")
            else:
                text = f"[skip unsupported: {p.name}]"
        except Exception:
            text = f"[skip error: {p.name}]"

        if text:
            part = f"\n\n==== FILE: {p.name} ====\n{text}"
            buf.append(part)
            acc += len(part)
            if acc >= max_chars:
                break
    return ("" if not buf else "".join(buf))[:max_chars]

def is_quality_analysis_request(user_text: str) -> bool:
    t = user_text.lower()
    return (
        ("анализ" in t)
    )

# ---------- 5) Ноды графа ----------
def route_node(state: AgentState) -> AgentState:
    msgs = state["messages"]
    last_user = next((m for m in reversed(msgs) if isinstance(m, HumanMessage)), None)
    txt = last_user.content if last_user else ""
    branch: Literal["analyze", "general"] = (
        "analyze" if is_quality_analysis_request(txt) else "general"
    )
    return {"branch": branch}

def analyze_report_node(state: AgentState) -> AgentState:
    file_names = state.get("file_names") or []
    corpus = load_corpus_by_names(file_names)
    last_user = next((m for m in reversed(state["messages"]) if isinstance(m, HumanMessage)), None)
    question = last_user.content if last_user else ""

    sys = SYSTEM_ANALYZE + "\n\n[Вложенные материалы]\n" + (corpus or "(файлов нет)")
    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    ai = llm.invoke([SystemMessage(content=sys), HumanMessage(content=question)])
    answer_msg = ai if isinstance(ai, AIMessage) else AIMessage(content=str(ai))

    return {
        "messages": [answer_msg],
        "analysis_summary": "done" if answer_msg.content else None,
    }

def assistant_node(state: AgentState, config: RunnableConfig) -> AgentState:
    msgs: list[AnyMessage] = [SystemMessage(content=SYSTEM_GENERAL), *state["messages"]]
    ai = assistant_llm.invoke(msgs, config=config)
    return {"messages": [ai]}

tools_node = ToolNode(TOOLS)

def should_continue(state: AgentState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return "tools"
    return "end"

# ---------- 6) Сборка графа ----------
def build_app():
    builder = StateGraph(AgentState)
    builder.add_node("route", route_node)
    builder.add_node("analyze_report", analyze_report_node)
    builder.add_node("assistant", assistant_node)
    builder.add_node("tools", tools_node)

    builder.add_edge(START, "route")
    builder.add_conditional_edges("route", lambda s: s["branch"],
                                  {"analyze": "analyze_report", "general": "assistant"})
    builder.add_conditional_edges("assistant", should_continue, {"tools": "tools", "end": END})
    builder.add_edge("tools", "assistant")
    builder.add_edge("analyze_report", END)

    checkpointer = InMemorySaver()
    return builder.compile(checkpointer=checkpointer)

APP = build_app()

# ---------- 7) опционально: синхронный вызов как раньше ----------
def reply(chat_id: str, user_text: str, file_names: Sequence[str] | None = None):
    config = {"configurable": {"thread_id": chat_id}}
    return APP.invoke(
        {"messages": [HumanMessage(content=user_text)], "chat_id": chat_id, "file_names": file_names or []},
        config=config,
    )
