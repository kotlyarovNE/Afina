#!/usr/bin/env python3

import uvicorn
import os
import sys

# Добавляем текущую директорию в путь
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    print("🚀 Запуск Afina Chat Backend...")
    print("📍 API будет доступно по адресу: http://localhost:8000")
    print("📋 Документация API: http://localhost:8000/docs")
    print("🔄 Перезагрузка при изменениях включена")
    print("-" * 50)
    
    uvicorn.run(
        "app.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        log_level="info"
    )
