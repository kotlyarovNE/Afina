from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, File, UploadFile, HTTPException, Form

from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import asyncio
import json
import shutil
from typing import Optional
# какие ноды отрисовываем на фронте
from .agent.agent import APP, HumanMessage

app = FastAPI(title="Afina Chat API")

# CORS настройки для frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Создание папки uploads если её нет
UPLOADS_DIR = Path("app/uploads")
UPLOADS_DIR.mkdir(exist_ok=True)


# Заглушка для агента Afina
AGENT_RESPONSES = {
    "default": "Привет я помощник Afina, загрузи отчет о разработке и нажми кнопку анализ для проведения качественного анализа отчета или продолжи общение со мной в чате.",
    "file_uploaded": "Файл с именем {filename} загружен в чат!",
}


def _parse_file_names(files_json: Optional[str]) -> list[str]:
    """Принимает JSON-строку со списком: ['a.pdf'] или [{'name': 'a.pdf'}]"""
    if not files_json:
        return []
    try:
        data = json.loads(files_json)
        out: list[str] = []
        if isinstance(data, list):
            for item in data:
                if isinstance(item, str):
                    out.append(item)
                elif (
                    isinstance(item, dict)
                    and "name" in item
                    and isinstance(item["name"], str)
                ):
                    out.append(item["name"])
        return out
    except Exception:
        return []


@app.post("/api/chat")
async def chat_endpoint_post(
    chat_id: str = Form(...),
    message: str = Form(...),
    files: Optional[str] = Form(None),
):
    return await _chat_handler(chat_id, message, files)

@app.get("/api/chat")
async def chat_endpoint_get(
    chat_id: str,
    message: str,
    files: Optional[str] = None,
):
    return await _chat_handler(chat_id, message, files)

async def _chat_handler(chat_id: str, message: str, files: Optional[str]):
    try:
        file_names = _parse_file_names(files)
        inputs = {
            "messages": [HumanMessage(content=message)],
            "chat_id": chat_id,
            "file_names": file_names,
        }
        config = {"configurable": {"thread_id": chat_id}}

        async def event_iter():
            streamed = set()  # храним (step, node) с отправленными токенами

            async for ev in APP.astream_events(inputs, config=config, version="v2"):
                evt = ev.get("event")
                data = ev.get("data") or {}
                meta = ev.get("metadata") or {}
                node = meta.get("langgraph_node")
                step = meta.get("langgraph_step")
                key = (step, node)

                # Игнорим граф-уровень (неинтересные)
                if not node:
                    continue

                # 1) Токены LLM - стримим в реальном времени
                if evt in ("on_chat_model_stream", "on_llm_stream"):
                    chunk = data.get("chunk")
                    text = getattr(chunk, "content", None) or data.get("content") or ""
                    if text and meta.get("display"):
                        streamed.add(key)
                        yield {"data": json.dumps({"content": text, "done": False})}
                        await asyncio.sleep(0.05)

                        # Убираем задержку для мгновенной отправки


                # 2) Финал LLM только если токенов не было (одним куском)
                elif evt in ("on_chat_model_end", "on_llm_end", "on_message_end"):
                    msg = data.get("output") or data.get("message")
                    text = getattr(msg, "content", None) or ""
                    display = meta.get("display") or getattr(msg, "response_metadata", {}).get("display")
                    if text and display and key not in streamed:
                        # Отправляем полное сообщение без искусственных задержек
                        yield {"data": json.dumps({"content": text, "done": False})}
                        await asyncio.sleep(0.05)

                # 3) AIMessage от роутера / других нод (без LLM)
                elif evt == "on_chain_stream":
                    if key in streamed:
                        continue
                    for m in (data.get("chunk") or {}).get("messages") or []:
                        text = getattr(m, "content", "")
                        display = getattr(m, "response_metadata", {}) or {}
                        if text and display.get("display"):
                            yield {"data": json.dumps({"content": text, "done": False})}
                            await asyncio.sleep(0.05)

            # финальный флаг окончания
            yield {"data": json.dumps({"content": "", "done": True})}



        return EventSourceResponse(
            event_iter(),
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Отключаем буферизацию в Nginx
            },
            ping=15000
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Endpoint для загрузки файлов в общую папку uploads"""
    try:
        # Сохраняем файл в общую папку uploads
        file_path = UPLOADS_DIR / file.filename

        # Если файл уже существует, считаем что он уже загружен
        if file_path.exists():
            new_filename = file.filename
        else:
            new_filename = file.filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

        # Возвращаем информацию о файле
        return {
            "success": True,
            "filename": new_filename,
            "original_filename": file.filename,
            "file_path": str(file_path),
            "size": file_path.stat().st_size,
            "message": f"Файл {new_filename} успешно загружен!",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка загрузки файла: {str(e)}")


@app.get("/api/files")
async def get_all_files():
    """Получение списка всех загруженных файлов"""
    try:
        if not UPLOADS_DIR.exists():
            return {"files": []}

        files = []
        for file_path in UPLOADS_DIR.iterdir():
            if file_path.is_file():
                files.append(
                    {
                        "name": file_path.name,
                        "size": file_path.stat().st_size,
                        "uploaded_at": file_path.stat().st_mtime,
                        "path": str(file_path),
                    }
                )

        # Сортируем по дате загрузки (новые первые)
        files.sort(key=lambda x: x["uploaded_at"], reverse=True)

        return {"files": files}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/files/{filename}")
async def delete_file(filename: str):
    """Удаление файла из общей папки uploads"""
    try:
        file_path = UPLOADS_DIR / filename
        if file_path.exists():
            file_path.unlink()
            return {"success": True, "message": f"Файл {filename} удален"}
        else:
            raise HTTPException(status_code=404, detail="Файл не найден")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
async def health_check():
    """Проверка работоспособности API"""
    return {"status": "ok", "message": "Afina API работает"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
