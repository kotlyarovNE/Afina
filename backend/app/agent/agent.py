# backend/app/agent/agent.py

from __future__ import annotations

from typing import Annotated, Dict, List, TypedDict, Any
from pathlib import Path

from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.memory import InMemorySaver

from langchain_openai import ChatOpenAI
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    AIMessage,
    ToolMessage
)
from langchain.tools import tool
from langgraph.prebuilt import ToolNode

from .utils.file_loader import load_files
from .nodes.route import classify_intent, is_affirmative
from .nodes.report_analyse import run_report_analysis
from .nodes.report_helper import answer_about_last_report
from .nodes.general_assistant import build_general_assistant_llm


# ── Settings ───────────────────────────────────────────────────────────────
DEFAULT_MODEL = "gpt-4o-mini"  # override via env OPENAI_API_KEY
ANALYST_MODEL = "gpt-4o"  # for the heavy analysis node

UPLOADS_DIR = Path(__file__).parent.parent / "uploads"

import os, ssl, certifi
# ── Tools (DuckDuckGo search) ──────────────────────────────────────────────
try:
    from ddgs import DDGS
except Exception:  # pragma: no cover
    DDGS = None


# ── search_web ──────────────────────────────────────────────
@tool("search_web", description="Ищет в DuckDuckGo (RU, неделя, 5 ссылок)")
def search_web(query: str, max_results: int = 5) -> str:
    # 1) Прокси: берём DDGS_PROXY (или HTTPS_PROXY как запасной)
    proxy = os.getenv("DDGS_PROXY") or os.getenv("HTTPS_PROXY")
    # 2) CA: создаём SSLContext. Если COMBINED_CA не задан — падаем обратно на certifi
    try:
        with DDGS(proxy=proxy, verify=False) as ddgs:
            hits = ddgs.text(
                query, 
                region="ru-ru", 
                timelimit="w", 
                max_results=max_results, 
                backend="duckduckgo")
            return "\n".join(f"{hit['title']}: {hit['body']} -- {hit['href']}" for hit in hits[:max_results])
    except Exception as e:
        # Короткий маркер для LLM, чтобы не вызывать тул повторно по кругу
        return f"[search_error] {type(e).__name__}: {e}"

TOOLS = [search_web]
TOOLS_NODE = ToolNode(TOOLS)


# ── State definition ───────────────────────────────────────────────────────
class AgentState(TypedDict, total=False):
    # Core chat log (we append via the add_messages reducer)
    messages: Annotated[List[BaseMessage], add_messages]

    # Parsed files content (filename -> text)
    files: Dict[str, str]

    # Hash cache for uploaded files (filename -> sha256)
    files_hashes: Dict[str, str]

    # The incoming chat_id (used by checkpointer threading)
    chat_id: str

    # The raw file names provided on each request
    file_names: List[str]

    # Memo of the last analysis
    last_report: Dict[str, Any] | None

    # Whether we previously asked the user to run an analysis first
    clarification_required: bool

    # Internal: the routing label computed in the router
    route_label: str


# ── LLMs ───────────────────────────────────────────────────────────────────
router_llm = ChatOpenAI(model=DEFAULT_MODEL, temperature=0, streaming=True)
assistant_llm = build_general_assistant_llm(DEFAULT_MODEL)  # with tools bound in node
analyst_llm = ChatOpenAI(model=ANALYST_MODEL, temperature=0, streaming=True)


# ── Nodes ──────────────────────────────────────────────────────────────────


def route_node(state: AgentState) -> Dict[str, Any]:
    """Router node: updates files cache if needed and decides where to go next.

    Returns partial state updates (e.g. files, files_hashes, messages, route_label, clarification_required).
    """
    updates: Dict[str, Any] = {}

    # 0) ensure keys
    file_names = state.get("file_names") or []
    #print("file_names: ", file_names)
    #print("uploads_dir: ", UPLOADS_DIR)
    #print("uploads_dir exists: ", UPLOADS_DIR.exists())
    #print("uploads_dir contents: ", list(UPLOADS_DIR.iterdir()) if UPLOADS_DIR.exists() else "DIR_NOT_FOUND")
    last_report = state.get("last_report")
    clarification_required = state.get("clarification_required", False)

    # 1) Keep files in state always current (with caching by hashes)
    if not file_names:
        # Explicitly clear if no files provided
        if state.get("files"):
            updates["files"] = {}
            updates["files_hashes"] = {}
    else:
        new_files, new_hashes, changed = load_files(
            file_names=file_names,
            uploads_dir=UPLOADS_DIR,
            prev_hashes=state.get("files_hashes") or {},
        )
        if changed:
            updates["files"] = new_files
            updates["files_hashes"] = new_hashes

    # 2) Inspect the latest user message
    # We assume the request already appended HumanMessage(message) in inputs
    user_text = ""
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            user_text = str(msg.content)
            break

    # 3) If we previously asked for confirmation — check if the user agreed
    if clarification_required:
        if user_text:
            confirm = is_affirmative(router_llm, user_text)
            if confirm:
                if not file_names:
                    # user wants analysis but there are no files
                    updates["messages"] = [
                        AIMessage(
                            content="Файлов в чате не найдено, загрузите файлы для анализа.",
                            response_metadata={"display": True, "NODE_NAME": "route_node"}
                        )
                    ]
                    updates["route_label"] = "end"
                    return updates
                updates["clarification_required"] = False
                updates["route_label"] = "report_analyse"
                return updates
        # If not affirmative, just proceed to normal routing below (keep the flag as-is)

    # 4) Main routing
    intent = classify_intent(router_llm, user_text)

    if intent == "ANALYZE":
        if not file_names:
            updates["messages"] = [
                AIMessage(
                    content="Файлов в чате не найдено, загрузите файлы для анализа.",
                    response_metadata={"display": True, "NODE_NAME": "route_node"}
                ),
            ]
            updates["route_label"] = "end"
            return updates
        updates["route_label"] = "report_analyse"
        return updates

    if intent == "ASK_PREV_REPORT":
        if last_report:
            updates["route_label"] = "report_helper"
            return updates
        else:
            updates["clarification_required"] = True
            updates["messages"] = [
                AIMessage(
                    content=(
                        "Простите, качественный анализ отчёта в данном чате ещё не проводился. "
                        "Сначала запустите анализ. Хотите это сделать?"
                    ),
                    response_metadata={"display": True, "NODE_NAME": "route_node"}
                )
            ]
            updates["route_label"] = "end"
            return updates

    # Default — general questions
    updates["route_label"] = "general_assistant"
    return updates


def route_edges(state: AgentState) -> str:
    return state.get("route_label", "general_assistant")


# report_analyse node wrapper


def report_analyse_node(state: AgentState) -> Dict[str, Any]:
    files = state.get("files") or {}
    # Last user text (the question that triggered analysis)
    user_text = ""
    for msg in reversed(state.get("messages", [])):
        if isinstance(msg, HumanMessage):
            user_text = str(msg.content)
            break

    md_table, llm_prompt_snapshot = run_report_analysis(
        analyst_llm=analyst_llm,
        files=files,
        user_question=user_text,
    )

    # Persist last_report memo
    last_report = {
        "msg": {
            "user_client": user_text,
            "user_analyse": llm_prompt_snapshot,
            "assistant": md_table,
        },
        "files": files,
    }

    return {
        "messages": [AIMessage(content=md_table, response_metadata={"display": True, "NODE_NAME": "analyse_node"})],
        "last_report": last_report,
        "clarification_required": False,
    }


# report_helper node wrapper


def report_helper_node(state: AgentState) -> Dict[str, Any]:
    # Gather small context: last 2 messages from chat, plus last_report pair
    history = [
        m for m in state.get("messages", []) if isinstance(m, (HumanMessage, AIMessage))
    ]
    last_two = history[-2:] if len(history) >= 2 else history

    last_report = state.get("last_report") or {}
    lr_user = (last_report.get("msg", {}) or {}).get("user_analyse", "")
    lr_assistant = (last_report.get("msg", {}) or {}).get("assistant", "")

    reply = answer_about_last_report(
        llm=router_llm,
        short_history=last_two,
        last_report_user=lr_user,
        last_report_assistant=lr_assistant,
    )

    return {"messages": [AIMessage(content=reply, response_metadata={"display": True, "NODE_NAME": "helper_node"})]}


# general assistant node (tool-aware)


def general_assistant_node(state: AgentState) -> Dict[str, Any]:
    # Берём сырой хвост истории (включая ToolMessage), чтобы не оборвать пары tool_calls → tool
    msgs = state.get("messages", [])
    #print("msgs: ", msgs)
    ctx = msgs[-6:]  # небольшое окно контекста
    #print("ctx: ", ctx)
    # Санитизация: не допускаем assistant(tool_calls) без следующего tool(...)
    sanitized: List[BaseMessage] = []
    i = 0
    while i < len(ctx):
        m = ctx[i]
        if isinstance(m, AIMessage) and getattr(m, "tool_calls", None):
            if i + 1 < len(ctx) and isinstance(ctx[i + 1], ToolMessage):
                sanitized.append(m)
                sanitized.append(ctx[i + 1])
                i += 2
                continue
            # если пара разорвана (следующего tool нет в окне) — пропускаем это AI-сообщение
            i += 1
            continue
        sanitized.append(m)
        i += 1

    llm = (
        build_general_assistant_llm(DEFAULT_MODEL)
        .bind_tools(TOOLS)
        .with_config(metadata={"display": True})
    )
    #print("general response: ", sanitized, "\n")
    response = llm.invoke(sanitized)
    response.response_metadata = {**getattr(response, "response_metadata", {}), "display": True, "NODE_NAME": "general_node"}
    return {"messages": [response]}



def should_continue(state: AgentState) -> str:
    # If the last assistant message has tool_calls — go to ToolNode
    msgs = state.get("messages", [])
    if not msgs:
        return "end"
    last = msgs[-1]
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return "tools"
    return "end"


# ── Build graph ────────────────────────────────────────────────────────────


def build_app() -> Any:
    builder = StateGraph(AgentState)

    # Nodes
    builder.add_node("route", route_node)
    builder.add_node("report_analyse", report_analyse_node)
    builder.add_node("report_helper", report_helper_node)
    builder.add_node("general_assistant", general_assistant_node)
    builder.add_node("tools", TOOLS_NODE)

    # Edges
    builder.add_conditional_edges(
        "route",
        route_edges,
        {
            "report_analyse": "report_analyse",
            "report_helper": "report_helper",
            "general_assistant": "general_assistant",
            "end": END,
        },
    )

    builder.add_conditional_edges(
        "general_assistant", should_continue, {"tools": "tools", "end": END}
    )
    builder.add_edge("tools", "general_assistant")

    builder.set_entry_point("route")

    checkpointer = InMemorySaver()
    return builder.compile(checkpointer=checkpointer)


# Exported app and SSE filter
AFINA = build_app()
APP = AFINA
TARGET_NODES = {"report_analyse", "report_helper", "general_assistant", "route"}
