from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).parent / ".env")

from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse
import asyncio, json, shutil
from typing import Optional
from pathlib import Path

from .agent.agent import APP, HumanMessage
from langchain_core.messages import AIMessageChunk

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
TARGET_NODES = {"assistant", "analyze_report"}  # какие ноды отрисовываем на фронте


# Заглушка для агента Afina
AGENT_RESPONSES = {
    "default": "Привет я помощник Afina, загрузи отчет о разработке и нажми кнопку анализ для проведения качественного анализа отчета или продолжи общение со мной в чате.",
    "file_uploaded": "Файл с именем {filename} загружен в чат!"
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
                elif isinstance(item, dict) and "name" in item and isinstance(item["name"], str):
                    out.append(item["name"])
        return out
    except Exception:
        return []

async def generate_agent_response(message: str, chat_id: str, has_files: bool = False) -> str:
    """Генерация ответа агента (заглушка)"""
    if has_files and any(keyword in message.lower() for keyword in ["анализ", "файл", "отчет"]):
        return "Отлично! Я вижу, что у нас есть загруженные файлы. Начинаю анализ документов... Пожалуйста, подождите немного, пока я изучу содержимое."
    elif "привет" in message.lower() or "hello" in message.lower():
        return "Привет! Я Afina, ваш интеллектуальный помощник. Чем могу помочь?"
    else:
        return AGENT_RESPONSES["default"]

async def stream_response(text: str):
    """Потоковая отправка ответа с имитацией печати"""
    words = text.split()
    for i, word in enumerate(words):
        if i == 0:
            chunk = word
        else:
            chunk = " " + word
        
        yield f"data: {json.dumps({'content': chunk, 'done': False})}\n\n"
        await asyncio.sleep(0.1)  # Задержка для имитации печати
    
    yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"


@app.post("/api/chat")
async def chat_endpoint(
    chat_id: str = Form(...),
    message: str = Form(...),
    files: Optional[str] = Form(None)
):
    """Стрим ответа агента в SSE."""
    try:
        file_names = _parse_file_names(files)
        inputs = {
            "messages": [HumanMessage(content=message)],
            "chat_id": chat_id,
            "file_names": file_names,
        }
        config = {"configurable": {"thread_id": chat_id}}

        async def event_iter():
            # stream_mode="messages" — токены LLM + метаданные узла
            async for chunk, meta in APP.astream(inputs, config=config, stream_mode="messages"):
                node = (meta or {}).get("langgraph_node")
                if node not in TARGET_NODES:
                    continue
                if isinstance(chunk, AIMessageChunk):
                    # пропускаем чанки с tool_call_chunks (вызовы инструментов)
                    if getattr(chunk, "tool_call_chunks", None):
                        continue
                    piece = (chunk.content or "").strip("\n")
                    if piece:
                        yield {"data": json.dumps({"content": piece, "done": False})}
            # финальный маркер
            yield {"data": json.dumps({"content": "", "done": True})}

        return EventSourceResponse(event_iter(), ping=15000)  # text/event-stream
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/chat_mock")
async def chat_endpoint_mock(
    chat_id: str = Form(...),
    message: str = Form(...),
    files: Optional[str] = Form(None)  # JSON строка с файлами чата
):
    """Endpoint для отправки сообщений в чат"""
    try:
        # Проверяем есть ли файлы в чате
        has_files = False
        if files:
            file_list = json.loads(files)
            has_files = len(file_list) > 0
        
        # Генерируем ответ
        response_text = await generate_agent_response(message, chat_id, has_files)
        
        return StreamingResponse(
            stream_response(response_text),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/event-stream"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_file(
    file: UploadFile = File(...)
):
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
            "message": f"Файл {new_filename} успешно загружен!"
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
                files.append({
                    "name": file_path.name,
                    "size": file_path.stat().st_size,
                    "uploaded_at": file_path.stat().st_mtime,
                    "path": str(file_path)
                })
        
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
