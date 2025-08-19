from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import asyncio
import json
import os
import shutil
import time
from typing import Optional
import uuid
from pathlib import Path

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
    "file_uploaded": "Файл с именем {filename} загружен в чат!"
}

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
        
        # Если файл уже существует, добавляем timestamp к имени
        if file_path.exists():
            name, ext = os.path.splitext(file.filename)
            timestamp = int(time.time())
            new_filename = f"{name}_{timestamp}{ext}"
            file_path = UPLOADS_DIR / new_filename
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
